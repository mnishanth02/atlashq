import {
  canProjectRole,
  evaluateProjectAccess,
  type ProjectAccessContext,
  type ProjectPermission,
} from "@atlashq/auth";
import { uuidSchema } from "@atlashq/validators";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Reflector must be a value import so Nest emits DI metadata for it.
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { getResolvedSession } from "../auth/session-context.js";
import { PROJECT_ACCESS_QUERIES } from "../runtime/runtime.js";
import type { ProjectAccessQueries } from "./project-access.queries.js";
import {
  extractProjectId,
  PROJECT_PERMISSION_METADATA,
  type ProjectPermissionRequirement,
} from "./require-project-permission.decorator.js";

export type ProjectAuthorizationContext = ProjectAccessContext;

/**
 * Pure permission-matrix check retained (and re-exported) for callers that only
 * need to evaluate a role against a permission without a database lookup.
 */
export function canAccessProject(
  context: ProjectAuthorizationContext,
  permission: ProjectPermission,
): boolean {
  return canProjectRole(context.role, permission);
}

/**
 * Deny-by-default project authorization guard.
 *
 * Enforcement steps:
 *  1. Routes without a {@link RequireProjectPermission} requirement are ignored.
 *  2. An authenticated session is required.
 *  3. The project is loaded with an organization-scoped, parameterized query so a
 *     cross-organization id can never leak another tenant's project.
 *  4. The active, non-removed, non-soft-deleted membership (if any) is loaded.
 *  5. The pure {@link evaluateProjectAccess} decides: organization admins may act
 *     on same-org projects (with archived/soft-deleted restore gating); everyone
 *     else needs an active membership whose role grants the permission.
 *
 * Frontend checks are never trusted as authority.
 */
@Injectable()
export class ProjectAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PROJECT_ACCESS_QUERIES) private readonly queries: ProjectAccessQueries,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<ProjectPermissionRequirement | undefined>(
      PROJECT_PERMISSION_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const session = getResolvedSession(request);

    if (!session) {
      throw new UnauthorizedException("Authentication required.");
    }

    const projectId = extractProjectId(request, requirement);

    if (!projectId) {
      throw new ForbiddenException("Project access denied.");
    }

    const validatedProjectId = uuidSchema.parse(projectId);
    const project = await this.queries.findProject(session.user.organizationId, validatedProjectId);
    const membership = project
      ? await this.queries.findActiveMembership(
          session.user.organizationId,
          validatedProjectId,
          session.user.id,
        )
      : null;

    const decision = evaluateProjectAccess({
      actor: {
        organizationId: session.user.organizationId,
        organizationRole: session.user.organizationRole,
      },
      permission: requirement.permission,
      project,
      membership,
    });

    if (!decision.allowed) {
      throw new ForbiddenException("Project access denied.");
    }

    return true;
  }
}
