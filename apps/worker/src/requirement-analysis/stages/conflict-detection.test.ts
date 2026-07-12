import { AiCoreError } from "@atlashq/ai";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConflictDetectionOutput } from "../schemas.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createFakeStructuredExecutor,
  createRecordingAiAnalysisQueue,
  seedRequirementWithCitation,
} from "../test-support/fixtures.js";
import { handleConflictDetectionStage } from "./conflict-detection.js";

async function seedRunWithStage(
  runtime: ReturnType<typeof buildTestRuntime>["runtime"],
  repository: ReturnType<typeof buildTestRuntime>["repository"],
) {
  const run = buildTestRun({ sourceSnapshotId: "snapshot-1" });
  repository.seedRun(run);
  repository.seedProviderPolicy(
    buildTestProviderPolicy({ id: run.providerPolicyId, organizationId: run.organizationId }),
  );
  const stage = await repository.createStage({
    organizationId: run.organizationId,
    projectId: run.projectId,
    runId: run.id,
    kind: "conflict_detection",
    idempotencyKey: "stage:conflict_detection",
  });
  await repository.updateStage(stage.id, { status: "pending" });
  return { run, stage };
}

describe("handleConflictDetectionStage", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
  });

  it("marks every requirement cited in a model-proposed conflict as epistemicStatus 'conflicting' with no confidence band", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    const first = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall lock the account after 3 failed attempts",
    });
    const second = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-b",
      title: "System shall never lock any account",
    });

    const output: ConflictDetectionOutput = {
      conflicts: [
        {
          requirementIds: ["req-a", "req-b"],
          rationale: "These two requirements directly contradict each other.",
        },
      ],
    };
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 20, outputTokens: 10 } },
    ]);

    await handleConflictDetectionStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "conflict-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "conflict_detection",
      submittedAt: runtime.now().toISOString(),
    });

    const requirements = await repository.listRequirementsByRun(run.id);
    const updatedFirst = requirements.find((row) => row.id === first.requirement.id);
    const updatedSecond = requirements.find((row) => row.id === second.requirement.id);
    expect(updatedFirst?.epistemicStatus).toBe("conflicting");
    expect(updatedFirst?.confidenceBand).toBeNull();
    expect(updatedSecond?.epistemicStatus).toBe("conflicting");
    expect(updatedSecond?.confidenceBand).toBeNull();

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("drops a conflict citing fewer than 2 resolvable requirement stableKeys as non-actionable", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    const only = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-only",
      title: "System shall do one thing",
    });

    const output: ConflictDetectionOutput = {
      conflicts: [
        {
          // "req-nonexistent" never resolves, so only 1 real id remains -- not actionable.
          requirementIds: ["req-only", "req-nonexistent"],
          rationale: "Model hallucinated a second requirement id.",
        },
      ],
    };
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 10, outputTokens: 5 } },
    ]);

    await handleConflictDetectionStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "conflict-2",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "conflict_detection",
      submittedAt: runtime.now().toISOString(),
    });

    const requirements = await repository.listRequirementsByRun(run.id);
    const updated = requirements.find((row) => row.id === only.requirement.id);
    expect(updated?.epistemicStatus).toBe("confirmed");
  });

  it("skips calling the executor and completes immediately when there are zero requirements", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    const executor = createFakeStructuredExecutor([]);

    await handleConflictDetectionStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "conflict-3",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "conflict_detection",
      submittedAt: runtime.now().toISOString(),
    });

    expect(executor.calls).toBe(0);
    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("is idempotent: replaying against an already-terminal stage never re-invokes the executor", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall do something",
    });
    await repository.updateStage(stage.id, { status: "completed", completedAt: runtime.now() });
    const executor = createFakeStructuredExecutor([]);

    await handleConflictDetectionStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "conflict-4",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "conflict_detection",
      submittedAt: runtime.now().toISOString(),
    });

    expect(executor.calls).toBe(0);
  });

  it("transitions the run to failed (never stuck running) once this module's own retry budget is exhausted", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });
    // A redelivered `run-stage` job finds the stage still "running" on its 3rd (final) attempt.
    await repository.updateStage(stage.id, { status: "running", attemptNumber: 3 });

    const executor = createFakeStructuredExecutor([
      {
        throws: new AiCoreError(
          "AI_RUN_PROVIDER_TIMEOUT",
          "raw provider excerpt: never persisted",
          { retryable: true },
        ),
      },
    ]);

    await expect(
      handleConflictDetectionStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
        kind: "run-stage",
        idempotencyKey: "conflict-fail-1",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "conflict_detection",
        submittedAt: runtime.now().toISOString(),
      }),
    ).rejects.toThrow();

    const updatedStage = await repository.getStage(stage.id);
    expect(updatedStage?.status).toBe("failed");
    expect(updatedStage?.failureCode).toBe("AI_RUN_RETRIES_EXHAUSTED");
    expect(updatedStage?.failureDetail).not.toContain("never persisted");

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("failed");
    expect(updatedRun?.status).not.toBe("running");
  });
});
