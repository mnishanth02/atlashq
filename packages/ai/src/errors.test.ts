import { describe, expect, it } from "vitest";
import { classifyProviderError } from "./errors.js";

describe("provider error classification", () => {
  it("classifies 429 responses as retryable rate-limit errors", () => {
    const classification = classifyProviderError({ status: 429, message: "rate limit exceeded" });
    expect(classification.code).toBe("AI_RUN_PROVIDER_RATE_LIMITED");
    expect(classification.retryable).toBe(true);
  });

  it("classifies timeout-like failures as retryable timeout errors", () => {
    const classification = classifyProviderError({
      code: "ETIMEDOUT",
      message: "upstream request timed out",
    });
    expect(classification.code).toBe("AI_RUN_PROVIDER_TIMEOUT");
    expect(classification.retryable).toBe(true);
  });

  it("classifies non-transient 4xx provider failures as non-retryable", () => {
    const classification = classifyProviderError({ statusCode: 400, message: "invalid request" });
    expect(classification.code).toBe("AI_RUN_PROVIDER_FAILURE");
    expect(classification.retryable).toBe(false);
    expect(classification.detail).toBe("Provider request failed.");
  });

  it("does not let 4xx message text override non-retryable classification", () => {
    const classification = classifyProviderError({
      statusCode: 400,
      message: "invalid timeout parameter and rate limit setting",
    });
    expect(classification.code).toBe("AI_RUN_PROVIDER_FAILURE");
    expect(classification.retryable).toBe(false);
  });
});
