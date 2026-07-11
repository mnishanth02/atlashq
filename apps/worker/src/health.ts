import { Redis } from "ioredis";
import { queueNames } from "./queues.js";
import type { WorkerRuntimeContext } from "./runtime/context.js";

export type WorkerHealthCheckName = "database" | "redis" | "storage" | "clamav";

export type WorkerHealthCheckResult = {
  name: WorkerHealthCheckName;
  ok: boolean;
  /** Human-readable detail; deliberately excludes connection strings/credentials/hosts. */
  detail?: string;
};

export type WorkerHealth = {
  status: "ok" | "degraded";
  service: "worker";
  queues: typeof queueNames;
  checks: WorkerHealthCheckResult[];
};

const HEALTH_CHECK_TIMEOUT_MS = 2_000;

async function checkDatabase(context: WorkerRuntimeContext): Promise<WorkerHealthCheckResult> {
  try {
    await withTimeout(context.databaseClient.pool.query("SELECT 1"), HEALTH_CHECK_TIMEOUT_MS);
    return { name: "database", ok: true };
  } catch (error) {
    return {
      name: "database",
      ok: false,
      detail: error instanceof Error && error.message === "timeout" ? "timeout" : "query failed",
    };
  }
}

async function checkRedis(context: WorkerRuntimeContext): Promise<WorkerHealthCheckResult> {
  const client = new Redis(context.redisConnection.url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 5_000,
  });

  try {
    await withTimeout(client.connect(), HEALTH_CHECK_TIMEOUT_MS);
    const pong = await withTimeout(client.ping(), HEALTH_CHECK_TIMEOUT_MS);
    return { name: "redis", ok: pong === "PONG" };
  } catch (error) {
    return {
      name: "redis",
      ok: false,
      detail: error instanceof Error && error.message === "timeout" ? "timeout" : "ping failed",
    };
  } finally {
    client.disconnect();
  }
}

async function checkStorage(context: WorkerRuntimeContext): Promise<WorkerHealthCheckResult> {
  try {
    const result = await withTimeout(context.storage.getBucketReadiness(), HEALTH_CHECK_TIMEOUT_MS);
    return {
      name: "storage",
      ok: result.bucketExists && result.versioningStatus === "Enabled",
      detail: result.bucketExists ? `versioning=${result.versioningStatus}` : "bucket-missing",
    };
  } catch (error) {
    return {
      name: "storage",
      ok: false,
      detail:
        error instanceof Error && error.message === "timeout"
          ? "timeout"
          : "bucket readiness failed",
    };
  }
}

async function checkClamAv(context: WorkerRuntimeContext): Promise<WorkerHealthCheckResult> {
  try {
    const version = await withTimeout(context.clamav.getVersion(), HEALTH_CHECK_TIMEOUT_MS);
    if ("status" in version) {
      return { name: "clamav", ok: false, detail: version.status };
    }

    return {
      name: "clamav",
      ok: true,
      detail: `engine=${version.engineVersion ?? "unknown"} signatures=${version.signatureVersion ?? "unknown"}`,
    };
  } catch (error) {
    return {
      name: "clamav",
      ok: false,
      detail:
        error instanceof Error && error.message === "timeout" ? "timeout" : "version check failed",
    };
  }
}

/**
 * Real readiness check (module-02 §9): database connectivity, Redis connectivity, storage bucket
 * versioning, and ClamAV reachability. Never includes secrets/connection strings in the result --
 * only booleans and short non-sensitive detail strings.
 */
export async function getWorkerHealth(context: WorkerRuntimeContext): Promise<WorkerHealth> {
  const checks = await Promise.all([
    checkDatabase(context),
    checkRedis(context),
    checkStorage(context),
    checkClamAv(context),
  ]);

  return {
    status: checks.every((check) => check.ok) ? "ok" : "degraded",
    service: "worker",
    queues: queueNames,
    checks,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
