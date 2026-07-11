import type { OrganizationRole, ProjectRole } from "@atlashq/types";
import { canProjectRole, projectRoles } from "@atlashq/types";
import type { SourceViewerPermissions } from "./source-presentation";

export type SourceViewerInput = {
  organizationRole: OrganizationRole | (string & {}) | null | undefined;
  status: string | null | undefined;
  membershipRole: ProjectRole | null;
  membershipStatus: string | null;
  membershipSoftDeletedAt: string | null;
  isProjectArchived: boolean;
};

/**
 * Derive Source Vault affordances for the current viewer. UI enforcement is
 * cosmetic — the API is always authoritative — but hiding actions the API will
 * reject keeps the surface honest.
 */
export function deriveSourceViewerPermissions(input: SourceViewerInput): SourceViewerPermissions {
  const viewerActive =
    input.status === undefined || input.status === null || input.status === "active";
  const membershipActive =
    input.membershipRole !== null &&
    input.membershipStatus === "active" &&
    input.membershipSoftDeletedAt === null;

  const isOrganizationAdmin = viewerActive && input.organizationRole === "admin";
  const isProjectAdmin =
    isOrganizationAdmin ||
    (membershipActive && canProjectRole(input.membershipRole as ProjectRole, "project:admin"));

  const canRead =
    isOrganizationAdmin ||
    (membershipActive && canProjectRole(input.membershipRole as ProjectRole, "sources:read"));

  const canWriteRaw =
    isOrganizationAdmin ||
    (membershipActive && canProjectRole(input.membershipRole as ProjectRole, "sources:write"));
  const canWrite = canWriteRaw && !input.isProjectArchived;

  return {
    canRead,
    canWrite,
    canEditMetadata: canWrite,
    canReplace: canWrite,
    canArchive: canWrite,
    canRestore: canWrite,
    canRetry: canWrite,
    canManageIpReview: isProjectAdmin && !input.isProjectArchived,
    canRequestCapture: canWrite,
  };
}

export function isSourceContributorRole(role: ProjectRole | null | undefined): boolean {
  if (!role) return false;
  return canProjectRole(role, "sources:write");
}

export function isSourceReaderRole(role: ProjectRole | null | undefined): boolean {
  if (!role) return false;
  return canProjectRole(role, "sources:read");
}

export function isNoAccessRole(role: ProjectRole | null | undefined): boolean {
  if (!role) return true;
  return role === projectRoles.clientViewerApprover;
}
