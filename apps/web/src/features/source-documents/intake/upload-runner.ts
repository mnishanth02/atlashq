import AwsS3 from "@uppy/aws-s3";
import type { UppyFile } from "@uppy/core";
import Uppy from "@uppy/core";
import type { UploadSessionResponse } from "../sources-api";

export type UploadProgress = {
  fileId: string;
  sessionFileId: string;
  fileName: string;
  bytesUploaded: number;
  bytesTotal: number;
  percent: number;
  status: "queued" | "uploading" | "complete" | "error";
  errorMessage?: string;
};

export type UploaderCallbacks = {
  onProgress: (updates: UploadProgress[]) => void;
  onError: (message: string) => void;
  onAllComplete: () => void;
};

type PreparedFile = {
  file: File;
  sessionFileId: string;
  ordinal: number;
  signedUploadUrl: string;
  signedUploadUrlExpiresAt: string;
  declaredMimeType: string;
};

// We intentionally keep meta typed as the untyped default (`Record<string,
// unknown>`) so it composes cleanly with Uppy plugin generics, and read
// `sessionFileId` via a narrow cast at the boundary.
function readSessionFileId(
  file: Pick<UppyFile<Record<string, unknown>, Record<string, unknown>>, "meta">,
): string {
  const raw = (file.meta as { sessionFileId?: unknown } | undefined)?.sessionFileId;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Uppy file is missing its sessionFileId metadata");
  }
  return raw;
}

/**
 * Wire Uppy to a set of prepared upload URLs. Each file is uploaded via a
 * single-part signed PUT — no multipart, no Companion, no Tus. On completion,
 * caller confirms the upload session server-side.
 *
 * Files are correlated by `sessionFileId` (stored in Uppy file metadata), NOT
 * by filename — the API deliberately allows duplicate filenames within a
 * single reference session, and matching on the human-readable name would
 * mis-route the second identical filename to the first signed URL.
 */
export function createSessionUploader(
  prepared: readonly PreparedFile[],
  callbacks: UploaderCallbacks,
) {
  const uppy = new Uppy({
    autoProceed: false,
    allowMultipleUploadBatches: false,
    restrictions: { allowedFileTypes: null },
  });

  const bySessionFileId = new Map(
    prepared.map((p) => [
      p.sessionFileId,
      {
        url: p.signedUploadUrl,
        mime: p.declaredMimeType,
      },
    ]),
  );

  uppy.use(AwsS3, {
    shouldUseMultipart: false,
    async getUploadParameters(file) {
      const sessionFileId = readSessionFileId(file);
      const entry = bySessionFileId.get(sessionFileId);
      if (!entry) {
        throw new Error(`No signed URL for session file ${sessionFileId}`);
      }
      return {
        method: "PUT" as const,
        url: entry.url,
        headers: {
          "content-type": entry.mime,
        },
      };
    },
  });

  const progressByFile = new Map<string, UploadProgress>();

  prepared.forEach((p) => {
    const id = uppy.addFile({
      name: p.file.name,
      type: p.declaredMimeType,
      data: p.file,
      meta: { sessionFileId: p.sessionFileId, ordinal: p.ordinal },
    });
    progressByFile.set(id, {
      fileId: id,
      sessionFileId: p.sessionFileId,
      fileName: p.file.name,
      bytesUploaded: 0,
      bytesTotal: p.file.size,
      percent: 0,
      status: "queued",
    });
  });

  const emit = () => callbacks.onProgress(Array.from(progressByFile.values()));

  uppy.on("upload-progress", (file, progress) => {
    if (!file) return;
    const current = progressByFile.get(file.id);
    if (!current) return;
    const bytesUploaded = progress.bytesUploaded ?? 0;
    const bytesTotal = progress.bytesTotal ?? current.bytesTotal;
    progressByFile.set(file.id, {
      ...current,
      bytesUploaded,
      bytesTotal,
      percent: bytesTotal > 0 ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)) : 0,
      status: "uploading",
    });
    emit();
  });

  uppy.on("upload-success", (file) => {
    if (!file) return;
    const current = progressByFile.get(file.id);
    if (!current) return;
    progressByFile.set(file.id, {
      ...current,
      status: "complete",
      percent: 100,
      bytesUploaded: current.bytesTotal,
    });
    emit();
  });

  uppy.on("upload-error", (file, error) => {
    if (!file) return;
    const current = progressByFile.get(file.id);
    if (!current) return;
    const message = error instanceof Error ? error.message : "Upload failed";
    progressByFile.set(file.id, {
      ...current,
      status: "error",
      errorMessage: message,
    });
    emit();
    callbacks.onError(message);
  });

  uppy.on("complete", (result) => {
    if ((result.failed?.length ?? 0) === 0) {
      callbacks.onAllComplete();
    }
  });

  return {
    start: () => uppy.upload(),
    cancel: () => uppy.cancelAll(),
    destroy: () => {
      uppy.cancelAll();
      uppy.destroy();
    },
    uppy,
  };
}

/**
 * Recompute prepared files from an in-progress session (used when a user
 * reopens the intake sheet after refresh). The session already contains its
 * files array with signedUploadUrl values — we pair them with the File
 * objects the user re-selected from disk by matching *ordinal position*.
 * Filenames are never used for correlation because a screenshot set may
 * intentionally contain duplicate names.
 */
export function preparedFilesFromSession(
  session: UploadSessionResponse,
  files: readonly File[],
): PreparedFile[] {
  return session.files
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((sessionFile) => {
      const file = files[sessionFile.ordinal];
      if (!file) return null;
      return {
        file,
        sessionFileId: sessionFile.id,
        ordinal: sessionFile.ordinal,
        signedUploadUrl: sessionFile.signedUploadUrl,
        signedUploadUrlExpiresAt: sessionFile.signedUploadUrlExpiresAt,
        declaredMimeType: sessionFile.declaredMimeType,
      } satisfies PreparedFile;
    })
    .filter((p): p is PreparedFile => p !== null);
}

export type { PreparedFile };
