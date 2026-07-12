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
  | "requirements:read"
  | "requirements:analyze"
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
    "requirements:read",
    "requirements:analyze",
    "requirements:review",
    "architecture:review",
    "sources:read",
    "sources:write",
  ],
  [projectRoles.projectOwner]: [
    "project:read",
    "project:write",
    "project:admin",
    "requirements:read",
    "requirements:analyze",
    "requirements:review",
    "architecture:review",
    "sources:read",
    "sources:write",
  ],
  [projectRoles.architectTechLead]: [
    "project:read",
    "project:write",
    "requirements:read",
    "requirements:analyze",
    "architecture:review",
    "sources:read",
    "sources:write",
  ],
  [projectRoles.businessAnalystCoordinator]: [
    "project:read",
    "project:write",
    "requirements:read",
    "requirements:analyze",
    "requirements:review",
    "sources:read",
    "sources:write",
  ],
  [projectRoles.developer]: ["project:read", "project:write", "requirements:read", "sources:read"],
  [projectRoles.qa]: ["project:read", "requirements:read", "requirements:review", "sources:read"],
  [projectRoles.clientViewerApprover]: [],
} as const satisfies Record<ProjectRole, readonly ProjectPermission[]>;

export function canProjectRole(role: ProjectRole, permission: ProjectPermission): boolean {
  return (rolePermissions[role] as readonly ProjectPermission[]).includes(permission);
}

export function projectRolesForPermission(permission: ProjectPermission): ProjectRole[] {
  return projectRoleValues.filter((role) => canProjectRole(role, permission));
}

/** Read permissions stay non-mutating so archived projects remain readable with least privilege. */
export function isMutationPermission(permission: ProjectPermission): boolean {
  return (
    permission !== "project:read" &&
    permission !== "requirements:read" &&
    permission !== "sources:read"
  );
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

// ---------------------------------------------------------------------------
// Module 3: AI Requirement Analyzer controlled values (module-03 §6-§13)
// ---------------------------------------------------------------------------

/** Requirement evidence grounding state. */
export const requirementEpistemicStatusValues = [
  "confirmed",
  "assumed",
  "unknown",
  "conflicting",
] as const;
export type RequirementEpistemicStatus = (typeof requirementEpistemicStatusValues)[number];
export function isRequirementEpistemicStatus(value: string): value is RequirementEpistemicStatus {
  return requirementEpistemicStatusValues.includes(value as RequirementEpistemicStatus);
}

/** Deterministic confidence band; raw model percentages are never exposed. */
export const confidenceBandValues = ["low", "medium", "high"] as const;
export type ConfidenceBand = (typeof confidenceBandValues)[number];
export function isConfidenceBand(value: string): value is ConfidenceBand {
  return confidenceBandValues.includes(value as ConfidenceBand);
}

/** Typed rubric signals persisted with every non-null confidence band. */
export const confidenceReasonCodeValues = [
  "verified_exact_citation",
  "multiple_source_corroboration",
  "evidence_span_complete",
  "evidence_span_ambiguous",
  "stage_agreement",
  "stage_disagreement",
  "coverage_addressed",
  "inference_basis_present",
  "supporting_context_citation_verified",
  "supporting_context_citation_missing",
] as const;
export type ConfidenceReasonCode = (typeof confidenceReasonCodeValues)[number];
export function isConfidenceReasonCode(value: string): value is ConfidenceReasonCode {
  return confidenceReasonCodeValues.includes(value as ConfidenceReasonCode);
}

/** Top-level run mode. */
export const analysisRunModeValues = ["fresh", "replay", "reprocess", "retry"] as const;
export type AnalysisRunMode = (typeof analysisRunModeValues)[number];
export function isAnalysisRunMode(value: string): value is AnalysisRunMode {
  return analysisRunModeValues.includes(value as AnalysisRunMode);
}

/** `requirement_analysis_run.status` state machine values. */
export const analysisRunStatusValues = [
  "requested",
  "snapshotting",
  "queued",
  "running",
  "waiting_retry",
  "completed",
  "completed_with_warnings",
  "failed",
  "canceled",
] as const;
export type AnalysisRunStatus = (typeof analysisRunStatusValues)[number];
export function isAnalysisRunStatus(value: string): value is AnalysisRunStatus {
  return analysisRunStatusValues.includes(value as AnalysisRunStatus);
}

/** `requirement_analysis_stage.status` state machine values. */
export const analysisStageStatusValues = [
  "pending",
  "running",
  "waiting_retry",
  "completed",
  "completed_with_warnings",
  "failed",
  "canceled",
  "skipped",
] as const;
export type AnalysisStageStatus = (typeof analysisStageStatusValues)[number];
export function isAnalysisStageStatus(value: string): value is AnalysisStageStatus {
  return analysisStageStatusValues.includes(value as AnalysisStageStatus);
}

/** `requirement_analysis_stage.kind` values. */
export const analysisStageKindValues = [
  "freeze_snapshot",
  "batch_planning",
  "confirmed_extraction",
  "citation_verification",
  "reference_feature_extraction",
  "normalization_deduplication",
  "conflict_detection",
  "coverage_analysis",
  "delivery_item_extraction",
  "question_generation",
  "finalize_review_package",
] as const;
export type AnalysisStageKind = (typeof analysisStageKindValues)[number];
export function isAnalysisStageKind(value: string): value is AnalysisStageKind {
  return analysisStageKindValues.includes(value as AnalysisStageKind);
}

/** Batch statuses mirror stage statuses for run-local execution tracking. */
export const analysisBatchStatusValues = analysisStageStatusValues;
export type AnalysisBatchStatus = AnalysisStageStatus;
export function isAnalysisBatchStatus(value: string): value is AnalysisBatchStatus {
  return isAnalysisStageStatus(value);
}

/** `organization_ai_provider_policy.status`. */
export const providerPolicyStatusValues = ["draft", "approved", "inactive"] as const;
export type ProviderPolicyStatus = (typeof providerPolicyStatusValues)[number];
export function isProviderPolicyStatus(value: string): value is ProviderPolicyStatus {
  return providerPolicyStatusValues.includes(value as ProviderPolicyStatus);
}

/** Deployment-approved provider data handling modes. */
export const providerDataRetentionModeValues = [
  "provider_default",
  "no_training",
  "zero_retention",
] as const;
export type ProviderDataRetentionMode = (typeof providerDataRetentionModeValues)[number];
export function isProviderDataRetentionMode(value: string): value is ProviderDataRetentionMode {
  return providerDataRetentionModeValues.includes(value as ProviderDataRetentionMode);
}

/** Allowlisted provider identifiers for policy/config selection. */
export const analysisProviderValues = [
  "openai",
  "anthropic",
  "openai-compatible",
  "local",
] as const;
export type AnalysisProvider = (typeof analysisProviderValues)[number];
export function isAnalysisProvider(value: string): value is AnalysisProvider {
  return analysisProviderValues.includes(value as AnalysisProvider);
}

/** Source inclusion/exclusion reasons returned by eligible-source preview. */
export const analysisEligibleSourceExclusionReasonValues = [
  "not_ready",
  "archived",
  "non_head_version",
  "missing_successful_extraction",
  "reference_not_cleared",
  "reference_feature_extraction_disabled",
] as const;
export type AnalysisEligibleSourceExclusionReason =
  (typeof analysisEligibleSourceExclusionReasonValues)[number];
export function isAnalysisEligibleSourceExclusionReason(
  value: string,
): value is AnalysisEligibleSourceExclusionReason {
  return analysisEligibleSourceExclusionReasonValues.includes(
    value as AnalysisEligibleSourceExclusionReason,
  );
}

/** Shared artifact origin vocabulary across requirements, citations, and delivery items. */
export const analysisArtifactOriginValues = ["source", "reference", "manual"] as const;
export type AnalysisArtifactOrigin = (typeof analysisArtifactOriginValues)[number];
export function isAnalysisArtifactOrigin(value: string): value is AnalysisArtifactOrigin {
  return analysisArtifactOriginValues.includes(value as AnalysisArtifactOrigin);
}

/** Citation verification outcome from deterministic quote matching. */
export const citationVerificationStatusValues = [
  "verified_exact",
  "downgraded_fuzzy",
  "failed",
] as const;
export type CitationVerificationStatus = (typeof citationVerificationStatusValues)[number];
export function isCitationVerificationStatus(value: string): value is CitationVerificationStatus {
  return citationVerificationStatusValues.includes(value as CitationVerificationStatus);
}

/** Coverage matrix status for each fixed rubric row. */
export const coverageStatusValues = ["addressed", "partial", "absent"] as const;
export type CoverageStatus = (typeof coverageStatusValues)[number];
export function isCoverageStatus(value: string): value is CoverageStatus {
  return coverageStatusValues.includes(value as CoverageStatus);
}

/** Coverage evidence state emitted by deterministic verification and downgrade logic. */
export const coverageEvidenceStateValues = [
  "verified_citation",
  "none_found",
  "downgraded",
] as const;
export type CoverageEvidenceState = (typeof coverageEvidenceStateValues)[number];
export function isCoverageEvidenceState(value: string): value is CoverageEvidenceState {
  return coverageEvidenceStateValues.includes(value as CoverageEvidenceState);
}

/** Fixed rubric categories; exactly 18 are required before run completion. */
export const coverageCategoryKeyValues = [
  "auth_identity",
  "roles_permissions",
  "data_model_entities",
  "integrations",
  "notifications",
  "reporting_analytics",
  "admin",
  "error_handling",
  "audit_logging",
  "nfr_performance_scale_availability",
  "security_compliance",
  "deployment_environments",
  "data_migration",
  "i18n_localization",
  "accessibility",
  "backup_disaster_recovery",
  "slas",
  "support_model",
] as const;
export type CoverageCategoryKey = (typeof coverageCategoryKeyValues)[number];
export function isCoverageCategoryKey(value: string): value is CoverageCategoryKey {
  return coverageCategoryKeyValues.includes(value as CoverageCategoryKey);
}

export const coverageCategoryDescriptors = [
  { key: "auth_identity", label: "Auth/identity", order: 1 },
  { key: "roles_permissions", label: "Roles and permissions", order: 2 },
  { key: "data_model_entities", label: "Data model and entities", order: 3 },
  { key: "integrations", label: "Integrations", order: 4 },
  { key: "notifications", label: "Notifications", order: 5 },
  { key: "reporting_analytics", label: "Reporting/analytics", order: 6 },
  { key: "admin", label: "Admin", order: 7 },
  { key: "error_handling", label: "Error handling", order: 8 },
  { key: "audit_logging", label: "Audit/logging", order: 9 },
  {
    key: "nfr_performance_scale_availability",
    label: "NFRs: performance, scale, availability",
    order: 10,
  },
  { key: "security_compliance", label: "Security/compliance", order: 11 },
  { key: "deployment_environments", label: "Deployment/environments", order: 12 },
  { key: "data_migration", label: "Data migration", order: 13 },
  { key: "i18n_localization", label: "i18n/localization", order: 14 },
  { key: "accessibility", label: "Accessibility", order: 15 },
  { key: "backup_disaster_recovery", label: "Backup/DR", order: 16 },
  { key: "slas", label: "SLAs", order: 17 },
  { key: "support_model", label: "Support model", order: 18 },
] as const satisfies ReadonlyArray<{ key: CoverageCategoryKey; label: string; order: number }>;

/** Canonical requirement typing created by Module 3 analyzer stages. */
export const requirementTypeValues = [
  "functional",
  "non_functional",
  "business_rule",
  "data",
  "integration",
  "security",
  "compliance",
  "operational",
] as const;
export type RequirementType = (typeof requirementTypeValues)[number];
export function isRequirementType(value: string): value is RequirementType {
  return requirementTypeValues.includes(value as RequirementType);
}

/** MoSCoW-like requirement priority values used for analyzer output. */
export const requirementPriorityValues = [
  "must_have",
  "should_have",
  "could_have",
  "later",
] as const;
export type RequirementPriority = (typeof requirementPriorityValues)[number];
export function isRequirementPriority(value: string): value is RequirementPriority {
  return requirementPriorityValues.includes(value as RequirementPriority);
}

/** Requirement lifecycle states shared across Module 3 suggestions and Module 4 review flow. */
export const requirementLifecycleStateValues = [
  "ai_suggested",
  "under_review",
  "accepted",
  "needs_clarification",
  "rejected",
  "approved",
  "changed",
  "deprecated",
] as const;
export type RequirementLifecycleState = (typeof requirementLifecycleStateValues)[number];
export function isRequirementLifecycleState(value: string): value is RequirementLifecycleState {
  return requirementLifecycleStateValues.includes(value as RequirementLifecycleState);
}

/** Shared delivery-item vocabulary (module-03 and Module 4 handoff). */
export const deliveryItemTypeValues = [
  "question",
  "risk",
  "assumption",
  "dependency",
  "blocker",
  "scope_change_candidate",
] as const;
export type DeliveryItemType = (typeof deliveryItemTypeValues)[number];
export function isDeliveryItemType(value: string): value is DeliveryItemType {
  return deliveryItemTypeValues.includes(value as DeliveryItemType);
}

/** Module 3 delivery items are open/internal, with Module 4 controlling later lifecycle changes. */
export const deliveryItemStatusValues = ["open"] as const;
export type DeliveryItemStatus = (typeof deliveryItemStatusValues)[number];
export function isDeliveryItemStatus(value: string): value is DeliveryItemStatus {
  return deliveryItemStatusValues.includes(value as DeliveryItemStatus);
}

export const deliveryItemVisibilityValues = ["internal"] as const;
export type DeliveryItemVisibility = (typeof deliveryItemVisibilityValues)[number];
export function isDeliveryItemVisibility(value: string): value is DeliveryItemVisibility {
  return deliveryItemVisibilityValues.includes(value as DeliveryItemVisibility);
}

export const deliveryItemSeverityValues = ["low", "medium", "high"] as const;
export type DeliveryItemSeverity = (typeof deliveryItemSeverityValues)[number];
export function isDeliveryItemSeverity(value: string): value is DeliveryItemSeverity {
  return deliveryItemSeverityValues.includes(value as DeliveryItemSeverity);
}

export const deliveryItemPriorityValues = ["low", "medium", "high"] as const;
export type DeliveryItemPriority = (typeof deliveryItemPriorityValues)[number];
export function isDeliveryItemPriority(value: string): value is DeliveryItemPriority {
  return deliveryItemPriorityValues.includes(value as DeliveryItemPriority);
}

export const dependencyDirectionValues = ["internal", "external"] as const;
export type DependencyDirection = (typeof dependencyDirectionValues)[number];
export function isDependencyDirection(value: string): value is DependencyDirection {
  return dependencyDirectionValues.includes(value as DependencyDirection);
}

export const blockerSubtypeValues = ["conflict"] as const;
export type BlockerSubtype = (typeof blockerSubtypeValues)[number];
export function isBlockerSubtype(value: string): value is BlockerSubtype {
  return blockerSubtypeValues.includes(value as BlockerSubtype);
}

export const scopeChangeClassificationValues = ["scope_creep", "out_of_scope"] as const;
export type ScopeChangeClassification = (typeof scopeChangeClassificationValues)[number];
export function isScopeChangeClassification(value: string): value is ScopeChangeClassification {
  return scopeChangeClassificationValues.includes(value as ScopeChangeClassification);
}

// ---------------------------------------------------------------------------
// Module 3 delivery-item attribute contracts
// ---------------------------------------------------------------------------

export type RiskDeliveryItemAttributes = {
  category: string;
  probabilityBand: DeliveryItemSeverity;
  impactBand: DeliveryItemSeverity;
  mitigationPrompt: string;
  trigger: string;
};

export type AssumptionDeliveryItemAttributes = {
  inferenceBasis: string;
  validationNeeded: boolean;
  validationMethod: string;
};

export type DependencyDeliveryItemAttributes = {
  dependencyName: string;
  dependencyDirection: DependencyDirection;
  blockedArea: string;
  riskIfDelayed: string;
};

export type BlockerDeliveryItemAttributes = {
  subtype: "conflict";
  contradictionSummary: string;
  conflictingCitationIds: EntityId[];
  suggestedResolutionQuestion: string;
};

export type QuestionDeliveryItemAttributes = {
  questionText: string;
  whyItMatters: string;
  suggestedResponseFormat: string;
  impactIfUnanswered: string;
  linkedCoverageEntryIds: EntityId[];
  linkedRequirementIds: EntityId[];
  linkedConflictDeliveryItemIds: EntityId[];
};

export type ScopeCreepDeliveryItemAttributes = {
  classification: "scope_creep";
  changeSource: string;
  baselineImpactHypothesis: string;
  approvalNeeded: boolean;
};

export type OutOfScopeDeliveryItemAttributes = {
  classification: "out_of_scope";
  exclusionBasis: string;
  supportingRationale: string;
};

export type ScopeChangeCandidateDeliveryItemAttributes =
  | ScopeCreepDeliveryItemAttributes
  | OutOfScopeDeliveryItemAttributes;

export type DeliveryItemAttributes =
  | RiskDeliveryItemAttributes
  | AssumptionDeliveryItemAttributes
  | DependencyDeliveryItemAttributes
  | BlockerDeliveryItemAttributes
  | QuestionDeliveryItemAttributes
  | ScopeChangeCandidateDeliveryItemAttributes;

// ---------------------------------------------------------------------------
// Module 3 API-facing shared descriptors
// ---------------------------------------------------------------------------

export type AnalysisSnapshotDescriptor = {
  id: EntityId;
  snapshotHash: string;
  sourceCount: number;
  chunkCount: number;
  totalCharacterCount: number;
  eligibilityRulesVersion: string;
  createdAt: ISODateTimeString;
};

export type AnalysisProviderPolicyDescriptor = {
  providerPolicyId: EntityId;
  provider: AnalysisProvider;
  modelAlias: string;
  resolvedModelId: string;
  dataRetentionMode: ProviderDataRetentionMode;
};

export type AnalysisRunProvenanceDescriptor = {
  promptBundleVersion: string;
  promptBundleHash: string;
  schemaBundleVersion: string;
  schemaBundleHash: string;
  pipelineVersion: string;
  pipelineHash: string;
  modelPolicyHash: string;
};

export type AnalysisRunBudgetDescriptor = {
  maxUsd: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxWallClockSeconds: number;
};

export type AnalysisRunUsageDescriptor = {
  inputTokensUsed: number;
  outputTokensUsed: number;
  costUsd: number;
};

export type AnalysisRunArtifactCounts = {
  requirements: number;
  citations: number;
  coverageEntries: number;
  deliveryItems: number;
};

export type AnalysisRunSummary = {
  id: EntityId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  requestedBy: UserId;
  mode: AnalysisRunMode;
  status: AnalysisRunStatus;
  sourceSnapshotId: EntityId | null;
  replayOfRunId: EntityId | null;
  reprocessOfRunId: EntityId | null;
  retryOfRunId: EntityId | null;
  warningCodes: string[];
  failureCode: string | null;
  failureDetail: string | null;
  failureRetryable: boolean;
  failedStageId: EntityId | null;
  cancelRequestedAt: ISODateTimeString | null;
  cancelRequestedBy: UserId | null;
  cancelReason: string | null;
  startedAt: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  correlationId: string;
  providerPolicy: AnalysisProviderPolicyDescriptor;
  provenance: AnalysisRunProvenanceDescriptor;
  budgets: AnalysisRunBudgetDescriptor;
  usage: AnalysisRunUsageDescriptor;
  artifactCounts: AnalysisRunArtifactCounts;
};

export type AnalysisRunDetail = AnalysisRunSummary & {
  snapshot: AnalysisSnapshotDescriptor | null;
  readNotices: string[];
};

export type AnalysisStageDescriptor = {
  id: EntityId;
  runId: EntityId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  kind: AnalysisStageKind;
  status: AnalysisStageStatus;
  attemptNumber: number;
  idempotencyKey: string;
  inputHash: string | null;
  outputHash: string | null;
  startedAt: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
  retryAfter: ISODateTimeString | null;
  failureCode: string | null;
  failureDetail: string | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};

export type AnalysisBatchDescriptor = {
  id: EntityId;
  stageId: EntityId;
  runId: EntityId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  batchOrder: number;
  sourceChunkStartSequence: number;
  sourceChunkEndSequence: number;
  inputTokenEstimate: number;
  maxOutputTokens: number;
  status: AnalysisBatchStatus;
  attemptNumber: number;
  aiRunId: AiRunId | null;
  repairOfBatchId: EntityId | null;
  shapeOnlyRepairUsed: boolean;
  cacheKey: string | null;
  cacheHitOfBatchId: EntityId | null;
  failureCode: string | null;
  failureDetail: string | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};

export type RequirementDescriptor = {
  id: EntityId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  analysisRunId: EntityId;
  stableKey: string;
  title: string;
  description: string;
  requirementType: RequirementType;
  priority: RequirementPriority | null;
  epistemicStatus: RequirementEpistemicStatus;
  confidenceBand: ConfidenceBand | null;
  confidenceReasonCodes: ConfidenceReasonCode[];
  inferenceBasis: string | null;
  origin: AnalysisArtifactOrigin;
  lifecycleState: RequirementLifecycleState;
  dedupeGroupKey: string | null;
  parentRequirementId: EntityId | null;
  sourceSummary: string | null;
  createdByAiRunId: AiRunId;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};

export type CitationDescriptor = {
  id: EntityId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  analysisRunId: EntityId;
  requirementId: EntityId | null;
  coverageMatrixEntryId: EntityId | null;
  deliveryItemId: EntityId | null;
  sourceDocumentId: EntityId;
  sourceVersionNumber: number;
  sourceContentHash: string;
  sourceExtractionId: EntityId;
  sourceExtractionVersion: number;
  sourceChunkId: EntityId;
  sourceChunkSequence: number;
  chunkContentHash: string;
  locator: JsonObject;
  quoteTextOriginal: string;
  quoteTextNormalized: string;
  quoteHash: string;
  matchStartOffset: number;
  matchEndOffset: number;
  normalizationMode: string;
  verificationStatus: CitationVerificationStatus;
  createdByAiRunId: AiRunId;
  createdAt: ISODateTimeString;
};

export type CoverageMatrixEntryDescriptor = {
  id: EntityId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  analysisRunId: EntityId;
  categoryKey: CoverageCategoryKey;
  categoryLabel: string;
  categoryOrder: number;
  status: CoverageStatus;
  rationale: string;
  evidenceState: CoverageEvidenceState;
  questionDeliveryItemId: EntityId | null;
  createdByAiRunId: AiRunId;
  createdAt: ISODateTimeString;
};

export type DeliveryItemDescriptor = {
  id: EntityId;
  organizationId: OrganizationId;
  projectId: ProjectId;
  analysisRunId: EntityId;
  itemType: DeliveryItemType;
  title: string;
  description: string;
  epistemicStatus: RequirementEpistemicStatus;
  confidenceBand: ConfidenceBand | null;
  confidenceReasonCodes: ConfidenceReasonCode[];
  severity: DeliveryItemSeverity | null;
  priority: DeliveryItemPriority | null;
  status: DeliveryItemStatus;
  visibility: DeliveryItemVisibility;
  attributes: DeliveryItemAttributes;
  sourceRequirementId: EntityId | null;
  createdByAiRunId: AiRunId;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};
