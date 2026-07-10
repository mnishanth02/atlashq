import type { Database } from "@atlashq/db";
import { describe, expect, it, vi } from "vitest";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { AuditTransaction } from "../../audit/audit-transaction.js";
import type { AuditWriter } from "../../audit/audit-writer.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { ProjectsService } from "./projects.service.js";
import type {
  AuditRow,
  ClientRow,
  ListPage,
  MembershipDetailRow,
  MembershipRow,
  ProjectDetailRow,
  ProjectRow,
  ProjectsRepository,
  UserRow,
} from "./projects.types.js";

const ORG = "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90";
const ADMIN = "67dcb6b0-14b9-444a-9cf0-6eb033af62b0";
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "55555555-5555-4555-8555-555555555555";
const TECH_LEAD = "66666666-6666-4666-8666-666666666666";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const CLIENT = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP = "44444444-4444-4444-8444-444444444444";

function session(role: "admin" | "member" = "admin"): RequestSessionContext {
  return {
    user: {
      id: ADMIN,
      email: "admin@example.com",
      name: "Ada Lovelace",
      organizationId: ORG,
      organizationRole: role,
      status: "active",
    },
    session: {
      id: "61e6c6c8-6f1a-4c62-84ca-3e4d2a18c2f8",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    },
  };
}

function auditContext(): AuditRequestContext {
  return { actor: { actorId: ADMIN, organizationId: ORG }, correlationId: "corr" };
}

function detailRow(overrides: Partial<ProjectDetailRow> = {}): ProjectDetailRow {
  return {
    id: PROJECT,
    organizationId: ORG,
    clientId: null,
    name: "Apollo",
    type: "internal",
    status: "active",
    ownerId: OWNER,
    techLeadId: null,
    businessOwnerId: null,
    startDate: null,
    targetDate: null,
    currentPhase: "intake",
    tags: [],
    priority: "medium",
    visibility: "organization",
    description: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: ADMIN,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedBy: ADMIN,
    softDeletedAt: null,
    version: 1,
    clientName: null,
    ownerName: "Owner User",
    techLeadName: null,
    businessOwnerName: null,
    ...overrides,
  };
}

function projectRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: PROJECT,
    organizationId: ORG,
    clientId: null,
    name: "Apollo",
    type: "internal",
    status: "active",
    ownerId: OWNER,
    techLeadId: null,
    businessOwnerId: null,
    startDate: null,
    targetDate: null,
    currentPhase: "intake",
    tags: [],
    priority: "medium",
    visibility: "organization",
    description: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: ADMIN,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedBy: ADMIN,
    softDeletedAt: null,
    version: 1,
    ...overrides,
  };
}

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: OWNER,
    organizationId: ORG,
    name: "Owner User",
    email: "owner@example.com",
    status: "active",
    ...overrides,
  };
}

function clientRow(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: CLIENT,
    organizationId: ORG,
    name: "Acme",
    status: "active",
    softDeletedAt: null,
    ...overrides,
  };
}

function membershipRow(overrides: Partial<MembershipRow> = {}): MembershipRow {
  return {
    id: MEMBERSHIP,
    organizationId: ORG,
    projectId: PROJECT,
    userId: OTHER,
    role: "Developer",
    status: "active",
    invitedAt: null,
    invitedBy: null,
    addedAt: new Date("2026-01-01T00:00:00.000Z"),
    addedBy: ADMIN,
    deactivatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: ADMIN,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedBy: ADMIN,
    softDeletedAt: null,
    version: 1,
    ...overrides,
  };
}

function membershipDetailRow(overrides: Partial<MembershipDetailRow> = {}): MembershipDetailRow {
  return {
    ...membershipRow(),
    userName: "Other User",
    userEmail: "other@example.com",
    ...overrides,
  };
}

function auditRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    organizationId: ORG,
    actorId: ADMIN,
    action: "project.create",
    entityType: "project",
    entityId: PROJECT,
    projectId: PROJECT,
    before: null,
    after: {},
    correlationId: "corr",
    at: new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  };
}

function fakeDb(tx: unknown = {}, onCommit?: () => void): Database {
  return {
    async transaction(callback: (transaction: AuditTransaction) => Promise<unknown>) {
      const result = await callback(tx as AuditTransaction);
      onCommit?.();
      return result;
    },
  } as unknown as Database;
}

function fakeAudit(record: ReturnType<typeof vi.fn> = vi.fn()): AuditWriter {
  return { record } as unknown as AuditWriter;
}

/** Read a positional argument from a mock call without fighting inferred empty-tuple arg types. */
function callArg<T = unknown>(
  mock: { mock: { calls: readonly (readonly unknown[])[] } },
  call: number,
  arg: number,
): T {
  return mock.mock.calls[call]?.[arg] as T;
}

function fakeRepository(overrides: Partial<ProjectsRepository> = {}): ProjectsRepository {
  return {
    async listProjects(): Promise<ListPage<ProjectDetailRow>> {
      return { items: [detailRow()], pageInfo: { limit: 25, nextCursor: null, hasMore: false } };
    },
    async findProjectDetail() {
      return detailRow();
    },
    async insertProject() {
      return projectRow();
    },
    async updateProject() {
      return projectRow({ version: 2 });
    },
    async setProjectStatus() {
      return projectRow({ status: "archived", version: 2 });
    },
    async findUser(_handle, _organizationId, userId) {
      return userRow({ id: userId });
    },
    async findClient() {
      return clientRow();
    },
    async findActiveMembership() {
      return null;
    },
    async findMembershipById() {
      return membershipRow();
    },
    async insertMembership() {
      return membershipRow({ role: "Project Owner", userId: OWNER });
    },
    async updateMembership() {
      return membershipRow({ version: 2 });
    },
    async listMemberships(): Promise<ListPage<MembershipDetailRow>> {
      return {
        items: [membershipDetailRow()],
        pageInfo: { limit: 25, nextCursor: null, hasMore: false },
      };
    },
    async listAuditEvents(): Promise<ListPage<AuditRow>> {
      return { items: [auditRow()], pageInfo: { limit: 25, nextCursor: null, hasMore: false } };
    },
    ...overrides,
  };
}

describe("ProjectsService list visibility", () => {
  it("marks organization admins as able to see all projects", async () => {
    const listProjects = vi.fn(fakeRepository().listProjects);
    const service = new ProjectsService(fakeDb(), fakeRepository({ listProjects }), fakeAudit());

    await service.listProjects(session("admin"), {
      limit: 25,
      includeArchived: false,
      sort: "updated_desc",
    });

    expect(listProjects).toHaveBeenCalledTimes(1);
    const query = callArg(listProjects, 0, 1);
    expect(query).toMatchObject({
      isOrganizationAdmin: true,
      organizationId: ORG,
      viewerId: ADMIN,
    });
  });

  it("restricts non-admins to their own memberships", async () => {
    const listProjects = vi.fn(fakeRepository().listProjects);
    const service = new ProjectsService(fakeDb(), fakeRepository({ listProjects }), fakeAudit());

    await service.listProjects(session("member"), {
      limit: 25,
      includeArchived: false,
      sort: "updated_desc",
    });

    expect(callArg(listProjects, 0, 1)).toMatchObject({ isOrganizationAdmin: false });
  });

  it("rejects an invalid list cursor", async () => {
    const service = new ProjectsService(fakeDb(), fakeRepository(), fakeAudit());

    await expect(
      service.listProjects(session(), {
        limit: 25,
        includeArchived: false,
        sort: "updated_desc",
        cursor: "!!!",
      }),
    ).rejects.toThrow();
  });
});

describe("ProjectsService getProject", () => {
  it("returns a not-found error when the project is missing or cross-org", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findProjectDetail: vi.fn(async () => null) }),
      fakeAudit(),
    );

    await expect(service.getProject(session(), PROJECT)).rejects.toThrow("Project not found.");
  });
});

describe("ProjectsService createProject", () => {
  const createInput = {
    name: "Apollo",
    type: "internal" as const,
    ownerId: OWNER,
    status: "draft" as const,
    phase: "intake" as const,
    priority: "medium" as const,
    visibility: "organization" as const,
    tags: [] as string[],
  };

  it("rejects non-admin callers", async () => {
    const service = new ProjectsService(fakeDb(), fakeRepository(), fakeAudit());

    await expect(
      service.createProject(session("member"), createInput, auditContext()),
    ).rejects.toThrow();
  });

  it("uses one transaction handle for the project, owner membership, and both audit records", async () => {
    const tx = { marker: "tx" };
    const insertProject = vi.fn(async (handle: unknown) => {
      expect(handle).toBe(tx);
      return projectRow();
    });
    const insertMembership = vi.fn(async (handle: unknown) => {
      expect(handle).toBe(tx);
      return membershipRow({ role: "Project Owner", userId: OWNER });
    });
    const record = vi.fn(async (transaction: AuditTransaction) => {
      expect(transaction).toBe(tx);
    });
    const service = new ProjectsService(
      fakeDb(tx),
      fakeRepository({ insertProject, insertMembership }),
      fakeAudit(record),
    );

    await service.createProject(session(), createInput, auditContext());

    expect(insertProject).toHaveBeenCalledTimes(1);
    expect(insertMembership).toHaveBeenCalledTimes(1);
    const ownerMembership = callArg(insertMembership, 0, 1);
    expect(ownerMembership).toMatchObject({
      role: "Project Owner",
      status: "active",
      userId: OWNER,
    });
    expect(record).toHaveBeenCalledTimes(2);
    expect(
      (record.mock.calls as unknown[][]).map((call) => (call[1] as { action: string }).action),
    ).toEqual(["project.create", "project.membership.add"]);
  });

  it("rolls back (does not commit) when audit recording fails", async () => {
    let committed = false;
    const service = new ProjectsService(
      fakeDb({ marker: "tx" }, () => {
        committed = true;
      }),
      fakeRepository(),
      fakeAudit(
        vi.fn(async () => {
          throw new Error("audit failed");
        }),
      ),
    );

    await expect(service.createProject(session(), createInput, auditContext())).rejects.toThrow(
      "audit failed",
    );
    expect(committed).toBe(false);
  });

  it("rejects an inactive owner", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findUser: vi.fn(async () => userRow({ status: "invited" })) }),
      fakeAudit(),
    );

    await expect(service.createProject(session(), createInput, auditContext())).rejects.toThrow();
  });

  it("requires an active non-archived client for client projects", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findClient: vi.fn(async () => clientRow({ status: "archived" })) }),
      fakeAudit(),
    );

    await expect(
      service.createProject(
        session(),
        { ...createInput, type: "client", clientId: CLIENT },
        auditContext(),
      ),
    ).rejects.toThrow();
  });

  it("persists the client id for client projects", async () => {
    const insertProject = vi.fn(async () => projectRow({ type: "client", clientId: CLIENT }));
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        insertProject,
        findProjectDetail: vi.fn(async () =>
          detailRow({ type: "client", clientId: CLIENT, clientName: "Acme" }),
        ),
      }),
      fakeAudit(),
    );

    await service.createProject(
      session(),
      { ...createInput, type: "client", clientId: CLIENT },
      auditContext(),
    );

    expect(callArg(insertProject, 0, 1)).toMatchObject({ type: "client", clientId: CLIENT });
  });

  it("forces a null client for internal projects", async () => {
    const insertProject = vi.fn(async () => projectRow());
    const findClient = vi.fn(async () => clientRow());
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ insertProject, findClient }),
      fakeAudit(),
    );

    await service.createProject(session(), createInput, auditContext());

    expect(findClient).not.toHaveBeenCalled();
    expect(callArg(insertProject, 0, 1)).toMatchObject({ clientId: null });
  });
});

describe("ProjectsService updateProject", () => {
  it("rejects updates to a missing project", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findProjectDetail: vi.fn(async () => null) }),
      fakeAudit(),
    );

    await expect(
      service.updateProject(session(), PROJECT, { version: 1, name: "Renamed" }, auditContext()),
    ).rejects.toThrow("Project not found.");
  });

  it("freezes updates on archived projects", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findProjectDetail: vi.fn(async () => detailRow({ status: "archived" })) }),
      fakeAudit(),
    );

    await expect(
      service.updateProject(session(), PROJECT, { version: 1, name: "Renamed" }, auditContext()),
    ).rejects.toThrow();
  });

  it("increments the version and records an update audit", async () => {
    const updateProject = vi.fn(async () => projectRow({ version: 2, name: "Renamed" }));
    const record = vi.fn();
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ updateProject }),
      fakeAudit(record),
    );

    await service.updateProject(
      session(),
      PROJECT,
      { version: 1, name: "Renamed" },
      auditContext(),
    );

    expect(callArg(updateProject, 0, 3)).toBe(1);
    expect((record.mock.calls[0]?.[1] as { action: string }).action).toBe("project.update");
  });

  it("returns a conflict when the optimistic update loses a race", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ updateProject: vi.fn(async () => null) }),
      fakeAudit(),
    );

    await expect(
      service.updateProject(session(), PROJECT, { version: 1, name: "Renamed" }, auditContext()),
    ).rejects.toThrow("modified by another request");
  });

  it("persists explicit nulls for nullable project fields", async () => {
    const updateProject = vi.fn(async () => projectRow({ version: 2 }));
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findProjectDetail: vi.fn(async () =>
          detailRow({
            techLeadId: TECH_LEAD,
            businessOwnerId: OTHER,
            startDate: new Date("2026-04-01T00:00:00.000Z"),
            targetDate: new Date("2026-05-01T00:00:00.000Z"),
            description: "Clear me",
          }),
        ),
        updateProject,
      }),
      fakeAudit(),
    );

    await service.updateProject(
      session(),
      PROJECT,
      {
        version: 1,
        techLeadId: null,
        businessOwnerId: null,
        startDate: null,
        targetDate: null,
        description: null,
      },
      auditContext(),
    );

    expect(callArg(updateProject, 0, 4)).toMatchObject({
      techLeadId: null,
      businessOwnerId: null,
      startDate: null,
      targetDate: null,
      description: null,
    });
  });

  it("clears clientId when changing a client project to internal", async () => {
    const updateProject = vi.fn(async () =>
      projectRow({ version: 2, type: "internal", clientId: null }),
    );
    const findClient = vi.fn();
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findProjectDetail: vi.fn(async () => detailRow({ type: "client", clientId: CLIENT })),
        findClient,
        updateProject,
      }),
      fakeAudit(),
    );

    await service.updateProject(
      session(),
      PROJECT,
      { version: 1, type: "internal" },
      auditContext(),
    );

    expect(findClient).not.toHaveBeenCalled();
    expect(callArg(updateProject, 0, 4)).toMatchObject({ type: "internal", clientId: null });
  });

  it("requires an active client when changing an internal project to client", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findClient: vi.fn(async () => clientRow({ status: "archived" })),
      }),
      fakeAudit(),
    );

    await expect(
      service.updateProject(
        session(),
        PROJECT,
        { version: 1, type: "client", clientId: CLIENT },
        auditContext(),
      ),
    ).rejects.toThrow("active client");
  });

  it("provisions an owner membership when the owner changes and none exists", async () => {
    const insertMembership = vi.fn(async () =>
      membershipRow({ role: "Project Owner", userId: OTHER }),
    );
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findProjectDetail: vi.fn(async () => detailRow({ ownerId: OWNER })),
        findActiveMembership: vi.fn(async () => null),
        insertMembership,
      }),
      fakeAudit(),
    );

    await service.updateProject(session(), PROJECT, { version: 1, ownerId: OTHER }, auditContext());

    expect(insertMembership).toHaveBeenCalledTimes(1);
    expect(callArg(insertMembership, 0, 1)).toMatchObject({
      role: "Project Owner",
      status: "active",
      userId: OTHER,
    });
  });

  it("promotes an existing membership to Project Owner when the owner changes", async () => {
    const updateMembership = vi.fn(async () =>
      membershipRow({ role: "Project Owner", userId: OTHER, version: 2 }),
    );
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findProjectDetail: vi.fn(async () => detailRow({ ownerId: OWNER })),
        findActiveMembership: vi.fn(async () =>
          membershipRow({ userId: OTHER, role: "Developer" }),
        ),
        updateMembership,
      }),
      fakeAudit(),
    );

    await service.updateProject(session(), PROJECT, { version: 1, ownerId: OTHER }, auditContext());

    expect(callArg(updateMembership, 0, 4)).toMatchObject({
      role: "Project Owner",
      status: "active",
    });
  });

  it("re-validates referenced users against the caller's organization", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findUser: vi.fn(async (_handle, _organizationId, userId) =>
          userId === TECH_LEAD
            ? userRow({ id: TECH_LEAD, status: "invited" })
            : userRow({ id: userId }),
        ),
      }),
      fakeAudit(),
    );

    await expect(
      service.updateProject(
        session(),
        PROJECT,
        { version: 1, techLeadId: TECH_LEAD },
        auditContext(),
      ),
    ).rejects.toThrow();
  });

  it("denies a Developer from transferring ownership, including to themselves", async () => {
    const insertMembership = vi.fn();
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findActiveMembership: vi.fn(async () =>
          membershipRow({ userId: ADMIN, role: "Developer" }),
        ),
        insertMembership,
      }),
      fakeAudit(),
    );

    await expect(
      service.updateProject(
        session("member"),
        PROJECT,
        { version: 1, ownerId: ADMIN },
        auditContext(),
      ),
    ).rejects.toThrow("project-admin permission");
    expect(insertMembership).not.toHaveBeenCalled();
  });

  it("allows an active Project Owner membership to transfer ownership", async () => {
    const insertMembership = vi.fn(async () =>
      membershipRow({ role: "Project Owner", userId: OTHER }),
    );
    const findActiveMembership = vi
      .fn()
      .mockResolvedValueOnce(membershipRow({ userId: ADMIN, role: "Project Owner" }))
      .mockResolvedValueOnce(null);
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findActiveMembership, insertMembership }),
      fakeAudit(),
    );

    await service.updateProject(
      session("member"),
      PROJECT,
      { version: 1, ownerId: OTHER },
      auditContext(),
    );

    expect(insertMembership).toHaveBeenCalledTimes(1);
  });
});

describe("ProjectsService archive/restore", () => {
  it("archives an active project and audits the before/after", async () => {
    const setProjectStatus = vi.fn(async () => projectRow({ status: "archived", version: 2 }));
    const record = vi.fn();
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        setProjectStatus,
        findProjectDetail: vi
          .fn()
          .mockResolvedValueOnce(detailRow({ status: "active" }))
          .mockResolvedValueOnce(detailRow({ status: "archived", version: 2 })),
      }),
      fakeAudit(record),
    );

    const response = await service.archiveProject(session(), PROJECT, auditContext());

    expect(callArg(setProjectStatus, 0, 3)).toMatchObject({ status: "archived" });
    expect(response.status).toBe("archived");
    expect((record.mock.calls[0]?.[1] as { action: string }).action).toBe("project.archive");
  });

  it("treats archiving an already-archived project as a no-op", async () => {
    const setProjectStatus = vi.fn();
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        setProjectStatus,
        findProjectDetail: vi.fn(async () => detailRow({ status: "archived" })),
      }),
      fakeAudit(),
    );

    const response = await service.archiveProject(session(), PROJECT, auditContext());

    expect(setProjectStatus).not.toHaveBeenCalled();
    expect(response.status).toBe("archived");
  });

  it("restores an archived project to active", async () => {
    const setProjectStatus = vi.fn(async () => projectRow({ status: "active", version: 2 }));
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        setProjectStatus,
        findProjectDetail: vi
          .fn()
          .mockResolvedValueOnce(detailRow({ status: "archived" }))
          .mockResolvedValueOnce(detailRow({ status: "active", version: 2 })),
      }),
      fakeAudit(),
    );

    const response = await service.restoreProject(session(), PROJECT, auditContext());

    expect(callArg(setProjectStatus, 0, 3)).toMatchObject({ status: "active" });
    expect(response.status).toBe("active");
  });

  it("does not re-activate a project that is not archived", async () => {
    const setProjectStatus = vi.fn();
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        setProjectStatus,
        findProjectDetail: vi.fn(async () => detailRow({ status: "active" })),
      }),
      fakeAudit(),
    );

    await service.restoreProject(session(), PROJECT, auditContext());

    expect(setProjectStatus).not.toHaveBeenCalled();
  });
});

describe("ProjectsService memberships", () => {
  it("rejects membership changes on archived projects", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findProjectDetail: vi.fn(async () => detailRow({ status: "archived" })) }),
      fakeAudit(),
    );

    await expect(
      service.addMembership(
        session(),
        PROJECT,
        { userId: OTHER, role: "Developer" },
        auditContext(),
      ),
    ).rejects.toThrow();
  });

  it("rejects a duplicate active membership", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findActiveMembership: vi.fn(async () => membershipRow()) }),
      fakeAudit(),
    );

    await expect(
      service.addMembership(
        session(),
        PROJECT,
        { userId: OTHER, role: "Developer" },
        auditContext(),
      ),
    ).rejects.toThrow();
  });

  it("adds an active membership for an active same-org user", async () => {
    const insertMembership = vi.fn(async () => membershipRow({ userId: OTHER, role: "Developer" }));
    const record = vi.fn();
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findActiveMembership: vi.fn(async () => null), insertMembership }),
      fakeAudit(record),
    );

    await service.addMembership(
      session(),
      PROJECT,
      { userId: OTHER, role: "Developer" },
      auditContext(),
    );

    expect(insertMembership).toHaveBeenCalledTimes(1);
    expect((record.mock.calls[0]?.[1] as { action: string }).action).toBe("project.membership.add");
  });

  it("prevents demoting the current owner's membership role", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findProjectDetail: vi.fn(async () => detailRow({ ownerId: OWNER })),
        findMembershipById: vi.fn(async () =>
          membershipRow({ userId: OWNER, role: "Project Owner" }),
        ),
      }),
      fakeAudit(),
    );

    await expect(
      service.updateMembership(
        session(),
        PROJECT,
        MEMBERSHIP,
        { role: "Developer" },
        auditContext(),
      ),
    ).rejects.toThrow();
  });

  it("prevents deactivating the current owner's membership", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findProjectDetail: vi.fn(async () => detailRow({ ownerId: OWNER })),
        findMembershipById: vi.fn(async () =>
          membershipRow({ userId: OWNER, role: "Project Owner" }),
        ),
      }),
      fakeAudit(),
    );

    await expect(
      service.updateMembership(
        session(),
        PROJECT,
        MEMBERSHIP,
        { status: "removed" },
        auditContext(),
      ),
    ).rejects.toThrow();
  });

  it("updates a non-owner membership", async () => {
    const updateMembership = vi.fn(async () =>
      membershipRow({ userId: OTHER, role: "QA", version: 2 }),
    );
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findMembershipById: vi.fn(async () => membershipRow({ userId: OTHER, role: "Developer" })),
        updateMembership,
      }),
      fakeAudit(),
    );

    await service.updateMembership(session(), PROJECT, MEMBERSHIP, { role: "QA" }, auditContext());

    expect(callArg(updateMembership, 0, 4)).toMatchObject({ role: "QA" });
  });

  it("refuses to remove the current owner's membership", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findProjectDetail: vi.fn(async () => detailRow({ ownerId: OWNER })),
        findMembershipById: vi.fn(async () =>
          membershipRow({ userId: OWNER, role: "Project Owner" }),
        ),
      }),
      fakeAudit(),
    );

    await expect(
      service.removeMembership(session(), PROJECT, MEMBERSHIP, auditContext()),
    ).rejects.toThrow();
  });

  it("soft-deletes (deactivates) a non-owner membership", async () => {
    const updateMembership = vi.fn(async () =>
      membershipRow({ userId: OTHER, status: "removed", version: 2 }),
    );
    const record = vi.fn();
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({
        findMembershipById: vi.fn(async () => membershipRow({ userId: OTHER })),
        updateMembership,
      }),
      fakeAudit(record),
    );

    await service.removeMembership(session(), PROJECT, MEMBERSHIP, auditContext());

    const values = callArg<{
      status: string;
      softDeletedAt: Date | null;
      deactivatedAt: Date | null;
    }>(updateMembership, 0, 4);
    expect(values.status).toBe("removed");
    expect(values.softDeletedAt).toBeInstanceOf(Date);
    expect(values.deactivatedAt).toBeInstanceOf(Date);
    expect((record.mock.calls[0]?.[1] as { action: string }).action).toBe(
      "project.membership.remove",
    );
  });
});

describe("ProjectsService dashboard & audit", () => {
  it("returns Module 1 zero-state dashboard cards", async () => {
    const service = new ProjectsService(fakeDb(), fakeRepository(), fakeAudit());

    const dashboard = await service.getDashboard(session(), PROJECT);

    expect(dashboard.cards.sourceDocuments.state).toBe("not_started");
    expect(dashboard.project.id).toBe(PROJECT);
  });

  it("returns a not-found error for a dashboard on a missing project", async () => {
    const service = new ProjectsService(
      fakeDb(),
      fakeRepository({ findProjectDetail: vi.fn(async () => null) }),
      fakeAudit(),
    );

    await expect(service.getDashboard(session(), PROJECT)).rejects.toThrow("Project not found.");
  });

  it("lists project-scoped audit events and forwards the project id", async () => {
    const listAuditEvents = vi.fn(fakeRepository().listAuditEvents);
    const service = new ProjectsService(fakeDb(), fakeRepository({ listAuditEvents }), fakeAudit());

    const response = await service.listAuditEvents(session(), PROJECT, { limit: 25 });

    expect(response.items).toHaveLength(1);
    expect(callArg(listAuditEvents, 0, 1)).toMatchObject({
      projectId: PROJECT,
      organizationId: ORG,
    });
  });

  it("rejects an invalid audit cursor", async () => {
    const service = new ProjectsService(fakeDb(), fakeRepository(), fakeAudit());

    await expect(
      service.listAuditEvents(session(), PROJECT, { limit: 25, cursor: "!!!" }),
    ).rejects.toThrow();
  });
});

describe("ProjectsService null runtime", () => {
  it("throws only when a database operation is attempted", async () => {
    const service = new ProjectsService(null, fakeRepository(), fakeAudit());

    await expect(service.getProject(session(), PROJECT)).rejects.toThrow(
      "Database client is not available",
    );
  });
});
