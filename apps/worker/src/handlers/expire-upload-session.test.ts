import { StorageError } from "@atlashq/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUploadSession = vi.fn();
const updateUploadSessionStatus = vi.fn();
const listUploadSessionFiles = vi.fn();
const deleteUploadSessionFile = vi.fn();
const deleteUploadSession = vi.fn();
const recordWorkerAuditEvent = vi.fn();

vi.mock("../db/source-vault-repository.js", () => ({
  requireUploadSession: (...args: unknown[]) => requireUploadSession(...args),
  updateUploadSessionStatus: (...args: unknown[]) => updateUploadSessionStatus(...args),
  listUploadSessionFiles: (...args: unknown[]) => listUploadSessionFiles(...args),
  deleteUploadSessionFile: (...args: unknown[]) => deleteUploadSessionFile(...args),
  deleteUploadSession: (...args: unknown[]) => deleteUploadSession(...args),
}));

vi.mock("../runtime/audit.js", () => ({
  recordWorkerAuditEvent: (...args: unknown[]) => recordWorkerAuditEvent(...args),
}));

const { handleExpireUploadSession } = await import("./expire-upload-session.js");
const { InvalidJobDataError, RetryableWorkerError } = await import("../errors.js");

const SESSION_ID = "session-1";
const ORG_ID = "org-1";
const PROJECT_ID = "project-1";

function buildPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: "expire-upload-session" as const,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    idempotencyKey: "key-1",
    correlationId: "corr-1",
    submittedAt: new Date().toISOString(),
    uploadSessionId: SESSION_ID,
    ...overrides,
  };
}

function buildSessionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SESSION_ID,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    actorId: "actor-1",
    status: "uploaded",
    expiresAt: new Date(Date.now() - 60_000),
    ...overrides,
  };
}

function buildFileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "file-1",
    uploadSessionId: SESSION_ID,
    objectKey: "org-1/project-1/uploads/session-1/file-1",
    ...overrides,
  };
}

function buildContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    db: {},
    storage: {
      deleteProvisionalObject: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleExpireUploadSession", () => {
  it("rejects a confirmed session and never deletes it", async () => {
    requireUploadSession.mockResolvedValue(buildSessionRow({ status: "confirmed" }));

    await expect(
      handleExpireUploadSession(buildContext() as never, buildPayload()),
    ).rejects.toBeInstanceOf(InvalidJobDataError);

    expect(listUploadSessionFiles).not.toHaveBeenCalled();
    expect(deleteUploadSession).not.toHaveBeenCalled();
  });

  it("is a no-op for a pending session that has not yet passed its expiry time", async () => {
    requireUploadSession.mockResolvedValue(
      buildSessionRow({ status: "uploaded", expiresAt: new Date(Date.now() + 60_000) }),
    );

    await handleExpireUploadSession(buildContext() as never, buildPayload());

    expect(updateUploadSessionStatus).not.toHaveBeenCalled();
    expect(listUploadSessionFiles).not.toHaveBeenCalled();
  });

  it("transitions a past-due pending session to expired, then deletes objects and rows", async () => {
    requireUploadSession.mockResolvedValue(
      buildSessionRow({ status: "uploaded", expiresAt: new Date(Date.now() - 60_000) }),
    );
    listUploadSessionFiles.mockResolvedValue([buildFileRow()]);

    const context = buildContext();
    await handleExpireUploadSession(context as never, buildPayload());

    expect(updateUploadSessionStatus).toHaveBeenCalledWith(context.db, SESSION_ID, "expired");
    expect(context.storage.deleteProvisionalObject).toHaveBeenCalledWith({
      objectKey: "org-1/project-1/uploads/session-1/file-1",
    });
    expect(deleteUploadSessionFile).toHaveBeenCalledWith(context.db, "file-1");
    expect(deleteUploadSession).toHaveBeenCalledWith(context.db, SESSION_ID);
  });

  it("cleans up an already-expired session's objects then rows", async () => {
    requireUploadSession.mockResolvedValue(buildSessionRow({ status: "expired" }));
    listUploadSessionFiles.mockResolvedValue([buildFileRow(), buildFileRow({ id: "file-2" })]);

    const context = buildContext();
    await handleExpireUploadSession(context as never, buildPayload());

    expect(updateUploadSessionStatus).not.toHaveBeenCalled();
    expect(context.storage.deleteProvisionalObject).toHaveBeenCalledTimes(2);
    expect(deleteUploadSession).toHaveBeenCalledWith(context.db, SESSION_ID);
  });

  it("cleans up a canceled session the same way", async () => {
    requireUploadSession.mockResolvedValue(buildSessionRow({ status: "canceled" }));
    listUploadSessionFiles.mockResolvedValue([buildFileRow()]);

    await handleExpireUploadSession(buildContext() as never, buildPayload());

    expect(deleteUploadSession).toHaveBeenCalled();
  });

  it("treats an already-deleted object (OBJECT_NOT_FOUND) as fine and continues without an explicit row delete (cascade handles it)", async () => {
    requireUploadSession.mockResolvedValue(buildSessionRow({ status: "expired" }));
    listUploadSessionFiles.mockResolvedValue([buildFileRow()]);

    const context = buildContext({
      storage: {
        deleteProvisionalObject: vi
          .fn()
          .mockRejectedValue(new StorageError("OBJECT_NOT_FOUND", "not found")),
      },
    });

    await handleExpireUploadSession(context as never, buildPayload());

    // `source_upload_file.upload_session_id` cascades on delete, so an explicit per-file row
    // delete is unnecessary once the object is already gone; the session delete below cleans it up.
    expect(deleteUploadSessionFile).not.toHaveBeenCalled();
    expect(deleteUploadSession).toHaveBeenCalledWith(context.db, SESSION_ID);
  });

  it("throws a retryable error for other storage delete failures, without deleting the row", async () => {
    requireUploadSession.mockResolvedValue(buildSessionRow({ status: "expired" }));
    listUploadSessionFiles.mockResolvedValue([buildFileRow()]);

    const context = buildContext({
      storage: {
        deleteProvisionalObject: vi
          .fn()
          .mockRejectedValue(new StorageError("STORAGE_UNAVAILABLE", "minio down")),
      },
    });

    await expect(
      handleExpireUploadSession(context as never, buildPayload()),
    ).rejects.toBeInstanceOf(RetryableWorkerError);

    expect(deleteUploadSessionFile).not.toHaveBeenCalled();
    expect(deleteUploadSession).not.toHaveBeenCalled();
  });

  it("resumes correctly when some files were already removed from the DB in a prior attempt", async () => {
    requireUploadSession.mockResolvedValue(buildSessionRow({ status: "expired" }));
    listUploadSessionFiles.mockResolvedValue([]);

    const context = buildContext();
    await handleExpireUploadSession(context as never, buildPayload());

    expect(context.storage.deleteProvisionalObject).not.toHaveBeenCalled();
    expect(deleteUploadSession).toHaveBeenCalledWith(context.db, SESSION_ID);
  });
});
