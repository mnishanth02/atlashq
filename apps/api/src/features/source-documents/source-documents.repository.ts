import {
  organization,
  referenceArtifact,
  sourceChunk,
  sourceDocument,
  sourceDocumentFile,
  sourceExtraction,
  sourceUploadFile,
  sourceUploadSession,
} from "@atlashq/db";
import type { JsonObject } from "@atlashq/types";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type {
  ListPage,
  ReferenceArtifactInsertValues,
  ReferenceArtifactRow,
  SourceChunkListQuery,
  SourceChunkRow,
  SourceCountSummary,
  SourceDocumentFileInsertValues,
  SourceDocumentFileRow,
  SourceDocumentInsertValues,
  SourceDocumentRow,
  SourceDocumentsRepository,
  SourceDuplicateMatchRow,
  SourceExtractionInsertValues,
  SourceExtractionListQuery,
  SourceExtractionRow,
  SourceListQuery,
  SourceQueryHandle,
  SourceVersionListQuery,
  UploadSessionFileInsertValues,
  UploadSessionFileRow,
  UploadSessionInsertValues,
  UploadSessionRow,
  UploadSessionUpdateValues,
} from "./source-documents.types.js";
import { paginate, sourceRowToCursor } from "./source-documents.utils.js";

const uploadSessionProjection = {
  id: sourceUploadSession.id,
  organizationId: sourceUploadSession.organizationId,
  projectId: sourceUploadSession.projectId,
  actorId: sourceUploadSession.actorId,
  intakeMode: sourceUploadSession.intakeMode,
  metadataDraft: sourceUploadSession.metadataDraft,
  supersedesId: sourceUploadSession.supersedesId,
  expectedContentHash: sourceUploadSession.expectedContentHash,
  duplicateMatchIds: sourceUploadSession.duplicateMatchIds,
  duplicateAcknowledgedAt: sourceUploadSession.duplicateAcknowledgedAt,
  duplicateAcknowledgedBy: sourceUploadSession.duplicateAcknowledgedBy,
  status: sourceUploadSession.status,
  expiresAt: sourceUploadSession.expiresAt,
  confirmedAt: sourceUploadSession.confirmedAt,
  createdSourceId: sourceUploadSession.createdSourceId,
  idempotencyKey: sourceUploadSession.idempotencyKey,
  createdAt: sourceUploadSession.createdAt,
  updatedAt: sourceUploadSession.updatedAt,
} as const;

const uploadSessionFileProjection = {
  id: sourceUploadFile.id,
  uploadSessionId: sourceUploadFile.uploadSessionId,
  ordinal: sourceUploadFile.ordinal,
  role: sourceUploadFile.role,
  originalFileName: sourceUploadFile.originalFileName,
  normalizedFileName: sourceUploadFile.normalizedFileName,
  declaredMimeType: sourceUploadFile.declaredMimeType,
  extension: sourceUploadFile.extension,
  expectedByteSize: sourceUploadFile.expectedByteSize,
  expectedSha256: sourceUploadFile.expectedSha256,
  objectKey: sourceUploadFile.objectKey,
  uploadStatus: sourceUploadFile.uploadStatus,
  objectStoreMetadata: sourceUploadFile.objectStoreMetadata,
  createdAt: sourceUploadFile.createdAt,
  updatedAt: sourceUploadFile.updatedAt,
} as const;

const sourceDocumentProjection = {
  id: sourceDocument.id,
  organizationId: sourceDocument.organizationId,
  projectId: sourceDocument.projectId,
  lineageId: sourceDocument.lineageId,
  versionNumber: sourceDocument.versionNumber,
  supersedesId: sourceDocument.supersedesId,
  sourceType: sourceDocument.sourceType,
  documentFormat: sourceDocument.documentFormat,
  title: sourceDocument.title,
  notes: sourceDocument.notes,
  tags: sourceDocument.tags,
  provenanceDate: sourceDocument.provenanceDate,
  contentHash: sourceDocument.contentHash,
  duplicateAcknowledgedMatchIds: sourceDocument.duplicateAcknowledgedMatchIds,
  duplicateAcknowledgedAt: sourceDocument.duplicateAcknowledgedAt,
  duplicateAcknowledgedBy: sourceDocument.duplicateAcknowledgedBy,
  processingStatus: sourceDocument.processingStatus,
  aiProcessingStatus: sourceDocument.aiProcessingStatus,
  createdAt: sourceDocument.createdAt,
  createdBy: sourceDocument.createdBy,
  updatedAt: sourceDocument.updatedAt,
  updatedBy: sourceDocument.updatedBy,
  archivedAt: sourceDocument.archivedAt,
  archivedBy: sourceDocument.archivedBy,
  version: sourceDocument.version,
} as const;

const sourceDocumentFileProjection = {
  id: sourceDocumentFile.id,
  sourceDocumentId: sourceDocumentFile.sourceDocumentId,
  ordinal: sourceDocumentFile.ordinal,
  role: sourceDocumentFile.role,
  originalFileName: sourceDocumentFile.originalFileName,
  downloadFileName: sourceDocumentFile.downloadFileName,
  format: sourceDocumentFile.format,
  declaredMimeType: sourceDocumentFile.declaredMimeType,
  byteSize: sourceDocumentFile.byteSize,
  sha256: sourceDocumentFile.sha256,
  objectKey: sourceDocumentFile.objectKey,
  objectVersionId: sourceDocumentFile.objectVersionId,
  scanStatus: sourceDocumentFile.scanStatus,
  scanResult: sourceDocumentFile.scanResult,
  scanSignatureVersion: sourceDocumentFile.scanSignatureVersion,
  scannedAt: sourceDocumentFile.scannedAt,
  createdAt: sourceDocumentFile.createdAt,
} as const;

const referenceArtifactProjection = {
  id: referenceArtifact.id,
  sourceDocumentId: referenceArtifact.sourceDocumentId,
  organizationId: referenceArtifact.organizationId,
  projectId: referenceArtifact.projectId,
  referenceKind: referenceArtifact.referenceKind,
  captureMethod: referenceArtifact.captureMethod,
  accessType: referenceArtifact.accessType,
  intendedUse: referenceArtifact.intendedUse,
  sourceUrl: referenceArtifact.sourceUrl,
  ipReviewStatus: referenceArtifact.ipReviewStatus,
  ipReviewReason: referenceArtifact.ipReviewReason,
  ipReviewedBy: referenceArtifact.ipReviewedBy,
  ipReviewedAt: referenceArtifact.ipReviewedAt,
  attestationText: referenceArtifact.attestationText,
  attestationVersion: referenceArtifact.attestationVersion,
  attestedBy: referenceArtifact.attestedBy,
  attestedAt: referenceArtifact.attestedAt,
  auditEventId: referenceArtifact.auditEventId,
  capturedAt: referenceArtifact.capturedAt,
  createdAt: referenceArtifact.createdAt,
} as const;

const extractionProjection = {
  id: sourceExtraction.id,
  sourceDocumentId: sourceExtraction.sourceDocumentId,
  extractionVersion: sourceExtraction.extractionVersion,
  status: sourceExtraction.status,
  parserManifest: sourceExtraction.parserManifest,
  chunkerVersion: sourceExtraction.chunkerVersion,
  extractedTextHash: sourceExtraction.extractedTextHash,
  previewObjectKey: sourceExtraction.previewObjectKey,
  previewObjectVersionId: sourceExtraction.previewObjectVersionId,
  startedAt: sourceExtraction.startedAt,
  completedAt: sourceExtraction.completedAt,
  failureCode: sourceExtraction.failureCode,
  failureDetail: sourceExtraction.failureDetail,
  createdAt: sourceExtraction.createdAt,
} as const;

const chunkProjection = {
  id: sourceChunk.id,
  organizationId: sourceChunk.organizationId,
  projectId: sourceChunk.projectId,
  sourceDocumentId: sourceChunk.sourceDocumentId,
  sourceExtractionId: sourceChunk.sourceExtractionId,
  sequence: sourceChunk.sequence,
  content: sourceChunk.content,
  characterCount: sourceChunk.characterCount,
  contentHash: sourceChunk.contentHash,
  locator: sourceChunk.locator,
  createdAt: sourceChunk.createdAt,
} as const;

export class DrizzleSourceDocumentsRepository implements SourceDocumentsRepository {
  async findUploadSessionByIdempotencyKey(
    handle: SourceQueryHandle,
    key: string,
  ): Promise<UploadSessionRow | null> {
    const rows = await handle
      .select(uploadSessionProjection)
      .from(sourceUploadSession)
      .where(eq(sourceUploadSession.idempotencyKey, key))
      .limit(1);
    return (rows[0] as UploadSessionRow | undefined) ?? null;
  }

  async findUploadSessionById(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    sessionId: string,
  ): Promise<UploadSessionRow | null> {
    const rows = await handle
      .select(uploadSessionProjection)
      .from(sourceUploadSession)
      .where(
        and(
          eq(sourceUploadSession.organizationId, organizationId),
          eq(sourceUploadSession.projectId, projectId),
          eq(sourceUploadSession.id, sessionId),
        ),
      )
      .limit(1);
    return (rows[0] as UploadSessionRow | undefined) ?? null;
  }

  async insertUploadSession(
    handle: SourceQueryHandle,
    values: UploadSessionInsertValues,
  ): Promise<UploadSessionRow> {
    const rows = await handle
      .insert(sourceUploadSession)
      .values({
        organizationId: values.organizationId,
        projectId: values.projectId,
        actorId: values.actorId,
        intakeMode: values.intakeMode,
        metadataDraft: values.metadataDraft,
        supersedesId: values.supersedesId,
        expectedContentHash: values.expectedContentHash,
        duplicateMatchIds: values.duplicateMatchIds,
        status: values.status,
        expiresAt: values.expiresAt,
        idempotencyKey: values.idempotencyKey,
      })
      .returning(uploadSessionProjection);
    const row = rows[0] as UploadSessionRow | undefined;
    if (!row) {
      throw new Error("Upload session insert did not return the inserted row.");
    }
    return row;
  }

  async updateUploadSession(
    handle: SourceQueryHandle,
    sessionId: string,
    values: UploadSessionUpdateValues,
  ): Promise<UploadSessionRow | null> {
    const setValues: Record<string, unknown> = { updatedAt: values.updatedAt };
    if (values.status !== undefined) setValues.status = values.status;
    if (values.confirmedAt !== undefined) setValues.confirmedAt = values.confirmedAt;
    if (values.createdSourceId !== undefined) setValues.createdSourceId = values.createdSourceId;
    if (values.duplicateMatchIds !== undefined)
      setValues.duplicateMatchIds = values.duplicateMatchIds;
    if (values.duplicateAcknowledgedAt !== undefined)
      setValues.duplicateAcknowledgedAt = values.duplicateAcknowledgedAt;
    if (values.duplicateAcknowledgedBy !== undefined)
      setValues.duplicateAcknowledgedBy = values.duplicateAcknowledgedBy;

    const rows = await handle
      .update(sourceUploadSession)
      .set(setValues)
      .where(eq(sourceUploadSession.id, sessionId))
      .returning(uploadSessionProjection);
    return (rows[0] as UploadSessionRow | undefined) ?? null;
  }

  async listUploadSessionFiles(
    handle: SourceQueryHandle,
    sessionId: string,
  ): Promise<UploadSessionFileRow[]> {
    return (await handle
      .select(uploadSessionFileProjection)
      .from(sourceUploadFile)
      .where(eq(sourceUploadFile.uploadSessionId, sessionId))
      .orderBy(asc(sourceUploadFile.ordinal))) as UploadSessionFileRow[];
  }

  async insertUploadSessionFile(
    handle: SourceQueryHandle,
    values: UploadSessionFileInsertValues,
  ): Promise<UploadSessionFileRow> {
    const rows = await handle
      .insert(sourceUploadFile)
      .values(values)
      .returning(uploadSessionFileProjection);
    const row = rows[0] as UploadSessionFileRow | undefined;
    if (!row) {
      throw new Error("Upload-session file insert did not return the inserted row.");
    }
    return row;
  }

  async deleteUploadSession(handle: SourceQueryHandle, sessionId: string): Promise<void> {
    await handle.delete(sourceUploadSession).where(eq(sourceUploadSession.id, sessionId));
  }

  async listSources(
    handle: SourceQueryHandle,
    query: SourceListQuery,
  ): Promise<ListPage<SourceDocumentRow>> {
    const cursorFilter = query.cursor
      ? or(
          lt(sourceDocument.createdAt, new Date(query.cursor.createdAt)),
          and(
            eq(sourceDocument.createdAt, new Date(query.cursor.createdAt)),
            lt(sourceDocument.id, query.cursor.id),
          ),
        )
      : undefined;

    const searchFilter = query.search
      ? or(
          ilike(sourceDocument.title, `%${query.search}%`),
          ilike(sourceDocument.id, `%${query.search}%`),
        )
      : undefined;

    const tagFilter = query.tag
      ? sql`${sourceDocument.tags} @> ARRAY[${query.tag}]::text[]`
      : undefined;

    const duplicateFilter =
      query.hasUnacknowledgedDuplicate !== undefined
        ? query.hasUnacknowledgedDuplicate
          ? and(
              isNotNull(sourceDocument.duplicateAcknowledgedMatchIds),
              sql`array_length(${sourceDocument.duplicateAcknowledgedMatchIds}, 1) is null`,
            )
          : isNotNull(sourceDocument.duplicateAcknowledgedAt)
        : undefined;

    const ipReviewFilter = query.ipReviewStatus
      ? exists(
          handle
            .select({ present: sql`1` })
            .from(referenceArtifact)
            .where(
              and(
                eq(referenceArtifact.sourceDocumentId, sourceDocument.id),
                eq(referenceArtifact.ipReviewStatus, query.ipReviewStatus),
              ),
            ),
        )
      : undefined;

    const conditions: (SQL<unknown> | undefined)[] = [
      eq(sourceDocument.organizationId, query.organizationId),
      eq(sourceDocument.projectId, query.projectId),
      query.includeArchived ? undefined : isNull(sourceDocument.archivedAt),
      query.sourceType ? eq(sourceDocument.sourceType, query.sourceType) : undefined,
      query.documentFormat ? eq(sourceDocument.documentFormat, query.documentFormat) : undefined,
      query.processingStatus
        ? eq(sourceDocument.processingStatus, query.processingStatus)
        : undefined,
      query.contributorId ? eq(sourceDocument.createdBy, query.contributorId) : undefined,
      searchFilter,
      tagFilter,
      duplicateFilter,
      ipReviewFilter,
      cursorFilter,
    ];

    const rows = await handle
      .select(sourceDocumentProjection)
      .from(sourceDocument)
      .where(and(...conditions))
      .orderBy(desc(sourceDocument.createdAt), desc(sourceDocument.id))
      .limit(query.limit + 1);

    return paginate(rows as SourceDocumentRow[], query.limit, (row) => sourceRowToCursor(row));
  }

  async listSourceVersions(
    handle: SourceQueryHandle,
    query: SourceVersionListQuery,
  ): Promise<ListPage<SourceDocumentRow>> {
    const cursorFilter = query.cursor ? lt(sourceDocument.id, query.cursor.id) : undefined;

    const rows = await handle
      .select(sourceDocumentProjection)
      .from(sourceDocument)
      .where(
        and(
          eq(sourceDocument.organizationId, query.organizationId),
          eq(sourceDocument.projectId, query.projectId),
          eq(sourceDocument.lineageId, query.lineageId),
          cursorFilter,
        ),
      )
      .orderBy(desc(sourceDocument.versionNumber))
      .limit(query.limit + 1);

    return paginate(rows as SourceDocumentRow[], query.limit, (row) => sourceRowToCursor(row));
  }

  async findSourceById(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    sourceId: string,
  ): Promise<SourceDocumentRow | null> {
    const rows = await handle
      .select(sourceDocumentProjection)
      .from(sourceDocument)
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
          eq(sourceDocument.id, sourceId),
        ),
      )
      .limit(1);
    return (rows[0] as SourceDocumentRow | undefined) ?? null;
  }

  async findLineageHead(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    lineageId: string,
  ): Promise<SourceDocumentRow | null> {
    const rows = await handle
      .select(sourceDocumentProjection)
      .from(sourceDocument)
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
          eq(sourceDocument.lineageId, lineageId),
        ),
      )
      .orderBy(desc(sourceDocument.versionNumber))
      .limit(1);
    return (rows[0] as SourceDocumentRow | undefined) ?? null;
  }

  async insertSource(
    handle: SourceQueryHandle,
    values: SourceDocumentInsertValues,
  ): Promise<SourceDocumentRow> {
    const rows = await handle
      .insert(sourceDocument)
      .values({
        ...(values.id ? { id: values.id } : {}),
        organizationId: values.organizationId,
        projectId: values.projectId,
        lineageId: values.lineageId,
        versionNumber: values.versionNumber,
        supersedesId: values.supersedesId,
        sourceType: values.sourceType,
        documentFormat: values.documentFormat,
        title: values.title,
        notes: values.notes,
        tags: values.tags,
        provenanceDate: values.provenanceDate,
        contentHash: values.contentHash,
        duplicateAcknowledgedMatchIds: values.duplicateAcknowledgedMatchIds,
        duplicateAcknowledgedAt: values.duplicateAcknowledgedAt,
        duplicateAcknowledgedBy: values.duplicateAcknowledgedBy,
        processingStatus: values.processingStatus,
        createdBy: values.createdBy,
        updatedBy: values.updatedBy,
      })
      .returning(sourceDocumentProjection);
    const row = rows[0] as SourceDocumentRow | undefined;
    if (!row) {
      throw new Error("Source insert did not return the inserted row.");
    }
    return row;
  }

  async updateSourceMetadata(
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
  ): Promise<SourceDocumentRow | null> {
    const setValues: Record<string, unknown> = {
      updatedAt: values.updatedAt,
      updatedBy: values.updatedBy,
      version: sql`${sourceDocument.version} + 1`,
    };
    if (values.title !== undefined) setValues.title = values.title;
    if (values.notes !== undefined) setValues.notes = values.notes;
    if (values.tags !== undefined) setValues.tags = values.tags;

    const rows = await handle
      .update(sourceDocument)
      .set(setValues)
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
          eq(sourceDocument.id, sourceId),
          eq(sourceDocument.version, expectedVersion),
        ),
      )
      .returning(sourceDocumentProjection);
    return (rows[0] as SourceDocumentRow | undefined) ?? null;
  }

  async updateSourceArchive(
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
  ): Promise<SourceDocumentRow | null> {
    const rows = await handle
      .update(sourceDocument)
      .set({
        archivedAt: values.archivedAt,
        archivedBy: values.archivedBy,
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
        version: sql`${sourceDocument.version} + 1`,
      })
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
          eq(sourceDocument.id, sourceId),
          eq(sourceDocument.version, expectedVersion),
        ),
      )
      .returning(sourceDocumentProjection);
    return (rows[0] as SourceDocumentRow | undefined) ?? null;
  }

  async updateSourceProcessingStatus(
    handle: SourceQueryHandle,
    sourceId: string,
    values: {
      processingStatus: string;
      updatedAt: Date;
      updatedBy: string;
      expectedVersion?: number;
    },
  ): Promise<SourceDocumentRow | null> {
    const whereClauses = [eq(sourceDocument.id, sourceId)];
    if (values.expectedVersion !== undefined) {
      whereClauses.push(eq(sourceDocument.version, values.expectedVersion));
    }
    const rows = await handle
      .update(sourceDocument)
      .set({
        processingStatus: values.processingStatus,
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
        version: sql`${sourceDocument.version} + 1`,
      })
      .where(and(...whereClauses))
      .returning(sourceDocumentProjection);
    return (rows[0] as SourceDocumentRow | undefined) ?? null;
  }

  async findDuplicateMatches(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    contentHash: string,
  ): Promise<SourceDuplicateMatchRow[]> {
    // Emit a `is_superseded` boolean so callers can flag whether each match has a later version.
    const successor = sql<boolean>`exists (
      select 1 from ${sourceDocument} as later
      where later.supersedes_id = ${sourceDocument.id}
    )`;

    const rows = await handle
      .select({
        sourceId: sourceDocument.id,
        title: sourceDocument.title,
        versionNumber: sourceDocument.versionNumber,
        isArchived: sql<boolean>`(${sourceDocument.archivedAt} is not null)`,
        isSuperseded: successor,
        contributorId: sourceDocument.createdBy,
        uploadedAt: sourceDocument.createdAt,
      })
      .from(sourceDocument)
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
          eq(sourceDocument.contentHash, contentHash),
        ),
      )
      .orderBy(desc(sourceDocument.createdAt));
    return rows as SourceDuplicateMatchRow[];
  }

  async countSourcesByProject(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<SourceCountSummary> {
    const rows = await handle
      .select({
        total: sql<number>`count(*)::int`,
        ready: sql<number>`sum(case when ${sourceDocument.processingStatus} = 'ready' then 1 else 0 end)::int`,
        quarantined: sql<number>`sum(case when ${sourceDocument.processingStatus} = 'quarantined' then 1 else 0 end)::int`,
        failed: sql<number>`sum(case when ${sourceDocument.processingStatus} = 'failed' then 1 else 0 end)::int`,
      })
      .from(sourceDocument)
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
          isNull(sourceDocument.archivedAt),
        ),
      );
    const row = rows[0];
    if (!row) {
      return { total: 0, ready: 0, quarantined: 0, failed: 0 };
    }
    return {
      total: Number(row.total ?? 0),
      ready: Number(row.ready ?? 0),
      quarantined: Number(row.quarantined ?? 0),
      failed: Number(row.failed ?? 0),
    };
  }

  async listSourceFiles(
    handle: SourceQueryHandle,
    sourceId: string,
  ): Promise<SourceDocumentFileRow[]> {
    return (await handle
      .select(sourceDocumentFileProjection)
      .from(sourceDocumentFile)
      .where(eq(sourceDocumentFile.sourceDocumentId, sourceId))
      .orderBy(asc(sourceDocumentFile.ordinal))) as SourceDocumentFileRow[];
  }

  async findSourceFileById(
    handle: SourceQueryHandle,
    sourceId: string,
    fileId: string,
  ): Promise<SourceDocumentFileRow | null> {
    const rows = await handle
      .select(sourceDocumentFileProjection)
      .from(sourceDocumentFile)
      .where(
        and(eq(sourceDocumentFile.sourceDocumentId, sourceId), eq(sourceDocumentFile.id, fileId)),
      )
      .limit(1);
    return (rows[0] as SourceDocumentFileRow | undefined) ?? null;
  }

  async insertSourceFile(
    handle: SourceQueryHandle,
    values: SourceDocumentFileInsertValues,
  ): Promise<SourceDocumentFileRow> {
    const rows = await handle
      .insert(sourceDocumentFile)
      .values(values)
      .returning(sourceDocumentFileProjection);
    const row = rows[0] as SourceDocumentFileRow | undefined;
    if (!row) {
      throw new Error("Source document file insert did not return the inserted row.");
    }
    return row;
  }

  async findReferenceBySourceId(
    handle: SourceQueryHandle,
    sourceId: string,
  ): Promise<ReferenceArtifactRow | null> {
    const rows = await handle
      .select(referenceArtifactProjection)
      .from(referenceArtifact)
      .where(eq(referenceArtifact.sourceDocumentId, sourceId))
      .limit(1);
    return (rows[0] as ReferenceArtifactRow | undefined) ?? null;
  }

  async insertReferenceArtifact(
    handle: SourceQueryHandle,
    values: ReferenceArtifactInsertValues,
  ): Promise<ReferenceArtifactRow> {
    const rows = await handle
      .insert(referenceArtifact)
      .values(values)
      .returning(referenceArtifactProjection);
    const row = rows[0] as ReferenceArtifactRow | undefined;
    if (!row) {
      throw new Error("Reference artifact insert did not return the inserted row.");
    }
    return row;
  }

  async updateReferenceIpReview(
    handle: SourceQueryHandle,
    referenceId: string,
    values: {
      ipReviewStatus: string;
      ipReviewReason: string | null;
      ipReviewedBy: string;
      ipReviewedAt: Date;
    },
  ): Promise<ReferenceArtifactRow | null> {
    const rows = await handle
      .update(referenceArtifact)
      .set(values)
      .where(eq(referenceArtifact.id, referenceId))
      .returning(referenceArtifactProjection);
    return (rows[0] as ReferenceArtifactRow | undefined) ?? null;
  }

  async listExtractions(
    handle: SourceQueryHandle,
    query: SourceExtractionListQuery,
  ): Promise<ListPage<SourceExtractionRow>> {
    const rows = await handle
      .select(extractionProjection)
      .from(sourceExtraction)
      .where(
        and(
          eq(sourceExtraction.sourceDocumentId, query.sourceDocumentId),
          exists(
            handle
              .select({ id: sourceDocument.id })
              .from(sourceDocument)
              .where(
                and(
                  eq(sourceDocument.id, sourceExtraction.sourceDocumentId),
                  eq(sourceDocument.organizationId, query.organizationId),
                  eq(sourceDocument.projectId, query.projectId),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(sourceExtraction.extractionVersion))
      .limit(query.limit + 1);
    return paginate(rows as SourceExtractionRow[], query.limit, (row) => sourceRowToCursor(row));
  }

  async insertExtraction(
    handle: SourceQueryHandle,
    values: SourceExtractionInsertValues,
  ): Promise<SourceExtractionRow> {
    const rows = await handle
      .insert(sourceExtraction)
      .values(values)
      .returning(extractionProjection);
    const row = rows[0] as SourceExtractionRow | undefined;
    if (!row) {
      throw new Error("Extraction insert did not return the inserted row.");
    }
    return row;
  }

  async listChunks(
    handle: SourceQueryHandle,
    query: SourceChunkListQuery,
  ): Promise<ListPage<SourceChunkRow>> {
    const rows = await handle
      .select(chunkProjection)
      .from(sourceChunk)
      .where(
        and(
          eq(sourceChunk.organizationId, query.organizationId),
          eq(sourceChunk.projectId, query.projectId),
          eq(sourceChunk.sourceDocumentId, query.sourceDocumentId),
          query.extractionId ? eq(sourceChunk.sourceExtractionId, query.extractionId) : undefined,
        ),
      )
      .orderBy(asc(sourceChunk.sequence), asc(sourceChunk.id))
      .limit(query.limit + 1);
    return paginate(rows as SourceChunkRow[], query.limit, (row) => sourceRowToCursor(row));
  }

  async findOrganizationSettings(
    handle: SourceQueryHandle,
    organizationId: string,
  ): Promise<JsonObject | null> {
    const rows = await handle
      .select({ settings: organization.settings })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    return (rows[0]?.settings as JsonObject | undefined) ?? null;
  }
}
