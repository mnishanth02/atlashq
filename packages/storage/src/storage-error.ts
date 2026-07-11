export type StorageErrorCode =
  | "AUTHORIZATION_REQUIRED"
  | "INVALID_ENDPOINT"
  | "INVALID_UPLOAD_EXPIRY"
  | "INVALID_DOWNLOAD_EXPIRY"
  | "INVALID_OBJECT_KEY"
  | "INVALID_WRITE_RESULT"
  | "INVALID_CONTENT_HASH"
  | "OBJECT_NOT_FOUND"
  | "STORAGE_UNAVAILABLE"
  | "BUCKET_BOOTSTRAP_FAILED"
  | "BUCKET_VERSIONING_REQUIRED"
  | "PROVISIONAL_CLEANUP_FORBIDDEN";

export class StorageError extends Error {
  override readonly name = "StorageError";

  constructor(
    readonly code: StorageErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, string | number | boolean | null>>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
