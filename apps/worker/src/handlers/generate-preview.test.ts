import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPngFixture } from "../extraction/__fixtures__/build-fixtures.js";

const requireSourceDocument = vi.fn();
const requireSourceExtraction = vi.fn();
const listSourceDocumentFiles = vi.fn();
const finalizeExtractionPreview = vi.fn();

vi.mock("../db/source-vault-repository.js", () => ({
  requireSourceDocument: (...args: unknown[]) => requireSourceDocument(...args),
  requireSourceExtraction: (...args: unknown[]) => requireSourceExtraction(...args),
  listSourceDocumentFiles: (...args: unknown[]) => listSourceDocumentFiles(...args),
  finalizeExtractionPreview: (...args: unknown[]) => finalizeExtractionPreview(...args),
}));

const { handleGeneratePreview } = await import("./generate-preview.js");
const { InvalidJobDataError, RetryableWorkerError } = await import("../errors.js");

const SOURCE_DOCUMENT_ID = "source-doc-1";
const EXTRACTION_ID = "extraction-1";
const ORG_ID = "org-1";
const PROJECT_ID = "project-1";

function buildPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: "generate-preview" as const,
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
    status: "running",
    previewObjectKey: null,
    previewObjectVersionId: null,
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
      getObjectStream: vi.fn(),
      putObject: vi.fn().mockResolvedValue({ objectKey: "preview-key", versionId: "v1" }),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  finalizeExtractionPreview.mockResolvedValue({
    kind: "finalized",
    extraction: buildExtractionRow({ status: "succeeded" }),
    sourceDocument: buildDocumentRow({ processingStatus: "ready" }),
  });
});

describe("handleGeneratePreview", () => {
  it("generates an image thumbnail preview and finalizes the extraction transactionally", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile({ format: "png" })]);

    const pngBuffer = buildPngFixture();
    const context = buildContext({
      storage: {
        getObjectStream: vi.fn().mockResolvedValue(Readable.from([pngBuffer])),
        putObject: vi.fn().mockResolvedValue({ objectKey: "preview-key", versionId: "v1" }),
      },
    });

    await handleGeneratePreview(context as never, buildPayload());

    expect(context.storage.putObject).toHaveBeenCalled();
    expect(finalizeExtractionPreview).toHaveBeenCalledTimes(1);
    expect(finalizeExtractionPreview).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        sourceDocumentId: SOURCE_DOCUMENT_ID,
        sourceExtractionId: EXTRACTION_ID,
        preview: { previewObjectKey: "preview-key", previewObjectVersionId: "v1" },
        audit: expect.objectContaining({
          organizationId: ORG_ID,
          actorId: "actor-1",
          projectId: PROJECT_ID,
          correlationId: "corr-1",
        }),
      }),
    );
  });

  it("uses a deterministic, extraction-scoped object key so replays reuse the same key", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile({ format: "png" })]);

    const pngBuffer = buildPngFixture();
    const putObject = vi.fn().mockResolvedValue({ objectKey: "preview-key", versionId: "v1" });
    const context = buildContext({
      storage: {
        // A fresh `Readable` per call: streams can only be consumed once, and this handler is
        // invoked twice in this test to prove replay reuses the same deterministic object key.
        getObjectStream: vi.fn().mockImplementation(() => Readable.from([pngBuffer])),
        putObject,
      },
    });

    await handleGeneratePreview(context as never, buildPayload());
    const firstKey = putObject.mock.calls[0]?.[0]?.objectKey as string;

    putObject.mockClear();
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile({ format: "png" })]);
    await handleGeneratePreview(context as never, buildPayload());
    const secondKey = putObject.mock.calls[0]?.[0]?.objectKey as string;

    expect(firstKey).toBe(secondKey);
    expect(firstKey).toContain(EXTRACTION_ID);
  });

  it("marks a PDF/text/Office primary file as succeeded with preview left unavailable", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile({ format: "pdf" })]);

    const context = buildContext();

    await handleGeneratePreview(context as never, buildPayload());

    expect(context.storage.getObjectStream).not.toHaveBeenCalled();
    expect(finalizeExtractionPreview).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({ preview: null }),
    );
  });

  it("leaves a failed extraction fully untouched (immutable, no repair attempted)", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow({ status: "failed" }));

    await handleGeneratePreview(buildContext() as never, buildPayload());

    expect(listSourceDocumentFiles).not.toHaveBeenCalled();
    expect(finalizeExtractionPreview).not.toHaveBeenCalled();
  });

  it("rejects when the extraction has not reached the running state yet", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow({ status: "pending" }));

    await expect(
      handleGeneratePreview(buildContext() as never, buildPayload()),
    ).rejects.toBeInstanceOf(InvalidJobDataError);

    expect(finalizeExtractionPreview).not.toHaveBeenCalled();
  });

  it("throws a retryable error when streaming the image for thumbnailing fails", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile({ format: "png" })]);

    const context = buildContext({
      storage: {
        getObjectStream: vi.fn().mockRejectedValue(new Error("network blip")),
        putObject: vi.fn(),
      },
    });

    await expect(handleGeneratePreview(context as never, buildPayload())).rejects.toBeInstanceOf(
      RetryableWorkerError,
    );
    expect(finalizeExtractionPreview).not.toHaveBeenCalled();
  });

  it("throws a retryable error when storing the derived preview object fails", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceExtraction.mockResolvedValue(buildExtractionRow());
    listSourceDocumentFiles.mockResolvedValue([buildPrimaryFile({ format: "png" })]);

    const pngBuffer = buildPngFixture();
    const context = buildContext({
      storage: {
        getObjectStream: vi.fn().mockResolvedValue(Readable.from([pngBuffer])),
        putObject: vi.fn().mockRejectedValue(new Error("bucket unavailable")),
      },
    });

    await expect(handleGeneratePreview(context as never, buildPayload())).rejects.toBeInstanceOf(
      RetryableWorkerError,
    );
    expect(finalizeExtractionPreview).not.toHaveBeenCalled();
  });

  describe("succeeded replay", () => {
    it("never re-renders or re-uploads the preview and delegates repair to the transaction", async () => {
      requireSourceDocument.mockResolvedValue(buildDocumentRow({ processingStatus: "extracting" }));
      requireSourceExtraction.mockResolvedValue(
        buildExtractionRow({
          status: "succeeded",
          previewObjectKey: "already-persisted-key",
          previewObjectVersionId: "already-persisted-v1",
        }),
      );
      finalizeExtractionPreview.mockResolvedValue({
        kind: "repaired",
        extraction: buildExtractionRow({ status: "succeeded" }),
        sourceDocument: buildDocumentRow({ processingStatus: "ready" }),
      });

      const context = buildContext();

      await handleGeneratePreview(context as never, buildPayload());

      // No file lookup, no storage stream/put -- a succeeded extraction is frozen so nothing new
      // can (or needs to) be rendered; the transaction call itself decides whether repair is due.
      expect(listSourceDocumentFiles).not.toHaveBeenCalled();
      expect(context.storage.getObjectStream).not.toHaveBeenCalled();
      expect(context.storage.putObject).not.toHaveBeenCalled();
      expect(finalizeExtractionPreview).toHaveBeenCalledWith(
        context.db,
        expect.objectContaining({
          sourceExtractionId: EXTRACTION_ID,
          preview: null,
        }),
      );
    });

    it("is a true no-op when the transaction reports the extraction is already fully finalized", async () => {
      requireSourceDocument.mockResolvedValue(buildDocumentRow({ processingStatus: "ready" }));
      requireSourceExtraction.mockResolvedValue(buildExtractionRow({ status: "succeeded" }));
      finalizeExtractionPreview.mockResolvedValue({
        kind: "already_finalized",
        extraction: buildExtractionRow({ status: "succeeded" }),
        sourceDocument: buildDocumentRow({ processingStatus: "ready" }),
      });

      await handleGeneratePreview(buildContext() as never, buildPayload());

      expect(finalizeExtractionPreview).toHaveBeenCalledTimes(1);
    });
  });
});
