import { describe, expect, it } from "vitest";
import {
  addMembership,
  archiveClient,
  archiveProject,
  createClient,
  createProject,
  getClient,
  getProject,
  listProjects,
  removeMembership,
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

describe("integration: tenancy isolation and role-based access control", () => {
  it("lists only projects with an active membership role that grants project:read", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const adminAgent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, adminAgent, org.id);

    const memberAgent = createAgent(harness);
    const { user: member } = await signUp(harness, memberAgent, { organizationId: org.id });
    const clientViewerAgent = createAgent(harness);
    const { user: clientViewer } = await signUp(harness, clientViewerAgent, {
      organizationId: org.id,
    });

    const visible = await createProject(adminAgent, {
      name: "Visible",
      type: "internal",
      ownerId: admin.id,
    });
    const visibleId: string = visible.body.id;
    const hidden = await createProject(adminAgent, {
      name: "Hidden",
      type: "internal",
      ownerId: admin.id,
    });
    const hiddenId: string = hidden.body.id;

    // Active membership on the visible project only.
    const activeMembership = await addMembership(adminAgent, visibleId, {
      userId: member.id,
      role: "Developer",
    });
    expect(activeMembership.status).toBe(201);
    const noReadMembership = await addMembership(adminAgent, visibleId, {
      userId: clientViewer.id,
      role: "Client Viewer / Approver",
    });
    expect(noReadMembership.status).toBe(201);

    // A membership on the hidden project that is then removed must not grant visibility.
    const removable = await addMembership(adminAgent, hiddenId, {
      userId: member.id,
      role: "Developer",
    });
    expect(removable.status).toBe(201);
    const removed = await removeMembership(adminAgent, hiddenId, removable.body.id);
    expect(removed.status).toBe(200);

    const projects = await listProjects(memberAgent);
    expect(projects.status).toBe(200);
    const ids = projects.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(visibleId);
    expect(ids).not.toContain(hiddenId);

    const clientViewerProjects = await listProjects(clientViewerAgent);
    expect(clientViewerProjects.status).toBe(200);
    expect(clientViewerProjects.body.items).toEqual([]);
  });

  it("cannot read or mutate another organization's project or client", async () => {
    const harness = getHarness();

    const orgA = await createOrganization(harness.db, { name: "Org A" });
    const adminA = createAgent(harness);
    const { user: ownerA } = await provisionAdmin(harness, adminA, orgA.id);
    const project = await createProject(adminA, {
      name: "A-Project",
      type: "internal",
      ownerId: ownerA.id,
    });
    const projectId: string = project.body.id;
    const client = await createClient(adminA, { name: "A-Client" });
    const clientId: string = client.body.id;

    const orgB = await createOrganization(harness.db, { name: "Org B" });
    const adminB = createAgent(harness);
    await provisionAdmin(harness, adminB, orgB.id);

    // Cross-organization project ids resolve to a deny-by-default 403 (never a leak).
    for (const response of [
      await getProject(adminB, projectId),
      await updateProject(adminB, projectId, { version: project.body.version, name: "hijack" }),
      await archiveProject(adminB, projectId),
    ]) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        statusCode: 403,
        code: "ACCESS_DENIED",
        message: "Project access denied.",
      });
    }

    // Cross-organization client ids are invisible: the org-scoped lookup 404s.
    for (const response of [
      await getClient(adminB, clientId),
      await updateClient(adminB, clientId, { version: client.body.version, name: "hijack" }),
      await archiveClient(adminB, clientId),
    ]) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        code: "RESOURCE_NOT_FOUND",
        message: "Client not found.",
      });
    }
  });

  it("denies a Developer membership the project:admin actions while allowing read/write", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const adminAgent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, adminAgent, org.id);

    const project = await createProject(adminAgent, {
      name: "Dev Project",
      type: "internal",
      ownerId: admin.id,
    });
    const projectId: string = project.body.id;

    const devAgent = createAgent(harness);
    const { user: developer } = await signUp(harness, devAgent, { organizationId: org.id });
    const added = await addMembership(adminAgent, projectId, {
      userId: developer.id,
      role: "Developer",
    });
    expect(added.status).toBe(201);

    // project:read and project:write are granted to Developer.
    const read = await getProject(devAgent, projectId);
    expect(read.status).toBe(200);
    const write = await updateProject(devAgent, projectId, {
      version: project.body.version,
      name: "Dev Renamed",
    });
    expect(write.status).toBe(200);
    expect(write.body.name).toBe("Dev Renamed");

    // project:admin actions (membership management, archive) are denied.
    const target = await createUserRecord(harness.db, { organizationId: org.id });
    const membershipAttempt = await addMembership(devAgent, projectId, {
      userId: target.id,
      role: "QA",
    });
    expect(membershipAttempt.status).toBe(403);
    expect(membershipAttempt.body).toMatchObject({
      statusCode: 403,
      code: "ACCESS_DENIED",
      message: "Project access denied.",
    });

    const archiveAttempt = await archiveProject(devAgent, projectId);
    expect(archiveAttempt.status).toBe(403);
    expect(archiveAttempt.body.message).toBe("Project access denied.");
  });
});
