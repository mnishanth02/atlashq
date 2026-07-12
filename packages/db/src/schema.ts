import type {
  JsonObject,
  aiReviewStatusValues as sharedAiReviewStatusValues,
  aiRunStatusValues as sharedAiRunStatusValues,
  coverageCategoryKeyValues as sharedCoverageCategoryKeyValues,
  ipReviewStatusValues as sharedIpReviewStatusValues,
  organizationRoleValues as sharedOrganizationRoleValues,
  projectPhaseValues as sharedProjectPhaseValues,
  projectPriorityValues as sharedProjectPriorityValues,
  projectRoleValues as sharedProjectRoleValues,
  projectStatusValues as sharedProjectStatusValues,
  projectTypeValues as sharedProjectTypeValues,
  projectVisibilityValues as sharedProjectVisibilityValues,
  referenceAccessTypeValues as sharedReferenceAccessTypeValues,
  referenceCaptureMethodValues as sharedReferenceCaptureMethodValues,
  referenceIntendedUseValues as sharedReferenceIntendedUseValues,
  referenceKindValues as sharedReferenceKindValues,
  sourceDocumentFormatValues as sharedSourceDocumentFormatValues,
  sourceExtractionStatusValues as sharedSourceExtractionStatusValues,
  sourceFileScanStatusValues as sharedSourceFileScanStatusValues,
  sourceIntakeModeValues as sharedSourceIntakeModeValues,
  sourceProcessingStatusValues as sharedSourceProcessingStatusValues,
  sourceTypeValues as sharedSourceTypeValues,
  uploadFileRoleValues as sharedUploadFileRoleValues,
  uploadSessionStatusValues as sharedUploadSessionStatusValues,
} from "@atlashq/types";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const postgresExtensions = ["pg_trgm", "unaccent"] as const;

export const organizationRoleValues = [
  "admin",
  "member",
] as const satisfies typeof sharedOrganizationRoleValues;
export const projectRoleValues = [
  "Admin",
  "Project Owner",
  "Architect / Tech Lead",
  "Business Analyst / Coordinator",
  "Developer",
  "QA",
  "Client Viewer / Approver",
] as const satisfies typeof sharedProjectRoleValues;
export const projectTypeValues = [
  "client",
  "internal",
] as const satisfies typeof sharedProjectTypeValues;
export const projectStatusValues = [
  "draft",
  "active",
  "on_hold",
  "completed",
  "archived",
] as const satisfies typeof sharedProjectStatusValues;
export const projectPhaseValues = [
  "intake",
  "requirements",
  "clarification",
  "baseline",
  "architecture",
  "delivery",
  "handoff",
  "closed",
] as const satisfies typeof sharedProjectPhaseValues;
export const projectPriorityValues = [
  "low",
  "medium",
  "high",
  "critical",
] as const satisfies typeof sharedProjectPriorityValues;
export const projectVisibilityValues = [
  "private",
  "organization",
] as const satisfies typeof sharedProjectVisibilityValues;
export const aiRunStatusValues = [
  "planned",
  "running",
  "succeeded",
  "failed",
] as const satisfies typeof sharedAiRunStatusValues;
export const aiReviewStatusValues = [
  "pending",
  "accepted",
  "rejected",
] as const satisfies typeof sharedAiReviewStatusValues;
export const projectMembershipStatusValues = ["invited", "active", "removed"] as const;
export const userStatusValues = ["active", "suspended", "archived"] as const;
export const betterAuthDatabaseOptions = { generateId: "uuid" } as const;

// ---------------------------------------------------------------------------
// Module 2: Source Document Vault controlled values (module-02 §6, §8; mirrored from
// @atlashq/types so the DB check constraints can never silently drift from the shared contract).
// ---------------------------------------------------------------------------

export const sourceIntakeModeValues = [
  "file_upload",
  "manual_text",
  "reference_artifact",
] as const satisfies typeof sharedSourceIntakeModeValues;
export const sourceTypeValues = [
  "document",
  "reference",
  "manual",
] as const satisfies typeof sharedSourceTypeValues;
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
] as const satisfies typeof sharedSourceDocumentFormatValues;
export const uploadSessionStatusValues = [
  "created",
  "uploading",
  "uploaded",
  "confirmed",
  "canceled",
  "expired",
] as const satisfies typeof sharedUploadSessionStatusValues;
export const uploadFileRoleValues = [
  "primary",
  "attachment",
  "snapshot",
] as const satisfies typeof sharedUploadFileRoleValues;
export const sourceProcessingStatusValues = [
  "verification_pending",
  "scan_pending",
  "scanning",
  "extraction_pending",
  "extracting",
  "ready",
  "quarantined",
  "failed",
] as const satisfies typeof sharedSourceProcessingStatusValues;
export const sourceFileScanStatusValues = [
  "not_required",
  "pending",
  "clean",
  "infected",
  "failed",
] as const satisfies typeof sharedSourceFileScanStatusValues;
export const sourceExtractionStatusValues = [
  "pending",
  "running",
  "succeeded",
  "failed",
] as const satisfies typeof sharedSourceExtractionStatusValues;
export const referenceKindValues = [
  "url",
  "screenshot_set",
  "uploaded_export",
  "article",
  "app_store_listing",
] as const satisfies typeof sharedReferenceKindValues;
export const referenceCaptureMethodValues = [
  "manual_paste",
  "user_uploaded_screenshot",
  "on_demand_single_page_capture",
] as const satisfies typeof sharedReferenceCaptureMethodValues;
export const referenceAccessTypeValues = [
  "public",
  "client_owned",
  "permissioned",
] as const satisfies typeof sharedReferenceAccessTypeValues;
export const referenceIntendedUseValues = [
  "inspiration",
  "feature_parity",
  "differentiation_baseline",
] as const satisfies typeof sharedReferenceIntendedUseValues;
export const ipReviewStatusValues = [
  "not_reviewed",
  "cleared",
  "restricted",
] as const satisfies typeof sharedIpReviewStatusValues;

/**
 * `source_upload_file.upload_status` and `source_document.ai_processing_status` are DB/worker
 * bookkeeping concerns with no shared `@atlashq/types` contract yet (unlike the enums above), the
 * same way `projectMembershipStatusValues`/`userStatusValues` are locally owned. Module 3 will
 * extend `sourceAiProcessingStatusValues` semantics; V1 only guarantees the `not_started` default
 * (module-02 §8.3).
 */
export const sourceUploadFileStatusValues = ["pending", "uploaded"] as const;
export const sourceAiProcessingStatusValues = [
  "not_started",
  "queued",
  "in_progress",
  "completed",
  "failed",
] as const;

// ---------------------------------------------------------------------------
// Module 3: AI Requirement Analyzer controlled values (module-03 §9.1). Keep DB-local arrays for
// SQL CHECK generation, and mirror shared contracts with `satisfies` where cross-layer drift would
// break API/worker persistence.
// ---------------------------------------------------------------------------

export const organizationAiProviderPolicyStatusValues = ["draft", "approved", "inactive"] as const;
export const analysisRunModeValues = ["fresh", "replay", "reprocess", "retry"] as const;
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
/** Statuses counted toward the one-active-run-per-project and org-concurrency limits (module-03 §7.2). */
export const analysisRunActiveStatusValues = [
  "requested",
  "snapshotting",
  "queued",
  "running",
  "waiting_retry",
] as const;
export const analysisRunTerminalStatusValues = [
  "completed",
  "completed_with_warnings",
  "failed",
  "canceled",
] as const;
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
export const requirementEpistemicStatusValues = [
  "confirmed",
  "assumed",
  "unknown",
  "conflicting",
] as const;
export const confidenceBandValues = ["low", "medium", "high"] as const;
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
export const requirementPriorityValues = [
  "must_have",
  "should_have",
  "could_have",
  "later",
] as const;
/** Module 3 only ever creates this single lifecycle state (module-03 §8.4); Module 4 owns later transitions. */
export const requirementLifecycleStateValues = ["ai_suggested"] as const;
export const analysisArtifactOriginValues = ["source", "reference", "manual"] as const;
export const citationVerificationStatusValues = [
  "verified_exact",
  "downgraded_fuzzy",
  "failed",
] as const;
export const coverageStatusValues = ["addressed", "partial", "absent"] as const;
export const coverageEvidenceStateValues = [
  "verified_citation",
  "none_found",
  "downgraded",
] as const;
/** Exactly 18 fixed rubric categories, in display order (module-03 §8.5). */
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
] as const satisfies typeof sharedCoverageCategoryKeyValues;
export const deliveryItemTypeValues = [
  "question",
  "risk",
  "assumption",
  "dependency",
  "blocker",
  "scope_change_candidate",
] as const;
export const deliveryItemSeverityValues = ["low", "medium", "high"] as const;
export const deliveryItemPriorityValues = ["low", "medium", "high"] as const;
/** Module 3 only ever creates open/internal delivery items (module-03 §9.8); Module 4 owns triage. */
export const deliveryItemStatusValues = ["open"] as const;
export const deliveryItemVisibilityValues = ["internal"] as const;

export type ParserManifestEntry = {
  name: string;
  version: string;
};

export type AiRunCost = {
  currency: string;
  amount: number;
  inputTokens?: number;
  outputTokens?: number;
};

function sqlTextValues(values: readonly string[]): string {
  return values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");
}

export const organization = pgTable(
  "organization",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    plan: text("plan").default("free").notNull(),
    settings: jsonb("settings").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: uuid("updated_by"),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check("organization_name_check", sql`length(btrim(${table.name})) > 0`),
    check("organization_plan_check", sql`length(btrim(${table.plan})) > 0`),
    check("organization_version_check", sql`${table.version} > 0`),
    index("organization_soft_deleted_at_idx").on(table.softDeletedAt),
  ],
);

export const user = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    organizationRole: text("organization_role").default("member").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: uuid("updated_by"),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check(
      "user_organization_role_check",
      sql.raw(`"organization_role" in (${sqlTextValues(organizationRoleValues)})`),
    ),
    check("user_status_check", sql.raw(`"status" in (${sqlTextValues(userStatusValues)})`)),
    check("user_version_check", sql`${table.version} > 0`),
    index("user_organization_status_idx").on(table.organizationId, table.status),
    index("user_created_by_idx").on(table.createdBy),
    index("user_updated_by_idx").on(table.updatedBy),
    index("user_soft_deleted_at_idx").on(table.softDeletedAt),
  ],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_expires_at_idx").on(table.expiresAt),
  ],
);

export const account = pgTable(
  "account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_uidx").on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
  ],
);

export const rateLimit = pgTable("rate_limit", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const client = pgTable(
  "client",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    email: text("email"),
    notes: text("notes"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check("client_name_check", sql`length(btrim(${table.name})) > 0`),
    check("client_status_check", sql`length(btrim(${table.status})) > 0`),
    check("client_version_check", sql`${table.version} > 0`),
    index("client_organization_status_idx").on(table.organizationId, table.status),
    index("client_created_by_idx").on(table.createdBy),
    index("client_updated_by_idx").on(table.updatedBy),
    index("client_soft_deleted_at_idx").on(table.softDeletedAt),
    index("client_name_trgm_idx").using("gin", table.name.asc().op("gin_trgm_ops")),
  ],
);

export const project = pgTable(
  "project",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => client.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    status: text("status").default("draft").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    techLeadId: uuid("tech_lead_id").references(() => user.id, { onDelete: "set null" }),
    businessOwnerId: uuid("business_owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    currentPhase: text("current_phase").default("intake").notNull(),
    tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
    priority: text("priority").default("medium").notNull(),
    visibility: text("visibility").default("organization").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check("project_name_check", sql`length(btrim(${table.name})) > 0`),
    check("project_type_check", sql.raw(`"type" in (${sqlTextValues(projectTypeValues)})`)),
    check("project_status_check", sql.raw(`"status" in (${sqlTextValues(projectStatusValues)})`)),
    check(
      "project_current_phase_check",
      sql.raw(`"current_phase" in (${sqlTextValues(projectPhaseValues)})`),
    ),
    check(
      "project_priority_check",
      sql.raw(`"priority" in (${sqlTextValues(projectPriorityValues)})`),
    ),
    check(
      "project_visibility_check",
      sql.raw(`"visibility" in (${sqlTextValues(projectVisibilityValues)})`),
    ),
    check(
      "project_client_type_check",
      sql`((${table.type} = 'client' and ${table.clientId} is not null) or (${table.type} = 'internal' and ${table.clientId} is null))`,
    ),
    check("project_version_check", sql`${table.version} > 0`),
    index("project_organization_status_idx").on(table.organizationId, table.status),
    index("project_client_id_idx").on(table.clientId),
    index("project_owner_id_idx").on(table.ownerId),
    index("project_tech_lead_id_idx").on(table.techLeadId),
    index("project_business_owner_id_idx").on(table.businessOwnerId),
    index("project_created_by_idx").on(table.createdBy),
    index("project_updated_by_idx").on(table.updatedBy),
    index("project_soft_deleted_at_idx").on(table.softDeletedAt),
    index("project_target_date_idx").on(table.targetDate),
    index("project_tags_idx").using("gin", table.tags),
    index("project_name_trgm_idx").using("gin", table.name.asc().op("gin_trgm_ops")),
    index("project_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.name} || ' ' || coalesce(${table.description}, ''))`,
    ),
  ],
);

export const projectMembership = pgTable(
  "project_membership",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    status: text("status").default("invited").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    invitedBy: uuid("invited_by").references(() => user.id, { onDelete: "set null" }),
    addedAt: timestamp("added_at", { withTimezone: true }),
    addedBy: uuid("added_by").references(() => user.id, { onDelete: "set null" }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check(
      "project_membership_role_check",
      sql.raw(`"role" in (${sqlTextValues(projectRoleValues)})`),
    ),
    check(
      "project_membership_status_check",
      sql.raw(`"status" in (${sqlTextValues(projectMembershipStatusValues)})`),
    ),
    check("project_membership_version_check", sql`${table.version} > 0`),
    index("project_membership_organization_id_idx").on(table.organizationId),
    index("project_membership_project_status_idx").on(table.projectId, table.status),
    index("project_membership_user_status_idx").on(table.userId, table.status),
    index("project_membership_invited_by_idx").on(table.invitedBy),
    index("project_membership_added_by_idx").on(table.addedBy),
    index("project_membership_created_by_idx").on(table.createdBy),
    index("project_membership_updated_by_idx").on(table.updatedBy),
    index("project_membership_soft_deleted_at_idx").on(table.softDeletedAt),
    uniqueIndex("project_membership_active_uidx")
      .on(table.projectId, table.userId)
      .where(sql`${table.softDeletedAt} is null and ${table.status} <> 'removed'`),
  ],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
    before: jsonb("before").$type<JsonObject>(),
    after: jsonb("after").$type<JsonObject>(),
    correlationId: text("correlation_id").notNull(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("audit_event_action_check", sql`length(btrim(${table.action})) > 0`),
    check("audit_event_entity_type_check", sql`length(btrim(${table.entityType})) > 0`),
    check("audit_event_correlation_id_check", sql`length(btrim(${table.correlationId})) > 0`),
    index("audit_event_organization_at_idx").on(table.organizationId, table.at.desc()),
    index("audit_event_actor_id_idx").on(table.actorId),
    index("audit_event_project_at_idx").on(table.projectId, table.at.desc()),
    index("audit_event_entity_at_idx").on(table.entityType, table.entityId, table.at.desc()),
    index("audit_event_correlation_id_idx").on(table.correlationId),
  ],
);

export const traceabilityLink = pgTable(
  "traceability_link",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    fromType: text("from_type").notNull(),
    fromId: uuid("from_id").notNull(),
    toType: text("to_type").notNull(),
    toId: uuid("to_id").notNull(),
    relation: text("relation").notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("traceability_link_from_type_check", sql`length(btrim(${table.fromType})) > 0`),
    check("traceability_link_to_type_check", sql`length(btrim(${table.toType})) > 0`),
    check("traceability_link_relation_check", sql`length(btrim(${table.relation})) > 0`),
    index("traceability_link_from_idx").on(table.organizationId, table.fromType, table.fromId),
    index("traceability_link_to_idx").on(table.organizationId, table.toType, table.toId),
    index("traceability_link_created_by_idx").on(table.createdBy),
    uniqueIndex("traceability_link_relation_uidx").on(
      table.organizationId,
      table.fromType,
      table.fromId,
      table.toType,
      table.toId,
      table.relation,
    ),
  ],
);

export const aiRun = pgTable(
  "ai_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    agent: text("agent").notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputArtifactVersions: text("input_artifact_versions")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    output: jsonb("output").$type<JsonObject>(),
    runStatus: text("run_status").default("planned").notNull(),
    cost: jsonb("cost").$type<AiRunCost>(),
    reviewedBy: uuid("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewStatus: text("review_status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("ai_run_agent_check", sql`length(btrim(${table.agent})) > 0`),
    check("ai_run_model_check", sql`length(btrim(${table.model})) > 0`),
    check("ai_run_provider_check", sql`length(btrim(${table.provider})) > 0`),
    check("ai_run_prompt_version_check", sql`length(btrim(${table.promptVersion})) > 0`),
    check("ai_run_status_check", sql.raw(`"run_status" in (${sqlTextValues(aiRunStatusValues)})`)),
    check(
      "ai_run_review_status_check",
      sql.raw(`"review_status" in (${sqlTextValues(aiReviewStatusValues)})`),
    ),
    index("ai_run_organization_created_at_idx").on(table.organizationId, table.createdAt.desc()),
    index("ai_run_project_status_idx").on(table.projectId, table.runStatus, table.reviewStatus),
    index("ai_run_reviewed_by_idx").on(table.reviewedBy),
  ],
);

// ---------------------------------------------------------------------------
// Module 2: Source Document Vault (module-02 §8)
//
// `source_document`, `source_document_file`, `source_extraction`, `source_chunk`, and
// `reference_artifact` are confirmed source truth and are archive-only: database triggers added
// in the hand-written guard migration reject DELETE/TRUNCATE outright and reject mutation of
// identity/content/version-ancestry columns, permitting only the explicit lifecycle/processing/
// metadata/review columns documented on each table below. `source_upload_session` and
// `source_upload_file` are operational/expiring and remain fully deletable for expiry cleanup.
// ---------------------------------------------------------------------------

/** Operational, expiring, deletable intake record for binary/reference uploads (module-02 §8.1). */
export const sourceUploadSession = pgTable(
  "source_upload_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    intakeMode: text("intake_mode").notNull(),
    metadataDraft: jsonb("metadata_draft").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    supersedesId: uuid("supersedes_id").references((): AnyPgColumn => sourceDocument.id, {
      onDelete: "restrict",
    }),
    expectedContentHash: text("expected_content_hash").notNull(),
    duplicateMatchIds: uuid("duplicate_match_ids").array().default(sql`ARRAY[]::uuid[]`).notNull(),
    duplicateAcknowledgedAt: timestamp("duplicate_acknowledged_at", { withTimezone: true }),
    duplicateAcknowledgedBy: uuid("duplicate_acknowledged_by").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status").default("created").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdSourceId: uuid("created_source_id").references((): AnyPgColumn => sourceDocument.id, {
      onDelete: "restrict",
    }),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "source_upload_session_intake_mode_check",
      sql.raw(`"intake_mode" in (${sqlTextValues(sourceIntakeModeValues)})`),
    ),
    check(
      "source_upload_session_status_check",
      sql.raw(`"status" in (${sqlTextValues(uploadSessionStatusValues)})`),
    ),
    check(
      "source_upload_session_expected_content_hash_check",
      sql`${table.expectedContentHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "source_upload_session_idempotency_key_check",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    index("source_upload_session_organization_project_status_idx").on(
      table.organizationId,
      table.projectId,
      table.status,
    ),
    index("source_upload_session_project_id_idx").on(table.projectId),
    index("source_upload_session_expires_at_idx").on(table.expiresAt),
    index("source_upload_session_actor_status_idx").on(table.actorId, table.status),
    index("source_upload_session_supersedes_id_idx").on(table.supersedesId),
    index("source_upload_session_created_source_id_idx").on(table.createdSourceId),
    index("source_upload_session_duplicate_acknowledged_by_idx").on(table.duplicateAcknowledgedBy),
    uniqueIndex("source_upload_session_idempotency_key_uidx").on(table.idempotencyKey),
  ],
);

/** Child rows for one regular file or the ordered files of a screenshot-set (module-02 §8.2). */
export const sourceUploadFile = pgTable(
  "source_upload_file",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadSessionId: uuid("upload_session_id")
      .notNull()
      .references(() => sourceUploadSession.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    role: text("role").notNull(),
    originalFileName: text("original_file_name").notNull(),
    normalizedFileName: text("normalized_file_name").notNull(),
    declaredMimeType: text("declared_mime_type").notNull(),
    extension: text("extension").notNull(),
    expectedByteSize: bigint("expected_byte_size", { mode: "number" }).notNull(),
    expectedSha256: text("expected_sha256").notNull(),
    objectKey: text("object_key").notNull(),
    uploadStatus: text("upload_status").default("pending").notNull(),
    objectStoreMetadata: jsonb("object_store_metadata").$type<JsonObject>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("source_upload_file_ordinal_check", sql`${table.ordinal} >= 0`),
    check("source_upload_file_expected_byte_size_check", sql`${table.expectedByteSize} > 0`),
    check(
      "source_upload_file_expected_sha256_check",
      sql`${table.expectedSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "source_upload_file_role_check",
      sql.raw(`"role" in (${sqlTextValues(uploadFileRoleValues)})`),
    ),
    check(
      "source_upload_file_upload_status_check",
      sql.raw(`"upload_status" in (${sqlTextValues(sourceUploadFileStatusValues)})`),
    ),
    uniqueIndex("source_upload_file_session_ordinal_uidx").on(table.uploadSessionId, table.ordinal),
    uniqueIndex("source_upload_file_object_key_uidx").on(table.objectKey),
  ],
);

/** Canonical immutable source-version record; confirmed evidence, archive-only (module-02 §8.3). */
export const sourceDocument = pgTable(
  "source_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    lineageId: uuid("lineage_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    supersedesId: uuid("supersedes_id").references((): AnyPgColumn => sourceDocument.id, {
      onDelete: "restrict",
    }),
    sourceType: text("source_type").notNull(),
    documentFormat: text("document_format"),
    title: text("title").notNull(),
    notes: text("notes"),
    tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
    provenanceDate: timestamp("provenance_date", { withTimezone: true }),
    contentHash: text("content_hash").notNull(),
    duplicateAcknowledgedMatchIds: uuid("duplicate_acknowledged_match_ids")
      .array()
      .default(sql`ARRAY[]::uuid[]`)
      .notNull(),
    duplicateAcknowledgedAt: timestamp("duplicate_acknowledged_at", { withTimezone: true }),
    duplicateAcknowledgedBy: uuid("duplicate_acknowledged_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    processingStatus: text("processing_status").default("verification_pending").notNull(),
    aiProcessingStatus: text("ai_processing_status").default("not_started").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => user.id, { onDelete: "set null" }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check("source_document_title_check", sql`length(btrim(${table.title})) > 0`),
    check(
      "source_document_source_type_check",
      sql.raw(`"source_type" in (${sqlTextValues(sourceTypeValues)})`),
    ),
    check(
      "source_document_document_format_check",
      sql.raw(
        `"document_format" is null or "document_format" in (${sqlTextValues(sourceDocumentFormatValues)})`,
      ),
    ),
    check(
      "source_document_document_format_presence_check",
      sql`((${table.sourceType} = 'document' and ${table.documentFormat} is not null) or (${table.sourceType} <> 'document' and ${table.documentFormat} is null))`,
    ),
    check(
      "source_document_processing_status_check",
      sql.raw(`"processing_status" in (${sqlTextValues(sourceProcessingStatusValues)})`),
    ),
    check(
      "source_document_ai_processing_status_check",
      sql.raw(`"ai_processing_status" in (${sqlTextValues(sourceAiProcessingStatusValues)})`),
    ),
    check("source_document_content_hash_check", sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
    check("source_document_version_number_check", sql`${table.versionNumber} > 0`),
    check("source_document_version_check", sql`${table.version} > 0`),
    uniqueIndex("source_document_lineage_version_uidx").on(table.lineageId, table.versionNumber),
    uniqueIndex("source_document_supersedes_id_uidx")
      .on(table.supersedesId)
      .where(sql`${table.supersedesId} is not null`),
    index("source_document_organization_status_idx").on(
      table.organizationId,
      table.processingStatus,
    ),
    index("source_document_project_status_idx").on(
      table.projectId,
      table.processingStatus,
      table.archivedAt,
    ),
    index("source_document_project_source_type_idx").on(table.projectId, table.sourceType),
    index("source_document_project_content_hash_idx").on(table.projectId, table.contentHash),
    index("source_document_created_by_idx").on(table.createdBy),
    index("source_document_updated_by_idx").on(table.updatedBy),
    index("source_document_archived_by_idx").on(table.archivedBy),
    index("source_document_duplicate_acknowledged_by_idx").on(table.duplicateAcknowledgedBy),
    index("source_document_title_trgm_idx").using("gin", table.title.asc().op("gin_trgm_ops")),
  ],
);

/** Immutable original evidence object belonging to a confirmed source (module-02 §8.4). */
export const sourceDocumentFile = pgTable(
  "source_document_file",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocument.id, { onDelete: "restrict" }),
    ordinal: integer("ordinal").notNull(),
    role: text("role").notNull(),
    originalFileName: text("original_file_name").notNull(),
    downloadFileName: text("download_file_name").notNull(),
    format: text("format").notNull(),
    declaredMimeType: text("declared_mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    objectKey: text("object_key").notNull(),
    objectVersionId: text("object_version_id").notNull(),
    scanStatus: text("scan_status").default("not_required").notNull(),
    scanResult: jsonb("scan_result").$type<JsonObject>(),
    scanSignatureVersion: text("scan_signature_version"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("source_document_file_ordinal_check", sql`${table.ordinal} >= 0`),
    check("source_document_file_byte_size_check", sql`${table.byteSize} > 0`),
    check("source_document_file_sha256_check", sql`${table.sha256} ~ '^[a-f0-9]{64}$'`),
    check(
      "source_document_file_format_check",
      sql.raw(`"format" in (${sqlTextValues(sourceDocumentFormatValues)})`),
    ),
    check(
      "source_document_file_role_check",
      sql.raw(`"role" in (${sqlTextValues(uploadFileRoleValues)})`),
    ),
    check(
      "source_document_file_scan_status_check",
      sql.raw(`"scan_status" in (${sqlTextValues(sourceFileScanStatusValues)})`),
    ),
    uniqueIndex("source_document_file_document_ordinal_uidx").on(
      table.sourceDocumentId,
      table.ordinal,
    ),
    uniqueIndex("source_document_file_object_key_uidx").on(table.objectKey),
    index("source_document_file_scan_status_idx").on(table.scanStatus),
  ],
);

/** Append-only deterministic extraction version for a source document (module-02 §8.5). */
export const sourceExtraction = pgTable(
  "source_extraction",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocument.id, { onDelete: "restrict" }),
    extractionVersion: integer("extraction_version").notNull(),
    status: text("status").default("pending").notNull(),
    parserManifest: jsonb("parser_manifest")
      .$type<ParserManifestEntry[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    chunkerVersion: text("chunker_version").notNull(),
    extractedTextHash: text("extracted_text_hash"),
    previewObjectKey: text("preview_object_key"),
    previewObjectVersionId: text("preview_object_version_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("source_extraction_version_check", sql`${table.extractionVersion} > 0`),
    check(
      "source_extraction_status_check",
      sql.raw(`"status" in (${sqlTextValues(sourceExtractionStatusValues)})`),
    ),
    check(
      "source_extraction_extracted_text_hash_check",
      sql`${table.extractedTextHash} is null or ${table.extractedTextHash} ~ '^[a-f0-9]{64}$'`,
    ),
    uniqueIndex("source_extraction_document_version_uidx").on(
      table.sourceDocumentId,
      table.extractionVersion,
    ),
    index("source_extraction_document_status_idx").on(table.sourceDocumentId, table.status),
  ],
);

/** Append-only child chunk of an extraction; carries deterministic locator (module-02 §8.6). */
export const sourceChunk = pgTable(
  "source_chunk",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocument.id, { onDelete: "restrict" }),
    sourceExtractionId: uuid("source_extraction_id")
      .notNull()
      .references(() => sourceExtraction.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    content: text("content").notNull(),
    characterCount: integer("character_count").notNull(),
    contentHash: text("content_hash").notNull(),
    locator: jsonb("locator").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("source_chunk_sequence_check", sql`${table.sequence} >= 0`),
    check("source_chunk_character_count_check", sql`${table.characterCount} >= 0`),
    check("source_chunk_content_hash_check", sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
    uniqueIndex("source_chunk_extraction_sequence_uidx").on(
      table.sourceExtractionId,
      table.sequence,
    ),
    index("source_chunk_organization_id_idx").on(table.organizationId),
    index("source_chunk_project_id_idx").on(table.projectId),
    index("source_chunk_source_document_id_idx").on(table.sourceDocumentId),
  ],
);

/** One-to-one companion for `source_type = 'reference'`; requires attestation (module-02 §8.7). */
export const referenceArtifact = pgTable(
  "reference_artifact",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocument.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    referenceKind: text("reference_kind").notNull(),
    captureMethod: text("capture_method").notNull(),
    accessType: text("access_type").notNull(),
    intendedUse: text("intended_use").notNull(),
    sourceUrl: text("source_url"),
    ipReviewStatus: text("ip_review_status").default("not_reviewed").notNull(),
    ipReviewReason: text("ip_review_reason"),
    ipReviewedBy: uuid("ip_reviewed_by").references(() => user.id, { onDelete: "set null" }),
    ipReviewedAt: timestamp("ip_reviewed_at", { withTimezone: true }),
    attestationText: text("attestation_text").notNull(),
    attestationVersion: text("attestation_version").notNull(),
    attestedBy: uuid("attested_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    attestedAt: timestamp("attested_at", { withTimezone: true }).notNull(),
    auditEventId: uuid("audit_event_id").references(() => auditEvent.id, { onDelete: "set null" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "reference_artifact_attestation_text_check",
      sql`length(btrim(${table.attestationText})) > 0`,
    ),
    check(
      "reference_artifact_attestation_version_check",
      sql`length(btrim(${table.attestationVersion})) > 0`,
    ),
    check(
      "reference_artifact_reference_kind_check",
      sql.raw(`"reference_kind" in (${sqlTextValues(referenceKindValues)})`),
    ),
    check(
      "reference_artifact_capture_method_check",
      sql.raw(`"capture_method" in (${sqlTextValues(referenceCaptureMethodValues)})`),
    ),
    check(
      "reference_artifact_access_type_check",
      sql.raw(`"access_type" in (${sqlTextValues(referenceAccessTypeValues)})`),
    ),
    check(
      "reference_artifact_intended_use_check",
      sql.raw(`"intended_use" in (${sqlTextValues(referenceIntendedUseValues)})`),
    ),
    check(
      "reference_artifact_ip_review_status_check",
      sql.raw(`"ip_review_status" in (${sqlTextValues(ipReviewStatusValues)})`),
    ),
    check(
      "reference_artifact_capture_source_url_check",
      sql`(${table.captureMethod} <> 'on_demand_single_page_capture') or (${table.sourceUrl} is not null)`,
    ),
    uniqueIndex("reference_artifact_source_document_id_uidx").on(table.sourceDocumentId),
    index("reference_artifact_project_ip_review_status_idx").on(
      table.projectId,
      table.ipReviewStatus,
    ),
    index("reference_artifact_organization_id_idx").on(table.organizationId),
    index("reference_artifact_attested_by_idx").on(table.attestedBy),
    index("reference_artifact_ip_reviewed_by_idx").on(table.ipReviewedBy),
    index("reference_artifact_audit_event_id_idx").on(table.auditEventId),
  ],
);

// ---------------------------------------------------------------------------
// Module 3: AI Requirement Analyzer (module-03 §7, §9). Additive to Module 1/2: no Module 2
// source/extraction/chunk/reference table is altered here, only read via restrict-delete FKs.
// `requirement`, `citation`, `coverage_matrix_entry`, and the snapshot header/source/file/chunk
// tables are first-class governance rows, not `ai_run.output` reproducibility snapshots.
// ---------------------------------------------------------------------------

/** Organization-level provider/model approval gate; safe-disabled until explicitly approved (module-03 §7.1). */
export const organizationAiProviderPolicy = pgTable(
  "organization_ai_provider_policy",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    policyName: text("policy_name").notNull(),
    modelAlias: text("model_alias").notNull(),
    resolvedModelId: text("resolved_model_id").notNull(),
    dataRetentionMode: text("data_retention_mode").notNull(),
    status: text("status").default("draft").notNull(),
    approvedForRequirementAnalysis: boolean("approved_for_requirement_analysis")
      .default(false)
      .notNull(),
    approvedBy: uuid("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNote: text("approval_note"),
    providerTermsSnapshotHash: text("provider_terms_snapshot_hash"),
    maxUsdPerRun: numeric("max_usd_per_run", { precision: 12, scale: 4, mode: "number" })
      .default(3)
      .notNull(),
    maxInputTokensPerRun: integer("max_input_tokens_per_run").default(300_000).notNull(),
    maxOutputTokensPerRun: integer("max_output_tokens_per_run").default(30_000).notNull(),
    maxWallClockSeconds: integer("max_wall_clock_seconds").default(1800).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check(
      "organization_ai_provider_policy_provider_check",
      sql`length(btrim(${table.provider})) > 0`,
    ),
    check(
      "organization_ai_provider_policy_policy_name_check",
      sql`length(btrim(${table.policyName})) > 0`,
    ),
    check(
      "organization_ai_provider_policy_model_alias_check",
      sql`length(btrim(${table.modelAlias})) > 0`,
    ),
    check(
      "organization_ai_provider_policy_resolved_model_id_check",
      sql`length(btrim(${table.resolvedModelId})) > 0`,
    ),
    check(
      "organization_ai_provider_policy_data_retention_mode_check",
      sql`length(btrim(${table.dataRetentionMode})) > 0`,
    ),
    check(
      "organization_ai_provider_policy_status_check",
      sql.raw(`"status" in (${sqlTextValues(organizationAiProviderPolicyStatusValues)})`),
    ),
    // Approval fields are nullable only in `draft`; `inactive` retains its prior approval history.
    check(
      "organization_ai_provider_policy_approval_fields_check",
      sql`(${table.status} = 'draft') or (${table.approvedBy} is not null and ${table.approvedAt} is not null and ${table.approvalNote} is not null)`,
    ),
    // `approved_for_requirement_analysis` is true if and only if the policy is currently approved;
    // this is what makes "no approved policy" the enforced safe-disabled default.
    check(
      "organization_ai_provider_policy_approved_flag_check",
      sql`(${table.status} = 'approved') = ${table.approvedForRequirementAnalysis}`,
    ),
    check("organization_ai_provider_policy_max_usd_check", sql`${table.maxUsdPerRun} > 0`),
    check(
      "organization_ai_provider_policy_max_input_tokens_check",
      sql`${table.maxInputTokensPerRun} > 0`,
    ),
    check(
      "organization_ai_provider_policy_max_output_tokens_check",
      sql`${table.maxOutputTokensPerRun} > 0`,
    ),
    check(
      "organization_ai_provider_policy_max_wall_clock_check",
      sql`${table.maxWallClockSeconds} > 0`,
    ),
    check("organization_ai_provider_policy_version_check", sql`${table.version} > 0`),
    uniqueIndex("organization_ai_provider_policy_org_name_uidx").on(
      table.organizationId,
      table.policyName,
    ),
    index("organization_ai_provider_policy_org_status_idx").on(table.organizationId, table.status),
    index("organization_ai_provider_policy_approved_by_idx").on(table.approvedBy),
    index("organization_ai_provider_policy_created_by_idx").on(table.createdBy),
    index("organization_ai_provider_policy_updated_by_idx").on(table.updatedBy),
  ],
);

/** Top-level user-visible analysis run; freezes exactly one provider/model policy (module-03 §9.2). */
export const requirementAnalysisRun = pgTable(
  "requirement_analysis_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    mode: text("mode").notNull(),
    status: text("status").default("requested").notNull(),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    cancelRequestedBy: uuid("cancel_requested_by").references(() => user.id, {
      onDelete: "set null",
    }),
    cancelReason: text("cancel_reason"),
    sourceSnapshotId: uuid("source_snapshot_id").references(
      (): AnyPgColumn => requirementAnalysisSnapshot.id,
      { onDelete: "restrict" },
    ),
    replayOfRunId: uuid("replay_of_run_id").references(
      (): AnyPgColumn => requirementAnalysisRun.id,
      { onDelete: "restrict" },
    ),
    reprocessOfRunId: uuid("reprocess_of_run_id").references(
      (): AnyPgColumn => requirementAnalysisRun.id,
      { onDelete: "restrict" },
    ),
    retryOfRunId: uuid("retry_of_run_id").references((): AnyPgColumn => requirementAnalysisRun.id, {
      onDelete: "restrict",
    }),
    providerPolicyId: uuid("provider_policy_id")
      .notNull()
      .references(() => organizationAiProviderPolicy.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    modelAlias: text("model_alias").notNull(),
    resolvedModelId: text("resolved_model_id").notNull(),
    providerDataRetentionMode: text("provider_data_retention_mode").notNull(),
    promptBundleVersion: text("prompt_bundle_version").notNull(),
    promptBundleHash: text("prompt_bundle_hash").notNull(),
    schemaBundleVersion: text("schema_bundle_version").notNull(),
    schemaBundleHash: text("schema_bundle_hash").notNull(),
    pipelineVersion: text("pipeline_version").notNull(),
    pipelineHash: text("pipeline_hash").notNull(),
    modelPolicyHash: text("model_policy_hash").notNull(),
    maxUsd: numeric("max_usd", { precision: 12, scale: 4, mode: "number" }).notNull(),
    maxInputTokens: integer("max_input_tokens").notNull(),
    maxOutputTokens: integer("max_output_tokens").notNull(),
    maxWallClockSeconds: integer("max_wall_clock_seconds").notNull(),
    inputTokensUsed: integer("input_tokens_used").default(0).notNull(),
    outputTokensUsed: integer("output_tokens_used").default(0).notNull(),
    costUsd: numeric("cost_usd", { precision: 12, scale: 4, mode: "number" }).default(0).notNull(),
    artifactCounts: jsonb("artifact_counts")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    warningCodes: text("warning_codes").array().default(sql`ARRAY[]::text[]`).notNull(),
    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
    failureRetryable: boolean("failure_retryable"),
    failedStageId: uuid("failed_stage_id").references(
      (): AnyPgColumn => requirementAnalysisStage.id,
      { onDelete: "set null" },
    ),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    correlationId: text("correlation_id").notNull(),
  },
  (table) => [
    check(
      "requirement_analysis_run_mode_check",
      sql.raw(`"mode" in (${sqlTextValues(analysisRunModeValues)})`),
    ),
    check(
      "requirement_analysis_run_status_check",
      sql.raw(`"status" in (${sqlTextValues(analysisRunStatusValues)})`),
    ),
    check(
      "requirement_analysis_run_resolved_model_id_check",
      sql`length(btrim(${table.resolvedModelId})) > 0`,
    ),
    check(
      "requirement_analysis_run_correlation_id_check",
      sql`length(btrim(${table.correlationId})) > 0`,
    ),
    check("requirement_analysis_run_max_usd_check", sql`${table.maxUsd} > 0`),
    check("requirement_analysis_run_max_input_tokens_check", sql`${table.maxInputTokens} > 0`),
    check("requirement_analysis_run_max_output_tokens_check", sql`${table.maxOutputTokens} > 0`),
    check("requirement_analysis_run_max_wall_clock_check", sql`${table.maxWallClockSeconds} > 0`),
    check("requirement_analysis_run_input_tokens_used_check", sql`${table.inputTokensUsed} >= 0`),
    check("requirement_analysis_run_output_tokens_used_check", sql`${table.outputTokensUsed} >= 0`),
    check("requirement_analysis_run_cost_usd_check", sql`${table.costUsd} >= 0`),
    // Exactly one mode-appropriate lineage link may be set, matching that run's mode.
    check(
      "requirement_analysis_run_mode_lineage_check",
      sql`(${table.mode} = 'fresh' and ${table.replayOfRunId} is null and ${table.reprocessOfRunId} is null and ${table.retryOfRunId} is null)
        or (${table.mode} = 'replay' and ${table.replayOfRunId} is not null and ${table.reprocessOfRunId} is null and ${table.retryOfRunId} is null)
        or (${table.mode} = 'reprocess' and ${table.reprocessOfRunId} is not null and ${table.replayOfRunId} is null and ${table.retryOfRunId} is null)
        or (${table.mode} = 'retry' and ${table.retryOfRunId} is not null and ${table.replayOfRunId} is null and ${table.reprocessOfRunId} is null)`,
    ),
    check(
      "requirement_analysis_run_cancel_fields_check",
      sql`(${table.cancelRequestedAt} is null and ${table.cancelRequestedBy} is null) or (${table.cancelRequestedAt} is not null and ${table.cancelRequestedBy} is not null)`,
    ),
    check(
      "requirement_analysis_run_failure_fields_check",
      sql`(${table.status} <> 'failed') or (${table.failureCode} is not null and ${table.failureRetryable} is not null)`,
    ),
    // One active run per project (module-03 §7.2 budgets table); active statuses are requested,
    // snapshotting, queued, running, and waiting_retry.
    uniqueIndex("requirement_analysis_run_active_per_project_uidx")
      .on(table.projectId)
      .where(sql`${table.status} in (${sql.raw(sqlTextValues(analysisRunActiveStatusValues))})`),
    index("requirement_analysis_run_org_status_idx").on(table.organizationId, table.status),
    index("requirement_analysis_run_project_created_at_idx").on(
      table.projectId,
      table.createdAt.desc(),
      table.id,
    ),
    index("requirement_analysis_run_correlation_id_idx").on(table.correlationId),
    index("requirement_analysis_run_requested_by_idx").on(table.requestedBy),
    index("requirement_analysis_run_cancel_requested_by_idx").on(table.cancelRequestedBy),
    index("requirement_analysis_run_source_snapshot_id_idx").on(table.sourceSnapshotId),
    index("requirement_analysis_run_replay_of_run_id_idx").on(table.replayOfRunId),
    index("requirement_analysis_run_reprocess_of_run_id_idx").on(table.reprocessOfRunId),
    index("requirement_analysis_run_retry_of_run_id_idx").on(table.retryOfRunId),
    index("requirement_analysis_run_provider_policy_id_idx").on(table.providerPolicyId),
    index("requirement_analysis_run_failed_stage_id_idx").on(table.failedStageId),
  ],
);

/** Frozen source/extraction/chunk snapshot header for one run (module-03 §9.3); immutable after insert. */
export const requirementAnalysisSnapshot = pgTable(
  "requirement_analysis_snapshot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => requirementAnalysisRun.id, { onDelete: "restrict" }),
    snapshotHash: text("snapshot_hash").notNull(),
    sourceCount: integer("source_count").notNull(),
    chunkCount: integer("chunk_count").notNull(),
    totalCharacterCount: integer("total_character_count").notNull(),
    eligibilityRulesVersion: text("eligibility_rules_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "requirement_analysis_snapshot_hash_check",
      sql`${table.snapshotHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check("requirement_analysis_snapshot_source_count_check", sql`${table.sourceCount} >= 0`),
    check("requirement_analysis_snapshot_chunk_count_check", sql`${table.chunkCount} >= 0`),
    check(
      "requirement_analysis_snapshot_total_character_count_check",
      sql`${table.totalCharacterCount} >= 0`,
    ),
    check(
      "requirement_analysis_snapshot_eligibility_rules_version_check",
      sql`length(btrim(${table.eligibilityRulesVersion})) > 0`,
    ),
    uniqueIndex("requirement_analysis_snapshot_run_id_uidx").on(table.runId),
    index("requirement_analysis_snapshot_org_project_idx").on(
      table.organizationId,
      table.projectId,
    ),
    index("requirement_analysis_snapshot_project_id_idx").on(table.projectId),
  ],
);

/** One frozen source/extraction tuple within a snapshot (module-03 §9.3); immutable after insert. */
export const requirementAnalysisSnapshotSource = pgTable(
  "requirement_analysis_snapshot_source",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => requirementAnalysisSnapshot.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocument.id, { onDelete: "restrict" }),
    sourceLineageId: uuid("source_lineage_id").notNull(),
    sourceVersionNumber: integer("source_version_number").notNull(),
    sourceContentHash: text("source_content_hash").notNull(),
    sourceExtractionId: uuid("source_extraction_id")
      .notNull()
      .references(() => sourceExtraction.id, { onDelete: "restrict" }),
    sourceExtractionVersion: integer("source_extraction_version").notNull(),
    chunkerVersion: text("chunker_version").notNull(),
    extractedTextHash: text("extracted_text_hash"),
    referenceArtifactId: uuid("reference_artifact_id").references(() => referenceArtifact.id, {
      onDelete: "restrict",
    }),
    referenceIpReviewStatus: text("reference_ip_review_status"),
    chunkManifestHash: text("chunk_manifest_hash").notNull(),
    chunkSequenceStart: integer("chunk_sequence_start").notNull(),
    chunkSequenceEnd: integer("chunk_sequence_end").notNull(),
    chunkCount: integer("chunk_count").notNull(),
    characterCount: integer("character_count").notNull(),
    sourceOrder: integer("source_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "requirement_analysis_snapshot_source_content_hash_check",
      sql`${table.sourceContentHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "requirement_analysis_snapshot_source_extracted_text_hash_check",
      sql`${table.extractedTextHash} is null or ${table.extractedTextHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "requirement_analysis_snapshot_source_chunk_manifest_hash_check",
      sql`${table.chunkManifestHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "requirement_analysis_snapshot_source_chunk_sequence_check",
      sql`${table.chunkSequenceEnd} >= ${table.chunkSequenceStart}`,
    ),
    check("requirement_analysis_snapshot_source_chunk_count_check", sql`${table.chunkCount} >= 0`),
    check(
      "requirement_analysis_snapshot_source_character_count_check",
      sql`${table.characterCount} >= 0`,
    ),
    check("requirement_analysis_snapshot_source_order_check", sql`${table.sourceOrder} >= 0`),
    // A reference source must be IP-cleared, and the paired status is only ever present together.
    check(
      "requirement_analysis_snapshot_source_reference_review_check",
      sql`(${table.referenceArtifactId} is null) = (${table.referenceIpReviewStatus} is null)`,
    ),
    check(
      "requirement_analysis_snapshot_source_reference_cleared_check",
      sql`${table.referenceArtifactId} is null or ${table.referenceIpReviewStatus} = 'cleared'`,
    ),
    uniqueIndex("requirement_analysis_snapshot_source_snapshot_document_uidx").on(
      table.snapshotId,
      table.sourceDocumentId,
      table.sourceExtractionId,
    ),
    uniqueIndex("requirement_analysis_snapshot_source_order_uidx").on(
      table.snapshotId,
      table.sourceOrder,
    ),
    index("requirement_analysis_snapshot_source_org_project_document_idx").on(
      table.organizationId,
      table.projectId,
      table.sourceDocumentId,
    ),
    index("requirement_analysis_snapshot_source_project_id_idx").on(table.projectId),
    index("requirement_analysis_snapshot_source_document_id_idx").on(table.sourceDocumentId),
    index("requirement_analysis_snapshot_source_extraction_id_idx").on(table.sourceExtractionId),
    index("requirement_analysis_snapshot_source_reference_artifact_id_idx").on(
      table.referenceArtifactId,
    ),
  ],
);

/** One frozen original evidence file within a snapshot source (module-03 §9.3); immutable after insert. */
export const requirementAnalysisSnapshotFile = pgTable(
  "requirement_analysis_snapshot_file",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotSourceId: uuid("snapshot_source_id")
      .notNull()
      .references(() => requirementAnalysisSnapshotSource.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    sourceDocumentFileId: uuid("source_document_file_id")
      .notNull()
      .references(() => sourceDocumentFile.id, { onDelete: "restrict" }),
    fileOrdinal: integer("file_ordinal").notNull(),
    fileSha256: text("file_sha256").notNull(),
    objectVersionId: text("object_version_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("requirement_analysis_snapshot_file_ordinal_check", sql`${table.fileOrdinal} >= 0`),
    check(
      "requirement_analysis_snapshot_file_sha256_check",
      sql`${table.fileSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    uniqueIndex("requirement_analysis_snapshot_file_source_ordinal_uidx").on(
      table.snapshotSourceId,
      table.fileOrdinal,
    ),
    uniqueIndex("requirement_analysis_snapshot_file_source_document_file_uidx").on(
      table.snapshotSourceId,
      table.sourceDocumentFileId,
    ),
    index("requirement_analysis_snapshot_file_org_project_idx").on(
      table.organizationId,
      table.projectId,
    ),
    index("requirement_analysis_snapshot_file_project_id_idx").on(table.projectId),
    index("requirement_analysis_snapshot_file_source_document_file_id_idx").on(
      table.sourceDocumentFileId,
    ),
  ],
);

/** One frozen chunk within a snapshot source (module-03 §9.3); immutable after insert. */
export const requirementAnalysisSnapshotChunk = pgTable(
  "requirement_analysis_snapshot_chunk",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotSourceId: uuid("snapshot_source_id")
      .notNull()
      .references(() => requirementAnalysisSnapshotSource.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    sourceChunkId: uuid("source_chunk_id")
      .notNull()
      .references(() => sourceChunk.id, { onDelete: "restrict" }),
    chunkSequence: integer("chunk_sequence").notNull(),
    chunkOrder: integer("chunk_order").notNull(),
    chunkContentHash: text("chunk_content_hash").notNull(),
    locatorHash: text("locator_hash").notNull(),
    characterCount: integer("character_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("requirement_analysis_snapshot_chunk_sequence_check", sql`${table.chunkSequence} >= 0`),
    check("requirement_analysis_snapshot_chunk_order_check", sql`${table.chunkOrder} >= 0`),
    check(
      "requirement_analysis_snapshot_chunk_content_hash_check",
      sql`${table.chunkContentHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "requirement_analysis_snapshot_chunk_locator_hash_check",
      sql`${table.locatorHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "requirement_analysis_snapshot_chunk_character_count_check",
      sql`${table.characterCount} >= 0`,
    ),
    uniqueIndex("requirement_analysis_snapshot_chunk_source_chunk_uidx").on(
      table.snapshotSourceId,
      table.sourceChunkId,
    ),
    uniqueIndex("requirement_analysis_snapshot_chunk_order_uidx").on(
      table.snapshotSourceId,
      table.chunkOrder,
    ),
    index("requirement_analysis_snapshot_chunk_org_project_idx").on(
      table.organizationId,
      table.projectId,
    ),
    index("requirement_analysis_snapshot_chunk_project_id_idx").on(table.projectId),
    index("requirement_analysis_snapshot_chunk_source_chunk_id_idx").on(table.sourceChunkId),
  ],
);

/** One worker pipeline stage within a run's DAG (module-03 §9.4). */
export const requirementAnalysisStage = pgTable(
  "requirement_analysis_stage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => requirementAnalysisRun.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    status: text("status").default("pending").notNull(),
    attemptNumber: integer("attempt_number").default(1).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    inputHash: text("input_hash"),
    outputHash: text("output_hash"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    retryAfter: timestamp("retry_after", { withTimezone: true }),
    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "requirement_analysis_stage_kind_check",
      sql.raw(`"kind" in (${sqlTextValues(analysisStageKindValues)})`),
    ),
    check(
      "requirement_analysis_stage_status_check",
      sql.raw(`"status" in (${sqlTextValues(analysisStageStatusValues)})`),
    ),
    check("requirement_analysis_stage_attempt_number_check", sql`${table.attemptNumber} >= 1`),
    check(
      "requirement_analysis_stage_idempotency_key_check",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "requirement_analysis_stage_failure_fields_check",
      sql`(${table.status} <> 'failed') or (${table.failureCode} is not null)`,
    ),
    uniqueIndex("requirement_analysis_stage_run_kind_attempt_uidx").on(
      table.runId,
      table.kind,
      table.attemptNumber,
    ),
    uniqueIndex("requirement_analysis_stage_idempotency_key_uidx").on(table.idempotencyKey),
    index("requirement_analysis_stage_run_status_idx").on(table.runId, table.status),
    index("requirement_analysis_stage_org_project_idx").on(table.organizationId, table.projectId),
    index("requirement_analysis_stage_project_id_idx").on(table.projectId),
    index("requirement_analysis_stage_kind_idx").on(table.kind),
  ],
);

/** Explicit DAG edge between two stages of the same run (module-03 §9.4). */
export const requirementAnalysisStageDependency = pgTable(
  "requirement_analysis_stage_dependency",
  {
    stageId: uuid("stage_id")
      .notNull()
      .references(() => requirementAnalysisStage.id, { onDelete: "restrict" }),
    dependsOnStageId: uuid("depends_on_stage_id")
      .notNull()
      .references(() => requirementAnalysisStage.id, { onDelete: "restrict" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => requirementAnalysisRun.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.stageId, table.dependsOnStageId] }),
    check(
      "requirement_analysis_stage_dependency_no_self_check",
      sql`${table.stageId} <> ${table.dependsOnStageId}`,
    ),
    index("requirement_analysis_stage_dependency_depends_on_stage_id_idx").on(
      table.dependsOnStageId,
    ),
    index("requirement_analysis_stage_dependency_stage_id_idx").on(table.stageId),
    index("requirement_analysis_stage_dependency_run_id_idx").on(table.runId),
    index("requirement_analysis_stage_dependency_org_project_idx").on(
      table.organizationId,
      table.projectId,
    ),
    index("requirement_analysis_stage_dependency_project_id_idx").on(table.projectId),
  ],
);

/** One model-call (or deterministic-stage) batch of ordered chunks (module-03 §9.4). */
export const requirementAnalysisBatch = pgTable(
  "requirement_analysis_batch",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => requirementAnalysisStage.id, { onDelete: "restrict" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => requirementAnalysisRun.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    batchOrder: integer("batch_order").notNull(),
    sourceChunkStartSequence: integer("source_chunk_start_sequence").notNull(),
    sourceChunkEndSequence: integer("source_chunk_end_sequence").notNull(),
    inputTokenEstimate: integer("input_token_estimate").notNull(),
    maxOutputTokens: integer("max_output_tokens").notNull(),
    status: text("status").default("pending").notNull(),
    attemptNumber: integer("attempt_number").default(1).notNull(),
    aiRunId: uuid("ai_run_id").references(() => aiRun.id, { onDelete: "set null" }),
    repairOfBatchId: uuid("repair_of_batch_id").references(
      (): AnyPgColumn => requirementAnalysisBatch.id,
      { onDelete: "restrict" },
    ),
    shapeOnlyRepairUsed: boolean("shape_only_repair_used").default(false).notNull(),
    cacheKey: text("cache_key"),
    cacheHitOfBatchId: uuid("cache_hit_of_batch_id").references(
      (): AnyPgColumn => requirementAnalysisBatch.id,
      { onDelete: "restrict" },
    ),
    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "requirement_analysis_batch_status_check",
      sql.raw(`"status" in (${sqlTextValues(analysisStageStatusValues)})`),
    ),
    check("requirement_analysis_batch_order_check", sql`${table.batchOrder} >= 0`),
    check(
      "requirement_analysis_batch_chunk_sequence_check",
      sql`${table.sourceChunkEndSequence} >= ${table.sourceChunkStartSequence}`,
    ),
    check(
      "requirement_analysis_batch_input_token_estimate_check",
      sql`${table.inputTokenEstimate} >= 0`,
    ),
    check("requirement_analysis_batch_max_output_tokens_check", sql`${table.maxOutputTokens} > 0`),
    check("requirement_analysis_batch_attempt_number_check", sql`${table.attemptNumber} >= 1`),
    check(
      "requirement_analysis_batch_failure_fields_check",
      sql`(${table.status} <> 'failed') or (${table.failureCode} is not null)`,
    ),
    uniqueIndex("requirement_analysis_batch_stage_order_attempt_uidx").on(
      table.stageId,
      table.batchOrder,
      table.attemptNumber,
    ),
    index("requirement_analysis_batch_run_id_idx").on(table.runId),
    index("requirement_analysis_batch_org_project_idx").on(table.organizationId, table.projectId),
    index("requirement_analysis_batch_project_id_idx").on(table.projectId),
    index("requirement_analysis_batch_ai_run_id_idx").on(table.aiRunId),
    index("requirement_analysis_batch_repair_of_batch_id_idx").on(table.repairOfBatchId),
    index("requirement_analysis_batch_cache_hit_of_batch_id_idx").on(table.cacheHitOfBatchId),
    index("requirement_analysis_batch_cache_key_idx").on(table.cacheKey),
  ],
);

/** Exact prompt-order chunk membership of one batch (module-03 §9.4). */
export const requirementAnalysisBatchChunk = pgTable(
  "requirement_analysis_batch_chunk",
  {
    batchId: uuid("batch_id")
      .notNull()
      .references(() => requirementAnalysisBatch.id, { onDelete: "restrict" }),
    snapshotChunkId: uuid("snapshot_chunk_id")
      .notNull()
      .references(() => requirementAnalysisSnapshotChunk.id, { onDelete: "restrict" }),
    chunkOrder: integer("chunk_order").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.batchId, table.snapshotChunkId] }),
    check("requirement_analysis_batch_chunk_order_check", sql`${table.chunkOrder} >= 0`),
    uniqueIndex("requirement_analysis_batch_chunk_batch_order_uidx").on(
      table.batchId,
      table.chunkOrder,
    ),
    index("requirement_analysis_batch_chunk_snapshot_chunk_id_idx").on(table.snapshotChunkId),
    index("requirement_analysis_batch_chunk_org_project_idx").on(
      table.organizationId,
      table.projectId,
    ),
    index("requirement_analysis_batch_chunk_project_id_idx").on(table.projectId),
  ],
);

/** First-class AI-suggested requirement; Module 3 only ever writes `lifecycle_state = 'ai_suggested'` (module-03 §9.5). */
export const requirement = pgTable(
  "requirement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    analysisRunId: uuid("analysis_run_id")
      .notNull()
      .references(() => requirementAnalysisRun.id, { onDelete: "restrict" }),
    stableKey: text("stable_key").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    requirementType: text("requirement_type").notNull(),
    priority: text("priority"),
    epistemicStatus: text("epistemic_status").notNull(),
    confidenceBand: text("confidence_band"),
    confidenceReasonCodes: text("confidence_reason_codes")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    inferenceBasis: text("inference_basis"),
    origin: text("origin").notNull(),
    lifecycleState: text("lifecycle_state").default("ai_suggested").notNull(),
    dedupeGroupKey: text("dedupe_group_key"),
    parentRequirementId: uuid("parent_requirement_id").references(
      (): AnyPgColumn => requirement.id,
      {
        onDelete: "set null",
      },
    ),
    sourceSummary: text("source_summary"),
    createdByAiRunId: uuid("created_by_ai_run_id").references(() => aiRun.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("requirement_title_check", sql`length(btrim(${table.title})) > 0`),
    check("requirement_stable_key_check", sql`length(btrim(${table.stableKey})) > 0`),
    check(
      "requirement_requirement_type_check",
      sql.raw(`"requirement_type" in (${sqlTextValues(requirementTypeValues)})`),
    ),
    check(
      "requirement_priority_check",
      sql.raw(`"priority" is null or "priority" in (${sqlTextValues(requirementPriorityValues)})`),
    ),
    check(
      "requirement_epistemic_status_check",
      sql.raw(`"epistemic_status" in (${sqlTextValues(requirementEpistemicStatusValues)})`),
    ),
    check(
      "requirement_confidence_band_check",
      sql.raw(
        `"confidence_band" is null or "confidence_band" in (${sqlTextValues(confidenceBandValues)})`,
      ),
    ),
    check(
      "requirement_origin_check",
      sql.raw(`"origin" in (${sqlTextValues(analysisArtifactOriginValues)})`),
    ),
    check(
      "requirement_lifecycle_state_check",
      sql.raw(`"lifecycle_state" in (${sqlTextValues(requirementLifecycleStateValues)})`),
    ),
    check(
      "requirement_assumed_inference_basis_check",
      sql`${table.epistemicStatus} <> 'assumed' or ${table.inferenceBasis} is not null`,
    ),
    check(
      "requirement_unknown_conflicting_confidence_check",
      sql`${table.epistemicStatus} not in ('unknown', 'conflicting') or ${table.confidenceBand} is null`,
    ),
    uniqueIndex("requirement_analysis_run_stable_key_uidx").on(
      table.analysisRunId,
      table.stableKey,
    ),
    index("requirement_project_id_idx").on(table.projectId),
    index("requirement_organization_id_idx").on(table.organizationId),
    index("requirement_analysis_run_status_idx").on(table.analysisRunId, table.epistemicStatus),
    index("requirement_analysis_run_type_idx").on(table.analysisRunId, table.requirementType),
    index("requirement_analysis_run_cursor_idx").on(table.analysisRunId, table.createdAt, table.id),
    index("requirement_dedupe_group_key_idx").on(table.dedupeGroupKey),
    index("requirement_parent_requirement_id_idx").on(table.parentRequirementId),
    index("requirement_created_by_ai_run_id_idx").on(table.createdByAiRunId),
  ],
);

/** Immutable citation evidence row for a requirement, coverage entry, or delivery item (module-03 §9.6). */
export const citation = pgTable(
  "citation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    analysisRunId: uuid("analysis_run_id")
      .notNull()
      .references(() => requirementAnalysisRun.id, { onDelete: "restrict" }),
    requirementId: uuid("requirement_id").references(() => requirement.id, {
      onDelete: "restrict",
    }),
    coverageMatrixEntryId: uuid("coverage_matrix_entry_id").references(
      (): AnyPgColumn => coverageMatrixEntry.id,
      { onDelete: "restrict" },
    ),
    deliveryItemId: uuid("delivery_item_id").references((): AnyPgColumn => deliveryItem.id, {
      onDelete: "restrict",
    }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocument.id, { onDelete: "restrict" }),
    sourceVersionNumber: integer("source_version_number").notNull(),
    sourceContentHash: text("source_content_hash").notNull(),
    sourceExtractionId: uuid("source_extraction_id")
      .notNull()
      .references(() => sourceExtraction.id, { onDelete: "restrict" }),
    sourceExtractionVersion: integer("source_extraction_version").notNull(),
    sourceChunkId: uuid("source_chunk_id")
      .notNull()
      .references(() => sourceChunk.id, { onDelete: "restrict" }),
    sourceChunkSequence: integer("source_chunk_sequence").notNull(),
    chunkContentHash: text("chunk_content_hash").notNull(),
    locator: jsonb("locator").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    quoteTextOriginal: text("quote_text_original").notNull(),
    quoteTextNormalized: text("quote_text_normalized").notNull(),
    quoteHash: text("quote_hash").notNull(),
    matchStartOffset: integer("match_start_offset").notNull(),
    matchEndOffset: integer("match_end_offset").notNull(),
    normalizationMode: text("normalization_mode").notNull(),
    verificationStatus: text("verification_status").notNull(),
    createdByAiRunId: uuid("created_by_ai_run_id").references(() => aiRun.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "citation_exactly_one_target_check",
      sql`num_nonnulls(${table.requirementId}, ${table.coverageMatrixEntryId}, ${table.deliveryItemId}) = 1`,
    ),
    check(
      "citation_verification_status_check",
      sql.raw(`"verification_status" in (${sqlTextValues(citationVerificationStatusValues)})`),
    ),
    check("citation_normalization_mode_check", sql`length(btrim(${table.normalizationMode})) > 0`),
    check("citation_source_content_hash_check", sql`${table.sourceContentHash} ~ '^[a-f0-9]{64}$'`),
    check("citation_chunk_content_hash_check", sql`${table.chunkContentHash} ~ '^[a-f0-9]{64}$'`),
    check("citation_quote_hash_check", sql`${table.quoteHash} ~ '^[a-f0-9]{64}$'`),
    check("citation_match_offset_check", sql`${table.matchEndOffset} > ${table.matchStartOffset}`),
    check("citation_match_start_offset_check", sql`${table.matchStartOffset} >= 0`),
    check(
      "citation_verified_exact_requires_quote_check",
      sql`${table.verificationStatus} <> 'verified_exact' or length(btrim(${table.quoteTextOriginal})) > 0`,
    ),
    uniqueIndex("citation_requirement_target_uidx")
      .on(
        table.requirementId,
        table.sourceChunkId,
        table.quoteHash,
        table.matchStartOffset,
        table.matchEndOffset,
      )
      .where(sql`${table.requirementId} is not null`),
    uniqueIndex("citation_coverage_target_uidx")
      .on(
        table.coverageMatrixEntryId,
        table.sourceChunkId,
        table.quoteHash,
        table.matchStartOffset,
        table.matchEndOffset,
      )
      .where(sql`${table.coverageMatrixEntryId} is not null`),
    uniqueIndex("citation_delivery_item_target_uidx")
      .on(
        table.deliveryItemId,
        table.sourceChunkId,
        table.quoteHash,
        table.matchStartOffset,
        table.matchEndOffset,
      )
      .where(sql`${table.deliveryItemId} is not null`),
    index("citation_analysis_run_id_idx").on(table.analysisRunId),
    index("citation_organization_id_idx").on(table.organizationId),
    index("citation_project_id_idx").on(table.projectId),
    index("citation_source_document_id_idx").on(table.sourceDocumentId),
    index("citation_source_chunk_id_idx").on(table.sourceChunkId),
    index("citation_source_extraction_id_idx").on(table.sourceExtractionId),
    index("citation_created_by_ai_run_id_idx").on(table.createdByAiRunId),
  ],
);

/** One fixed-rubric coverage row per run/category (module-03 §9.7, exactly 18 categories). */
export const coverageMatrixEntry = pgTable(
  "coverage_matrix_entry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    analysisRunId: uuid("analysis_run_id")
      .notNull()
      .references(() => requirementAnalysisRun.id, { onDelete: "restrict" }),
    categoryKey: text("category_key").notNull(),
    categoryLabel: text("category_label").notNull(),
    categoryOrder: integer("category_order").notNull(),
    status: text("status").notNull(),
    rationale: text("rationale"),
    evidenceState: text("evidence_state").notNull(),
    questionDeliveryItemId: uuid("question_delivery_item_id").references(
      (): AnyPgColumn => deliveryItem.id,
      { onDelete: "restrict" },
    ),
    createdByAiRunId: uuid("created_by_ai_run_id").references(() => aiRun.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "coverage_matrix_entry_category_key_check",
      sql.raw(`"category_key" in (${sqlTextValues(coverageCategoryKeyValues)})`),
    ),
    check(
      "coverage_matrix_entry_category_label_check",
      sql`length(btrim(${table.categoryLabel})) > 0`,
    ),
    check(
      "coverage_matrix_entry_category_order_check",
      sql`${table.categoryOrder} between 1 and ${sql.raw(String(coverageCategoryKeyValues.length))}`,
    ),
    check(
      "coverage_matrix_entry_status_check",
      sql.raw(`"status" in (${sqlTextValues(coverageStatusValues)})`),
    ),
    check(
      "coverage_matrix_entry_evidence_state_check",
      sql.raw(`"evidence_state" in (${sqlTextValues(coverageEvidenceStateValues)})`),
    ),
    uniqueIndex("coverage_matrix_entry_run_category_uidx").on(
      table.analysisRunId,
      table.categoryKey,
    ),
    index("coverage_matrix_entry_run_order_idx").on(table.analysisRunId, table.categoryOrder),
    index("coverage_matrix_entry_org_project_idx").on(table.organizationId, table.projectId),
    index("coverage_matrix_entry_project_id_idx").on(table.projectId),
    index("coverage_matrix_entry_question_delivery_item_id_idx").on(table.questionDeliveryItemId),
    index("coverage_matrix_entry_created_by_ai_run_id_idx").on(table.createdByAiRunId),
  ],
);

/** Generic first-class Module 3 concern row (question/risk/assumption/dependency/blocker/scope change) (module-03 §9.8). */
export const deliveryItem = pgTable(
  "delivery_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    analysisRunId: uuid("analysis_run_id")
      .notNull()
      .references(() => requirementAnalysisRun.id, { onDelete: "restrict" }),
    itemType: text("item_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    epistemicStatus: text("epistemic_status").notNull(),
    confidenceBand: text("confidence_band"),
    confidenceReasonCodes: text("confidence_reason_codes")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    severity: text("severity"),
    priority: text("priority"),
    status: text("status").default("open").notNull(),
    visibility: text("visibility").default("internal").notNull(),
    attributes: jsonb("attributes").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    sourceRequirementId: uuid("source_requirement_id").references(() => requirement.id, {
      onDelete: "set null",
    }),
    createdByAiRunId: uuid("created_by_ai_run_id").references(() => aiRun.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("delivery_item_title_check", sql`length(btrim(${table.title})) > 0`),
    check(
      "delivery_item_item_type_check",
      sql.raw(`"item_type" in (${sqlTextValues(deliveryItemTypeValues)})`),
    ),
    check(
      "delivery_item_epistemic_status_check",
      sql.raw(`"epistemic_status" in (${sqlTextValues(requirementEpistemicStatusValues)})`),
    ),
    check(
      "delivery_item_confidence_band_check",
      sql.raw(
        `"confidence_band" is null or "confidence_band" in (${sqlTextValues(confidenceBandValues)})`,
      ),
    ),
    check(
      "delivery_item_severity_check",
      sql.raw(`"severity" is null or "severity" in (${sqlTextValues(deliveryItemSeverityValues)})`),
    ),
    check(
      "delivery_item_priority_check",
      sql.raw(`"priority" is null or "priority" in (${sqlTextValues(deliveryItemPriorityValues)})`),
    ),
    check(
      "delivery_item_status_check",
      sql.raw(`"status" in (${sqlTextValues(deliveryItemStatusValues)})`),
    ),
    check(
      "delivery_item_visibility_check",
      sql.raw(`"visibility" in (${sqlTextValues(deliveryItemVisibilityValues)})`),
    ),
    check(
      "delivery_item_unknown_conflicting_confidence_check",
      sql`${table.epistemicStatus} not in ('unknown', 'conflicting') or ${table.confidenceBand} is null`,
    ),
    index("delivery_item_analysis_run_item_type_idx").on(table.analysisRunId, table.itemType),
    index("delivery_item_analysis_run_cursor_idx").on(
      table.analysisRunId,
      table.createdAt,
      table.id,
    ),
    index("delivery_item_project_id_idx").on(table.projectId),
    index("delivery_item_org_id_idx").on(table.organizationId),
    index("delivery_item_source_requirement_id_idx").on(table.sourceRequirementId),
    index("delivery_item_created_by_ai_run_id_idx").on(table.createdByAiRunId),
  ],
);

export const betterAuthSchema = {
  user,
  session,
  account,
  verification,
};

export const databaseSchema = {
  organization,
  ...betterAuthSchema,
  rateLimit,
  client,
  project,
  projectMembership,
  auditEvent,
  traceabilityLink,
  aiRun,
  sourceUploadSession,
  sourceUploadFile,
  sourceDocument,
  sourceDocumentFile,
  sourceExtraction,
  sourceChunk,
  referenceArtifact,
  organizationAiProviderPolicy,
  requirementAnalysisRun,
  requirementAnalysisSnapshot,
  requirementAnalysisSnapshotSource,
  requirementAnalysisSnapshotFile,
  requirementAnalysisSnapshotChunk,
  requirementAnalysisStage,
  requirementAnalysisStageDependency,
  requirementAnalysisBatch,
  requirementAnalysisBatchChunk,
  requirement,
  citation,
  coverageMatrixEntry,
  deliveryItem,
};

export type Organization = typeof organization.$inferSelect;
export type NewOrganization = typeof organization.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type RateLimit = typeof rateLimit.$inferSelect;
export type NewRateLimit = typeof rateLimit.$inferInsert;
export type Client = typeof client.$inferSelect;
export type NewClient = typeof client.$inferInsert;
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type ProjectMembership = typeof projectMembership.$inferSelect;
export type NewProjectMembership = typeof projectMembership.$inferInsert;
export type AuditEvent = typeof auditEvent.$inferSelect;
export type NewAuditEvent = typeof auditEvent.$inferInsert;
export type TraceabilityLink = typeof traceabilityLink.$inferSelect;
export type NewTraceabilityLink = typeof traceabilityLink.$inferInsert;
export type AiRun = typeof aiRun.$inferSelect;
export type NewAiRun = typeof aiRun.$inferInsert;
export type SourceUploadSession = typeof sourceUploadSession.$inferSelect;
export type NewSourceUploadSession = typeof sourceUploadSession.$inferInsert;
export type SourceUploadFile = typeof sourceUploadFile.$inferSelect;
export type NewSourceUploadFile = typeof sourceUploadFile.$inferInsert;
export type SourceDocument = typeof sourceDocument.$inferSelect;
export type NewSourceDocument = typeof sourceDocument.$inferInsert;
export type SourceDocumentFile = typeof sourceDocumentFile.$inferSelect;
export type NewSourceDocumentFile = typeof sourceDocumentFile.$inferInsert;
export type SourceExtraction = typeof sourceExtraction.$inferSelect;
export type NewSourceExtraction = typeof sourceExtraction.$inferInsert;
export type SourceChunk = typeof sourceChunk.$inferSelect;
export type NewSourceChunk = typeof sourceChunk.$inferInsert;
export type ReferenceArtifact = typeof referenceArtifact.$inferSelect;
export type NewReferenceArtifact = typeof referenceArtifact.$inferInsert;
export type OrganizationAiProviderPolicy = typeof organizationAiProviderPolicy.$inferSelect;
export type NewOrganizationAiProviderPolicy = typeof organizationAiProviderPolicy.$inferInsert;
export type RequirementAnalysisRun = typeof requirementAnalysisRun.$inferSelect;
export type NewRequirementAnalysisRun = typeof requirementAnalysisRun.$inferInsert;
export type RequirementAnalysisSnapshot = typeof requirementAnalysisSnapshot.$inferSelect;
export type NewRequirementAnalysisSnapshot = typeof requirementAnalysisSnapshot.$inferInsert;
export type RequirementAnalysisSnapshotSource =
  typeof requirementAnalysisSnapshotSource.$inferSelect;
export type NewRequirementAnalysisSnapshotSource =
  typeof requirementAnalysisSnapshotSource.$inferInsert;
export type RequirementAnalysisSnapshotFile = typeof requirementAnalysisSnapshotFile.$inferSelect;
export type NewRequirementAnalysisSnapshotFile =
  typeof requirementAnalysisSnapshotFile.$inferInsert;
export type RequirementAnalysisSnapshotChunk = typeof requirementAnalysisSnapshotChunk.$inferSelect;
export type NewRequirementAnalysisSnapshotChunk =
  typeof requirementAnalysisSnapshotChunk.$inferInsert;
export type RequirementAnalysisStage = typeof requirementAnalysisStage.$inferSelect;
export type NewRequirementAnalysisStage = typeof requirementAnalysisStage.$inferInsert;
export type RequirementAnalysisStageDependency =
  typeof requirementAnalysisStageDependency.$inferSelect;
export type NewRequirementAnalysisStageDependency =
  typeof requirementAnalysisStageDependency.$inferInsert;
export type RequirementAnalysisBatch = typeof requirementAnalysisBatch.$inferSelect;
export type NewRequirementAnalysisBatch = typeof requirementAnalysisBatch.$inferInsert;
export type RequirementAnalysisBatchChunk = typeof requirementAnalysisBatchChunk.$inferSelect;
export type NewRequirementAnalysisBatchChunk = typeof requirementAnalysisBatchChunk.$inferInsert;
export type Requirement = typeof requirement.$inferSelect;
export type NewRequirement = typeof requirement.$inferInsert;
export type Citation = typeof citation.$inferSelect;
export type NewCitation = typeof citation.$inferInsert;
export type CoverageMatrixEntry = typeof coverageMatrixEntry.$inferSelect;
export type NewCoverageMatrixEntry = typeof coverageMatrixEntry.$inferInsert;
export type DeliveryItem = typeof deliveryItem.$inferSelect;
export type NewDeliveryItem = typeof deliveryItem.$inferInsert;
