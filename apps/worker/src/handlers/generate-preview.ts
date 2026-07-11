import {
  createImmutableObjectKey,
  createSha256ContentHash,
  immutableStoragePurposes,
} from "@atlashq/storage";
import sharp from "sharp";
import {
  finalizeExtractionPreview,
  listSourceDocumentFiles,
  requireSourceDocument,
  requireSourceExtraction,
} from "../db/source-vault-repository.js";
import { InvalidJobDataError, RetryableWorkerError } from "../errors.js";
import type { GeneratePreviewJobPayload } from "../job-types.js";
import { logWorkerEvent } from "../logger.js";
import type { WorkerRuntimeContext } from "../runtime/context.js";

/** Formats `sharp` can render a real thumbnail preview for (module-02 §6.10). */
const IMAGE_PREVIEW_FORMATS = new Set(["png", "jpg", "jpeg", "webp"]);
const PREVIEW_THUMBNAIL_MAX_DIMENSION = 800;

/**
 * Handles the `generate-preview` document-processing job (module-02 §6.10). This is the handler
 * that performs the *final* terminal transition of `source_extraction.status` to `succeeded`
 * (never `extract` -- see `handlers/extract.ts`), because a derived preview object key may still
 * need to be written and `source_extraction` freezes entirely once terminal.
 *
 * The preview thumbnail render + `storage.putObject` call happen first, outside any DB
 * transaction -- there is no way to compensate for an already-uploaded object if a later DB write
 * fails, so nothing here ever attempts to delete or roll back a stored object. The object key is
 * fully deterministic (organization/project/purpose/content-hash, module-02 §8.4), so a replay
 * that re-renders the identical source bytes reuses the identical key; the storage bucket has
 * versioning enabled, so re-`putObject`ing that key only adds a new version and never destroys a
 * previously confirmed object.
 *
 * The `source_extraction` update (preview fields + `status = "succeeded"` + `completedAt`), the
 * `source_document` `ready` transition, and the `source.extraction.succeeded` audit event are then
 * applied together in {@link finalizeExtractionPreview}'s single transaction, so a crash can never
 * again leave the extraction terminal while the document is stuck non-`ready` or the audit event
 * is missing. The replay branch below still explicitly repairs (rather than blindly trusting) any
 * such partial state a crash under the *old*, pre-transaction three-write sequence may have left
 * behind, and leaves a `failed` extraction fully untouched (terminal failures are immutable and
 * out of scope for preview finalization).
 */
export async function handleGeneratePreview(
  context: WorkerRuntimeContext,
  payload: GeneratePreviewJobPayload,
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

  if (extraction.status === "failed") {
    logWorkerEvent(logContext, "source.preview.replayed", {
      sourceDocumentId: payload.sourceDocumentId,
      sourceExtractionId: extraction.id,
      status: extraction.status,
    });
    return; // Terminal failure is immutable -- never repaired or touched by preview finalization.
  }
  if (extraction.status !== "running" && extraction.status !== "succeeded") {
    throw new InvalidJobDataError(
      `source_extraction ${extraction.id} is not in a running state (status=${extraction.status}); generate-preview arrived before extract.`,
    );
  }

  const actorId = sourceDocumentRow.createdBy;

  let previewObjectKey: string | null = extraction.previewObjectKey ?? null;
  let previewObjectVersionId: string | null = extraction.previewObjectVersionId ?? null;

  // On a `succeeded` replay, `source_extraction` is already frozen -- reuse whatever preview
  // fields the (single, still-frozen) prior commit persisted instead of re-rendering/re-uploading,
  // and skip the file/storage lookups entirely since nothing needs to be (re)computed.
  if (extraction.status === "running") {
    const files = await listSourceDocumentFiles(db, sourceDocumentRow.id);
    const primaryFile = files.find((candidate) => candidate.role === "primary") ?? files[0];

    if (primaryFile && IMAGE_PREVIEW_FORMATS.has(primaryFile.format)) {
      let originalBuffer: Buffer;
      try {
        const stream = await storage.getObjectStream({ objectKey: primaryFile.objectKey });
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
        }
        originalBuffer = Buffer.concat(chunks);
      } catch (error) {
        throw new RetryableWorkerError(
          "STORAGE_STREAM_FAILED",
          "Failed to stream the evidence file for preview generation.",
          { cause: error },
        );
      }

      let thumbnail: Buffer;
      try {
        thumbnail = await sharp(originalBuffer)
          .resize({
            width: PREVIEW_THUMBNAIL_MAX_DIMENSION,
            height: PREVIEW_THUMBNAIL_MAX_DIMENSION,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();
      } catch (error) {
        // A thumbnail failure is not fatal to the extraction: the original remains downloadable
        // and the extracted metadata is already recorded. Preview is simply left unavailable.
        thumbnail = Buffer.alloc(0);
        void error;
      }

      if (thumbnail.length > 0) {
        // Deterministic key: same organization/project/purpose/content-hash/extraction always
        // resolves to the same object key, so a replay re-render of identical source bytes reuses
        // it -- the bucket's versioning (module-02 §8.4) turns a repeat `putObject` into a new
        // version, never a destructive overwrite or a stray duplicate object.
        const objectKey = createImmutableObjectKey({
          organizationId: payload.organizationId,
          projectId: payload.projectId,
          purpose: immutableStoragePurposes.derivedPreview,
          contentHash: createSha256ContentHash(thumbnail),
          objectId: extraction.id,
          fileName: "preview.png",
        });

        try {
          const writeResult = await storage.putObject({
            objectKey,
            data: thumbnail,
            sizeBytes: thumbnail.length,
            contentType: "image/png",
          });
          previewObjectKey = writeResult.objectKey;
          previewObjectVersionId = writeResult.versionId;
        } catch (error) {
          throw new RetryableWorkerError(
            "STORAGE_PUT_FAILED",
            "Failed to store the derived preview object.",
            { cause: error },
          );
        }
      }
    }
    // PDF previews are rendered client-side directly from the original object via PDF.js
    // (module-02 §6.10 table) -- no server-rendered preview asset is required. Office/text
    // formats mark preview unavailable (previewObjectKey stays null) while the extracted text
    // view remains available.
  }

  const outcome = await finalizeExtractionPreview(db, {
    sourceDocumentId: sourceDocumentRow.id,
    sourceExtractionId: extraction.id,
    preview:
      extraction.status === "running" && previewObjectKey && previewObjectVersionId
        ? { previewObjectKey, previewObjectVersionId }
        : null,
    audit: {
      organizationId: payload.organizationId,
      actorId,
      projectId: payload.projectId,
      correlationId: payload.correlationId,
    },
  });

  logWorkerEvent(
    logContext,
    outcome.kind === "repaired" ? "source.preview.repaired" : "source.preview.succeeded",
    {
      sourceDocumentId: sourceDocumentRow.id,
      sourceExtractionId: extraction.id,
      previewGenerated: Boolean(previewObjectKey),
      outcome: outcome.kind,
    },
  );
}
