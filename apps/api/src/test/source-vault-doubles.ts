import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { SourceVaultEnv } from "@atlashq/config";
import type {
  MinioObjectStorageClient,
  ObjectLocator,
  PutStoredObjectRequest,
  SignedDownloadUrlRequest,
  SignedUploadUrlRequest,
  SignedUrlContract,
  StoredObjectMetadata,
  StoredObjectWriteResult,
} from "@atlashq/storage";
import type {
  CaptureReferenceJobPayload,
  ExpireUploadSessionJobPayload,
  ExtractJobPayload,
  GeneratePreviewJobPayload,
  SourceDocumentQueue,
  VerifyAndScanJobPayload,
} from "../runtime/source-vault-runtime.js";

/**
 * In-memory `MinioObjectStorageClient` used by Source Vault integration tests. Signed URLs are
 * stable strings pointing to a fake host so we can assert issuance without any real HTTP round
 * trip; content is retained in-process so `statObject` can return the exact size/version we
 * later assert against upload session confirmation guards.
 */
export class InMemoryStorageDouble implements MinioObjectStorageClient {
  readonly endpoint = "http://in-memory-storage.test";
  readonly bucket = "atlashq-test-bucket";
  private readonly objects = new Map<string, StoredObjectMetadata & { body: Buffer }>();
  private readonly issuedWriteResults = new WeakSet<StoredObjectWriteResult>();
  readonly signedUploadUrls: Array<{ objectKey: string; url: string }> = [];
  readonly signedDownloadUrls: Array<{ objectKey: string; url: string }> = [];
  readonly rollbackCalls: StoredObjectWriteResult[] = [];
  rollbackFailure: Error | null = null;

  reset(): void {
    this.objects.clear();
    this.signedUploadUrls.length = 0;
    this.signedDownloadUrls.length = 0;
    this.rollbackCalls.length = 0;
    this.rollbackFailure = null;
  }

  getObjectCount(): number {
    return this.objects.size;
  }

  async createSignedUploadUrl(request: SignedUploadUrlRequest): Promise<SignedUrlContract> {
    const url = `${this.endpoint}/uploads/${encodeURIComponent(request.objectKey)}?token=${randomUUID()}`;
    this.signedUploadUrls.push({ objectKey: request.objectKey, url });
    return {
      provider: "minio-s3-compatible",
      endpoint: this.endpoint,
      bucket: this.bucket,
      objectKey: request.objectKey,
      operation: "write",
      signedUrl: url,
      expiresAt: new Date(Date.now() + (request.expiresInSeconds ?? 900) * 1000).toISOString(),
      expiresInSeconds: request.expiresInSeconds ?? 900,
      publicBucket: false,
      requiredHeaders: Object.freeze({}),
    };
  }

  async createSignedDownloadUrl(request: SignedDownloadUrlRequest): Promise<SignedUrlContract> {
    const url = `${this.endpoint}/downloads/${encodeURIComponent(request.objectKey)}?token=${randomUUID()}`;
    this.signedDownloadUrls.push({ objectKey: request.objectKey, url });
    return {
      provider: "minio-s3-compatible",
      endpoint: this.endpoint,
      bucket: this.bucket,
      objectKey: request.objectKey,
      operation: "read",
      signedUrl: url,
      expiresAt: new Date(Date.now() + (request.expiresInSeconds ?? 600) * 1000).toISOString(),
      expiresInSeconds: request.expiresInSeconds ?? 600,
      publicBucket: false,
      requiredHeaders: Object.freeze({}),
    };
  }

  async statObject(locator: ObjectLocator): Promise<StoredObjectMetadata> {
    const record = this.objects.get(locator.objectKey);
    if (!record) {
      throw new Error(`Object not found: ${locator.objectKey}`);
    }
    return record;
  }

  async getObjectStream(locator: ObjectLocator) {
    const record = this.objects.get(locator.objectKey);
    if (!record) {
      throw new Error(`Object not found: ${locator.objectKey}`);
    }
    return Readable.from(record.body);
  }

  async putObject(request: PutStoredObjectRequest): Promise<StoredObjectWriteResult> {
    const body =
      typeof request.data === "string"
        ? Buffer.from(request.data, "utf8")
        : Buffer.isBuffer(request.data)
          ? request.data
          : Buffer.from([]);
    const etag = createHash("md5").update(body).digest("hex");
    const versionId = randomUUID();
    const record: StoredObjectMetadata & { body: Buffer } = {
      endpoint: this.endpoint,
      bucket: this.bucket,
      objectKey: request.objectKey,
      versionId,
      etag,
      sizeBytes: request.sizeBytes ?? body.length,
      lastModified: new Date(),
      contentType: request.contentType ?? null,
      metadata: Object.freeze({ ...(request.metadata ?? {}) }),
      body,
    };
    this.objects.set(request.objectKey, record);
    const result = {
      endpoint: this.endpoint,
      bucket: this.bucket,
      objectKey: request.objectKey,
      versionId,
      etag,
    };
    this.issuedWriteResults.add(result);
    return result;
  }

  /**
   * Test helper: simulate a client PUT completing successfully against a signed URL by seeding
   * the in-memory object directly with the size the confirmation guard expects.
   */
  seedUploadedObject(objectKey: string, sizeBytes: number, contentType?: string): void {
    const body = Buffer.alloc(sizeBytes, "a");
    const etag = createHash("md5").update(body).digest("hex");
    this.objects.set(objectKey, {
      endpoint: this.endpoint,
      bucket: this.bucket,
      objectKey,
      versionId: randomUUID(),
      etag,
      sizeBytes,
      lastModified: new Date(),
      contentType: contentType ?? null,
      metadata: Object.freeze({}),
      body,
    });
  }

  async bootstrapBucket() {
    return {
      endpoint: this.endpoint,
      bucket: this.bucket,
      bucketCreated: false,
      versioningStatus: "Enabled" as const,
    };
  }

  async getBucketReadiness() {
    return {
      endpoint: this.endpoint,
      bucket: this.bucket,
      bucketExists: true,
      versioningStatus: "Enabled" as const,
    };
  }

  async rollbackObjectWrite(writeResult: StoredObjectWriteResult): Promise<void> {
    if (writeResult.endpoint !== this.endpoint || writeResult.bucket !== this.bucket) {
      throw new Error("rollback write result does not belong to this storage client");
    }
    if (!this.issuedWriteResults.has(writeResult)) {
      throw new Error("rollback requires the exact issued write result");
    }

    this.rollbackCalls.push(writeResult);
    if (this.rollbackFailure) {
      throw this.rollbackFailure;
    }

    const current = this.objects.get(writeResult.objectKey);
    if (!current) {
      return;
    }
    if (writeResult.versionId && current.versionId !== writeResult.versionId) {
      return;
    }
    this.objects.delete(writeResult.objectKey);
  }

  async deleteProvisionalObject(locator: ObjectLocator): Promise<void> {
    this.objects.delete(locator.objectKey);
  }
}

type EnqueuedJob =
  | { kind: "verify-and-scan"; payload: VerifyAndScanJobPayload }
  | { kind: "extract"; payload: ExtractJobPayload }
  | { kind: "generate-preview"; payload: GeneratePreviewJobPayload }
  | { kind: "capture-reference"; payload: CaptureReferenceJobPayload }
  | { kind: "expire-upload-session"; payload: ExpireUploadSessionJobPayload };

/** In-memory queue double that captures every enqueue call so tests can assert payloads. */
export class InMemoryQueueDouble implements SourceDocumentQueue {
  readonly jobs: EnqueuedJob[] = [];
  async checkAvailability() {
    return { ok: true, detail: "in-memory" };
  }

  async addVerifyAndScan(payload: VerifyAndScanJobPayload) {
    this.jobs.push({ kind: "verify-and-scan", payload });
  }
  async addExtract(payload: ExtractJobPayload) {
    this.jobs.push({ kind: "extract", payload });
  }
  async addGeneratePreview(payload: GeneratePreviewJobPayload) {
    this.jobs.push({ kind: "generate-preview", payload });
  }
  async addCaptureReference(payload: CaptureReferenceJobPayload) {
    this.jobs.push({ kind: "capture-reference", payload });
  }
  async addExpireUploadSession(payload: ExpireUploadSessionJobPayload) {
    this.jobs.push({ kind: "expire-upload-session", payload });
  }
  async close() {}
}

/** Test-only Source Vault env with realistic but small defaults, mirroring the production schema. */
export const TEST_SOURCE_VAULT_ENV: SourceVaultEnv = {
  SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,
  SOURCE_UPLOAD_SESSION_TTL_SECONDS: 24 * 60 * 60,
  SOURCE_UPLOAD_URL_TTL_SECONDS: 15 * 60,
  SOURCE_DOWNLOAD_URL_TTL_SECONDS: 10 * 60,
  S3_REQUIRE_BUCKET_VERSIONING: true,
};
