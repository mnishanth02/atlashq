import type {
  AiRequirementAnalysisBudgetEnv,
  AiRequirementAnalysisDataHandlingEnv,
  AiRequirementAnalysisFeatureFlagEnv,
  AiRequirementAnalysisProviderEnv,
} from "@atlashq/config";
import type {
  CancelRunJobPayload,
  FreezeSnapshotJobPayload,
  RequirementAnalysisQueue,
} from "../runtime/requirement-analysis-runtime.js";

type AnalysisEnqueuedJob =
  | { kind: "freeze-snapshot"; payload: FreezeSnapshotJobPayload }
  | { kind: "cancel-run"; payload: CancelRunJobPayload };

export class InMemoryAnalysisQueueDouble implements RequirementAnalysisQueue {
  readonly jobs: AnalysisEnqueuedJob[] = [];
  private readonly idempotencyKeys = new Set<string>();
  available = true;
  availabilityDetail = "in-memory";
  freezeSnapshotFailure: Error | null = null;
  cancelRunFailure: Error | null = null;

  reset(): void {
    this.jobs.length = 0;
    this.idempotencyKeys.clear();
    this.available = true;
    this.availabilityDetail = "in-memory";
    this.freezeSnapshotFailure = null;
    this.cancelRunFailure = null;
  }

  async checkAvailability() {
    return {
      ok: this.available,
      detail: this.availabilityDetail,
    };
  }

  async addFreezeSnapshot(payload: FreezeSnapshotJobPayload) {
    if (this.freezeSnapshotFailure) {
      throw this.freezeSnapshotFailure;
    }
    if (this.idempotencyKeys.has(payload.idempotencyKey)) {
      return;
    }
    this.idempotencyKeys.add(payload.idempotencyKey);
    this.jobs.push({ kind: "freeze-snapshot", payload });
  }

  async addCancelRun(payload: CancelRunJobPayload) {
    if (this.cancelRunFailure) {
      throw this.cancelRunFailure;
    }
    if (this.idempotencyKeys.has(payload.idempotencyKey)) {
      return;
    }
    this.idempotencyKeys.add(payload.idempotencyKey);
    this.jobs.push({ kind: "cancel-run", payload });
  }

  async close() {}
}

export const TEST_AI_REQUIREMENT_ANALYSIS_ENV: AiRequirementAnalysisFeatureFlagEnv &
  AiRequirementAnalysisBudgetEnv &
  AiRequirementAnalysisProviderEnv &
  AiRequirementAnalysisDataHandlingEnv = {
  AI_REQUIREMENT_ANALYSIS_ENABLED: true,
  AI_MODEL_CALLS_ENABLED: true,
  AI_REFERENCE_FEATURE_EXTRACTION_ENABLED: false,
  AI_EVAL_GATE_REQUIRED: true,
  AI_ANALYSIS_READS_ENABLED: true,
  AI_ANALYSIS_MAX_USD_PER_RUN: 3,
  AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN: 300_000,
  AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN: 30_000,
  AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS: 1_800,
  AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT: 1,
  AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION: 3,
  AI_ANALYSIS_DEFAULT_PROVIDER: "openai",
  AI_ANALYSIS_DEFAULT_MODEL_ALIAS: "gpt-4o-mini",
  AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID: "gpt-4o-mini",
  AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE: "provider_default",
  AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY: "explicit_policy_only",
  AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK: true,
  AI_ANALYSIS_LOG_PROMPTS: false,
  AI_ANALYSIS_LOG_SOURCE_CHUNKS: false,
  AI_ANALYSIS_LOG_MODEL_OUTPUTS: false,
  AI_ANALYSIS_REDACT_SIGNED_URLS: true,
  AI_ANALYSIS_SAFE_DISABLED_BEHAVIOR: "reject_new_runs_preserve_reads",
};
