import { type ProjectRole, projectRoles, projectRoleValues } from "@atlashq/types";
import { projectRoleSchema, uuidSchema } from "@atlashq/validators";
import { z } from "zod";

export type MembershipStatus = "invited" | "active" | "removed";

export const membershipAddFormSchema = z
  .object({
    userId: uuidSchema,
    role: projectRoleSchema,
  })
  .strict();

export type MembershipAddFormValues = z.infer<typeof membershipAddFormSchema>;

export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  [projectRoles.admin]:
    "Full workspace administration, including lifecycle changes and membership management.",
  [projectRoles.projectOwner]:
    "Owns the project workspace and can manage archive, restore, and membership changes.",
  [projectRoles.architectTechLead]:
    "Leads architecture review and technical delivery direction for the workspace.",
  [projectRoles.businessAnalystCoordinator]:
    "Coordinates documents, requirements, and follow-up questions across the workspace.",
  [projectRoles.developer]:
    "Contributes delivery work and collaborates against the current project baseline.",
  [projectRoles.qa]: "Validates requirements readiness and delivery quality checkpoints.",
  [projectRoles.clientViewerApprover]:
    "Read-only visibility for manual review and approval-oriented collaboration.",
};

export const PROJECT_ROLE_OPTIONS = projectRoleValues.map((role) => ({
  value: role,
  label: role,
  description: PROJECT_ROLE_DESCRIPTIONS[role],
}));

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  invited: "Invited",
  active: "Active",
  removed: "Removed",
};

export const EDITABLE_MEMBERSHIP_STATUSES: MembershipStatus[] = ["invited", "active"];

export function getProjectRoleDescription(role: ProjectRole) {
  return PROJECT_ROLE_DESCRIPTIONS[role];
}

export function getMembershipStatusLabel(status: MembershipStatus) {
  return MEMBERSHIP_STATUS_LABELS[status];
}
