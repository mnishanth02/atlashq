import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { advanceDag } from "../dag.js";
import { RequirementAnalysisInvalidStateError } from "../errors.js";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import type { AnalysisScope } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import { conflictDetectionOutputSchema } from "../schemas.js";
import { assertNotCanceled, assertWithinWallClock, loadRunInScope } from "./common.js";
import {
  buildEvidenceBlocksFromRequirements,
  ensureSyntheticBatch,
  loadRequirementContext,
  reprocessableStageStatuses,
  resolveRequirementIds,
  runDerivedModelStage,
} from "./derived-common.js";

export type RunStageJobPayload = Extract<RequirementAnalysisJobPayload, { kind: "run-stage" }>;

/** module-03 §11.2 `conflict_detection` (`usesModel: true`): flags mutually-contradictory
 * requirements found across the deduped requirement set, marking every requirement id the model
 * cites as `epistemicStatus: "conflicting"` (module-03 §10 confidence rules: a conflicting
 * requirement never carries a confidence band, per `calculateConfidenceBand`'s `hasConflict`
 * branch, applied here directly since the conflict set itself is the authority on conflict). */
export async function handleConflictDetectionStage(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  payload: RunStageJobPayload,
): Promise<void> {
  const scope: AnalysisScope = {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    runId: payload.runId,
  };
  const run = await loadRunInScope(runtime, scope);
  await assertNotCanceled(runtime, run);
  assertWithinWallClock(run, runtime.now());

  const stage = await runtime.repository.getStage(payload.stageId);
  if (!stage || stage.kind !== "conflict_detection") {
    throw new RequirementAnalysisInvalidStateError(
      `Stage "${payload.stageId}" is not a conflict_detection stage.`,
    );
  }
  if (!reprocessableStageStatuses.has(stage.status)) {
    await advanceDag(runtime, aiAnalysisQueue, scope);
    return;
  }

  const snapshotId = run.sourceSnapshotId;
  if (!snapshotId) {
    throw new RequirementAnalysisInvalidStateError(`Run "${run.id}" has no frozen snapshot.`);
  }

  const context = await loadRequirementContext(runtime, run.id);
  if (context.requirements.length === 0) {
    await runtime.repository.updateStage(stage.id, {
      status: "completed",
      completedAt: runtime.now(),
    });
    await advanceDag(runtime, aiAnalysisQueue, scope);
    return;
  }

  const batch = await ensureSyntheticBatch(runtime, scope, stage.id);
  const evidenceBlocks = buildEvidenceBlocksFromRequirements({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    snapshotId,
    context,
  });

  const result = await runDerivedModelStage({
    runtime,
    run,
    scope,
    stage,
    batchId: batch.id,
    stageKind: "conflict_detection",
    promptAssetKind: "conflict_detection",
    schema: conflictDetectionOutputSchema,
    evidenceBlocks,
    idempotencyKey: payload.idempotencyKey,
  });

  const aiRunId = await runtime.repository.insertAiRun({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    agent: "module-03-requirement-analyzer",
    model: result.provenance.resolvedModelId,
    provider: result.provenance.provider,
    promptVersion: result.provenance.promptVersion,
    inputArtifactVersions: [snapshotId],
    output: result.output as unknown as Parameters<
      typeof runtime.repository.insertAiRun
    >[0]["output"],
    runStatus: "succeeded",
    cost: result.usage.costUsd !== null ? { currency: "USD", amount: result.usage.costUsd } : null,
  });
  await runtime.repository.recordRunUsage(run.id, {
    inputTokensDelta: result.usage.inputTokens,
    outputTokensDelta: result.usage.outputTokens,
    costUsdDelta: result.usage.costUsd ?? 0,
  });
  await runtime.repository.updateBatch(batch.id, {
    status: "completed",
    aiRunId,
    shapeOnlyRepairUsed: result.shapeOnlyRepairUsed,
  });

  const conflictingRequirementIds = new Set<string>();
  for (const conflict of result.output.conflicts) {
    const ids = resolveRequirementIds(context, conflict.requirementIds);
    if (ids.length < 2) {
      continue; // Model cited fewer than 2 real requirements; not an actionable conflict.
    }
    for (const id of ids) {
      conflictingRequirementIds.add(id);
    }
  }

  for (const requirementId of conflictingRequirementIds) {
    const requirement = context.requirements.find((row) => row.id === requirementId);
    await runtime.repository.updateRequirementClassification(requirementId, {
      epistemicStatus: "conflicting",
      confidenceBand: null,
      confidenceReasonCodes: [],
      dedupeGroupKey: requirement?.dedupeGroupKey ?? null,
    });
  }

  await runtime.repository.updateStage(stage.id, {
    status: "completed",
    completedAt: runtime.now(),
  });

  await advanceDag(runtime, aiAnalysisQueue, scope);
}
