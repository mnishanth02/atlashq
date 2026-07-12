import { beforeEach, describe, expect, it } from "vitest";
import { RunCanceledError } from "../errors.js";
import { buildStageIdempotencyKey } from "../ids.js";
import type { EligibleSnapshotSourceCandidate } from "../repository/types.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createRecordingAiAnalysisQueue,
} from "../test-support/fixtures.js";
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

describe("handleFreezeSnapshot", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];
  let queue: ReturnType<typeof createRecordingAiAnalysisQueue>;

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
    queue = createRecordingAiAnalysisQueue();
    repository.seedProviderPolicy(buildTestProviderPolicy());
  });

  it("freezes eligible sources, excludes flag-off references, and enqueues plan-batches", async () => {
    const run = buildTestRun();
    repository.seedRun(run);
    repository.seedEligibleCandidates([
      buildCandidate({ sourceDocumentId: "source-normal" }),
      buildCandidate({ sourceDocumentId: "source-reference", isReference: true }),
    ]);

    const result = await handleFreezeSnapshot(runtime, queue, {
      kind: "freeze-snapshot",
      idempotencyKey: "freeze-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      actorId: "user-1",
      submittedAt: runtime.now().toISOString(),
    });

    const snapshot = await repository.getSnapshot(result.snapshotId);
    expect(snapshot?.sourceCount).toBe(1);
    const chunks = await repository.listSnapshotChunks(result.snapshotId);
    expect(chunks.every((chunk) => chunk.sourceDocumentId === "source-normal")).toBe(true);

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("queued");
    expect(updatedRun?.sourceSnapshotId).toBe(result.snapshotId);

    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({ kind: "plan-batches", snapshotId: result.snapshotId });

    expect(repository.auditEvents).toHaveLength(1);
    expect(repository.auditEvents[0]?.action).toBe("requirement_analysis.snapshot_frozen");
    // Task item 9: logs/audit trail must never contain raw source content/quotes.
    expect(JSON.stringify(repository.auditEvents[0])).not.toContain("The system shall do X.");
  });

  it("includes reference candidates when the reference-feature-extraction flag is on", async () => {
    const built = buildTestRuntime({
      featureFlags: { referenceFeatureExtractionEnabled: true },
    });
    const run = buildTestRun();
    built.repository.seedRun(run);
    built.repository.seedProviderPolicy(buildTestProviderPolicy());
    built.repository.seedEligibleCandidates([
      buildCandidate({ sourceDocumentId: "source-reference", isReference: true }),
    ]);

    const result = await handleFreezeSnapshot(built.runtime, queue, {
      kind: "freeze-snapshot",
      idempotencyKey: "freeze-2",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      actorId: "user-1",
      submittedAt: built.runtime.now().toISOString(),
    });

    const chunks = await built.repository.listSnapshotChunks(result.snapshotId);
    expect(chunks).toHaveLength(1);
  });

  it("honors payload.sourceDocumentIds by freezing only the user-selected eligible sources", async () => {
    const run = buildTestRun();
    repository.seedRun(run);
    repository.seedEligibleCandidates([
      buildCandidate({ sourceDocumentId: "source-selected" }),
      buildCandidate({ sourceDocumentId: "source-not-selected" }),
    ]);

    const result = await handleFreezeSnapshot(runtime, queue, {
      kind: "freeze-snapshot",
      idempotencyKey: "freeze-subset-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      actorId: "user-1",
      sourceDocumentIds: ["source-selected"],
      submittedAt: runtime.now().toISOString(),
    });

    const snapshot = await repository.getSnapshot(result.snapshotId);
    expect(snapshot?.sourceCount).toBe(1);
    const chunks = await repository.listSnapshotChunks(result.snapshotId);
    expect(chunks.every((chunk) => chunk.sourceDocumentId === "source-selected")).toBe(true);
  });

  it("repairs stage/run bookkeeping after a crash between snapshot commit and bookkeeping, without refreezing (module-03 task item 2)", async () => {
    const run = buildTestRun();
    repository.seedRun(run);
    repository.seedEligibleCandidates([buildCandidate()]);

    // Simulate a crash: an earlier attempt committed the snapshot row (unique on `runId`) but
    // never created the stage row and never wrote the run's sourceSnapshotId/status.
    const priorFreeze = await repository.freezeSnapshot({
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      eligibilityRulesVersion: "module-03-eligibility-v1",
      includeReferenceFeatureExtraction: false,
    });
    expect(
      await repository.findStageByIdempotencyKey(
        buildStageIdempotencyKey({ runId: run.id, kind: "freeze_snapshot" }),
      ),
    ).toBeNull();

    const result = await handleFreezeSnapshot(runtime, queue, {
      kind: "freeze-snapshot",
      idempotencyKey: "freeze-repair-1",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      actorId: "user-1",
      submittedAt: runtime.now().toISOString(),
    });

    // Reuses the already-committed snapshot instead of inserting a second one for the same run.
    expect(result.snapshotId).toBe(priorFreeze.snapshot.id);

    const stage = await repository.findStageByIdempotencyKey(
      buildStageIdempotencyKey({ runId: run.id, kind: "freeze_snapshot" }),
    );
    expect(stage?.status).toBe("completed");

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("queued");
    expect(updatedRun?.sourceSnapshotId).toBe(priorFreeze.snapshot.id);

    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({
      kind: "plan-batches",
      snapshotId: priorFreeze.snapshot.id,
    });
  });

  it("is idempotent: replaying after a snapshot already exists re-enqueues plan-batches without refreezing", async () => {
    const run = buildTestRun({ sourceSnapshotId: "existing-snapshot" });
    repository.seedRun(run);
    repository.seedEligibleCandidates([buildCandidate()]);
    const stageKey = buildStageIdempotencyKey({ runId: run.id, kind: "freeze_snapshot" });
    await repository.createStage({
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      kind: "freeze_snapshot",
      idempotencyKey: stageKey,
    });

    const result = await handleFreezeSnapshot(runtime, queue, {
      kind: "freeze-snapshot",
      idempotencyKey: "freeze-3",
      correlationId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      actorId: "user-1",
      submittedAt: runtime.now().toISOString(),
    });

    expect(result.snapshotId).toBe("existing-snapshot");
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({ kind: "plan-batches", snapshotId: "existing-snapshot" });
    // No new snapshot row was created on replay -- the fake repo never seeded one.
    expect(await repository.getSnapshot("existing-snapshot")).toBeNull();
  });

  it("throws RunCanceledError and never freezes when cancellation was requested", async () => {
    const run = buildTestRun();
    repository.seedRun(run);
    repository.seedEligibleCandidates([buildCandidate()]);
    repository.setCancellationRequested(run.id, true);

    await expect(
      handleFreezeSnapshot(runtime, queue, {
        kind: "freeze-snapshot",
        idempotencyKey: "freeze-4",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        actorId: "user-1",
        submittedAt: runtime.now().toISOString(),
      }),
    ).rejects.toThrow(RunCanceledError);

    expect(queue.jobs).toHaveLength(0);
  });
});
