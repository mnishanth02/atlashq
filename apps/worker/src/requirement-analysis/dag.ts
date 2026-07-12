import { module03PipelineDescriptor } from "@atlashq/ai";
import { createRequirementAnalysisIdempotencyKey } from "@atlashq/jobs";
import type { AnalysisStageKind } from "@atlashq/types";
import { type AiAnalysisQueue, enqueueAiAnalysisJob } from "./queue-helpers.js";
import type { AnalysisScope } from "./repository/types.js";
import type { AnalysisRuntime } from "./runtime.js";
import { readyDependencyStatuses } from "./stages/common.js";

export type { AiAnalysisQueue };

const dependsOnByKind = new Map(
  module03PipelineDescriptor.stages.map((stage) => [stage.kind, stage.dependsOn] as const),
);

/**
 * Re-evaluates every not-yet-started stage of a run against `module03PipelineDescriptor`'s DAG
 * edges and enqueues the next `run-stage`/`finalize-run` job for any stage whose dependencies are
 * all terminal (module-03 §11.1 DAG, task item 4: "required branches fan in"). Idempotent: safe to
 * call after every batch/stage completion since it only acts on stages still `pending`.
 *
 * Failure/cancellation is propagated downstream rather than silently stalling the run: if any
 * dependency stage failed or was canceled, the dependent stage is marked the same way (without
 * ever deleting already-persisted partial artifacts, per task item 8) instead of being enqueued.
 */
export async function advanceDag(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  scope: AnalysisScope,
): Promise<void> {
  const stages = await runtime.repository.listStagesByRun(scope.runId);
  const stageByKind = new Map(stages.map((stage) => [stage.kind as AnalysisStageKind, stage]));

  for (const stage of stages) {
    if (stage.status !== "pending") {
      continue;
    }

    const dependsOn = dependsOnByKind.get(stage.kind as AnalysisStageKind) ?? [];
    const dependencyStages = dependsOn
      .map((kind) => stageByKind.get(kind))
      .filter((row): row is NonNullable<typeof row> => row !== undefined);

    if (dependencyStages.length !== dependsOn.length) {
      continue; // Dependency stage rows not created yet; nothing to do this pass.
    }

    const failedDependency = dependencyStages.find((row) => row.status === "failed");
    const canceledDependency = dependencyStages.find((row) => row.status === "canceled");

    if (failedDependency) {
      await runtime.repository.updateStage(stage.id, {
        status: "failed",
        completedAt: runtime.now(),
        failureCode: "REQUIREMENT_ANALYSIS_DEPENDENCY_FAILED",
        failureDetail: `Upstream stage "${failedDependency.kind}" failed.`,
      });
      continue;
    }

    if (canceledDependency) {
      await runtime.repository.updateStage(stage.id, {
        status: "canceled",
        completedAt: runtime.now(),
      });
      continue;
    }

    const allReady = dependencyStages.every((row) => readyDependencyStatuses.has(row.status));
    if (!allReady) {
      continue;
    }

    await runtime.repository.updateStage(stage.id, { status: "running", startedAt: runtime.now() });

    if (stage.kind === "confirmed_extraction" || stage.kind === "reference_feature_extraction") {
      // These two stages' actual work was already dispatched as `run-batch` jobs directly by
      // `batch_planning` (module-03 §11.2); there is no separate `run-stage` job to enqueue here.
      // `extraction-batch.ts#maybeCompleteExtractionStage` drives this stage row to its terminal
      // status once every one of its batches finishes.
      continue;
    }

    const submittedAt = runtime.now().toISOString();

    if (stage.kind === "finalize_review_package") {
      await enqueueAiAnalysisJob(aiAnalysisQueue, {
        kind: "finalize-run",
        idempotencyKey: createRequirementAnalysisIdempotencyKey({
          kind: "finalize-run",
          runId: scope.runId,
        }),
        correlationId: scope.runId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        runId: scope.runId,
        submittedAt,
      });
      continue;
    }

    await enqueueAiAnalysisJob(aiAnalysisQueue, {
      kind: "run-stage",
      idempotencyKey: createRequirementAnalysisIdempotencyKey({
        kind: "run-stage",
        runId: scope.runId,
        stageId: stage.id,
      }),
      correlationId: scope.runId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      runId: scope.runId,
      stageId: stage.id,
      stageKind: stage.kind as AnalysisStageKind,
      submittedAt,
    });
  }
}
