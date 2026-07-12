import {
  createDeterministicSamplingProfile,
  generateStructuredAnalysisStep,
  type PromptAssetKind,
  promptAssetRegistry,
  type SchemaDescriptor,
} from "@atlashq/ai";
import type { RequirementAnalysisRun } from "@atlashq/db";
import type { AnalysisStageKind } from "@atlashq/types";
import type { z } from "zod";
import { InvalidJobDataError } from "../../errors.js";
import {
  RequirementAnalysisInvalidStateError,
  RunBudgetExceededError,
  RunCanceledError,
  toWorkerError,
} from "../errors.js";
import { resolveProviderModelForPolicy } from "../provider-runtime.js";
import type { AnalysisScope } from "../repository/types.js";
import {
  type AnalysisRuntime,
  buildGenerationBudget,
  isRunPastWallClockDeadline,
} from "../runtime.js";

/** Loads the run and defensively verifies the job payload's scope actually matches its rows. */
export async function loadRunInScope(
  runtime: AnalysisRuntime,
  scope: AnalysisScope,
): Promise<RequirementAnalysisRun> {
  const run = await runtime.repository.getRun(scope.runId);
  if (!run) {
    throw new InvalidJobDataError(`Run "${scope.runId}" does not exist.`);
  }
  if (run.organizationId !== scope.organizationId || run.projectId !== scope.projectId) {
    throw new InvalidJobDataError(
      `Run "${scope.runId}" does not belong to organization/project in job payload.`,
    );
  }
  return run;
}

/** Throws {@link RunCanceledError} once a cancellation has been requested for this run. Every
 * stage/batch handler must call this immediately after loading the run so partial work never
 * continues past a cancellation request (module-03 §11.6, task item 8: preserve partial artifacts). */
export async function assertNotCanceled(
  runtime: AnalysisRuntime,
  run: RequirementAnalysisRun,
): Promise<void> {
  if (run.status === "canceled") {
    throw new RunCanceledError(`Run "${run.id}" is already canceled.`);
  }
  const cancellationRequested = await runtime.repository.isCancellationRequested(run.id);
  if (cancellationRequested) {
    throw new RunCanceledError(`Run "${run.id}" cancellation was requested.`);
  }
}

/** Throws {@link RunBudgetExceededError} once the run's wall-clock ceiling has elapsed. */
export function assertWithinWallClock(run: RequirementAnalysisRun, now: Date): void {
  if (isRunPastWallClockDeadline(run, now)) {
    throw new RunBudgetExceededError(`Run "${run.id}" exceeded its max_wall_clock_seconds budget.`);
  }
}

/** Resolves the frozen provider policy + model for this run (module-03 §7.1: policy is pinned at
 * run creation and re-validated fresh on every call so a revoked policy can never be reused). */
export async function resolveRunProviderModel(
  runtime: AnalysisRuntime,
  run: RequirementAnalysisRun,
) {
  const policyRow = await runtime.repository.getApprovedProviderPolicy(run.providerPolicyId);
  if (!policyRow) {
    throw new RequirementAnalysisInvalidStateError(
      `Provider policy "${run.providerPolicyId}" pinned to run "${run.id}" no longer exists.`,
    );
  }
  return resolveProviderModelForPolicy(runtime.providerRegistry, policyRow, run.organizationId);
}

/**
 * Calls the shared `@atlashq/ai` structured-generation wrapper for one stage/batch, mapping any
 * `AiCoreError` onto the worker's retryable/terminal taxonomy (module-03 §11.2, §16.1: transient
 * retry classification only, one shape-only repair, temperature 0, no tools/fallback).
 */
export async function runStructuredStage<TSchema extends z.ZodTypeAny>(input: {
  runtime: AnalysisRuntime;
  run: RequirementAnalysisRun;
  scope: AnalysisScope;
  batchId: string;
  stageKind: AnalysisStageKind;
  promptAssetKind: PromptAssetKind;
  schema: TSchema;
  evidenceBlocks: Parameters<typeof generateStructuredAnalysisStep>[0]["evidenceBlocks"];
  idempotencyKey: string;
  abortSignal?: AbortSignal;
}) {
  const { runtime, run, scope } = input;
  const { approvedPolicy, resolvedModel } = await resolveRunProviderModel(runtime, run);
  const promptAsset = promptAssetRegistry.getByKind(input.promptAssetKind);
  const schemaDescriptor: SchemaDescriptor = {
    name: input.promptAssetKind,
    version: run.schemaBundleVersion,
    hash: run.schemaBundleHash,
  };
  const samplingProfile = createDeterministicSamplingProfile(input.stageKind);

  try {
    return await generateStructuredAnalysisStep({
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      snapshotId: run.sourceSnapshotId ?? "",
      runId: run.id,
      batchId: input.batchId,
      idempotencyKey: input.idempotencyKey,
      stageKind: input.stageKind,
      providerPolicy: approvedPolicy,
      resolvedModel,
      promptAsset,
      schema: input.schema,
      schemaDescriptor,
      evidenceBlocks: input.evidenceBlocks,
      budget: buildGenerationBudget(run),
      ...(samplingProfile.seedApplied && samplingProfile.seed !== undefined
        ? { seed: samplingProfile.seed }
        : {}),
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      ...(runtime.executor ? { executor: runtime.executor } : {}),
    });
  } catch (error) {
    throw toWorkerError(error as Parameters<typeof toWorkerError>[0]);
  }
}

/** Terminal DB/run states a dependency stage can be in that permit a dependent stage to start. */
export const readyDependencyStatuses = new Set(["completed", "completed_with_warnings", "skipped"]);
/** Terminal states that must propagate as failure/cancellation to every downstream stage. */
export const failedDependencyStatuses = new Set(["failed"]);
export const canceledDependencyStatuses = new Set(["canceled"]);
