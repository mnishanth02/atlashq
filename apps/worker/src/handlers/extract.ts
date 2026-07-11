import { createHash } from "node:crypto";
import type { DocumentProcessingJobPayload } from "@atlashq/jobs";
import { createIdempotencyKey } from "@atlashq/jobs";
import type { Queue } from "bullmq";
import {
  countSourceChunks,
  hasCompleteExtractionMetadata,
  insertExtractionChunksAndMetadata,
  listSourceChunkContentsInOrder,
  listSourceDocumentFiles,
  requireSourceDocument,
  requireSourceExtraction,
  updateSourceDocumentProcessingStatus,
  updateSourceExtraction,
} from "../db/source-vault-repository.js";
import { RetryableWorkerError, TerminalWorkerError } from "../errors.js";
import { CorruptContentError, chunkSegments, runExtractionAdapter } from "../extraction/index.js";
import { UnsupportedFormatError } from "../extraction/types.js";
import { UnsafeZipContainerError } from "../extraction/zip-safety.js";
import type { ExtractJobPayload } from "../job-types.js";
import { logWorkerEvent } from "../logger.js";
import { recordWorkerAuditEvent } from "../runtime/audit.js";
import type { WorkerRuntimeContext } from "../runtime/context.js";
import { enqueueDocumentProcessingJob } from "../runtime/job-queue.js";

/**
 * Handles the `extract` document-processing job (module-02 §6.10). Loads the primary evidence file
 * for the source document, dispatches the deterministic parser adapter for its format, chunks the
 * resulting segments, and inserts the append-only `source_chunk` rows together with the
 * `source_extraction.parser_manifest`/`extracted_text_hash` metadata in one database transaction
 * (see `insertExtractionChunksAndMetadata`) -- a worker crash between inserting chunks and writing
 * that metadata can never leave an extraction with chunks but no metadata, or metadata without its
 * chunks.
 *
 * Crucially, this handler never sets `source_extraction.status` to a terminal value on success --
 * `source_extraction` is frozen (every column) once `status` is `succeeded`/`failed` (see
 * `packages/db/src/source-vault-guard.test.ts`), and `generate-preview` still needs to write
 * `preview_object_key` afterwards. On success this handler leaves `status = "running"` and enqueues
 * `generate-preview`, which performs the final terminal transition. On a parsing failure, this
 * handler sets `status = "failed"` directly since there is nothing left for `generate-preview` to
 * do.
 *
 * Replay is metadata-aware, not just chunk-aware: if chunks already exist but the parser
 * manifest/extracted-text-hash metadata is missing or incomplete (only possible from an older,
 * pre-atomic-transaction run that crashed between the two writes), this handler recomputes the
 * metadata -- the parser manifest by re-running the deterministic adapter against the (immutable)
 * primary file, and the extracted-text hash from the chunks that are actually persisted, the source
 * of truth -- and backfills it transactionally before ever enqueuing `generate-preview`. Preview is
 * never enqueued while extraction metadata is incomplete.
 */
export async function handleExtract(
  context: WorkerRuntimeContext,
  queue: Pick<Queue<DocumentProcessingJobPayload>, "add">,
  payload: ExtractJobPayload,
): Promise<void> {
  const { db, storage } = context;
  const logContext = { correlationId: payload.correlationId, queueName: "document-processing" };

  const sourceDocumentRow = await requireSourceDocument(db, {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    sourceDocumentId: payload.sourceDocumentId,
  });
  const extraction = await requireSourceExtraction(db, {
    sourceDocumentId: payload.sourceDocumentId,
    sourceExtractionId: payload.sourceExtractionId,
  });

  if (extraction.status === "succeeded" || extraction.status === "failed") {
    logWorkerEvent(logContext, "source.extract.replayed", {
      sourceDocumentId: payload.sourceDocumentId,
      sourceExtractionId: extraction.id,
      status: extraction.status,
    });
    return; // Idempotent replay: this extraction version already reached a terminal state.
  }

  const existingChunkCount = await countSourceChunks(db, extraction.id);

  if (existingChunkCount > 0 && hasCompleteExtractionMetadata(extraction, existingChunkCount)) {
    // Ordinary idempotent replay: chunks and metadata were already committed together by an
    // earlier (atomic) attempt. Nothing left to do except make sure the next stage is enqueued.
    await enqueueGeneratePreview(queue, payload, extraction.id);
    logWorkerEvent(logContext, "source.extract.replayed_chunks_present", {
      sourceDocumentId: payload.sourceDocumentId,
      sourceExtractionId: extraction.id,
      existingChunkCount,
    });
    return;
  }

  // Either a fresh parse (existingChunkCount === 0), or a crash-recovery backfill: chunks are
  // already committed from an older, pre-atomic-transaction run but its parser
  // manifest/extracted-text-hash metadata never made it into the same transaction. Both paths
  // need the primary file and a fresh (deterministic) adapter run.
  const isBackfill = existingChunkCount > 0;

  const actorId = sourceDocumentRow.createdBy;
  const files = await listSourceDocumentFiles(db, sourceDocumentRow.id);
  const primaryFile = files.find((candidate) => candidate.role === "primary") ?? files[0];

  if (!primaryFile) {
    await failExtraction(db, extraction.id, sourceDocumentRow.id, "NO_PRIMARY_FILE");
    await recordWorkerAuditEvent(db, {
      organizationId: payload.organizationId,
      actorId,
      action: "source.extract.failed",
      entityType: "source_extraction",
      entityId: extraction.id,
      projectId: payload.projectId,
      correlationId: payload.correlationId,
      after: { failureCode: "NO_PRIMARY_FILE" },
    });
    throw new TerminalWorkerError(
      "NO_PRIMARY_FILE",
      `source_document ${sourceDocumentRow.id} has no primary evidence file to extract.`,
    );
  }

  if (extraction.status === "pending") {
    await updateSourceExtraction(db, extraction.id, { status: "running", startedAt: new Date() });
    await updateSourceDocumentProcessingStatus(db, sourceDocumentRow.id, "extracting");
  }

  let buffer: Buffer;
  try {
    const stream = await storage.getObjectStream({ objectKey: primaryFile.objectKey });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
    }
    buffer = Buffer.concat(chunks);
  } catch (error) {
    throw new RetryableWorkerError(
      "STORAGE_STREAM_FAILED",
      "Failed to stream the evidence file for extraction.",
      { cause: error },
    );
  }

  try {
    const adapterResult = await runExtractionAdapter(buffer, primaryFile.format);
    const parsedChunks = adapterResult.metadataOnly ? [] : chunkSegments(adapterResult.segments);

    let chunkRowsToInsert: Parameters<typeof insertExtractionChunksAndMetadata>[1]["chunks"];
    let extractedTextHash: string | null;

    if (isBackfill) {
      // Never re-insert chunks already committed by the earlier attempt -- that would violate
      // `source_chunk_extraction_sequence_uidx`. Recompute the hash from what is actually
      // persisted (the source of truth) rather than from this fresh parse.
      chunkRowsToInsert = [];
      const persistedContents = await listSourceChunkContentsInOrder(db, extraction.id);
      extractedTextHash =
        persistedContents.length > 0
          ? createHash("sha256").update(persistedContents.join("\n")).digest("hex")
          : null;
    } else {
      chunkRowsToInsert = parsedChunks.map((chunk) => ({
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        sourceDocumentId: sourceDocumentRow.id,
        sourceExtractionId: extraction.id,
        sequence: chunk.sequence,
        content: chunk.content,
        characterCount: chunk.characterCount,
        contentHash: chunk.contentHash,
        locator: chunk.locator,
      }));
      extractedTextHash =
        parsedChunks.length > 0
          ? createHash("sha256")
              .update(parsedChunks.map((chunk) => chunk.content).join("\n"))
              .digest("hex")
          : null;
    }

    const { chunkCount } = await insertExtractionChunksAndMetadata(db, {
      sourceExtractionId: extraction.id,
      chunks: chunkRowsToInsert,
      parserManifest: adapterResult.parserManifest,
      extractedTextHash,
    });

    await recordWorkerAuditEvent(db, {
      organizationId: payload.organizationId,
      actorId,
      action: isBackfill ? "source.extract.metadata_backfilled" : "source.extract.parsed",
      entityType: "source_extraction",
      entityId: extraction.id,
      projectId: payload.projectId,
      correlationId: payload.correlationId,
      after: { chunkCount, parserManifest: adapterResult.parserManifest },
    });
    logWorkerEvent(
      logContext,
      isBackfill ? "source.extract.metadata_backfilled" : "source.extract.succeeded",
      {
        sourceDocumentId: sourceDocumentRow.id,
        sourceExtractionId: extraction.id,
        chunkCount,
        metadataOnly: adapterResult.metadataOnly,
      },
    );

    await enqueueGeneratePreview(queue, payload, extraction.id);
  } catch (error) {
    if (
      error instanceof UnsupportedFormatError ||
      error instanceof CorruptContentError ||
      error instanceof UnsafeZipContainerError
    ) {
      await failExtraction(db, extraction.id, sourceDocumentRow.id, "PARSE_FAILED", error.message);
      await recordWorkerAuditEvent(db, {
        organizationId: payload.organizationId,
        actorId,
        action: "source.extract.failed",
        entityType: "source_extraction",
        entityId: extraction.id,
        projectId: payload.projectId,
        correlationId: payload.correlationId,
        after: { failureCode: "PARSE_FAILED", detail: error.message },
      });
      logWorkerEvent(
        logContext,
        "source.extract.failed",
        {
          sourceDocumentId: sourceDocumentRow.id,
          sourceExtractionId: extraction.id,
          failureCode: "PARSE_FAILED",
        },
        "warn",
      );
      throw new TerminalWorkerError("PARSE_FAILED", error.message, { cause: error });
    }

    throw new RetryableWorkerError("EXTRACTION_FAILED", "Extraction failed unexpectedly.", {
      cause: error,
    });
  }
}

async function failExtraction(
  db: WorkerRuntimeContext["db"],
  sourceExtractionId: string,
  sourceDocumentId: string,
  failureCode: string,
  failureDetail?: string,
): Promise<void> {
  await updateSourceExtraction(db, sourceExtractionId, {
    status: "failed",
    completedAt: new Date(),
    failureCode,
    ...(failureDetail ? { failureDetail } : {}),
  });
  await updateSourceDocumentProcessingStatus(db, sourceDocumentId, "failed");
}

async function enqueueGeneratePreview(
  queue: Pick<Queue<DocumentProcessingJobPayload>, "add">,
  payload: ExtractJobPayload,
  sourceExtractionId: string,
): Promise<void> {
  await enqueueDocumentProcessingJob(queue, {
    kind: "generate-preview",
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    sourceDocumentId: payload.sourceDocumentId,
    sourceExtractionId,
    idempotencyKey: createIdempotencyKey({
      queueName: "document-processing",
      resourceId: sourceExtractionId,
      operation: "generate-preview",
    }),
    correlationId: payload.correlationId,
    submittedAt: new Date().toISOString(),
  });
}
