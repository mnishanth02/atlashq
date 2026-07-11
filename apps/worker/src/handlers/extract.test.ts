import { Readable } from "node:stream";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTextFixture } from "../extraction/__fixtures__/build-fixtures.js";

const requireSourceDocument = vi.fn();
const requireSourceExtraction = vi.fn();
const listSourceDocumentFiles = vi.fn();
const countSourceChunks = vi.fn();
const listSourceChunkContentsInOrder = vi.fn();
const insertExtractionChunksAndMetadata = vi.fn();
const updateSourceDocumentProcessingStatus = vi.fn();
const updateSourceExtraction = vi.fn();
const recordWorkerAuditEvent = vi.fn();

vi.mock("../db/source-vault-repository.js", async () => {
  const actual = await vi.importActual<typeof import("../db/source-vault-repository.js")>(
    "../db/source-vault-repository.js",
  );
  return {
    ...actual,
    requireSourceDocument: (...args: unknown[]) => requireSourceDocument(...args),
    requireSourceExtraction: (...args: unknown[]) => requireSourceExtraction(...args),
    listSourceDocumentFiles: (...args: unknown[]) => listSourceDocumentFiles(...args),
    countSourceChunks: (...args: unknown[]) => countSourceChunks(...args),
    listSourceChunkContentsInOrder: (...args: unknown[]) => listSourceChunkContentsInOrder(...args),
    insertExtractionChunksAndMetadata: (...args: unknown[]) =>
      insertExtractionChunksAndMetadata(...args),
    updateSourceDocumentProcessingStatus: (...args: unknown[]) =>
      updateSourceDocumentProcessingStatus(...args),
    updateSourceExtraction: (...args: unknown[]) => updateSourceExtraction(...args),
    // `hasCompleteExtractionMetadata` is a pure function -- keep the real implementation so these
    // tests exercise the actual replay/backfill decision, not a mock stand-in for it.
  };
});

vi.mock("../runtime/audit.js", () => ({
  recordWorkerAuditEvent: (...args: unknown[]) => recordWorkerAuditEvent(...args),
}));

const { handleExtract } = await import("./extract.js");
const { RetryableWorkerError } = await import("../errors.js");

const SOURCE_DOCUMENT_ID = "source-doc-1";
const EXTRACTION_ID = "extraction-1";
const ORG_ID = "org-1";
const PROJECT_ID = "project-1";

function buildPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: "extract" as const,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    idempotencyKey: "key-1",
    correlationId: "corr-1",
    submittedAt: new Date().toISOString(),
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    sourceExtractionId: EXTRACTION_ID,
    ...overrides,
  };
}

function buildDocumentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SOURCE_DOCUMENT_ID,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    createdBy: "actor-1",
    processingStatus: "extracting",
    ...overrides,
  };
}

function buildExtractionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: EXTRACTION_ID,
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    status: "pending",
    parserManifest: [],
    extractedTextHash: null,
    ...overrides,
  };
}

function buildPrimaryFile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "file-1",
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    role: "primary",
    format: "txt",
    objectKey: "org-1/project-1/source/doc.txt",
    ...overrides,
  };
}

function buildContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    db: {},
    storage: {
      getObjectStream: vi.fn().mockResolvedValue(Readable.from([buildTextFixture()])),
    },
    ...overrides,
  };
}

function buildQueue() {
  return { add: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  insertExtractionChunksAndMetadata.mockResolvedValue({ chunkCount: 1 });
});

describe("handleExtract", () => {
  it("parses a primary txt file, inserts chunks and metadata atomically in one transaction, and enqueues generate-preview", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile()]);
    countSourceChunks.mockResolvedValue(0);

    const context = buildContext();
    const queue = buildQueue();

    await handleExtract(context as never, queue as never, buildPayload());

    expect(updateSourceExtraction).toHaveBeenCalledWith(
      context.db,
      EXTRACTION_ID,
      expect.objectContaining({ status: "running" }),
    );

    // Chunks and parser metadata are written together by the single atomic transaction function
    // -- there is no separate insert-then-update code path left in the handler at all.
    expect(insertExtractionChunksAndMetadata).toHaveBeenCalledTimes(1);
    const call = insertExtractionChunksAndMetadata.mock.calls[0]?.[1] as {
      sourceExtractionId: string;
      chunks: unknown[];
      parserManifest: unknown[];
      extractedTextHash: string | null;
    };
    expect(call.sourceExtractionId).toBe(EXTRACTION_ID);
    expect(call.chunks.length).toBeGreaterThan(0);
    expect(call.parserManifest.length).toBeGreaterThan(0);
    expect(call.extractedTextHash).toEqual(expect.any(String));

    expect(listSourceChunkContentsInOrder).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      "generate-preview",
      expect.objectContaining({ kind: "generate-preview", sourceExtractionId: EXTRACTION_ID }),
      expect.anything(),
    );
  });

  it("is idempotent: a terminal extraction status is a no-op", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow({ status: "succeeded" }));

    const context = buildContext();
    await handleExtract(context as never, buildQueue() as never, buildPayload());

    expect(listSourceDocumentFiles).not.toHaveBeenCalled();
  });

  it("is idempotent on ordinary replay: chunks and complete metadata already exist, so it skips re-parsing but re-enqueues generate-preview", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(
      buildExtractionRow({
        status: "running",
        parserManifest: [{ name: "text-adapter", version: "1.0.0" }],
        extractedTextHash: "a".repeat(64),
      }),
    );
    countSourceChunks.mockResolvedValue(5);

    const context = buildContext();
    const queue = buildQueue();

    await handleExtract(context as never, queue as never, buildPayload());

    expect(listSourceDocumentFiles).not.toHaveBeenCalled();
    expect(insertExtractionChunksAndMetadata).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      "generate-preview",
      expect.objectContaining({ kind: "generate-preview" }),
      expect.anything(),
    );
  });

  it("backfills incomplete metadata from a crash-recovered extraction: chunks exist but metadata is missing, so it recomputes the hash from the persisted chunks (not a fresh parse) and never re-inserts chunks", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(
      buildExtractionRow({ status: "running", parserManifest: [], extractedTextHash: null }),
    );
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile()]);
    countSourceChunks.mockResolvedValue(3);
    listSourceChunkContentsInOrder.mockResolvedValue(["chunk one", "chunk two", "chunk three"]);
    insertExtractionChunksAndMetadata.mockResolvedValue({ chunkCount: 3 });

    const context = buildContext();
    const queue = buildQueue();

    await handleExtract(context as never, queue as never, buildPayload());

    expect(listSourceChunkContentsInOrder).toHaveBeenCalledWith(context.db, EXTRACTION_ID);
    expect(insertExtractionChunksAndMetadata).toHaveBeenCalledTimes(1);
    const call = insertExtractionChunksAndMetadata.mock.calls[0]?.[1] as {
      sourceExtractionId: string;
      chunks: unknown[];
      parserManifest: unknown[];
      extractedTextHash: string | null;
    };
    // Never re-inserts chunks already committed by the earlier (crashed) attempt.
    expect(call.chunks).toEqual([]);
    expect(call.parserManifest.length).toBeGreaterThan(0);
    expect(call.extractedTextHash).toEqual(expect.any(String));

    // Preview is only enqueued after the metadata backfill transaction completes.
    expect(queue.add).toHaveBeenCalledWith(
      "generate-preview",
      expect.objectContaining({ kind: "generate-preview" }),
      expect.anything(),
    );
  });

  it("fails terminally when there is no primary evidence file", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([]);
    countSourceChunks.mockResolvedValue(0);

    await expect(
      handleExtract(buildContext() as never, buildQueue() as never, buildPayload()),
    ).rejects.toThrow(UnrecoverableError);

    expect(updateSourceExtraction).toHaveBeenCalledWith(
      expect.anything(),
      EXTRACTION_ID,
      expect.objectContaining({ status: "failed" }),
    );
    expect(updateSourceDocumentProcessingStatus).toHaveBeenCalledWith(
      expect.anything(),
      SOURCE_DOCUMENT_ID,
      "failed",
    );
    expect(insertExtractionChunksAndMetadata).not.toHaveBeenCalled();
  });

  it("fails terminally on corrupt content and never retries, without writing any partial chunk/metadata", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile({ format: "pdf" })]);
    countSourceChunks.mockResolvedValue(0);

    const context = buildContext({
      storage: {
        getObjectStream: vi
          .fn()
          .mockResolvedValue(Readable.from([Buffer.from("this is not a valid pdf")])),
      },
    });

    await expect(
      handleExtract(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toThrow(UnrecoverableError);

    expect(updateSourceExtraction).toHaveBeenCalledWith(
      context.db,
      EXTRACTION_ID,
      expect.objectContaining({ status: "failed" }),
    );
    expect(insertExtractionChunksAndMetadata).not.toHaveBeenCalled();
  });

  it("fails terminally for an unsupported format", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile({ format: "exe" })]);
    countSourceChunks.mockResolvedValue(0);

    await expect(
      handleExtract(buildContext() as never, buildQueue() as never, buildPayload()),
    ).rejects.toThrow(UnrecoverableError);

    expect(insertExtractionChunksAndMetadata).not.toHaveBeenCalled();
  });

  it("throws a retryable error when streaming the evidence file fails", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile()]);
    countSourceChunks.mockResolvedValue(0);

    const context = buildContext({
      storage: { getObjectStream: vi.fn().mockRejectedValue(new Error("network blip")) },
    });

    await expect(
      handleExtract(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(RetryableWorkerError);

    expect(insertExtractionChunksAndMetadata).not.toHaveBeenCalled();
  });
});
