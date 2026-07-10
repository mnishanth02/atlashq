import { describe, expect, it } from "vitest";
import type { RequestSessionContext } from "../auth/session-context.js";
import {
  resolveAuditActor,
  resolveAuditCorrelationId,
  resolveAuditRequestContext,
} from "./audit-request-context.js";

function session(overrides: Partial<RequestSessionContext["user"]> = {}): RequestSessionContext {
  return {
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "Ada",
      organizationId: "org-1",
      organizationRole: "member",
      status: "active",
      ...overrides,
    },
    session: { id: "session-1", expiresAt: new Date("2999-01-01T00:00:00.000Z") },
  };
}

describe("resolveAuditActor", () => {
  it("derives the actor and organization from the resolved authenticated session", () => {
    expect(resolveAuditActor(session())).toEqual({ organizationId: "org-1", actorId: "user-1" });
  });

  it("reflects a different organization/user pair", () => {
    expect(resolveAuditActor(session({ id: "user-2", organizationId: "org-2" }))).toEqual({
      organizationId: "org-2",
      actorId: "user-2",
    });
  });
});

describe("resolveAuditCorrelationId", () => {
  it("prefers the pino-http request id", () => {
    const correlationId = resolveAuditCorrelationId({ id: "req-1", headers: {} });
    expect(correlationId).toBe("req-1");
  });

  it("falls back to the x-correlation-id header when request.id is absent", () => {
    const correlationId = resolveAuditCorrelationId({
      headers: { "x-correlation-id": "trace-abc-123" },
    });
    expect(correlationId).toBe("trace-abc-123");
  });

  it("preserves an arbitrary non-UUID external correlation id rather than rejecting it", () => {
    const correlationId = resolveAuditCorrelationId({
      headers: { "x-correlation-id": "customer-portal-request-42" },
    });
    expect(correlationId).toBe("customer-portal-request-42");
  });

  it("reads the first non-empty value when the header is duplicated", () => {
    const correlationId = resolveAuditCorrelationId({
      headers: { "x-correlation-id": ["", "trace-1", "trace-2"] },
    });
    expect(correlationId).toBe("trace-1");
  });

  it("falls back to a generated id when request.id and the header are both absent", () => {
    const correlationId = resolveAuditCorrelationId({ headers: {} });
    expect(correlationId.length).toBeGreaterThan(0);
    // Explicit generated fallback, distinct across calls.
    const other = resolveAuditCorrelationId({ headers: {} });
    expect(correlationId).not.toBe(other);
  });

  it("ignores a blank request.id and an empty header before generating a fallback", () => {
    const correlationId = resolveAuditCorrelationId({
      id: "   ",
      headers: { "x-correlation-id": "   " },
    });
    expect(correlationId.trim().length).toBeGreaterThan(0);
  });

  it("ignores a non-string request.id", () => {
    const correlationId = resolveAuditCorrelationId({
      id: 12345,
      headers: { "x-correlation-id": "trace-9" },
    });
    expect(correlationId).toBe("trace-9");
  });
});

describe("resolveAuditRequestContext", () => {
  it("combines the actor and correlation id in one call", () => {
    const context = resolveAuditRequestContext(session(), {
      id: "req-9",
      headers: {},
    });

    expect(context).toEqual({
      actor: { organizationId: "org-1", actorId: "user-1" },
      correlationId: "req-9",
    });
  });
});
