import { describe, expect, it } from "vitest";
import {
  captureReferenceJobPayloadSchema,
  createIdempotencyKey,
  documentProcessingJobPayloadSchema,
  expireUploadSessionJobPayloadSchema,
  extractJobPayloadSchema,
  generatePreviewJobPayloadSchema,
  parseDocumentProcessingJobPayload,
  parseJobPayload,
  queueNames,
  verifyAndScanJobPayloadSchema,
} from "./index.js";

const baseFields = {
  idempotencyKey: "document-processing:verify-and-scan:source-file-1",
  correlationId: "corr-1",
  organizationId: "org-1",
  projectId: "project-1",
  submittedAt: "2026-07-09T05:30:00.000Z",
};

describe("job placeholders", () => {
  it("keeps worker queue names and validates payloads", () => {
    expect(queueNames).toContain("document-processing");
    expect(
      parseJobPayload("maintenance", {
        idempotencyKey: "maintenance:daily:2026-07-09",
        correlationId: "corr-1",
        submittedAt: "2026-07-09T05:30:00.000Z",
      }),
    ).toMatchObject({ correlationId: "corr-1" });
    expect(
      createIdempotencyKey({
        queueName: "maintenance",
        operation: "daily",
        resourceId: "2026-07-09",
      }),
    ).toBe("maintenance:daily:2026-07-09");
  });

  it("keeps the other queues on the plain base payload contract", () => {
    const payload = {
      idempotencyKey: "ai-analysis:run:ai-run-1",
      correlationId: "corr-2",
      submittedAt: "2026-07-09T05:30:00.000Z",
    };
    for (const queueName of [
      "citation-verification",
      "export-generation",
      "github-sync",
    ] as const) {
      expect(parseJobPayload(queueName, payload)).toMatchObject({ correlationId: "corr-2" });
    }
  });
});

describe("document-processing job discriminated union", () => {
  it("parses a verify-and-scan payload with the exact required fields", () => {
    const payload = {
      ...baseFields,
      kind: "verify-and-scan",
      sourceDocumentId: "source-1",
      sourceDocumentFileId: "source-file-1",
      objectKey: "org-1/project-1/uploads/source-file-1",
      expectedSha256: "a".repeat(64),
    };
    expect(verifyAndScanJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("verify-and-scan");
    expect(parseDocumentProcessingJobPayload(payload).kind).toBe("verify-and-scan");
  });

  it("rejects a verify-and-scan payload with a non-hex expected hash", () => {
    expect(() =>
      verifyAndScanJobPayloadSchema.parse({
        ...baseFields,
        kind: "verify-and-scan",
        sourceDocumentId: "source-1",
        sourceDocumentFileId: "source-file-1",
        objectKey: "org-1/project-1/uploads/source-file-1",
        expectedSha256: "not-a-hash",
      }),
    ).toThrow();
  });

  it("rejects a verify-and-scan payload missing sourceDocumentFileId", () => {
    expect(() =>
      verifyAndScanJobPayloadSchema.parse({
        ...baseFields,
        kind: "verify-and-scan",
        sourceDocumentId: "source-1",
        objectKey: "org-1/project-1/uploads/source-file-1",
        expectedSha256: "a".repeat(64),
      }),
    ).toThrow();
  });

  it("parses an extract payload keyed by the pre-created extraction id", () => {
    const payload = {
      ...baseFields,
      kind: "extract",
      sourceDocumentId: "source-1",
      sourceExtractionId: "extraction-1",
    };
    expect(extractJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("extract");
  });

  it("parses a generate-preview payload keyed by the extraction id", () => {
    const payload = {
      ...baseFields,
      kind: "generate-preview",
      sourceDocumentId: "source-1",
      sourceExtractionId: "extraction-1",
    };
    expect(generatePreviewJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("generate-preview");
  });

  it("parses a capture-reference payload requiring an actor and capture URL", () => {
    const payload = {
      ...baseFields,
      kind: "capture-reference",
      sourceDocumentId: "source-1",
      actorId: "user-1",
      captureUrl: "https://example.com/page",
    };
    expect(captureReferenceJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("capture-reference");
  });

  it("rejects a capture-reference payload missing the actor id", () => {
    expect(() =>
      captureReferenceJobPayloadSchema.parse({
        ...baseFields,
        kind: "capture-reference",
        sourceDocumentId: "source-1",
        captureUrl: "https://example.com/page",
      }),
    ).toThrow();
  });

  it("parses an expire-upload-session payload keyed by the upload session id", () => {
    const payload = {
      ...baseFields,
      kind: "expire-upload-session",
      uploadSessionId: "upload-session-1",
    };
    expect(expireUploadSessionJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("expire-upload-session");
  });

  it("rejects an unknown job kind", () => {
    expect(() =>
      documentProcessingJobPayloadSchema.parse({
        ...baseFields,
        kind: "unknown-kind",
      }),
    ).toThrow();
  });

  it("requires organizationId and projectId on every document-processing job kind", () => {
    expect(() =>
      expireUploadSessionJobPayloadSchema.parse({
        idempotencyKey: baseFields.idempotencyKey,
        correlationId: baseFields.correlationId,
        submittedAt: baseFields.submittedAt,
        kind: "expire-upload-session",
        uploadSessionId: "upload-session-1",
      }),
    ).toThrow();
  });
});
