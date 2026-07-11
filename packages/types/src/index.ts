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
  | "architecture:review"
  | "sources:read"
  | "sources:write";

// `sources:read`/`sources:write` are Module 2 Source Document Vault permissions (module-02 §7).
// They are intentionally distinct from `project:read`/`project:write` so Developer/QA can read
// project data yet remain read-only for source evidence, and so Client Viewer / Approver (which
// has no project mutation rights) stays fully excluded from the vault. IP-review clearance reuses
// `project:admin` rather than introducing a third permission because its grantees (Admin, Project
// Owner) already match module-02's IP-review authorization rule exactly.
export const rolePermissions = {
  [projectRoles.admin]: [
    "project:read",
    "project:write",
    "project:admin",
    "requirements:review",
    "architecture:review",
    "sources:read",
    "sources:write",
  ],
  [projectRoles.projectOwner]: [
    "project:read",
    "project:write",
    "project:admin",
    "requirements:review",
    "architecture:review",
    "sources:read",
    "sources:write",
  ],
  [projectRoles.architectTechLead]: [
    "project:read",
    "project:write",
    "architecture:review",
    "sources:read",
    "sources:write",
  ],
  [projectRoles.businessAnalystCoordinator]: [
    "project:read",
    "project:write",
    "requirements:review",
    "sources:read",
    "sources:write",
  ],
  [projectRoles.developer]: ["project:read", "project:write", "sources:read"],
  [projectRoles.qa]: ["project:read", "requirements:review", "sources:read"],
  [projectRoles.clientViewerApprover]: [],
} as const satisfies Record<ProjectRole, readonly ProjectPermission[]>;

export function canProjectRole(role: ProjectRole, permission: ProjectPermission): boolean {
  return (rolePermissions[role] as readonly ProjectPermission[]).includes(permission);
}

export function projectRolesForPermission(permission: ProjectPermission): ProjectRole[] {
  return projectRoleValues.filter((role) => canProjectRole(role, permission));
}

/** `project:read` and `sources:read` are the only non-mutating permissions (module-02 §7). */
export function isMutationPermission(permission: ProjectPermission): boolean {
  return permission !== "project:read" && permission !== "sources:read";
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

// ---------------------------------------------------------------------------
// Module 2: Source Document Vault controlled values (module-02 §6, §8)
// ---------------------------------------------------------------------------

/** The three explicit source intake modes exposed on the Source Documents route (module-02 §6.1). */
export const sourceIntakeModeValues = ["file_upload", "manual_text", "reference_artifact"] as const;
export type SourceIntakeMode = (typeof sourceIntakeModeValues)[number];
export function isSourceIntakeMode(value: string): value is SourceIntakeMode {
  return sourceIntakeModeValues.includes(value as SourceIntakeMode);
}

/** `source_document.source_type` (module-02 §8.3). */
export const sourceTypeValues = ["document", "reference", "manual"] as const;
export type SourceType = (typeof sourceTypeValues)[number];
export function isSourceType(value: string): value is SourceType {
  return sourceTypeValues.includes(value as SourceType);
}

/**
 * V1 supported document formats (module-02 §3). Legacy `.doc`, `.xls`, and `.ppt` are explicitly
 * deferred and intentionally excluded.
 */
export const sourceDocumentFormatValues = [
  "pdf",
  "docx",
  "txt",
  "md",
  "xlsx",
  "csv",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "webp",
] as const;
export type SourceDocumentFormat = (typeof sourceDocumentFormatValues)[number];
export function isSourceDocumentFormat(value: string): value is SourceDocumentFormat {
  return sourceDocumentFormatValues.includes(value as SourceDocumentFormat);
}

/** `source_upload_session.status` (module-02 §8.1). */
export const uploadSessionStatusValues = [
  "created",
  "uploading",
  "uploaded",
  "confirmed",
  "canceled",
  "expired",
] as const;
export type UploadSessionStatus = (typeof uploadSessionStatusValues)[number];
export function isUploadSessionStatus(value: string): value is UploadSessionStatus {
  return uploadSessionStatusValues.includes(value as UploadSessionStatus);
}

/** `source_upload_file.role` / `source_document_file.role` (module-02 §8.2, §8.4). */
export const uploadFileRoleValues = ["primary", "attachment", "snapshot"] as const;
export type UploadFileRole = (typeof uploadFileRoleValues)[number];
export function isUploadFileRole(value: string): value is UploadFileRole {
  return uploadFileRoleValues.includes(value as UploadFileRole);
}

/** `source_document` processing state machine, including terminal alternatives (module-02 §6.9). */
export const sourceProcessingStatusValues = [
  "verification_pending",
  "scan_pending",
  "scanning",
  "extraction_pending",
  "extracting",
  "ready",
  "quarantined",
  "failed",
] as const;
export type SourceProcessingStatus = (typeof sourceProcessingStatusValues)[number];
export function isSourceProcessingStatus(value: string): value is SourceProcessingStatus {
  return sourceProcessingStatusValues.includes(value as SourceProcessingStatus);
}

/**
 * `source_document_file.scan_status` (module-02 §8.4, §9.3). Application-created manual/reference
 * manifest objects are `not_required` because malware scanning only applies to user-uploaded bytes
 * (module-02 §6.4).
 */
export const sourceFileScanStatusValues = [
  "not_required",
  "pending",
  "clean",
  "infected",
  "failed",
] as const;
export type SourceFileScanStatus = (typeof sourceFileScanStatusValues)[number];
export function isSourceFileScanStatus(value: string): value is SourceFileScanStatus {
  return sourceFileScanStatusValues.includes(value as SourceFileScanStatus);
}

/** `source_extraction.status` (module-02 §8.5). */
export const sourceExtractionStatusValues = ["pending", "running", "succeeded", "failed"] as const;
export type SourceExtractionStatus = (typeof sourceExtractionStatusValues)[number];
export function isSourceExtractionStatus(value: string): value is SourceExtractionStatus {
  return sourceExtractionStatusValues.includes(value as SourceExtractionStatus);
}

/** `reference_artifact.reference_kind` (module-02 §6.7). */
export const referenceKindValues = [
  "url",
  "screenshot_set",
  "uploaded_export",
  "article",
  "app_store_listing",
] as const;
export type ReferenceKind = (typeof referenceKindValues)[number];
export function isReferenceKind(value: string): value is ReferenceKind {
  return referenceKindValues.includes(value as ReferenceKind);
}

/** `reference_artifact.capture_method` (module-02 §6.7). */
export const referenceCaptureMethodValues = [
  "manual_paste",
  "user_uploaded_screenshot",
  "on_demand_single_page_capture",
] as const;
export type ReferenceCaptureMethod = (typeof referenceCaptureMethodValues)[number];
export function isReferenceCaptureMethod(value: string): value is ReferenceCaptureMethod {
  return referenceCaptureMethodValues.includes(value as ReferenceCaptureMethod);
}

/** `reference_artifact.access_type` (module-02 §6.7). */
export const referenceAccessTypeValues = ["public", "client_owned", "permissioned"] as const;
export type ReferenceAccessType = (typeof referenceAccessTypeValues)[number];
export function isReferenceAccessType(value: string): value is ReferenceAccessType {
  return referenceAccessTypeValues.includes(value as ReferenceAccessType);
}

/** `reference_artifact.intended_use` (module-02 §6.7). */
export const referenceIntendedUseValues = [
  "inspiration",
  "feature_parity",
  "differentiation_baseline",
] as const;
export type ReferenceIntendedUse = (typeof referenceIntendedUseValues)[number];
export function isReferenceIntendedUse(value: string): value is ReferenceIntendedUse {
  return referenceIntendedUseValues.includes(value as ReferenceIntendedUse);
}

/**
 * `reference_artifact.ip_review_status` (module-02 §6.7). Every new reference version starts
 * `not_reviewed`; clearance never carries forward across versions.
 */
export const ipReviewStatusValues = ["not_reviewed", "cleared", "restricted"] as const;
export type IpReviewStatus = (typeof ipReviewStatusValues)[number];
export function isIpReviewStatus(value: string): value is IpReviewStatus {
  return ipReviewStatusValues.includes(value as IpReviewStatus);
}
