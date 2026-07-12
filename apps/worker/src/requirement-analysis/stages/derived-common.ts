import type { StructuredEvidenceBlock } from "@atlashq/ai";
import type {
  Citation,
  DeliveryItem,
  Requirement,
  RequirementAnalysisBatch,
  RequirementAnalysisRun,
  RequirementAnalysisStage,
} from "@atlashq/db";
import { defaultRetryPolicy } from "@atlashq/jobs";
import type { AnalysisStageStatus } from "@atlashq/types";
import type { z } from "zod";
import { isOperatorRetryableAiFailure } from "../errors.js";
import type { AnalysisScope, InsertCitationInput } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import type { QuoteCandidate } from "../schemas.js";
import { runStructuredStage } from "./common.js";

/**
 * `conflict_detection`/`coverage_analysis`/`delivery_item_extraction`/`question_generation` all
 * `usesModel: true` (module-03 §11.2) but operate over already-persisted, already-deduped
 * `requirement` rows rather than fresh snapshot chunks. `@atlashq/ai`'s structured wrapper still
 * requires a real `batchId` for provenance/idempotency (module-03 §11.4), so exactly one synthetic
 * `requirement_analysis_batch` row (`batchOrder: 0`, no chunk membership -- the `batch_chunk`
 * table has no not-empty constraint) is created per stage purely to carry that stage's single
 * `ai_run` link; created once and reused across idempotent-replay attempts.
 */
export async function ensureSyntheticBatch(
  runtime: AnalysisRuntime,
  scope: AnalysisScope,
  stageId: string,
): Promise<RequirementAnalysisBatch> {
  const existing = await runtime.repository.listBatchesByStage(stageId);
  const first = existing[0];
  if (first) {
    return first;
  }
  return runtime.repository.createBatch({
    ...scope,
    stageId,
    batchOrder: 0,
    sourceChunkStartSequence: 0,
    sourceChunkEndSequence: 0,
    inputTokenEstimate: 0,
    maxOutputTokens: 2_000,
    chunkIds: [],
  });
}

export type RequirementContext = {
  requirements: readonly Requirement[];
  /** Model-facing identifier for a requirement is always its `stableKey` (the same identifier the
   * extraction stage originally assigned), never the DB row id -- so every derived stage's
   * "requirementIds" output field is resolved back to a DB id through this map. */
  requirementIdByStableKey: ReadonlyMap<string, string>;
  citationsByRequirementId: ReadonlyMap<string, readonly Citation[]>;
  /** Every citation across every requirement, keyed by its own id -- this is the "block id" a
   * derived stage's evidence blocks expose to the model (see
   * `buildEvidenceBlocksFromRequirements`), so a model-proposed `QuoteCandidate.snapshotChunkId`
   * for a derived stage is always really a citation id, resolved back through this map. */
  citationById: ReadonlyMap<string, Citation>;
};

/** Loads every requirement persisted for this run plus its citations, for building evidence and
 * resolving model-proposed `stableKey` references back onto DB requirement ids. */
export async function loadRequirementContext(
  runtime: AnalysisRuntime,
  runId: string,
): Promise<RequirementContext> {
  const requirements = await runtime.repository.listRequirementsByRun(runId);
  const requirementIdByStableKey = new Map(requirements.map((row) => [row.stableKey, row.id]));
  const citationsByRequirementId = new Map<string, readonly Citation[]>();
  const citationById = new Map<string, Citation>();
  for (const requirement of requirements) {
    const citations = await runtime.repository.listCitationsByRequirement(requirement.id);
    citationsByRequirementId.set(requirement.id, citations);
    for (const citation of citations) {
      citationById.set(citation.id, citation);
    }
  }
  return { requirements, requirementIdByStableKey, citationsByRequirementId, citationById };
}

/** Builds evidence blocks from already-verified requirement citations (never from raw untrusted
 * snapshot chunks directly) -- each block's text is prefixed with the owning requirement's
 * `stableKey` so the model can refer back to it in its own output. */
export function buildEvidenceBlocksFromRequirements(input: {
  organizationId: string;
  projectId: string;
  snapshotId: string;
  context: RequirementContext;
}): StructuredEvidenceBlock[] {
  const blocks: StructuredEvidenceBlock[] = [];
  for (const requirement of input.context.requirements) {
    const citations = input.context.citationsByRequirementId.get(requirement.id) ?? [];
    for (const citation of citations) {
      blocks.push({
        blockId: citation.id,
        organizationId: input.organizationId,
        projectId: input.projectId,
        snapshotId: input.snapshotId,
        sourceDocumentId: citation.sourceDocumentId,
        sourceChunkId: citation.sourceChunkId,
        chunkContentHash: citation.chunkContentHash,
        origin: requirement.origin === "reference" ? "reference" : "source",
        text: `[requirement:${requirement.stableKey}] ${citation.quoteTextOriginal}`,
        locator: citation.locator,
      });
    }
  }
  return blocks;
}

/** Resolves a model-proposed `stableKey` list back to DB requirement ids, silently dropping any
 * key the model invented that does not correspond to a persisted requirement (never trust model
 * output for referential integrity). */
export function resolveRequirementIds(
  context: RequirementContext,
  stableKeys: readonly string[],
): string[] {
  const ids: string[] = [];
  for (const stableKey of stableKeys) {
    const id = context.requirementIdByStableKey.get(stableKey);
    if (id) {
      ids.push(id);
    }
  }
  return ids;
}

/** Clones one already-verified requirement citation into a new insertable citation row for a
 * *different* target (a `delivery_item` or `question` `delivery_item`) -- module-03 §10: every
 * citation, no matter which artifact it ends up attached to, always traces back to the exact
 * frozen chunk/quote/offsets/hash it was originally verified against, never a re-derived or
 * re-guessed value. Drops (never fabricates) any `QuoteCandidate` whose `snapshotChunkId` does not
 * resolve to a real citation id from this run's evidence blocks. */
export function resolveCitationClones(
  context: RequirementContext,
  quoteCandidates: readonly QuoteCandidate[],
  createdByAiRunId: string,
): Omit<InsertCitationInput, "requirementId" | "coverageMatrixEntryId" | "deliveryItemId">[] {
  const clones: Omit<
    InsertCitationInput,
    "requirementId" | "coverageMatrixEntryId" | "deliveryItemId"
  >[] = [];
  const seen = new Set<string>();
  for (const candidate of quoteCandidates) {
    const citation = context.citationById.get(candidate.snapshotChunkId);
    if (!citation || seen.has(citation.id)) {
      continue;
    }
    seen.add(citation.id);
    clones.push({
      organizationId: citation.organizationId,
      projectId: citation.projectId,
      analysisRunId: citation.analysisRunId,
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
      createdByAiRunId,
    });
  }
  return clones;
}

/** Stage statuses from which `conflict_detection`/`coverage_analysis`/`delivery_item_extraction`/
 * `question_generation` must still resume processing rather than short-circuit to `advanceDag`
 * (module-03 task: mid-stage retry safety). `waiting_retry` sits alongside the original
 * `pending`/`running` set because {@link runDerivedModelStage} parks a stage there after a
 * transient failure that has not yet exhausted this module's own attempt budget -- the next
 * BullMQ redelivery of that `run-stage` job must still be treated as in-flight work, never as an
 * already-terminal stage. */
export const reprocessableStageStatuses: ReadonlySet<string> = new Set<AnalysisStageStatus>([
  "pending",
  "running",
  "waiting_retry",
]);

/** This module's own bounded attempt budget for one derived stage's model call, mirrored from
 * `@atlashq/jobs`' `defaultRetryPolicy.attempts` (read-only import; never edited by this task) so
 * a run can never be left stuck `running`/`waiting_retry` forever: `main.ts`'s `ai-analysis`
 * Worker callback never threads BullMQ's own `job.attemptsMade`/`job.opts.attempts` into these
 * handlers, so {@link runDerivedModelStage} tracks retry exhaustion itself via the stage's own
 * `attemptNumber` column instead. */
const MAX_DERIVED_STAGE_MODEL_ATTEMPTS = defaultRetryPolicy.attempts;

/**
 * Marks one derived stage's synthetic batch (if any), the stage itself, and -- unless the run has
 * already reached a terminal state -- the run, all `failed` with the same safe `failureCode`/
 * `failureDetail` (module-03 task: "never leave a run stuck running after exhausted retries").
 * Mirrors `extraction-batch.ts`'s `failBatchStageAndRun` for the four `usesModel: true` derived
 * stages, which use a synthetic batch (`ensureSyntheticBatch`) rather than a real extraction
 * batch. Callers must already have reduced `failureCode`/`failureDetail` to a stable, content-free
 * value (see `errors.ts#toWorkerError`) -- this helper never inspects or re-derives them from raw
 * error text.
 */
export async function failDerivedStageAndRun(
  runtime: AnalysisRuntime,
  run: RequirementAnalysisRun,
  stageId: string,
  batchId: string | null,
  failureCode: string,
  failureDetail: string,
  failureRetryable: boolean,
): Promise<void> {
  if (batchId) {
    await runtime.repository.updateBatch(batchId, {
      status: "failed",
      failureCode,
      failureDetail,
    });
  }
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

/**
 * Wraps {@link runStructuredStage} with the mid-stage retry semantics module-03's review flagged
 * as missing for the four derived stages: a `retryable` failure bumps the stage's own
 * `attemptNumber` and parks it in `waiting_retry` (still reprocessable -- see
 * {@link reprocessableStageStatuses}) so the next BullMQ redelivery resumes; once this module's
 * own {@link MAX_DERIVED_STAGE_MODEL_ATTEMPTS} budget is exhausted, or the failure was
 * non-retryable to begin with, the stage/run are moved straight to `failed` via
 * {@link failDerivedStageAndRun} instead of ever being left stuck `running`. Every code path
 * re-throws so the caller's own control flow (and BullMQ's redelivery for the retryable case)
 * behaves exactly as it already does for every other stage/batch handler in this module.
 */
export async function runDerivedModelStage<TSchema extends z.ZodTypeAny>(
  input: Parameters<typeof runStructuredStage<TSchema>>[0] & {
    stage: RequirementAnalysisStage;
  },
): ReturnType<typeof runStructuredStage<TSchema>> {
  const { stage, ...structuredInput } = input;
  try {
    return await runStructuredStage(structuredInput);
  } catch (error) {
    const workerError = error as { retryable?: boolean; code?: string; message: string };
    const failureCode = workerError.code ?? "AI_RUN_FAILED";
    const failureRetryable = isOperatorRetryableAiFailure(workerError);
    if (workerError.retryable) {
      const nextAttemptNumber = stage.attemptNumber + 1;
      if (nextAttemptNumber > MAX_DERIVED_STAGE_MODEL_ATTEMPTS) {
        await failDerivedStageAndRun(
          input.runtime,
          input.run,
          stage.id,
          input.batchId,
          "AI_RUN_RETRIES_EXHAUSTED",
          `${workerError.message} (exhausted ${MAX_DERIVED_STAGE_MODEL_ATTEMPTS} attempt(s)).`,
          failureRetryable,
        );
      } else {
        await input.runtime.repository.updateStage(stage.id, {
          status: "waiting_retry",
          attemptNumber: nextAttemptNumber,
          failureCode,
          failureDetail: workerError.message,
        });
      }
      throw error;
    }
    await failDerivedStageAndRun(
      input.runtime,
      input.run,
      stage.id,
      input.batchId,
      failureCode,
      workerError.message,
      failureRetryable,
    );
    throw error;
  }
}

/** Deterministic identity for one `delivery_item` row -- module-03 task: mid-stage retry safety --
 * derived only from already-persisted/model-proposed columns (`itemType`, normalized
 * `title`/`description`, and `sourceRequirementId` as the linkage field), since `delivery_item`
 * carries no dedicated stable-key column of its own. Used to key both already-persisted rows and
 * freshly model-proposed candidates so a `run-stage` job redelivered while the stage is still
 * `running` (or resumed from `waiting_retry`) can recognize a row it, or an earlier crashed
 * attempt, already committed and skip re-inserting it instead of duplicating it. */
export function buildDeliveryItemStableKey(input: {
  itemType: string;
  title: string;
  description: string | null;
  sourceRequirementId: string | null;
}): string {
  const normalizedTitle = input.title.trim().toLowerCase();
  const normalizedDescription = (input.description ?? "").trim().toLowerCase();
  return [
    input.itemType,
    input.sourceRequirementId ?? "",
    normalizedTitle,
    normalizedDescription,
  ].join("\u001f");
}

/** Indexes already-persisted `delivery_item` rows for this run by {@link buildDeliveryItemStableKey}
 * so `delivery_item_extraction`/`question_generation` can look up (and, where a stage has
 * follow-up side effects like coverage-question linking, repair against) a row an earlier crashed
 * attempt already committed, rather than blindly skipping or blindly re-inserting it. */
export function indexDeliveryItemsByStableKey(
  items: readonly DeliveryItem[],
): ReadonlyMap<string, DeliveryItem> {
  const map = new Map<string, DeliveryItem>();
  for (const item of items) {
    map.set(
      buildDeliveryItemStableKey({
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        sourceRequirementId: item.sourceRequirementId,
      }),
      item,
    );
  }
  return map;
}
