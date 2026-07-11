import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSourceDocument = vi.fn();
const requireSourceDocumentFile = vi.fn();
const advanceSourceAfterFileScan = vi.fn();
const updateSourceDocumentProcessingStatus = vi.fn();
const recordWorkerAuditEvent = vi.fn();
const assertSafeZipContainer = vi.fn();
const mkdtempSpy = vi.fn();

/** Default `advanceSourceAfterFileScan` behavior for single-file sources: any clean/terminal file
 * update immediately makes the (only) file's aggregate ready, mirroring the pre-multi-file
 * behavior these single-file tests assert against. Multi-file tests override this per-call. */
function defaultAdvanceResult(outcome: "waiting" | "quarantined" | "failed" | "extraction_ready") {
  if (outcome === "extraction_ready") {
    return { outcome, extraction: { id: "extraction-1" }, alreadyExisted: false };
  }
  return { outcome };
}

vi.mock("../db/source-vault-repository.js", () => ({
  requireSourceDocument: (...args: unknown[]) => requireSourceDocument(...args),
  requireSourceDocumentFile: (...args: unknown[]) => requireSourceDocumentFile(...args),
  advanceSourceAfterFileScan: (...args: unknown[]) => advanceSourceAfterFileScan(...args),
  updateSourceDocumentProcessingStatus: (...args: unknown[]) =>
    updateSourceDocumentProcessingStatus(...args),
}));

vi.mock("../runtime/audit.js", () => ({
  recordWorkerAuditEvent: (...args: unknown[]) => recordWorkerAuditEvent(...args),
}));

vi.mock("../extraction/zip-safety.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../extraction/zip-safety.js")>();
  assertSafeZipContainer.mockImplementation(actual.assertSafeZipContainer);
  return { ...actual, assertSafeZipContainer };
});

// Wraps the real `mkdtemp` so tests can capture the exact per-job scratch directory the handler
// created and later assert it was removed again, without faking the filesystem entirely.
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  mkdtempSpy.mockImplementation(actual.mkdtemp);
  return { ...actual, mkdtemp: mkdtempSpy };
});

const { handleVerifyAndScan } = await import("./verify-and-scan.js");
const { RetryableWorkerError, InvalidJobDataError } = await import("../errors.js");
const { UnsafeZipContainerError } = await import("../extraction/zip-safety.js");

/** Returns the scratch directory the handler's `mkdtemp()` call created during the last run. */
async function capturedTempDir(): Promise<string | undefined> {
  const result = mkdtempSpy.mock.results.at(-1);
  return result ? ((await result.value) as string) : undefined;
}

const SOURCE_DOCUMENT_ID = "11111111-1111-1111-1111-111111111111";
const FILE_ID = "22222222-2222-2222-2222-222222222222";
const ORG_ID = "org-1";
const PROJECT_ID = "project-1";
const OBJECT_KEY = "org-1/project-1/source/abc.pdf";
const DEFAULT_CONTENT = Buffer.from("hello world!");
const SHA256 = (await import("node:crypto"))
  .createHash("sha256")
  .update(DEFAULT_CONTENT)
  .digest("hex");

function buildPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: "verify-and-scan" as const,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    idempotencyKey: "key-1",
    correlationId: "corr-1",
    submittedAt: new Date().toISOString(),
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    sourceDocumentFileId: FILE_ID,
    objectKey: OBJECT_KEY,
    expectedSha256: SHA256,
    ...overrides,
  };
}

function buildDocumentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SOURCE_DOCUMENT_ID,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    createdBy: "actor-1",
    processingStatus: "scan_pending",
    ...overrides,
  };
}

function buildFileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: FILE_ID,
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    objectKey: OBJECT_KEY,
    sha256: SHA256,
    byteSize: 12,
    format: "txt",
    scanStatus: "pending",
    ...overrides,
  };
}

function buildContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    db: {},
    storage: {
      statObject: vi.fn().mockResolvedValue({ sizeBytes: 12 }),
      getObjectStream: vi.fn().mockResolvedValue(Readable.from([Buffer.from("hello world!")])),
    },
    clamav: {
      scanStream: vi.fn(),
    },
    env: { SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES: 1_000_000 },
    ...overrides,
  };
}

function buildQueue() {
  return { add: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Mirrors the (single-file) aggregate outcome `advanceSourceAfterFileScan` would compute for a
  // source with exactly one file: a replay call (no `fileUpdate`) waits, `infected`/`failed`
  // file updates produce the matching terminal outcome, and anything else (i.e. `clean`) is
  // immediately ready since there are no sibling files left to wait on. Multi-file tests below
  // override this per-call to script cross-file coordination explicitly.
  advanceSourceAfterFileScan.mockImplementation(
    async (_db: unknown, input: { fileUpdate?: { scanStatus: string } }) => {
      if (!input.fileUpdate) {
        return defaultAdvanceResult("waiting");
      }
      if (input.fileUpdate.scanStatus === "infected") {
        return defaultAdvanceResult("quarantined");
      }
      if (input.fileUpdate.scanStatus === "failed") {
        return defaultAdvanceResult("failed");
      }
      return defaultAdvanceResult("extraction_ready");
    },
  );
});

describe("handleVerifyAndScan", () => {
  it("marks the file clean, transitions to extraction_pending, and enqueues extract", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow());

    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "clean",
      bytesScanned: 12,
      version: { engineVersion: "1.0", signatureVersion: "1", raw: "", signatureTimestamp: null },
    });
    const queue = buildQueue();

    await handleVerifyAndScan(context as never, queue as never, buildPayload());

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        sourceDocumentId: SOURCE_DOCUMENT_ID,
        fileUpdate: expect.objectContaining({ sourceDocumentFileId: FILE_ID, scanStatus: "clean" }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      "extract",
      expect.objectContaining({ kind: "extract", sourceExtractionId: "extraction-1" }),
      expect.anything(),
    );
  });

  it("quarantines on ClamAV infected result", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow());

    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "infected",
      signature: "Eicar-Test-Signature",
      bytesScanned: 12,
    });

    await expect(
      handleVerifyAndScan(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toThrow(UnrecoverableError);

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({
          sourceDocumentFileId: FILE_ID,
          scanStatus: "infected",
        }),
      }),
    );
  });

  it("fails on recomputed hash mismatch and never reaches ClamAV", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    const declaredSha256 = "f".repeat(64);
    requireSourceDocumentFile.mockResolvedValue(buildFileRow({ sha256: declaredSha256 }));

    const context = buildContext();

    await expect(
      handleVerifyAndScan(
        context as never,
        buildQueue() as never,
        buildPayload({ expectedSha256: declaredSha256 }),
      ),
    ).rejects.toThrow(UnrecoverableError);

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({
          sourceDocumentFileId: FILE_ID,
          scanStatus: "failed",
        }),
      }),
    );
    expect(
      (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream,
    ).not.toHaveBeenCalled();
  });

  it("fails on actual/declared type mismatch (PDF magic bytes declared as txt)", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());

    const pngBuffer = Buffer.from("not a real png but declared png");
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(pngBuffer).digest("hex");
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ format: "png", sha256, byteSize: pngBuffer.length }),
    );

    const context = buildContext({
      storage: {
        statObject: vi.fn().mockResolvedValue({ sizeBytes: pngBuffer.length }),
        getObjectStream: vi.fn().mockResolvedValue(Readable.from([pngBuffer])),
      },
    });

    await expect(
      handleVerifyAndScan(
        context as never,
        buildQueue() as never,
        buildPayload({ expectedSha256: sha256 }),
      ),
    ).rejects.toThrow(UnrecoverableError);

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({
          sourceDocumentFileId: FILE_ID,
          scanStatus: "failed",
        }),
      }),
    );
  });

  it("fails when the declared byte count grows past the configured max during streaming", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    const bigChunk = Buffer.alloc(2_000, 0x61);
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(bigChunk).digest("hex");
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ format: "txt", sha256, byteSize: bigChunk.length }),
    );

    const context = buildContext({
      storage: {
        statObject: vi.fn().mockResolvedValue({ sizeBytes: bigChunk.length }),
        getObjectStream: vi.fn().mockResolvedValue(Readable.from([bigChunk])),
      },
      env: { SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES: 1_000 },
    });

    await expect(
      handleVerifyAndScan(
        context as never,
        buildQueue() as never,
        buildPayload({ expectedSha256: sha256 }),
      ),
    ).rejects.toThrow(UnrecoverableError);

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({
          sourceDocumentFileId: FILE_ID,
          scanStatus: "failed",
        }),
      }),
    );
  });

  it("fails on an unsafe ZIP container for docx before ClamAV ever runs", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());

    const { buildDocxFixture } = await import("../extraction/__fixtures__/build-fixtures.js");
    const docxBuffer = await buildDocxFixture();
    const { createHash } = await import("node:crypto");
    const docxSha256 = createHash("sha256").update(docxBuffer).digest("hex");
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ format: "docx", sha256: docxSha256, byteSize: docxBuffer.length }),
    );

    assertSafeZipContainer.mockImplementationOnce(() => {
      throw new UnsafeZipContainerError("ZIP container declares too many entries.");
    });

    const context = buildContext({
      storage: {
        statObject: vi.fn().mockResolvedValue({ sizeBytes: docxBuffer.length }),
        getObjectStream: vi.fn().mockResolvedValue(Readable.from([docxBuffer])),
      },
    });

    await expect(
      handleVerifyAndScan(
        context as never,
        buildQueue() as never,
        buildPayload({ expectedSha256: docxSha256 }),
      ),
    ).rejects.toThrow(UnrecoverableError);

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({
          sourceDocumentFileId: FILE_ID,
          scanStatus: "failed",
        }),
      }),
    );
    expect(
      (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream,
    ).not.toHaveBeenCalled();
  });

  it("proceeds past zip-safety to ClamAV for a legitimate, safe docx", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());

    const { buildDocxFixture } = await import("../extraction/__fixtures__/build-fixtures.js");
    const docxBuffer = await buildDocxFixture();
    const { createHash } = await import("node:crypto");
    const docxSha256 = createHash("sha256").update(docxBuffer).digest("hex");
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ format: "docx", sha256: docxSha256, byteSize: docxBuffer.length }),
    );

    const context = buildContext({
      storage: {
        statObject: vi.fn().mockResolvedValue({ sizeBytes: docxBuffer.length }),
        getObjectStream: vi.fn().mockResolvedValue(Readable.from([docxBuffer])),
      },
    });
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "clean",
      bytesScanned: docxBuffer.length,
      version: { engineVersion: "1.0", signatureVersion: "1", raw: "", signatureTimestamp: null },
    });

    await handleVerifyAndScan(
      context as never,
      buildQueue() as never,
      buildPayload({ expectedSha256: docxSha256 }),
    );

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({ sourceDocumentFileId: FILE_ID, scanStatus: "clean" }),
      }),
    );
  });

  it("throws a retryable error when ClamAV is unavailable, without changing document state", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow());

    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "unavailable",
      retryable: true,
      reason: "connection refused",
    });

    await expect(
      handleVerifyAndScan(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(RetryableWorkerError);

    expect(advanceSourceAfterFileScan).not.toHaveBeenCalled();
  });

  it("is idempotent: a replay for a file already reaching a terminal scan status is a no-op scan (only coordination reruns)", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow({ scanStatus: "clean" }));
    advanceSourceAfterFileScan.mockResolvedValue({ outcome: "waiting" });

    const context = buildContext();

    await handleVerifyAndScan(context as never, buildQueue() as never, buildPayload());

    expect(
      (context.storage as { statObject: ReturnType<typeof vi.fn> }).statObject,
    ).not.toHaveBeenCalled();
    expect(
      (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream,
    ).not.toHaveBeenCalled();
    // Replay still re-runs cross-file coordination (no `fileUpdate`), so a source stuck because a
    // sibling file's job crashed mid-flight can still catch up.
    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({ sourceDocumentId: SOURCE_DOCUMENT_ID }),
    );
    expect(advanceSourceAfterFileScan.mock.calls[0]?.[1]).not.toHaveProperty("fileUpdate");
  });

  it("rejects a payload objectKey that does not match the source_document_file row", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow({ objectKey: "different-key" }));

    await expect(
      handleVerifyAndScan(buildContext() as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(InvalidJobDataError);
  });

  it("scans ClamAV from a real fs.ReadStream off disk, never from a full in-memory Buffer", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow());

    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "clean",
      bytesScanned: 12,
      version: { engineVersion: "1.0", signatureVersion: "1", raw: "", signatureTimestamp: null },
    });

    await handleVerifyAndScan(context as never, buildQueue() as never, buildPayload());

    const scanStreamMock = (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream;
    expect(scanStreamMock).toHaveBeenCalledTimes(1);
    const scanInput = scanStreamMock.mock.calls[0]?.[0];
    // `fs.createReadStream(...)` exposes a `path` property; `Readable.from(buffer)` does not --
    // this proves the ClamAV input is a genuine file stream, not a Buffer-backed stream.
    expect(scanInput).toHaveProperty("path");
    expect(typeof scanInput.path === "string" || Buffer.isBuffer(scanInput.path)).toBe(true);

    const tempDir = await capturedTempDir();
    expect(tempDir).toBeDefined();
    expect(String(scanInput.path)).toContain(tempDir as string);
  });

  it("removes the per-job temp directory after a clean scan", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow());

    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "clean",
      bytesScanned: 12,
      version: { engineVersion: "1.0", signatureVersion: "1", raw: "", signatureTimestamp: null },
    });

    await handleVerifyAndScan(context as never, buildQueue() as never, buildPayload());

    const tempDir = await capturedTempDir();
    expect(tempDir).toBeDefined();
    expect(existsSync(tempDir as string)).toBe(false);
  });

  it("removes the per-job temp directory after an infected scan", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow());

    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "infected",
      signature: "Eicar-Test-Signature",
      bytesScanned: 12,
    });

    await expect(
      handleVerifyAndScan(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toThrow(UnrecoverableError);

    const tempDir = await capturedTempDir();
    expect(tempDir).toBeDefined();
    expect(existsSync(tempDir as string)).toBe(false);
  });

  it("removes the per-job temp directory after a retryable ClamAV failure", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(buildFileRow());

    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "unavailable",
      retryable: true,
      reason: "connection refused",
    });

    await expect(
      handleVerifyAndScan(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(RetryableWorkerError);

    const tempDir = await capturedTempDir();
    expect(tempDir).toBeDefined();
    expect(existsSync(tempDir as string)).toBe(false);
  });

  it("removes the per-job temp directory after a terminal validation failure (hash mismatch)", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    const declaredSha256 = "f".repeat(64);
    requireSourceDocumentFile.mockResolvedValue(buildFileRow({ sha256: declaredSha256 }));

    const context = buildContext();

    await expect(
      handleVerifyAndScan(
        context as never,
        buildQueue() as never,
        buildPayload({ expectedSha256: declaredSha256 }),
      ),
    ).rejects.toThrow(UnrecoverableError);

    const tempDir = await capturedTempDir();
    expect(tempDir).toBeDefined();
    expect(existsSync(tempDir as string)).toBe(false);
  });

  it("removes the per-job temp directory after an unsafe-ZIP terminal failure", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());

    const { buildDocxFixture } = await import("../extraction/__fixtures__/build-fixtures.js");
    const docxBuffer = await buildDocxFixture();
    const { createHash } = await import("node:crypto");
    const docxSha256 = createHash("sha256").update(docxBuffer).digest("hex");
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ format: "docx", sha256: docxSha256, byteSize: docxBuffer.length }),
    );

    assertSafeZipContainer.mockImplementationOnce(() => {
      throw new UnsafeZipContainerError("ZIP container declares too many entries.");
    });

    const context = buildContext({
      storage: {
        statObject: vi.fn().mockResolvedValue({ sizeBytes: docxBuffer.length }),
        getObjectStream: vi.fn().mockResolvedValue(Readable.from([docxBuffer])),
      },
    });

    await expect(
      handleVerifyAndScan(
        context as never,
        buildQueue() as never,
        buildPayload({ expectedSha256: docxSha256 }),
      ),
    ).rejects.toThrow(UnrecoverableError);

    const tempDir = await capturedTempDir();
    expect(tempDir).toBeDefined();
    expect(existsSync(tempDir as string)).toBe(false);
  });

  it("removes the per-job temp directory even when the oversized-streaming guard aborts mid-stream", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    const bigChunk = Buffer.alloc(2_000, 0x61);
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(bigChunk).digest("hex");
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ format: "txt", sha256, byteSize: bigChunk.length }),
    );

    const context = buildContext({
      storage: {
        statObject: vi.fn().mockResolvedValue({ sizeBytes: bigChunk.length }),
        getObjectStream: vi.fn().mockResolvedValue(Readable.from([bigChunk])),
      },
      env: { SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES: 1_000 },
    });

    await expect(
      handleVerifyAndScan(
        context as never,
        buildQueue() as never,
        buildPayload({ expectedSha256: sha256 }),
      ),
    ).rejects.toThrow(UnrecoverableError);

    const tempDir = await capturedTempDir();
    expect(tempDir).toBeDefined();
    expect(existsSync(tempDir as string)).toBe(false);
  });
});

describe("handleVerifyAndScan multi-file screenshot-set coordination", () => {
  const FILE_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const FILE_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  function buildCleanContext() {
    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "clean",
      bytesScanned: 12,
      version: { engineVersion: "1.0", signatureVersion: "1", raw: "", signatureTimestamp: null },
    });
    return context;
  }

  it("first file's clean scan alone does not enqueue extract (sibling still pending)", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ id: FILE_A_ID, scanStatus: "pending" }),
    );
    // The repository's real cross-file aggregate would see file B still `pending` and wait.
    advanceSourceAfterFileScan.mockResolvedValue({ outcome: "waiting" });

    const context = buildCleanContext();
    const queue = buildQueue();
    await handleVerifyAndScan(
      context as never,
      queue as never,
      buildPayload({ sourceDocumentFileId: FILE_A_ID }),
    );

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({
          sourceDocumentFileId: FILE_A_ID,
          scanStatus: "clean",
        }),
      }),
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("second file's clean scan (last file) enqueues extract exactly once", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ id: FILE_B_ID, scanStatus: "pending" }),
    );
    advanceSourceAfterFileScan.mockResolvedValue({
      outcome: "extraction_ready",
      extraction: { id: "extraction-multi-1" },
      alreadyExisted: false,
    });

    const queue = buildQueue();
    await handleVerifyAndScan(
      buildCleanContext() as never,
      queue as never,
      buildPayload({ sourceDocumentFileId: FILE_B_ID }),
    );

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      "extract",
      expect.objectContaining({ kind: "extract", sourceExtractionId: "extraction-multi-1" }),
      expect.anything(),
    );
  });

  it("replaying an already-clean file does not duplicate the extraction/extract enqueue beyond BullMQ's own dedupe", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ id: FILE_B_ID, scanStatus: "clean" }),
    );
    advanceSourceAfterFileScan.mockResolvedValue({
      outcome: "extraction_ready",
      extraction: { id: "extraction-multi-1" },
      alreadyExisted: true,
    });

    const queue = buildQueue();
    const context = buildContext();
    await handleVerifyAndScan(
      context as never,
      queue as never,
      buildPayload({ sourceDocumentFileId: FILE_B_ID }),
    );

    // Replay never re-scans (statObject/scanStream are never reached) and re-derives the same
    // extraction id, so the enqueue call is identical to the original -- BullMQ's `jobId` dedupe
    // (keyed on the extraction id) makes this safe rather than creating a duplicate job.
    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({ sourceDocumentId: SOURCE_DOCUMENT_ID }),
    );
    expect(advanceSourceAfterFileScan.mock.calls[0]?.[1]).not.toHaveProperty("fileUpdate");
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      "extract",
      expect.objectContaining({ kind: "extract", sourceExtractionId: "extraction-multi-1" }),
      expect.anything(),
    );
  });

  it("second file infected quarantines the whole source and never enqueues extract", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    requireSourceDocumentFile.mockResolvedValue(
      buildFileRow({ id: FILE_B_ID, scanStatus: "pending" }),
    );
    advanceSourceAfterFileScan.mockResolvedValue({ outcome: "quarantined" });

    const context = buildContext();
    (context.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream.mockResolvedValue({
      status: "infected",
      signature: "Eicar-Test-Signature",
      bytesScanned: 12,
    });
    const queue = buildQueue();

    await expect(
      handleVerifyAndScan(
        context as never,
        queue as never,
        buildPayload({ sourceDocumentFileId: FILE_B_ID }),
      ),
    ).rejects.toThrow(UnrecoverableError);

    expect(advanceSourceAfterFileScan).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({
          sourceDocumentFileId: FILE_B_ID,
          scanStatus: "infected",
        }),
      }),
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("every file in a multi-file source is independently scanned by ClamAV (one job per file)", async () => {
    requireSourceDocument.mockResolvedValue(buildDocumentRow());
    advanceSourceAfterFileScan.mockResolvedValue({ outcome: "waiting" });

    const contextA = buildCleanContext();
    requireSourceDocumentFile.mockResolvedValueOnce(
      buildFileRow({ id: FILE_A_ID, scanStatus: "pending" }),
    );
    await handleVerifyAndScan(
      contextA as never,
      buildQueue() as never,
      buildPayload({ sourceDocumentFileId: FILE_A_ID }),
    );

    const contextB = buildCleanContext();
    requireSourceDocumentFile.mockResolvedValueOnce(
      buildFileRow({ id: FILE_B_ID, scanStatus: "pending" }),
    );
    await handleVerifyAndScan(
      contextB as never,
      buildQueue() as never,
      buildPayload({ sourceDocumentFileId: FILE_B_ID }),
    );

    expect(
      (contextA.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream,
    ).toHaveBeenCalledTimes(1);
    expect(
      (contextB.clamav as { scanStream: ReturnType<typeof vi.fn> }).scanStream,
    ).toHaveBeenCalledTimes(1);
    expect(advanceSourceAfterFileScan).toHaveBeenNthCalledWith(
      1,
      contextA.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({ sourceDocumentFileId: FILE_A_ID }),
      }),
    );
    expect(advanceSourceAfterFileScan).toHaveBeenNthCalledWith(
      2,
      contextB.db,
      expect.objectContaining({
        fileUpdate: expect.objectContaining({ sourceDocumentFileId: FILE_B_ID }),
      }),
    );
  });
});
