import { describe, expect, it, vi } from "vitest";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { ProjectsController } from "./projects.controller.js";
import type { ProjectsService } from "./projects.service.js";

const ORG = "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90";
const ADMIN = "67dcb6b0-14b9-444a-9cf0-6eb033af62b0";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const MEMBERSHIP = "44444444-4444-4444-8444-444444444444";

function session(): RequestSessionContext {
  return {
    user: {
      id: ADMIN,
      email: "admin@example.com",
      name: "Ada Lovelace",
      organizationId: ORG,
      organizationRole: "admin",
      status: "active",
    },
    session: {
      id: "61e6c6c8-6f1a-4c62-84ca-3e4d2a18c2f8",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    },
  };
}

const expectedContext: AuditRequestContext = {
  actor: { actorId: ADMIN, organizationId: ORG },
  correlationId: "corr-123",
};

function request() {
  return { headers: { "x-correlation-id": "corr-123" } };
}

function callArg<T = unknown>(
  mock: { mock: { calls: readonly (readonly unknown[])[] } },
  call: number,
  arg: number,
): T {
  return mock.mock.calls[call]?.[arg] as T;
}

describe("ProjectsController audit-context forwarding", () => {
  it("forwards the resolved audit context to createProject", async () => {
    const createProject = vi.fn(async () => ({}) as never);
    const controller = new ProjectsController({ createProject } as unknown as ProjectsService);

    await controller.createProject(session(), request(), {
      name: "Apollo",
      type: "internal",
      ownerId: ADMIN,
    } as never);

    expect(callArg(createProject, 0, 2)).toEqual(expectedContext);
  });

  it("forwards path params and audit context to updateProject", async () => {
    const updateProject = vi.fn(async () => ({}) as never);
    const controller = new ProjectsController({ updateProject } as unknown as ProjectsService);

    await controller.updateProject(
      session(),
      request(),
      { projectId: PROJECT } as never,
      { name: "Renamed" } as never,
    );

    expect(callArg(updateProject, 0, 1)).toBe(PROJECT);
    expect(callArg(updateProject, 0, 3)).toEqual(expectedContext);
  });

  it("forwards both path params and audit context to removeMembership", async () => {
    const removeMembership = vi.fn(async () => ({}) as never);
    const controller = new ProjectsController({ removeMembership } as unknown as ProjectsService);

    await controller.removeMembership(session(), request(), {
      projectId: PROJECT,
      membershipId: MEMBERSHIP,
    } as never);

    expect(callArg(removeMembership, 0, 1)).toBe(PROJECT);
    expect(callArg(removeMembership, 0, 2)).toBe(MEMBERSHIP);
    expect(callArg(removeMembership, 0, 3)).toEqual(expectedContext);
  });
});
