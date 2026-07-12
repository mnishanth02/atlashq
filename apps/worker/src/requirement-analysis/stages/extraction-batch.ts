import type { AiRunCost, RequirementAnalysisBatch, RequirementAnalysisRun } from "@atlashq/db";
import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { createCitationVerificationIdempotencyKey } from "@atlashq/jobs";
import type { JsonObject } from "@atlashq/types";
import { InvalidJobDataError } from "../../errors.js";
import { advanceDag } from "../dag.js";
import { isOperatorRetryableAiFailure, RequirementAnalysisInvalidStateError } from "../errors.js";
import { buildEvidenceBlocks } from "../evidence.js";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import {
  type CitationVerificationQueue,
  enqueueCitationVerificationJob,
} from "../queue-helpers.js";
import type { AnalysisScope } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import {
  confirmedExtractionOutputSchema,
  referenceFeatureExtractionOutputSchema,
} from "../schemas.js";
import {
  assertNotCanceled,
  assertWithinWallClock,
  loadRunInScope,
  runStructuredStage,
} from "./common.js";

export type RunBatchJobPayload = Extract<RequirementAnalysisJobPayload, { kind: "run-batch" }>;

const terminalBatchStatuses = new Set([
  "completed",
  "completed_with_warnings",
  "failed",
  "canceled",
  "skipped",
]);

/** module-03 §11.2 `confirmed_extraction`/`reference_feature_extraction` `run-batch`: calls the
 * shared `@atlashq/ai` structured wrapper (temperature 0, one shape-only repair, no tools/fallback)
 * for one deterministic batch, or reuses a source-local org-scoped cache hit (task item 5) --
 * either way, this only ever records the model output; citation verification always happens later,
 * uniformly, in the `citation_verification` stage (task item 5: "cache hits ... always reverify
 * citations"). */
export async function handleRunBatch(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  citationVerificationQueue: CitationVerificationQueue,
  payload: RunBatchJobPayload,
): Promise<void> {
  const scope: AnalysisScope = {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    runId: payload.runId,
  };
  const run = await loadRunInScope(runtime, scope);
  await assertNotCanceled(runtime, run);

  const batch = await runtime.repository.getBatch(payload.batchId);
  if (!batch) {
    throw new InvalidJobDataError(`Batch "${payload.batchId}" does not exist.`);
  }

  if (terminalBatchStatuses.has(batch.status)) {
    // Idempotent replay: this batch already reached a terminal state on a prior attempt.
    await maybeCompleteExtractionStage(runtime, aiAnalysisQueue, scope, batch.stageId);
    return;
  }

  const stage = await runtime.repository.getStage(payload.stageId);
  if (!stage) {
    throw new InvalidJobDataError(`Stage "${payload.stageId}" does not exist.`);
  }
  if (stage.kind !== "confirmed_extraction" && stage.kind !== "reference_feature_extraction") {
    throw new RequirementAnalysisInvalidStateError(
      `run-batch job targets stage kind "${stage.kind}", expected an extraction stage.`,
    );
  }

  try {
    assertWithinWallClock(run, runtime.now());
  } catch (error) {
    await failBatchStageAndRun(
      runtime,
      run,
      batch,
      stage.id,
      "AI_RUN_BUDGET_EXCEEDED",
      String(error),
      false,
    );
    throw error;
  }

  await runtime.repository.updateBatch(batch.id, { status: "running" });

  const chunks = await runtime.repository.listBatchChunkContents(batch.id);
  if (chunks.length === 0) {
    throw new RequirementAnalysisInvalidStateError(`Batch "${batch.id}" has no chunk membership.`);
  }

  let cacheHit = batch.cacheKey
    ? await runtime.repository.findExtractionCacheHit({
        organizationId: scope.organizationId,
        cacheKey: batch.cacheKey,
      })
    : null;
  if (cacheHit && cacheHit.sourceBatchId === batch.id) {
    cacheHit = null; // Never treat this batch's own (not-yet-completed) row as a cache hit.
  }

  if (cacheHit) {
    await runtime.repository.updateBatch(batch.id, {
      status: "completed",
      aiRunId: cacheHit.aiRunId,
    });
    await enqueueCitationVerificationJob(citationVerificationQueue, {
      idempotencyKey: createCitationVerificationIdempotencyKey({
        runId: scope.runId,
        stageId: stage.id,
        batchId: batch.id,
      }),
      correlationId: scope.runId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      runId: scope.runId,
      stageId: stage.id,
      batchId: batch.id,
      submittedAt: runtime.now().toISOString(),
    });
    await maybeCompleteExtractionStage(runtime, aiAnalysisQueue, scope, stage.id);
    return;
  }

  const snapshotId = run.sourceSnapshotId;
  if (!snapshotId) {
    throw new RequirementAnalysisInvalidStateError(`Run "${run.id}" has no frozen snapshot yet.`);
  }
  const evidenceBlocks = buildEvidenceBlocks({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    snapshotId,
    chunks,
  });
  const schema =
    stage.kind === "confirmed_extraction"
      ? confirmedExtractionOutputSchema
      : referenceFeatureExtractionOutputSchema;

  let result: Awaited<ReturnType<typeof runStructuredStage<typeof schema>>>;
  try {
    result = await runStructuredStage({
      runtime,
      run,
      scope,
      batchId: batch.id,
      stageKind: stage.kind,
      promptAssetKind: stage.kind,
      schema,
      evidenceBlocks,
      idempotencyKey: payload.idempotencyKey,
    });
  } catch (error) {
    const workerError = error as { retryable?: boolean; code?: string; message: string };
    if (workerError.retryable) {
      throw error;
    }
    await failBatchStageAndRun(
      runtime,
      run,
      batch,
      stage.id,
      workerError.code ?? "AI_RUN_FAILED",
      workerError.message,
      isOperatorRetryableAiFailure(workerError),
    );
    throw error;
  }

  const inputArtifactVersions = [
    ...new Set(chunks.map((chunk) => `${chunk.sourceDocumentId}@${chunk.sourceExtractionVersion}`)),
  ];
  const cost: AiRunCost | null =
    result.usage.costUsd !== null ? { currency: "USD", amount: result.usage.costUsd } : null;

  const aiRunId = await runtime.repository.insertAiRun({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    agent: "module-03-requirement-analyzer",
    model: result.provenance.resolvedModelId,
    provider: result.provenance.provider,
    promptVersion: result.provenance.promptVersion,
    inputArtifactVersions,
    output: result.output as unknown as JsonObject,
    runStatus: "succeeded",
    cost,
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

  await enqueueCitationVerificationJob(citationVerificationQueue, {
    idempotencyKey: createCitationVerificationIdempotencyKey({
      runId: scope.runId,
      stageId: stage.id,
      batchId: batch.id,
    }),
    correlationId: scope.runId,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    runId: scope.runId,
    stageId: stage.id,
    batchId: batch.id,
    submittedAt: runtime.now().toISOString(),
  });

  await maybeCompleteExtractionStage(runtime, aiAnalysisQueue, scope, stage.id);
}

async function failBatchStageAndRun(
  runtime: AnalysisRuntime,
  run: RequirementAnalysisRun,
  batch: RequirementAnalysisBatch,
  stageId: string,
  failureCode: string,
  failureDetail: string,
  failureRetryable: boolean,
): Promise<void> {
  await runtime.repository.updateBatch(batch.id, {
    status: "failed",
    failureCode,
    failureDetail,
  });
  await runtime.repository.updateStage(stageId, {
    status: "failed",
    completedAt: runtime.now(),
    failureCode,
    failureDetail,
  });
  if (run.status !== "failed" && run.status !== "canceled") {
    await runtime.repository.transitionRun(run.id, {
      status: "failed",
      completedAt: runtime.now(),
      failureCode,
      failureDetail,
      failureRetryable,
      failedStageId: stageId,
    });
  }
}

async function maybeCompleteExtractionStage(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  scope: AnalysisScope,
  stageId: string,
): Promise<void> {
  const stage = await runtime.repository.getStage(stageId);
  if (!stage || (stage.status !== "running" && stage.status !== "pending")) {
    return; // Already terminal (e.g. failed fast on a sibling batch failure).
  }

  const batches = await runtime.repository.listBatchesByStage(stageId);
  if (batches.length === 0 || !batches.every((batch) => terminalBatchStatuses.has(batch.status))) {
    return;
  }

  if (batches.some((batch) => batch.status === "failed")) {
    await runtime.repository.updateStage(stageId, {
      status: "failed",
      completedAt: runtime.now(),
      failureCode: "AI_RUN_BATCH_FAILED",
      failureDetail: "One or more batches in this stage failed.",
    });
  } else {
    const anyRepairUsed = batches.some((batch) => batch.shapeOnlyRepairUsed);
    await runtime.repository.updateStage(stageId, {
      status: anyRepairUsed ? "completed_with_warnings" : "completed",
      completedAt: runtime.now(),
    });
  }

  await advanceDag(runtime, aiAnalysisQueue, scope);
}
