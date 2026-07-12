import { AiCoreError } from "@atlashq/ai";
import { coverageCategoryDescriptors } from "@atlashq/types";
import { beforeEach, describe, expect, it } from "vitest";
import type { CoverageAnalysisOutput } from "../schemas.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createFakeStructuredExecutor,
  createRecordingAiAnalysisQueue,
  seedRequirementWithCitation,
} from "../test-support/fixtures.js";
import { handleCoverageAnalysisStage } from "./coverage-analysis.js";

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
    kind: "coverage_analysis",
    idempotencyKey: "stage:coverage_analysis",
  });
  await repository.updateStage(stage.id, { status: "pending" });
  return { run, stage };
}

/** Builds a full 18-row output: the first category is "addressed" and cites the given requirement
 * stableKey; every other category is "absent" with no requirements -- satisfies
 * `coverageAnalysisOutputSchema`'s exact-18/unique-category-key contract. */
function buildFullCoverageOutput(addressedRequirementStableKey: string): CoverageAnalysisOutput {
  return {
    categories: coverageCategoryDescriptors.map((descriptor, index) => ({
      categoryKey: descriptor.key,
      status: index === 0 ? "addressed" : "absent",
      rationale: index === 0 ? "Covered by an authenticated requirement." : null,
      evidenceState: index === 0 ? "verified_citation" : "none_found",
      requirementIds: index === 0 ? [addressedRequirementStableKey] : [],
    })),
  };
}

describe("handleCoverageAnalysisStage", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
  });

  it("writes exactly 18 fixed coverage rows, one per category, with citations cloned onto the addressed row", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    const { requirement } = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-auth-1",
      title: "System shall authenticate users",
    });

    const output = buildFullCoverageOutput("req-auth-1");
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 30, outputTokens: 15 } },
    ]);

    await handleCoverageAnalysisStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "coverage-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "coverage_analysis",
      submittedAt: runtime.now().toISOString(),
    });

    const entries = await repository.listCoverageEntriesByRun(run.id);
    expect(entries).toHaveLength(coverageCategoryDescriptors.length);
    expect(new Set(entries.map((entry) => entry.categoryKey)).size).toBe(
      coverageCategoryDescriptors.length,
    );

    const addressedEntry = entries.find((entry) => entry.status === "addressed");
    expect(addressedEntry).toBeTruthy();
    const requirementCitations = await repository.listCitationsByRequirement(requirement.id);
    expect(requirementCitations).toHaveLength(1);

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("is idempotent: replaying when 18 rows already exist never calls the executor again", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-auth-1",
      title: "System shall authenticate users",
    });
    const output = buildFullCoverageOutput("req-auth-1");
    const firstExecutor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 30, outputTokens: 15 } },
    ]);
    await handleCoverageAnalysisStage(
      { ...runtime, executor: firstExecutor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "coverage-2",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "coverage_analysis",
        submittedAt: runtime.now().toISOString(),
      },
    );
    // Reset the stage back to pending to simulate a duplicate job delivery after success.
    await repository.updateStage(stage.id, { status: "pending" });

    const secondExecutor = createFakeStructuredExecutor([]);
    await handleCoverageAnalysisStage(
      { ...runtime, executor: secondExecutor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "coverage-2-replay",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "coverage_analysis",
        submittedAt: runtime.now().toISOString(),
      },
    );

    expect(secondExecutor.calls).toBe(0);
    const entries = await repository.listCoverageEntriesByRun(run.id);
    expect(entries).toHaveLength(coverageCategoryDescriptors.length);
  });

  it("resumes a retry while the stage is still running: skips already-persisted categories and completes all 18 rows without duplicating them", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-auth-1",
      title: "System shall authenticate users",
    });

    // Simulate an earlier attempt that persisted the first 2 categories before its process died
    // while the stage row was still "running" (module-03 task: mid-stage retry safety).
    const preseeded = coverageCategoryDescriptors.slice(0, 2);
    for (const descriptor of preseeded) {
      await repository.insertCoverageEntryWithCitations(
        {
          organizationId: run.organizationId,
          projectId: run.projectId,
          analysisRunId: run.id,
          categoryKey: descriptor.key,
          categoryLabel: descriptor.label,
          categoryOrder: descriptor.order,
          status: "absent",
          rationale: null,
          evidenceState: "none_found",
          createdByAiRunId: null,
        },
        [],
      );
    }
    await repository.updateStage(stage.id, { status: "running" });

    const output = buildFullCoverageOutput("req-auth-1");
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 30, outputTokens: 15 } },
    ]);

    await handleCoverageAnalysisStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "coverage-retry-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      stageKind: "coverage_analysis",
      submittedAt: runtime.now().toISOString(),
    });

    const entries = await repository.listCoverageEntriesByRun(run.id);
    expect(entries).toHaveLength(coverageCategoryDescriptors.length);
    expect(new Set(entries.map((entry) => entry.categoryKey)).size).toBe(
      coverageCategoryDescriptors.length,
    );
    // The 2 preseeded rows must still be the exact same rows, never duplicated.
    for (const descriptor of preseeded) {
      const matches = entries.filter((entry) => entry.categoryKey === descriptor.key);
      expect(matches).toHaveLength(1);
    }

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("transitions the run to failed (never stuck running) once this module's own retry budget is exhausted", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-auth-1",
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
      handleCoverageAnalysisStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
        kind: "run-stage",
        idempotencyKey: "coverage-fail-1",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "coverage_analysis",
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
