import { AiCoreError } from "@atlashq/ai";
import { describe, expect, it } from "vitest";
import { RetryableWorkerError, TerminalWorkerError } from "../errors.js";
import { toWorkerError } from "./errors.js";

const RAW_SENSITIVE_TEXT =
  "the system shall reject login attempts from IP 10.0.0.5 after 3 failures (source excerpt verbatim)";

describe("toWorkerError", () => {
  it("uses safeDetail (never the raw AiCoreError.message) as the worker error's message when safeDetail is set", () => {
    const aiError = new AiCoreError("AI_RUN_PROVIDER_RATE_LIMITED", RAW_SENSITIVE_TEXT, {
      retryable: true,
      safeDetail: "Provider rate limit reached.",
    });

    const workerError = toWorkerError(aiError);

    expect(workerError).toBeInstanceOf(RetryableWorkerError);
    expect(workerError.message).toBe("Provider rate limit reached.");
    expect(workerError.message).not.toContain(RAW_SENSITIVE_TEXT);
    expect(workerError.code).toBe("AI_RUN_PROVIDER_RATE_LIMITED");
  });

  it("falls back to a stable generic detail (never the raw AiCoreError.message) when safeDetail is unset", () => {
    // Simulates a defensive edge case: some future/adapter code path throws an `AiCoreError`
    // directly without populating `safeDetail`, embedding raw provider/source text in `.message`.
    const aiError = new AiCoreError("AI_RUN_PROVIDER_FAILURE", RAW_SENSITIVE_TEXT, {
      retryable: false,
    });

    const workerError = toWorkerError(aiError);

    expect(workerError).toBeInstanceOf(TerminalWorkerError);
    expect(workerError.message).toBe("AI provider request failed.");
    expect(workerError.message).not.toContain(RAW_SENSITIVE_TEXT);
    expect(workerError.code).toBe("AI_RUN_PROVIDER_FAILURE");
  });

  it("still preserves the original AiCoreError as `.cause` for internal debugging (not persisted/logged directly)", () => {
    const aiError = new AiCoreError("AI_RUN_PROVIDER_FAILURE", RAW_SENSITIVE_TEXT, {
      retryable: false,
    });

    const workerError = toWorkerError(aiError);

    expect(workerError.cause).toBe(aiError);
  });
});
