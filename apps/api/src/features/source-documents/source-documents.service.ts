import { randomUUID } from "node:crypto";
import type { SourceVaultEnv } from "@atlashq/config";
import type { Database } from "@atlashq/db";
import { createIdempotencyKey } from "@atlashq/jobs";
import { createAtlasLogger } from "@atlashq/logger";
import {
  createImmutableObjectKey,
  createProvisionalObjectKey,
  createSha256ContentHash,
  type MinioObjectStorageClient,
  type StorageAuthorizationProof,
  type StoredObjectWriteResult,
} from "@atlashq/storage";
import type { JsonObject } from "@atlashq/types";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AuditRecordInput } from "../../audit/audit-input.js";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { AuditTransaction } from "../../audit/audit-transaction.js";
// biome-ignore lint/style/useImportType: Nest needs the runtime class for constructor injection metadata.
import { AuditWriter } from "../../audit/audit-writer.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import {
  DATABASE_CLIENT,
  SOURCE_DOCUMENT_QUEUE,
  SOURCE_STORAGE,
  SOURCE_VAULT_CONFIG,
} from "../../runtime/runtime.js";
import type { SourceDocumentQueue } from "../../runtime/source-vault-runtime.js";
import { apiErrorCodes } from "../../validation/dto-conventions.js";
import type {
  IpReviewChangeInput,
  ManualSourceCreateInput,
  ReferenceCaptureRequestInput,
  ReferenceSourceCreateInput,
  SourceArchiveInput,
  SourceChunkListResponse,
  SourceDocumentDetailResponse,
  SourceDocumentListResponse,
  SourceDocumentSummaryResponse,
  SourceExtractionListResponse,
  SourceFileSignedUrlResponse,
  SourceListFilter,
  SourceMetadataPatchInput,
  SourceRestoreInput,
  SourceRetryProcessingInput,
  SourceVaultCapabilitiesResponse,
  SourceVersionListResponse,
  UploadSessionCancelInput,
  UploadSessionConfirmInput,
  UploadSessionCreateInput,
  UploadSessionResponse,
} from "./source-documents.schemas.js";
import { SOURCE_DOCUMENTS_REPOSITORY } from "./source-documents.tokens.js";
import type {
  ReferenceArtifactRow,
  SourceCountSummary,
  SourceDocumentFileRow,
  SourceDocumentRow,
  SourceDocumentsRepository,
  SourceDuplicateMatchRow,
  SourceExtractionRow,
  SourceQueryHandle,
  UploadSessionFileRow,
  UploadSessionRow,
} from "./source-documents.types.js";
import {
  buildManifestEntries,
  decodeSourceCursor,
  hashCanonicalManifest,
  hashManualBody,
  readFeatureFlag,
  toChunkResponse,
  toExtractionResponse,
  toSourceDetailResponse,
  toSourceSummaryResponse,
  toUploadSessionResponse,
} from "./source-documents.utils.js";

const FLAG_SOURCE_VAULT_WRITES = "source_vault_writes_enabled";
const FLAG_SINGLE_PAGE_CAPTURE = "single_page_capture_enabled";
const FLAG_OCR_PROCESSING = "ocr_processing_enabled";

const QUEUE_NAME = "document-processing" as const;

const SOURCE_ENTITY = "source_document";
const REFERENCE_ENTITY = "reference_artifact";
const UPLOAD_SESSION_ENTITY = "source_upload_session";
const SOURCE_FILE_ENTITY = "source_document_file";

const ACTION_UPLOAD_SESSION_CREATE = "source.upload_session.create";
const ACTION_UPLOAD_SESSION_CONFIRM = "source.upload_session.confirm";
const ACTION_UPLOAD_SESSION_CANCEL = "source.upload_session.cancel";
const ACTION_SOURCE_CREATE = "source.create";
const ACTION_SOURCE_METADATA_UPDATE = "source.metadata.update";
const ACTION_SOURCE_ARCHIVE = "source.archive";
const ACTION_SOURCE_RESTORE = "source.restore";
const ACTION_SOURCE_RETRY = "source.retry";
const ACTION_REFERENCE_IP_REVIEW = "source.reference.ip_review";
const ACTION_REFERENCE_CAPTURE_REQUEST = "source.reference.capture_request";
const ACTION_REFERENCE_ATTESTATION = "source.reference.attestation";
const ACTION_SOURCE_DOWNLOAD_URL_ISSUED = "source.download_url.issued";
const ACTION_SOURCE_QUEUE_FAILED = "source.queue.enqueue_failed";

@Injectable()
export class SourceDocumentsService {
  private readonly logger = createAtlasLogger({ name: "atlashq-api" });

  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database | null,
    @Inject(SOURCE_DOCUMENTS_REPOSITORY) private readonly repository: SourceDocumentsRepository,
    @Inject(SOURCE_STORAGE) private readonly storage: MinioObjectStorageClient | null,
    @Inject(SOURCE_DOCUMENT_QUEUE) private readonly queue: SourceDocumentQueue | null,
    @Inject(SOURCE_VAULT_CONFIG) private readonly config: SourceVaultEnv | null,
    private readonly auditWriter: AuditWriter,
  ) {}

  private requireDb(): Database {
    if (!this.db) {
      throw new Error("Database client is not available for source-vault feature operations.");
    }
    return this.db;
  }

  private requireStorage(): MinioObjectStorageClient {
    if (!this.storage) {
      throw new ServiceUnavailableException({
        code: apiErrorCodes.sourceStorageUnavailable,
        message: "Source vault storage is not configured for this environment.",
      });
    }
    return this.storage;
  }

  private requireQueue(): SourceDocumentQueue {
    if (!this.queue) {
      throw new ServiceUnavailableException({
        code: apiErrorCodes.sourceStorageUnavailable,
        message: "Document-processing queue is not configured for this environment.",
      });
    }
    return this.queue;
  }

  private requireConfig(): SourceVaultEnv {
    if (!this.config) {
      throw new ServiceUnavailableException({
        code: apiErrorCodes.sourceStorageUnavailable,
        message: "Source vault configuration is not available for this environment.",
      });
    }
    return this.config;
  }

  private authorizationProof(actorId: string, reason: string): StorageAuthorizationProof {
    return { checked: true, actorId, reason };
  }

  private logInfo(
    event: string,
    auditContext: Pick<AuditRequestContext, "correlationId">,
    details: Record<string, unknown>,
  ) {
    this.logger.info({ event, correlationId: auditContext.correlationId, ...details }, event);
  }

  private logWarn(
    event: string,
    auditContext: Pick<AuditRequestContext, "correlationId">,
    details: Record<string, unknown>,
  ) {
    this.logger.warn({ event, correlationId: auditContext.correlationId, ...details }, event);
  }

  private async rethrowAfterRollbackFailure(
    storage: MinioObjectStorageClient,
    writeResult: StoredObjectWriteResult,
    originalError: unknown,
    auditContext: Pick<AuditRequestContext, "correlationId">,
    details: {
      organizationId: string;
      projectId: string;
      intake: "manual" | "reference";
    },
  ): Promise<never> {
    try {
      await storage.rollbackObjectWrite(writeResult);
    } catch (rollbackError) {
      this.logWarn("source.storage.rollback_failed", auditContext, {
        organizationId: details.organizationId,
        projectId: details.projectId,
        intake: details.intake,
        bucket: writeResult.bucket,
        versioned: writeResult.versionId !== null,
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }

    throw originalError;
  }

  private auditInput(
    auditContext: AuditRequestContext,
    action: string,
    entityType: string,
    entityId: string,
    projectId: string,
    before: unknown,
    after: unknown,
  ): AuditRecordInput {
    return {
      organizationId: auditContext.actor.organizationId,
      actorId: auditContext.actor.actorId,
      action,
      entityType,
      entityId,
      projectId,
      before,
      after,
      correlationId: auditContext.correlationId,
    };
  }

  private async assertWritesEnabled(handle: SourceQueryHandle, organizationId: string) {
    const settings = await this.repository.findOrganizationSettings(handle, organizationId);
    if (!readFeatureFlag(settings, FLAG_SOURCE_VAULT_WRITES)) {
      throw new ForbiddenException({
        code: apiErrorCodes.sourceStorageUnavailable,
        message:
          "Source vault writes are disabled for this organization. Reads and downloads remain available.",
      });
    }
  }

  private assertFileSizes(files: readonly { byteSize: number }[], maxFileSizeBytes: number) {
    for (const file of files) {
      if (file.byteSize > maxFileSizeBytes) {
        throw new BadRequestException({
          code: apiErrorCodes.sourceFileTooLarge,
          message: `File exceeds the maximum allowed size of ${maxFileSizeBytes} bytes.`,
        });
      }
    }
  }

  private mapDuplicateRows(rows: SourceDuplicateMatchRow[]) {
    return rows.map((row) => ({
      sourceId: row.sourceId,
      title: row.title,
      versionNumber: row.versionNumber,
      isArchived: row.isArchived,
      isSuperseded: row.isSuperseded,
      contributorId: row.contributorId,
      uploadedAt: row.uploadedAt.toISOString(),
    }));
  }

  private requireDuplicateAcknowledgement(
    duplicates: SourceDuplicateMatchRow[],
    acknowledgement: { acknowledgedMatchIds: string[] } | undefined,
    session: UploadSessionRow | null = null,
  ): { acknowledgedAt: Date | null; acknowledgedIds: string[] } {
    if (duplicates.length === 0) {
      return { acknowledgedAt: null, acknowledgedIds: [] };
    }

    const currentSet = duplicates.map((match) => match.sourceId).sort();

    // Reuse a prior session acknowledgement only when the current duplicate set exactly matches
    // the set that was originally acknowledged. If a new/removed duplicate appears at confirm
    // time we invalidate the stale ack and require a fresh, exact acknowledgement so a caller
    // cannot silently accept newly-appeared duplicates.
    const previouslyAcknowledged =
      session?.duplicateAcknowledgedAt !== undefined && session?.duplicateAcknowledgedAt !== null;
    if (previouslyAcknowledged && !acknowledgement) {
      const priorSet = [...(session?.duplicateMatchIds ?? [])].sort();
      const setsMatch =
        priorSet.length === currentSet.length &&
        priorSet.every((id, index) => id === currentSet[index]);
      if (setsMatch) {
        return {
          acknowledgedAt: session?.duplicateAcknowledgedAt ?? new Date(),
          acknowledgedIds: session?.duplicateMatchIds ?? currentSet,
        };
      }
      throw this.buildDuplicateAcknowledgementConflict(
        duplicates,
        "Duplicate set changed since acknowledgement; re-acknowledge the current matches to proceed.",
      );
    }

    if (!acknowledgement) {
      throw this.buildDuplicateAcknowledgementConflict(
        duplicates,
        "Duplicate acknowledgement is required to persist this evidence.",
      );
    }

    const supplied = [...acknowledgement.acknowledgedMatchIds].sort();
    if (
      currentSet.length !== supplied.length ||
      currentSet.some((id, index) => id !== supplied[index])
    ) {
      throw this.buildDuplicateAcknowledgementConflict(
        duplicates,
        "Duplicate acknowledgement must exactly match the current duplicate set.",
      );
    }

    return { acknowledgedAt: new Date(), acknowledgedIds: supplied };
  }

  private buildDuplicateAcknowledgementConflict(
    duplicates: SourceDuplicateMatchRow[],
    message: string,
  ): ConflictException {
    // Serialize the current duplicate matches so the client can render the confirmation dialog
    // and resubmit an exact acknowledgement without a second round-trip. The metadata block is
    // deliberately restricted to non-sensitive fields (no signed URLs, no session tokens).
    const matches = this.mapDuplicateRows(duplicates);
    return new ConflictException({
      code: apiErrorCodes.sourceDuplicateConfirmationRequired,
      message,
      details: [
        {
          path: ["body", "duplicateAcknowledgement"],
          code: "duplicate_confirmation_required",
          message,
          metadata: { matches },
        },
      ],
    });
  }

  private assertUploadSessionActive(session: UploadSessionRow): void {
    // Explicit terminal statuses are honoured verbatim so a session that has been recorded as
    // expired or canceled never gets rewritten to a different terminal state. Time-based expiry
    // is only *inferred* when the session is still in an active status.
    if (session.status === "confirmed") {
      throw new ConflictException({
        code: apiErrorCodes.sourceUploadSessionAlreadyConfirmed,
        message: "Upload session was already confirmed.",
      });
    }
    if (session.status === "canceled") {
      throw new BadRequestException({
        code: apiErrorCodes.sourceUploadSessionExpired,
        message: "Upload session was canceled. Create a new session to retry.",
      });
    }
    if (session.status === "expired") {
      throw new BadRequestException({
        code: apiErrorCodes.sourceUploadSessionExpired,
        message: "Upload session is expired. Create a new session to retry.",
      });
    }
    if (session.expiresAt <= new Date()) {
      throw new BadRequestException({
        code: apiErrorCodes.sourceUploadSessionExpired,
        message: "Upload session has expired. Create a new session to retry.",
      });
    }
  }

  /**
   * Enforce the configured bucket-versioning requirement: when `S3_REQUIRE_BUCKET_VERSIONING`
   * is true, every persisted `source_document_file`/reference-snapshot MUST carry a real
   * `objectVersionId`. Rejecting the confirm here (rather than storing an empty string) keeps
   * later downloads reproducible against the exact version that was scanned.
   */
  private resolveObjectVersionId(versionId: string | null | undefined): string {
    if (versionId && versionId.length > 0) {
      return versionId;
    }
    const config = this.requireConfig();
    if (config.S3_REQUIRE_BUCKET_VERSIONING) {
      throw new ServiceUnavailableException({
        code: apiErrorCodes.sourceStorageUnavailable,
        message:
          "Object storage did not return a versionId; the bucket must have versioning enabled.",
      });
    }
    return "";
  }

  // ---------------------------------------------------------------------------
  // Upload session lifecycle
  // ---------------------------------------------------------------------------

  async createUploadSession(
    session: RequestSessionContext,
    projectId: string,
    input: UploadSessionCreateInput,
    auditContext: AuditRequestContext,
    supersedesId: string | null = null,
  ): Promise<UploadSessionResponse> {
    const storage = this.requireStorage();
    this.requireQueue();
    const config = this.requireConfig();
    const organizationId = session.user.organizationId;

    const db = this.requireDb();

    // Persist the session + files + audit inside a single DB transaction so a signing failure
    // later cannot leave orphaned metadata. Signed URLs are generated AFTER commit so a slow
    // or failing storage round trip never keeps the DB transaction open — an active session
    // can always be re-fetched via GET which will reissue fresh signed URLs (module-02 §11).
    const {
      inserted,
      fileRows,
    }: {
      inserted: UploadSessionRow;
      fileRows: UploadSessionFileRow[];
    } = await db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as SourceQueryHandle;
      await this.assertWritesEnabled(handle, organizationId);
      this.assertFileSizes(input.files, config.SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES);

      if (supersedesId) {
        const parent = await this.repository.findSourceById(
          handle,
          organizationId,
          projectId,
          supersedesId,
        );
        if (!parent) {
          throw new NotFoundException({
            code: apiErrorCodes.resourceNotFound,
            message: "Source document not found.",
          });
        }
        const head = await this.repository.findLineageHead(
          handle,
          organizationId,
          projectId,
          parent.lineageId,
        );
        if (!head || head.id !== supersedesId) {
          throw new ConflictException({
            code: apiErrorCodes.sourceSuperseded,
            message: "This source is no longer the head of its lineage; refresh and try again.",
          });
        }
      }

      const expectedContentHash =
        input.sourceType === "document"
          ? // Single regular-file sources are canonically identified by that file's own SHA-256
            // (module-02 §6.3) — no manifest wrapping, so unrelated metadata never perturbs it.
            (() => {
              const [primaryFile] = input.files;
              if (!primaryFile) {
                throw new Error("Document upload session requires exactly one file.");
              }
              return primaryFile.sha256;
            })()
          : hashCanonicalManifest({
              sourceType: input.sourceType,
              reference: {
                referenceKind: input.reference.referenceKind,
                captureMethod: input.reference.captureMethod,
                accessType: input.reference.accessType,
                intendedUse: input.reference.intendedUse,
                ...(input.reference.sourceUrl ? { sourceUrl: input.reference.sourceUrl } : {}),
              },
              files: buildManifestEntries(
                input.files.map((file) => ({
                  ordinal: file.ordinal,
                  role: file.role,
                  sha256: file.sha256,
                })),
              ),
            });

      const duplicates = await this.repository.findDuplicateMatches(
        handle,
        organizationId,
        projectId,
        expectedContentHash,
      );

      const acknowledgement = this.requireDuplicateAcknowledgement(
        duplicates,
        input.duplicateAcknowledgement,
      );

      const intakeMode = input.sourceType === "document" ? "file_upload" : "reference_artifact";
      const idempotencyKey = createIdempotencyKey({
        queueName: QUEUE_NAME,
        resourceId: `${organizationId}:${projectId}:${expectedContentHash}:${randomUUID()}`,
        operation: intakeMode,
      });

      const referenceMetadata =
        input.sourceType === "reference" && "reference" in input && input.reference
          ? (input.reference as unknown as JsonObject)
          : null;

      const metadataDraft: JsonObject = {
        title: input.title,
        tags: input.tags,
        sourceType: input.sourceType,
        ...(input.sourceType === "document" && "documentFormat" in input && input.documentFormat
          ? { documentFormat: input.documentFormat }
          : {}),
        ...(referenceMetadata ? { reference: referenceMetadata } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.provenanceDate ? { provenanceDate: input.provenanceDate } : {}),
      };

      const expiresAt = new Date(Date.now() + config.SOURCE_UPLOAD_SESSION_TTL_SECONDS * 1000);

      const persisted = await this.repository.insertUploadSession(handle, {
        organizationId,
        projectId,
        actorId: session.user.id,
        intakeMode,
        metadataDraft,
        supersedesId,
        expectedContentHash,
        duplicateMatchIds: duplicates.map((match) => match.sourceId),
        status: "created",
        expiresAt,
        idempotencyKey,
      });

      if (acknowledgement.acknowledgedAt) {
        await this.repository.updateUploadSession(handle, persisted.id, {
          duplicateAcknowledgedAt: acknowledgement.acknowledgedAt,
          duplicateAcknowledgedBy: session.user.id,
          duplicateMatchIds: acknowledgement.acknowledgedIds,
          updatedAt: new Date(),
        });
      }

      const files: UploadSessionFileRow[] = [];
      for (const file of input.files) {
        const objectKey = createProvisionalObjectKey({
          organizationId,
          projectId,
          uploadSessionId: persisted.id,
          ordinal: file.ordinal,
          fileName: file.originalFileName,
        });
        const fileRow = await this.repository.insertUploadSessionFile(handle, {
          uploadSessionId: persisted.id,
          ordinal: file.ordinal,
          role: file.role,
          originalFileName: file.originalFileName,
          normalizedFileName: file.originalFileName,
          declaredMimeType: file.declaredMimeType,
          extension: file.format,
          expectedByteSize: file.byteSize,
          expectedSha256: file.sha256,
          objectKey,
        });
        files.push(fileRow);
      }

      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_UPLOAD_SESSION_CREATE,
          UPLOAD_SESSION_ENTITY,
          persisted.id,
          projectId,
          null,
          { intakeMode, fileCount: files.length, supersedesId },
        ),
      );

      return { inserted: persisted, fileRows: files };
    });

    // Post-commit: mint fresh signed upload URLs. If the storage call fails the session still
    // exists in the DB with `status = 'created'`, so the caller can GET the session to obtain
    // new signed URLs without losing state.
    const signedUrls = await this.mintUploadUrls(storage, session.user.id, fileRows, config);
    this.logInfo("source.upload_session.created", auditContext, {
      uploadSessionId: inserted.id,
      projectId,
      organizationId,
      sourceType: input.sourceType,
      fileCount: fileRows.length,
      supersedesId,
    });
    return toUploadSessionResponse(inserted, fileRows, [], signedUrls);
  }

  private async mintUploadUrls(
    storage: MinioObjectStorageClient,
    actorId: string,
    fileRows: UploadSessionFileRow[],
    config: SourceVaultEnv,
  ): Promise<Map<string, { url: string; expiresAt: string }>> {
    const map = new Map<string, { url: string; expiresAt: string }>();
    for (const file of fileRows) {
      const signed = await storage.createSignedUploadUrl({
        objectKey: file.objectKey,
        authorization: this.authorizationProof(actorId, ACTION_UPLOAD_SESSION_CREATE),
        expiresInSeconds: config.SOURCE_UPLOAD_URL_TTL_SECONDS,
        contentType: file.declaredMimeType,
      });
      map.set(file.id, { url: signed.signedUrl, expiresAt: signed.expiresAt });
    }
    return map;
  }

  async getUploadSession(
    session: RequestSessionContext,
    projectId: string,
    sessionId: string,
  ): Promise<UploadSessionResponse> {
    const db = this.requireDb();
    const handle = db as SourceQueryHandle;
    const uploadSession = await this.repository.findUploadSessionById(
      handle,
      session.user.organizationId,
      projectId,
      sessionId,
    );
    if (!uploadSession) {
      throw new NotFoundException("Upload session not found.");
    }

    const files = await this.repository.listUploadSessionFiles(handle, uploadSession.id);
    const duplicates = await this.repository.findDuplicateMatches(
      handle,
      session.user.organizationId,
      projectId,
      uploadSession.expectedContentHash,
    );

    // Reissue fresh signed upload URLs when the session is still active so a signing failure
    // during create-session is fully recoverable via a subsequent GET (module-02 §11).
    const isActive =
      uploadSession.status === "created" ||
      uploadSession.status === "uploading" ||
      uploadSession.status === "uploaded";
    const canSign = isActive && uploadSession.expiresAt > new Date();
    const signedUrls = canSign
      ? await this.mintUploadUrls(
          this.requireStorage(),
          session.user.id,
          files,
          this.requireConfig(),
        )
      : new Map<string, { url: string; expiresAt: string }>();

    return toUploadSessionResponse(uploadSession, files, duplicates, signedUrls);
  }

  async cancelUploadSession(
    session: RequestSessionContext,
    projectId: string,
    sessionId: string,
    input: UploadSessionCancelInput,
    auditContext: AuditRequestContext,
  ): Promise<UploadSessionResponse> {
    const db = this.requireDb();
    return db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as SourceQueryHandle;
      const uploadSession = await this.repository.findUploadSessionById(
        handle,
        session.user.organizationId,
        projectId,
        sessionId,
      );
      if (!uploadSession) {
        throw new NotFoundException("Upload session not found.");
      }
      if (uploadSession.status === "confirmed") {
        throw new ConflictException({
          code: apiErrorCodes.sourceUploadSessionAlreadyConfirmed,
          message: "Cannot cancel a confirmed upload session.",
        });
      }
      const updated = await this.repository.updateUploadSession(handle, uploadSession.id, {
        status: "canceled",
        updatedAt: new Date(),
      });
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_UPLOAD_SESSION_CANCEL,
          UPLOAD_SESSION_ENTITY,
          uploadSession.id,
          projectId,
          { status: uploadSession.status },
          { status: "canceled", reason: input.reason ?? null },
        ),
      );
      const files = await this.repository.listUploadSessionFiles(handle, uploadSession.id);
      this.logInfo("source.upload_session.canceled", auditContext, {
        uploadSessionId: uploadSession.id,
        projectId,
        organizationId: session.user.organizationId,
        previousStatus: uploadSession.status,
      });
      return toUploadSessionResponse(updated ?? uploadSession, files, [], new Map());
    });
  }

  async confirmUploadSession(
    session: RequestSessionContext,
    projectId: string,
    sessionId: string,
    input: UploadSessionConfirmInput,
    auditContext: AuditRequestContext,
  ): Promise<SourceDocumentDetailResponse> {
    const storage = this.requireStorage();
    const queue = this.requireQueue();
    const db = this.requireDb();
    const organizationId = session.user.organizationId;

    // Pre-flight stat outside the DB transaction so a slow/failing storage round-trip does not
    // hold the DB row locks.
    const preflightHandle = db as SourceQueryHandle;
    const preflightSession = await this.repository.findUploadSessionById(
      preflightHandle,
      organizationId,
      projectId,
      sessionId,
    );
    if (!preflightSession) {
      throw new NotFoundException("Upload session not found.");
    }

    if (preflightSession.status === "confirmed" && preflightSession.createdSourceId) {
      // Idempotent: return the previously created source without any side effect.
      return this.buildSourceDetail(
        preflightHandle,
        organizationId,
        projectId,
        preflightSession.createdSourceId,
      );
    }

    this.assertUploadSessionActive(preflightSession);

    const preflightFiles = await this.repository.listUploadSessionFiles(
      preflightHandle,
      preflightSession.id,
    );
    const statResults = await Promise.all(
      preflightFiles.map((file) =>
        storage.statObject({ objectKey: file.objectKey }).catch(() => null),
      ),
    );
    for (let index = 0; index < preflightFiles.length; index += 1) {
      const stat = statResults[index];
      const file = preflightFiles[index];
      if (!file) continue;
      if (!stat) {
        throw new BadRequestException({
          code: apiErrorCodes.sourceUploadSizeMismatch,
          message: `File ${file.originalFileName} is missing from storage.`,
        });
      }
      if (stat.sizeBytes !== file.expectedByteSize) {
        throw new BadRequestException({
          code: apiErrorCodes.sourceUploadSizeMismatch,
          message: `File ${file.originalFileName} size mismatch.`,
        });
      }
      if (stat.contentType && stat.contentType !== file.declaredMimeType) {
        throw new BadRequestException({
          code: apiErrorCodes.sourceMimeMismatch,
          message: `File ${file.originalFileName} MIME type mismatch.`,
        });
      }
      // Validate versionId presence up-front so the whole confirm fails cleanly instead of
      // partially committing rows with an empty versionId when bucket versioning is required.
      this.resolveObjectVersionId(stat.versionId);
    }

    // Commit source + file + reference + audit rows atomically. Queue enqueue happens AFTER
    // commit so a queue outage never leaves the DB partially written; likewise, the confirm
    // itself never touches storage after the tx opens.
    const {
      insertedSource,
      insertedFiles,
      insertedReference,
    }: {
      insertedSource: SourceDocumentRow;
      insertedFiles: SourceDocumentFileRow[];
      insertedReference: ReferenceArtifactRow | null;
    } = await db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as SourceQueryHandle;
      await this.assertWritesEnabled(handle, organizationId);
      const uploadSession = await this.repository.findUploadSessionById(
        handle,
        organizationId,
        projectId,
        sessionId,
      );
      if (!uploadSession) {
        throw new NotFoundException("Upload session not found.");
      }
      if (uploadSession.status === "confirmed" && uploadSession.createdSourceId) {
        const existingSource = await this.repository.findSourceById(
          handle,
          organizationId,
          projectId,
          uploadSession.createdSourceId,
        );
        const files = existingSource
          ? await this.repository.listSourceFiles(handle, existingSource.id)
          : [];
        const existingReference =
          existingSource && existingSource.sourceType === "reference"
            ? await this.repository.findReferenceBySourceId(handle, existingSource.id)
            : null;
        return {
          insertedSource: existingSource as SourceDocumentRow,
          insertedFiles: files,
          insertedReference: existingReference,
        };
      }
      this.assertUploadSessionActive(uploadSession);

      const files = await this.repository.listUploadSessionFiles(handle, uploadSession.id);
      const duplicates = await this.repository.findDuplicateMatches(
        handle,
        organizationId,
        projectId,
        uploadSession.expectedContentHash,
      );
      // Re-check with the recorded session ack; will throw if the current duplicate set
      // differs from the previously acknowledged set (issue 3).
      this.requireDuplicateAcknowledgement(
        duplicates,
        input.duplicateAcknowledgement,
        uploadSession,
      );

      const metadataDraft = uploadSession.metadataDraft as {
        title?: string;
        tags?: string[];
        sourceType?: string;
        documentFormat?: string | null;
        notes?: string | null;
        provenanceDate?: string | null;
        reference?: {
          referenceKind: string;
          captureMethod: string;
          accessType: string;
          intendedUse: string;
          sourceUrl?: string;
          capturedAt?: string;
          attestation: { attestationText: string; attestationVersion: string; acceptedAt: string };
        };
      };

      const sourceType = (metadataDraft.sourceType ?? "document") as "document" | "reference";
      const documentFormat = metadataDraft.documentFormat ?? null;

      // Resolve lineage/version with STRICT lookups; never fall back to a random UUID so we
      // can never create an orphan lineage silently (issue 4).
      const isRoot = !uploadSession.supersedesId;
      const rootId = isRoot ? randomUUID() : undefined;
      let lineageId: string;
      let versionNumber: number;
      if (uploadSession.supersedesId) {
        const parent = await this.repository.findSourceById(
          handle,
          organizationId,
          projectId,
          uploadSession.supersedesId,
        );
        if (!parent) {
          throw new ConflictException({
            code: apiErrorCodes.sourceSuperseded,
            message:
              "The predecessor source no longer exists; confirm cannot proceed against a missing lineage.",
          });
        }
        const head = await this.repository.findLineageHead(
          handle,
          organizationId,
          projectId,
          parent.lineageId,
        );
        if (!head || head.id !== uploadSession.supersedesId) {
          throw new ConflictException({
            code: apiErrorCodes.sourceSuperseded,
            message: "This source is no longer the head of its lineage; refresh and try again.",
          });
        }
        lineageId = parent.lineageId;
        versionNumber = head.versionNumber + 1;
      } else {
        lineageId = rootId as string;
        versionNumber = 1;
      }

      const inserted = await this.repository.insertSource(handle, {
        ...(rootId ? { id: rootId } : {}),
        organizationId,
        projectId,
        lineageId,
        versionNumber,
        supersedesId: uploadSession.supersedesId,
        sourceType,
        documentFormat: sourceType === "document" ? (documentFormat ?? "pdf") : null,
        title: metadataDraft.title ?? "Untitled",
        notes: metadataDraft.notes ?? null,
        tags: metadataDraft.tags ?? [],
        provenanceDate: metadataDraft.provenanceDate
          ? new Date(metadataDraft.provenanceDate)
          : null,
        contentHash: uploadSession.expectedContentHash,
        duplicateAcknowledgedMatchIds: uploadSession.duplicateMatchIds,
        duplicateAcknowledgedAt: uploadSession.duplicateAcknowledgedAt,
        duplicateAcknowledgedBy: uploadSession.duplicateAcknowledgedBy,
        processingStatus: "verification_pending",
        createdBy: session.user.id,
        updatedBy: session.user.id,
      });

      const persistedFiles: SourceDocumentFileRow[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const stat = statResults[index];
        if (!file || !stat) continue;
        const fileRow = await this.repository.insertSourceFile(handle, {
          sourceDocumentId: inserted.id,
          ordinal: file.ordinal,
          role: file.role,
          originalFileName: file.originalFileName,
          downloadFileName: file.normalizedFileName,
          format: file.extension,
          declaredMimeType: file.declaredMimeType,
          byteSize: file.expectedByteSize,
          sha256: file.expectedSha256,
          objectKey: file.objectKey,
          objectVersionId: this.resolveObjectVersionId(stat.versionId),
          scanStatus: "pending",
        });
        persistedFiles.push(fileRow);
      }

      await this.repository.updateUploadSession(handle, uploadSession.id, {
        status: "confirmed",
        confirmedAt: new Date(),
        createdSourceId: inserted.id,
        updatedAt: new Date(),
      });

      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_UPLOAD_SESSION_CONFIRM,
          UPLOAD_SESSION_ENTITY,
          uploadSession.id,
          projectId,
          { status: uploadSession.status },
          { status: "confirmed", sourceId: inserted.id },
        ),
      );

      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_SOURCE_CREATE,
          SOURCE_ENTITY,
          inserted.id,
          projectId,
          null,
          {
            sourceType,
            lineageId,
            versionNumber,
            fileCount: persistedFiles.length,
          },
        ),
      );

      // Reference intakes carry the full immutable metadata + attestation on the session
      // itself. On confirm we write a dedicated attestation audit event FIRST, then create
      // the reference_artifact row with `audit_event_id` pointing back to that event.
      let insertedRef: ReferenceArtifactRow | null = null;
      if (sourceType === "reference" && metadataDraft.reference) {
        const ref = metadataDraft.reference;
        const attestationEvent = await this.auditWriter.record(
          tx,
          this.auditInput(
            auditContext,
            ACTION_REFERENCE_ATTESTATION,
            REFERENCE_ENTITY,
            inserted.id,
            projectId,
            null,
            {
              attestationText: ref.attestation.attestationText,
              attestationVersion: ref.attestation.attestationVersion,
              attestedByActorId: session.user.id,
              attestedAt: ref.attestation.acceptedAt,
            },
          ),
        );
        insertedRef = await this.repository.insertReferenceArtifact(handle, {
          sourceDocumentId: inserted.id,
          organizationId,
          projectId,
          referenceKind: ref.referenceKind,
          captureMethod: ref.captureMethod,
          accessType: ref.accessType,
          intendedUse: ref.intendedUse,
          sourceUrl: ref.sourceUrl ?? null,
          attestationText: ref.attestation.attestationText,
          attestationVersion: ref.attestation.attestationVersion,
          attestedBy: session.user.id,
          attestedAt: new Date(ref.attestation.acceptedAt),
          auditEventId: attestationEvent.id,
          capturedAt: ref.capturedAt ? new Date(ref.capturedAt) : null,
        });
      }

      return {
        insertedSource: inserted,
        insertedFiles: persistedFiles,
        insertedReference: insertedRef,
      };
    });

    // Post-commit: enqueue verify-and-scan for every uploaded file. If enqueue fails we mark
    // the source `failed` (retry-eligible) in a separate short tx and surface 503 so callers
    // can recover via /retry once the queue is healthy again.
    try {
      for (const file of insertedFiles) {
        await queue.addVerifyAndScan({
          kind: "verify-and-scan",
          organizationId,
          projectId,
          sourceDocumentId: insertedSource.id,
          sourceDocumentFileId: file.id,
          objectKey: file.objectKey,
          expectedSha256: file.sha256,
          idempotencyKey: createIdempotencyKey({
            queueName: QUEUE_NAME,
            resourceId: file.id,
            operation: "verify-and-scan",
          }),
          correlationId: auditContext.correlationId,
          actorId: session.user.id,
          submittedAt: new Date().toISOString(),
        });
        this.logInfo("source.queue.verify_and_scan.enqueued", auditContext, {
          sourceDocumentId: insertedSource.id,
          sourceDocumentFileId: file.id,
          uploadSessionId: sessionId,
          projectId,
          organizationId,
        });
      }
    } catch (error) {
      await this.markSourceFailedFromQueueOutage(
        insertedSource.id,
        session.user.id,
        auditContext,
        projectId,
      );
      this.logWarn("source.queue.verify_and_scan.enqueue_failed", auditContext, {
        sourceDocumentId: insertedSource.id,
        uploadSessionId: sessionId,
        projectId,
        organizationId,
        errorMessage: error instanceof Error ? error.message : "enqueue failed",
      });
      throw new ServiceUnavailableException({
        code: apiErrorCodes.sourceStorageUnavailable,
        message:
          "Source was persisted but enqueue for verify-and-scan failed; call /retry once the queue is healthy.",
        details: [{ path: ["queue"], message: (error as Error).message, code: "enqueue_failed" }],
      });
    }

    this.logInfo("source.upload_session.confirmed", auditContext, {
      uploadSessionId: sessionId,
      sourceDocumentId: insertedSource.id,
      projectId,
      organizationId,
      fileCount: insertedFiles.length,
    });

    return toSourceDetailResponse(insertedSource, insertedFiles, insertedReference);
  }

  private async markSourceFailedFromQueueOutage(
    sourceId: string,
    actorId: string,
    auditContext: AuditRequestContext,
    projectId: string,
  ): Promise<void> {
    const db = this.requireDb();
    try {
      await db.transaction(async (tx: AuditTransaction) => {
        const handle = tx as SourceQueryHandle;
        await this.repository.updateSourceProcessingStatus(handle, sourceId, {
          processingStatus: "failed",
          updatedAt: new Date(),
          updatedBy: actorId,
        });
        await this.auditWriter.record(
          tx,
          this.auditInput(
            auditContext,
            ACTION_SOURCE_QUEUE_FAILED,
            SOURCE_ENTITY,
            sourceId,
            projectId,
            null,
            { reason: "queue_enqueue_failed" },
          ),
        );
      });
      this.logWarn("source.queue.enqueue_failed", auditContext, {
        sourceDocumentId: sourceId,
        projectId,
      });
    } catch {
      // Best-effort: even if the fallback tx fails the source is discoverable via list/get
      // and can be retried once the operator restores the queue.
    }
  }

  // ---------------------------------------------------------------------------
  // Manual source
  // ---------------------------------------------------------------------------

  async createManualSource(
    session: RequestSessionContext,
    projectId: string,
    input: ManualSourceCreateInput,
    auditContext: AuditRequestContext,
    supersedesId: string | null = null,
  ): Promise<SourceDocumentDetailResponse> {
    const storage = this.requireStorage();
    const queue = this.requireQueue();
    const db = this.requireDb();
    const organizationId = session.user.organizationId;

    const bodyHash = hashManualBody(input.body);
    const bodyBytes = Buffer.from(input.body.normalize("NFC"), "utf8");
    // Manual sources are canonically identified by the body hash only — different titles for
    // the same text still collide as duplicates (module-02 §6.4). Unlike multi-file/reference
    // manifests, a manual source is a single regular-file source, so its content_hash equals the
    // body's own SHA-256 exactly (no manifest wrapping).
    const contentHash = bodyHash;

    // Upload the manual body bytes BEFORE opening the DB transaction so a slow storage call
    // never blocks a DB row lock. On tx failure we delete the object (best-effort). Retaining
    // the unique key on success matches the V1 convention for binary uploads.
    const objectKey = createImmutableObjectKey({
      organizationId,
      projectId,
      purpose: "source-document",
      contentHash: bodyHash,
      objectId: randomUUID(),
      fileName: "manual.txt",
    });
    const writeResult = await storage.putObject({
      objectKey,
      data: bodyBytes,
      sizeBytes: bodyBytes.length,
      contentType: "text/plain",
    });
    const objectVersionId = this.resolveObjectVersionId(writeResult.versionId);

    let insertedSource: SourceDocumentRow | undefined;
    let insertedFile: SourceDocumentFileRow | undefined;
    let extractionRow: SourceExtractionRow | undefined;

    try {
      await db.transaction(async (tx: AuditTransaction) => {
        const handle = tx as SourceQueryHandle;
        await this.assertWritesEnabled(handle, organizationId);

        const duplicates = await this.repository.findDuplicateMatches(
          handle,
          organizationId,
          projectId,
          contentHash,
        );
        this.requireDuplicateAcknowledgement(duplicates, input.duplicateAcknowledgement);

        const isRoot = !supersedesId;
        const rootId = isRoot ? randomUUID() : undefined;
        let lineageId: string;
        let versionNumber: number;
        if (supersedesId) {
          const parent = await this.assertLineageHead(
            handle,
            organizationId,
            projectId,
            supersedesId,
          );
          const head = await this.repository.findLineageHead(
            handle,
            organizationId,
            projectId,
            parent.lineageId,
          );
          if (!head) {
            throw new ConflictException({
              code: apiErrorCodes.sourceSuperseded,
              message: "Lineage head lookup failed for the predecessor source.",
            });
          }
          lineageId = parent.lineageId;
          versionNumber = head.versionNumber + 1;
        } else {
          lineageId = rootId as string;
          versionNumber = 1;
        }

        insertedSource = await this.repository.insertSource(handle, {
          ...(rootId ? { id: rootId } : {}),
          organizationId,
          projectId,
          lineageId,
          versionNumber,
          supersedesId,
          sourceType: "manual",
          documentFormat: null,
          title: input.title,
          notes: input.notes ?? null,
          tags: input.tags,
          provenanceDate: input.provenanceDate ? new Date(input.provenanceDate) : null,
          contentHash,
          duplicateAcknowledgedMatchIds: input.duplicateAcknowledgement?.acknowledgedMatchIds ?? [],
          duplicateAcknowledgedAt: duplicates.length > 0 ? new Date() : null,
          duplicateAcknowledgedBy: duplicates.length > 0 ? session.user.id : null,
          processingStatus: "extraction_pending",
          createdBy: session.user.id,
          updatedBy: session.user.id,
        });

        insertedFile = await this.repository.insertSourceFile(handle, {
          sourceDocumentId: insertedSource.id,
          ordinal: 0,
          role: "primary",
          originalFileName: `${input.title}.txt`,
          downloadFileName: `${input.title}.txt`,
          format: "txt",
          declaredMimeType: "text/plain",
          byteSize: bodyBytes.length,
          sha256: bodyHash,
          objectKey,
          objectVersionId,
          scanStatus: "not_required",
        });

        // Manual sources skip verify-and-scan (the API is the writer) but still need an
        // extraction row so the worker can attach chunk output; use its real id in the queue
        // payload (module-02 §6.4, §8.5).
        extractionRow = await this.repository.insertExtraction(handle, {
          sourceDocumentId: insertedSource.id,
          extractionVersion: 1,
          status: "pending",
          parserManifest: [],
          chunkerVersion: "v1",
        });

        await this.auditWriter.record(
          tx,
          this.auditInput(
            auditContext,
            ACTION_SOURCE_CREATE,
            SOURCE_ENTITY,
            insertedSource.id,
            projectId,
            null,
            {
              sourceType: "manual",
              intake: "manual",
              extractionId: extractionRow.id,
              ...(supersedesId ? { supersedesId } : {}),
            },
          ),
        );
      });
    } catch (error) {
      await this.rethrowAfterRollbackFailure(storage, writeResult, error, auditContext, {
        organizationId,
        projectId,
        intake: "manual",
      });
    }

    if (!insertedSource || !insertedFile || !extractionRow) {
      throw new Error("Manual source insert did not return the inserted rows.");
    }

    try {
      await queue.addExtract({
        kind: "extract",
        organizationId,
        projectId,
        sourceDocumentId: insertedSource.id,
        sourceExtractionId: extractionRow.id,
        idempotencyKey: createIdempotencyKey({
          queueName: QUEUE_NAME,
          resourceId: extractionRow.id,
          operation: "extract",
        }),
        correlationId: auditContext.correlationId,
        actorId: session.user.id,
        submittedAt: new Date().toISOString(),
      });
      this.logInfo("source.queue.extract.enqueued", auditContext, {
        sourceDocumentId: insertedSource.id,
        sourceExtractionId: extractionRow.id,
        projectId,
        organizationId,
        intake: "manual",
      });
    } catch (error) {
      await this.markSourceFailedFromQueueOutage(
        insertedSource.id,
        session.user.id,
        auditContext,
        projectId,
      );
      this.logWarn("source.queue.extract.enqueue_failed", auditContext, {
        sourceDocumentId: insertedSource.id,
        sourceExtractionId: extractionRow.id,
        projectId,
        organizationId,
        errorMessage: error instanceof Error ? error.message : "enqueue failed",
      });
      throw new ServiceUnavailableException({
        code: apiErrorCodes.sourceStorageUnavailable,
        message:
          "Manual source was persisted but enqueue for extraction failed; call /retry once the queue is healthy.",
        details: [{ path: ["queue"], message: (error as Error).message, code: "enqueue_failed" }],
      });
    }

    this.logInfo("source.manual.created", auditContext, {
      sourceDocumentId: insertedSource.id,
      sourceExtractionId: extractionRow.id,
      projectId,
      organizationId,
      supersedesId,
    });

    return toSourceDetailResponse(insertedSource, [insertedFile], null);
  }

  // ---------------------------------------------------------------------------
  // Reference source (direct: URL / manual paste only)
  // ---------------------------------------------------------------------------

  async createReferenceSource(
    session: RequestSessionContext,
    projectId: string,
    input: ReferenceSourceCreateInput,
    auditContext: AuditRequestContext,
  ): Promise<SourceDocumentDetailResponse> {
    const storage = this.requireStorage();
    const db = this.requireDb();
    const organizationId = session.user.organizationId;

    const attestation = input.reference.attestation;

    // Canonical JSON snapshot for URL/manual-paste references (module-02 §6.7). Deliberately
    // built from immutable evidence fields only (kind/capture method/access type/intended use/
    // source URL) -- never the mutable `title` -- so editing the title never changes the
    // snapshot's own hash or the source's canonical content_hash.
    const snapshotEvidence = {
      kind: input.reference.referenceKind,
      captureMethod: input.reference.captureMethod,
      accessType: input.reference.accessType,
      intendedUse: input.reference.intendedUse,
      url: input.reference.sourceUrl ?? null,
    };
    const primaryHash = createSha256ContentHash(JSON.stringify(snapshotEvidence));
    const contentHash = hashCanonicalManifest({
      sourceType: "reference",
      reference: {
        referenceKind: input.reference.referenceKind,
        captureMethod: input.reference.captureMethod,
        accessType: input.reference.accessType,
        intendedUse: input.reference.intendedUse,
        ...(input.reference.sourceUrl ? { sourceUrl: input.reference.sourceUrl } : {}),
      },
      files: [{ ordinal: 0, role: "snapshot", sha256: primaryHash }],
    });

    // Upload the snapshot BEFORE opening the DB tx (issue 5). On tx failure delete the object.
    const snapshotBody = Buffer.from(JSON.stringify(snapshotEvidence), "utf8");
    const objectKey = createImmutableObjectKey({
      organizationId,
      projectId,
      purpose: "reference-snapshot",
      contentHash: primaryHash,
      objectId: randomUUID(),
      fileName: "reference.json",
    });
    const writeResult = await storage.putObject({
      objectKey,
      data: snapshotBody,
      sizeBytes: snapshotBody.length,
      contentType: "application/json",
    });
    const objectVersionId = this.resolveObjectVersionId(writeResult.versionId);

    let insertedSource: SourceDocumentRow | undefined;
    let insertedFile: SourceDocumentFileRow | undefined;
    let insertedRef: ReferenceArtifactRow | undefined;

    try {
      await db.transaction(async (tx: AuditTransaction) => {
        const handle = tx as SourceQueryHandle;
        await this.assertWritesEnabled(handle, organizationId);

        const duplicates = await this.repository.findDuplicateMatches(
          handle,
          organizationId,
          projectId,
          contentHash,
        );
        this.requireDuplicateAcknowledgement(duplicates, input.duplicateAcknowledgement);

        const referenceRootId = randomUUID();
        insertedSource = await this.repository.insertSource(handle, {
          id: referenceRootId,
          organizationId,
          projectId,
          lineageId: referenceRootId,
          versionNumber: 1,
          supersedesId: null,
          sourceType: "reference",
          documentFormat: null,
          title: input.title,
          notes: input.notes ?? null,
          tags: input.tags,
          provenanceDate: input.provenanceDate ? new Date(input.provenanceDate) : null,
          contentHash,
          duplicateAcknowledgedMatchIds: input.duplicateAcknowledgement?.acknowledgedMatchIds ?? [],
          duplicateAcknowledgedAt: duplicates.length > 0 ? new Date() : null,
          duplicateAcknowledgedBy: duplicates.length > 0 ? session.user.id : null,
          processingStatus: "ready",
          createdBy: session.user.id,
          updatedBy: session.user.id,
        });

        insertedFile = await this.repository.insertSourceFile(handle, {
          sourceDocumentId: insertedSource.id,
          ordinal: 0,
          role: "snapshot",
          originalFileName: "reference.json",
          downloadFileName: "reference.json",
          format: "txt",
          declaredMimeType: "application/json",
          byteSize: snapshotBody.length,
          sha256: primaryHash,
          objectKey,
          objectVersionId,
          scanStatus: "not_required",
        });

        // Write the immutable attestation audit event first so we can wire its id into the
        // reference_artifact row.
        const attestationEvent = await this.auditWriter.record(
          tx,
          this.auditInput(
            auditContext,
            ACTION_REFERENCE_ATTESTATION,
            REFERENCE_ENTITY,
            insertedSource.id,
            projectId,
            null,
            {
              attestationText: attestation.attestationText,
              attestationVersion: attestation.attestationVersion,
              attestedByActorId: session.user.id,
              attestedAt: attestation.acceptedAt,
            },
          ),
        );

        insertedRef = await this.repository.insertReferenceArtifact(handle, {
          sourceDocumentId: insertedSource.id,
          organizationId,
          projectId,
          referenceKind: input.reference.referenceKind,
          captureMethod: input.reference.captureMethod,
          accessType: input.reference.accessType,
          intendedUse: input.reference.intendedUse,
          sourceUrl: input.reference.sourceUrl ?? null,
          attestationText: attestation.attestationText,
          attestationVersion: attestation.attestationVersion,
          attestedBy: session.user.id,
          attestedAt: new Date(attestation.acceptedAt),
          auditEventId: attestationEvent.id,
          capturedAt: input.reference.capturedAt ? new Date(input.reference.capturedAt) : null,
        });

        await this.auditWriter.record(
          tx,
          this.auditInput(
            auditContext,
            ACTION_SOURCE_CREATE,
            SOURCE_ENTITY,
            insertedSource.id,
            projectId,
            null,
            {
              sourceType: "reference",
              referenceKind: input.reference.referenceKind,
              captureMethod: input.reference.captureMethod,
            },
          ),
        );
      });
    } catch (error) {
      await this.rethrowAfterRollbackFailure(storage, writeResult, error, auditContext, {
        organizationId,
        projectId,
        intake: "reference",
      });
    }

    if (!insertedSource || !insertedFile || !insertedRef) {
      throw new Error("Reference source insert did not return the inserted rows.");
    }

    this.logInfo("source.reference.created", auditContext, {
      sourceDocumentId: insertedSource.id,
      projectId,
      organizationId,
      referenceKind: input.reference.referenceKind,
      captureMethod: input.reference.captureMethod,
    });

    return toSourceDetailResponse(insertedSource, [insertedFile], insertedRef);
  }

  // ---------------------------------------------------------------------------
  // Capability contract (module-02 §5, §9)
  // ---------------------------------------------------------------------------

  /**
   * Server-authoritative, project-scoped capability snapshot for the web client. Never throws on
   * a core-only boot (storage/queue absent): it reports their unavailability as `false` instead,
   * so the UI can safely gate write/capture/OCR affordances before ever attempting the underlying
   * operation. Booleans only -- never leaks configuration values, credentials, or infra details.
   */
  async getCapabilities(session: RequestSessionContext): Promise<SourceVaultCapabilitiesResponse> {
    const handle = this.requireDb() as SourceQueryHandle;
    const settings = await this.repository.findOrganizationSettings(
      handle,
      session.user.organizationId,
    );
    return {
      writesEnabled: readFeatureFlag(settings, FLAG_SOURCE_VAULT_WRITES),
      singlePageCaptureEnabled: readFeatureFlag(settings, FLAG_SINGLE_PAGE_CAPTURE),
      ocrProcessingEnabled: readFeatureFlag(settings, FLAG_OCR_PROCESSING),
      storageAvailable: this.storage !== null,
      queueAvailable: this.queue !== null,
    };
  }

  // ---------------------------------------------------------------------------
  // List / detail / metadata
  // ---------------------------------------------------------------------------

  async listSources(
    session: RequestSessionContext,
    projectId: string,
    query: SourceListFilter,
  ): Promise<SourceDocumentListResponse> {
    const handle = this.requireDb() as SourceQueryHandle;
    const cursor = query.cursor ? decodeSourceCursor(query.cursor) : undefined;
    const page = await this.repository.listSources(handle, {
      organizationId: session.user.organizationId,
      projectId,
      limit: query.limit,
      includeArchived: query.includeArchived,
      ...(cursor ? { cursor } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.documentFormat ? { documentFormat: query.documentFormat } : {}),
      ...(query.processingStatus ? { processingStatus: query.processingStatus } : {}),
      ...(query.ipReviewStatus ? { ipReviewStatus: query.ipReviewStatus } : {}),
      ...(query.hasUnacknowledgedDuplicate !== undefined
        ? { hasUnacknowledgedDuplicate: query.hasUnacknowledgedDuplicate }
        : {}),
      ...(query.tag ? { tag: query.tag } : {}),
      ...(query.contributorId ? { contributorId: query.contributorId } : {}),
      ...(query.search ? { search: query.search } : {}),
    });

    // Load references for reference sources to include IP review status in summaries.
    const items: SourceDocumentSummaryResponse[] = [];
    for (const row of page.items) {
      let reference: ReferenceArtifactRow | null = null;
      if (row.sourceType === "reference") {
        reference = await this.repository.findReferenceBySourceId(handle, row.id);
      }
      items.push(toSourceSummaryResponse(row, reference));
    }
    return { items, pageInfo: page.pageInfo };
  }

  async getSource(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
  ): Promise<SourceDocumentDetailResponse> {
    return this.buildSourceDetail(
      this.requireDb() as SourceQueryHandle,
      session.user.organizationId,
      projectId,
      sourceId,
    );
  }

  private async buildSourceDetail(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    sourceId: string,
  ): Promise<SourceDocumentDetailResponse> {
    const row = await this.repository.findSourceById(handle, organizationId, projectId, sourceId);
    if (!row) {
      throw new NotFoundException("Source document not found.");
    }
    const files = await this.repository.listSourceFiles(handle, sourceId);
    const reference =
      row.sourceType === "reference"
        ? await this.repository.findReferenceBySourceId(handle, sourceId)
        : null;
    return toSourceDetailResponse(row, files, reference);
  }

  async updateMetadata(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    input: SourceMetadataPatchInput,
    auditContext: AuditRequestContext,
  ): Promise<SourceDocumentDetailResponse> {
    const db = this.requireDb();
    const organizationId = session.user.organizationId;
    return db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as SourceQueryHandle;
      await this.assertWritesEnabled(handle, organizationId);
      const existing = await this.repository.findSourceById(
        handle,
        organizationId,
        projectId,
        sourceId,
      );
      if (!existing) throw new NotFoundException("Source document not found.");
      if (existing.archivedAt) {
        throw new ConflictException({
          code: apiErrorCodes.sourceArchived,
          message: "Cannot update metadata on an archived source.",
        });
      }

      const before = { title: existing.title, notes: existing.notes, tags: existing.tags };
      const updated = await this.repository.updateSourceMetadata(
        handle,
        organizationId,
        projectId,
        sourceId,
        input.version,
        {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          updatedBy: session.user.id,
          updatedAt: new Date(),
        },
      );
      if (!updated) {
        throw new ConflictException({
          code: apiErrorCodes.conflict,
          message: "Source was modified by another request. Reload and try again.",
        });
      }
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_SOURCE_METADATA_UPDATE,
          SOURCE_ENTITY,
          sourceId,
          projectId,
          before,
          { title: updated.title, notes: updated.notes, tags: updated.tags },
        ),
      );
      const files = await this.repository.listSourceFiles(handle, sourceId);
      const reference =
        updated.sourceType === "reference"
          ? await this.repository.findReferenceBySourceId(handle, sourceId)
          : null;
      return toSourceDetailResponse(updated, files, reference);
    });
  }

  async archiveSource(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    input: SourceArchiveInput,
    auditContext: AuditRequestContext,
  ): Promise<SourceDocumentDetailResponse> {
    const db = this.requireDb();
    const organizationId = session.user.organizationId;
    return db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as SourceQueryHandle;
      await this.assertWritesEnabled(handle, organizationId);
      const existing = await this.repository.findSourceById(
        handle,
        organizationId,
        projectId,
        sourceId,
      );
      if (!existing) throw new NotFoundException("Source document not found.");
      if (existing.archivedAt)
        return this.buildSourceDetail(handle, organizationId, projectId, sourceId);

      const now = new Date();
      const updated = await this.repository.updateSourceArchive(
        handle,
        organizationId,
        projectId,
        sourceId,
        input.version,
        {
          archivedAt: now,
          archivedBy: session.user.id,
          updatedBy: session.user.id,
          updatedAt: now,
        },
      );
      if (!updated) {
        throw new ConflictException({
          code: apiErrorCodes.conflict,
          message: "Source was modified by another request. Reload and try again.",
        });
      }
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_SOURCE_ARCHIVE,
          SOURCE_ENTITY,
          sourceId,
          projectId,
          { archivedAt: null },
          { archivedAt: now.toISOString(), reason: input.reason ?? null },
        ),
      );
      const files = await this.repository.listSourceFiles(handle, sourceId);
      const reference =
        updated.sourceType === "reference"
          ? await this.repository.findReferenceBySourceId(handle, sourceId)
          : null;
      return toSourceDetailResponse(updated, files, reference);
    });
  }

  async restoreSource(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    input: SourceRestoreInput,
    auditContext: AuditRequestContext,
  ): Promise<SourceDocumentDetailResponse> {
    const db = this.requireDb();
    const organizationId = session.user.organizationId;
    return db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as SourceQueryHandle;
      await this.assertWritesEnabled(handle, organizationId);
      const existing = await this.repository.findSourceById(
        handle,
        organizationId,
        projectId,
        sourceId,
      );
      if (!existing) throw new NotFoundException("Source document not found.");
      if (!existing.archivedAt)
        return this.buildSourceDetail(handle, organizationId, projectId, sourceId);

      const head = await this.repository.findLineageHead(
        handle,
        organizationId,
        projectId,
        existing.lineageId,
      );
      if (head && head.id !== sourceId) {
        throw new ConflictException({
          code: apiErrorCodes.sourceSuperseded,
          message: "Cannot restore a non-head lineage version.",
        });
      }

      const updated = await this.repository.updateSourceArchive(
        handle,
        organizationId,
        projectId,
        sourceId,
        input.version,
        {
          archivedAt: null,
          archivedBy: null,
          updatedBy: session.user.id,
          updatedAt: new Date(),
        },
      );
      if (!updated) {
        throw new ConflictException({
          code: apiErrorCodes.conflict,
          message: "Source was modified by another request. Reload and try again.",
        });
      }
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_SOURCE_RESTORE,
          SOURCE_ENTITY,
          sourceId,
          projectId,
          { archivedAt: existing.archivedAt.toISOString() },
          { archivedAt: null },
        ),
      );
      return this.buildSourceDetail(handle, organizationId, projectId, sourceId);
    });
  }

  async retryProcessing(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    input: SourceRetryProcessingInput,
    auditContext: AuditRequestContext,
  ): Promise<SourceDocumentDetailResponse> {
    const queue = this.requireQueue();
    const db = this.requireDb();
    const organizationId = session.user.organizationId;

    const {
      updatedSource,
      files,
    }: { updatedSource: SourceDocumentRow; files: SourceDocumentFileRow[] } = await db.transaction(
      async (tx: AuditTransaction) => {
        const handle = tx as SourceQueryHandle;
        await this.assertWritesEnabled(handle, organizationId);
        const existing = await this.repository.findSourceById(
          handle,
          organizationId,
          projectId,
          sourceId,
        );
        if (!existing) throw new NotFoundException("Source document not found.");
        if (existing.version !== input.version) {
          throw new ConflictException({
            code: apiErrorCodes.conflict,
            message: "Source was modified by another request. Reload and try again.",
          });
        }
        // Only genuinely `failed` sources are retry-eligible. Quarantined sources hold
        // scan evidence (malware / hash mismatch) that must not be discarded; recovery
        // is a new lineage version, not an in-place retry (module-02 §7.3).
        if (existing.processingStatus === "quarantined") {
          throw new ConflictException({
            code: apiErrorCodes.sourceProcessingNotRetryable,
            message: "Quarantined sources must be replaced with a new version instead of retried.",
          });
        }
        if (existing.processingStatus !== "failed") {
          throw new ConflictException({
            code: apiErrorCodes.sourceProcessingNotRetryable,
            message: "Source is not in a retryable processing state.",
          });
        }
        const existingFiles = await this.repository.listSourceFiles(handle, sourceId);
        if (existingFiles.some((file) => file.scanStatus === "infected")) {
          throw new ConflictException({
            code: apiErrorCodes.sourceProcessingNotRetryable,
            message: "Source has infected files and cannot be retried; upload a new version.",
          });
        }
        const updated = await this.repository.updateSourceProcessingStatus(handle, sourceId, {
          processingStatus: "verification_pending",
          updatedAt: new Date(),
          updatedBy: session.user.id,
        });
        await this.auditWriter.record(
          tx,
          this.auditInput(
            auditContext,
            ACTION_SOURCE_RETRY,
            SOURCE_ENTITY,
            sourceId,
            projectId,
            { processingStatus: existing.processingStatus },
            { processingStatus: "verification_pending" },
          ),
        );
        return { updatedSource: updated ?? existing, files: existingFiles };
      },
    );

    // Enqueue AFTER commit so a queue outage doesn't roll back the state reset. If enqueue
    // fails we mark the source failed again (retryable) and surface 503.
    try {
      for (const file of files) {
        await queue.addVerifyAndScan({
          kind: "verify-and-scan",
          organizationId,
          projectId,
          sourceDocumentId: sourceId,
          sourceDocumentFileId: file.id,
          objectKey: file.objectKey,
          expectedSha256: file.sha256,
          idempotencyKey: createIdempotencyKey({
            queueName: QUEUE_NAME,
            resourceId: `${file.id}:${Date.now()}`,
            operation: "verify-and-scan-retry",
          }),
          correlationId: auditContext.correlationId,
          actorId: session.user.id,
          submittedAt: new Date().toISOString(),
        });
        this.logInfo("source.queue.verify_and_scan.reenqueued", auditContext, {
          sourceDocumentId: sourceId,
          sourceDocumentFileId: file.id,
          projectId,
          organizationId,
        });
      }
    } catch (error) {
      await this.markSourceFailedFromQueueOutage(
        sourceId,
        session.user.id,
        auditContext,
        projectId,
      );
      this.logWarn("source.queue.verify_and_scan.reenqueue_failed", auditContext, {
        sourceDocumentId: sourceId,
        projectId,
        organizationId,
        errorMessage: error instanceof Error ? error.message : "enqueue failed",
      });
      throw new ServiceUnavailableException({
        code: apiErrorCodes.sourceStorageUnavailable,
        message:
          "Source retry was recorded but enqueue failed; call /retry again once the queue is healthy.",
        details: [{ path: ["queue"], message: (error as Error).message, code: "enqueue_failed" }],
      });
    }

    this.logInfo("source.retry.recorded", auditContext, {
      sourceDocumentId: sourceId,
      projectId,
      organizationId,
      fileCount: files.length,
    });

    const reference =
      updatedSource.sourceType === "reference"
        ? await this.repository.findReferenceBySourceId(
            this.requireDb() as SourceQueryHandle,
            sourceId,
          )
        : null;
    return toSourceDetailResponse(updatedSource, files, reference);
  }

  // ---------------------------------------------------------------------------
  // Version chain
  // ---------------------------------------------------------------------------

  private async assertLineageHead(
    handle: SourceQueryHandle,
    organizationId: string,
    projectId: string,
    sourceId: string,
  ): Promise<SourceDocumentRow> {
    const parent = await this.repository.findSourceById(
      handle,
      organizationId,
      projectId,
      sourceId,
    );
    if (!parent) {
      throw new NotFoundException("Source document not found.");
    }
    const head = await this.repository.findLineageHead(
      handle,
      organizationId,
      projectId,
      parent.lineageId,
    );
    if (!head || head.id !== sourceId) {
      throw new ConflictException({
        code: apiErrorCodes.sourceSuperseded,
        message: "This source is not the current head of its lineage.",
      });
    }
    return parent;
  }

  async listVersions(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    limit: number,
    cursor?: string,
  ): Promise<SourceVersionListResponse> {
    const handle = this.requireDb() as SourceQueryHandle;
    const existing = await this.repository.findSourceById(
      handle,
      session.user.organizationId,
      projectId,
      sourceId,
    );
    if (!existing) throw new NotFoundException("Source document not found.");
    const page = await this.repository.listSourceVersions(handle, {
      organizationId: session.user.organizationId,
      projectId,
      lineageId: existing.lineageId,
      limit,
      ...(cursor ? { cursor: decodeSourceCursor(cursor) } : {}),
    });
    return {
      items: page.items.map((row) => toSourceSummaryResponse(row)),
      pageInfo: page.pageInfo,
    };
  }

  async listExtractions(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    limit: number,
    cursor?: string,
  ): Promise<SourceExtractionListResponse> {
    const handle = this.requireDb() as SourceQueryHandle;
    const existing = await this.repository.findSourceById(
      handle,
      session.user.organizationId,
      projectId,
      sourceId,
    );
    if (!existing) throw new NotFoundException("Source document not found.");
    const page = await this.repository.listExtractions(handle, {
      organizationId: session.user.organizationId,
      projectId,
      sourceDocumentId: sourceId,
      limit,
      ...(cursor ? { cursor: decodeSourceCursor(cursor) } : {}),
    });
    return {
      items: page.items.map((row) => toExtractionResponse(row)),
      pageInfo: page.pageInfo,
    };
  }

  async listChunks(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    limit: number,
    cursor?: string,
  ): Promise<SourceChunkListResponse> {
    const handle = this.requireDb() as SourceQueryHandle;
    const page = await this.repository.listChunks(handle, {
      organizationId: session.user.organizationId,
      projectId,
      sourceDocumentId: sourceId,
      limit,
      ...(cursor ? { cursor: decodeSourceCursor(cursor) } : {}),
    });
    return {
      items: page.items.map((row) => toChunkResponse(row)),
      pageInfo: page.pageInfo,
    };
  }

  // ---------------------------------------------------------------------------
  // Signed URLs
  // ---------------------------------------------------------------------------

  async getFileSignedUrl(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    fileId: string,
    kind: "preview" | "download",
    auditContext: AuditRequestContext,
  ): Promise<SourceFileSignedUrlResponse> {
    const storage = this.requireStorage();
    const config = this.requireConfig();
    const db = this.requireDb();
    const organizationId = session.user.organizationId;

    const source = await this.repository.findSourceById(
      db as SourceQueryHandle,
      organizationId,
      projectId,
      sourceId,
    );
    if (!source) throw new NotFoundException("Source document not found.");
    if (source.processingStatus !== "ready") {
      throw new ConflictException({
        code: apiErrorCodes.sourceNotReady,
        message: "Source document is not ready for download.",
      });
    }
    const file = await this.repository.findSourceFileById(
      db as SourceQueryHandle,
      sourceId,
      fileId,
    );
    if (!file) throw new NotFoundException("Source file not found.");
    if (file.scanStatus === "infected") {
      throw new ConflictException({
        code: apiErrorCodes.sourceInfected,
        message: "Source file is quarantined and cannot be downloaded.",
      });
    }
    if (file.scanStatus !== "clean" && file.scanStatus !== "not_required") {
      throw new ConflictException({
        code: apiErrorCodes.sourceNotReady,
        message: "Source file is not yet clean.",
      });
    }

    const signed = await storage.createSignedDownloadUrl({
      objectKey: file.objectKey,
      authorization: this.authorizationProof(session.user.id, `source.file.${kind}`),
      expiresInSeconds: config.SOURCE_DOWNLOAD_URL_TTL_SECONDS,
      ...(file.objectVersionId ? { versionId: file.objectVersionId } : {}),
      fileName: file.downloadFileName,
      dispositionType: kind === "preview" ? "inline" : "attachment",
    });

    if (kind === "download") {
      await db.transaction(async (tx: AuditTransaction) => {
        await this.auditWriter.record(
          tx,
          this.auditInput(
            auditContext,
            ACTION_SOURCE_DOWNLOAD_URL_ISSUED,
            SOURCE_FILE_ENTITY,
            fileId,
            projectId,
            null,
            { sourceId, fileId, expiresAt: signed.expiresAt },
          ),
        );
      });
    }

    return { url: signed.signedUrl, expiresAt: signed.expiresAt };
  }

  // ---------------------------------------------------------------------------
  // Reference capture + IP review
  // ---------------------------------------------------------------------------

  async requestReferenceCapture(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    input: ReferenceCaptureRequestInput,
    auditContext: AuditRequestContext,
  ): Promise<{ status: "queued" }> {
    const queue = this.requireQueue();
    const db = this.requireDb();
    const organizationId = session.user.organizationId;
    return db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as SourceQueryHandle;
      await this.assertWritesEnabled(handle, organizationId);
      const settings = await this.repository.findOrganizationSettings(handle, organizationId);
      if (!readFeatureFlag(settings, FLAG_SINGLE_PAGE_CAPTURE)) {
        throw new ForbiddenException({
          code: apiErrorCodes.sourceCaptureDisabled,
          message: "Reference capture is not enabled for this organization.",
        });
      }

      const source = await this.repository.findSourceById(
        handle,
        organizationId,
        projectId,
        sourceId,
      );
      if (source?.sourceType !== "reference") {
        throw new NotFoundException("Reference source not found.");
      }

      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_REFERENCE_CAPTURE_REQUEST,
          REFERENCE_ENTITY,
          sourceId,
          projectId,
          null,
          { url: input.url },
        ),
      );

      await queue.addCaptureReference({
        kind: "capture-reference",
        organizationId,
        projectId,
        sourceDocumentId: sourceId,
        actorId: session.user.id,
        captureUrl: input.url,
        idempotencyKey: createIdempotencyKey({
          queueName: QUEUE_NAME,
          resourceId: `${sourceId}:${Date.now()}`,
          operation: "capture-reference",
        }),
        correlationId: auditContext.correlationId,
        submittedAt: new Date().toISOString(),
      });
      this.logInfo("source.queue.capture_reference.enqueued", auditContext, {
        sourceDocumentId: sourceId,
        projectId,
        organizationId,
      });
      return { status: "queued" as const };
    });
  }

  async changeIpReview(
    session: RequestSessionContext,
    projectId: string,
    sourceId: string,
    input: IpReviewChangeInput,
    auditContext: AuditRequestContext,
  ): Promise<SourceDocumentDetailResponse> {
    const db = this.requireDb();
    const organizationId = session.user.organizationId;
    return db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as SourceQueryHandle;
      await this.assertWritesEnabled(handle, organizationId);
      const source = await this.repository.findSourceById(
        handle,
        organizationId,
        projectId,
        sourceId,
      );
      if (source?.sourceType !== "reference") {
        throw new NotFoundException("Reference source not found.");
      }
      if (source.version !== input.version) {
        throw new ConflictException({
          code: apiErrorCodes.conflict,
          message: "Source was modified by another request. Reload and try again.",
        });
      }
      const reference = await this.repository.findReferenceBySourceId(handle, sourceId);
      if (!reference) throw new NotFoundException("Reference artifact not found.");

      const updatedRef = await this.repository.updateReferenceIpReview(handle, reference.id, {
        ipReviewStatus: input.ipReviewStatus,
        ipReviewReason: input.reason,
        ipReviewedBy: session.user.id,
        ipReviewedAt: new Date(),
      });
      if (!updatedRef) throw new NotFoundException("Reference artifact not found.");

      // Atomic version-scoped source touch. If the source was modified since we read it, the
      // update returns null; throwing here rolls back the reference update too (issue 6).
      const updatedSource = await this.repository.updateSourceProcessingStatus(handle, sourceId, {
        processingStatus: source.processingStatus,
        updatedBy: session.user.id,
        updatedAt: new Date(),
        expectedVersion: input.version,
      });
      if (!updatedSource) {
        throw new ConflictException({
          code: apiErrorCodes.conflict,
          message: "Source was modified by another request. Reload and try again.",
        });
      }

      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_REFERENCE_IP_REVIEW,
          REFERENCE_ENTITY,
          reference.id,
          projectId,
          {
            ipReviewStatus: reference.ipReviewStatus,
            ipReviewReason: reference.ipReviewReason,
          },
          {
            ipReviewStatus: updatedRef.ipReviewStatus,
            ipReviewReason: updatedRef.ipReviewReason,
          },
        ),
      );
      const files = await this.repository.listSourceFiles(handle, sourceId);
      return toSourceDetailResponse(updatedSource, files, updatedRef);
    });
  }

  // ---------------------------------------------------------------------------
  // Dashboard support
  // ---------------------------------------------------------------------------

  async getSourceCounts(
    session: RequestSessionContext,
    projectId: string,
  ): Promise<SourceCountSummary> {
    if (!this.db) {
      return { total: 0, ready: 0, quarantined: 0, failed: 0 };
    }
    return this.repository.countSourcesByProject(
      this.db as SourceQueryHandle,
      session.user.organizationId,
      projectId,
    );
  }
}
