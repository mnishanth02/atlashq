import {
  auditEventListFilterSchema,
  auditEventResponseSchema,
  createPaginatedResponseSchema,
  createUuidPathParamsSchema,
  dashboardSummarySectionSchema,
  isoDateTimeSchema,
  projectCreateInputSchema,
  projectDescriptionSchema,
  projectListFilterSchema,
  projectMembershipCreateInputSchema,
  projectMembershipListFilterSchema,
  projectMembershipStatusSchema,
  projectMembershipUpdateInputSchema,
  projectNameSchema,
  projectPhaseSchema,
  projectPrioritySchema,
  projectRoleSchema,
  projectStatusSchema,
  projectTagSchema,
  projectTypeSchema,
  projectUpdateInputSchema,
  projectVisibilitySchema,
  uuidSchema,
} from "@atlashq/validators";
import { z } from "zod";

// Shared request/query/audit schemas are re-exported so the controller builds DTOs from a single
// feature entry point. Response schemas below are feature-local and strict.
export {
  auditEventListFilterSchema,
  auditEventResponseSchema,
  projectCreateInputSchema,
  projectListFilterSchema,
  projectMembershipCreateInputSchema,
  projectMembershipListFilterSchema,
  projectMembershipUpdateInputSchema,
  projectUpdateInputSchema,
};

const versionSchema = z.number().int().positive();

/** Minimal user reference embedded in a project response (owner / tech lead / business owner). */
export const projectUserRefSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1),
  })
  .strict();

/** Minimal client reference embedded in a project response. */
export const projectClientRefSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1),
  })
  .strict();

/** Minimal user reference embedded in a membership response. */
export const membershipUserRefSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1),
    email: z.email(),
  })
  .strict();

/** Strict, feature-local project response contract. */
export const projectResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: uuidSchema,
    name: projectNameSchema,
    type: projectTypeSchema,
    status: projectStatusSchema,
    clientId: uuidSchema.nullable(),
    client: projectClientRefSchema.nullable(),
    ownerId: uuidSchema,
    owner: projectUserRefSchema.nullable(),
    techLeadId: uuidSchema.nullable(),
    techLead: projectUserRefSchema.nullable(),
    businessOwnerId: uuidSchema.nullable(),
    businessOwner: projectUserRefSchema.nullable(),
    startDate: isoDateTimeSchema.nullable(),
    targetDate: isoDateTimeSchema.nullable(),
    phase: projectPhaseSchema,
    tags: z.array(projectTagSchema),
    priority: projectPrioritySchema,
    visibility: projectVisibilitySchema,
    description: projectDescriptionSchema.nullable(),
    createdAt: isoDateTimeSchema,
    createdBy: uuidSchema.nullable(),
    updatedAt: isoDateTimeSchema,
    updatedBy: uuidSchema.nullable(),
    softDeletedAt: isoDateTimeSchema.nullable(),
    version: versionSchema,
  })
  .strict();

export type ProjectResponse = z.infer<typeof projectResponseSchema>;

export const projectListResponseSchema = createPaginatedResponseSchema(projectResponseSchema);

export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;

/** Strict, feature-local membership response contract. */
export const membershipResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: uuidSchema,
    projectId: uuidSchema,
    userId: uuidSchema,
    user: membershipUserRefSchema.nullable(),
    role: projectRoleSchema,
    status: projectMembershipStatusSchema,
    invitedAt: isoDateTimeSchema.nullable(),
    invitedBy: uuidSchema.nullable(),
    addedAt: isoDateTimeSchema.nullable(),
    addedBy: uuidSchema.nullable(),
    deactivatedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    createdBy: uuidSchema.nullable(),
    updatedAt: isoDateTimeSchema,
    updatedBy: uuidSchema.nullable(),
    softDeletedAt: isoDateTimeSchema.nullable(),
    version: versionSchema,
  })
  .strict();

export type MembershipResponse = z.infer<typeof membershipResponseSchema>;

export const membershipListResponseSchema = createPaginatedResponseSchema(membershipResponseSchema);

export type MembershipListResponse = z.infer<typeof membershipListResponseSchema>;

export const auditEventListResponseSchema = createPaginatedResponseSchema(auditEventResponseSchema);

export type AuditEventListResponse = z.infer<typeof auditEventListResponseSchema>;

/** Module 1 dashboard zero-state cards. Every card must communicate that no analysis has run. */
export const projectDashboardCardsSchema = z
  .object({
    sourceDocuments: dashboardSummarySectionSchema,
    requirements: dashboardSummarySectionSchema,
    openQuestions: dashboardSummarySectionSchema,
    risksAndDeliveryItems: dashboardSummarySectionSchema,
    architectureReview: dashboardSummarySectionSchema,
    baselineAndHandoff: dashboardSummarySectionSchema,
  })
  .strict();

export type ProjectDashboardCards = z.infer<typeof projectDashboardCardsSchema>;

export const projectDashboardResponseSchema = z
  .object({
    project: projectResponseSchema,
    cards: projectDashboardCardsSchema,
    nextActions: z.array(z.string().trim().min(1)),
  })
  .strict();

export type ProjectDashboardResponse = z.infer<typeof projectDashboardResponseSchema>;

export const projectPathParamsSchema = createUuidPathParamsSchema("projectId");

export const membershipPathParamsSchema = z
  .object({
    projectId: uuidSchema,
    membershipId: uuidSchema,
  })
  .strict();
