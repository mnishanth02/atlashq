import { describe, expect, it } from "vitest";
import {
  organizationUserListFilterSchema,
  organizationUserResponseSchema,
} from "./organization-directory.js";

describe("organizationUserListFilterSchema", () => {
  it("defaults pagination and allows omitting search/status", () => {
    const parsed = organizationUserListFilterSchema.parse({});

    expect(parsed).toEqual({ limit: 25 });
  });

  it("coerces limit and trims search", () => {
    const parsed = organizationUserListFilterSchema.parse({ search: "  ada  ", limit: "10" });

    expect(parsed).toEqual({ search: "ada", limit: 10 });
  });

  it("accepts a valid status filter", () => {
    expect(organizationUserListFilterSchema.parse({ status: "active" }).status).toBe("active");
  });

  it("rejects an invalid status value", () => {
    expect(() => organizationUserListFilterSchema.parse({ status: "banned" })).toThrow();
  });

  it("rejects unknown fields (strict schema)", () => {
    expect(() => organizationUserListFilterSchema.parse({ role: "admin" })).toThrow();
  });

  it("rejects a limit above the max page size", () => {
    expect(() => organizationUserListFilterSchema.parse({ limit: 101 })).toThrow();
  });
});

describe("organizationUserResponseSchema", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ada Lovelace",
    email: "ada@example.com",
    status: "active",
    organizationRole: "admin",
  };

  it("parses a minimal, safe user projection", () => {
    expect(organizationUserResponseSchema.parse(base)).toEqual(base);
  });

  it("rejects fields beyond the minimal safe projection (strict schema)", () => {
    expect(() =>
      organizationUserResponseSchema.parse({ ...base, organizationId: "leak" }),
    ).toThrow();
  });

  it("rejects an invalid email", () => {
    expect(() =>
      organizationUserResponseSchema.parse({ ...base, email: "not-an-email" }),
    ).toThrow();
  });

  it("rejects an invalid organization role", () => {
    expect(() =>
      organizationUserResponseSchema.parse({ ...base, organizationRole: "owner" }),
    ).toThrow();
  });
});
