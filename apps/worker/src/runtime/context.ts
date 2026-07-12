import type { ProviderRegistry } from "@atlashq/ai";
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
import {
  type AiProviderRuntimeConfig,
  createAiProviderRegistry,
} from "../requirement-analysis/provider-runtime.js";

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
  /**
   * Wired from whichever of `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/openai-compatible base URL are
   * actually configured (module-03 §7.1, worker task item 1: "no automatic fallback") -- a run
   * whose frozen policy resolves to a provider that was never registered here fails fast from
   * `@atlashq/ai`'s `ProviderRegistry` instead of silently falling back to a different one.
   */
  aiProviderRegistry: ProviderRegistry;
  /** Feature flags read once at boot so handlers never read `process.env` directly (task item 1). */
  featureFlags: {
    referenceFeatureExtractionEnabled: boolean;
  };
  /** Per-queue BullMQ concurrency; `@atlashq/config` only models `WORKER_CONCURRENCY` (module-02's
   * document-processing default), so the Module 3 queues' concurrency is worker-local raw env,
   * mirroring `captureEnabled`'s convention below. */
  aiAnalysisQueueConcurrency: number;
  citationVerificationQueueConcurrency: number;
  close(): Promise<void>;
};

export async function createWorkerRuntimeContext(
  input: Record<string, unknown> = process.env,
): Promise<WorkerRuntimeContext> {
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

  const providerConfig: AiProviderRuntimeConfig = {};
  if (env.OPENAI_API_KEY) {
    providerConfig.openai = { apiKey: env.OPENAI_API_KEY };
  }
  if (env.ANTHROPIC_API_KEY) {
    providerConfig.anthropic = { apiKey: env.ANTHROPIC_API_KEY };
  }
  const openAiCompatibleBaseUrl =
    typeof input.AI_ANALYSIS_OPENAI_COMPATIBLE_BASE_URL === "string"
      ? input.AI_ANALYSIS_OPENAI_COMPATIBLE_BASE_URL
      : undefined;
  if (openAiCompatibleBaseUrl) {
    const openAiCompatibleApiKey =
      typeof input.AI_ANALYSIS_OPENAI_COMPATIBLE_API_KEY === "string"
        ? input.AI_ANALYSIS_OPENAI_COMPATIBLE_API_KEY
        : undefined;
    providerConfig.openAiCompatible = {
      baseUrl: openAiCompatibleBaseUrl,
      ...(openAiCompatibleApiKey ? { apiKey: openAiCompatibleApiKey } : {}),
    };
  }
  const aiProviderRegistry = await createAiProviderRegistry(providerConfig);

  const aiAnalysisQueueConcurrency =
    typeof input.AI_ANALYSIS_QUEUE_CONCURRENCY === "string"
      ? Number.parseInt(input.AI_ANALYSIS_QUEUE_CONCURRENCY, 10)
      : env.WORKER_CONCURRENCY;
  const citationVerificationQueueConcurrency =
    typeof input.CITATION_VERIFICATION_QUEUE_CONCURRENCY === "string"
      ? Number.parseInt(input.CITATION_VERIFICATION_QUEUE_CONCURRENCY, 10)
      : env.WORKER_CONCURRENCY;

  return {
    env,
    db: databaseClient.db,
    databaseClient,
    storage,
    clamav,
    redisConnection: { url: env.REDIS_URL, maxRetriesPerRequest: null },
    captureEnabled: input.REFERENCE_CAPTURE_ENABLED === "true",
    captureAdapter: createPlaywrightCaptureAdapter(),
    aiProviderRegistry,
    featureFlags: {
      referenceFeatureExtractionEnabled: env.AI_REFERENCE_FEATURE_EXTRACTION_ENABLED,
    },
    aiAnalysisQueueConcurrency,
    citationVerificationQueueConcurrency,
    async close() {
      await databaseClient.close();
    },
  };
}
