import { sha256Hex } from "@atlashq/ai";
import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { advanceDag } from "../dag.js";
import { RequirementAnalysisInvalidStateError } from "../errors.js";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import type { AnalysisScope } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import { assertNotCanceled, loadRunInScope } from "./common.js";

export type RunStageJobPayload = Extract<RequirementAnalysisJobPayload, { kind: "run-stage" }>;

function normalizeTitleForDedupe(title: string): string {
  return title.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

/**
 * module-03 §11.2 `normalization_deduplication` (deterministic: `usesModel: false`). Assigns a
 * stable `dedupeGroupKey` -- `sha256(requirementType + normalized title)` -- to every requirement
 * persisted by `citation_verification` so identical requirements independently extracted from
 * different batches/sources can be grouped by any downstream consumer without the worker having to
 * pick a single "canonical" row and discard the rest (each persisted requirement, including exact
 * duplicates, remains a first-class traceable artifact per task item 8).
 */
export async function handleNormalizationDeduplicationStage(
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

  const stage = await runtime.repository.getStage(payload.stageId);
  if (!stage || stage.kind !== "normalization_deduplication") {
    throw new RequirementAnalysisInvalidStateError(
      `Stage "${payload.stageId}" is not a normalization_deduplication stage.`,
    );
  }
  if (stage.status !== "running" && stage.status !== "pending") {
    await advanceDag(runtime, aiAnalysisQueue, scope);
    return;
  }

  const requirements = await runtime.repository.listRequirementsByRun(run.id);
  const groupSizes = new Map<string, number>();

  for (const requirement of requirements) {
    const dedupeGroupKey = sha256Hex(
      `${requirement.requirementType}:${normalizeTitleForDedupe(requirement.title)}`,
    );
    groupSizes.set(dedupeGroupKey, (groupSizes.get(dedupeGroupKey) ?? 0) + 1);

    if (requirement.dedupeGroupKey === dedupeGroupKey) {
      continue; // Idempotent replay: already assigned on a prior attempt.
    }

    await runtime.repository.updateRequirementClassification(requirement.id, {
      epistemicStatus: requirement.epistemicStatus,
      confidenceBand: requirement.confidenceBand,
      confidenceReasonCodes: requirement.confidenceReasonCodes,
      dedupeGroupKey,
    });
  }

  const hasDuplicates = [...groupSizes.values()].some((size) => size > 1);

  await runtime.repository.updateStage(stage.id, {
    status: hasDuplicates ? "completed_with_warnings" : "completed",
    completedAt: runtime.now(),
  });

  await advanceDag(runtime, aiAnalysisQueue, scope);
}
