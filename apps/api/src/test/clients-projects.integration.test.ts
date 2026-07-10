import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  addMembership,
  archiveClient,
  archiveProject,
  createClient,
  createProject,
  findAuditEvents,
  getClient,
  getProject,
  listMemberships,
  listProjectAuditEvents,
  listProjects,
  updateClient,
  updateProject,
} from "./api.js";
import {
  createAgent,
  createOrganization,
  createUserRecord,
  provisionAdmin,
  signUp,
} from "./fixtures.js";
import { useHarness } from "./suite.js";

const getHarness = useHarness();

describe("integration: clients and client projects", () => {
  it("atomically creates a project, Project Owner membership and both audit events", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db, { name: "Owner Org" });
    const agent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, agent, org.id);

    const clientCorrelation = `corr-${randomUUID()}`;
    const clientResponse = await createClient(agent, { name: "Globex" }, clientCorrelation);
    expect(clientResponse.status).toBe(201);
    const clientId: string = clientResponse.body.id;
    expect(clientResponse.body).toMatchObject({ name: "Globex", status: "active" });

    const clientAudits = await findAuditEvents(harness.db, {
      entityId: clientId,
      action: "client.create",
    });
    expect(clientAudits).toHaveLength(1);
    expect(clientAudits[0]?.correlationId).toBe(clientCorrelation);

    const projectCorrelation = `corr-${randomUUID()}`;
    const projectResponse = await createProject(
      agent,
      { name: "Migration", type: "client", clientId, ownerId: admin.id },
      projectCorrelation,
    );
    expect(projectResponse.status).toBe(201);
    const projectId: string = projectResponse.body.id;
    expect(projectResponse.body).toMatchObject({
      name: "Migration",
      type: "client",
      clientId,
      ownerId: admin.id,
      status: "draft",
    });

    // The project row is readable.
    const fetched = await getProject(agent, projectId);
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(projectId);

    // A single active Project Owner membership was created for the owner.
    const memberships = await listMemberships(agent, projectId);
    expect(memberships.status).toBe(200);
    expect(memberships.body.items).toHaveLength(1);
    expect(memberships.body.items[0]).toMatchObject({
      userId: admin.id,
      role: "Project Owner",
      status: "active",
    });

    // Both audit events committed atomically with the project + membership, tagged with the
    // request correlation id.
    const projectAudits = await findAuditEvents(harness.db, { projectId });
    const actions = projectAudits.map((row) => row.action).sort();
    expect(actions).toEqual(["project.create", "project.membership.add"]);
    for (const row of projectAudits) {
      expect(row.correlationId).toBe(projectCorrelation);
      expect(row.organizationId).toBe(org.id);
      expect(row.actorId).toBe(admin.id);
    }

    // The same events surface through the read API, newest first.
    const auditApi = await listProjectAuditEvents(agent, projectId);
    expect(auditApi.status).toBe(200);
    const apiActions = auditApi.body.items.map((item: { action: string }) => item.action);
    expect(apiActions).toContain("project.create");
    expect(apiActions).toContain("project.membership.add");
  });

  it("rejects a client project for an archived client on create and update", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, agent, org.id);

    // Archive a client, then try to build a new project on it.
    const archivedClient = await createClient(agent, { name: "Sunset Co" });
    const archivedClientId: string = archivedClient.body.id;
    const archived = await archiveClient(agent, archivedClientId);
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe("archived");

    const createOnArchived = await createProject(agent, {
      name: "Blocked",
      type: "client",
      clientId: archivedClientId,
      ownerId: admin.id,
    });
    expect(createOnArchived.status).toBe(400);
    expect(createOnArchived.body).toMatchObject({
      statusCode: 400,
      message: "Client projects require an active client in your organization.",
    });

    // A live project cannot be repointed at the archived client either.
    const activeClient = await createClient(agent, { name: "Active Co" });
    const activeClientId: string = activeClient.body.id;
    const project = await createProject(agent, {
      name: "Live",
      type: "client",
      clientId: activeClientId,
      ownerId: admin.id,
    });
    expect(project.status).toBe(201);

    const repoint = await updateProject(agent, project.body.id, {
      version: project.body.version,
      clientId: archivedClientId,
    });
    expect(repoint.status).toBe(400);
    expect(repoint.body.message).toBe(
      "Client projects require an active client in your organization.",
    );
  });

  it("returns stable 400 validation errors for invalid UUID-backed request fields", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, agent, org.id);
    const project = await createProject(agent, {
      name: "UUID checks",
      type: "internal",
      ownerId: admin.id,
    });

    const responses = [
      await getClient(agent, "not-a-uuid"),
      await getProject(agent, "not-a-uuid"),
      await createProject(agent, {
        name: "Invalid owner",
        type: "internal",
        ownerId: "not-a-uuid",
      }),
      await listProjects(agent, "?ownerId=not-a-uuid"),
      await addMembership(agent, project.body.id, {
        userId: "not-a-uuid",
        role: "Developer",
      }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
      });
    }
  });

  it("parses includeArchived explicitly and includes archived status without a second toggle", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, agent, org.id);
    const active = await createProject(agent, {
      name: "Active project",
      type: "internal",
      ownerId: admin.id,
    });
    const archivedProject = await createProject(agent, {
      name: "Archived project",
      type: "internal",
      ownerId: admin.id,
    });
    await archiveProject(agent, archivedProject.body.id);

    const explicitFalse = await listProjects(agent, "?includeArchived=false");
    expect(explicitFalse.status).toBe(200);
    expect(explicitFalse.body.items.map((item: { id: string }) => item.id)).toEqual([
      active.body.id,
    ]);

    const archivedOnly = await listProjects(agent, "?status=archived");
    expect(archivedOnly.status).toBe(200);
    expect(archivedOnly.body.items.map((item: { id: string }) => item.id)).toEqual([
      archivedProject.body.id,
    ]);

    const invalidBoolean = await listProjects(agent, "?includeArchived=yes");
    expect(invalidBoolean.status).toBe(400);
    expect(invalidBoolean.body.code).toBe("VALIDATION_ERROR");
  });

  it("paginates deterministically for every supported project sort and rejects sort mismatches", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, agent, org.id);

    for (const name of ["Zulu", "alpha", "Bravo"]) {
      const response = await createProject(agent, {
        name,
        type: "internal",
        ownerId: admin.id,
      });
      expect(response.status).toBe(201);
    }

    const sorts = ["updated_desc", "updated_asc", "name_asc", "name_desc"] as const;
    for (const sort of sorts) {
      const first = await listProjects(agent, `?limit=2&sort=${sort}`);
      expect(first.status).toBe(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.pageInfo.hasMore).toBe(true);

      const cursor = encodeURIComponent(first.body.pageInfo.nextCursor);
      const second = await listProjects(agent, `?limit=2&sort=${sort}&cursor=${cursor}`);
      expect(second.status).toBe(200);

      const items = [...first.body.items, ...second.body.items] as Array<{
        id: string;
        name: string;
        updatedAt: string;
      }>;
      expect(new Set(items.map((item) => item.id)).size).toBe(3);

      const sorted = [...items].sort((left, right) => {
        if (sort.startsWith("updated_")) {
          const result =
            left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id);
          return sort === "updated_asc" ? result : -result;
        }
        const result =
          left.name.toLowerCase().localeCompare(right.name.toLowerCase()) ||
          left.id.localeCompare(right.id);
        return sort === "name_asc" ? result : -result;
      });
      expect(items.map((item) => item.id)).toEqual(sorted.map((item) => item.id));
    }

    const namePage = await listProjects(agent, "?limit=1&sort=name_asc");
    const mismatched = await listProjects(
      agent,
      `?limit=1&sort=name_desc&cursor=${encodeURIComponent(namePage.body.pageInfo.nextCursor)}`,
    );
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.message).toBe("Project cursor does not match the requested sort.");
  });

  it("uses optimistic concurrency for project and client PATCH operations", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, agent, org.id);

    const client = await createClient(agent, { name: "Versioned client" });
    const clientUpdate = await updateClient(agent, client.body.id, {
      version: client.body.version,
      name: "Client v2",
    });
    expect(clientUpdate.status).toBe(200);
    expect(clientUpdate.body.version).toBe(client.body.version + 1);
    const staleClient = await updateClient(agent, client.body.id, {
      version: client.body.version,
      name: "Stale client",
    });
    expect(staleClient.status).toBe(409);

    const project = await createProject(agent, {
      name: "Versioned project",
      type: "internal",
      ownerId: admin.id,
    });
    const projectUpdate = await updateProject(agent, project.body.id, {
      version: project.body.version,
      name: "Project v2",
    });
    expect(projectUpdate.status).toBe(200);
    expect(projectUpdate.body.version).toBe(project.body.version + 1);
    const staleProject = await updateProject(agent, project.body.id, {
      version: project.body.version,
      name: "Stale project",
    });
    expect(staleProject.status).toBe(409);
    expect(staleProject.body.code).toBe("CONFLICT");

    const missingVersion = await updateProject(agent, project.body.id, { name: "No version" });
    expect(missingVersion.status).toBe(400);
  });

  it("enforces authoritative project-admin permission for ownership transfers", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const adminAgent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, adminAgent, org.id);
    const ownerAgent = createAgent(harness);
    const { user: owner } = await signUp(harness, ownerAgent, { organizationId: org.id });
    const developerAgent = createAgent(harness);
    const { user: developer } = await signUp(harness, developerAgent, {
      organizationId: org.id,
    });
    const target = await createUserRecord(harness.db, { organizationId: org.id });

    const project = await createProject(adminAgent, {
      name: "Transfer governance",
      type: "internal",
      ownerId: owner.id,
    });
    await addMembership(adminAgent, project.body.id, {
      userId: developer.id,
      role: "Developer",
    });

    const selfPromotion = await updateProject(developerAgent, project.body.id, {
      version: project.body.version,
      ownerId: developer.id,
    });
    expect(selfPromotion.status).toBe(403);
    expect(selfPromotion.body.message).toBe(
      "Changing the project owner requires project-admin permission.",
    );

    const ownerTransfer = await updateProject(ownerAgent, project.body.id, {
      version: project.body.version,
      ownerId: target.id,
    });
    expect(ownerTransfer.status).toBe(200);
    expect(ownerTransfer.body.ownerId).toBe(target.id);

    const adminTransfer = await updateProject(adminAgent, project.body.id, {
      version: ownerTransfer.body.version,
      ownerId: admin.id,
    });
    expect(adminTransfer.status).toBe(200);
    expect(adminTransfer.body.ownerId).toBe(admin.id);

    const memberships = await listMemberships(adminAgent, project.body.id);
    expect(
      memberships.body.items.some(
        (membership: { userId: string; role: string; status: string }) =>
          membership.userId === admin.id &&
          membership.role === "Project Owner" &&
          membership.status === "active",
      ),
    ).toBe(true);
  });
});
