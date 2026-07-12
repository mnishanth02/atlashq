import { analysisRunTerminalStatusValues } from "@atlashq/db";
import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import type { AnalysisScope } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import { loadRunInScope } from "./common.js";

export type CancelRunJobPayload = Extract<RequirementAnalysisJobPayload, { kind: "cancel-run" }>;

const terminalRunStatuses = new Set<string>(analysisRunTerminalStatusValues);
const terminalStageStatuses = new Set([
  "completed",
  "completed_with_warnings",
  "failed",
  "canceled",
  "skipped",
]);

/**
 * Honors a requested cancellation (module-03 §11.6): transitions the run and every non-terminal
 * stage to `canceled` without ever deleting or mutating an already-persisted requirement,
 * citation, coverage row, or delivery item (task item 8: "preserve partial artifacts on cancel").
 * Idempotent: a run already in a terminal status is left untouched.
 */
export async function handleCancelRun(
  runtime: AnalysisRuntime,
  _aiAnalysisQueue: AiAnalysisQueue,
  payload: CancelRunJobPayload,
): Promise<void> {
  const scope: AnalysisScope = {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    runId: payload.runId,
  };
  const run = await loadRunInScope(runtime, scope);

  if (terminalRunStatuses.has(run.status)) {
    return;
  }

  const now = runtime.now();
  await runtime.repository.transitionRun(run.id, { status: "canceled", completedAt: now });

  const stages = await runtime.repository.listStagesByRun(run.id);
  for (const stage of stages) {
    if (terminalStageStatuses.has(stage.status)) {
      continue;
    }
    await runtime.repository.updateStage(stage.id, { status: "canceled", completedAt: now });
  }

  await runtime.repository.recordAuditEvent({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    actorId: payload.actorId,
    action: "requirement_analysis.run_canceled",
    entityType: "requirement_analysis_run",
    entityId: run.id,
    correlationId: payload.correlationId,
  });
}
