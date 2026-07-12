import { calculateConfidenceBand } from "@atlashq/ai";
import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import type { JsonObject } from "@atlashq/types";
import { advanceDag } from "../dag.js";
import { RequirementAnalysisInvalidStateError } from "../errors.js";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import type { AnalysisScope } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import { questionGenerationOutputSchema } from "../schemas.js";
import { assertNotCanceled, assertWithinWallClock, loadRunInScope } from "./common.js";
import {
  buildDeliveryItemStableKey,
  buildEvidenceBlocksFromRequirements,
  ensureSyntheticBatch,
  indexDeliveryItemsByStableKey,
  loadRequirementContext,
  reprocessableStageStatuses,
  resolveCitationClones,
  resolveRequirementIds,
  runDerivedModelStage,
} from "./derived-common.js";

export type RunStageJobPayload = Extract<RequirementAnalysisJobPayload, { kind: "run-stage" }>;

/** module-03 §11.2 `question_generation` (`usesModel: true`, fans in
 * `[normalization_deduplication, conflict_detection, coverage_analysis, delivery_item_extraction]`):
 * persists canonical `question` delivery items and links each question to its coverage category
 * row (task item 8: "link questions for partial/absent [coverage] and conflicts") whenever the
 * model proposes a `coverageCategoryKey`. */
export async function handleQuestionGenerationStage(
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
  if (!stage || stage.kind !== "question_generation") {
    throw new RequirementAnalysisInvalidStateError(
      `Stage "${payload.stageId}" is not a question_generation stage.`,
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
  const coverageEntries = await runtime.repository.listCoverageEntriesByRun(run.id);
  const coverageEntryIdByCategory = new Map(
    coverageEntries.map((entry) => [entry.categoryKey, entry.id]),
  );
  const coverageEntryById = new Map(coverageEntries.map((entry) => [entry.id, entry]));
  // module-03 task: mid-stage retry safety -- fetched before the model call so a redelivered
  // `run-stage` job can recognize question rows an earlier crashed attempt already committed
  // (`delivery_item` has no unique index of its own) and, if that attempt crashed before finishing
  // the coverage-question link, repair it against the existing row instead of inserting a
  // duplicate question.
  const existingQuestionsByStableKey = new Map(
    indexDeliveryItemsByStableKey(
      (await runtime.repository.listDeliveryItemsByRun(run.id)).filter(
        (item) => item.itemType === "question",
      ),
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
    stageKind: "question_generation",
    promptAssetKind: "question_generation",
    schema: questionGenerationOutputSchema,
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

  for (const question of result.output.questions) {
    const relatedRequirementIds = resolveRequirementIds(context, question.relatedRequirementIds);
    const stableKey = buildDeliveryItemStableKey({
      itemType: "question",
      title: question.title,
      description: question.description,
      sourceRequirementId: relatedRequirementIds[0] ?? null,
    });

    const existingQuestion = existingQuestionsByStableKey.get(stableKey);
    if (existingQuestion) {
      // module-03 task: mid-stage retry safety -- this exact question was already persisted by an
      // earlier attempt (or an earlier candidate in this same model output); never re-insert it
      // or re-record its traceability links (not queryable for idempotent replay -- see
      // `derived-common.ts#indexDeliveryItemsByStableKey`), but still repair a coverage-question
      // link that attempt may not have finished before crashing.
      if (question.coverageCategoryKey) {
        const coverageEntryId = coverageEntryIdByCategory.get(question.coverageCategoryKey);
        const coverageEntry = coverageEntryId ? coverageEntryById.get(coverageEntryId) : undefined;
        if (coverageEntryId && coverageEntry?.questionDeliveryItemId !== existingQuestion.id) {
          await runtime.repository.linkCoverageQuestion(coverageEntryId, existingQuestion.id);
        }
      }
      continue;
    }

    const citationClones = resolveCitationClones(context, question.citations, aiRunId);
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

    const deliveryItem = await runtime.repository.insertDeliveryItemWithCitations(
      {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        analysisRunId: run.id,
        itemType: "question",
        title: question.title,
        description: question.description,
        epistemicStatus: confidence.resolvedEpistemicStatus,
        confidenceBand: confidence.confidenceBand,
        confidenceReasonCodes: confidence.confidenceReasonCodes,
        severity: null,
        priority: question.priority,
        status: "open",
        visibility: "internal",
        attributes: { relatedRequirementIds } as unknown as JsonObject,
        sourceRequirementId: relatedRequirementIds[0] ?? null,
        createdByAiRunId: aiRunId,
      },
      citationClones,
    );
    existingQuestionsByStableKey.set(stableKey, deliveryItem);

    if (question.coverageCategoryKey) {
      const coverageEntryId = coverageEntryIdByCategory.get(question.coverageCategoryKey);
      if (coverageEntryId) {
        await runtime.repository.linkCoverageQuestion(coverageEntryId, deliveryItem.id);
      }
    }

    for (const requirementId of relatedRequirementIds) {
      await runtime.repository.recordTraceabilityLink({
        organizationId: scope.organizationId,
        fromType: "requirement",
        fromId: requirementId,
        toType: "delivery_item",
        toId: deliveryItem.id,
        relation: "clarified_by",
        createdBy: aiRunId,
      });
    }
  }

  await runtime.repository.updateStage(stage.id, {
    status: "completed",
    completedAt: runtime.now(),
  });

  await advanceDag(runtime, aiAnalysisQueue, scope);
}
