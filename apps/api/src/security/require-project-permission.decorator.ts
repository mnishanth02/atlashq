import type { ProjectPermission } from "@atlashq/auth";
import { SetMetadata } from "@nestjs/common";
import type { Request } from "express";

export const PROJECT_PERMISSION_METADATA = "atlashq:project-permission";

export type ProjectPermissionRequirement = {
  permission: ProjectPermission;
  /** Route param name that carries the project id. Defaults to `projectId`. */
  param: string;
};

/**
 * Declare the project permission required to invoke a route. The
 * {@link ProjectAuthorizationGuard} reads this metadata and enforces
 * deny-by-default, organization-scoped access.
 */
export function RequireProjectPermission(
  permission: ProjectPermission,
  param = "projectId",
): MethodDecorator & ClassDecorator {
  const requirement: ProjectPermissionRequirement = { permission, param };
  return SetMetadata(PROJECT_PERMISSION_METADATA, requirement);
}

/** Extract the project id for a permission requirement from the request params. */
export function extractProjectId(
  request: Request,
  requirement: ProjectPermissionRequirement,
): string | null {
  const params = request.params as Record<string, string | undefined>;
  const value = params[requirement.param] ?? params.projectId ?? params.id;
  return typeof value === "string" && value.length > 0 ? value : null;
}
