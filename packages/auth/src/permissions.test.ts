import { organizationRoles, projectRoles } from "@atlashq/types";
import { describe, expect, it } from "vitest";
import {
  canAccessProject,
  canProjectRole,
  evaluateProjectAccess,
  isMutationPermission,
  type ProjectAccessDecisionInput,
  rolePermissions,
} from "./permissions.js";

describe("rolePermissions matrix", () => {
  it("grants the admin role every project permission", () => {
    expect(rolePermissions[projectRoles.admin]).toEqual([
      "project:read",
      "project:write",
      "project:admin",
      "requirements:review",
      "architecture:review",
    ]);
  });

  it("grants the client viewer no permissions", () => {
    expect(rolePermissions[projectRoles.clientViewerApprover]).toEqual([]);
  });

  it("scopes developer to read/write only", () => {
    expect(canProjectRole(projectRoles.developer, "project:read")).toBe(true);
    expect(canProjectRole(projectRoles.developer, "project:write")).toBe(true);
    expect(canProjectRole(projectRoles.developer, "project:admin")).toBe(false);
    expect(canProjectRole(projectRoles.developer, "architecture:review")).toBe(false);
  });

  it("exposes canAccessProject as a thin wrapper over the matrix", () => {
    expect(
      canAccessProject(
        {
          organizationId: "org-1",
          projectId: "proj-1",
          userId: "user-1",
          role: projectRoles.qa,
          visibility: "organization",
        },
        "requirements:review",
      ),
    ).toBe(true);
  });

  it("treats every non-read permission as a mutation", () => {
    expect(isMutationPermission("project:read")).toBe(false);
    expect(isMutationPermission("project:write")).toBe(true);
    expect(isMutationPermission("project:admin")).toBe(true);
    expect(isMutationPermission("requirements:review")).toBe(true);
  });
});

function input(overrides: Partial<ProjectAccessDecisionInput>): ProjectAccessDecisionInput {
  return {
    actor: { organizationId: "org-1", organizationRole: organizationRoles.member },
    permission: "project:write",
    project: { organizationId: "org-1", status: "active", softDeletedAt: null },
    membership: { role: projectRoles.developer, status: "active", softDeletedAt: null },
    ...overrides,
  };
}

describe("evaluateProjectAccess (deny-by-default)", () => {
  it("denies when the project is not found", () => {
    expect(evaluateProjectAccess(input({ project: null }))).toEqual({
      allowed: false,
      reason: "project_not_found",
    });
  });

  it("denies cross-organization access", () => {
    const decision = evaluateProjectAccess(
      input({ project: { organizationId: "org-2", status: "active", softDeletedAt: null } }),
    );
    expect(decision).toEqual({ allowed: false, reason: "cross_organization" });
  });

  it("denies cross-organization access even for an organization admin", () => {
    const decision = evaluateProjectAccess(
      input({
        actor: { organizationId: "org-1", organizationRole: organizationRoles.admin },
        project: { organizationId: "org-2", status: "active", softDeletedAt: null },
      }),
    );
    expect(decision).toEqual({ allowed: false, reason: "cross_organization" });
  });

  it("denies a soft-deleted project for a non-admin", () => {
    const decision = evaluateProjectAccess(
      input({ project: { organizationId: "org-1", status: "active", softDeletedAt: new Date() } }),
    );
    expect(decision).toEqual({ allowed: false, reason: "project_soft_deleted" });
  });

  it("allows an org admin to restore (project:admin) a soft-deleted project", () => {
    const decision = evaluateProjectAccess(
      input({
        actor: { organizationId: "org-1", organizationRole: organizationRoles.admin },
        permission: "project:admin",
        project: { organizationId: "org-1", status: "active", softDeletedAt: new Date() },
      }),
    );
    expect(decision).toEqual({ allowed: true, reason: "admin_restore" });
  });

  it("denies a non-admin mutation on an archived project", () => {
    const decision = evaluateProjectAccess(
      input({ project: { organizationId: "org-1", status: "archived", softDeletedAt: null } }),
    );
    expect(decision).toEqual({ allowed: false, reason: "project_archived_mutation" });
  });

  it.each([
    projectRoles.projectOwner,
    projectRoles.admin,
  ])("allows active %s membership to perform archived project admin actions", (role) => {
    const decision = evaluateProjectAccess(
      input({
        permission: "project:admin",
        project: { organizationId: "org-1", status: "archived", softDeletedAt: null },
        membership: { role, status: "active", softDeletedAt: null },
      }),
    );
    expect(decision).toEqual({ allowed: true, reason: "project_membership" });
  });

  it.each([
    projectRoles.architectTechLead,
    projectRoles.businessAnalystCoordinator,
    projectRoles.developer,
    projectRoles.qa,
    projectRoles.clientViewerApprover,
  ])("denies archived project admin actions to %s", (role) => {
    const decision = evaluateProjectAccess(
      input({
        permission: "project:admin",
        project: { organizationId: "org-1", status: "archived", softDeletedAt: null },
        membership: { role, status: "active", softDeletedAt: null },
      }),
    );
    expect(decision).toEqual({ allowed: false, reason: "project_archived_mutation" });
  });

  it.each([
    { status: "invited", softDeletedAt: null },
    { status: "removed", softDeletedAt: null },
    { status: "active", softDeletedAt: new Date() },
  ])("denies archived project admin actions without an active membership: %o", (membership) => {
    const decision = evaluateProjectAccess(
      input({
        permission: "project:admin",
        project: { organizationId: "org-1", status: "archived", softDeletedAt: null },
        membership: { role: projectRoles.projectOwner, ...membership },
      }),
    );
    expect(decision).toEqual({ allowed: false, reason: "project_archived_mutation" });
  });

  it("does not broadly unfreeze archived writes for a Project Owner", () => {
    const decision = evaluateProjectAccess(
      input({
        permission: "project:write",
        project: { organizationId: "org-1", status: "archived", softDeletedAt: null },
        membership: {
          role: projectRoles.projectOwner,
          status: "active",
          softDeletedAt: null,
        },
      }),
    );
    expect(decision).toEqual({ allowed: false, reason: "project_archived_mutation" });
  });

  it("allows a non-admin read on an archived project via membership", () => {
    const decision = evaluateProjectAccess(
      input({
        permission: "project:read",
        project: { organizationId: "org-1", status: "archived", softDeletedAt: null },
      }),
    );
    expect(decision).toEqual({ allowed: true, reason: "project_membership" });
  });

  it("allows an org admin to mutate an archived project in the same org", () => {
    const decision = evaluateProjectAccess(
      input({
        actor: { organizationId: "org-1", organizationRole: organizationRoles.admin },
        project: { organizationId: "org-1", status: "archived", softDeletedAt: null },
        membership: null,
      }),
    );
    expect(decision).toEqual({ allowed: true, reason: "organization_admin" });
  });

  it("allows an org admin to act on an active project without a membership row", () => {
    const decision = evaluateProjectAccess(
      input({
        actor: { organizationId: "org-1", organizationRole: organizationRoles.admin },
        membership: null,
      }),
    );
    expect(decision).toEqual({ allowed: true, reason: "organization_admin" });
  });

  it("denies a non-admin without an active membership", () => {
    const decision = evaluateProjectAccess(input({ membership: null }));
    expect(decision).toEqual({ allowed: false, reason: "no_active_membership" });
  });

  it("denies a non-admin whose membership is inactive", () => {
    const decision = evaluateProjectAccess(
      input({
        membership: { role: projectRoles.developer, status: "inactive", softDeletedAt: null },
      }),
    );
    expect(decision).toEqual({ allowed: false, reason: "no_active_membership" });
  });

  it("denies a non-admin whose membership is soft-deleted", () => {
    const decision = evaluateProjectAccess(
      input({
        membership: { role: projectRoles.developer, status: "active", softDeletedAt: new Date() },
      }),
    );
    expect(decision).toEqual({ allowed: false, reason: "no_active_membership" });
  });

  it("denies a member whose role lacks the requested permission", () => {
    const decision = evaluateProjectAccess(
      input({
        permission: "project:admin",
        membership: { role: projectRoles.developer, status: "active", softDeletedAt: null },
      }),
    );
    expect(decision).toEqual({ allowed: false, reason: "insufficient_role" });
  });

  it("allows a member whose role grants the requested permission", () => {
    const decision = evaluateProjectAccess(
      input({
        permission: "project:write",
        membership: { role: projectRoles.developer, status: "active", softDeletedAt: null },
      }),
    );
    expect(decision).toEqual({ allowed: true, reason: "project_membership" });
  });
});
