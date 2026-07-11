import { beforeEach, describe, expect, it, vi } from "vitest";

const connect = vi.fn();
const ping = vi.fn();
const disconnect = vi.fn();

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(function RedisMock() {
    return { connect, ping, disconnect };
  }),
}));

const { getWorkerHealth } = await import("./health.js");

function buildContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    databaseClient: { pool: { query: vi.fn().mockResolvedValue(undefined) } },
    redisConnection: { url: "redis://localhost:6379" },
    storage: {
      getBucketReadiness: vi
        .fn()
        .mockResolvedValue({ bucketExists: true, versioningStatus: "Enabled" }),
    },
    clamav: {
      getVersion: vi.fn().mockResolvedValue({
        raw: "ClamAV 1.0/12345",
        engineVersion: "1.0",
        signatureVersion: "12345",
        signatureTimestamp: null,
      }),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  connect.mockResolvedValue(undefined);
  ping.mockResolvedValue("PONG");
});

describe("getWorkerHealth", () => {
  it("reports ok when every dependency check succeeds", async () => {
    const context = buildContext();

    const health = await getWorkerHealth(context as never);

    expect(health.status).toBe("ok");
    expect(health.service).toBe("worker");
    expect(health.checks.map((check) => check.name).sort()).toEqual([
      "clamav",
      "database",
      "redis",
      "storage",
    ]);
    expect(health.checks.every((check) => check.ok)).toBe(true);
    expect(health.checks.find((check) => check.name === "clamav")?.detail).toContain("engine=1.0");
  });

  it("never leaks connection strings/credentials in check details", async () => {
    const context = buildContext();
    const health = await getWorkerHealth(context as never);

    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain("redis://localhost:6379");
  });

  it("reports degraded when the database check fails", async () => {
    const context = buildContext({
      databaseClient: {
        pool: { query: vi.fn().mockRejectedValue(new Error("connection refused")) },
      },
    });

    const health = await getWorkerHealth(context as never);

    expect(health.status).toBe("degraded");
    const dbCheck = health.checks.find((check) => check.name === "database");
    expect(dbCheck?.ok).toBe(false);
  });

  it("reports degraded when redis ping fails", async () => {
    ping.mockResolvedValue("");
    const context = buildContext();

    const health = await getWorkerHealth(context as never);

    expect(health.status).toBe("degraded");
    const redisCheck = health.checks.find((check) => check.name === "redis");
    expect(redisCheck?.ok).toBe(false);
  });

  it("reports degraded when redis connect throws", async () => {
    connect.mockRejectedValue(new Error("ECONNREFUSED"));
    const context = buildContext();

    const health = await getWorkerHealth(context as never);

    const redisCheck = health.checks.find((check) => check.name === "redis");
    expect(redisCheck?.ok).toBe(false);
    expect(health.status).toBe("degraded");
  });

  it("reports degraded when storage bucket versioning is not enabled", async () => {
    const context = buildContext({
      storage: {
        getBucketReadiness: vi
          .fn()
          .mockResolvedValue({ bucketExists: true, versioningStatus: "Suspended" }),
      },
    });

    const health = await getWorkerHealth(context as never);

    expect(health.status).toBe("degraded");
    const storageCheck = health.checks.find((check) => check.name === "storage");
    expect(storageCheck?.ok).toBe(false);
    expect(storageCheck?.detail).toContain("Suspended");
  });

  it("reports degraded when storage readiness times out", async () => {
    const context = buildContext({
      storage: {
        getBucketReadiness: vi.fn().mockImplementation(() => new Promise(() => undefined)),
      },
    });

    const health = await getWorkerHealth(context as never);

    expect(health.status).toBe("degraded");
    expect(health.checks.find((check) => check.name === "storage")?.detail).toBe("timeout");
  });

  it("reports degraded when ClamAV reports an unavailable status", async () => {
    const context = buildContext({
      clamav: {
        getVersion: vi.fn().mockResolvedValue({
          status: "unavailable",
          retryable: true,
          reason: "connection refused",
        }),
      },
    });

    const health = await getWorkerHealth(context as never);

    expect(health.status).toBe("degraded");
    const clamavCheck = health.checks.find((check) => check.name === "clamav");
    expect(clamavCheck?.ok).toBe(false);
  });

  it("reports degraded when ClamAV getVersion throws", async () => {
    const context = buildContext({
      clamav: { getVersion: vi.fn().mockRejectedValue(new Error("socket error")) },
    });

    const health = await getWorkerHealth(context as never);

    const clamavCheck = health.checks.find((check) => check.name === "clamav");
    expect(clamavCheck?.ok).toBe(false);
    expect(health.status).toBe("degraded");
  });
});
