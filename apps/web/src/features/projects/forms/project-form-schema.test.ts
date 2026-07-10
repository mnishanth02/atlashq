import { describe, expect, it } from "vitest";
import { projectFormSchema } from "./project-form-schema";
import type { ProjectFormValues } from "./project-form-transform";

function valid(overrides: Partial<ProjectFormValues> = {}): ProjectFormValues {
  return {
    name: "Atlas Rollout",
    type: "client",
    clientId: "client_1",
    ownerId: "user_1",
    techLeadId: "",
    businessOwnerId: "",
    startDate: "",
    targetDate: "",
    status: "draft",
    phase: "intake",
    priority: "medium",
    visibility: "organization",
    tags: "alpha, beta",
    description: "",
    ...overrides,
  };
}

function fieldErrors(values: ProjectFormValues): Set<string> {
  const result = projectFormSchema.safeParse(values);
  if (result.success) {
    return new Set();
  }
  return new Set(result.error.issues.map((issue) => String(issue.path[0])));
}

describe("projectFormSchema", () => {
  it("accepts a valid client project", () => {
    expect(projectFormSchema.safeParse(valid()).success).toBe(true);
  });

  it("requires a name", () => {
    expect(fieldErrors(valid({ name: "   " })).has("name")).toBe(true);
  });

  it("requires an owner", () => {
    expect(fieldErrors(valid({ ownerId: "" })).has("ownerId")).toBe(true);
  });

  it("requires a client for client projects but not for internal", () => {
    expect(fieldErrors(valid({ type: "client", clientId: "" })).has("clientId")).toBe(true);
    expect(fieldErrors(valid({ type: "internal", clientId: "" })).has("clientId")).toBe(false);
  });

  it("rejects too many tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`).join(", ");
    expect(fieldErrors(valid({ tags })).has("tags")).toBe(true);
  });

  it("rejects an over-long tag", () => {
    expect(fieldErrors(valid({ tags: "a".repeat(65) })).has("tags")).toBe(true);
  });

  it("rejects a target date before the start date", () => {
    const errors = fieldErrors(valid({ startDate: "2024-06-01", targetDate: "2024-01-01" }));
    expect(errors.has("targetDate")).toBe(true);
  });

  it("accepts a target date on or after the start date", () => {
    expect(
      projectFormSchema.safeParse(valid({ startDate: "2024-01-01", targetDate: "2024-06-01" }))
        .success,
    ).toBe(true);
  });
});
