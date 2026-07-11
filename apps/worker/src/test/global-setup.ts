import { createDatabaseClient, migrateDatabase } from "@atlashq/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

/**
 * Minimal shape of the Vitest global-setup context we rely on. Vitest 4 no longer exports a
 * `GlobalSetupContext` type from `vitest/node`, so the `provide` channel is typed locally against
 * the augmented {@link ProvidedContext} below (mirrors `apps/api/src/test/global-setup.ts`).
 */
type IntegrationGlobalSetupContext = {
  provide: (key: "workerIntegrationEnv", value: WorkerIntegrationEnv) => void;
};

export type WorkerIntegrationEnv = {
  DATABASE_URL: string;
  REDIS_URL: string;
  S3_ENDPOINT: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_BUCKET: string;
  CLAMAV_HOST: string;
  CLAMAV_PORT: string;
};

// Pinned to the same image tags as docker-compose.yml so the integration suite exercises the
// exact versions the app runs against in every other environment.
const POSTGRES_IMAGE = "postgres:17-alpine";
const REDIS_IMAGE = "redis:8-alpine";
const MINIO_IMAGE = "minio/minio:RELEASE.2025-09-07T16-13-09Z";
const CLAMAV_IMAGE = "clamav/clamav:1.5.3-debian13-slim";

const MINIO_ACCESS_KEY_ID = "worker-integration-minio-access";
const MINIO_SECRET_ACCESS_KEY = "worker-integration-minio-secret";
const MINIO_BUCKET = "atlashq-worker-integration";

let postgres: StartedPostgreSqlContainer | undefined;
let redis: StartedTestContainer | undefined;
let minio: StartedTestContainer | undefined;
let clamav: StartedTestContainer | undefined;

/**
 * Starts disposable Postgres/Redis/MinIO/ClamAV containers once for the whole worker integration
 * suite (module-02 §9, §10) and shares connection info with every `*.integration.test.ts` file
 * through Vitest's `provide`/`inject` channel. This exercises the real infrastructure wiring
 * (`createWorkerRuntimeContext`, `getWorkerHealth`, bucket bootstrap, ClamAV INSTREAM) that the
 * 130+ unit tests intentionally fake, without re-testing handler business logic.
 */
export default async function setup({
  provide,
}: IntegrationGlobalSetupContext): Promise<() => Promise<void>> {
  [postgres, redis, minio, clamav] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase("atlashq_worker_test").start(),
    new GenericContainer(REDIS_IMAGE)
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/u))
      .start(),
    new GenericContainer(MINIO_IMAGE)
      .withCommand(["server", "/data"])
      .withEnvironment({
        MINIO_ROOT_USER: MINIO_ACCESS_KEY_ID,
        MINIO_ROOT_PASSWORD: MINIO_SECRET_ACCESS_KEY,
      })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp("/minio/health/live", 9000))
      .start(),
    new GenericContainer(CLAMAV_IMAGE)
      .withExposedPorts(3310)
      // ClamAV needs real time to load its bundled signature database before clamd's socket is
      // ready; this exact log line is what docker-compose's own healthcheck effectively waits on.
      .withWaitStrategy(Wait.forLogMessage(/socket found, clamd started\.?/u))
      .withStartupTimeout(180_000)
      .start(),
  ]);

  const connectionString = postgres.getConnectionUri();
  const databaseClient = createDatabaseClient({ connectionString });
  try {
    await migrateDatabase(databaseClient);
  } finally {
    await databaseClient.close();
  }

  provide("workerIntegrationEnv", {
    DATABASE_URL: connectionString,
    REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
    S3_ENDPOINT: `http://${minio.getHost()}:${minio.getMappedPort(9000)}`,
    S3_ACCESS_KEY_ID: MINIO_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: MINIO_SECRET_ACCESS_KEY,
    S3_BUCKET: MINIO_BUCKET,
    CLAMAV_HOST: clamav.getHost(),
    CLAMAV_PORT: String(clamav.getMappedPort(3310)),
  });

  return async () => {
    await Promise.allSettled([postgres?.stop(), redis?.stop(), minio?.stop(), clamav?.stop()]);
    postgres = undefined;
    redis = undefined;
    minio = undefined;
    clamav = undefined;
  };
}

declare module "vitest" {
  interface ProvidedContext {
    workerIntegrationEnv: WorkerIntegrationEnv;
  }
}
