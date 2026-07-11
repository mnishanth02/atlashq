import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMinioStorageClient,
  immutableStoragePurposes,
  type MinioStorageClientDependencies,
  StorageError,
} from "./index.js";

function createMockMinioClient() {
  return {
    bucketExists: vi.fn(async () => true),
    makeBucket: vi.fn(async () => undefined),
    setBucketVersioning: vi.fn(async () => undefined),
    getBucketVersioning: vi.fn(async () => ({ Status: "Enabled" as const })),
    presignedPutObject: vi.fn(async () => "http://signed-upload.example.test/object"),
    presignedGetObject: vi.fn(async () => "http://signed-download.example.test/object"),
    presignedUrl: vi.fn(async () => "http://signed-version-download.example.test/object"),
    statObject: vi.fn(async () => ({
      size: 42,
      etag: "etag-1",
      lastModified: new Date("2026-07-10T10:00:00.000Z"),
      metaData: { "content-type": "application/pdf", "x-amz-meta-source": "manual" },
      versionId: "ver-1",
    })),
    getObject: vi.fn(async () => Readable.from(["atlas"])),
    putObject: vi.fn(async () => ({ etag: "etag-2", versionId: "ver-2" })),
    removeObject: vi.fn(async () => undefined),
  };
}

function createStorageHarness(
  overrides: Partial<MinioStorageClientDependencies> = {},
  options: Partial<{
    endpoint: string;
    bucket: string;
  }> = {},
) {
  const client = createMockMinioClient();
  const storage = createMinioStorageClient(
    {
      endpoint: options.endpoint ?? "http://minio.internal:9000",
      accessKeyId: "access",
      secretAccessKey: "secret",
      bucket: options.bucket ?? "atlashq-local",
    },
    {
      createClient: () => client,
      now: () => new Date("2026-07-10T10:00:00.000Z"),
      ...overrides,
    },
  );

  return { client, storage };
}

describe("MinIO storage client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires authorization and enforces upload expiry bounds before signing", async () => {
    const { storage } = createStorageHarness();
    const objectKey = "org/org_1/source-document/sha256/hash/source_1";

    await expect(
      storage.createSignedUploadUrl({
        objectKey,
        authorization: { checked: true, actorId: "user_1", reason: "ok" },
        expiresInSeconds: 901,
      }),
    ).rejects.toMatchObject({ code: "INVALID_UPLOAD_EXPIRY" });
  });

  it("enforces bounded download expiry before signing", async () => {
    const { storage } = createStorageHarness();

    await expect(
      storage.createSignedDownloadUrl({
        objectKey: createObjectKey(),
        authorization: { checked: true, actorId: "user_1", reason: "ok" },
        expiresInSeconds: 3_601,
      }),
    ).rejects.toMatchObject({ code: "INVALID_DOWNLOAD_EXPIRY" });
  });

  it("signs PUT and GET URLs with bounded expiry and safe disposition", async () => {
    const { client, storage } = createStorageHarness();
    const objectKey = "org/org_1/source-document/sha256/hash/source_1";

    const signedUpload = await storage.createSignedUploadUrl({
      objectKey,
      authorization: { checked: true, actorId: "user_1", reason: "project membership verified" },
      contentType: "application/pdf",
      expiresInSeconds: 300,
    });
    const signedDownload = await storage.createSignedDownloadUrl({
      objectKey,
      authorization: { checked: true, actorId: "user_1", reason: "project membership verified" },
      expiresInSeconds: 600,
      fileName: "Quarterly Report.pdf",
      versionId: "ver-1",
    });

    expect(client.presignedPutObject).toHaveBeenCalledWith("atlashq-local", objectKey, 300);
    expect(client.presignedUrl).toHaveBeenCalledWith(
      "GET",
      "atlashq-local",
      objectKey,
      600,
      expect.objectContaining({
        "response-content-disposition": expect.stringContaining("Quarterly Report.pdf"),
        versionId: "ver-1",
      }),
    );
    expect(client.presignedGetObject).not.toHaveBeenCalled();
    expect(signedUpload.publicBucket).toBe(false);
    expect(signedUpload.expiresAt).toBe("2026-07-10T10:05:00.000Z");
    expect(signedUpload.requiredHeaders).toEqual({ "Content-Type": "application/pdf" });
    expect(signedDownload.expiresAt).toBe("2026-07-10T10:10:00.000Z");
  });

  it("stats, streams, and uploads objects without exposing credentials", async () => {
    const { client, storage } = createStorageHarness();
    const objectKey = createObjectKey();

    const stat = await storage.statObject({ objectKey, versionId: "ver-1" });
    const stream = await storage.getObjectStream({ objectKey, versionId: "ver-1" });
    const uploaded = await storage.putObject({
      objectKey,
      data: Buffer.from("atlas"),
      contentType: "text/plain",
      metadata: { "x-amz-meta-origin": "manual" },
    });

    expect(client.statObject).toHaveBeenCalledWith("atlashq-local", objectKey, {
      versionId: "ver-1",
    });
    expect(client.getObject).toHaveBeenCalledWith("atlashq-local", objectKey, {
      versionId: "ver-1",
    });
    expect(client.putObject).toHaveBeenCalledWith(
      "atlashq-local",
      objectKey,
      Buffer.from("atlas"),
      undefined,
      expect.objectContaining({
        "Content-Type": "text/plain",
        "x-amz-meta-origin": "manual",
      }),
    );
    expect(stat.versionId).toBe("ver-1");
    expect(stat.contentType).toBe("application/pdf");
    await expect(readStream(stream)).resolves.toBe("atlas");
    expect(uploaded.versionId).toBe("ver-2");
    expect(uploaded.endpoint).toBe("http://minio.internal:9000/");
  });

  it("bootstraps buckets idempotently and rejects disabled versioning", async () => {
    const { client, storage } = createStorageHarness();

    await expect(storage.bootstrapBucket()).resolves.toEqual({
      endpoint: "http://minio.internal:9000/",
      bucket: "atlashq-local",
      bucketCreated: false,
      versioningStatus: "Enabled",
    });

    client.bucketExists.mockResolvedValueOnce(false);
    await storage.bootstrapBucket();
    expect(client.makeBucket).toHaveBeenCalledWith("atlashq-local", undefined);

    client.getBucketVersioning.mockResolvedValueOnce({ Status: "Suspended" } as never);
    await expect(storage.bootstrapBucket()).rejects.toMatchObject({
      code: "BUCKET_VERSIONING_REQUIRED",
    });
  });

  it("reports non-mutating bucket readiness for health checks", async () => {
    const { client, storage } = createStorageHarness();

    await expect(storage.getBucketReadiness()).resolves.toEqual({
      endpoint: "http://minio.internal:9000/",
      bucket: "atlashq-local",
      bucketExists: true,
      versioningStatus: "Enabled",
    });

    client.bucketExists.mockResolvedValueOnce(false);
    await expect(storage.getBucketReadiness()).resolves.toEqual({
      endpoint: "http://minio.internal:9000/",
      bucket: "atlashq-local",
      bucketExists: false,
      versioningStatus: "Missing",
    });
  });

  it("does not expose generic deletion for confirmed immutable objects", () => {
    const { storage } = createStorageHarness();

    expect("deleteObject" in storage).toBe(false);
  });

  it("supports compensating cleanup only for the exact issued write result", async () => {
    const { client, storage } = createStorageHarness();
    const writeResult = await storage.putObject({
      objectKey: createObjectKey(),
      data: Buffer.from("atlas"),
      contentType: "text/plain",
    });

    await storage.rollbackObjectWrite(writeResult);

    expect(client.removeObject).toHaveBeenCalledWith("atlashq-local", createObjectKey(), {
      versionId: "ver-2",
    });
  });

  it("rejects rollback requests from a different client or a copied result", async () => {
    const { storage } = createStorageHarness();
    const { storage: other } = createStorageHarness(
      {},
      {
        endpoint: "http://other-minio.internal:9000",
        bucket: "other-bucket",
      },
    );
    const writeResult = await storage.putObject({
      objectKey: createObjectKey(),
      data: Buffer.from("atlas"),
      contentType: "text/plain",
    });

    await expect(
      storage.rollbackObjectWrite({
        ...writeResult,
        endpoint: "http://other-minio.internal:9000/",
        bucket: "other-bucket",
      }),
    ).rejects.toMatchObject({ code: "INVALID_WRITE_RESULT" });

    const otherWriteResult = await other.putObject({
      objectKey: createObjectKey(),
      data: Buffer.from("atlas"),
      contentType: "text/plain",
    });
    await expect(storage.rollbackObjectWrite(otherWriteResult)).rejects.toMatchObject({
      code: "INVALID_WRITE_RESULT",
    });

    await expect(storage.rollbackObjectWrite({ ...writeResult })).rejects.toMatchObject({
      code: "INVALID_WRITE_RESULT",
    });
  });

  it("only allows cleanup for provisional upload-session objects", async () => {
    const { client, storage } = createStorageHarness();
    const provisionalKey = "org/org_1/upload-session/upload_1/0001/object";

    await storage.deleteProvisionalObject({ objectKey: provisionalKey, versionId: "ver-1" });
    expect(client.removeObject).toHaveBeenCalledWith("atlashq-local", provisionalKey, {
      versionId: "ver-1",
    });

    await expect(
      storage.deleteProvisionalObject({ objectKey: createObjectKey() }),
    ).rejects.toBeInstanceOf(StorageError);
  });

  it("maps object-not-found errors to typed storage errors", async () => {
    const { client, storage } = createStorageHarness();
    client.statObject.mockRejectedValueOnce({ code: "NoSuchKey", statusCode: 404 });

    await expect(storage.statObject({ objectKey: createObjectKey() })).rejects.toMatchObject({
      code: "OBJECT_NOT_FOUND",
    });
  });
});

function createObjectKey(): string {
  return `org/org_1/project/project_1/${immutableStoragePurposes.sourceDocument}/sha256/${"a".repeat(64)}/source_1`;
}

async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}
