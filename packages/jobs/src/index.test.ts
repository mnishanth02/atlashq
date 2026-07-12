import { describe, expect, it } from "vitest";
import {
  captureReferenceJobPayloadSchema,
  citationVerificationJobPayloadSchema,
  createCitationVerificationIdempotencyKey,
  createIdempotencyKey,
  createRequirementAnalysisIdempotencyKey,
  documentProcessingJobPayloadSchema,
  expireUploadSessionJobPayloadSchema,
  extractJobPayloadSchema,
  finalizeRunJobPayloadSchema,
  freezeSnapshotJobPayloadSchema,
  generatePreviewJobPayloadSchema,
  parseCitationVerificationJobPayload,
  parseDocumentProcessingJobPayload,
  parseJobPayload,
  parseRequirementAnalysisJobPayload,
  planBatchesJobPayloadSchema,
  queueNames,
  requirementAnalysisJobPayloadSchema,
  runBatchJobPayloadSchema,
  runStageJobPayloadSchema,
  verifyAndScanJobPayloadSchema,
} from "./index.js";

const baseFields = {
  idempotencyKey: "document-processing:verify-and-scan:source-file-1",
  correlationId: "corr-1",
  organizationId: "org-1",
  projectId: "project-1",
  submittedAt: "2026-07-09T05:30:00.000Z",
};

describe("queue payload contracts", () => {
  it("keeps worker queue names and generic queue payloads", () => {
    expect(queueNames).toContain("document-processing");
    expect(queueNames).toContain("ai-analysis");
    expect(queueNames).toContain("citation-verification");

    const maintenancePayload = parseJobPayload("maintenance", {
      idempotencyKey: "maintenance:daily:2026-07-09",
      correlationId: "corr-1",
      submittedAt: "2026-07-09T05:30:00.000Z",
    });
    expect(maintenancePayload).toMatchObject({ correlationId: "corr-1" });

    for (const queueName of ["export-generation", "github-sync"] as const) {
      expect(
        parseJobPayload(queueName, {
          idempotencyKey: `${queueName}:job-1`,
          correlationId: "corr-2",
          submittedAt: "2026-07-09T05:30:00.000Z",
        }),
      ).toMatchObject({ correlationId: "corr-2" });
    }

    expect(
      createIdempotencyKey({
        queueName: "maintenance",
        operation: "daily",
        resourceId: "2026-07-09",
      }),
    ).toBe("maintenance:daily:2026-07-09");
  });
});

describe("document-processing job discriminated union", () => {
  it("parses a verify-and-scan payload with the exact required fields", () => {
    const payload = {
      ...baseFields,
      kind: "verify-and-scan" as const,
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

  it("parses an extract payload keyed by the pre-created extraction id", () => {
    const payload = {
      ...baseFields,
      kind: "extract" as const,
      sourceDocumentId: "source-1",
      sourceExtractionId: "extraction-1",
    };
    expect(extractJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("extract");
  });

  it("parses a generate-preview payload keyed by the extraction id", () => {
    const payload = {
      ...baseFields,
      kind: "generate-preview" as const,
      sourceDocumentId: "source-1",
      sourceExtractionId: "extraction-1",
    };
    expect(generatePreviewJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("generate-preview");
  });

  it("parses a capture-reference payload requiring an actor and capture URL", () => {
    const payload = {
      ...baseFields,
      kind: "capture-reference" as const,
      sourceDocumentId: "source-1",
      actorId: "user-1",
      captureUrl: "https://example.com/page",
    };
    expect(captureReferenceJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("capture-reference");
  });

  it("parses an expire-upload-session payload keyed by the upload session id", () => {
    const payload = {
      ...baseFields,
      kind: "expire-upload-session" as const,
      uploadSessionId: "upload-session-1",
    };
    expect(expireUploadSessionJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(documentProcessingJobPayloadSchema.parse(payload).kind).toBe("expire-upload-session");
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

describe("module 3 requirement-analysis payload union", () => {
  const analysisBase = {
    idempotencyKey: "ai-analysis_freeze-snapshot_run-1",
    correlationId: "corr-ai-1",
    organizationId: "org-1",
    projectId: "project-1",
    runId: "run-1",
    submittedAt: "2026-07-09T05:30:00.000Z",
  };

  it("parses freeze-snapshot and cancel-run payloads requiring actor id", () => {
    const freezePayload = {
      ...analysisBase,
      kind: "freeze-snapshot" as const,
      actorId: "user-1",
      sourceDocumentIds: ["source-1", "source-2"],
    };
    expect(freezeSnapshotJobPayloadSchema.parse(freezePayload)).toMatchObject(freezePayload);
    expect(requirementAnalysisJobPayloadSchema.parse(freezePayload).kind).toBe("freeze-snapshot");
    expect(parseRequirementAnalysisJobPayload(freezePayload).kind).toBe("freeze-snapshot");
    expect(freezeSnapshotJobPayloadSchema.parse(freezePayload).sourceDocumentIds).toEqual([
      "source-1",
      "source-2",
    ]);

    const cancelPayload = {
      ...analysisBase,
      kind: "cancel-run" as const,
      actorId: "user-1",
    };
    expect(requirementAnalysisJobPayloadSchema.parse(cancelPayload).kind).toBe("cancel-run");
  });

  it("parses plan-batches, run-stage, run-batch, and finalize-run payloads", () => {
    const planPayload = {
      ...analysisBase,
      kind: "plan-batches" as const,
      snapshotId: "snapshot-1",
    };
    expect(planBatchesJobPayloadSchema.parse(planPayload)).toMatchObject(planPayload);

    const runStagePayload = {
      ...analysisBase,
      kind: "run-stage" as const,
      stageId: "stage-1",
      stageKind: "coverage_analysis" as const,
    };
    expect(runStageJobPayloadSchema.parse(runStagePayload)).toMatchObject(runStagePayload);

    const runBatchPayload = {
      ...analysisBase,
      kind: "run-batch" as const,
      stageId: "stage-1",
      batchId: "batch-1",
    };
    expect(runBatchJobPayloadSchema.parse(runBatchPayload)).toMatchObject(runBatchPayload);

    const finalizePayload = {
      ...analysisBase,
      kind: "finalize-run" as const,
    };
    expect(finalizeRunJobPayloadSchema.parse(finalizePayload)).toMatchObject(finalizePayload);
  });

  it("rejects run-stage payloads with unknown stage kinds", () => {
    expect(() =>
      runStageJobPayloadSchema.parse({
        ...analysisBase,
        kind: "run-stage",
        stageId: "stage-1",
        stageKind: "invalid_stage_kind",
      }),
    ).toThrow();
  });

  it("maps parseJobPayload(ai-analysis) to the requirement-analysis schema", () => {
    const parsed = parseJobPayload("ai-analysis", {
      ...analysisBase,
      kind: "run-batch",
      stageId: "stage-1",
      batchId: "batch-1",
    });
    expect(parsed.kind).toBe("run-batch");
  });
});

describe("module 3 citation-verification payload schema", () => {
  const payload = {
    idempotencyKey: "citation-verification_verify-batch_run-1_stage-1_batch-1",
    correlationId: "corr-cv-1",
    organizationId: "org-1",
    projectId: "project-1",
    runId: "run-1",
    stageId: "stage-1",
    batchId: "batch-1",
    submittedAt: "2026-07-09T05:30:00.000Z",
  };

  it("requires run/stage/batch identifiers", () => {
    expect(citationVerificationJobPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(parseCitationVerificationJobPayload(payload)).toMatchObject(payload);
    expect(parseJobPayload("citation-verification", payload)).toMatchObject(payload);
  });

  it("rejects missing stage or batch scope", () => {
    expect(() =>
      citationVerificationJobPayloadSchema.parse({
        ...payload,
        stageId: undefined,
      }),
    ).toThrow();
    expect(() =>
      citationVerificationJobPayloadSchema.parse({
        ...payload,
        batchId: undefined,
      }),
    ).toThrow();
  });
});

describe("module 3 idempotency helpers", () => {
  it("builds stable ai-analysis idempotency keys per run/stage/batch scope", () => {
    expect(
      createRequirementAnalysisIdempotencyKey({
        kind: "freeze-snapshot",
        runId: "run-1",
      }),
    ).toBe("ai-analysis_freeze-snapshot_run-1");
    expect(
      createRequirementAnalysisIdempotencyKey({
        kind: "plan-batches",
        runId: "run-1",
        snapshotId: "snapshot-1",
      }),
    ).toBe("ai-analysis_plan-batches_run-1_snapshot-1");
    expect(
      createRequirementAnalysisIdempotencyKey({
        kind: "run-batch",
        runId: "run-1",
        stageId: "stage-1",
        batchId: "batch-1",
      }),
    ).toBe("ai-analysis_run-batch_run-1_stage-1_batch-1");
  });

  it("builds stable citation-verification idempotency keys", () => {
    expect(
      createCitationVerificationIdempotencyKey({
        runId: "run-1",
        stageId: "stage-1",
        batchId: "batch-1",
      }),
    ).toBe("citation-verification_verify-batch_run-1_stage-1_batch-1");
  });
});
