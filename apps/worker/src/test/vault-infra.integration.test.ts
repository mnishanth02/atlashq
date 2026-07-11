import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { getWorkerHealth } from "../health.js";
import { createWorkerRuntimeContext, type WorkerRuntimeContext } from "../runtime/context.js";

/** The canonical EICAR antivirus test string (not a real virus; every scanner flags it). */
const EICAR_TEST_STRING = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/**
 * Exercises the real infrastructure wiring the worker depends on -- MinIO bucket
 * bootstrap/versioning, a genuine ClamAV INSTREAM scan (clean and EICAR-infected), and end-to-end
 * worker readiness (module-02 §9, §10) -- against disposable Testcontainers-managed Postgres,
 * Redis, MinIO, and ClamAV (see `./global-setup.ts`). The 130+ handler unit tests already cover
 * verification/extraction/preview/capture business logic with fakes; this suite intentionally
 * stays narrow and only proves the real services are reachable and behave as the app expects.
 */
describe("integration: worker infrastructure (real MinIO + ClamAV + Redis + Postgres)", () => {
  let context: WorkerRuntimeContext;

  beforeAll(() => {
    const env = inject("workerIntegrationEnv");
    context = createWorkerRuntimeContext({
      NODE_ENV: "test",
      ...env,
    });
  });

  afterAll(async () => {
    await context.close();
  });

  it("bootstraps the bucket with versioning enabled, idempotently", async () => {
    const created = await context.storage.bootstrapBucket();
    expect(created.bucketCreated).toBe(true);
    expect(created.versioningStatus).toBe("Enabled");

    const replay = await context.storage.bootstrapBucket();
    expect(replay.bucketCreated).toBe(false);
    expect(replay.versioningStatus).toBe("Enabled");
  });

  it("round-trips a versioned object through the bootstrapped bucket", async () => {
    await context.storage.bootstrapBucket();

    const objectKey = "integration/worker-infra/roundtrip.txt";
    const body = Buffer.from("hello atlashq worker integration");

    const write = await context.storage.putObject({
      objectKey,
      data: body,
      sizeBytes: body.length,
      contentType: "text/plain",
    });
    expect(write.versionId).toEqual(expect.any(String));

    const stat = await context.storage.statObject({ objectKey });
    expect(stat.sizeBytes).toBe(body.length);
    expect(stat.versionId).toBe(write.versionId);
  });

  it("scans a clean payload as clean via a real ClamAV INSTREAM session", async () => {
    const result = await context.clamav.scanStream(
      Readable.from([Buffer.from("nothing malicious here, just atlashq test bytes")]),
    );

    expect(result.status).toBe("clean");
  });

  it("scans the EICAR test string as infected via a real ClamAV INSTREAM session", async () => {
    const result = await context.clamav.scanStream(Readable.from([Buffer.from(EICAR_TEST_STRING)]));

    expect(result.status).toBe("infected");
    if (result.status === "infected") {
      expect(result.signature).toMatch(/eicar/iu);
    }
  });

  it("reports overall readiness once the bucket is bootstrapped", async () => {
    await context.storage.bootstrapBucket();

    const health = await getWorkerHealth(context);

    expect(health.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "database", ok: true }),
        expect.objectContaining({ name: "redis", ok: true }),
        expect.objectContaining({ name: "storage", ok: true }),
        expect.objectContaining({ name: "clamav", ok: true }),
      ]),
    );
    expect(health.status).toBe("ok");
  });
});
