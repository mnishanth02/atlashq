import { beforeEach, describe, expect, it, vi } from "vitest";

const handleVerifyAndScan = vi.fn().mockResolvedValue(undefined);
const handleExtract = vi.fn().mockResolvedValue(undefined);
const handleGeneratePreview = vi.fn().mockResolvedValue(undefined);
const handleCaptureReference = vi.fn().mockResolvedValue(undefined);
const handleExpireUploadSession = vi.fn().mockResolvedValue(undefined);

vi.mock("./verify-and-scan.js", () => ({
  handleVerifyAndScan: (...args: unknown[]) => handleVerifyAndScan(...args),
}));
vi.mock("./extract.js", () => ({ handleExtract: (...args: unknown[]) => handleExtract(...args) }));
vi.mock("./generate-preview.js", () => ({
  handleGeneratePreview: (...args: unknown[]) => handleGeneratePreview(...args),
}));
vi.mock("./capture-reference.js", () => ({
  handleCaptureReference: (...args: unknown[]) => handleCaptureReference(...args),
}));
vi.mock("./expire-upload-session.js", () => ({
  handleExpireUploadSession: (...args: unknown[]) => handleExpireUploadSession(...args),
}));

const { dispatchDocumentProcessingJob } = await import("./dispatch.js");

const ORG_ID = "org-1";
const PROJECT_ID = "project-1";

function basePayload(overrides: Record<string, unknown>) {
  return {
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    idempotencyKey: "key-1",
    correlationId: "corr-1",
    submittedAt: new Date().toISOString(),
    ...overrides,
  };
}

const context = {} as never;
const queue = { add: vi.fn() } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dispatchDocumentProcessingJob", () => {
  it("routes verify-and-scan payloads to handleVerifyAndScan", async () => {
    const payload = basePayload({
      kind: "verify-and-scan",
      sourceDocumentId: "doc-1",
      sourceDocumentFileId: "file-1",
      objectKey: "org-1/project-1/source/doc.pdf",
      expectedSha256: "a".repeat(64),
    });

    const result = await dispatchDocumentProcessingJob(context, queue, payload);

    expect(handleVerifyAndScan).toHaveBeenCalledWith(
      context,
      queue,
      expect.objectContaining(payload),
    );
    expect(result).toEqual({ kind: "verify-and-scan", idempotencyKey: "key-1" });
  });

  it("routes extract payloads to handleExtract", async () => {
    const payload = basePayload({
      kind: "extract",
      sourceDocumentId: "doc-1",
      sourceExtractionId: "extraction-1",
    });

    await dispatchDocumentProcessingJob(context, queue, payload);

    expect(handleExtract).toHaveBeenCalledWith(context, queue, expect.objectContaining(payload));
  });

  it("routes generate-preview payloads to handleGeneratePreview without the queue", async () => {
    const payload = basePayload({
      kind: "generate-preview",
      sourceDocumentId: "doc-1",
      sourceExtractionId: "extraction-1",
    });

    await dispatchDocumentProcessingJob(context, queue, payload);

    expect(handleGeneratePreview).toHaveBeenCalledWith(context, expect.objectContaining(payload));
  });

  it("routes capture-reference payloads to handleCaptureReference", async () => {
    const payload = basePayload({
      kind: "capture-reference",
      sourceDocumentId: "doc-1",
      actorId: "actor-1",
      captureUrl: "https://example.com/page",
    });

    await dispatchDocumentProcessingJob(context, queue, payload);

    expect(handleCaptureReference).toHaveBeenCalledWith(
      context,
      queue,
      expect.objectContaining(payload),
    );
  });

  it("routes expire-upload-session payloads to handleExpireUploadSession without the queue", async () => {
    const payload = basePayload({
      kind: "expire-upload-session",
      uploadSessionId: "session-1",
    });

    await dispatchDocumentProcessingJob(context, queue, payload);

    expect(handleExpireUploadSession).toHaveBeenCalledWith(
      context,
      expect.objectContaining(payload),
    );
  });

  it("rejects a payload with an unknown/invalid kind", async () => {
    const payload = basePayload({ kind: "not-a-real-kind" });

    await expect(dispatchDocumentProcessingJob(context, queue, payload)).rejects.toThrow();

    expect(handleVerifyAndScan).not.toHaveBeenCalled();
  });
});
