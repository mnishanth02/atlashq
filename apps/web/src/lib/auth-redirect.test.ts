import { describe, expect, it } from "vitest";
import {
  DEFAULT_REDIRECT_TARGET,
  isSafeRedirectTarget,
  sanitizeRedirectTarget,
} from "./auth-redirect";

describe("isSafeRedirectTarget", () => {
  it("accepts root-relative paths", () => {
    expect(isSafeRedirectTarget("/projects")).toBe(true);
    expect(isSafeRedirectTarget("/projects/123?tab=overview")).toBe(true);
    expect(isSafeRedirectTarget("/")).toBe(true);
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(isSafeRedirectTarget("//evil.example")).toBe(false);
    expect(isSafeRedirectTarget("/\\evil.example")).toBe(false);
  });

  it("rejects absolute URLs with a scheme", () => {
    expect(isSafeRedirectTarget("https://evil.example")).toBe(false);
    expect(isSafeRedirectTarget("javascript:alert(1)")).toBe(false);
    expect(isSafeRedirectTarget("/redirect?to=https://evil.example")).toBe(false);
  });

  it("rejects non-string, empty, or path-less values", () => {
    expect(isSafeRedirectTarget(undefined)).toBe(false);
    expect(isSafeRedirectTarget(null)).toBe(false);
    expect(isSafeRedirectTarget(42)).toBe(false);
    expect(isSafeRedirectTarget("")).toBe(false);
    expect(isSafeRedirectTarget("projects")).toBe(false);
  });
});

describe("sanitizeRedirectTarget", () => {
  it("passes through safe candidates", () => {
    expect(sanitizeRedirectTarget("/projects/42")).toBe("/projects/42");
  });

  it("falls back to the default target for unsafe or missing candidates", () => {
    expect(sanitizeRedirectTarget(undefined)).toBe(DEFAULT_REDIRECT_TARGET);
    expect(sanitizeRedirectTarget("//evil.example")).toBe(DEFAULT_REDIRECT_TARGET);
  });

  it("honors a custom fallback", () => {
    expect(sanitizeRedirectTarget("//evil.example", "/login")).toBe("/login");
  });
});
