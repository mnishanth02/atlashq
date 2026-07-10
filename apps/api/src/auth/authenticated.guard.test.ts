import type { Auth } from "@atlashq/auth";
import { type ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuthenticatedGuard, assertAuthenticatedSession } from "./authenticated.guard.js";
import type { RequestSessionContext } from "./session-context.js";

function sessionContext(
  overrides: Partial<RequestSessionContext["user"]> & { expiresAt?: Date } = {},
): RequestSessionContext {
  const { expiresAt, ...user } = overrides;
  return {
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "Ada",
      organizationId: "org-1",
      organizationRole: "member",
      status: "active",
      ...user,
    },
    session: {
      id: "session-1",
      expiresAt: expiresAt ?? new Date(Date.now() + 60_000),
    },
  };
}

function httpContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function authReturning(result: unknown): Auth {
  return { api: { getSession: async () => result } } as unknown as Auth;
}

describe("assertAuthenticatedSession", () => {
  it("rejects an absent session", () => {
    expect(() => assertAuthenticatedSession(null)).toThrow(UnauthorizedException);
  });

  it("rejects an expired session", () => {
    const session = sessionContext({ expiresAt: new Date(Date.now() - 1000) });
    expect(() => assertAuthenticatedSession(session)).toThrow(UnauthorizedException);
  });

  it("rejects a suspended user", () => {
    expect(() => assertAuthenticatedSession(sessionContext({ status: "suspended" }))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects an archived user", () => {
    expect(() => assertAuthenticatedSession(sessionContext({ status: "archived" }))).toThrow(
      ForbiddenException,
    );
  });

  it("accepts an active, unexpired session", () => {
    expect(() => assertAuthenticatedSession(sessionContext())).not.toThrow();
  });
});

describe("AuthenticatedGuard", () => {
  it("allows a request with a valid active session", async () => {
    const guard = new AuthenticatedGuard(
      authReturning({
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "Ada",
          organizationId: "org-1",
          organizationRole: "member",
          status: "active",
        },
        session: { id: "session-1", expiresAt: new Date(Date.now() + 60_000) },
      }),
    );

    await expect(guard.canActivate(httpContext({ headers: {} }))).resolves.toBe(true);
  });

  it("rejects a request without a session", async () => {
    const guard = new AuthenticatedGuard(authReturning(null));
    await expect(guard.canActivate(httpContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects when no auth instance is configured", async () => {
    const guard = new AuthenticatedGuard(null);
    await expect(guard.canActivate(httpContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
