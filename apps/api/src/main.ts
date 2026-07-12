import "reflect-metadata";
import { createAuth } from "@atlashq/auth";
import { loadApiEnv } from "@atlashq/config";
import { createDatabaseClient } from "@atlashq/db";
import { createApiApp } from "./app.factory.js";
import { createBullMqRequirementAnalysisQueue } from "./runtime/requirement-analysis-runtime.js";
import { composeSourceVaultRuntime } from "./runtime/source-vault-runtime.js";

async function bootstrap() {
  const env = loadApiEnv(process.env);

  // Lazily create the database client and Better Auth instance from validated
  // env. Nothing here runs at module import time, so offline tooling is safe.
  const databaseClient = createDatabaseClient({ connectionString: env.DATABASE_URL });
  const auth = createAuth({ db: databaseClient.db, env });

  // Compose Source Vault runtime (MinIO + BullMQ) only when the full S3 credential set is present.
  const s3Configured =
    env.S3_ENDPOINT !== undefined &&
    env.S3_ACCESS_KEY_ID !== undefined &&
    env.S3_SECRET_ACCESS_KEY !== undefined &&
    env.S3_BUCKET !== undefined;
  const sourceVaultRuntime = s3Configured
    ? composeSourceVaultRuntime({
        storageEnv: {
          endpoint: env.S3_ENDPOINT as string,
          accessKeyId: env.S3_ACCESS_KEY_ID as string,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
          bucket: env.S3_BUCKET as string,
        },
        sourceVault: {
          SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES: env.SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES,
          SOURCE_UPLOAD_SESSION_TTL_SECONDS: env.SOURCE_UPLOAD_SESSION_TTL_SECONDS,
          SOURCE_UPLOAD_URL_TTL_SECONDS: env.SOURCE_UPLOAD_URL_TTL_SECONDS,
          SOURCE_DOWNLOAD_URL_TTL_SECONDS: env.SOURCE_DOWNLOAD_URL_TTL_SECONDS,
          S3_REQUIRE_BUCKET_VERSIONING: env.S3_REQUIRE_BUCKET_VERSIONING,
        },
        redisUrl: env.REDIS_URL,
      })
    : null;
  const analysisQueue = createBullMqRequirementAnalysisQueue(env.REDIS_URL);

  // Build the app through the shared factory so production and the integration
  // tests exercise the exact same middleware/body-parser/auth/prefix/filter stack.
  const app = await createApiApp({
    auth,
    db: databaseClient.db,
    webOrigin: env.WEB_ORIGIN,
    storage: sourceVaultRuntime?.storage ?? null,
    documentQueue: sourceVaultRuntime?.documentQueue ?? null,
    analysisQueue,
    sourceVault: sourceVaultRuntime
      ? {
          SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES: env.SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES,
          SOURCE_UPLOAD_SESSION_TTL_SECONDS: env.SOURCE_UPLOAD_SESSION_TTL_SECONDS,
          SOURCE_UPLOAD_URL_TTL_SECONDS: env.SOURCE_UPLOAD_URL_TTL_SECONDS,
          SOURCE_DOWNLOAD_URL_TTL_SECONDS: env.SOURCE_DOWNLOAD_URL_TTL_SECONDS,
          S3_REQUIRE_BUCKET_VERSIONING: env.S3_REQUIRE_BUCKET_VERSIONING,
        }
      : null,
    aiRequirementAnalysis: {
      AI_REQUIREMENT_ANALYSIS_ENABLED: env.AI_REQUIREMENT_ANALYSIS_ENABLED,
      AI_MODEL_CALLS_ENABLED: env.AI_MODEL_CALLS_ENABLED,
      AI_REFERENCE_FEATURE_EXTRACTION_ENABLED: env.AI_REFERENCE_FEATURE_EXTRACTION_ENABLED,
      AI_EVAL_GATE_REQUIRED: env.AI_EVAL_GATE_REQUIRED,
      AI_ANALYSIS_READS_ENABLED: env.AI_ANALYSIS_READS_ENABLED,
      AI_ANALYSIS_MAX_USD_PER_RUN: env.AI_ANALYSIS_MAX_USD_PER_RUN,
      AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN: env.AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN,
      AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN: env.AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN,
      AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS: env.AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS,
      AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT: env.AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT,
      AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION:
        env.AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION,
      AI_ANALYSIS_DEFAULT_PROVIDER: env.AI_ANALYSIS_DEFAULT_PROVIDER,
      AI_ANALYSIS_DEFAULT_MODEL_ALIAS: env.AI_ANALYSIS_DEFAULT_MODEL_ALIAS,
      AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID: env.AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID,
      AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE: env.AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE,
      AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY: env.AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY,
      AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK: env.AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK,
      AI_ANALYSIS_LOG_PROMPTS: env.AI_ANALYSIS_LOG_PROMPTS,
      AI_ANALYSIS_LOG_SOURCE_CHUNKS: env.AI_ANALYSIS_LOG_SOURCE_CHUNKS,
      AI_ANALYSIS_LOG_MODEL_OUTPUTS: env.AI_ANALYSIS_LOG_MODEL_OUTPUTS,
      AI_ANALYSIS_REDACT_SIGNED_URLS: env.AI_ANALYSIS_REDACT_SIGNED_URLS,
      AI_ANALYSIS_SAFE_DISABLED_BEHAVIOR: env.AI_ANALYSIS_SAFE_DISABLED_BEHAVIOR,
    },
  });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    app.flushLogs();

    try {
      await app.close();
      if (sourceVaultRuntime) {
        await sourceVaultRuntime.documentQueue.close();
      }
      await analysisQueue.close();
      await databaseClient.close();
    } finally {
      process.removeListener("SIGTERM", onSignal);
      process.removeListener("SIGINT", onSignal);
      process.kill(process.pid, signal);
    }
  };

  const onSignal = (signal: NodeJS.Signals) => {
    void shutdown(signal);
  };

  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);

  await app.listen(env.PORT);
}

void bootstrap();
