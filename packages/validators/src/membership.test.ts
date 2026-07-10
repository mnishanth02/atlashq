import { describe, expect, it } from "vitest";
import {
  organizationMembershipCreateInputSchema,
  organizationRoleSchema,
  projectMembershipCreateInputSchema,
  projectMembershipListFilterSchema,
  projectMembershipUpdateInputSchema,
  projectRoleSchema,
} from "./membership.js";

const ORGANIZATION = "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90";
const USER = "11111111-1111-4111-8111-111111111111";

describe("role schemas", () => {
  it("keeps project roles and organization roles distinct", () => {
    expect(projectRoleSchema.options).toHaveLength(7);
    expect(organizationRoleSchema.options).toEqual(["admin", "member"]);
    expect(() => organizationRoleSchema.parse("Admin")).toThrow();
    expect(() => projectRoleSchema.parse("admin")).toThrow();
  });
});

describe("projectMembershipCreateInputSchema", () => {
  it("requires only userId and a codified role because projectId comes from the path", () => {
    const parsed = projectMembershipCreateInputSchema.parse({
      userId: USER,
      role: "Developer",
    });

    expect(parsed).toEqual({ userId: USER, role: "Developer" });
    expect(() =>
      projectMembershipCreateInputSchema.parse({
        projectId: "22222222-2222-4222-8222-222222222222",
        userId: USER,
        role: "Developer",
      }),
    ).toThrow();
  });

  it("rejects an uncodified role", () => {
    expect(() =>
      projectMembershipCreateInputSchema.parse({
        userId: USER,
        role: "Owner",
      }),
    ).toThrow();
  });
});

describe("projectMembershipUpdateInputSchema", () => {
  it("allows updating only role or only status", () => {
    expect(projectMembershipUpdateInputSchema.parse({ role: "QA" })).toEqual({ role: "QA" });
    expect(projectMembershipUpdateInputSchema.parse({ status: "removed" })).toEqual({
      status: "removed",
    });
  });

  it("rejects an empty update payload", () => {
    expect(() => projectMembershipUpdateInputSchema.parse({})).toThrow();
  });
});

describe("projectMembershipListFilterSchema", () => {
  it("supports pagination with optional membership filters", () => {
    const parsed = projectMembershipListFilterSchema.parse({
      status: "active",
    });

    expect(parsed).toEqual({ status: "active", limit: 25 });
    expect(() => projectMembershipListFilterSchema.parse({ projectId: "project_1" })).toThrow();
  });
});

describe("organizationMembershipCreateInputSchema", () => {
  it("validates organization-level admin | member assignment", () => {
    const parsed = organizationMembershipCreateInputSchema.parse({
      organizationId: ORGANIZATION,
      userId: USER,
      role: "member",
    });

    expect(parsed.role).toBe("member");
  });

  it("rejects non-UUID organization and user ids", () => {
    expect(() =>
      organizationMembershipCreateInputSchema.parse({
        organizationId: "org_1",
        userId: USER,
        role: "member",
      }),
    ).toThrow();
    expect(
      organizationMembershipCreateInputSchema.parse({
        organizationId: ORGANIZATION,
        userId: USER,
        role: "member",
      }).organizationId,
    ).toBe(ORGANIZATION);
  });
});
