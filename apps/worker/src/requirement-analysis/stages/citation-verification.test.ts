import { beforeEach, describe, expect, it } from "vitest";
import type { EligibleSnapshotSourceCandidate } from "../repository/types.js";
import type { RequirementCandidate } from "../schemas.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createFakeStructuredExecutor,
  createRecordingAiAnalysisQueue,
  createRecordingCitationVerificationQueue,
} from "../test-support/fixtures.js";
import { handlePlanBatches } from "./batch-planning.js";
import { handleCitationVerificationStage } from "./citation-verification.js";
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
        content: "The system shall authenticate every user before granting access.",
      },
    ],
    ...overrides,
  };
}

/**
 * Freezes, plans, and completes a single confirmed_extraction batch (with the given executor
 * output), returning enough context to invoke `handleCitationVerificationStage` directly against
 * the real citation_verification stage row that `handlePlanBatches` creates upfront for the whole
 * pipeline (see dag.test.ts / batch-planning.ts: every module03PipelineDescriptor stage row is
 * created during batch planning, not lazily by advanceDag).
 */
async function setupCompletedBatch(
  runtime: ReturnType<typeof buildTestRuntime>["runtime"],
  repository: ReturnType<typeof buildTestRuntime>["repository"],
  buildRequirementCandidates: (chunkId: string) => RequirementCandidate[],
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
  const citationStage = stages.find((stage) => stage.kind === "citation_verification");
  if (!confirmedStage || !citationStage) {
    throw new Error("expected confirmed_extraction and citation_verification stage rows");
  }
  const batches = await repository.listBatchesByStage(confirmedStage.id);
  const [batch] = batches;
  if (!batch) {
    throw new Error("no confirmed_extraction batch was planned");
  }
  const chunks = await repository.listBatchChunkContents(batch.id);
  const [chunk] = chunks;
  if (!chunk) {
    throw new Error("expected at least one batch chunk");
  }

  const executor = createFakeStructuredExecutor([
    {
      output: { requirements: buildRequirementCandidates(chunk.snapshotChunkId) },
      usage: { inputTokens: 10, outputTokens: 5 },
    },
  ]);
  const citationQueue = createRecordingCitationVerificationQueue();
  await handleRunBatch({ ...runtime, executor }, createRecordingAiAnalysisQueue(), citationQueue, {
    kind: "run-batch",
    idempotencyKey: "run-batch-1",
    correlationId: run.id,
    organizationId: run.organizationId,
    projectId: run.projectId,
    runId: run.id,
    stageId: confirmedStage.id,
    batchId: batch.id,
    submittedAt: runtime.now().toISOString(),
  });

  const refreshedRun = await repository.getRun(run.id);
  const refreshedCitationStage = await repository.getStage(citationStage.id);
  if (!refreshedRun || !refreshedCitationStage) {
    throw new Error("run/citation stage missing after batch completion");
  }
  return { run: refreshedRun, citationStage: refreshedCitationStage, batch, chunk };
}

describe("handleCitationVerificationStage", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
  });

  it("persists a fully-verified candidate as confirmed and marks the stage completed", async () => {
    const { run, citationStage } = await setupCompletedBatch(runtime, repository, (chunkId) => [
      {
        stableKey: "req-auth-1",
        title: "System shall authenticate users",
        description: null,
        requirementType: "functional",
        priority: null,
        epistemicStatus: "confirmed",
        inferenceBasis: null,
        citations: [
          { snapshotChunkId: chunkId, quote: "The system shall authenticate every user" },
        ],
      },
    ]);

    const aiAnalysisQueue = createRecordingAiAnalysisQueue();
    await handleCitationVerificationStage(runtime, aiAnalysisQueue, {
      kind: "run-stage",
      idempotencyKey: "citation-verify-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: citationStage.id,
      stageKind: "citation_verification",
      submittedAt: runtime.now().toISOString(),
    });

    const requirements = await repository.listRequirementsByRun(run.id);
    expect(requirements).toHaveLength(1);
    expect(requirements[0]?.epistemicStatus).toBe("confirmed");
    const citations = await repository.listCitationsByRequirement(requirements[0]!.id);
    expect(citations).toHaveLength(1);
    expect(citations[0]?.verificationStatus).toBe("verified_exact");

    const refreshedStage = await repository.getStage(citationStage.id);
    expect(refreshedStage?.status).toBe("completed");

    const auditEvent = repository.auditEvents.find(
      (event) => event.action === "requirement_analysis.citation_verification_completed",
    );
    expect(auditEvent).toBeTruthy();
    // Ensure no raw quote text leaked into the audit trail (task item 9: "logs without raw content").
    expect(JSON.stringify(auditEvent?.after)).not.toContain("authenticate every user");
  });

  it("downgrades an unverifiable candidate to unknown and marks the stage completed_with_warnings", async () => {
    const { run, citationStage } = await setupCompletedBatch(runtime, repository, (chunkId) => [
      {
        stableKey: "req-unverifiable-1",
        title: "System shall do something unverifiable",
        description: null,
        requirementType: "functional",
        priority: null,
        epistemicStatus: "confirmed",
        inferenceBasis: null,
        citations: [{ snapshotChunkId: chunkId, quote: "Text that never appears in the chunk." }],
      },
    ]);

    await handleCitationVerificationStage(runtime, createRecordingAiAnalysisQueue(), {
      kind: "run-stage",
      idempotencyKey: "citation-verify-2",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: citationStage.id,
      stageKind: "citation_verification",
      submittedAt: runtime.now().toISOString(),
    });

    const requirements = await repository.listRequirementsByRun(run.id);
    expect(requirements).toHaveLength(1);
    expect(requirements[0]?.epistemicStatus).toBe("unknown");
    const citations = await repository.listCitationsByRequirement(requirements[0]!.id);
    expect(citations).toHaveLength(0);

    const refreshedStage = await repository.getStage(citationStage.id);
    expect(refreshedStage?.status).toBe("completed_with_warnings");
  });

  it("is idempotent: replaying against already-persisted stableKeys never creates duplicate requirement rows", async () => {
    const { run, citationStage } = await setupCompletedBatch(runtime, repository, (chunkId) => [
      {
        stableKey: "req-dup-1",
        title: "System shall authenticate users",
        description: null,
        requirementType: "functional",
        priority: null,
        epistemicStatus: "confirmed",
        inferenceBasis: null,
        citations: [
          { snapshotChunkId: chunkId, quote: "The system shall authenticate every user" },
        ],
      },
    ]);

    const payload = {
      kind: "run-stage" as const,
      idempotencyKey: "citation-verify-3",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: citationStage.id,
      stageKind: "citation_verification" as const,
      submittedAt: runtime.now().toISOString(),
    };

    await handleCitationVerificationStage(runtime, createRecordingAiAnalysisQueue(), payload);
    const afterFirst = await repository.listRequirementsByRun(run.id);
    expect(afterFirst).toHaveLength(1);

    // Replay: stage is already terminal (completed), so this must be a pure idempotent no-op.
    await handleCitationVerificationStage(runtime, createRecordingAiAnalysisQueue(), payload);
    const afterSecond = await repository.listRequirementsByRun(run.id);
    expect(afterSecond).toHaveLength(1);
  });
});
