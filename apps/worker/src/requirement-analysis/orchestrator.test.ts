import { describe, expect, it, vi } from "vitest";

const handleFreezeSnapshot = vi.fn(async () => undefined);
const handlePlanBatches = vi.fn(async () => undefined);
const handleRunBatch = vi.fn(async () => undefined);
const handleFinalizeRun = vi.fn(async () => undefined);
const handleCancelRun = vi.fn(async () => undefined);
const handleCitationVerificationStage = vi.fn(async () => undefined);
const handleNormalizationDeduplicationStage = vi.fn(async () => undefined);
const handleConflictDetectionStage = vi.fn(async () => undefined);
const handleCoverageAnalysisStage = vi.fn(async () => undefined);
const handleDeliveryItemExtractionStage = vi.fn(async () => undefined);
const handleQuestionGenerationStage = vi.fn(async () => undefined);
const handleCitationVerificationJob = vi.fn(async () => undefined);

vi.mock("./stages/freeze-snapshot.js", () => ({ handleFreezeSnapshot }));
vi.mock("./stages/batch-planning.js", () => ({ handlePlanBatches }));
vi.mock("./stages/extraction-batch.js", () => ({ handleRunBatch }));
vi.mock("./stages/finalize.js", () => ({ handleFinalizeRun }));
vi.mock("./stages/cancel.js", () => ({ handleCancelRun }));
vi.mock("./stages/citation-verification.js", () => ({ handleCitationVerificationStage }));
vi.mock("./stages/normalization.js", () => ({ handleNormalizationDeduplicationStage }));
vi.mock("./stages/conflict-detection.js", () => ({ handleConflictDetectionStage }));
vi.mock("./stages/coverage-analysis.js", () => ({ handleCoverageAnalysisStage }));
vi.mock("./stages/delivery-item-extraction.js", () => ({ handleDeliveryItemExtractionStage }));
vi.mock("./stages/question-generation.js", () => ({ handleQuestionGenerationStage }));
vi.mock("./stages/citation-consumer.js", () => ({ handleCitationVerificationJob }));

const { dispatchAiAnalysisJob, dispatchCitationVerificationJob } = await import(
  "./orchestrator.js"
);
const { RequirementAnalysisInvalidStateError } = await import("./errors.js");

const runtime = {} as never;
const aiAnalysisQueue = {} as never;
const citationVerificationQueue = {} as never;

const base = {
  idempotencyKey: "key",
  correlationId: "corr",
  submittedAt: new Date().toISOString(),
  organizationId: "org-1",
  projectId: "project-1",
  runId: "run-1",
};

describe("dispatchAiAnalysisJob", () => {
  it.each([
    [
      "freeze-snapshot",
      { ...base, kind: "freeze-snapshot", actorId: "user-1" },
      handleFreezeSnapshot,
    ],
    ["plan-batches", { ...base, kind: "plan-batches", snapshotId: "snap-1" }, handlePlanBatches],
    [
      "run-batch",
      { ...base, kind: "run-batch", stageId: "stage-1", batchId: "batch-1" },
      handleRunBatch,
    ],
    ["finalize-run", { ...base, kind: "finalize-run" }, handleFinalizeRun],
    ["cancel-run", { ...base, kind: "cancel-run", actorId: "user-1" }, handleCancelRun],
  ] as const)("routes %s jobs to their dedicated handler", async (_label, payload, handler) => {
    handler.mockClear();
    await dispatchAiAnalysisJob(runtime, aiAnalysisQueue, citationVerificationQueue, payload);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["citation_verification", handleCitationVerificationStage],
    ["normalization_deduplication", handleNormalizationDeduplicationStage],
    ["conflict_detection", handleConflictDetectionStage],
    ["coverage_analysis", handleCoverageAnalysisStage],
    ["delivery_item_extraction", handleDeliveryItemExtractionStage],
    ["question_generation", handleQuestionGenerationStage],
  ] as const)("routes run-stage jobs with stageKind %s to their handler", async (stageKind, handler) => {
    handler.mockClear();
    await dispatchAiAnalysisJob(runtime, aiAnalysisQueue, citationVerificationQueue, {
      ...base,
      kind: "run-stage",
      stageId: "stage-1",
      stageKind,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each([
    "freeze_snapshot",
    "batch_planning",
    "confirmed_extraction",
    "reference_feature_extraction",
    "finalize_review_package",
  ] as const)("throws for run-stage jobs carrying the never-routed stageKind %s", async (stageKind) => {
    await expect(
      dispatchAiAnalysisJob(runtime, aiAnalysisQueue, citationVerificationQueue, {
        ...base,
        kind: "run-stage",
        stageId: "stage-1",
        stageKind,
      }),
    ).rejects.toThrow(RequirementAnalysisInvalidStateError);
  });

  it("throws for an unknown job kind", async () => {
    await expect(
      dispatchAiAnalysisJob(runtime, aiAnalysisQueue, citationVerificationQueue, {
        ...base,
        kind: "unknown-kind",
      } as never),
    ).rejects.toThrow(RequirementAnalysisInvalidStateError);
  });
});

describe("dispatchCitationVerificationJob", () => {
  it("delegates to the citation-verification consumer handler", async () => {
    handleCitationVerificationJob.mockClear();
    const payload = { ...base, stageId: "stage-1", batchId: "batch-1" };
    await dispatchCitationVerificationJob(runtime, payload);
    expect(handleCitationVerificationJob).toHaveBeenCalledWith(runtime, payload);
  });
});
