import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");
const logLevelSchema = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  .default("info");
const urlSchema = z.string().url();
const frontendApiBaseUrlSchema = z.union([z.literal(""), urlSchema]);
const optionalSecretSchema = z.string().min(1).optional();
const booleanEnvSchema = z
  .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
  .transform((value) => value === true || value === "true" || value === "1");

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
    VITE_AI_REQUIREMENT_ANALYSIS_ENABLED: booleanEnvSchema.default(false),
    VITE_AI_ANALYSIS_READS_ENABLED: booleanEnvSchema.default(true),
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

// ---------------------------------------------------------------------------
// Module 3: AI Requirement Analyzer environment contracts (module-03 §7, §20)
// ---------------------------------------------------------------------------

export const aiRequirementAnalysisFeatureFlagEnvSchema = z.object({
  AI_REQUIREMENT_ANALYSIS_ENABLED: booleanEnvSchema.default(false),
  AI_MODEL_CALLS_ENABLED: booleanEnvSchema.default(false),
  AI_REFERENCE_FEATURE_EXTRACTION_ENABLED: booleanEnvSchema.default(false),
  AI_EVAL_GATE_REQUIRED: booleanEnvSchema.default(true),
  AI_ANALYSIS_READS_ENABLED: booleanEnvSchema.default(true),
});

export const aiRequirementAnalysisBudgetEnvSchema = z.object({
  AI_ANALYSIS_MAX_USD_PER_RUN: z.coerce.number().positive().default(3),
  AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN: z.coerce.number().int().positive().default(300_000),
  AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN: z.coerce.number().int().positive().default(30_000),
  AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS: z.coerce.number().int().positive().default(1_800),
  AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT: z.coerce.number().int().positive().default(1),
  AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION: z.coerce.number().int().positive().default(3),
});

const aiSdkProviderValues = ["openai", "anthropic", "openai-compatible", "local"] as const;
const aiDataRetentionModeValues = ["provider_default", "no_training", "zero_retention"] as const;
const aiProviderSelectionStrategyValues = ["explicit_policy_only"] as const;
const aiSafeDisabledBehaviorValues = ["reject_new_runs_preserve_reads"] as const;

export const aiRequirementAnalysisProviderEnvSchema = z.object({
  AI_ANALYSIS_DEFAULT_PROVIDER: z.enum(aiSdkProviderValues).default("openai"),
  AI_ANALYSIS_DEFAULT_MODEL_ALIAS: z.string().trim().min(1).default("gpt-4o-mini"),
  AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID: z.string().trim().min(1).default("gpt-4o-mini"),
  AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE: z
    .enum(aiDataRetentionModeValues)
    .default("provider_default"),
  AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY: z
    .enum(aiProviderSelectionStrategyValues)
    .default("explicit_policy_only"),
  AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK: booleanEnvSchema.default(true),
});

export const aiRequirementAnalysisDataHandlingEnvSchema = z.object({
  AI_ANALYSIS_LOG_PROMPTS: booleanEnvSchema.default(false),
  AI_ANALYSIS_LOG_SOURCE_CHUNKS: booleanEnvSchema.default(false),
  AI_ANALYSIS_LOG_MODEL_OUTPUTS: booleanEnvSchema.default(false),
  AI_ANALYSIS_REDACT_SIGNED_URLS: booleanEnvSchema.default(true),
  AI_ANALYSIS_SAFE_DISABLED_BEHAVIOR: z
    .enum(aiSafeDisabledBehaviorValues)
    .default("reject_new_runs_preserve_reads"),
});

export const aiRequirementAnalysisLogRetentionEnvSchema = z.object({
  AI_ANALYSIS_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

export const aiRequirementAnalysisEnvSchema = aiRequirementAnalysisFeatureFlagEnvSchema
  .and(aiRequirementAnalysisBudgetEnvSchema)
  .and(aiRequirementAnalysisProviderEnvSchema)
  .and(aiRequirementAnalysisDataHandlingEnvSchema)
  .and(aiRequirementAnalysisLogRetentionEnvSchema);

export const aiRequirementAnalysisDefaults = {
  featureFlags: {
    aiRequirementAnalysisEnabled: false,
    aiModelCallsEnabled: false,
    aiReferenceFeatureExtractionEnabled: false,
    aiEvalGateRequired: true,
    aiAnalysisReadsEnabled: true,
  },
  budgets: {
    maxUsdPerRun: 3,
    maxInputTokensPerRun: 300_000,
    maxOutputTokensPerRun: 30_000,
    maxWallClockSeconds: 1_800,
    maxActiveRunsPerProject: 1,
    maxActiveRunsPerOrganization: 3,
  },
  providerSelection: {
    provider: "openai",
    modelAlias: "gpt-4o-mini",
    resolvedModelId: "gpt-4o-mini",
    dataRetentionMode: "provider_default",
    strategy: "explicit_policy_only",
    disableAutomaticFallback: true,
  },
  dataHandling: {
    logPrompts: false,
    logSourceChunks: false,
    logModelOutputs: false,
    redactSignedUrls: true,
    safeDisabledBehavior: "reject_new_runs_preserve_reads",
  },
  logRetentionDays: 30,
} as const;

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
  .and(sourceVaultEnvSchema)
  .and(aiRequirementAnalysisEnvSchema);

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
  .and(referenceCaptureEnvSchema)
  .and(aiRequirementAnalysisEnvSchema);

export type WebEnv = z.infer<typeof webEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type SourceVaultEnv = z.infer<typeof sourceVaultEnvSchema>;
export type ClamAvEnv = z.infer<typeof clamAvEnvSchema>;
export type ReferenceCaptureEnv = z.infer<typeof referenceCaptureEnvSchema>;
export type AiRequirementAnalysisFeatureFlagEnv = z.infer<
  typeof aiRequirementAnalysisFeatureFlagEnvSchema
>;
export type AiRequirementAnalysisBudgetEnv = z.infer<typeof aiRequirementAnalysisBudgetEnvSchema>;
export type AiRequirementAnalysisProviderEnv = z.infer<
  typeof aiRequirementAnalysisProviderEnvSchema
>;
export type AiRequirementAnalysisDataHandlingEnv = z.infer<
  typeof aiRequirementAnalysisDataHandlingEnvSchema
>;
export type AiRequirementAnalysisLogRetentionEnv = z.infer<
  typeof aiRequirementAnalysisLogRetentionEnvSchema
>;
export type AiRequirementAnalysisEnv = z.infer<typeof aiRequirementAnalysisEnvSchema>;

export function loadWebEnv(input: Record<string, unknown>): WebEnv {
  return webEnvSchema.parse(input);
}

export function loadApiEnv(input: Record<string, unknown>): ApiEnv {
  return apiEnvSchema.parse(input);
}

export function loadWorkerEnv(input: Record<string, unknown>): WorkerEnv {
  return workerEnvSchema.parse(input);
}
