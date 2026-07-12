import type { OrganizationRole, ProjectRole } from "@atlashq/types";
import { canProjectRole, projectRoles } from "@atlashq/types";

export type AnalysisViewerInput = {
  organizationRole: OrganizationRole | (string & {}) | null | undefined;
  status: string | null | undefined;
  membershipRole: ProjectRole | null;
  membershipStatus: string | null;
  membershipSoftDeletedAt: string | null;
  isProjectArchived: boolean;
};

export type AnalysisViewerPermissions = {
  /** `requirements:read` — Admin, Project Owner, Architect/Tech Lead, BA, Developer, QA. */
  canRead: boolean;
  /**
   * `requirements:analyze` — Admin, Project Owner, Architect/Tech Lead, BA only.
   * Always `false` on archived projects; never granted to Developer, QA, or
   * Client Viewer / Approver (module-03 §12.2). This governs starting,
   * canceling, retrying, replaying, and reprocessing runs — Module 4's
   * `requirements:review` permission is intentionally never checked here.
   */
  canAnalyze: boolean;
};

/**
 * Derive Requirement Analyzer affordances for the current viewer. This is a
 * cosmetic gate only — the API remains authoritative for every mutation — but
 * hiding actions the API will reject keeps the surface honest.
 */
export function deriveAnalysisViewerPermissions(
  input: AnalysisViewerInput,
): AnalysisViewerPermissions {
  const viewerActive =
    input.status === undefined || input.status === null || input.status === "active";
  const membershipActive =
    input.membershipRole !== null &&
    input.membershipStatus === "active" &&
    input.membershipSoftDeletedAt === null;

  const isOrganizationAdmin = viewerActive && input.organizationRole === "admin";

  const canRead =
    isOrganizationAdmin ||
    (membershipActive && canProjectRole(input.membershipRole as ProjectRole, "requirements:read"));

  const canAnalyzeRaw =
    isOrganizationAdmin ||
    (membershipActive &&
      canProjectRole(input.membershipRole as ProjectRole, "requirements:analyze"));
  const canAnalyze = canAnalyzeRaw && !input.isProjectArchived;

  return { canRead, canAnalyze };
}

export function isAnalysisReaderRole(role: ProjectRole | null | undefined): boolean {
  if (!role) return false;
  return canProjectRole(role, "requirements:read");
}

export function isAnalysisAnalystRole(role: ProjectRole | null | undefined): boolean {
  if (!role) return false;
  return canProjectRole(role, "requirements:analyze");
}

export function isNoAnalysisAccessRole(role: ProjectRole | null | undefined): boolean {
  if (!role) return true;
  return role === projectRoles.clientViewerApprover;
}
