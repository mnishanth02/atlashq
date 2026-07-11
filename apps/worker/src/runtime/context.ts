import { loadWorkerEnv, type WorkerEnv } from "@atlashq/config";
import { createDatabaseClient, type Database, type DatabaseClient } from "@atlashq/db";
import {
  type ClamAvClient,
  createClamAvClient,
  createMinioStorageClient,
  type MinioObjectStorageClient,
} from "@atlashq/storage";
import type { CaptureAdapter } from "../capture/capture-adapter.js";
import { createPlaywrightCaptureAdapter } from "../capture/playwright-adapter.js";

/**
 * Redis connection options shared by every BullMQ `Queue`/`Worker` instance. `maxRetriesPerRequest:
 * null` is required by BullMQ so blocking commands are never abandoned mid-poll.
 */
export type WorkerRedisConnection = {
  url: string;
  maxRetriesPerRequest: null;
};

/**
 * Fully wired worker runtime: validated env, database client, MinIO-compatible storage client,
 * ClamAV client, and the (feature-flagged) reference capture adapter. Built once at boot (see
 * `main.ts`) and threaded through every job handler so handlers never read `process.env` or
 * construct their own infrastructure clients, which keeps them trivially testable with fakes.
 */
export type WorkerRuntimeContext = {
  env: WorkerEnv;
  db: Database;
  databaseClient: DatabaseClient;
  storage: MinioObjectStorageClient;
  clamav: ClamAvClient;
  redisConnection: WorkerRedisConnection;
  /**
   * One-page reference capture (module-02 §6.8) is feature-flagged off by default. `@atlashq/config`
   * does not model this flag (it is worker-local, not shared with the API), so it is read directly
   * from the raw env input rather than through `loadWorkerEnv`.
   */
  captureEnabled: boolean;
  captureAdapter: CaptureAdapter;
  close(): Promise<void>;
};

export function createWorkerRuntimeContext(
  input: Record<string, unknown> = process.env,
): WorkerRuntimeContext {
  const env = loadWorkerEnv(input);
  const databaseClient = createDatabaseClient({ connectionString: env.DATABASE_URL });
  const storage = createMinioStorageClient({
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
  });
  const clamav = createClamAvClient({
    host: env.CLAMAV_HOST,
    port: env.CLAMAV_PORT,
    timeoutMs: env.CLAMAV_TIMEOUT_MS,
  });

  return {
    env,
    db: databaseClient.db,
    databaseClient,
    storage,
    clamav,
    redisConnection: { url: env.REDIS_URL, maxRetriesPerRequest: null },
    captureEnabled: input.REFERENCE_CAPTURE_ENABLED === "true",
    captureAdapter: createPlaywrightCaptureAdapter(),
    async close() {
      await databaseClient.close();
    },
  };
}
