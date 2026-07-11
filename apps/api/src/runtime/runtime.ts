import type { Auth } from "@atlashq/auth";
import type { SourceVaultEnv } from "@atlashq/config";
import type { Database } from "@atlashq/db";
import type { MinioObjectStorageClient } from "@atlashq/storage";
import type { SourceDocumentQueue } from "./source-vault-runtime.js";

/**
 * Runtime values that are composed lazily in `main.ts` from validated env and
 * injected into the Nest module. They are `null` for offline tooling (OpenAPI
 * document generation) so that building the module never opens a database
 * connection, requires auth secrets, or reaches out to MinIO/Redis.
 *
 * `storage`, `documentQueue`, and `sourceVault` are optional so the core
 * Module 1 app can boot without S3/BullMQ: the Source Vault feature module
 * returns stable `SOURCE_STORAGE_UNAVAILABLE` errors on write paths when they
 * are absent, and read paths that do not require storage stay available.
 */
export type ApiRuntime = {
  auth: Auth | null;
  db: Database | null;
  storage?: MinioObjectStorageClient | null;
  documentQueue?: SourceDocumentQueue | null;
  sourceVault?: SourceVaultEnv | null;
};

export const NULL_RUNTIME: ApiRuntime = {
  auth: null,
  db: null,
  storage: null,
  documentQueue: null,
  sourceVault: null,
};

/** Injection token for the composed Better Auth instance (`Auth | null`). */
export const AUTH_INSTANCE = "ATLASHQ_AUTH_INSTANCE";

/** Injection token for the composed Drizzle database client (`Database | null`). */
export const DATABASE_CLIENT = "ATLASHQ_DATABASE_CLIENT";

/** Injection token for the organization-scoped project access query boundary. */
export const PROJECT_ACCESS_QUERIES = "ATLASHQ_PROJECT_ACCESS_QUERIES";

/** Injection token for the read-only auth directory (fresh user/org lookups). */
export const AUTH_DIRECTORY = "ATLASHQ_AUTH_DIRECTORY";

/**
 * Injection token for the MinIO-compatible storage client (`MinioObjectStorageClient | null`).
 * `null` when the API boots without S3 (e.g., core-only rollout or OpenAPI generation);
 * source-vault write paths degrade with the stable `SOURCE_STORAGE_UNAVAILABLE` error.
 */
export const SOURCE_STORAGE = "ATLASHQ_SOURCE_STORAGE";

/**
 * Injection token for the source-document processing queue (`SourceDocumentQueue | null`).
 * `null` in offline mode; the service falls back to the same unavailable error as storage.
 */
export const SOURCE_DOCUMENT_QUEUE = "ATLASHQ_SOURCE_DOCUMENT_QUEUE";

/**
 * Injection token for the validated Source Vault environment (`SourceVaultEnv | null`).
 * Carries the upload size / session TTL / signed URL TTL config; `null` for offline mode.
 */
export const SOURCE_VAULT_CONFIG = "ATLASHQ_SOURCE_VAULT_CONFIG";
