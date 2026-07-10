import { describe, expect, it } from "vitest";
import {
  projectCreateInputSchema,
  projectListFilterSchema,
  projectPhaseSchema,
  projectPrioritySchema,
  projectStatusSchema,
  projectTypeSchema,
  projectUpdateInputSchema,
  projectVisibilitySchema,
} from "./project.js";

const CLIENT = "33333333-3333-4333-8333-333333333333";
const OWNER = "11111111-1111-4111-8111-111111111111";

const baseInput = {
  name: "Atlas Client Rollout",
  type: "client" as const,
  clientId: CLIENT,
  ownerId: OWNER,
};

describe("project enums", () => {
  it("mirrors the canonical @atlashq/types controlled values", () => {
    expect(projectTypeSchema.options).toEqual(["client", "internal"]);
    expect(projectStatusSchema.options).toEqual([
      "draft",
      "active",
      "on_hold",
      "completed",
      "archived",
    ]);
    expect(projectPhaseSchema.options).toEqual([
      "intake",
      "requirements",
      "clarification",
      "baseline",
      "architecture",
      "delivery",
      "handoff",
      "closed",
    ]);
    expect(projectPrioritySchema.options).toEqual(["low", "medium", "high", "critical"]);
    expect(projectVisibilitySchema.options).toEqual(["private", "organization"]);
  });
});

describe("projectCreateInputSchema", () => {
  it("applies V1 defaults for status/phase/priority/visibility/tags", () => {
    const parsed = projectCreateInputSchema.parse(baseInput);

    expect(parsed.status).toBe("draft");
    expect(parsed.phase).toBe("intake");
    expect(parsed.priority).toBe("medium");
    expect(parsed.visibility).toBe("organization");
    expect(parsed.tags).toEqual([]);
  });

  it("trims free-form tags", () => {
    const parsed = projectCreateInputSchema.parse({ ...baseInput, tags: ["  Billing  ", "vip"] });

    expect(parsed.tags).toEqual(["Billing", "vip"]);
  });

  it("requires clientId when type is client", () => {
    const result = projectCreateInputSchema.safeParse({
      name: "Atlas",
      type: "client",
      ownerId: OWNER,
    });

    expect(result.success).toBe(false);
  });

  it("rejects clientId when type is internal", () => {
    const result = projectCreateInputSchema.safeParse({
      name: "Atlas Internal Tool",
      type: "internal",
      clientId: CLIENT,
      ownerId: OWNER,
    });

    expect(result.success).toBe(false);
  });

  it("allows internal projects to omit clientId entirely", () => {
    const parsed = projectCreateInputSchema.parse({
      name: "Atlas Internal Tool",
      type: "internal",
      ownerId: OWNER,
    });

    expect(parsed).not.toHaveProperty("clientId");
  });

  it("rejects unknown fields (strict schema)", () => {
    expect(() => projectCreateInputSchema.parse({ ...baseInput, unknownField: "nope" })).toThrow();
  });

  it("does not allow nullable references on create", () => {
    expect(() => projectCreateInputSchema.parse({ ...baseInput, techLeadId: null })).toThrow();
  });

  it("rejects non-UUID PostgreSQL-backed identifiers", () => {
    expect(() => projectCreateInputSchema.parse({ ...baseInput, ownerId: "user_1" })).toThrow();
    expect(() => projectCreateInputSchema.parse({ ...baseInput, clientId: "client_1" })).toThrow();
  });

  it("excludes archived from normal creation", () => {
    expect(() => projectCreateInputSchema.parse({ ...baseInput, status: "archived" })).toThrow();
  });
});

describe("projectUpdateInputSchema", () => {
  it("accepts a partial update without re-supplying every field", () => {
    const parsed = projectUpdateInputSchema.parse({ version: 3, status: "on_hold" });

    expect(parsed).toEqual({ version: 3, status: "on_hold" });
  });

  it("does not apply create-time defaults on untouched fields", () => {
    const parsed = projectUpdateInputSchema.parse({ version: 3, priority: "critical" });

    expect(parsed).toEqual({ version: 3, priority: "critical" });
    expect(parsed.status).toBeUndefined();
  });

  it("allows partial client/type changes for service-level merged validation", () => {
    expect(projectUpdateInputSchema.parse({ version: 3, type: "client" })).toEqual({
      version: 3,
      type: "client",
    });
    expect(projectUpdateInputSchema.parse({ version: 3, clientId: CLIENT })).toEqual({
      version: 3,
      clientId: CLIENT,
    });
  });

  it("requires version and at least one mutable field", () => {
    expect(() => projectUpdateInputSchema.parse({})).toThrow();
    expect(() => projectUpdateInputSchema.parse({ version: 3 })).toThrow();
    expect(() => projectUpdateInputSchema.parse({ name: "Renamed" })).toThrow();
  });

  it("accepts explicit nulls for every nullable project field", () => {
    expect(
      projectUpdateInputSchema.parse({
        version: 3,
        type: "internal",
        clientId: null,
        techLeadId: null,
        businessOwnerId: null,
        startDate: null,
        targetDate: null,
        description: null,
      }),
    ).toEqual({
      version: 3,
      type: "internal",
      clientId: null,
      techLeadId: null,
      businessOwnerId: null,
      startDate: null,
      targetDate: null,
      description: null,
    });
  });

  it("excludes archived from normal updates", () => {
    expect(() => projectUpdateInputSchema.parse({ version: 3, status: "archived" })).toThrow();
  });
});

describe("projectListFilterSchema", () => {
  it("combines pagination defaults with optional project filters", () => {
    const parsed = projectListFilterSchema.parse({ status: "active", limit: "5" });

    expect(parsed).toEqual({
      status: "active",
      limit: 5,
      includeArchived: false,
      sort: "updated_desc",
    });
  });

  it("parses false explicitly instead of using truthy coercion", () => {
    expect(projectListFilterSchema.parse({ includeArchived: "false" }).includeArchived).toBe(false);
    expect(projectListFilterSchema.parse({ includeArchived: "true" }).includeArchived).toBe(true);
    expect(projectListFilterSchema.parse({ includeArchived: "0" }).includeArchived).toBe(false);
    expect(projectListFilterSchema.parse({ includeArchived: "1" }).includeArchived).toBe(true);
    expect(() => projectListFilterSchema.parse({ includeArchived: "yes" })).toThrow();
  });

  it("validates supported project sorts", () => {
    expect(projectListFilterSchema.parse({ sort: "name_asc" }).sort).toBe("name_asc");
    expect(() => projectListFilterSchema.parse({ sort: "created_desc" })).toThrow();
  });
});
