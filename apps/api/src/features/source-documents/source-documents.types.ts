import type { Database, ParserManifestEntry } from "@atlashq/db";
import type { JsonObject } from "@atlashq/types";
import type { PaginationMeta } from "@atlashq/validators";

/**
 * The narrow database surface the source-documents repository needs. Both a live `Database` and
 * a Drizzle transaction structurally satisfy this so the service can run every repository call
 * either directly or inside `db.transaction()`.
 */
export type SourceQueryHandle = Pick<Database, "select" | "insert" | "update" | "delete">;

// ---------------------------------------------------------------------------
// Upload session rows
// ---------------------------------------------------------------------------

export type UploadSessionRow = {
  id: string;
  organizationId: string;
  projectId: string;
  actorId: string;
  intakeMode: string;
  metadataDraft: JsonObject;
  supersedesId: string | null;
  expectedContentHash: string;
  duplicateMatchIds: string[];
  duplicateAcknowledgedAt: Date | null;
  duplicateAcknowledgedBy: string | null;
  status: string;
  expiresAt: Date;
  confirmedAt: Date | null;
  createdSourceId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UploadSessionInsertValues = {
  organizationId: string;
  projectId: string;
  actorId: string;
  intakeMode: string;
  metadataDraft: JsonObject;
  supersedesId: string | null;
  expectedContentHash: string;
  duplicateMatchIds: string[];
  status: string;
  expiresAt: Date;
  idempotencyKey: string;
};

export type UploadSessionUpdateValues = {
  status?: string;
  confirmedAt?: Date | null;
  createdSourceId?: string | null;
  duplicateMatchIds?: string[];
  duplicateAcknowledgedAt?: Date | null;
  duplicateAcknowledgedBy?: string | null;
  updatedAt: Date;
};

export type UploadSessionFileRow = {
  id: string;
  uploadSessionId: string;
  ordinal: number;
  role: string;
  originalFileName: string;
  normalizedFileName: string;
  declaredMimeType: string;
  extension: string;
  expectedByteSize: number;
  expectedSha256: string;
  objectKey: string;
  uploadStatus: string;
  objectStoreMetadata: JsonObject | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UploadSessionFileInsertValues = {
  uploadSessionId: string;
  ordinal: number;
  role: string;
  originalFileName: string;
  normalizedFileName: string;
  declaredMimeType: string;
  extension: string;
  expectedByteSize: number;
  expectedSha256: string;
  objectKey: string;
};

// ---------------------------------------------------------------------------
// Source document rows
// ---------------------------------------------------------------------------

export type SourceDocumentRow = {
  id: string;
  organizationId: string;
  projectId: string;
  lineageId: string;
  versionNumber: number;
  supersedesId: string | null;
  sourceType: string;
  documentFormat: string | null;
  title: string;
  notes: string | null;
  tags: string[];
  provenanceDate: Date | null;
  contentHash: string;
  duplicateAcknowledgedMatchIds: string[];
  duplicateAcknowledgedAt: Date | null;
  duplicateAcknowledgedBy: string | null;
  processingStatus: string;
  aiProcessingStatus: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string | null;
  archivedAt: Date | null;
  archivedBy: string | null;
  version: number;
};

export type SourceDocumentInsertValues = {
  id?: string;
  organizationId: string;
  projectId: string;
  lineageId: string;
  versionNumber: number;
  supersedesId: string | null;
  sourceType: string;
  documentFormat: string | null;
  title: string;
  notes: string | null;
  tags: string[];
  provenanceDate: Date | null;
  contentHash: string;
  duplicateAcknowledgedMatchIds: string[];
  duplicateAcknowledgedAt: Date | null;
  duplicateAcknowledgedBy: string | null;
  processingStatus: string;
  createdBy: string;
  updatedBy: string;
};

export type SourceDocumentFileRow = {
  id: string;
  sourceDocumentId: string;
  ordinal: number;
  role: string;
  originalFileName: string;
  downloadFileName: string;
  format: string;
  declaredMimeType: string;
  byteSize: number;
  sha256: string;
  objectKey: string;
  objectVersionId: string;
  scanStatus: string;
  scanResult: JsonObject | null;
  scanSignatureVersion: string | null;
  scannedAt: Date | null;
  createdAt: Date;
};

export type SourceDocumentFileInsertValues = {
  sourceDocumentId: string;
  ordinal: number;
  role: string;
  originalFileName: string;
  downloadFileName: string;
  format: string;
  declaredMimeType: string;
  byteSize: number;
  sha256: string;
  objectKey: string;
  objectVersionId: string;
  scanStatus: string;
};

export type ReferenceArtifactRow = {
  id: string;
  sourceDocumentId: string;
  organizationId: string;
  projectId: string;
  referenceKind: string;
  captureMethod: string;
  accessType: string;
  intendedUse: string;
  sourceUrl: string | null;
  ipReviewStatus: string;
  ipReviewReason: string | null;
  ipReviewedBy: string | null;
  ipReviewedAt: Date | null;
  attestationText: string;
  attestationVersion: string;
  attestedBy: string;
  attestedAt: Date;
  auditEventId: string | null;
  capturedAt: Date | null;
  createdAt: Date;
};

export type ReferenceArtifactInsertValues = {
  sourceDocumentId: string;
  organizationId: string;
  projectId: string;
  referenceKind: string;
  captureMethod: string;
  accessType: string;
  intendedUse: string;
  sourceUrl: string | null;
  attestationText: string;
  attestationVersion: string;
  attestedBy: string;
  attestedAt: Date;
  auditEventId: string | null;
  capturedAt: Date | null;
};

export type SourceExtractionRow = {
  id: string;
  sourceDocumentId: string;
  extractionVersion: number;
  status: string;
  parserManifest: ParserManifestEntry[];
  chunkerVersion: string;
  extractedTextHash: string | null;
  previewObjectKey: string | null;
  previewObjectVersionId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failureCode: string | null;
  failureDetail: string | null;
  createdAt: Date;
};

export type SourceExtractionInsertValues = {
  sourceDocumentId: string;
  extractionVersion: number;
  status: string;
  parserManifest: ParserManifestEntry[];
  chunkerVersion: string;
};

export type SourceChunkRow = {
  id: string;
  organizationId: string;
  projectId: string;
  sourceDocumentId: string;
  sourceExtractionId: string;
  sequence: number;
  content: string;
  characterCount: number;
  contentHash: string;
  locator: JsonObject;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Repository query shapes
// ---------------------------------------------------------------------------

export type SourceListQuery = {
  organizationId: string;
  projectId: string;
  limit: number;
  cursor?: SourceListCursor;
  sourceType?: string;
  documentFormat?: string;
  processingStatus?: string;
  ipReviewStatus?: string;
  includeArchived: boolean;
  hasUnacknowledgedDuplicate?: boolean;
  tag?: string;
  contributorId?: string;
  search?: string;
};

export type SourceListCursor = {
  createdAt: string;
  id: string;
};

export type SourceVersionListQuery = {
  organizationId: string;
  projectId: string;
  lineageId: string;
  limit: number;
  cursor?: SourceListCursor;
};

export type SourceExtractionListQuery = {
  organizationId: string;
  projectId: string;
  sourceDocumentId: string;
  limit: number;
  cursor?: SourceListCursor;
};

export type SourceChunkListQuery = {
  organizationId: string;
  projectId: string;
  sourceDocumentId: string;
  extractionId?: string;
  limit: number;
  cursor?: SourceListCursor;
};

/** Result shape for duplicate lookups; includes archived and superseded matches. */
export type SourceDuplicateMatchRow = {
  sourceId: string;
  title: string;
  versionNumber: number;
  isArchived: boolean;
  isSuperseded: boolean;
  contributorId: string;
  uploadedAt: Date;
};

/** Source count-by-processing-status summary for the project dashboard card. */
export type SourceCountSummary = {
  total: number;
  ready: number;
  quarantined: number;
  failed: number;
};

export type ListPage<Item> = {
  items: Item[];
  pageInfo: PaginationMeta;
};

export interface SourceDocumentsRepository {
  // Upload sessions
  findUploadSessionByIdempotencyKey(
    handle: SourceQueryHandle,
    key: string,
  ): Promise<UploadSessionRow | null>;
  findUploadSessionById(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    sessionId: string,
  ): Promise<UploadSessionRow | null>;
  insertUploadSession(
    handle: SourceQueryHandle,
    values: UploadSessionInsertValues,
  ): Promise<UploadSessionRow>;
  updateUploadSession(
    handle: SourceQueryHandle,
    sessionId: string,
    values: UploadSessionUpdateValues,
  ): Promise<UploadSessionRow | null>;
  listUploadSessionFiles(
    handle: SourceQueryHandle,
    sessionId: string,
  ): Promise<UploadSessionFileRow[]>;
  insertUploadSessionFile(
    handle: SourceQueryHandle,
    values: UploadSessionFileInsertValues,
  ): Promise<UploadSessionFileRow>;
  deleteUploadSession(handle: SourceQueryHandle, sessionId: string): Promise<void>;

  // Sources
  listSources(
    handle: SourceQueryHandle,
    query: SourceListQuery,
  ): Promise<ListPage<SourceDocumentRow>>;
  listSourceVersions(
    handle: SourceQueryHandle,
    query: SourceVersionListQuery,
  ): Promise<ListPage<SourceDocumentRow>>;
  findSourceById(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    sourceId: string,
  ): Promise<SourceDocumentRow | null>;
  findLineageHead(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    lineageId: string,
  ): Promise<SourceDocumentRow | null>;
  insertSource(
    handle: SourceQueryHandle,
    values: SourceDocumentInsertValues,
  ): Promise<SourceDocumentRow>;
  updateSourceMetadata(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    sourceId: string,
    expectedVersion: number,
    values: {
      title?: string;
      notes?: string | null;
      tags?: string[];
      updatedBy: string;
      updatedAt: Date;
    },
  ): Promise<SourceDocumentRow | null>;
  updateSourceArchive(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    sourceId: string,
    expectedVersion: number,
    values: {
      archivedAt: Date | null;
      archivedBy: string | null;
      updatedBy: string;
      updatedAt: Date;
    },
  ): Promise<SourceDocumentRow | null>;
  updateSourceProcessingStatus(
    handle: SourceQueryHandle,
    sourceId: string,
    values: {
      processingStatus: string;
      updatedAt: Date;
      updatedBy: string;
      expectedVersion?: number;
    },
  ): Promise<SourceDocumentRow | null>;
  findDuplicateMatches(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    contentHash: string,
  ): Promise<SourceDuplicateMatchRow[]>;
  countSourcesByProject(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<SourceCountSummary>;

  // Source files
  listSourceFiles(handle: SourceQueryHandle, sourceId: string): Promise<SourceDocumentFileRow[]>;
  findSourceFileById(
    handle: SourceQueryHandle,
    sourceId: string,
    fileId: string,
  ): Promise<SourceDocumentFileRow | null>;
  insertSourceFile(
    handle: SourceQueryHandle,
    values: SourceDocumentFileInsertValues,
  ): Promise<SourceDocumentFileRow>;

  // Reference artifacts
  findReferenceBySourceId(
    handle: SourceQueryHandle,
    sourceId: string,
  ): Promise<ReferenceArtifactRow | null>;
  insertReferenceArtifact(
    handle: SourceQueryHandle,
    values: ReferenceArtifactInsertValues,
  ): Promise<ReferenceArtifactRow>;
  updateReferenceIpReview(
    handle: SourceQueryHandle,
    referenceId: string,
    values: {
      ipReviewStatus: string;
      ipReviewReason: string | null;
      ipReviewedBy: string;
      ipReviewedAt: Date;
    },
  ): Promise<ReferenceArtifactRow | null>;

  // Extractions and chunks
  listExtractions(
    handle: SourceQueryHandle,
    query: SourceExtractionListQuery,
  ): Promise<ListPage<SourceExtractionRow>>;
  insertExtraction(
    handle: SourceQueryHandle,
    values: SourceExtractionInsertValues,
  ): Promise<SourceExtractionRow>;
  listChunks(
    handle: SourceQueryHandle,
    query: SourceChunkListQuery,
  ): Promise<ListPage<SourceChunkRow>>;

  // Organization settings feature flags
  findOrganizationSettings(
    handle: SourceQueryHandle,
    organizationId: string,
  ): Promise<JsonObject | null>;
}
