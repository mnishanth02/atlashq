import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { DocumentProcessingJobPayload } from "@atlashq/jobs";
import { createIdempotencyKey } from "@atlashq/jobs";
import type { JsonObject } from "@atlashq/types";
import type { Queue } from "bullmq";
import {
  advanceSourceAfterFileScan,
  requireSourceDocument,
  requireSourceDocumentFile,
  type SourceScanAdvanceResult,
  updateSourceDocumentProcessingStatus,
} from "../db/source-vault-repository.js";
import { InvalidJobDataError, RetryableWorkerError, TerminalWorkerError } from "../errors.js";
import { CHUNKER_VERSION } from "../extraction/chunker.js";
import { assertSafeZipContainer, UnsafeZipContainerError } from "../extraction/zip-safety.js";
import type { VerifyAndScanJobPayload } from "../job-types.js";
import { logWorkerEvent } from "../logger.js";
import { recordWorkerAuditEvent } from "../runtime/audit.js";
import type { WorkerRuntimeContext } from "../runtime/context.js";
import { enqueueDocumentProcessingJob } from "../runtime/job-queue.js";
import { verifyDeclaredFormat } from "../verify/file-signature.js";

/** `source_document_file.format` values backed by a ZIP/OOXML container. */
const ZIP_CONTAINER_FORMATS = new Set(["docx", "xlsx", "pptx"]);

/** Fixed, non-user-controlled temp file name inside the per-job random temp directory. */
const TEMP_PAYLOAD_FILE_NAME = "payload.bin";
/** Prefix for the random per-job scratch directory created under the OS temp dir. */
const TEMP_DIR_PREFIX = "atlashq-worker-verify-";

/** Internal marker thrown by the hashing/size-guard transform to abort the pipeline early. */
class OversizedStreamError extends Error {
  constructor(readonly maxBytes: number) {
    super("Uploaded object exceeds the configured maximum file size while streaming.");
    this.name = "OversizedStreamError";
  }
}

/** processing_status values from which the source may move into `scanning`. */
const PRE_SCAN_STATUSES = new Set(["verification_pending", "scan_pending"]);

/**
 * Handles the `verify-and-scan` document-processing job (module-02 §6.9, §9). Streams the object
 * from storage into a random per-job temp file (never buffering the whole payload in memory)
 * while computing a real SHA-256 and enforcing the actual byte-size limit in flight, checks the
 * actual byte size, verifies the actual file signature/container against the declared format,
 * enforces safe-ZIP limits for Office containers, and finally streams the temp file to ClamAV via
 * a fresh `fs.createReadStream` (genuine INSTREAM streaming, not a full in-memory Buffer) before
 * anything is ever parsed or previewed. The temp directory is always removed in a `finally` block,
 * on every success/terminal/retryable path.
 *
 * Idempotency is file-scoped: `source_document_file.scan_status` (not the parent document's
 * `processing_status`) gates whether *this* file still needs scanning, because a multi-file source
 * (e.g. a screenshot-set reference upload) enqueues one `verify-and-scan` job per file and every
 * file must independently verify/hash/type/ZIP/ClamAV -- the first file reaching a clean/terminal
 * outcome must never cause a sibling file's job to short-circuit. Once every sibling file is
 * `clean`/`not_required`, the source may enter extraction; if any file is `infected` or a
 * validation `failed`, the whole source is quarantined/failed regardless of the other files'
 * state. `advanceSourceAfterFileScan` performs that cross-file coordination transactionally (a row
 * lock on the parent `source_document`) so exactly one `source_extraction`/`extract` job is ever
 * created no matter which file's job happens to finish last, and so a replay of an already-scanned
 * file (its `scan_status` is already terminal) still re-runs only that coordination step -- never
 * the scan itself -- to recover a source that got stuck mid-flight.
 */
export async function handleVerifyAndScan(
  context: WorkerRuntimeContext,
  queue: Pick<Queue<DocumentProcessingJobPayload>, "add">,
  payload: VerifyAndScanJobPayload,
): Promise<void> {
  const { db, storage, clamav, env } = context;
  const logContext = { correlationId: payload.correlationId, queueName: "document-processing" };

  const sourceDocumentRow = await requireSourceDocument(db, {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    sourceDocumentId: payload.sourceDocumentId,
  });
  const file = await requireSourceDocumentFile(db, {
    sourceDocumentId: payload.sourceDocumentId,
    sourceDocumentFileId: payload.sourceDocumentFileId,
  });

  if (file.objectKey !== payload.objectKey) {
    throw new InvalidJobDataError(
      `verify-and-scan job objectKey does not match source_document_file ${file.id}.`,
    );
  }
  if (payload.expectedSha256 !== file.sha256) {
    throw new InvalidJobDataError(
      `verify-and-scan job expectedSha256 does not match source_document_file ${file.id}.`,
    );
  }

  const actorId = sourceDocumentRow.createdBy;

  const maybeEnqueueExtract = async (advance: SourceScanAdvanceResult): Promise<void> => {
    if (advance.outcome !== "extraction_ready") {
      return;
    }
    // BullMQ de-dupes on `jobId` (the extraction id), so it is always safe to call this again on
    // replay even when `advance.alreadyExisted` is true -- it is how a source recovers if the
    // worker crashed after creating the extraction row but before this enqueue reached Redis.
    await enqueueDocumentProcessingJob(queue, {
      kind: "extract",
      organizationId: payload.organizationId,
      projectId: payload.projectId,
      sourceDocumentId: sourceDocumentRow.id,
      sourceExtractionId: advance.extraction.id,
      idempotencyKey: createIdempotencyKey({
        queueName: "document-processing",
        resourceId: advance.extraction.id,
        operation: "extract",
      }),
      correlationId: payload.correlationId,
      submittedAt: new Date().toISOString(),
    });
  };

  if (file.scanStatus !== "pending") {
    // Idempotent replay: this file already reached a terminal scan outcome (or never required
    // one). Re-run only the cross-file coordination step -- never the scan itself -- so a source
    // stuck because the worker crashed between recording this file's outcome and advancing the
    // source can still catch up.
    const advance = await advanceSourceAfterFileScan(db, {
      sourceDocumentId: sourceDocumentRow.id,
      chunkerVersion: CHUNKER_VERSION,
    });
    await maybeEnqueueExtract(advance);
    logWorkerEvent(logContext, "source.verify.replayed", {
      sourceDocumentId: sourceDocumentRow.id,
      sourceDocumentFileId: file.id,
      outcome: advance.outcome,
    });
    return;
  }

  const fail = async (
    code: string,
    reason: string,
    details: JsonObject,
    message: string,
  ): Promise<never> => {
    await advanceSourceAfterFileScan(db, {
      sourceDocumentId: sourceDocumentRow.id,
      chunkerVersion: CHUNKER_VERSION,
      fileUpdate: { sourceDocumentFileId: file.id, scanStatus: "failed", scanResult: details },
    });
    await recordWorkerAuditEvent(db, {
      organizationId: payload.organizationId,
      actorId,
      action: `source.verify.${reason}`,
      entityType: "source_document_file",
      entityId: file.id,
      projectId: payload.projectId,
      correlationId: payload.correlationId,
      after: details,
    });
    logWorkerEvent(
      logContext,
      `source.verify.${reason}`,
      {
        sourceDocumentId: sourceDocumentRow.id,
        sourceDocumentFileId: file.id,
        status: "failed",
        reason,
      },
      "warn",
    );
    throw new TerminalWorkerError(code, message);
  };

  const quarantine = async (scanResult: JsonObject): Promise<never> => {
    await advanceSourceAfterFileScan(db, {
      sourceDocumentId: sourceDocumentRow.id,
      chunkerVersion: CHUNKER_VERSION,
      fileUpdate: { sourceDocumentFileId: file.id, scanStatus: "infected", scanResult },
    });
    await recordWorkerAuditEvent(db, {
      organizationId: payload.organizationId,
      actorId,
      action: "source.verify.malware_detected",
      entityType: "source_document_file",
      entityId: file.id,
      projectId: payload.projectId,
      correlationId: payload.correlationId,
      after: scanResult,
    });
    logWorkerEvent(
      logContext,
      "source.verify.infected",
      {
        sourceDocumentId: sourceDocumentRow.id,
        sourceDocumentFileId: file.id,
        signature: typeof scanResult.signature === "string" ? scanResult.signature : "present",
      },
      "warn",
    );
    throw new TerminalWorkerError(
      "MALWARE_DETECTED",
      "ClamAV detected malware in the uploaded file.",
    );
  };

  if (PRE_SCAN_STATUSES.has(sourceDocumentRow.processingStatus)) {
    await updateSourceDocumentProcessingStatus(db, sourceDocumentRow.id, "scanning");
  }

  let stat: Awaited<ReturnType<typeof storage.statObject>>;
  try {
    stat = await storage.statObject({ objectKey: file.objectKey });
  } catch (error) {
    throw new RetryableWorkerError("STORAGE_STAT_FAILED", "Failed to stat the uploaded object.", {
      cause: error,
    });
  }

  // Every subsequent step (streaming-to-disk, format/zip validation, ClamAV scan) uses this one
  // random, non-user-named scratch directory; it is always removed below regardless of outcome.
  const tempDir = await mkdtemp(join(tmpdir(), TEMP_DIR_PREFIX));
  const tempFilePath = join(tempDir, TEMP_PAYLOAD_FILE_NAME);

  try {
    let objectStream: Awaited<ReturnType<typeof storage.getObjectStream>>;
    try {
      objectStream = await storage.getObjectStream({ objectKey: file.objectKey });
    } catch (error) {
      throw new RetryableWorkerError(
        "STORAGE_STREAM_FAILED",
        "Failed to stream the uploaded object.",
        { cause: error },
      );
    }

    const hash = createHash("sha256");
    let totalBytes = 0;
    const maxBytes = env.SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES;

    // Hashes and counts bytes in flight while piping straight through to the temp file on disk --
    // the payload is never accumulated into an in-memory Buffer/array during this pass.
    const hashingSizeGuard = new Transform({
      transform(chunk, _encoding, callback) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike);
        totalBytes += buffer.length;
        if (totalBytes > maxBytes) {
          callback(new OversizedStreamError(maxBytes));
          return;
        }
        hash.update(buffer);
        callback(null, buffer);
      },
    });

    try {
      await pipeline(objectStream, hashingSizeGuard, createWriteStream(tempFilePath));
    } catch (error) {
      if (error instanceof OversizedStreamError) {
        return await fail(
          "OVERSIZED_FILE",
          "oversized",
          { reason: "oversized", maxBytes: error.maxBytes },
          "Uploaded object exceeds the configured maximum file size.",
        );
      }
      if (error instanceof TerminalWorkerError) {
        throw error;
      }
      throw new RetryableWorkerError(
        "STORAGE_STREAM_FAILED",
        "Failed while streaming the uploaded object to disk.",
        { cause: error },
      );
    }

    const actualSha256 = hash.digest("hex");

    if (actualSha256 !== file.sha256 || stat.sizeBytes !== file.byteSize) {
      await fail(
        "HASH_MISMATCH",
        "hash_mismatch",
        {
          reason: "hash_mismatch",
          expectedSha256: file.sha256,
          actualSha256,
          expectedByteSize: file.byteSize,
          actualByteSize: stat.sizeBytes,
        },
        "Recomputed SHA-256/byte size did not match the declared source_document_file values.",
      );
    }

    // `file-type`/UTF-8/zip-safety validation need a bounded, complete read of the (already
    // size-checked) temp file -- this one-time buffer is released immediately below, before the
    // ClamAV scan, so it never coexists with a second in-memory copy of the payload.
    let validationBuffer: Buffer | null = await readFile(tempFilePath);

    const formatResult = await verifyDeclaredFormat(validationBuffer, file.format);
    if (formatResult.outcome === "mismatch") {
      await fail(
        "TYPE_MISMATCH",
        "type_mismatch",
        {
          reason: "type_mismatch",
          declaredFormat: file.format,
          detectedExtension: formatResult.detectedExtension,
          detectedMimeType: formatResult.detectedMimeType,
        },
        "Actual file content does not match the declared format.",
      );
    }
    if (formatResult.outcome === "text-invalid") {
      await fail(
        "CORRUPT_CONTENT",
        "corrupt_content",
        { reason: "corrupt_content", detail: formatResult.reason },
        "Declared text file is not valid UTF-8 text.",
      );
    }

    if (ZIP_CONTAINER_FORMATS.has(file.format)) {
      try {
        assertSafeZipContainer(validationBuffer);
      } catch (error) {
        if (error instanceof UnsafeZipContainerError) {
          await fail(
            "UNSAFE_ARCHIVE",
            "unsafe_archive",
            { reason: "unsafe_archive", detail: error.message },
            error.message,
          );
        }
        throw error;
      }
    }

    // Drop the validation buffer reference before scanning: ClamAV below reads a fresh stream
    // straight off disk, so the validation buffer and the scan input never overlap in memory.
    validationBuffer = null;

    const scanResult = await clamav.scanStream(createReadStream(tempFilePath));

    switch (scanResult.status) {
      case "clean": {
        const advance = await advanceSourceAfterFileScan(db, {
          sourceDocumentId: sourceDocumentRow.id,
          chunkerVersion: CHUNKER_VERSION,
          fileUpdate: {
            sourceDocumentFileId: file.id,
            scanStatus: "clean",
            scanResult: {
              engine: "clamav",
              engineVersion: scanResult.version.engineVersion,
              bytesScanned: scanResult.bytesScanned,
            },
            scanSignatureVersion: scanResult.version.signatureVersion ?? null,
          },
        });
        await recordWorkerAuditEvent(db, {
          organizationId: payload.organizationId,
          actorId,
          action: "source.verify.clean",
          entityType: "source_document_file",
          entityId: file.id,
          projectId: payload.projectId,
          correlationId: payload.correlationId,
        });
        logWorkerEvent(logContext, "source.verify.clean", {
          sourceDocumentId: sourceDocumentRow.id,
          sourceDocumentFileId: file.id,
          bytesScanned: scanResult.bytesScanned,
          extractionReady: advance.outcome === "extraction_ready",
        });

        await maybeEnqueueExtract(advance);
        return;
      }
      case "infected": {
        await quarantine({
          engine: "clamav",
          signature: scanResult.signature,
          bytesScanned: scanResult.bytesScanned,
        });
        return;
      }
      case "unavailable":
      case "timeout": {
        throw new RetryableWorkerError(
          scanResult.status === "timeout" ? "CLAMAV_TIMEOUT" : "CLAMAV_UNAVAILABLE",
          "ClamAV was unavailable or timed out while scanning the uploaded file.",
        );
      }
      case "protocol-error": {
        await fail(
          "CLAMAV_PROTOCOL_ERROR",
          "clamav_protocol_error",
          { reason: "clamav_protocol_error", detail: scanResult.reason },
          "ClamAV returned an unexpected protocol response.",
        );
      }
    }
  } finally {
    // Always clean up the per-job scratch directory: clean, infected, terminal-validation, and
    // retryable-scanner-failure paths all funnel through here.
    await rm(tempDir, { recursive: true, force: true });
  }
}
