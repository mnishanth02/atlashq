import { beforeEach, describe, expect, it } from "vitest";
import {
  buildTestRun,
  buildTestRuntime,
  createRecordingAiAnalysisQueue,
} from "../test-support/fixtures.js";
import { handleCancelRun } from "./cancel.js";

describe("handleCancelRun", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];
  let queue: ReturnType<typeof createRecordingAiAnalysisQueue>;

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
    queue = createRecordingAiAnalysisQueue();
  });

  function payloadFor(run: { organizationId: string; projectId: string; id: string }) {
    return {
      kind: "cancel-run" as const,
      idempotencyKey: `cancel:${run.id}`,
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      actorId: "user-1",
      submittedAt: runtime.now().toISOString(),
    };
  }

  it("transitions the run and every non-terminal stage to canceled", async () => {
    const run = buildTestRun({ status: "running" });
    repository.seedRun(run);
    const running = await repository.createStage({
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      kind: "normalization_deduplication",
      idempotencyKey: "stage-running",
    });
    await repository.updateStage(running.id, { status: "running" });
    const alreadyCompleted = await repository.createStage({
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      kind: "citation_verification",
      idempotencyKey: "stage-completed",
    });
    await repository.updateStage(alreadyCompleted.id, {
      status: "completed",
      completedAt: runtime.now(),
    });

    await handleCancelRun(runtime, queue, payloadFor(run));

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("canceled");

    const refreshedRunning = await repository.getStage(running.id);
    expect(refreshedRunning?.status).toBe("canceled");

    // Already-terminal stages are left untouched (task item 8: preserve partial artifacts).
    const refreshedCompleted = await repository.getStage(alreadyCompleted.id);
    expect(refreshedCompleted?.status).toBe("completed");

    expect(repository.auditEvents).toHaveLength(1);
    expect(repository.auditEvents[0]?.action).toBe("requirement_analysis.run_canceled");
  });

  it("never deletes or mutates already-persisted requirement/citation rows", async () => {
    const run = buildTestRun({ status: "running" });
    repository.seedRun(run);
    const requirement = await repository.insertRequirementWithCitations(
      {
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
        stableKey: "req-1",
        title: "The system shall do X.",
        description: null,
        requirementType: "functional",
        priority: null,
        epistemicStatus: "confirmed",
        confidenceBand: "high",
        confidenceReasonCodes: [],
        inferenceBasis: null,
        origin: "confirmed_extraction",
        lifecycleState: "ai_suggested",
        dedupeGroupKey: null,
        parentRequirementId: null,
        sourceSummary: null,
        createdByAiRunId: null,
      },
      [],
    );

    await handleCancelRun(runtime, queue, payloadFor(run));

    const requirementsAfter = await repository.listRequirementsByRun(run.id);
    expect(requirementsAfter).toHaveLength(1);
    expect(requirementsAfter[0]?.id).toBe(requirement.id);
    expect(requirementsAfter[0]?.epistemicStatus).toBe("confirmed");
  });

  it("is idempotent: replaying against an already-terminal run is a no-op", async () => {
    const run = buildTestRun({ status: "canceled" });
    repository.seedRun(run);

    await handleCancelRun(runtime, queue, payloadFor(run));

    expect(repository.auditEvents).toHaveLength(0);
  });
});
