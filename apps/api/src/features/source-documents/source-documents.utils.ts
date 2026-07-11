import { createSha256ContentHash } from "@atlashq/storage";
import type { JsonObject } from "@atlashq/types";
import type {
  CanonicalSourceManifestFileEntry,
  CanonicalSourceManifestInput,
} from "@atlashq/validators";
import { isoDateTimeSchema, uuidSchema } from "@atlashq/validators";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type {
  SourceDocumentDetailResponse,
  SourceDocumentSummaryResponse,
} from "./source-documents.schemas.js";
import type {
  ReferenceArtifactRow,
  SourceChunkRow,
  SourceDocumentFileRow,
  SourceDocumentRow,
  SourceDuplicateMatchRow,
  SourceExtractionRow,
  SourceListCursor,
  UploadSessionFileRow,
  UploadSessionRow,
} from "./source-documents.types.js";

const sourceCursorSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    id: uuidSchema,
  })
  .strict();

/**
 * Base64url encoded opaque cursor. Mirrors the projects/clients cursor helpers so downstream
 * consumers see one contract shape.
 */
export function encodeSourceCursor(cursor: SourceListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSourceCursor(
  cursor: string,
  message = "Invalid source cursor.",
): SourceListCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return sourceCursorSchema.parse(parsed);
  } catch {
    throw new BadRequestException(message);
  }
}

export function sourceRowToCursor(row: { createdAt: Date; id: string }): string {
  return encodeSourceCursor({ createdAt: row.createdAt.toISOString(), id: row.id });
}

export function extractionRowToCursor(row: { createdAt: Date; id: string }): string {
  return encodeSourceCursor({ createdAt: row.createdAt.toISOString(), id: row.id });
}

export function chunkRowToCursor(row: { createdAt: Date; id: string }): string {
  return encodeSourceCursor({ createdAt: row.createdAt.toISOString(), id: row.id });
}

// ---------------------------------------------------------------------------
// Canonical manifest hashing (module-02 §6.3)
// ---------------------------------------------------------------------------

/**
 * Produce a canonical UTF-8 JSON string of the source manifest input with sorted keys and
 * ordinal-ordered file entries so hashing is deterministic regardless of client input order.
 * Never accepts locally derived fields: the caller MUST pass ordered SHA-256 child hashes.
 *
 * Deliberately excludes mutable metadata (title/tags/notes/provenanceDate): only immutable
 * evidence (source type, document format, reference evidence fields) and ordered file hashes
 * participate in the hash (module-02 §6.3, §6.4).
 */
export function stringifyCanonicalManifest(input: CanonicalSourceManifestInput): string {
  const sortedFiles = [...input.files].sort((a, b) => a.ordinal - b.ordinal);
  const shape: Record<string, unknown> = {
    files: sortedFiles.map((entry) => ({
      ordinal: entry.ordinal,
      role: entry.role,
      sha256: entry.sha256,
    })),
    sourceType: input.sourceType,
  };

  if (input.documentFormat) {
    shape.documentFormat = input.documentFormat;
  }

  if (input.reference) {
    shape.reference = {
      referenceKind: input.reference.referenceKind,
      captureMethod: input.reference.captureMethod,
      accessType: input.reference.accessType,
      intendedUse: input.reference.intendedUse,
      ...(input.reference.sourceUrl ? { sourceUrl: input.reference.sourceUrl } : {}),
    };
  }

  return JSON.stringify(sortByKey(shape));
}

/** Deterministic canonical hash for multi-file / manual / reference sources. */
export function hashCanonicalManifest(input: CanonicalSourceManifestInput): string {
  return createSha256ContentHash(stringifyCanonicalManifest(input));
}

/** Manual text canonical UTF-8 hash. */
export function hashManualBody(body: string): string {
  return createSha256ContentHash(body.normalize("NFC"));
}

function sortByKey<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sortByKey) as unknown as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortByKey(nested)]);
    return Object.fromEntries(entries) as unknown as T;
  }

  return value;
}

// ---------------------------------------------------------------------------
// Row → response transformations
// ---------------------------------------------------------------------------

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toSourceSummaryResponse(
  row: SourceDocumentRow,
  reference?: ReferenceArtifactRow | null,
): SourceDocumentSummaryResponse {
  return {
    id: row.id,
    lineageId: row.lineageId,
    versionNumber: row.versionNumber,
    supersedesId: row.supersedesId,
    sourceType: row.sourceType as SourceDocumentSummaryResponse["sourceType"],
    documentFormat: row.documentFormat as SourceDocumentSummaryResponse["documentFormat"] | null,
    title: row.title,
    tags: row.tags,
    processingStatus: row.processingStatus as SourceDocumentSummaryResponse["processingStatus"],
    isArchived: row.archivedAt !== null,
    hasDuplicateAcknowledgement: row.duplicateAcknowledgedAt !== null,
    ipReviewStatus: reference
      ? (reference.ipReviewStatus as SourceDocumentSummaryResponse["ipReviewStatus"])
      : null,
    contentHash: row.contentHash,
    createdByActorId: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSourceFileResponse(row: SourceDocumentFileRow) {
  return {
    id: row.id,
    ordinal: row.ordinal,
    role: row.role as "primary" | "attachment" | "snapshot",
    originalFileName: row.originalFileName,
    downloadFileName: row.downloadFileName,
    format: row.format as
      | "pdf"
      | "docx"
      | "txt"
      | "md"
      | "xlsx"
      | "csv"
      | "pptx"
      | "png"
      | "jpg"
      | "jpeg"
      | "webp",
    declaredMimeType: row.declaredMimeType,
    byteSize: row.byteSize,
    sha256: row.sha256,
    scanStatus: row.scanStatus as "not_required" | "pending" | "clean" | "infected" | "failed",
    scannedAt: toIso(row.scannedAt),
  };
}

export function toReferenceResponse(row: ReferenceArtifactRow) {
  return {
    id: row.id,
    sourceDocumentId: row.sourceDocumentId,
    referenceKind: row.referenceKind as
      | "url"
      | "screenshot_set"
      | "uploaded_export"
      | "article"
      | "app_store_listing",
    captureMethod: row.captureMethod as
      | "manual_paste"
      | "user_uploaded_screenshot"
      | "on_demand_single_page_capture",
    accessType: row.accessType as "public" | "client_owned" | "permissioned",
    intendedUse: row.intendedUse as "inspiration" | "feature_parity" | "differentiation_baseline",
    sourceUrl: row.sourceUrl,
    ipReviewStatus: row.ipReviewStatus as "not_reviewed" | "cleared" | "restricted",
    ipReviewReason: row.ipReviewReason,
    ipReviewedByActorId: row.ipReviewedBy,
    ipReviewedAt: toIso(row.ipReviewedAt),
    attestationText: row.attestationText,
    attestationVersion: row.attestationVersion,
    attestedByActorId: row.attestedBy,
    attestedAt: row.attestedAt.toISOString(),
    capturedAt: toIso(row.capturedAt),
  };
}

export function toSourceDetailResponse(
  row: SourceDocumentRow,
  files: SourceDocumentFileRow[],
  reference: ReferenceArtifactRow | null,
): SourceDocumentDetailResponse {
  const summary = toSourceSummaryResponse(row, reference);
  const detail: SourceDocumentDetailResponse = {
    ...summary,
    version: row.version,
    notes: row.notes,
    provenanceDate: toIso(row.provenanceDate),
    archivedByActorId: row.archivedBy,
    archivedAt: toIso(row.archivedAt),
    files: files.map(toSourceFileResponse),
    ...(reference ? { reference: toReferenceResponse(reference) } : {}),
  };
  return detail;
}

export function toExtractionResponse(row: SourceExtractionRow) {
  return {
    id: row.id,
    sourceDocumentId: row.sourceDocumentId,
    extractionVersion: row.extractionVersion,
    status: row.status as "pending" | "running" | "succeeded" | "failed",
    parserManifest: row.parserManifest,
    chunkerVersion: row.chunkerVersion,
    extractedTextHash: row.extractedTextHash,
    previewObjectKey: row.previewObjectKey,
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    failureCode: row.failureCode,
    failureDetail: row.failureDetail,
  };
}

export function toChunkResponse(row: SourceChunkRow) {
  return {
    id: row.id,
    sourceExtractionId: row.sourceExtractionId,
    sequence: row.sequence,
    content: row.content,
    characterCount: row.characterCount,
    contentHash: row.contentHash,
    locator: row.locator as unknown as Record<string, string | number>,
  };
}

export function toUploadSessionResponse(
  session: UploadSessionRow,
  files: UploadSessionFileRow[],
  duplicateMatches: SourceDuplicateMatchRow[],
  fileSignedUrls: Map<string, { url: string; expiresAt: string }>,
) {
  return {
    id: session.id,
    organizationId: session.organizationId,
    projectId: session.projectId,
    actorId: session.actorId,
    sourceType:
      session.intakeMode === "reference_artifact" ? ("reference" as const) : ("document" as const),
    status: session.status as
      | "created"
      | "uploading"
      | "uploaded"
      | "confirmed"
      | "canceled"
      | "expired",
    title: (session.metadataDraft.title as string) ?? "Upload session",
    expiresAt: session.expiresAt.toISOString(),
    confirmedAt: toIso(session.confirmedAt),
    createdSourceId: session.createdSourceId,
    duplicateMatches: duplicateMatches.map((match) => ({
      sourceId: match.sourceId,
      title: match.title,
      versionNumber: match.versionNumber,
      isArchived: match.isArchived,
      isSuperseded: match.isSuperseded,
      contributorId: match.contributorId,
      uploadedAt: match.uploadedAt.toISOString(),
    })),
    files: files.map((file) => {
      const signed = fileSignedUrls.get(file.id);
      return {
        id: file.id,
        ordinal: file.ordinal,
        role: file.role as "primary" | "attachment" | "snapshot",
        originalFileName: file.originalFileName,
        format: file.extension as
          | "pdf"
          | "docx"
          | "txt"
          | "md"
          | "xlsx"
          | "csv"
          | "pptx"
          | "png"
          | "jpg"
          | "jpeg"
          | "webp",
        declaredMimeType: file.declaredMimeType,
        byteSize: file.expectedByteSize,
        sha256: file.expectedSha256,
        signedUploadUrl: signed?.url ?? "https://storage.invalid/expired-upload-session",
        signedUploadUrlExpiresAt: signed?.expiresAt ?? session.expiresAt.toISOString(),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Feature flag helpers (organization.settings)
// ---------------------------------------------------------------------------

/** Read a boolean feature flag from `organization.settings` JSON; default false when absent. */
export function readFeatureFlag(settings: JsonObject | null, flag: string): boolean {
  if (!settings) {
    return false;
  }
  const value = settings[flag];
  return value === true;
}

/**
 * Canonicalize a manual-source manifest input for the multi-file/manual hash path (module-02
 * §6.3). Manual and reference sources build a canonical JSON object over ordered file hashes.
 */
export function buildManifestEntries(
  files: readonly { ordinal: number; role: string; sha256: string }[],
): CanonicalSourceManifestFileEntry[] {
  return files
    .map((file) => ({
      ordinal: file.ordinal,
      role: file.role as CanonicalSourceManifestFileEntry["role"],
      sha256: file.sha256,
    }))
    .sort((a, b) => a.ordinal - b.ordinal);
}

/** Generic limit+1 pagination. */
export function paginate<Item>(rows: Item[], limit: number, toCursor: (item: Item) => string) {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = items[items.length - 1];
  return {
    items,
    pageInfo: {
      limit,
      hasMore,
      nextCursor: hasMore && last ? toCursor(last) : null,
    },
  };
}
