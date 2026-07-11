import "reflect-metadata";
import { createAuth } from "@atlashq/auth";
import { loadApiEnv } from "@atlashq/config";
import { createDatabaseClient } from "@atlashq/db";
import { createApiApp } from "./app.factory.js";
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

  // Build the app through the shared factory so production and the integration
  // tests exercise the exact same middleware/body-parser/auth/prefix/filter stack.
  const app = await createApiApp({
    auth,
    db: databaseClient.db,
    webOrigin: env.WEB_ORIGIN,
    storage: sourceVaultRuntime?.storage ?? null,
    documentQueue: sourceVaultRuntime?.documentQueue ?? null,
    sourceVault: sourceVaultRuntime
      ? {
          SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES: env.SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES,
          SOURCE_UPLOAD_SESSION_TTL_SECONDS: env.SOURCE_UPLOAD_SESSION_TTL_SECONDS,
          SOURCE_UPLOAD_URL_TTL_SECONDS: env.SOURCE_UPLOAD_URL_TTL_SECONDS,
          SOURCE_DOWNLOAD_URL_TTL_SECONDS: env.SOURCE_DOWNLOAD_URL_TTL_SECONDS,
          S3_REQUIRE_BUCKET_VERSIONING: env.S3_REQUIRE_BUCKET_VERSIONING,
        }
      : null,
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
