import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { createRequirementAnalysisIdempotencyKey } from "@atlashq/jobs";
import { InvalidJobDataError } from "../../errors.js";
import { buildStageIdempotencyKey } from "../ids.js";
import { type AiAnalysisQueue, enqueueAiAnalysisJob } from "../queue-helpers.js";
import type { AnalysisRuntime } from "../runtime.js";
import { assertNotCanceled, loadRunInScope } from "./common.js";

export type FreezeSnapshotJobPayload = Extract<
  RequirementAnalysisJobPayload,
  { kind: "freeze-snapshot" }
>;

/** module-03 §11.2 `freeze_snapshot`: exact Module 2 eligible-source freeze into
 * header/source/file/chunk rows. Flag-off references are never frozen (task item 4). Honors an
 * optional user-selected `sourceDocumentIds` subset (task item 1) by narrowing the eligible-source
 * freeze to exactly those documents instead of every eligible source in the project. */
export async function handleFreezeSnapshot(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  payload: FreezeSnapshotJobPayload,
): Promise<{ snapshotId: string }> {
  const scope = {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    runId: payload.runId,
  };
  const run = await loadRunInScope(runtime, scope);
  await assertNotCanceled(runtime, run);

  const stageIdempotencyKey = buildStageIdempotencyKey({ runId: run.id, kind: "freeze_snapshot" });
  let stage = await runtime.repository.findStageByIdempotencyKey(stageIdempotencyKey);

  if (stage && run.sourceSnapshotId) {
    // Fully-committed idempotent replay: `run.sourceSnapshotId` is only ever written in the very
    // last step below, so if it is already set the stage/run bookkeeping already finished too.
    await enqueuePlanBatches(runtime, aiAnalysisQueue, scope, run.sourceSnapshotId);
    return { snapshotId: run.sourceSnapshotId };
  }

  // Crash/retry repair (task item 2): `requirement_analysis_snapshot` enforces a unique `run_id`
  // index, so if a prior attempt already committed the snapshot row and then crashed before
  // finishing stage/run bookkeeping (the writes below), re-running `freezeSnapshot` here would
  // violate that unique index and fail forever. Find and reuse the already-committed snapshot
  // instead of re-inserting.
  const reusedSnapshot = await runtime.repository.findSnapshotByRunId(run.id);
  let snapshotId: string;

  if (reusedSnapshot) {
    snapshotId = reusedSnapshot.id;
  } else {
    await runtime.repository.transitionRun(run.id, {
      status: "snapshotting",
      startedAt: run.startedAt ?? runtime.now(),
    });

    const freezeResult = await runtime.repository.freezeSnapshot({
      ...scope,
      eligibilityRulesVersion: "module-03-eligibility-v1",
      includeReferenceFeatureExtraction: runtime.featureFlags.referenceFeatureExtractionEnabled,
      ...(payload.sourceDocumentIds ? { sourceDocumentIdFilter: payload.sourceDocumentIds } : {}),
    });
    snapshotId = freezeResult.snapshot.id;

    await runtime.repository.recordAuditEvent({
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      actorId: payload.actorId,
      action: "requirement_analysis.snapshot_frozen",
      entityType: "requirement_analysis_snapshot",
      entityId: snapshotId,
      correlationId: payload.correlationId,
      after: {
        sourceCount: freezeResult.snapshot.sourceCount,
        chunkCount: freezeResult.snapshot.chunkCount,
        excludedReferenceSourceDocumentIds: [...freezeResult.excludedReferenceSourceDocumentIds],
      },
    });
  }

  // Repair (or, on the very first attempt, create) the stage/run bookkeeping. This runs
  // regardless of which branch above produced `snapshotId`, so a crash between the snapshot
  // commit and either of these writes is repaired on the next retry instead of leaving the run
  // stuck in "snapshotting" forever.
  if (!stage) {
    await runtime.repository.createStage({
      ...scope,
      kind: "freeze_snapshot",
      idempotencyKey: stageIdempotencyKey,
    });
    stage = await requireStage(runtime, stageIdempotencyKey);
  }
  if (stage.status !== "completed") {
    await runtime.repository.updateStage(stage.id, {
      status: "completed",
      startedAt: stage.startedAt ?? runtime.now(),
      completedAt: runtime.now(),
    });
  }

  if (run.sourceSnapshotId !== snapshotId) {
    await runtime.repository.transitionRun(run.id, {
      status: "queued",
      sourceSnapshotId: snapshotId,
    });
  }

  await enqueuePlanBatches(runtime, aiAnalysisQueue, scope, snapshotId);
  return { snapshotId };
}

async function requireStage(runtime: AnalysisRuntime, idempotencyKey: string) {
  const stage = await runtime.repository.findStageByIdempotencyKey(idempotencyKey);
  if (!stage) {
    throw new InvalidJobDataError(
      `Stage with idempotency key "${idempotencyKey}" was not persisted.`,
    );
  }
  return stage;
}

async function enqueuePlanBatches(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  scope: { organizationId: string; projectId: string; runId: string },
  snapshotId: string,
): Promise<void> {
  await enqueueAiAnalysisJob(aiAnalysisQueue, {
    kind: "plan-batches",
    idempotencyKey: createRequirementAnalysisIdempotencyKey({
      kind: "plan-batches",
      runId: scope.runId,
      snapshotId,
    }),
    correlationId: scope.runId,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    runId: scope.runId,
    snapshotId,
    submittedAt: runtime.now().toISOString(),
  });
}
