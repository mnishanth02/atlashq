import type { SourceVaultEnv } from "@atlashq/config";
import type { DocumentProcessingJobPayload } from "@atlashq/jobs";
import { createQueueRegistration, defaultRetryPolicy } from "@atlashq/jobs";
import type { MinioObjectStorageClient } from "@atlashq/storage";
import { createMinioStorageClient } from "@atlashq/storage";
import { Queue } from "bullmq";

type PayloadOfKind<Kind extends DocumentProcessingJobPayload["kind"]> = Extract<
  DocumentProcessingJobPayload,
  { kind: Kind }
>;

export type VerifyAndScanJobPayload = PayloadOfKind<"verify-and-scan">;
export type ExtractJobPayload = PayloadOfKind<"extract">;
export type GeneratePreviewJobPayload = PayloadOfKind<"generate-preview">;
export type CaptureReferenceJobPayload = PayloadOfKind<"capture-reference">;
export type ExpireUploadSessionJobPayload = PayloadOfKind<"expire-upload-session">;

/**
 * The narrow queue surface the source-documents service uses to enqueue jobs. Keeping this
 * behind an interface (rather than passing a BullMQ `Queue` directly) lets tests provide a
 * lightweight in-memory implementation and lets the runtime supply `null` when Redis is not
 * configured for the OpenAPI-generation build.
 */
export interface SourceDocumentQueue {
  checkAvailability(timeoutMs?: number): Promise<{ ok: boolean; detail: string }>;
  addVerifyAndScan(payload: VerifyAndScanJobPayload): Promise<void>;
  addExtract(payload: ExtractJobPayload): Promise<void>;
  addGeneratePreview(payload: GeneratePreviewJobPayload): Promise<void>;
  addCaptureReference(payload: CaptureReferenceJobPayload): Promise<void>;
  addExpireUploadSession(payload: ExpireUploadSessionJobPayload): Promise<void>;
  close(): Promise<void>;
}

class BullMqSourceDocumentQueue implements SourceDocumentQueue {
  constructor(private readonly queue: Queue<DocumentProcessingJobPayload>) {}

  async checkAvailability(timeoutMs = 2_000) {
    try {
      const client = await withTimeout(this.queue.client, timeoutMs, "queue client timed out");
      const info = await withTimeout(client.info(), timeoutMs, "queue info timed out");
      return {
        ok: typeof info === "string" && info.length > 0,
        detail: typeof info === "string" && info.length > 0 ? "ready" : "unexpected-info",
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : "queue unavailable",
      };
    }
  }

  private add(payload: DocumentProcessingJobPayload): Promise<void> {
    return this.queue
      .add(payload.kind, payload, {
        jobId: payload.idempotencyKey,
        ...defaultRetryPolicy,
      })
      .then(() => undefined);
  }

  addVerifyAndScan(payload: VerifyAndScanJobPayload) {
    return this.add(payload);
  }

  addExtract(payload: ExtractJobPayload) {
    return this.add(payload);
  }

  addGeneratePreview(payload: GeneratePreviewJobPayload) {
    return this.add(payload);
  }

  addCaptureReference(payload: CaptureReferenceJobPayload) {
    return this.add(payload);
  }

  addExpireUploadSession(payload: ExpireUploadSessionJobPayload) {
    return this.add(payload);
  }

  close() {
    return this.queue.close();
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Compose a real BullMQ-backed source-document queue from a Redis URL. Never invoked during
 * OpenAPI generation because `main.ts` only passes a non-null Redis URL for the live server.
 */
export function createBullMqSourceDocumentQueue(redisUrl: string): SourceDocumentQueue {
  const registration = createQueueRegistration("document-processing");
  const queue = new Queue<DocumentProcessingJobPayload>(registration.name, {
    connection: { url: redisUrl },
    defaultJobOptions: registration.defaultJobOptions,
  });
  return new BullMqSourceDocumentQueue(queue);
}

/** Options accepted by `composeSourceVaultRuntime`. */
export type ComposeSourceVaultOptions = {
  storageEnv: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  };
  sourceVault: SourceVaultEnv;
  redisUrl: string;
};

/**
 * Build the (real) MinIO storage client and BullMQ document queue from validated env.
 * Called from `main.ts` only; OpenAPI generation and integration tests supply either
 * `null` or in-memory doubles instead.
 */
export function composeSourceVaultRuntime(options: ComposeSourceVaultOptions): {
  storage: MinioObjectStorageClient;
  documentQueue: SourceDocumentQueue;
} {
  const storage = createMinioStorageClient({
    endpoint: options.storageEnv.endpoint,
    accessKeyId: options.storageEnv.accessKeyId,
    secretAccessKey: options.storageEnv.secretAccessKey,
    bucket: options.storageEnv.bucket,
    uploadUrlMaxExpirySeconds: options.sourceVault.SOURCE_UPLOAD_URL_TTL_SECONDS,
    downloadUrlDefaultExpirySeconds: options.sourceVault.SOURCE_DOWNLOAD_URL_TTL_SECONDS,
  });

  const documentQueue = createBullMqSourceDocumentQueue(options.redisUrl);
  return { storage, documentQueue };
}
