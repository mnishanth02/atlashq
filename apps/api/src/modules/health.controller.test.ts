import { describe, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("reports core-only health without breaking when Source Vault is not configured", async () => {
    const health = await new HealthController().getHealth();

    expect(health).toEqual({
      status: "ok",
      service: "api",
      version: "0.0.0",
      mode: "core-only",
      checks: [
        { name: "storage", ok: false, required: false, detail: "not configured" },
        { name: "queue", ok: false, required: false, detail: "not configured" },
      ],
    });
  });

  it("reports source-vault readiness when storage and queue are healthy", async () => {
    const controller = new HealthController(
      {
        getBucketReadiness: vi.fn().mockResolvedValue({
          endpoint: "http://minio.test",
          bucket: "atlas",
          bucketExists: true,
          versioningStatus: "Enabled",
        }),
      } as never,
      { checkAvailability: vi.fn().mockResolvedValue({ ok: true, detail: "ready" }) } as never,
    );

    const health = await controller.getHealth();

    expect(health.status).toBe("ok");
    expect(health.mode).toBe("source-vault");
    expect(health.checks).toEqual([
      { name: "storage", ok: true, required: true, detail: "versioning=Enabled" },
      { name: "queue", ok: true, required: true, detail: "ready" },
    ]);
  });

  it("degrades when a configured source-vault dependency is unhealthy", async () => {
    const controller = new HealthController(
      {
        getBucketReadiness: vi.fn().mockResolvedValue({
          endpoint: "http://minio.test",
          bucket: "atlas",
          bucketExists: true,
          versioningStatus: "Suspended",
        }),
      } as never,
      {
        checkAvailability: vi.fn().mockResolvedValue({ ok: false, detail: "queue ping timed out" }),
      } as never,
    );

    const health = await controller.getHealth();

    expect(health.status).toBe("degraded");
    expect(health.checks).toEqual([
      { name: "storage", ok: false, required: true, detail: "versioning=Suspended" },
      { name: "queue", ok: false, required: true, detail: "queue ping timed out" },
    ]);
  });
});
