import { describe, expect, it } from "vitest";
import {
  buildAuditInsertValues,
  normalizeAuditAction,
  normalizeAuditEntityType,
} from "./audit-input.js";

const baseInput = {
  organizationId: "org-1",
  actorId: "user-1",
  action: "project.created",
  entityType: "project",
  entityId: "project-1",
  before: null,
  after: { name: "Atlas" },
  correlationId: "corr-1",
};

describe("normalizeAuditAction / normalizeAuditEntityType", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeAuditAction("  project.created  ")).toBe("project.created");
    expect(normalizeAuditEntityType("  project  ")).toBe("project");
  });

  it("rejects empty or whitespace-only values", () => {
    expect(() => normalizeAuditAction("   ")).toThrow(/must not be empty/);
    expect(() => normalizeAuditEntityType("")).toThrow(/must not be empty/);
  });
});

describe("buildAuditInsertValues", () => {
  it("maps a full audit record input to the canonical audit_event insert shape", () => {
    const values = buildAuditInsertValues({ ...baseInput, projectId: "project-1" });

    expect(values).toEqual({
      organizationId: "org-1",
      actorId: "user-1",
      action: "project.created",
      entityType: "project",
      entityId: "project-1",
      projectId: "project-1",
      before: null,
      after: { name: "Atlas" },
      correlationId: "corr-1",
    });
  });

  it("omits projectId entirely rather than setting it to undefined when absent", () => {
    const values = buildAuditInsertValues(baseInput);

    expect("projectId" in values).toBe(false);
  });

  it("trims action, entityType, and correlationId before insert", () => {
    const values = buildAuditInsertValues({
      ...baseInput,
      action: "  project.created  ",
      entityType: "  project  ",
      correlationId: "  corr-1  ",
    });

    expect(values.action).toBe("project.created");
    expect(values.entityType).toBe("project");
    expect(values.correlationId).toBe("corr-1");
  });

  it("rejects an empty action, entityType, or correlationId", () => {
    expect(() => buildAuditInsertValues({ ...baseInput, action: "   " })).toThrow(
      /Invalid audit action/,
    );
    expect(() => buildAuditInsertValues({ ...baseInput, entityType: "" })).toThrow(
      /Invalid audit entityType/,
    );
    expect(() => buildAuditInsertValues({ ...baseInput, correlationId: "   " })).toThrow(
      /Invalid audit correlationId/,
    );
  });

  it("normalizes before/after snapshots, accepting null and rejecting invalid values", () => {
    expect(buildAuditInsertValues({ ...baseInput, before: null, after: null })).toMatchObject({
      before: null,
      after: null,
    });

    expect(() => buildAuditInsertValues({ ...baseInput, before: { fn: () => 1 } })).toThrow(
      /is not JSON-safe/,
    );
  });

  it("preserves an arbitrary non-UUID correlation id rather than rejecting it", () => {
    const values = buildAuditInsertValues({
      ...baseInput,
      correlationId: "trace-abc-123-not-a-uuid",
    });

    expect(values.correlationId).toBe("trace-abc-123-not-a-uuid");
  });
});
