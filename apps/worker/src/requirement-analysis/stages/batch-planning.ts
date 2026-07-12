import {
  type BatchPlannerChunk,
  buildExtractionCacheKey,
  type ExtractionCacheStageKind,
  module03PipelineDescriptor,
  planDeterministicBatches,
  promptAssetRegistry,
} from "@atlashq/ai";
import type { RequirementAnalysisBatch, RequirementAnalysisRun } from "@atlashq/db";
import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { createRequirementAnalysisIdempotencyKey } from "@atlashq/jobs";
import type { AnalysisStageKind } from "@atlashq/types";
import { advanceDag } from "../dag.js";
import { buildStageIdempotencyKey } from "../ids.js";
import { type AiAnalysisQueue, enqueueAiAnalysisJob } from "../queue-helpers.js";
import type { AnalysisScope, FrozenSnapshotChunkRef } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import { assertNotCanceled, assertWithinWallClock, loadRunInScope } from "./common.js";

export type PlanBatchesJobPayload = Extract<
  RequirementAnalysisJobPayload,
  { kind: "plan-batches" }
>;

/**
 * Worker-local per-batch token ceilings (module-03 §7.2 only defines run-level ceilings; no
 * per-batch config exists in `@atlashq/config`). Deliberately conservative so a single batch never
 * dominates the run-level budget and so evidence blocks stay small enough for the model's context
 * window; `planDeterministicBatches` still enforces the run-level ceilings from `run.maxInputTokens`
 * / `run.maxOutputTokens` on top of these per-batch caps.
 */
const MAX_INPUT_TOKENS_PER_BATCH = 6_000;
const MAX_OUTPUT_TOKENS_PER_BATCH = 1_500;

/** module-03 §11.2 `batch_planning`: deterministic batching split by origin and by source document
 * (a batch may never span more than one source document, matching `buildExtractionCacheKey`'s
 * per-source-document cache key shape). Flag-off references are never batched (task item 4). */
export async function handlePlanBatches(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  payload: PlanBatchesJobPayload,
): Promise<void> {
  const scope: AnalysisScope = {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    runId: payload.runId,
  };
  const run = await loadRunInScope(runtime, scope);
  await assertNotCanceled(runtime, run);
  assertWithinWallClock(run, runtime.now());

  const batchPlanningKey = buildStageIdempotencyKey({ runId: run.id, kind: "batch_planning" });
  const existingBatchPlanningStage =
    await runtime.repository.findStageByIdempotencyKey(batchPlanningKey);

  if (existingBatchPlanningStage && existingBatchPlanningStage.status !== "pending") {
    // Idempotent replay: batches were already planned; just make sure every still-pending batch
    // has a `run-batch` job enqueued and re-drive the DAG in case a prior attempt crashed between
    // planning and enqueueing.
    await reEnqueuePendingBatches(runtime, aiAnalysisQueue, scope);
    await advanceDag(runtime, aiAnalysisQueue, scope);
    return;
  }

  const allChunks = await runtime.repository.listSnapshotChunks(payload.snapshotId);
  const sourceChunks = allChunks.filter((chunk) => chunk.origin === "source");
  const referenceChunks = runtime.featureFlags.referenceFeatureExtractionEnabled
    ? allChunks.filter((chunk) => chunk.origin === "reference")
    : [];

  const stageRowsByKind = new Map<AnalysisStageKind, { id: string }>();
  const freezeSnapshotKey = buildStageIdempotencyKey({ runId: run.id, kind: "freeze_snapshot" });
  const freezeSnapshotStage = await runtime.repository.findStageByIdempotencyKey(freezeSnapshotKey);
  if (!freezeSnapshotStage) {
    throw new Error(`Run "${run.id}" is missing its completed freeze_snapshot stage row.`);
  }
  stageRowsByKind.set("freeze_snapshot", freezeSnapshotStage);

  for (const descriptor of module03PipelineDescriptor.stages) {
    if (descriptor.kind === "freeze_snapshot") {
      continue;
    }
    const idempotencyKey = buildStageIdempotencyKey({ runId: run.id, kind: descriptor.kind });
    const existing = await runtime.repository.findStageByIdempotencyKey(idempotencyKey);
    const stageRow =
      existing ??
      (await runtime.repository.createStage({ ...scope, kind: descriptor.kind, idempotencyKey }));
    stageRowsByKind.set(descriptor.kind, stageRow);
  }

  for (const descriptor of module03PipelineDescriptor.stages) {
    if (descriptor.kind === "freeze_snapshot") {
      continue;
    }
    const stageRow = stageRowsByKind.get(descriptor.kind);
    if (!stageRow) {
      continue;
    }
    for (const dependsOnKind of descriptor.dependsOn) {
      const dependsOnRow = stageRowsByKind.get(dependsOnKind);
      if (!dependsOnRow) {
        continue;
      }
      await runtime.repository.createStageDependency({
        scope,
        stageId: stageRow.id,
        dependsOnStageId: dependsOnRow.id,
      });
    }
  }

  const batchPlanningStage = stageRowsByKind.get("batch_planning");
  if (!batchPlanningStage) {
    throw new Error(`Failed to create batch_planning stage row for run "${run.id}".`);
  }
  await runtime.repository.updateStage(batchPlanningStage.id, {
    status: "running",
    startedAt: runtime.now(),
  });

  const confirmedStage = stageRowsByKind.get("confirmed_extraction");
  const referenceStage = stageRowsByKind.get("reference_feature_extraction");
  if (!confirmedStage || !referenceStage) {
    throw new Error(`Failed to create extraction stage rows for run "${run.id}".`);
  }

  const confirmedBatches = await planAndCreateBatches({
    runtime,
    scope,
    run,
    stageId: confirmedStage.id,
    stageKind: "confirmed_extraction",
    chunks: sourceChunks,
  });

  let referenceBatches: RequirementAnalysisBatch[] = [];
  if (!runtime.featureFlags.referenceFeatureExtractionEnabled || referenceChunks.length === 0) {
    await runtime.repository.updateStage(referenceStage.id, {
      status: "skipped",
      startedAt: runtime.now(),
      completedAt: runtime.now(),
    });
  } else {
    referenceBatches = await planAndCreateBatches({
      runtime,
      scope,
      run,
      stageId: referenceStage.id,
      stageKind: "reference_feature_extraction",
      chunks: referenceChunks,
    });
  }

  if (confirmedBatches.length === 0) {
    await runtime.repository.updateStage(confirmedStage.id, {
      status: "completed_with_warnings",
      startedAt: runtime.now(),
      completedAt: runtime.now(),
    });
  }

  await runtime.repository.updateStage(batchPlanningStage.id, {
    status: "completed",
    completedAt: runtime.now(),
  });
  await runtime.repository.transitionRun(run.id, { status: "running" });

  for (const batch of [...confirmedBatches, ...referenceBatches]) {
    await enqueueRunBatch(runtime, aiAnalysisQueue, scope, batch);
  }

  await advanceDag(runtime, aiAnalysisQueue, scope);
}

async function planAndCreateBatches(input: {
  runtime: AnalysisRuntime;
  scope: AnalysisScope;
  run: RequirementAnalysisRun;
  stageId: string;
  stageKind: ExtractionCacheStageKind;
  chunks: readonly FrozenSnapshotChunkRef[];
}): Promise<RequirementAnalysisBatch[]> {
  const { runtime, scope, run, stageId, stageKind, chunks } = input;
  if (chunks.length === 0) {
    return [];
  }

  const bySourceDocument = new Map<string, FrozenSnapshotChunkRef[]>();
  for (const chunk of chunks) {
    const list = bySourceDocument.get(chunk.sourceDocumentId) ?? [];
    list.push(chunk);
    bySourceDocument.set(chunk.sourceDocumentId, list);
  }

  const promptAsset = promptAssetRegistry.getByKind(stageKind);
  const created: RequirementAnalysisBatch[] = [];
  let batchOrder = 0;

  for (const [sourceDocumentId, sourceDocumentChunks] of bySourceDocument) {
    const chunksById = new Map(sourceDocumentChunks.map((chunk) => [chunk.snapshotChunkId, chunk]));
    const plannerChunks: BatchPlannerChunk[] = sourceDocumentChunks.map((chunk) => ({
      snapshotChunkId: chunk.snapshotChunkId,
      sourceDocumentId: chunk.sourceDocumentId,
      sourceOrder: chunk.sourceOrder,
      sourceExtractionVersion: chunk.sourceExtractionVersion,
      chunkSequence: chunk.chunkSequence,
      chunkContentHash: chunk.chunkContentHash,
      text: chunk.content,
    }));

    const planResult = planDeterministicBatches({
      chunks: plannerChunks,
      maxInputTokensPerRun: run.maxInputTokens,
      maxInputTokensPerBatch: MAX_INPUT_TOKENS_PER_BATCH,
      maxOutputTokensPerRun: run.maxOutputTokens,
      maxOutputTokensPerBatch: MAX_OUTPUT_TOKENS_PER_BATCH,
      inputTokensUsed: run.inputTokensUsed,
      outputTokensUsed: run.outputTokensUsed,
    });

    const firstChunk = sourceDocumentChunks[0];
    if (!firstChunk) {
      continue;
    }

    for (const plannedBatch of planResult.batches) {
      const chunkContentHashes = plannedBatch.snapshotChunkIds.map((id) => {
        const chunk = chunksById.get(id);
        if (!chunk) {
          throw new Error(`Planned batch referenced unknown snapshot chunk "${id}".`);
        }
        return chunk.chunkContentHash;
      });

      const cacheKey = buildExtractionCacheKey({
        organizationId: scope.organizationId,
        stageKind,
        sourceDocumentId,
        sourceContentHash: firstChunk.sourceContentHash,
        sourceExtractionVersion: firstChunk.sourceExtractionVersion,
        chunkerVersion: firstChunk.chunkerVersion,
        chunkContentHashes,
        promptHash: promptAsset.hash,
        schemaHash: run.schemaBundleHash,
        pipelineHash: run.pipelineHash,
        modelPolicyHash: run.modelPolicyHash,
        temperature: 0,
        seed: null,
      });

      const batchRow = await runtime.repository.createBatch({
        ...scope,
        stageId,
        batchOrder,
        sourceChunkStartSequence: plannedBatch.sourceChunkStartSequence,
        sourceChunkEndSequence: plannedBatch.sourceChunkEndSequence,
        inputTokenEstimate: plannedBatch.inputTokenEstimate,
        maxOutputTokens: plannedBatch.maxOutputTokens,
        cacheKey,
        chunkIds: plannedBatch.snapshotChunkIds,
      });
      batchOrder += 1;
      created.push(batchRow);
    }
  }

  return created;
}

async function enqueueRunBatch(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  scope: AnalysisScope,
  batch: RequirementAnalysisBatch,
): Promise<void> {
  await enqueueAiAnalysisJob(aiAnalysisQueue, {
    kind: "run-batch",
    idempotencyKey: createRequirementAnalysisIdempotencyKey({
      kind: "run-batch",
      runId: scope.runId,
      stageId: batch.stageId,
      batchId: batch.id,
    }),
    correlationId: scope.runId,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    runId: scope.runId,
    stageId: batch.stageId,
    batchId: batch.id,
    submittedAt: runtime.now().toISOString(),
  });
}

async function reEnqueuePendingBatches(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  scope: AnalysisScope,
): Promise<void> {
  const stages = await runtime.repository.listStagesByRun(scope.runId);
  for (const stage of stages) {
    if (stage.kind !== "confirmed_extraction" && stage.kind !== "reference_feature_extraction") {
      continue;
    }
    const batches = await runtime.repository.listBatchesByStage(stage.id);
    for (const batch of batches) {
      if (batch.status === "pending") {
        await enqueueRunBatch(runtime, aiAnalysisQueue, scope, batch);
      }
    }
  }
}
