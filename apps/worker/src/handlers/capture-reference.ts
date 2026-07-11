import { createHash } from "node:crypto";
import type { DocumentProcessingJobPayload } from "@atlashq/jobs";
import { createIdempotencyKey } from "@atlashq/jobs";
import {
  createImmutableObjectKey,
  createSha256ContentHash,
  immutableStoragePurposes,
} from "@atlashq/storage";
import type { Queue } from "bullmq";
import { CaptureUnavailableError } from "../capture/capture-adapter.js";
import { CaptureUrlBlockedError } from "../capture/ssrf-guard.js";
import {
  createReferenceCaptureSuccessor,
  findCaptureSuccessorState,
  findReferenceArtifact,
  isCaptureSuccessorComplete,
  requireSourceDocument,
} from "../db/source-vault-repository.js";
import {
  IncompleteCaptureSuccessorError,
  InvalidJobDataError,
  RetryableWorkerError,
  TerminalWorkerError,
} from "../errors.js";
import { CHUNKER_VERSION } from "../extraction/chunker.js";
import type { CaptureReferenceJobPayload } from "../job-types.js";
import { logWorkerEvent } from "../logger.js";
import { recordWorkerAuditEvent } from "../runtime/audit.js";
import type { WorkerRuntimeContext } from "../runtime/context.js";
import { enqueueDocumentProcessingJob } from "../runtime/job-queue.js";

/**
 * Handles the `capture-reference` document-processing job (module-02 §6.8): captures one public
 * HTTP/S page via the injected {@link WorkerRuntimeContext.captureAdapter} and, on success, stores
 * the result as a brand-new immutable `source_document` *version* rather than mutating the
 * existing (predecessor) document -- `source_document`/`source_document_file` are confirmed
 * evidence and archive-only, and a capture always produces new content, so `payload.sourceDocumentId`
 * is treated as the *predecessor* every single time (including the very first capture for a
 * reference, whose root version is created content-less by the API). The successor:
 *  - shares `organization_id`/`project_id`/`lineage_id` with the predecessor and is exactly one
 *    `version_number` ahead, with `supersedes_id` pointing at the predecessor (module-02 §8.3
 *    lineage guard);
 *  - gets its own `content_hash` covering the canonical captured-snapshot manifest (final URL,
 *    title, capture timestamp, and screenshot hash) rather than inheriting the predecessor's hash;
 *  - gets its own `reference_artifact` companion (the table's `source_document_id` is unique, so a
 *    new version needs its own row) copying forward the predecessor's immutable
 *    reference/attestation metadata, with `capture_method = on_demand_single_page_capture`,
 *    `captured_at` set from the capture result, and `ip_review_status` reset to `not_reviewed`;
 *  - gets its own single `source_document_file` screenshot -- the predecessor's files are never
 *    mutated or appended to;
 *  - gets its first `source_extraction` row and a `source.capture.succeeded` audit event.
 *
 * All of the successor's rows (the `source_document` version itself, its `reference_artifact`
 * companion, its `source_document_file` screenshot, its `source_extraction` row, and the audit
 * event) are written together by {@link createReferenceCaptureSuccessor} in a single database
 * transaction -- a worker crash between any two of those writes can never leave a partial
 * successor behind; either all of it commits or none of it does.
 *
 * Reference capture is disabled by default (`captureEnabled`); the API is expected to reject
 * capture requests before ever queueing a job when the feature is off, but the worker enforces the
 * flag defensively as well, in depth.
 *
 * Idempotency/no-forking: `source_document_supersedes_id_uidx` guarantees at most one successor
 * per predecessor at the database level, and `createReferenceCaptureSuccessor` additionally locks
 * the predecessor row `FOR UPDATE` before checking, so two concurrent attempts serialize instead of
 * racing the constraint. Before ever calling the capture adapter, this handler checks whether a
 * successor already exists for `payload.sourceDocumentId`; if so, this is a replay of an
 * already-completed capture and the handler only re-derives the successor's extraction and
 * (idempotently, via BullMQ's `jobId` de-dupe) re-enqueues `extract`, without capturing again or
 * attempting a second fork -- unless that existing successor is missing one of its required
 * companion rows (left behind by an older, pre-atomic-transaction attempt that crashed mid-write),
 * in which case this fails loudly with {@link IncompleteCaptureSuccessorError} rather than ever
 * silently treating it as complete. A failed capture attempt never mutates the predecessor at all
 * -- there is nothing to supersede it with, so the predecessor is left exactly as it was and a
 * fresh `capture-reference` job against the same predecessor can simply be retried later.
 */
export async function handleCaptureReference(
  context: WorkerRuntimeContext,
  queue: Pick<Queue<DocumentProcessingJobPayload>, "add">,
  payload: CaptureReferenceJobPayload,
): Promise<void> {
  const { db, storage, env, captureEnabled, captureAdapter } = context;
  const logContext = { correlationId: payload.correlationId, queueName: "document-processing" };

  if (!captureEnabled) {
    throw new TerminalWorkerError(
      "CAPTURE_DISABLED",
      "One-page reference capture is disabled by feature flag.",
    );
  }

  const predecessor = await requireSourceDocument(db, {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    sourceDocumentId: payload.sourceDocumentId,
  });

  const existingState = await findCaptureSuccessorState(db, predecessor.id);
  if (existingState) {
    // Idempotent replay: this predecessor was already captured into `existingState.successor` by
    // an earlier run of this same job. Never attempt a second fork -- just make sure the
    // successor's extraction stage is (still) enqueued. A fully committed successor always has its
    // reference_artifact/source_document_file/source_extraction rows together (they are written in
    // one transaction); if any is missing here, an older, pre-atomic-transaction run crashed
    // partway through and this must never be silently treated as complete.
    if (!isCaptureSuccessorComplete(existingState)) {
      throw new IncompleteCaptureSuccessorError(
        `source_document ${existingState.successor.id} (successor of ${predecessor.id}) is missing required reference_artifact/source_document_file/source_extraction companion row(s) from an incomplete prior capture attempt; manual repair is required before this job can be replayed.`,
      );
    }

    const extraction = existingState.extraction;
    if (extraction) {
      await enqueueDocumentProcessingJob(queue, {
        kind: "extract",
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        sourceDocumentId: existingState.successor.id,
        sourceExtractionId: extraction.id,
        idempotencyKey: createIdempotencyKey({
          queueName: "document-processing",
          resourceId: extraction.id,
          operation: "extract",
        }),
        correlationId: payload.correlationId,
        submittedAt: new Date().toISOString(),
      });
    }
    logWorkerEvent(logContext, "source.capture.replayed", {
      predecessorId: predecessor.id,
      successorId: existingState.successor.id,
      extractionId: extraction?.id ?? null,
    });
    return;
  }

  const predecessorArtifact = await findReferenceArtifact(db, predecessor.id);
  if (!predecessorArtifact) {
    throw new InvalidJobDataError(
      `source_document ${predecessor.id} has no reference_artifact companion row.`,
    );
  }
  if (predecessorArtifact.sourceUrl !== payload.captureUrl) {
    throw new InvalidJobDataError(
      `capture-reference job captureUrl does not match reference_artifact ${predecessorArtifact.id}.`,
    );
  }

  let result: Awaited<ReturnType<typeof captureAdapter.capture>>;
  try {
    result = await captureAdapter.capture({
      url: payload.captureUrl,
      timeoutMs: env.REFERENCE_CAPTURE_TIMEOUT_MS,
      maxRedirects: env.REFERENCE_CAPTURE_MAX_REDIRECTS,
      maxResponseBytes: env.REFERENCE_CAPTURE_MAX_RESPONSE_BYTES,
      maxTotalBytes: env.REFERENCE_CAPTURE_MAX_TOTAL_BYTES,
    });
  } catch (error) {
    if (error instanceof CaptureUnavailableError) {
      throw new RetryableWorkerError(
        "CAPTURE_UNAVAILABLE",
        "The reference-capture browser is unavailable in this environment.",
        { cause: error },
      );
    }

    // Never mutate the predecessor on a failed capture attempt -- it carries no new content to
    // supersede it with, so it is left exactly as it was and remains capturable for a later retry.
    const failureCode =
      error instanceof CaptureUrlBlockedError ? "CAPTURE_BLOCKED" : "CAPTURE_FAILED";
    await recordWorkerAuditEvent(db, {
      organizationId: payload.organizationId,
      actorId: payload.actorId,
      action: "source.capture.failed",
      entityType: "source_document",
      entityId: predecessor.id,
      projectId: payload.projectId,
      correlationId: payload.correlationId,
      after: { failureCode, detail: error instanceof Error ? error.message : String(error) },
    });
    logWorkerEvent(
      logContext,
      "source.capture.failed",
      {
        predecessorId: predecessor.id,
        failureCode,
      },
      "warn",
    );
    throw new TerminalWorkerError(
      failureCode,
      error instanceof Error ? error.message : "Reference capture failed.",
      { cause: error },
    );
  }

  const screenshotSha256 = createHash("sha256").update(result.screenshotPng).digest("hex");
  const objectKey = createImmutableObjectKey({
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    purpose: immutableStoragePurposes.referenceSnapshot,
    contentHash: createSha256ContentHash(result.screenshotPng),
    fileName: "capture.png",
  });

  let writeResult: Awaited<ReturnType<typeof storage.putObject>>;
  try {
    writeResult = await storage.putObject({
      objectKey,
      data: result.screenshotPng,
      sizeBytes: result.screenshotPng.length,
      contentType: "image/png",
    });
  } catch (error) {
    throw new RetryableWorkerError(
      "STORAGE_PUT_FAILED",
      "Failed to store the reference capture screenshot.",
      { cause: error },
    );
  }

  // The successor's content_hash covers the canonical captured-snapshot manifest -- not just the
  // screenshot bytes -- so it changes whenever the observed page (URL/title/capture time) changes,
  // not only when the pixels happen to differ.
  const capturedAt = new Date(result.capturedAt);
  const snapshotManifest = JSON.stringify({
    finalUrl: result.finalUrl,
    title: result.title ?? null,
    capturedAt: capturedAt.toISOString(),
    screenshotSha256,
  });
  const contentHash = createSha256ContentHash(snapshotManifest);
  const successorVersionNumber = predecessor.versionNumber + 1;

  // Every row this successor needs -- the source_document version itself, its reference_artifact
  // companion, its source_document_file screenshot, its first source_extraction row, and the
  // audit event -- commits together in one transaction (see createReferenceCaptureSuccessor); a
  // worker crash between any two of these writes can never leave a partial successor behind.
  const outcome = await createReferenceCaptureSuccessor(db, {
    predecessorId: predecessor.id,
    successor: {
      organizationId: predecessor.organizationId,
      projectId: predecessor.projectId,
      lineageId: predecessor.lineageId,
      versionNumber: successorVersionNumber,
      sourceType: predecessor.sourceType,
      documentFormat: predecessor.documentFormat,
      title: predecessor.title,
      notes: predecessor.notes,
      tags: predecessor.tags,
      provenanceDate: predecessor.provenanceDate,
      contentHash,
      processingStatus: "extraction_pending",
      createdBy: payload.actorId,
    },
    referenceArtifact: {
      referenceKind: predecessorArtifact.referenceKind,
      captureMethod: "on_demand_single_page_capture",
      accessType: predecessorArtifact.accessType,
      intendedUse: predecessorArtifact.intendedUse,
      sourceUrl: predecessorArtifact.sourceUrl,
      attestationText: predecessorArtifact.attestationText,
      attestationVersion: predecessorArtifact.attestationVersion,
      attestedBy: predecessorArtifact.attestedBy,
      attestedAt: predecessorArtifact.attestedAt,
      capturedAt,
    },
    file: {
      ordinal: 0,
      role: "snapshot",
      originalFileName: "capture.png",
      downloadFileName: "capture.png",
      format: "png",
      declaredMimeType: "image/png",
      byteSize: result.screenshotPng.length,
      sha256: screenshotSha256,
      objectKey: writeResult.objectKey,
      objectVersionId: writeResult.versionId ?? "unversioned",
      scanStatus: "not_required",
    },
    chunkerVersion: CHUNKER_VERSION,
    audit: {
      organizationId: payload.organizationId,
      actorId: payload.actorId,
      correlationId: payload.correlationId,
      projectId: payload.projectId,
      action: "source.capture.succeeded",
      after: {
        predecessorId: predecessor.id,
        versionNumber: successorVersionNumber,
        capturedAt: result.capturedAt,
        finalUrl: result.finalUrl,
        title: result.title,
      },
    },
  });

  const { successor, extraction } = outcome;
  logWorkerEvent(logContext, "source.capture.succeeded", {
    predecessorId: predecessor.id,
    sourceDocumentId: successor.id,
    sourceExtractionId: extraction.id,
    concurrentReplay: outcome.kind === "already_exists",
  });

  await enqueueDocumentProcessingJob(queue, {
    kind: "extract",
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    sourceDocumentId: successor.id,
    sourceExtractionId: extraction.id,
    idempotencyKey: createIdempotencyKey({
      queueName: "document-processing",
      resourceId: extraction.id,
      operation: "extract",
    }),
    correlationId: payload.correlationId,
    submittedAt: new Date().toISOString(),
  });
}
