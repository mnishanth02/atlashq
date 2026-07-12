import { beforeEach, describe, expect, it } from "vitest";
import {
  buildTestRun,
  buildTestRuntime,
  createRecordingAiAnalysisQueue,
  seedRequirementWithCitation,
} from "../test-support/fixtures.js";
import { handleNormalizationDeduplicationStage } from "./normalization.js";

describe("handleNormalizationDeduplicationStage", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
  });

  it("assigns the same dedupeGroupKey to two requirements with the same type+normalized title, and marks the stage completed_with_warnings", async () => {
    const run = buildTestRun({ sourceSnapshotId: "snapshot-1" });
    repository.seedRun(run);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall Authenticate Users",
    });
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-b",
      title: "system shall authenticate users", // same after normalization -> duplicate group
    });
    const stage = await repository.createStage({
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      kind: "normalization_deduplication",
      idempotencyKey: "stage:normalization_deduplication",
    });
    await repository.updateStage(stage.id, { status: "running", startedAt: runtime.now() });

    await handleNormalizationDeduplicationStage(runtime, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "normalize-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "normalization_deduplication",
      submittedAt: runtime.now().toISOString(),
    });

    const requirements = await repository.listRequirementsByRun(run.id);
    expect(requirements).toHaveLength(2);
    const keys = new Set(requirements.map((row) => row.dedupeGroupKey));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBeTruthy();

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed_with_warnings");
  });

  it("marks the stage completed (no warnings) when no two requirements share a dedupe group", async () => {
    const run = buildTestRun({ sourceSnapshotId: "snapshot-1" });
    repository.seedRun(run);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-b",
      title: "System shall log every access attempt",
    });
    const stage = await repository.createStage({
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      kind: "normalization_deduplication",
      idempotencyKey: "stage:normalization_deduplication",
    });
    await repository.updateStage(stage.id, { status: "pending" });

    await handleNormalizationDeduplicationStage(runtime, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "normalize-2",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "normalization_deduplication",
      submittedAt: runtime.now().toISOString(),
    });

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("is idempotent: replaying against already-terminal stage never re-assigns dedupeGroupKey", async () => {
    const run = buildTestRun({ sourceSnapshotId: "snapshot-1" });
    repository.seedRun(run);
    const { requirement } = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });
    const stage = await repository.createStage({
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      kind: "normalization_deduplication",
      idempotencyKey: "stage:normalization_deduplication",
    });
    await repository.updateStage(stage.id, {
      status: "completed",
      completedAt: runtime.now(),
    });

    const beforeRequirements = await repository.listRequirementsByRun(run.id);
    expect(beforeRequirements[0]?.dedupeGroupKey).toBeNull();

    await handleNormalizationDeduplicationStage(runtime, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "normalize-3",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "normalization_deduplication",
      submittedAt: runtime.now().toISOString(),
    });

    const afterRequirements = await repository.listRequirementsByRun(run.id);
    expect(afterRequirements.find((row) => row.id === requirement.id)?.dedupeGroupKey).toBeNull();
  });
});
