import { AiCoreError } from "@atlashq/ai";
import { beforeEach, describe, expect, it } from "vitest";
import { RunCanceledError } from "../errors.js";
import type { EligibleSnapshotSourceCandidate } from "../repository/types.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createFakeStructuredExecutor,
  createRecordingAiAnalysisQueue,
  createRecordingCitationVerificationQueue,
} from "../test-support/fixtures.js";
import { handlePlanBatches } from "./batch-planning.js";
import { handleRunBatch } from "./extraction-batch.js";
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

async function freezeAndPlan(
  runtime: ReturnType<typeof buildTestRuntime>["runtime"],
  repository: ReturnType<typeof buildTestRuntime>["repository"],
) {
  const run = buildTestRun();
  repository.seedRun(run);
  repository.seedProviderPolicy(
    buildTestProviderPolicy({ id: run.providerPolicyId, organizationId: run.organizationId }),
  );
  repository.seedEligibleCandidates([buildCandidate()]);

  const freezeResult = await handleFreezeSnapshot(runtime, createRecordingAiAnalysisQueue(), {
    kind: "freeze-snapshot",
    idempotencyKey: "freeze-1",
    correlationId: run.id,
    organizationId: run.organizationId,
    projectId: run.projectId,
    runId: run.id,
    actorId: "user-1",
    submittedAt: runtime.now().toISOString(),
  });

  await handlePlanBatches(runtime, createRecordingAiAnalysisQueue(), {
    kind: "plan-batches",
    idempotencyKey: "plan-1",
    correlationId: run.id,
    organizationId: run.organizationId,
    projectId: run.projectId,
    runId: run.id,
    snapshotId: freezeResult.snapshotId,
    submittedAt: runtime.now().toISOString(),
  });

  const stages = await repository.listStagesByRun(run.id);
  const confirmedStage = stages.find((stage) => stage.kind === "confirmed_extraction");
  if (!confirmedStage) {
    throw new Error("confirmed_extraction stage missing");
  }
  const batches = await repository.listBatchesByStage(confirmedStage.id);
  const [batch] = batches;
  if (!batch) {
    throw new Error("no confirmed_extraction batch was planned");
  }
  const refreshedRun = await repository.getRun(run.id);
  if (!refreshedRun) {
    throw new Error("run missing after plan");
  }
  return { run: refreshedRun, stage: confirmedStage, batch };
}

describe("handleRunBatch", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];
  let aiAnalysisQueue: ReturnType<typeof createRecordingAiAnalysisQueue>;
  let citationQueue: ReturnType<typeof createRecordingCitationVerificationQueue>;

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
    aiAnalysisQueue = createRecordingAiAnalysisQueue();
    citationQueue = createRecordingCitationVerificationQueue();
  });

  it("calls the structured executor once, records the ai_run, completes the batch, and enqueues citation-verification", async () => {
    const { run, stage, batch } = await freezeAndPlan(runtime, repository);
    const executor = createFakeStructuredExecutor([
      { output: { requirements: [] }, usage: { inputTokens: 50, outputTokens: 5 } },
    ]);
    const executorRuntime = { ...runtime, executor };

    await handleRunBatch(executorRuntime, aiAnalysisQueue, citationQueue, {
      kind: "run-batch",
      idempotencyKey: "run-batch-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      batchId: batch.id,
      submittedAt: runtime.now().toISOString(),
    });

    expect(executor.calls).toBe(1);
    const updatedBatch = await repository.getBatch(batch.id);
    expect(updatedBatch?.status).toBe("completed");
    expect(updatedBatch?.aiRunId).toBeTruthy();

    expect(citationQueue.jobs).toHaveLength(1);
    expect(citationQueue.jobs[0]).toMatchObject({ batchId: batch.id, stageId: stage.id });

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.inputTokensUsed).toBe(50);
    expect(updatedRun?.outputTokensUsed).toBe(5);

    // Single-batch stage should now be complete, driving the DAG forward.
    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("reuses a cache hit without calling the executor, and still enqueues citation-verification (task item 5: cache hits always reverify)", async () => {
    const { run, stage, batch } = await freezeAndPlan(runtime, repository);
    if (!batch.cacheKey) {
      throw new Error("expected a deterministic cache key on the planned batch");
    }
    repository.seedCacheHit(batch.cacheKey, {
      aiRunId: "cached-ai-run-1",
      sourceBatchId: "some-other-batch",
      output: { requirements: [] },
    });
    const executor = createFakeStructuredExecutor([]);
    const executorRuntime = { ...runtime, executor };

    await handleRunBatch(executorRuntime, aiAnalysisQueue, citationQueue, {
      kind: "run-batch",
      idempotencyKey: "run-batch-2",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      batchId: batch.id,
      submittedAt: runtime.now().toISOString(),
    });

    expect(executor.calls).toBe(0);
    const updatedBatch = await repository.getBatch(batch.id);
    expect(updatedBatch?.status).toBe("completed");
    expect(updatedBatch?.aiRunId).toBe("cached-ai-run-1");
    expect(citationQueue.jobs).toHaveLength(1);
  });

  it("is idempotent: replaying a batch that is already terminal never re-calls the executor or re-enqueues", async () => {
    const { run, stage, batch } = await freezeAndPlan(runtime, repository);
    await repository.updateBatch(batch.id, { status: "completed", aiRunId: "already-done" });

    const executor = createFakeStructuredExecutor([]);
    const executorRuntime = { ...runtime, executor };

    await handleRunBatch(executorRuntime, aiAnalysisQueue, citationQueue, {
      kind: "run-batch",
      idempotencyKey: "run-batch-3",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      batchId: batch.id,
      submittedAt: runtime.now().toISOString(),
    });

    expect(executor.calls).toBe(0);
    expect(citationQueue.jobs).toHaveLength(0);
  });

  it("throws RunCanceledError and never runs the batch when cancellation was requested", async () => {
    const { run, stage, batch } = await freezeAndPlan(runtime, repository);
    repository.setCancellationRequested(run.id, true);
    const executor = createFakeStructuredExecutor([]);
    const executorRuntime = { ...runtime, executor };

    await expect(
      handleRunBatch(executorRuntime, aiAnalysisQueue, citationQueue, {
        kind: "run-batch",
        idempotencyKey: "run-batch-4",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        batchId: batch.id,
        submittedAt: runtime.now().toISOString(),
      }),
    ).rejects.toThrow(RunCanceledError);
    expect(executor.calls).toBe(0);
  });

  it("fails the batch/stage/run and rethrows once the run's wall-clock budget has elapsed", async () => {
    const { run, stage, batch } = await freezeAndPlan(runtime, repository);
    await repository.transitionRun(run.id, {
      status: "running",
      startedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const lateRuntime = { ...runtime, now: () => new Date("2025-01-01T01:00:00.000Z") };
    const executor = createFakeStructuredExecutor([]);

    await expect(
      handleRunBatch({ ...lateRuntime, executor }, aiAnalysisQueue, citationQueue, {
        kind: "run-batch",
        idempotencyKey: "run-batch-5",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        batchId: batch.id,
        submittedAt: lateRuntime.now().toISOString(),
      }),
    ).rejects.toThrow();

    const updatedBatch = await repository.getBatch(batch.id);
    expect(updatedBatch?.status).toBe("failed");
    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("failed");
    expect(updatedRun?.failureRetryable).toBe(false);
  });

  it("never persists a raw provider AiCoreError message into batch/stage/run failureDetail or logs (module-03 task item 3)", async () => {
    const { run, stage, batch } = await freezeAndPlan(runtime, repository);
    const rawSensitiveText =
      "verbatim source excerpt: employee SSN 123-45-6789 appears in clause 4.2 of the contract";
    const executor = createFakeStructuredExecutor([
      {
        throws: new AiCoreError("AI_RUN_PROVIDER_FAILURE", rawSensitiveText, {
          retryable: false,
        }),
      },
    ]);
    const executorRuntime = { ...runtime, executor };

    await expect(
      handleRunBatch(executorRuntime, aiAnalysisQueue, citationQueue, {
        kind: "run-batch",
        idempotencyKey: "run-batch-6",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        batchId: batch.id,
        submittedAt: runtime.now().toISOString(),
      }),
    ).rejects.toThrow();

    const updatedBatch = await repository.getBatch(batch.id);
    expect(updatedBatch?.status).toBe("failed");
    expect(updatedBatch?.failureDetail).toBe("AI provider request failed.");
    expect(updatedBatch?.failureDetail).not.toContain(rawSensitiveText);

    const updatedStage = await repository.getStage(stage.id);
    expect(updatedStage?.failureDetail).toBe("AI provider request failed.");
    expect(updatedStage?.failureDetail).not.toContain(rawSensitiveText);

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("failed");
    expect(updatedRun?.failureRetryable).toBe(true);
    expect(updatedRun?.failureDetail).toBe("AI provider request failed.");
    expect(updatedRun?.failureDetail).not.toContain(rawSensitiveText);
  });
});
