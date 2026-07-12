import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { coverageCategoryDescriptors } from "@atlashq/types";
import { advanceDag } from "../dag.js";
import { RequirementAnalysisInvalidStateError } from "../errors.js";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import type { AnalysisScope, InsertCitationInput } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import { coverageAnalysisOutputSchema } from "../schemas.js";
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

const categoryDescriptorByKey = new Map(coverageCategoryDescriptors.map((d) => [d.key, d]));

/** module-03 §11.2 `coverage_analysis` (`usesModel: true`): always writes exactly the 18 fixed
 * `coverage_matrix_entry` rows (task item 8) -- `coverageAnalysisOutputSchema` already enforces
 * the model output has exactly `coverageCategoryKeyValues.length` unique categories, so this stage
 * only needs to fan that validated set out into one row per category, one-for-one. */
export async function handleCoverageAnalysisStage(
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
  if (!stage || stage.kind !== "coverage_analysis") {
    throw new RequirementAnalysisInvalidStateError(
      `Stage "${payload.stageId}" is not a coverage_analysis stage.`,
    );
  }
  if (!reprocessableStageStatuses.has(stage.status)) {
    await advanceDag(runtime, aiAnalysisQueue, scope);
    return;
  }

  const existingEntries = await runtime.repository.listCoverageEntriesByRun(run.id);
  if (existingEntries.length >= coverageCategoryDescriptors.length) {
    // Idempotent replay: the 18 fixed rows already exist from a prior attempt.
    await runtime.repository.updateStage(stage.id, {
      status: "completed",
      completedAt: runtime.now(),
    });
    await advanceDag(runtime, aiAnalysisQueue, scope);
    return;
  }
  // module-03 task: mid-stage retry safety -- a redelivered `run-stage` job may find some (but
  // not all 18) categories already committed by an earlier attempt that crashed partway through
  // the insert loop below. Tracking which category keys already exist lets the insert loop skip
  // them instead of re-inserting and hitting `coverage_matrix_entry_run_category_uidx`.
  const existingCategoryKeys = new Set(existingEntries.map((entry) => entry.categoryKey));

  const snapshotId = run.sourceSnapshotId;
  if (!snapshotId) {
    throw new RequirementAnalysisInvalidStateError(`Run "${run.id}" has no frozen snapshot.`);
  }

  const context = await loadRequirementContext(runtime, run.id);
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
    stageKind: "coverage_analysis",
    promptAssetKind: "coverage_analysis",
    schema: coverageAnalysisOutputSchema,
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
    output: result.output,
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

  for (const category of result.output.categories) {
    const descriptor = categoryDescriptorByKey.get(category.categoryKey);
    if (!descriptor) {
      continue; // Unreachable given the schema's z.enum constraint; defensive only.
    }
    if (existingCategoryKeys.has(category.categoryKey)) {
      // module-03 task: mid-stage retry safety -- an earlier attempt already committed this
      // category's row before crashing; skip it rather than violating
      // `coverage_matrix_entry_run_category_uidx` on a duplicate insert.
      continue;
    }
    const requirementIds = resolveRequirementIds(context, category.requirementIds);
    const citations: Omit<InsertCitationInput, "coverageMatrixEntryId">[] = [];
    for (const requirementId of requirementIds) {
      const requirementCitations = context.citationsByRequirementId.get(requirementId) ?? [];
      for (const citation of requirementCitations) {
        citations.push({
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          analysisRunId: run.id,
          sourceDocumentId: citation.sourceDocumentId,
          sourceVersionNumber: citation.sourceVersionNumber,
          sourceContentHash: citation.sourceContentHash,
          sourceExtractionId: citation.sourceExtractionId,
          sourceExtractionVersion: citation.sourceExtractionVersion,
          sourceChunkId: citation.sourceChunkId,
          sourceChunkSequence: citation.sourceChunkSequence,
          chunkContentHash: citation.chunkContentHash,
          locator: citation.locator,
          quoteTextOriginal: citation.quoteTextOriginal,
          quoteTextNormalized: citation.quoteTextNormalized,
          quoteHash: citation.quoteHash,
          matchStartOffset: citation.matchStartOffset,
          matchEndOffset: citation.matchEndOffset,
          normalizationMode: citation.normalizationMode,
          verificationStatus: citation.verificationStatus,
          createdByAiRunId: aiRunId,
        });
      }
    }

    await runtime.repository.insertCoverageEntryWithCitations(
      {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        analysisRunId: run.id,
        categoryKey: descriptor.key,
        categoryLabel: descriptor.label,
        categoryOrder: descriptor.order,
        status: category.status,
        rationale: category.rationale,
        evidenceState: category.evidenceState,
        createdByAiRunId: aiRunId,
      },
      citations,
    );
    // Guards against the model repeating a category key within the same output; the schema
    // already forbids this, but this loop is the only place that would notice a violation.
    existingCategoryKeys.add(category.categoryKey);
  }

  await runtime.repository.updateStage(stage.id, {
    status: "completed",
    completedAt: runtime.now(),
  });

  await advanceDag(runtime, aiAnalysisQueue, scope);
}
