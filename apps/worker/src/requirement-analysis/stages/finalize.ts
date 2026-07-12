import { analysisRunTerminalStatusValues } from "@atlashq/db";
import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import type { JsonObject } from "@atlashq/types";
import { coverageCategoryDescriptors } from "@atlashq/types";
import { RequirementAnalysisInvalidStateError } from "../errors.js";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import type { AnalysisScope } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import { loadRunInScope } from "./common.js";

export type FinalizeRunJobPayload = Extract<
  RequirementAnalysisJobPayload,
  { kind: "finalize-run" }
>;

const terminalRunStatuses = new Set<string>(analysisRunTerminalStatusValues);

/** module-03 §11.2 `finalize_review_package` (`usesModel: false`, depends on every branch):
 * atomically finalizes the run only once every DB guard passes (task item 8), never deleting or
 * mutating any partial artifact -- a failed guard fails the run/stage instead. */
export async function handleFinalizeRun(
  runtime: AnalysisRuntime,
  _aiAnalysisQueue: AiAnalysisQueue,
  payload: FinalizeRunJobPayload,
): Promise<void> {
  const scope: AnalysisScope = {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    runId: payload.runId,
  };
  const run = await loadRunInScope(runtime, scope);

  if (terminalRunStatuses.has(run.status)) {
    // Idempotent replay: a prior attempt already finalized (or failed/canceled) this run.
    return;
  }

  const stages = await runtime.repository.listStagesByRun(run.id);
  const finalizeStage = stages.find((stage) => stage.kind === "finalize_review_package");
  if (!finalizeStage) {
    throw new RequirementAnalysisInvalidStateError(
      `Run "${run.id}" has no finalize_review_package stage row.`,
    );
  }

  const upstreamStages = stages.filter((stage) => stage.id !== finalizeStage.id);
  const failedStage = upstreamStages.find((stage) => stage.status === "failed");
  if (failedStage) {
    await failRun(
      runtime,
      run.id,
      finalizeStage.id,
      "REQUIREMENT_ANALYSIS_DEPENDENCY_FAILED",
      `Upstream stage "${failedStage.kind}" failed; run cannot be finalized.`,
    );
    return;
  }
  const canceledStage = upstreamStages.find((stage) => stage.status === "canceled");
  if (canceledStage) {
    await runtime.repository.transitionRun(run.id, {
      status: "canceled",
      completedAt: runtime.now(),
    });
    await runtime.repository.updateStage(finalizeStage.id, {
      status: "canceled",
      completedAt: runtime.now(),
    });
    return;
  }
  const notReady = upstreamStages.find(
    (stage) =>
      stage.status !== "completed" &&
      stage.status !== "completed_with_warnings" &&
      stage.status !== "skipped",
  );
  if (notReady) {
    throw new RequirementAnalysisInvalidStateError(
      `Stage "${notReady.kind}" is not terminal (status "${notReady.status}"); finalize_review_package cannot proceed yet.`,
    );
  }

  // DB guard: exactly the fixed 18 coverage rows must exist (task item 8).
  const coverageEntries = await runtime.repository.listCoverageEntriesByRun(run.id);
  if (coverageEntries.length !== coverageCategoryDescriptors.length) {
    await failRun(
      runtime,
      run.id,
      finalizeStage.id,
      "REQUIREMENT_ANALYSIS_COVERAGE_INCOMPLETE",
      `Expected ${coverageCategoryDescriptors.length} coverage_matrix_entry rows, found ${coverageEntries.length}.`,
    );
    return;
  }

  // DB guard: every persisted requirement must carry at least one verified citation, or have
  // been downgraded to "unknown" -- never a "confirmed" row with zero citations (task item 8).
  const requirements = await runtime.repository.listRequirementsByRun(run.id);
  const uncitedConfirmed: string[] = [];
  for (const requirement of requirements) {
    if (requirement.epistemicStatus !== "confirmed") {
      continue;
    }
    const citations = await runtime.repository.listCitationsByRequirement(requirement.id);
    if (citations.length === 0) {
      uncitedConfirmed.push(requirement.id);
    }
  }
  if (uncitedConfirmed.length > 0) {
    await failRun(
      runtime,
      run.id,
      finalizeStage.id,
      "REQUIREMENT_ANALYSIS_UNVERIFIED_CONFIRMED_REQUIREMENT",
      `${uncitedConfirmed.length} requirement(s) are "confirmed" with zero verified citations.`,
    );
    return;
  }

  const deliveryItems = await runtime.repository.listDeliveryItemsByRun(run.id);
  const artifactCounts: JsonObject = {
    requirementCount: requirements.length,
    coverageEntryCount: coverageEntries.length,
    deliveryItemCount: deliveryItems.length,
    questionCount: deliveryItems.filter((item) => item.itemType === "question").length,
    riskCount: deliveryItems.filter((item) => item.itemType === "risk").length,
    assumptionCount: deliveryItems.filter((item) => item.itemType === "assumption").length,
    dependencyCount: deliveryItems.filter((item) => item.itemType === "dependency").length,
    blockerCount: deliveryItems.filter((item) => item.itemType === "blocker").length,
    scopeChangeCandidateCount: deliveryItems.filter(
      (item) => item.itemType === "scope_change_candidate",
    ).length,
    conflictingRequirementCount: requirements.filter(
      (requirement) => requirement.epistemicStatus === "conflicting",
    ).length,
  };

  const hasWarning = upstreamStages.some((stage) => stage.status === "completed_with_warnings");
  const finalStatus = hasWarning ? "completed_with_warnings" : "completed";

  await runtime.repository.transitionRun(run.id, {
    status: finalStatus,
    completedAt: runtime.now(),
    artifactCounts,
  });
  await runtime.repository.updateStage(finalizeStage.id, {
    status: "completed",
    startedAt: finalizeStage.startedAt ?? runtime.now(),
    completedAt: runtime.now(),
  });

  await runtime.repository.recordAuditEvent({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    actorId: run.requestedBy,
    action: "requirement_analysis.run_finalized",
    entityType: "requirement_analysis_run",
    entityId: run.id,
    correlationId: payload.correlationId,
    after: artifactCounts,
  });
}

async function failRun(
  runtime: AnalysisRuntime,
  runId: string,
  finalizeStageId: string,
  failureCode: string,
  failureDetail: string,
): Promise<void> {
  await runtime.repository.transitionRun(runId, {
    status: "failed",
    completedAt: runtime.now(),
    failureCode,
    failureDetail,
    failureRetryable: false,
    failedStageId: finalizeStageId,
  });
  await runtime.repository.updateStage(finalizeStageId, {
    status: "failed",
    completedAt: runtime.now(),
    failureCode,
    failureDetail,
  });
}
