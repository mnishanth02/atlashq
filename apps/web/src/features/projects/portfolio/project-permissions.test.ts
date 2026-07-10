import { describe, expect, it } from "vitest";
import { isOrganizationAdmin, resolveProjectCreatePermission } from "./project-permissions";

describe("isOrganizationAdmin", () => {
  it("is true only for admins", () => {
    expect(isOrganizationAdmin({ organizationRole: "admin" })).toBe(true);
    expect(isOrganizationAdmin({ organizationRole: "member" })).toBe(false);
    expect(isOrganizationAdmin(null)).toBe(false);
    expect(isOrganizationAdmin(undefined)).toBe(false);
  });
});

describe("resolveProjectCreatePermission", () => {
  it("allows admins to create", () => {
    const permission = resolveProjectCreatePermission({ organizationRole: "admin" });
    expect(permission.canCreate).toBe(true);
    expect(permission.reason).toMatch(/admins can create/i);
  });

  it("denies members with explanatory copy", () => {
    const permission = resolveProjectCreatePermission({ organizationRole: "member" });
    expect(permission.canCreate).toBe(false);
    expect(permission.reason).toMatch(/only organization admins/i);
  });

  it("returns a non-committal checking state while the user is unknown", () => {
    const permission = resolveProjectCreatePermission(undefined);
    expect(permission.canCreate).toBe(false);
    expect(permission.reason).toMatch(/checking/i);
  });
});
