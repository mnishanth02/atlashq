import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");
const logLevelSchema = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  .default("info");
const urlSchema = z.string().url();
const frontendApiBaseUrlSchema = z.union([z.literal(""), urlSchema]);
const optionalSecretSchema = z.string().min(1).optional();

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
  .and(apiStorageEnvSchema);

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
  .and(storageEnvSchema);

export type WebEnv = z.infer<typeof webEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWebEnv(input: Record<string, unknown>): WebEnv {
  return webEnvSchema.parse(input);
}

export function loadApiEnv(input: Record<string, unknown>): ApiEnv {
  return apiEnvSchema.parse(input);
}

export function loadWorkerEnv(input: Record<string, unknown>): WorkerEnv {
  return workerEnvSchema.parse(input);
}
