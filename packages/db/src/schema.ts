import type {
  JsonObject,
  aiReviewStatusValues as sharedAiReviewStatusValues,
  aiRunStatusValues as sharedAiRunStatusValues,
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
  pgTable,
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
