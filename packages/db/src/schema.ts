import type {
  JsonObject,
  aiReviewStatusValues as sharedAiReviewStatusValues,
  aiRunStatusValues as sharedAiRunStatusValues,
  organizationRoleValues as sharedOrganizationRoleValues,
  projectPhaseValues as sharedProjectPhaseValues,
  projectPriorityValues as sharedProjectPriorityValues,
  projectRoleValues as sharedProjectRoleValues,
  projectStatusValues as sharedProjectStatusValues,
  projectTypeValues as sharedProjectTypeValues,
  projectVisibilityValues as sharedProjectVisibilityValues,
} from "@atlashq/types";
import { sql } from "drizzle-orm";
import {
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
