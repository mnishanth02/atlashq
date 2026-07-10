import type { OrganizationRole } from "@atlashq/types";

/** Minimal current-user shape needed to reason about create permissions. */
export type PermissionUser = {
  organizationRole: OrganizationRole;
};

export type ProjectCreatePermission = {
  canCreate: boolean;
  reason: string;
};

/** Organization admins are the only tenant-wide role that may author records. */
export function isOrganizationAdmin(user: PermissionUser | null | undefined): boolean {
  return user?.organizationRole === "admin";
}

/**
 * Resolve whether the current user may create a project, plus copy explaining
 * the decision. Returns a non-committal "checking" state while the user query
 * is still resolving so the UI never briefly shows an actionable control it
 * will then revoke.
 */
export function resolveProjectCreatePermission(
  user: PermissionUser | null | undefined,
): ProjectCreatePermission {
  if (!user) {
    return { canCreate: false, reason: "Checking your access…" };
  }
  if (isOrganizationAdmin(user)) {
    return { canCreate: true, reason: "Organization admins can create projects." };
  }
  return {
    canCreate: false,
    reason: "Only organization admins can create projects. Ask an admin to add one.",
  };
}
