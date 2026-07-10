import { describe, expect, it } from "vitest";
import { auditEventListFilterSchema, auditEventResponseSchema } from "./audit.js";

const validEvent = {
  id: "77777777-7777-4777-8777-777777777777",
  organizationId: "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90",
  actorId: "11111111-1111-4111-8111-111111111111",
  action: "project.create",
  entityType: "project",
  entityId: "project_1",
  before: null,
  after: { name: "Atlas" },
  correlationId: "corr_1",
  at: "2024-01-01T00:00:00Z",
};

describe("auditEventResponseSchema", () => {
  it("accepts the canonical shape with optional projectId and nullable snapshots", () => {
    expect(auditEventResponseSchema.parse(validEvent)).toEqual(validEvent);
  });

  it("accepts nested JSON-safe snapshots", () => {
    const nested = {
      ...validEvent,
      before: { status: "draft", tags: ["a", "b"] },
      after: { status: "active", tags: ["a", "b"], meta: { approvedBy: "user_2" } },
    };

    expect(auditEventResponseSchema.parse(nested)).toEqual(nested);
  });

  it("rejects the superseded occurredAt-style payload", () => {
    const { at, ...rest } = validEvent;
    const legacyShape = { ...rest, occurredAt: at };

    expect(() => auditEventResponseSchema.parse(legacyShape)).toThrow();
  });

  it("rejects unknown fields (strict schema)", () => {
    expect(() =>
      auditEventResponseSchema.parse({ ...validEvent, resourceType: "project" }),
    ).toThrow();
  });

  it("rejects non-UUID persisted ids while preserving polymorphic text ids", () => {
    expect(() => auditEventResponseSchema.parse({ ...validEvent, id: "audit_1" })).toThrow();
    expect(() =>
      auditEventResponseSchema.parse({ ...validEvent, organizationId: "org_1" }),
    ).toThrow();
    expect(auditEventResponseSchema.parse(validEvent).entityId).toBe("project_1");
    expect(auditEventResponseSchema.parse(validEvent).correlationId).toBe("corr_1");
  });
});

describe("auditEventListFilterSchema", () => {
  it("supports pagination with optional entity/actor filters", () => {
    const parsed = auditEventListFilterSchema.parse({ entityType: "project", limit: "5" });

    expect(parsed).toEqual({ entityType: "project", limit: 5 });
    expect(() => auditEventListFilterSchema.parse({ projectId: "project_1" })).toThrow();
  });
});
