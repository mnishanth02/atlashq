import { beforeEach, describe, expect, it } from "vitest";
import { RunBudgetExceededError, RunCanceledError } from "../errors.js";
import { buildStageIdempotencyKey } from "../ids.js";
import type { EligibleSnapshotSourceCandidate } from "../repository/types.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createRecordingAiAnalysisQueue,
} from "../test-support/fixtures.js";
import { handlePlanBatches } from "./batch-planning.js";
import { handleFreezeSnapshot } from "./freeze-snapshot.js";

function buildCandidate(
  overrides: Partial<EligibleSnapshotSourceCandidate> = {},
): EligibleSnapshotSourceCandidate {
  return {
    sourceDocumentId: "source-1",
    lineageId: "lineage-1",
    versionNumber: 1,
    contentHash: "a".repeat(64),
    sourceExtractionId: "extraction-1",
    extractionVersion: 1,
    chunkerVersion: "chunker-v1",
    extractedTextHash: null,
    referenceArtifactId: null,
    referenceIpReviewStatus: null,
    isReference: false,
    files: [],
    chunks: [
      {
        sourceChunkId: "chunk-1",
        sequence: 0,
        contentHash: "b".repeat(64),
        characterCount: 42,
        locator: {},
        content: "The system shall do X.",
      },
    ],
    ...overrides,
  };
}

async function freezeAndSeed(
  runtime: ReturnType<typeof buildTestRuntime>["runtime"],
  repository: ReturnType<typeof buildTestRuntime>["repository"],
  run: ReturnType<typeof buildTestRun>,
  candidates: EligibleSnapshotSourceCandidate[],
) {
  repository.seedRun(run);
  repository.seedProviderPolicy(buildTestProviderPolicy());
  repository.seedEligibleCandidates(candidates);
  const freezeQueue = createRecordingAiAnalysisQueue();
  const freezeResult = await handleFreezeSnapshot(runtime, freezeQueue, {
    kind: "freeze-snapshot",
    idempotencyKey: "freeze-1",
    correlationId: run.id,
    organizationId: run.organizationId,
    projectId: run.projectId,
    runId: run.id,
    actorId: "user-1",
    submittedAt: runtime.now().toISOString(),
  });
  const refreshedRun = await repository.getRun(run.id);
  if (!refreshedRun) {
    throw new Error("run missing after freeze");
  }
  return { snapshotId: freezeResult.snapshotId, run: refreshedRun };
}

describe("handlePlanBatches", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];
  let queue: ReturnType<typeof createRecordingAiAnalysisQueue>;

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
    queue = createRecordingAiAnalysisQueue();
  });

  it("creates every pipeline stage row + dependency, plans confirmed batches, and enqueues run-batch jobs", async () => {
    const run = buildTestRun();
    const { snapshotId } = await freezeAndSeed(runtime, repository, run, [buildCandidate()]);

    await handlePlanBatches(runtime, queue, {
      kind: "plan-batches",
      idempotencyKey: "plan-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      snapshotId,
      submittedAt: runtime.now().toISOString(),
    });

    const stages = await repository.listStagesByRun(run.id);
    const kinds = stages.map((stage) => stage.kind).sort();
    expect(kinds).toEqual(
      [
        "freeze_snapshot",
        "batch_planning",
        "confirmed_extraction",
        "reference_feature_extraction",
        "citation_verification",
        "normalization_deduplication",
        "conflict_detection",
        "coverage_analysis",
        "delivery_item_extraction",
        "question_generation",
        "finalize_review_package",
      ].sort(),
    );

    const referenceStage = stages.find((stage) => stage.kind === "reference_feature_extraction");
    expect(referenceStage?.status).toBe("skipped");

    const confirmedStage = stages.find((stage) => stage.kind === "confirmed_extraction");
    expect(confirmedStage).toBeDefined();
    const confirmedBatches = confirmedStage
      ? await repository.listBatchesByStage(confirmedStage.id)
      : [];
    expect(confirmedBatches.length).toBeGreaterThan(0);

    expect(queue.jobs).toHaveLength(confirmedBatches.length);
    expect(queue.jobs.every((job) => job.kind === "run-batch")).toBe(true);

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("running");
  });

  it("also batches reference chunks when the reference-feature-extraction flag is on", async () => {
    const built = buildTestRuntime({
      featureFlags: { referenceFeatureExtractionEnabled: true },
    });
    const run = buildTestRun();
    const { snapshotId } = await freezeAndSeed(built.runtime, built.repository, run, [
      buildCandidate({ sourceDocumentId: "source-normal" }),
      buildCandidate({ sourceDocumentId: "source-reference", isReference: true }),
    ]);

    await handlePlanBatches(built.runtime, queue, {
      kind: "plan-batches",
      idempotencyKey: "plan-2",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      snapshotId,
      submittedAt: built.runtime.now().toISOString(),
    });

    const stages = await built.repository.listStagesByRun(run.id);
    const referenceStage = stages.find((stage) => stage.kind === "reference_feature_extraction");
    expect(referenceStage?.status).not.toBe("skipped");
    const referenceBatches = referenceStage
      ? await built.repository.listBatchesByStage(referenceStage.id)
      : [];
    expect(referenceBatches.length).toBeGreaterThan(0);
  });

  it("is idempotent: replaying after batches were already planned re-enqueues only pending batches", async () => {
    const run = buildTestRun();
    const { snapshotId } = await freezeAndSeed(runtime, repository, run, [buildCandidate()]);

    const payload = {
      kind: "plan-batches" as const,
      idempotencyKey: "plan-3",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      snapshotId,
      submittedAt: runtime.now().toISOString(),
    };
    await handlePlanBatches(runtime, queue, payload);
    const firstEnqueueCount = queue.jobs.length;
    expect(firstEnqueueCount).toBeGreaterThan(0);

    // Mark one confirmed batch as already completed; only the still-pending batch should be
    // re-enqueued by a replay.
    const stages = await repository.listStagesByRun(run.id);
    const confirmedStage = stages.find((stage) => stage.kind === "confirmed_extraction");
    if (!confirmedStage) {
      throw new Error("confirmed_extraction stage missing");
    }
    const batches = await repository.listBatchesByStage(confirmedStage.id);
    const [firstBatch] = batches;
    if (firstBatch) {
      await repository.updateBatch(firstBatch.id, { status: "completed" });
    }

    await handlePlanBatches(runtime, queue, payload);
    const pendingBatchCountAfterCompletion = batches.filter(
      (batch) => batch.id !== firstBatch?.id,
    ).length;
    expect(queue.jobs.length).toBe(firstEnqueueCount + pendingBatchCountAfterCompletion);
  });

  it("throws RunCanceledError and never plans when cancellation was requested", async () => {
    const run = buildTestRun();
    const { snapshotId } = await freezeAndSeed(runtime, repository, run, [buildCandidate()]);
    repository.setCancellationRequested(run.id, true);

    await expect(
      handlePlanBatches(runtime, queue, {
        kind: "plan-batches",
        idempotencyKey: "plan-4",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        snapshotId,
        submittedAt: runtime.now().toISOString(),
      }),
    ).rejects.toThrow(RunCanceledError);
    expect(queue.jobs).toHaveLength(0);
  });

  it("throws RunBudgetExceededError once the run's wall-clock ceiling has elapsed", async () => {
    const run = buildTestRun({
      startedAt: new Date("2025-01-01T00:00:00.000Z"),
      maxWallClockSeconds: 10,
    });
    const { snapshotId } = await freezeAndSeed(runtime, repository, run, [buildCandidate()]);

    const lateRuntime = buildTestRuntime({
      now: () => new Date("2025-01-01T01:00:00.000Z"),
    }).runtime;

    await expect(
      handlePlanBatches({ ...lateRuntime, repository }, queue, {
        kind: "plan-batches",
        idempotencyKey: "plan-5",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        snapshotId,
        submittedAt: lateRuntime.now().toISOString(),
      }),
    ).rejects.toThrow(RunBudgetExceededError);
  });
});
