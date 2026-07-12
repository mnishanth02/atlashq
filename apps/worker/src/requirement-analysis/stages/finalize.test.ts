import { coverageCategoryDescriptors } from "@atlashq/types";
import { beforeEach, describe, expect, it } from "vitest";
import type { InsertCitationInput, InsertRequirementInput } from "../repository/types.js";
import {
  buildTestRun,
  buildTestRuntime,
  createRecordingAiAnalysisQueue,
} from "../test-support/fixtures.js";
import { handleFinalizeRun } from "./finalize.js";

function buildCitationInput(
  overrides: Partial<InsertCitationInput> = {},
): Omit<InsertCitationInput, "requirementId" | "coverageMatrixEntryId" | "deliveryItemId"> {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    analysisRunId: "run-1",
    sourceDocumentId: "source-1",
    sourceVersionNumber: 1,
    sourceContentHash: "a".repeat(64),
    sourceExtractionId: "extraction-1",
    sourceExtractionVersion: 1,
    sourceChunkId: "chunk-1",
    sourceChunkSequence: 0,
    chunkContentHash: "b".repeat(64),
    locator: {},
    quoteTextOriginal: "The system shall do X.",
    quoteTextNormalized: "the system shall do x.",
    quoteHash: "c".repeat(64),
    matchStartOffset: 0,
    matchEndOffset: 10,
    normalizationMode: "casefold",
    verificationStatus: "verified_exact",
    createdByAiRunId: null,
    ...overrides,
  };
}

function buildRequirementInput(
  overrides: Partial<InsertRequirementInput> = {},
): InsertRequirementInput {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    analysisRunId: "run-1",
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
    ...overrides,
  };
}

describe("handleFinalizeRun", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];
  let queue: ReturnType<typeof createRecordingAiAnalysisQueue>;

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
    queue = createRecordingAiAnalysisQueue();
  });

  async function seedRunWithFinalizeStage(overrides: Parameters<typeof buildTestRun>[0] = {}) {
    const run = buildTestRun({ status: "running", ...overrides });
    repository.seedRun(run);
    const finalizeStage = await repository.createStage({
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      kind: "finalize_review_package",
      idempotencyKey: `finalize:${run.id}`,
    });
    return { run, finalizeStage };
  }

  async function seedAllCoverageRows(run: {
    organizationId: string;
    projectId: string;
    id: string;
  }) {
    for (const descriptor of coverageCategoryDescriptors) {
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
          evidenceState: "none",
          createdByAiRunId: null,
        },
        [],
      );
    }
  }

  function payloadFor(run: { organizationId: string; projectId: string; id: string }) {
    return {
      kind: "finalize-run" as const,
      idempotencyKey: `finalize-job:${run.id}`,
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      submittedAt: runtime.now().toISOString(),
    };
  }

  it("fails the run when fewer than the fixed 18 coverage rows exist", async () => {
    const { run } = await seedRunWithFinalizeStage();
    // Deliberately seed zero coverage rows.

    await handleFinalizeRun(runtime, queue, payloadFor(run));

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("failed");
    expect(updatedRun?.failureCode).toBe("REQUIREMENT_ANALYSIS_COVERAGE_INCOMPLETE");
  });

  it("fails the run when a confirmed requirement has zero citations", async () => {
    const { run } = await seedRunWithFinalizeStage();
    await seedAllCoverageRows(run);
    await repository.insertRequirementWithCitations(
      buildRequirementInput({
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
      }),
      [],
    );

    await handleFinalizeRun(runtime, queue, payloadFor(run));

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("failed");
    expect(updatedRun?.failureCode).toBe("REQUIREMENT_ANALYSIS_UNVERIFIED_CONFIRMED_REQUIREMENT");
  });

  it("preserves already-persisted partial artifacts when a guard fails (never deletes rows)", async () => {
    const { run } = await seedRunWithFinalizeStage();
    // No coverage rows seeded -> guard fails.
    await repository.insertRequirementWithCitations(
      buildRequirementInput({
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
      }),
      [
        buildCitationInput({
          organizationId: run.organizationId,
          projectId: run.projectId,
          analysisRunId: run.id,
        }),
      ],
    );

    await handleFinalizeRun(runtime, queue, payloadFor(run));

    const requirementsAfter = await repository.listRequirementsByRun(run.id);
    expect(requirementsAfter).toHaveLength(1);
  });

  it("finalizes successfully with correct artifactCounts once all guards pass", async () => {
    const { run } = await seedRunWithFinalizeStage();
    await seedAllCoverageRows(run);
    await repository.insertRequirementWithCitations(
      buildRequirementInput({
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
      }),
      [
        buildCitationInput({
          organizationId: run.organizationId,
          projectId: run.projectId,
          analysisRunId: run.id,
        }),
      ],
    );
    await repository.insertDeliveryItemWithCitations(
      {
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
        itemType: "question",
        title: "What is the expected load?",
        description: null,
        epistemicStatus: "assumed",
        confidenceBand: null,
        confidenceReasonCodes: [],
        severity: null,
        priority: null,
        status: "open",
        visibility: "internal",
        attributes: {},
        sourceRequirementId: null,
        createdByAiRunId: null,
      },
      [],
    );

    await handleFinalizeRun(runtime, queue, payloadFor(run));

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("completed");
    expect(updatedRun?.artifactCounts).toMatchObject({
      requirementCount: 1,
      coverageEntryCount: coverageCategoryDescriptors.length,
      deliveryItemCount: 1,
      questionCount: 1,
    });
    expect(
      repository.auditEvents.some((event) => event.action === "requirement_analysis.run_finalized"),
    ).toBe(true);
  });

  it("is idempotent: replaying against an already-terminal run is a no-op", async () => {
    const { run } = await seedRunWithFinalizeStage({ status: "completed" });

    await handleFinalizeRun(runtime, queue, payloadFor(run));

    // No new audit events, no exception, run status unchanged.
    expect(repository.auditEvents).toHaveLength(0);
    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("completed");
  });
});
