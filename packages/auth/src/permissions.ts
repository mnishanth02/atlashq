import {
  canProjectRole,
  isMutationPermission,
  type OrganizationRole,
  organizationRoles,
  type ProjectPermission,
  type ProjectRole,
} from "@atlashq/types";

export type { ProjectPermission, ProjectRole } from "@atlashq/types";
export {
  canProjectRole,
  isMutationPermission,
  projectRolesForPermission,
  rolePermissions,
} from "@atlashq/types";

export type ProjectAccessContext = {
  organizationId: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  visibility: "private" | "organization";
};

/**
 * Pure permission-matrix check for a project membership context. Kept as a small,
 * side-effect-free helper so it can be reused and unit tested independently of the
 * NestJS guard that performs the organization-scoped database lookups.
 */
export function canAccessProject(
  context: ProjectAccessContext,
  permission: ProjectPermission,
): boolean {
  return canProjectRole(context.role, permission);
}

export type ProjectAccessActor = {
  organizationId: string;
  organizationRole: OrganizationRole | (string & {});
};

export type ProjectAccessProject = {
  organizationId: string;
  status: string;
  softDeletedAt: Date | null;
};

export type ProjectAccessMembership = {
  role: ProjectRole;
  status: string;
  softDeletedAt: Date | null;
};

export type ProjectAccessDecisionInput = {
  actor: ProjectAccessActor;
  permission: ProjectPermission;
  project: ProjectAccessProject | null;
  membership: ProjectAccessMembership | null;
};

export type ProjectAccessReason =
  | "project_not_found"
  | "cross_organization"
  | "project_soft_deleted"
  | "project_archived_mutation"
  | "organization_admin"
  | "admin_restore"
  | "no_active_membership"
  | "insufficient_role"
  | "project_membership";

export type ProjectAccessDecision = {
  allowed: boolean;
  reason: ProjectAccessReason;
};

function decide(allowed: boolean, reason: ProjectAccessReason): ProjectAccessDecision {
  return { allowed, reason };
}

/**
 * Deny-by-default project authorization evaluation. All state is passed in as plain
 * data (loaded by an organization-scoped, parameterized query) so this can be tested
 * exhaustively without a database. Frontend checks are never treated as authority.
 */
export function evaluateProjectAccess(input: ProjectAccessDecisionInput): ProjectAccessDecision {
  const { actor, permission, project, membership } = input;

  if (!project) {
    return decide(false, "project_not_found");
  }

  if (project.organizationId !== actor.organizationId) {
    return decide(false, "cross_organization");
  }

  const isAdmin = actor.organizationRole === organizationRoles.admin;
  const mutation = isMutationPermission(permission);
  const hasActiveMembership =
    membership !== null && membership.status === "active" && membership.softDeletedAt === null;

  if (project.softDeletedAt !== null) {
    // A soft-deleted project is invisible to normal access. Only an organization
    // admin performing an explicit admin action (e.g. restore) may act on it.
    if (isAdmin && permission === "project:admin") {
      return decide(true, "admin_restore");
    }

    return decide(false, "project_soft_deleted");
  }

  if (project.status === "archived" && mutation) {
    // Archived projects remain readable and frozen for normal mutations.
    // Explicit project-admin actions may pass for an organization admin or an
    // active membership role with project:admin (notably Project Owner restore);
    // mutation services still enforce their archived-state freezes.
    if (isAdmin) {
      return decide(true, "organization_admin");
    }

    if (
      permission === "project:admin" &&
      hasActiveMembership &&
      canProjectRole(membership.role, permission)
    ) {
      return decide(true, "project_membership");
    }

    return decide(false, "project_archived_mutation");
  }

  if (isAdmin) {
    return decide(true, "organization_admin");
  }

  if (!hasActiveMembership) {
    return decide(false, "no_active_membership");
  }

  if (!canProjectRole(membership.role, permission)) {
    return decide(false, "insufficient_role");
  }

  return decide(true, "project_membership");
}
