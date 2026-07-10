import type {
  Auth,
  ProjectAccessMembership,
  ProjectAccessProject,
  ProjectPermission,
} from "@atlashq/auth";
import { type ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { resolveRequestSession } from "../auth/session-context.js";
import type { ProjectAccessQueries } from "./project-access.queries.js";
import { canAccessProject, ProjectAuthorizationGuard } from "./project-authorization.guard.js";
import type { ProjectPermissionRequirement } from "./require-project-permission.decorator.js";

type TestRequest = { headers: Record<string, string>; params: Record<string, string> };

const ORG = "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90";
const USER = "67dcb6b0-14b9-444a-9cf0-6eb033af62b0";
const PROJECT = "22222222-2222-4222-8222-222222222222";

async function requestWithSession(
  organizationRole: string,
  params: Record<string, string> = { projectId: PROJECT },
): Promise<TestRequest> {
  const request: TestRequest = { headers: {}, params };
  const auth = {
    api: {
      getSession: async () => ({
        user: {
          id: USER,
          email: "user@example.com",
          name: "Ada",
          organizationId: ORG,
          organizationRole,
          status: "active",
        },
        session: { id: "session-1", expiresAt: new Date(Date.now() + 60_000) },
      }),
    },
  } as unknown as Auth;

  await resolveRequestSession(auth, request);
  return request;
}

function reflectorReturning(requirement: ProjectPermissionRequirement | undefined): Reflector {
  return { getAllAndOverride: () => requirement } as unknown as Reflector;
}

function queries(
  project: ProjectAccessProject | null,
  membership: ProjectAccessMembership | null,
): ProjectAccessQueries {
  return {
    findProject: async () => project,
    findActiveMembership: async () => membership,
  };
}

function httpContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function requirement(permission: ProjectPermission): ProjectPermissionRequirement {
  return { permission, param: "projectId" };
}

const activeProject: ProjectAccessProject = {
  organizationId: ORG,
  status: "active",
  softDeletedAt: null,
};

const developerMembership: ProjectAccessMembership = {
  role: "Developer",
  status: "active",
  softDeletedAt: null,
};

describe("ProjectAuthorizationGuard", () => {
  it("ignores routes without a permission requirement", async () => {
    const guard = new ProjectAuthorizationGuard(reflectorReturning(undefined), queries(null, null));
    const request = { headers: {}, params: {} };
    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
  });

  it("rejects an unauthenticated request", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:write")),
      queries(activeProject, developerMembership),
    );
    const request: TestRequest = { headers: {}, params: { projectId: PROJECT } };
    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("denies when the project is not in the caller's organization", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:write")),
      // Organization-scoped query returns nothing for a cross-org project id.
      queries(null, null),
    );
    const request = await requestWithSession("member");
    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("denies a member whose role lacks the permission", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:admin")),
      queries(activeProject, developerMembership),
    );
    const request = await requestWithSession("member");
    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("denies a member with no active membership", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:write")),
      queries(activeProject, null),
    );
    const request = await requestWithSession("member");
    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("denies a member mutating an archived project", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:write")),
      queries(
        { organizationId: ORG, status: "archived", softDeletedAt: null },
        developerMembership,
      ),
    );
    const request = await requestWithSession("member");
    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows a Project Owner to perform an archived project admin action", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:admin")),
      queries(
        { organizationId: ORG, status: "archived", softDeletedAt: null },
        { role: "Project Owner", status: "active", softDeletedAt: null },
      ),
    );
    const request = await requestWithSession("member");
    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
  });

  it("denies when the project id is missing from the route", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:write")),
      queries(activeProject, developerMembership),
    );
    const request = await requestWithSession("member", {});
    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rejects an invalid UUID before issuing an authorization query", async () => {
    const findProject = vi.fn();
    const guard = new ProjectAuthorizationGuard(reflectorReturning(requirement("project:write")), {
      findProject,
      findActiveMembership: vi.fn(),
    });
    const request = await requestWithSession("member", { projectId: "not-a-uuid" });

    await expect(guard.canActivate(httpContext(request))).rejects.toThrow("Invalid UUID");
    expect(findProject).not.toHaveBeenCalled();
  });

  it("allows an organization admin to act on a same-org project without a membership", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:write")),
      queries(activeProject, null),
    );
    const request = await requestWithSession("admin");
    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
  });

  it("allows a member with an active membership whose role grants the permission", async () => {
    const guard = new ProjectAuthorizationGuard(
      reflectorReturning(requirement("project:write")),
      queries(activeProject, developerMembership),
    );
    const request = await requestWithSession("member");
    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
  });
});

describe("canAccessProject", () => {
  it("re-exports the pure permission-matrix check", () => {
    expect(
      canAccessProject(
        {
          organizationId: "org-1",
          projectId: "proj-1",
          userId: "user-1",
          role: "Developer",
          visibility: "organization",
        },
        "project:write",
      ),
    ).toBe(true);
    expect(
      canAccessProject(
        {
          organizationId: "org-1",
          projectId: "proj-1",
          userId: "user-1",
          role: "Developer",
          visibility: "organization",
        },
        "project:admin",
      ),
    ).toBe(false);
  });
});
