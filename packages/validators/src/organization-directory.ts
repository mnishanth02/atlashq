import { organizationRoleValues } from "@atlashq/types";
import { z } from "zod";
import { authenticatedUserStatusSchema } from "./api.js";
import { userIdSchema } from "./ids.js";
import { paginationQuerySchema } from "./pagination.js";

/** Free-text search over an organization user's name/email. Bounded to keep queries cheap. */
export const organizationUserSearchSchema = z.string().trim().min(1).max(200);

export { authenticatedUserStatusSchema as organizationUserStatusSchema };

/**
 * Query contract for `GET /organizations/current/users`. Every field is optional beyond
 * pagination: `search` matches name/email, `status` narrows to a single account status. Scoping
 * to the caller's session organization happens server-side, never as a query parameter.
 */
export const organizationUserListFilterSchema = paginationQuerySchema
  .extend({
    search: organizationUserSearchSchema.optional(),
    status: authenticatedUserStatusSchema.optional(),
  })
  .strict();

export type OrganizationUserListFilter = z.infer<typeof organizationUserListFilterSchema>;

/**
 * Minimal, safe organization-user projection returned by the directory search endpoint. Deliberately
 * excludes anything beyond what a teammate picker needs (no session/auth metadata, no audit fields).
 */
export const organizationUserResponseSchema = z
  .object({
    id: userIdSchema,
    name: z.string().trim().min(1),
    email: z.email(),
    status: authenticatedUserStatusSchema,
    organizationRole: z.enum(organizationRoleValues),
  })
  .strict();

export type OrganizationUserResponse = z.infer<typeof organizationUserResponseSchema>;
