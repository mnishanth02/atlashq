// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type EntityId = string;
export type OrganizationId = EntityId;
export type ProjectId = EntityId;
export type ClientId = EntityId;
export type UserId = EntityId;
export type ProjectMembershipId = EntityId;
export type AuditEventId = EntityId;
export type AiRunId = EntityId;
export type ISODateTimeString = string;

// ---------------------------------------------------------------------------
// Project roles (V1 codified source of truth, do not re-derive elsewhere)
// ---------------------------------------------------------------------------

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

export function isProjectRole(value: string): value is ProjectRole {
  return projectRoleValues.includes(value as ProjectRole);
}

export type ProjectPermission =
  | "project:read"
  | "project:write"
  | "project:admin"
  | "requirements:review"
  | "architecture:review";

export const rolePermissions = {
  [projectRoles.admin]: [
    "project:read",
    "project:write",
    "project:admin",
    "requirements:review",
    "architecture:review",
  ],
  [projectRoles.projectOwner]: [
    "project:read",
    "project:write",
    "project:admin",
    "requirements:review",
    "architecture:review",
  ],
  [projectRoles.architectTechLead]: ["project:read", "project:write", "architecture:review"],
  [projectRoles.businessAnalystCoordinator]: [
    "project:read",
    "project:write",
    "requirements:review",
  ],
  [projectRoles.developer]: ["project:read", "project:write"],
  [projectRoles.qa]: ["project:read", "requirements:review"],
  [projectRoles.clientViewerApprover]: [],
} as const satisfies Record<ProjectRole, readonly ProjectPermission[]>;

export function canProjectRole(role: ProjectRole, permission: ProjectPermission): boolean {
  return (rolePermissions[role] as readonly ProjectPermission[]).includes(permission);
}

export function projectRolesForPermission(permission: ProjectPermission): ProjectRole[] {
  return projectRoleValues.filter((role) => canProjectRole(role, permission));
}

export function isMutationPermission(permission: ProjectPermission): boolean {
  return permission !== "project:read";
}

// ---------------------------------------------------------------------------
// Organization roles (tenant-wide access, distinct from project membership)
// ---------------------------------------------------------------------------

export const organizationRoleValues = ["admin", "member"] as const;

export type OrganizationRole = (typeof organizationRoleValues)[number];

export const organizationRoles = {
  admin: "admin",
  member: "member",
} as const satisfies Record<string, OrganizationRole>;

export function isOrganizationRole(value: string): value is OrganizationRole {
  return organizationRoleValues.includes(value as OrganizationRole);
}

// ---------------------------------------------------------------------------
// Project controlled values
// ---------------------------------------------------------------------------

export const projectTypeValues = ["client", "internal"] as const;
export type ProjectType = (typeof projectTypeValues)[number];
export function isProjectType(value: string): value is ProjectType {
  return projectTypeValues.includes(value as ProjectType);
}

export const projectStatusValues = ["draft", "active", "on_hold", "completed", "archived"] as const;
export type ProjectStatus = (typeof projectStatusValues)[number];
export function isProjectStatus(value: string): value is ProjectStatus {
  return projectStatusValues.includes(value as ProjectStatus);
}

export const projectWritableStatusValues = ["draft", "active", "on_hold", "completed"] as const;
export type ProjectWritableStatus = (typeof projectWritableStatusValues)[number];
export function isProjectWritableStatus(value: string): value is ProjectWritableStatus {
  return projectWritableStatusValues.includes(value as ProjectWritableStatus);
}

export const projectSortValues = ["updated_desc", "updated_asc", "name_asc", "name_desc"] as const;
export type ProjectSort = (typeof projectSortValues)[number];
export function isProjectSort(value: string): value is ProjectSort {
  return projectSortValues.includes(value as ProjectSort);
}

export const projectPhaseValues = [
  "intake",
  "requirements",
  "clarification",
  "baseline",
  "architecture",
  "delivery",
  "handoff",
  "closed",
] as const;
export type ProjectPhase = (typeof projectPhaseValues)[number];
export function isProjectPhase(value: string): value is ProjectPhase {
  return projectPhaseValues.includes(value as ProjectPhase);
}

export const projectPriorityValues = ["low", "medium", "high", "critical"] as const;
export type ProjectPriority = (typeof projectPriorityValues)[number];
export function isProjectPriority(value: string): value is ProjectPriority {
  return projectPriorityValues.includes(value as ProjectPriority);
}

export const projectVisibilityValues = ["private", "organization"] as const;
export type ProjectVisibility = (typeof projectVisibilityValues)[number];
export function isProjectVisibility(value: string): value is ProjectVisibility {
  return projectVisibilityValues.includes(value as ProjectVisibility);
}

/** Free-form, trimmed tag string. V1 does not introduce a controlled tag vocabulary. */
export type ProjectTag = string;

// ---------------------------------------------------------------------------
// Actors and membership
// ---------------------------------------------------------------------------

export type ActorRef = {
  id: UserId;
  role?: ProjectRole;
};

export type ProjectMembership = {
  id: ProjectMembershipId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  userId: UserId;
  role: ProjectRole;
};

export type OrganizationMembership = {
  organizationId: OrganizationId;
  userId: UserId;
  role: OrganizationRole;
};

// ---------------------------------------------------------------------------
// JSON-safe snapshot types (used by audit_event.before/after, ai_run.output, etc.)
// ---------------------------------------------------------------------------

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// Audit metadata (canonical application-level shape of the `audit_event` table)
// ---------------------------------------------------------------------------

/**
 * Canonical audit event shape. Supersedes the divergent placeholders in
 * `apps/api/src/audit/audit-event.ts` (`resourceType`/`resourceId`, no org/snapshots) and the
 * previous `AuditMetadata` here (`occurredAt`). Fields are camelCase application-level mirrors of
 * the `audit_event` DB columns (`organization_id`, `actor_id`, `action`, `entity_type`,
 * `entity_id`, `project_id`, `before`, `after`, `correlation_id`, `at`).
 */
export type AuditMetadata = {
  organizationId: OrganizationId;
  actorId: UserId;
  action: string;
  entityType: string;
  entityId: EntityId;
  projectId?: ProjectId;
  before: JsonObject | null;
  after: JsonObject | null;
  correlationId: string;
  at: ISODateTimeString;
};

// ---------------------------------------------------------------------------
// AI run provenance (canonical application-level shape of the `ai_run` table)
// ---------------------------------------------------------------------------

export const aiRunStatusValues = ["planned", "running", "succeeded", "failed"] as const;
export type AiRunStatus = (typeof aiRunStatusValues)[number];
export function isAiRunStatus(value: string): value is AiRunStatus {
  return aiRunStatusValues.includes(value as AiRunStatus);
}

export const aiReviewStatusValues = ["pending", "accepted", "rejected"] as const;
export type AiReviewStatus = (typeof aiReviewStatusValues)[number];
export function isAiReviewStatus(value: string): value is AiReviewStatus {
  return aiReviewStatusValues.includes(value as AiReviewStatus);
}
