import type { AiCoreError } from "@atlashq/ai";
import { RetryableWorkerError, TerminalWorkerError } from "../errors.js";

/** Stable, content-free fallback used whenever an `AiCoreError` has no `safeDetail` (module-03
 * task item 3): every `AiCoreError.message` thrown by `@atlashq/ai` is already prompt/free-text
 * safe by convention, but persisted `failureDetail`/log fields must never depend on that
 * convention holding -- only `safeDetail` (or this stable fallback) is trusted here. */
const GENERIC_AI_FAILURE_DETAIL = "AI provider request failed.";

const operatorRetryableAiFailureCodes = new Set([
  "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
  "AI_RUN_PROVIDER_TIMEOUT",
  "AI_RUN_PROVIDER_RATE_LIMITED",
  "AI_RUN_PROVIDER_FAILURE",
]);

/**
 * BullMQ retryability describes whether the current job should be attempted again immediately.
 * Run retryability instead controls whether an operator may create a new retry run, so provider
 * failures remain retryable at the run level even when the current job error is terminal.
 */
export function isOperatorRetryableAiFailure(error: {
  retryable?: boolean;
  code?: string;
}): boolean {
  return (
    error.retryable === true ||
    (error.code !== undefined && operatorRetryableAiFailureCodes.has(error.code))
  );
}

/**
 * Maps an `AiCoreError` (thrown by `@atlashq/ai`'s `generateStructuredAnalysisStep` or the
 * deterministic citation verifier) onto the worker's own retryable/terminal error taxonomy so
 * BullMQ retry behavior stays consistent with every other Module 2/3 handler (module-03 §11.2,
 * §16.1). Never surfaces `error.message` directly: that field may originate from provider SDK
 * exception text which could echo prompt/source-chunk content back verbatim, so only
 * `error.safeDetail` (a curated, content-free string) or the generic fallback above is used for
 * the constructed worker error's own message -- the field every downstream catch site persists
 * into `requirement_analysis_run`/`stage`/`batch.failureDetail` and structured logs.
 */
export function toWorkerError(error: AiCoreError): RetryableWorkerError | TerminalWorkerError {
  const safeMessage = error.safeDetail ?? GENERIC_AI_FAILURE_DETAIL;
  if (error.retryable) {
    return new RetryableWorkerError(error.code, safeMessage, { cause: error });
  }

  return new TerminalWorkerError(error.code, safeMessage, { cause: error });
}

/** Job/DB state that is missing, out of scope, or violates a Module 3 DAG invariant. */
export class RequirementAnalysisInvalidStateError extends TerminalWorkerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("REQUIREMENT_ANALYSIS_INVALID_STATE", message, options);
    this.name = "RequirementAnalysisInvalidStateError";
  }
}

/** No eligible sources exist to freeze into a snapshot (module-03 §11.2, `freeze_snapshot`). */
export class NoEligibleSourcesError extends TerminalWorkerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("AI_RUN_NO_ELIGIBLE_SOURCES", message, options);
    this.name = "NoEligibleSourcesError";
  }
}

/** Run-level budget (USD/input tokens/output tokens/wall clock) was exhausted mid-run. */
export class RunBudgetExceededError extends TerminalWorkerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("AI_RUN_BUDGET_EXCEEDED", message, options);
    this.name = "RunBudgetExceededError";
  }
}

/** A run's cancellation was honored; the current job must stop without further side effects. */
export class RunCanceledError extends TerminalWorkerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("AI_RUN_CANCELED", message, options);
    this.name = "RunCanceledError";
  }
}
