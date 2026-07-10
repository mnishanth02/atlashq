import { describe, expect, it } from "vitest";
import { evaluateAuthenticatedGuard, evaluateLoginGuard } from "./session-guard";

describe("evaluateAuthenticatedGuard", () => {
  it("allows navigation when a session is present", () => {
    expect(evaluateAuthenticatedGuard(true, "/projects/42")).toEqual({ kind: "allow" });
  });

  it("redirects to /login with the current location when unauthenticated", () => {
    expect(evaluateAuthenticatedGuard(false, "/projects/42?tab=overview")).toEqual({
      kind: "redirect-to-login",
      redirect: "/projects/42?tab=overview",
    });
  });

  it("falls back to /projects instead of forwarding an unsafe current href", () => {
    expect(evaluateAuthenticatedGuard(false, "https://evil.example")).toEqual({
      kind: "redirect-to-login",
      redirect: "/projects",
    });
  });
});

describe("evaluateLoginGuard", () => {
  it("allows rendering the login form when unauthenticated", () => {
    expect(evaluateLoginGuard(false, "/projects/42")).toEqual({ kind: "allow" });
  });

  it("redirects an authenticated visitor to the sanitized redirect target", () => {
    expect(evaluateLoginGuard(true, "/projects/42")).toEqual({
      kind: "redirect-to-target",
      href: "/projects/42",
    });
  });

  it("falls back to /projects when the redirect target is unsafe or missing", () => {
    expect(evaluateLoginGuard(true, undefined)).toEqual({
      kind: "redirect-to-target",
      href: "/projects",
    });
    expect(evaluateLoginGuard(true, "//evil.example")).toEqual({
      kind: "redirect-to-target",
      href: "/projects",
    });
  });
});
