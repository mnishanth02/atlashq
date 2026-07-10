import { organizationRoleValues, projectRoleValues } from "@atlashq/types";
import { z } from "zod";
import { organizationIdSchema, userIdSchema } from "./ids.js";
import { paginationQuerySchema } from "./pagination.js";

export const projectRoleSchema = z.enum(projectRoleValues);
export const organizationRoleSchema = z.enum(organizationRoleValues);

/**
 * `project_membership.status` (module-01 §7.1) has no fixed canonical set in the architecture
 * docs beyond "supports role, status, invited/added metadata, and soft-delete/deactivation".
 * This is a minimal V1 convention scoped to the validators package pending further specification.
 */
export const projectMembershipStatusValues = ["invited", "active", "removed"] as const;
export const projectMembershipStatusSchema = z.enum(projectMembershipStatusValues);

export const projectMembershipCreateInputSchema = z
  .object({
    userId: userIdSchema,
    role: projectRoleSchema,
  })
  .strict();

export type ProjectMembershipCreateInput = z.infer<typeof projectMembershipCreateInputSchema>;

export const projectMembershipUpdateInputSchema = z
  .object({
    role: projectRoleSchema,
    status: projectMembershipStatusSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided to update a project membership.",
  });

export type ProjectMembershipUpdateInput = z.infer<typeof projectMembershipUpdateInputSchema>;

export const projectMembershipListFilterSchema = paginationQuerySchema
  .extend({
    userId: userIdSchema.optional(),
    role: projectRoleSchema.optional(),
    status: projectMembershipStatusSchema.optional(),
  })
  .strict();

export type ProjectMembershipListFilter = z.infer<typeof projectMembershipListFilterSchema>;

export const organizationMembershipCreateInputSchema = z
  .object({
    organizationId: organizationIdSchema,
    userId: userIdSchema,
    role: organizationRoleSchema,
  })
  .strict();

export type OrganizationMembershipCreateInput = z.infer<
  typeof organizationMembershipCreateInputSchema
>;
