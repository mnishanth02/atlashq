import { describe, expect, it, vi } from "vitest";
import { applyApiFieldErrors, getApiErrorMessage, matchApiErrorField } from "./apply-field-errors";

type ApiErrorDetail = { path: Array<string | number>; message: string; code: string };

/**
 * Fabricate an Atlas-shaped error without importing the API client (the test
 * runner does not resolve the `@/` alias for value imports). `applyApiFieldErrors`
 * detects it structurally via `name === "AtlasApiError"`.
 */
function apiError(message: string, details?: ApiErrorDetail[]): Error {
  return Object.assign(new Error(message), { name: "AtlasApiError", details });
}

describe("getApiErrorMessage", () => {
  it("prefers the Atlas API error message", () => {
    expect(getApiErrorMessage(apiError("Validation failed"))).toBe("Validation failed");
  });

  it("falls back to a native error message then the default", () => {
    expect(getApiErrorMessage(new Error("boom"))).toBe("boom");
    expect(getApiErrorMessage(new Error(""))).toBe("Something went wrong. Please try again.");
    expect(getApiErrorMessage("nope", "custom")).toBe("custom");
  });
});

describe("matchApiErrorField", () => {
  const known = new Set(["name", "clientId", "tags"]);

  it("returns the most specific matching segment and ignores numeric indices", () => {
    expect(matchApiErrorField(["body", "clientId"], known)).toBe("clientId");
    expect(matchApiErrorField(["tags", 0], known)).toBe("tags");
  });

  it("returns undefined when nothing matches", () => {
    expect(matchApiErrorField(["body", "unknown"], known)).toBeUndefined();
    expect(matchApiErrorField([], known)).toBeUndefined();
  });
});

describe("applyApiFieldErrors", () => {
  const fields = ["name", "clientId", "tags"] as const;

  it("routes field-level details to setError and counts them", () => {
    const setError = vi.fn();
    const applied = applyApiFieldErrors(
      setError,
      apiError("Validation failed", [
        { path: ["body", "clientId"], message: "Required", code: "invalid" },
        { path: ["body", "name"], message: "Too short", code: "invalid" },
      ]),
      fields,
    );
    expect(applied).toBe(2);
    expect(setError).toHaveBeenCalledWith("clientId", { type: "server", message: "Required" });
    expect(setError).toHaveBeenCalledWith("name", { type: "server", message: "Too short" });
  });

  it("ignores unmatched details", () => {
    const setError = vi.fn();
    const applied = applyApiFieldErrors(
      setError,
      apiError("Validation failed", [{ path: ["body", "mystery"], message: "?", code: "invalid" }]),
      fields,
    );
    expect(applied).toBe(0);
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns 0 for non-API errors or missing details", () => {
    const setError = vi.fn();
    expect(applyApiFieldErrors(setError, new Error("boom"), fields)).toBe(0);
    expect(applyApiFieldErrors(setError, apiError("Server error"), fields)).toBe(0);
    expect(setError).not.toHaveBeenCalled();
  });
});
