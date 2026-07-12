import { calculateConfidenceBand } from "@atlashq/ai";
import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import type { JsonObject } from "@atlashq/types";
import { advanceDag } from "../dag.js";
import { RequirementAnalysisInvalidStateError } from "../errors.js";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import type { AnalysisScope } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import { deliveryItemExtractionOutputSchema } from "../schemas.js";
import { assertNotCanceled, assertWithinWallClock, loadRunInScope } from "./common.js";
import {
  buildDeliveryItemStableKey,
  buildEvidenceBlocksFromRequirements,
  ensureSyntheticBatch,
  loadRequirementContext,
  reprocessableStageStatuses,
  resolveCitationClones,
  resolveRequirementIds,
  runDerivedModelStage,
} from "./derived-common.js";

export type RunStageJobPayload = Extract<RequirementAnalysisJobPayload, { kind: "run-stage" }>;

/** module-03 §11.2 `delivery_item_extraction` (`usesModel: true`): persists canonical
 * `risk|assumption|dependency|blocker|scope_change_candidate` delivery items (task item 8;
 * `question` items are exclusively produced by `question_generation`, matching
 * `deliveryItemCandidateSchema`'s exclusion of that type from this stage's output contract). */
export async function handleDeliveryItemExtractionStage(
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
  if (!stage || stage.kind !== "delivery_item_extraction") {
    throw new RequirementAnalysisInvalidStateError(
      `Stage "${payload.stageId}" is not a delivery_item_extraction stage.`,
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
  // module-03 task: mid-stage retry safety -- fetched before the model call so a redelivered
  // `run-stage` job can recognize rows an earlier crashed attempt already committed and skip
  // re-inserting them, since `delivery_item` carries no unique index of its own to catch this.
  const existingStableKeys = new Set(
    (await runtime.repository.listDeliveryItemsByRun(run.id)).map((item) =>
      buildDeliveryItemStableKey({
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        sourceRequirementId: item.sourceRequirementId,
      }),
    ),
  );
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
    stageKind: "delivery_item_extraction",
    promptAssetKind: "delivery_item_extraction",
    schema: deliveryItemExtractionOutputSchema,
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
    output: result.output as unknown as JsonObject,
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

  for (const item of result.output.items) {
    const sourceRequirementId = item.sourceRequirementId
      ? (resolveRequirementIds(context, [item.sourceRequirementId])[0] ?? null)
      : null;
    const stableKey = buildDeliveryItemStableKey({
      itemType: item.itemType,
      title: item.title,
      description: item.description,
      sourceRequirementId,
    });
    if (existingStableKeys.has(stableKey)) {
      // module-03 task: mid-stage retry safety -- an earlier attempt (or an earlier candidate in
      // this same model output) already persisted this exact item; skip it rather than
      // duplicating it.
      continue;
    }
    existingStableKeys.add(stableKey);

    const citationClones = resolveCitationClones(context, item.citations, aiRunId);
    const epistemicStatus = citationClones.length > 0 ? "confirmed" : "assumed";
    const confidence = calculateConfidenceBand({
      epistemicStatus,
      verifiedExactCitationCount: citationClones.length,
      corroboratingSourceDocumentCount: new Set(
        citationClones.map((clone) => clone.sourceDocumentId),
      ).size,
      evidenceSpanCompleteness: "complete",
      stageAgreement: "agree",
      mappedCoverageStatus: null,
      hasInferenceBasis: false,
      supportingContextVerifiedCitationCount: citationClones.length,
      hasConflict: false,
    });

    await runtime.repository.insertDeliveryItemWithCitations(
      {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        analysisRunId: run.id,
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        epistemicStatus: confidence.resolvedEpistemicStatus,
        confidenceBand: confidence.confidenceBand,
        confidenceReasonCodes: confidence.confidenceReasonCodes,
        severity: item.severity,
        priority: item.priority,
        status: "open",
        visibility: "internal",
        attributes: item.attributes as unknown as JsonObject,
        sourceRequirementId,
        createdByAiRunId: aiRunId,
      },
      citationClones,
    );
  }

  await runtime.repository.updateStage(stage.id, {
    status: "completed",
    completedAt: runtime.now(),
  });

  await advanceDag(runtime, aiAnalysisQueue, scope);
}
