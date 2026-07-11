import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");
const logLevelSchema = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  .default("info");
const urlSchema = z.string().url();
const frontendApiBaseUrlSchema = z.union([z.literal(""), urlSchema]);
const optionalSecretSchema = z.string().min(1).optional();
const booleanEnvSchema = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .transform((value) => value === true || value === "true");

export const storageEnvSchema = z.object({
  S3_ENDPOINT: urlSchema,
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
});

const storageEnvKeys = [
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
] as const;

export const webEnvSchema = z
  .object({
    VITE_API_BASE_URL: frontendApiBaseUrlSchema.default(""),
    VITE_APP_NAME: z.string().min(1).default("AtlasHQ"),
  })
  .strict();

const apiStorageEnvSchema = storageEnvSchema.partial().superRefine((storageEnv, ctx) => {
  const providedStorageKeyCount = storageEnvKeys.filter(
    (key) => storageEnv[key] !== undefined,
  ).length;

  if (providedStorageKeyCount === 0 || providedStorageKeyCount === storageEnvKeys.length) {
    return;
  }

  for (const key of storageEnvKeys) {
    if (storageEnv[key] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: "Storage env requires all S3 fields when any S3 field is set.",
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Module 2: Source Document Vault environment contracts (module-02 §9, §14 Phase 1)
// ---------------------------------------------------------------------------

/** Signed PUT URLs never exceed 15 minutes (module-02 §9.1). */
const SOURCE_UPLOAD_URL_MAX_TTL_SECONDS = 15 * 60;
/** Signed GET URLs default to 10 minutes and never exceed 60 minutes (module-02 §9.1). */
const SOURCE_DOWNLOAD_URL_DEFAULT_TTL_SECONDS = 10 * 60;
const SOURCE_DOWNLOAD_URL_MAX_TTL_SECONDS = 60 * 60;

/**
 * Upload size/session/signed-URL/bucket-versioning config shared by the API (which validates and
 * signs uploads) and the worker (which enforces upload-session expiry and readiness). All fields
 * default so this group never participates in the S3 optional-all-or-none rule below.
 */
export const sourceVaultEnvSchema = z.object({
  SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(100 * 1024 * 1024),
  SOURCE_UPLOAD_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 60 * 60),
  SOURCE_UPLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(SOURCE_UPLOAD_URL_MAX_TTL_SECONDS)
    .default(SOURCE_UPLOAD_URL_MAX_TTL_SECONDS),
  SOURCE_DOWNLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(SOURCE_DOWNLOAD_URL_MAX_TTL_SECONDS)
    .default(SOURCE_DOWNLOAD_URL_DEFAULT_TTL_SECONDS),
  S3_REQUIRE_BUCKET_VERSIONING: booleanEnvSchema.default(true),
});

/** ClamAV streaming-scan client config (module-02 §9.3); only the worker scans uploaded bytes. */
export const clamAvEnvSchema = z.object({
  CLAMAV_HOST: z.string().min(1).default("clamav"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

/** One-page reference capture resource/time bounds (module-02 §6.8); worker-only, Playwright. */
export const referenceCaptureEnvSchema = z.object({
  REFERENCE_CAPTURE_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  REFERENCE_CAPTURE_MAX_REDIRECTS: z.coerce.number().int().min(0).default(5),
  REFERENCE_CAPTURE_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(25 * 1024 * 1024),
  REFERENCE_CAPTURE_MAX_TOTAL_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(75 * 1024 * 1024),
});

export const apiEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: urlSchema,
    AUTH_SECRET: z.string().min(32),
    AUTH_URL: urlSchema,
    WEB_ORIGIN: urlSchema,
    LOG_LEVEL: logLevelSchema,
  })
  .and(apiStorageEnvSchema)
  .and(sourceVaultEnvSchema);

export const workerEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    DATABASE_URL: z.string().min(1),
    REDIS_URL: urlSchema,
    OPENAI_API_KEY: optionalSecretSchema,
    ANTHROPIC_API_KEY: optionalSecretSchema,
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
    LOG_LEVEL: logLevelSchema,
  })
  .and(storageEnvSchema)
  .and(sourceVaultEnvSchema)
  .and(clamAvEnvSchema)
  .and(referenceCaptureEnvSchema);

export type WebEnv = z.infer<typeof webEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type SourceVaultEnv = z.infer<typeof sourceVaultEnvSchema>;
export type ClamAvEnv = z.infer<typeof clamAvEnvSchema>;
export type ReferenceCaptureEnv = z.infer<typeof referenceCaptureEnvSchema>;

export function loadWebEnv(input: Record<string, unknown>): WebEnv {
  return webEnvSchema.parse(input);
}

export function loadApiEnv(input: Record<string, unknown>): ApiEnv {
  return apiEnvSchema.parse(input);
}

export function loadWorkerEnv(input: Record<string, unknown>): WorkerEnv {
  return workerEnvSchema.parse(input);
}
