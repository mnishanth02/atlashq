export const projectRoleValues = [
  "Admin",
  "Project Owner",
  "Architect / Tech Lead",
  "Business Analyst / Coordinator",
  "Developer",
  "QA",
  "Client Viewer / Approver",
] as const;

export type ProjectRole = (typeof projectRoleValues)[number];

export const projectRoles = {
  admin: "Admin",
  projectOwner: "Project Owner",
  architectTechLead: "Architect / Tech Lead",
  businessAnalystCoordinator: "Business Analyst / Coordinator",
  developer: "Developer",
  qa: "QA",
  clientViewerApprover: "Client Viewer / Approver",
} as const satisfies Record<string, ProjectRole>;

export type EntityId = string;
export type OrganizationId = EntityId;
export type ProjectId = EntityId;
export type UserId = EntityId;
export type ISODateTimeString = string;

export type ProjectVisibility = "private" | "organization";

export type ActorRef = {
  id: UserId;
  role?: ProjectRole;
};

export type AuditMetadata = {
  organizationId: OrganizationId;
  projectId?: ProjectId;
  actorId: UserId;
  correlationId: string;
  occurredAt: ISODateTimeString;
};

export type ProjectMembership = {
  organizationId: OrganizationId;
  projectId: ProjectId;
  userId: UserId;
  role: ProjectRole;
};

export function isProjectRole(value: string): value is ProjectRole {
  return projectRoleValues.includes(value as ProjectRole);
}
