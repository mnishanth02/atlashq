import {
  createPaginatedResponseSchema,
  organizationUserListFilterSchema,
  organizationUserResponseSchema,
} from "@atlashq/validators";
import type { z } from "zod";

// The request/response contracts are fully shared (packages/validators); this feature module only
// re-exports them so the controller can build DTOs from a single feature entry point, matching the
// clients/projects feature convention.
export { organizationUserListFilterSchema, organizationUserResponseSchema };
export type OrganizationUserListFilter = z.output<typeof organizationUserListFilterSchema>;
export type OrganizationUserResponse = z.infer<typeof organizationUserResponseSchema>;

export const organizationUserListResponseSchema = createPaginatedResponseSchema(
  organizationUserResponseSchema,
);

export type OrganizationUserListResponse = z.infer<typeof organizationUserListResponseSchema>;
