import { canProjectRole, type ProjectAccessContext, type ProjectPermission } from "@atlashq/auth";
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";

export type ProjectAuthorizationContext = ProjectAccessContext;

export function canAccessProject(
  context: ProjectAuthorizationContext,
  permission: ProjectPermission,
): boolean {
  return canProjectRole(context.role, permission);
}

@Injectable()
export class ProjectAuthorizationGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO(Module 1): evaluate session, organization membership, project role, and visibility.
    return true;
  }
}
