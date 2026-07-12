import { AiCoreError } from "@atlashq/ai";
import { beforeEach, describe, expect, it } from "vitest";
import type { QuestionGenerationOutput } from "../schemas.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createFakeStructuredExecutor,
  createRecordingAiAnalysisQueue,
  seedRequirementWithCitation,
} from "../test-support/fixtures.js";
import { handleQuestionGenerationStage } from "./question-generation.js";

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
    kind: "question_generation",
    idempotencyKey: "stage:question_generation",
  });
  await repository.updateStage(stage.id, { status: "pending" });
  return { run, stage };
}

describe("handleQuestionGenerationStage", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
  });

  it("persists a question delivery item, links it to its coverage category row, and records a traceability link to its related requirement", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    const { requirement, citation } = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });
    const coverageEntry = await repository.insertCoverageEntryWithCitations(
      {
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
        categoryKey: "auth_identity",
        categoryLabel: "Auth/identity",
        categoryOrder: 1,
        status: "partial",
        rationale: "Password reset flow is unclear.",
        evidenceState: "downgraded",
        createdByAiRunId: null,
      },
      [],
    );

    const output: QuestionGenerationOutput = {
      questions: [
        {
          title: "What is the password reset rate limit?",
          description: null,
          priority: "high",
          coverageCategoryKey: "auth_identity",
          relatedRequirementIds: ["req-a"],
          citations: [{ snapshotChunkId: citation.id, quote: citation.quoteTextOriginal }],
        },
      ],
    };
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 20, outputTokens: 10 } },
    ]);

    await handleQuestionGenerationStage(
      { ...runtime, executor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "question-1",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "question_generation",
        submittedAt: runtime.now().toISOString(),
      },
    );

    const deliveryItems = await repository.listDeliveryItemsByRun(run.id);
    expect(deliveryItems).toHaveLength(1);
    const question = deliveryItems[0];
    expect(question?.itemType).toBe("question");
    expect(question?.epistemicStatus).toBe("confirmed");
    expect(question?.sourceRequirementId).toBe(requirement.id);

    const refreshedCoverageEntries = await repository.listCoverageEntriesByRun(run.id);
    expect(
      refreshedCoverageEntries.find((entry) => entry.id === coverageEntry.id)
        ?.questionDeliveryItemId,
    ).toBe(question?.id);

    expect(
      repository.traceabilityLinks.some(
        (link) =>
          link.fromType === "requirement" &&
          link.fromId === requirement.id &&
          link.toType === "delivery_item" &&
          link.toId === question?.id &&
          link.relation === "clarified_by",
      ),
    ).toBe(true);

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("persists a question with no coverageCategoryKey without linking any coverage row", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });

    const output: QuestionGenerationOutput = {
      questions: [
        {
          title: "What compliance certifications are required?",
          description: null,
          priority: null,
          coverageCategoryKey: null,
          relatedRequirementIds: [],
          citations: [],
        },
      ],
    };
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 10, outputTokens: 5 } },
    ]);

    await handleQuestionGenerationStage(
      { ...runtime, executor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "question-2",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "question_generation",
        submittedAt: runtime.now().toISOString(),
      },
    );

    const deliveryItems = await repository.listDeliveryItemsByRun(run.id);
    expect(deliveryItems).toHaveLength(1);
    expect(deliveryItems[0]?.epistemicStatus).toBe("assumed");
    const coverageEntries = await repository.listCoverageEntriesByRun(run.id);
    expect(coverageEntries).toHaveLength(0);
  });

  it("is idempotent: replaying against an already-terminal stage never re-invokes the executor or creates duplicate questions", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });
    await repository.updateStage(stage.id, { status: "completed", completedAt: runtime.now() });
    const executor = createFakeStructuredExecutor([]);

    await handleQuestionGenerationStage(
      { ...runtime, executor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "question-3",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "question_generation",
        submittedAt: runtime.now().toISOString(),
      },
    );

    expect(executor.calls).toBe(0);
    const deliveryItems = await repository.listDeliveryItemsByRun(run.id);
    expect(deliveryItems).toHaveLength(0);
  });

  it("resumes a retry while the stage is still running: repairs a missing coverage-question link on an already-persisted question instead of duplicating it", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    const { requirement, citation } = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });
    const coverageEntry = await repository.insertCoverageEntryWithCitations(
      {
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
        categoryKey: "auth_identity",
        categoryLabel: "Auth/identity",
        categoryOrder: 1,
        status: "partial",
        rationale: "Password reset flow is unclear.",
        evidenceState: "downgraded",
        createdByAiRunId: null,
      },
      [],
    );
    // Simulate an earlier attempt that persisted the question row itself but crashed before
    // reaching the coverage-question link step (module-03 task: mid-stage retry safety) -- the
    // coverage entry's `questionDeliveryItemId` is still unset.
    const preseededQuestion = await repository.insertDeliveryItemWithCitations(
      {
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
        itemType: "question",
        title: "What is the password reset rate limit?",
        description: null,
        epistemicStatus: "assumed",
        confidenceBand: null,
        confidenceReasonCodes: [],
        severity: null,
        priority: "high",
        status: "open",
        visibility: "internal",
        attributes: { relatedRequirementIds: [requirement.id] },
        sourceRequirementId: requirement.id,
        createdByAiRunId: null,
      },
      [],
    );
    await repository.updateStage(stage.id, { status: "running" });

    const output: QuestionGenerationOutput = {
      questions: [
        {
          // Same title/description/relatedRequirementIds as the preseeded row.
          title: "What is the password reset rate limit?",
          description: null,
          priority: "high",
          coverageCategoryKey: "auth_identity",
          relatedRequirementIds: ["req-a"],
          citations: [{ snapshotChunkId: citation.id, quote: citation.quoteTextOriginal }],
        },
      ],
    };
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 20, outputTokens: 10 } },
    ]);

    await handleQuestionGenerationStage(
      { ...runtime, executor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "question-retry-1",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "question_generation",
        submittedAt: runtime.now().toISOString(),
      },
    );

    // Never duplicated: still exactly the one preseeded question row.
    const deliveryItems = await repository.listDeliveryItemsByRun(run.id);
    expect(deliveryItems).toHaveLength(1);
    expect(deliveryItems[0]?.id).toBe(preseededQuestion.id);

    // The coverage link that the earlier crashed attempt never finished is now repaired.
    const refreshedCoverageEntries = await repository.listCoverageEntriesByRun(run.id);
    expect(
      refreshedCoverageEntries.find((entry) => entry.id === coverageEntry.id)
        ?.questionDeliveryItemId,
    ).toBe(preseededQuestion.id);

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
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
      handleQuestionGenerationStage({ ...runtime, executor }, createRecordingAiAnalysisQueue(), {
        kind: "run-stage",
        idempotencyKey: "question-fail-1",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "question_generation",
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
