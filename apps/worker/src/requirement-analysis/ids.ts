import type { AnalysisStageKind } from "@atlashq/types";

/** Deterministic, replay-stable idempotency key for one `requirement_analysis_stage` row. Distinct
 * from `@atlashq/jobs`'s `createRequirementAnalysisIdempotencyKey` (which keys BullMQ jobs by job
 * *kind*, e.g. `"run-stage"`), since stage rows are keyed by DAG stage *kind*, e.g. `"batch_planning"`. */
export function buildStageIdempotencyKey(input: {
  runId: string;
  kind: AnalysisStageKind;
  attemptNumber?: number;
}): string {
  return `analysis-stage:${input.runId}:${input.kind}:${input.attemptNumber ?? 1}`;
}
