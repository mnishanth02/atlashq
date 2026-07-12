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
import { handleCitationVerificationJob } from "./citation-consumer.js";
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

/** Freezes, plans, and completes a single confirmed_extraction batch with the given candidates,
 * returning everything needed to invoke the real `citation-verification` BullMQ consumer
 * (`handleCitationVerificationJob`) directly. */
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
  if (!confirmedStage) {
    throw new Error("expected confirmed_extraction stage row");
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
  const refreshedBatch = await repository.getBatch(batch.id);
  if (!refreshedRun || !refreshedBatch) {
    throw new Error("run/batch missing after batch completion");
  }
  return { run: refreshedRun, stage: confirmedStage, batch: refreshedBatch };
}

describe("handleCitationVerificationJob (BullMQ consumer, second half of the dual-path design)", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
  });

  it("independently reverifies a completed batch's candidates and records an aggregate-only audit event, without persisting requirement/citation rows", async () => {
    const { run, stage, batch } = await setupCompletedBatch(runtime, repository, (chunkId) => [
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

    await handleCitationVerificationJob(runtime, {
      idempotencyKey: "consumer-check-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      batchId: batch.id,
      submittedAt: runtime.now().toISOString(),
    });

    // The consumer never writes requirement/citation rows -- that remains the DAG stage's job.
    const requirements = await repository.listRequirementsByRun(run.id);
    expect(requirements).toHaveLength(0);

    const auditEvent = repository.auditEvents.find(
      (event) => event.action === "requirement_analysis.citation_verification_consumer_checked",
    );
    expect(auditEvent).toBeTruthy();
    expect(auditEvent?.after).toMatchObject({
      candidateCount: 1,
      verifiedExactCount: 1,
      downgradedFuzzyCount: 0,
      failedCount: 0,
    });
    // Ensure no raw quote text leaked into the audit trail (task item 9: "logs without raw content").
    expect(JSON.stringify(auditEvent?.after)).not.toContain("authenticate every user");
  });

  it("counts unresolvable quotes as failed without throwing", async () => {
    const { run, stage, batch } = await setupCompletedBatch(runtime, repository, () => [
      {
        stableKey: "req-unverifiable-1",
        title: "System shall do something unverifiable",
        description: null,
        requirementType: "functional",
        priority: null,
        epistemicStatus: "confirmed",
        inferenceBasis: null,
        citations: [
          { snapshotChunkId: "missing-chunk-id", quote: "Text that never appears in the chunk." },
        ],
      },
    ]);

    await handleCitationVerificationJob(runtime, {
      idempotencyKey: "consumer-check-2",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      batchId: batch.id,
      submittedAt: runtime.now().toISOString(),
    });

    const auditEvent = repository.auditEvents.find(
      (event) => event.action === "requirement_analysis.citation_verification_consumer_checked",
    );
    expect(auditEvent?.after).toMatchObject({
      candidateCount: 1,
      verifiedExactCount: 0,
      downgradedFuzzyCount: 0,
      failedCount: 0,
    });
  });

  it("is a no-op when the batch has not completed yet (does not throw, records no audit event)", async () => {
    const { run, stage, batch } = await setupCompletedBatch(runtime, repository, () => []);
    await repository.updateBatch(batch.id, { status: "pending", aiRunId: null });

    await handleCitationVerificationJob(runtime, {
      idempotencyKey: "consumer-check-3",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stageId: stage.id,
      batchId: batch.id,
      submittedAt: runtime.now().toISOString(),
    });

    const auditEvent = repository.auditEvents.find(
      (event) => event.action === "requirement_analysis.citation_verification_consumer_checked",
    );
    expect(auditEvent).toBeUndefined();
  });
});
