import type { GenerationBudget, ProviderRegistry, StructuredGenerateExecutor } from "@atlashq/ai";
import type { RequirementAnalysisRun } from "@atlashq/db";
import type { RequirementAnalysisRepository } from "./repository/types.js";

/**
 * Everything a Module 3 stage handler needs beyond the raw job payload. Deliberately narrower
 * than `WorkerRuntimeContext` (no storage/ClamAV/capture) so orchestrator and stage-level unit
 * tests can run against an in-memory fake repository and a fake provider registry without any
 * infrastructure dependency (module-03 worker task item 1 & 9: fake DB/provider/queue injection).
 */
export type AnalysisRuntime = {
  repository: RequirementAnalysisRepository;
  providerRegistry: ProviderRegistry;
  /** Test-only injection point; when omitted the AI wrapper uses the real `ai` SDK executor. */
  executor?: StructuredGenerateExecutor;
  /** Feature flags read once at boot (module-03 §7: never read `process.env` inside a handler). */
  featureFlags: {
    referenceFeatureExtractionEnabled: boolean;
  };
  now(): Date;
};

/**
 * Builds the per-call `GenerationBudget` the `@atlashq/ai` wrapper enforces (module-03 §7.2),
 * derived from the run's frozen budget ceilings and its live usage counters so every model call
 * always sees the latest org/project-wide consumption before spending more budget.
 */
export function buildGenerationBudget(
  run: RequirementAnalysisRun,
  overrides: { maxOutputTokensPerCall?: number } = {},
): GenerationBudget {
  return {
    maxUsdPerRun: run.maxUsd,
    maxInputTokensPerRun: run.maxInputTokens,
    maxOutputTokensPerRun: run.maxOutputTokens,
    maxWallClockMs: run.maxWallClockSeconds * 1_000,
    inputTokensUsed: run.inputTokensUsed,
    outputTokensUsed: run.outputTokensUsed,
    costUsdUsed: run.costUsd,
    ...(overrides.maxOutputTokensPerCall !== undefined
      ? { maxOutputTokensPerCall: overrides.maxOutputTokensPerCall }
      : {}),
  };
}

/** Wall-clock deadline check (module-03 §7.2 budgets: `max_wall_clock_seconds`). */
export function isRunPastWallClockDeadline(run: RequirementAnalysisRun, now: Date): boolean {
  if (!run.startedAt) {
    return false;
  }
  const elapsedMs = now.getTime() - run.startedAt.getTime();
  return elapsedMs > run.maxWallClockSeconds * 1_000;
}
