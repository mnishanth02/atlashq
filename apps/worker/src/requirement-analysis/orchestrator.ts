import type { CitationVerificationJobPayload, RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { RequirementAnalysisInvalidStateError } from "./errors.js";
import type { AiAnalysisQueue, CitationVerificationQueue } from "./queue-helpers.js";
import type { AnalysisRuntime } from "./runtime.js";
import { handlePlanBatches } from "./stages/batch-planning.js";
import { handleCancelRun } from "./stages/cancel.js";
import { handleCitationVerificationJob } from "./stages/citation-consumer.js";
import { handleCitationVerificationStage } from "./stages/citation-verification.js";
import { handleConflictDetectionStage } from "./stages/conflict-detection.js";
import { handleCoverageAnalysisStage } from "./stages/coverage-analysis.js";
import { handleDeliveryItemExtractionStage } from "./stages/delivery-item-extraction.js";
import { handleRunBatch } from "./stages/extraction-batch.js";
import { handleFinalizeRun } from "./stages/finalize.js";
import { handleFreezeSnapshot } from "./stages/freeze-snapshot.js";
import { handleNormalizationDeduplicationStage } from "./stages/normalization.js";
import { handleQuestionGenerationStage } from "./stages/question-generation.js";

export type RunStageJobPayload = Extract<RequirementAnalysisJobPayload, { kind: "run-stage" }>;

/**
 * Top-level dispatcher for every `ai-analysis` (BullMQ) job kind (module-03 §11.1 DAG, task item
 * 2: "Register real ai-analysis ... Queue/Worker consumers"). `main.ts`'s `ai-analysis` worker
 * calls this once per job; every actual stage/batch/lifecycle handler lives under
 * `stages/*.ts` and depends only on {@link AnalysisRuntime} (never on `process.env` or a live
 * BullMQ `Worker`), so this function -- and every handler it calls -- is exercised directly by
 * unit tests with a fake repository/provider/queue (task item 9).
 */
export async function dispatchAiAnalysisJob(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  citationVerificationQueue: CitationVerificationQueue,
  payload: RequirementAnalysisJobPayload,
): Promise<void> {
  switch (payload.kind) {
    case "freeze-snapshot":
      await handleFreezeSnapshot(runtime, aiAnalysisQueue, payload);
      return;
    case "plan-batches":
      await handlePlanBatches(runtime, aiAnalysisQueue, payload);
      return;
    case "run-batch":
      await handleRunBatch(runtime, aiAnalysisQueue, citationVerificationQueue, payload);
      return;
    case "run-stage":
      await dispatchRunStage(runtime, aiAnalysisQueue, payload);
      return;
    case "finalize-run":
      await handleFinalizeRun(runtime, aiAnalysisQueue, payload);
      return;
    case "cancel-run":
      await handleCancelRun(runtime, aiAnalysisQueue, payload);
      return;
    default: {
      const exhaustiveCheck: never = payload;
      throw new RequirementAnalysisInvalidStateError(
        `Unknown ai-analysis job kind "${(exhaustiveCheck as { kind: string }).kind}".`,
      );
    }
  }
}

/**
 * Sub-dispatches a `run-stage` job by its `stageKind` (module03PipelineDescriptor never routes
 * `freeze_snapshot`/`batch_planning`/`confirmed_extraction`/`reference_feature_extraction` through
 * this job kind -- the first two have their own dedicated job kinds, the extraction pair's work is
 * dispatched directly as `run-batch` jobs by `batch-planning.ts`; see `dag.ts`'s special case).
 */
async function dispatchRunStage(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  payload: RunStageJobPayload,
): Promise<void> {
  switch (payload.stageKind) {
    case "citation_verification":
      await handleCitationVerificationStage(runtime, aiAnalysisQueue, payload);
      return;
    case "normalization_deduplication":
      await handleNormalizationDeduplicationStage(runtime, aiAnalysisQueue, payload);
      return;
    case "conflict_detection":
      await handleConflictDetectionStage(runtime, aiAnalysisQueue, payload);
      return;
    case "coverage_analysis":
      await handleCoverageAnalysisStage(runtime, aiAnalysisQueue, payload);
      return;
    case "delivery_item_extraction":
      await handleDeliveryItemExtractionStage(runtime, aiAnalysisQueue, payload);
      return;
    case "question_generation":
      await handleQuestionGenerationStage(runtime, aiAnalysisQueue, payload);
      return;
    case "freeze_snapshot":
    case "batch_planning":
    case "confirmed_extraction":
    case "reference_feature_extraction":
    case "finalize_review_package":
      throw new RequirementAnalysisInvalidStateError(
        `Stage kind "${payload.stageKind}" must never be dispatched as a "run-stage" job.`,
      );
    default: {
      const exhaustiveCheck: never = payload.stageKind;
      throw new RequirementAnalysisInvalidStateError(
        `Unknown run-stage stageKind "${exhaustiveCheck as string}".`,
      );
    }
  }
}

/**
 * Top-level dispatcher for every `citation-verification` (BullMQ) job -- the real, operative
 * second half of the dual-path design (see `citation-verification.ts`); `main.ts`'s
 * `citation-verification` worker calls this once per job.
 */
export async function dispatchCitationVerificationJob(
  runtime: AnalysisRuntime,
  payload: CitationVerificationJobPayload,
): Promise<void> {
  await handleCitationVerificationJob(runtime, payload);
}
