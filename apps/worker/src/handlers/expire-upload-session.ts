import { StorageError } from "@atlashq/storage";
import {
  deleteUploadSession,
  deleteUploadSessionFile,
  listUploadSessionFiles,
  requireUploadSession,
  updateUploadSessionStatus,
} from "../db/source-vault-repository.js";
import { InvalidJobDataError, RetryableWorkerError } from "../errors.js";
import type { ExpireUploadSessionJobPayload } from "../job-types.js";
import { logWorkerEvent } from "../logger.js";
import { recordWorkerAuditEvent } from "../runtime/audit.js";
import type { WorkerRuntimeContext } from "../runtime/context.js";

/** `source_upload_session.status` values this handler is allowed to clean up. */
const CLEANABLE_STATUSES = new Set(["expired", "canceled"]);
/** Statuses that may still become eligible once their TTL passes. */
const PENDING_STATUSES = new Set(["created", "uploading", "uploaded"]);

/**
 * Handles the `expire-upload-session` document-processing job (module-02 §6.2). Only ever acts on
 * expired or canceled **unconfirmed** sessions: deletes their provisional MinIO objects first, then
 * their operational `source_upload_file`/`source_upload_session` rows. A `confirmed` session (or
 * its already-created immutable source/source-file rows) is never touched -- confirmation is what
 * turns provisional evidence into permanent archive-only records, and this handler has no delete
 * path for those tables at all.
 */
export async function handleExpireUploadSession(
  context: WorkerRuntimeContext,
  payload: ExpireUploadSessionJobPayload,
): Promise<void> {
  const { db, storage } = context;
  const logContext = { correlationId: payload.correlationId, queueName: "document-processing" };

  const session = await requireUploadSession(db, {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    uploadSessionId: payload.uploadSessionId,
  });

  if (session.status === "confirmed") {
    throw new InvalidJobDataError(
      `source_upload_session ${session.id} is confirmed and must never be expired/deleted.`,
    );
  }

  if (PENDING_STATUSES.has(session.status)) {
    if (new Date() < session.expiresAt) {
      logWorkerEvent(logContext, "source.upload_session.expiry_skipped", {
        uploadSessionId: session.id,
        status: session.status,
      });
      return; // Not yet eligible: nothing to do.
    }
    await updateUploadSessionStatus(db, session.id, "expired");
  } else if (!CLEANABLE_STATUSES.has(session.status)) {
    logWorkerEvent(logContext, "source.upload_session.expiry_replayed", {
      uploadSessionId: session.id,
      status: session.status,
    });
    return; // Already cleaned up in a previous run (session row would not exist otherwise).
  }

  const files = await listUploadSessionFiles(db, session.id);

  for (const file of files) {
    try {
      await storage.deleteProvisionalObject({ objectKey: file.objectKey });
    } catch (error) {
      if (error instanceof StorageError && error.code === "OBJECT_NOT_FOUND") {
        continue; // Already deleted by a previous (possibly crashed) attempt: fine.
      }
      throw new RetryableWorkerError(
        "STORAGE_DELETE_FAILED",
        `Failed to delete provisional object ${file.objectKey}.`,
        { cause: error },
      );
    }

    await deleteUploadSessionFile(db, file.id);
  }

  await recordWorkerAuditEvent(db, {
    organizationId: payload.organizationId,
    actorId: session.actorId,
    action: "source.upload_session.expired",
    entityType: "source_upload_session",
    entityId: session.id,
    projectId: payload.projectId,
    correlationId: payload.correlationId,
    after: { status: session.status, fileCount: files.length },
  });
  logWorkerEvent(logContext, "source.upload_session.expired", {
    uploadSessionId: session.id,
    status: session.status,
    fileCount: files.length,
  });

  await deleteUploadSession(db, session.id);
}
