import type { Auth, ResolvedAuthSession } from "@atlashq/auth";
import { getSessionFromNodeHeaders } from "@atlashq/auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getResolvedSession, normalizeSession, resolveRequestSession } from "./session-context.js";

vi.mock("@atlashq/auth", async () => {
  const actual = await vi.importActual<typeof import("@atlashq/auth")>("@atlashq/auth");

  return {
    ...actual,
    getSessionFromNodeHeaders: vi.fn(),
  };
});

const getSessionFromNodeHeadersMock = vi.mocked(getSessionFromNodeHeaders);

function resolved(overrides: {
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
}): ResolvedAuthSession {
  return {
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "Ada",
      organizationId: "org-1",
      organizationRole: "member",
      status: "active",
      ...overrides.user,
    },
    session: {
      id: "session-1",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
      ...overrides.session,
    },
  } as unknown as ResolvedAuthSession;
}

afterEach(() => {
  getSessionFromNodeHeadersMock.mockReset();
});

describe("normalizeSession", () => {
  it("returns null when there is no session", () => {
    expect(normalizeSession(null)).toBeNull();
  });

  it("projects the user and session into the request context", () => {
    const context = normalizeSession(resolved({}));
    expect(context).toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "Ada",
        organizationId: "org-1",
        organizationRole: "member",
        status: "active",
      },
      session: {
        id: "session-1",
        expiresAt: new Date("2999-01-01T00:00:00.000Z"),
      },
    });
  });

  it("defaults a missing organization role to member", () => {
    const context = normalizeSession(resolved({ user: { organizationRole: undefined } }));
    expect(context?.user.organizationRole).toBe("member");
  });

  it("never presents a missing status as active", () => {
    const context = normalizeSession(resolved({ user: { status: undefined } }));
    expect(context?.user.status).toBe("");
  });

  it("coerces a string session expiry into a Date", () => {
    const context = normalizeSession(
      resolved({ session: { expiresAt: "2999-06-01T12:00:00.000Z" } }),
    );
    expect(context?.session.expiresAt).toBeInstanceOf(Date);
    expect(context?.session.expiresAt.toISOString()).toBe("2999-06-01T12:00:00.000Z");
  });

  it("resolves and caches the session context once per request", async () => {
    const request = { headers: { cookie: "session=abc" } };
    const auth = {} as Auth;
    getSessionFromNodeHeadersMock.mockResolvedValue(resolved({}));

    const first = await resolveRequestSession(auth, request);
    const second = await resolveRequestSession(auth, request);

    expect(first).toEqual(second);
    expect(getResolvedSession(request)).toEqual(first);
    expect(getSessionFromNodeHeadersMock).toHaveBeenCalledTimes(1);
    expect(getSessionFromNodeHeadersMock).toHaveBeenCalledWith(auth, request.headers);
  });
});
