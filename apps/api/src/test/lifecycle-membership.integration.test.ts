import { describe, expect, it } from "vitest";
import {
  addMembership,
  archiveProject,
  createProject,
  findAuditEvents,
  listMemberships,
  removeMembership,
  restoreProject,
  updateMembership,
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

describe("integration: project lifecycle and membership governance", () => {
  it("lets a Project Owner archive and restore, and freezes mutations while archived", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const adminAgent = createAgent(harness);
    await provisionAdmin(harness, adminAgent, org.id);

    // A non-admin who owns the project through the auto-created Project Owner membership.
    const ownerAgent = createAgent(harness);
    const { user: owner } = await signUp(harness, ownerAgent, { organizationId: org.id });
    const project = await createProject(adminAgent, {
      name: "Owned",
      type: "internal",
      ownerId: owner.id,
    });
    const projectId: string = project.body.id;

    // The Project Owner (not an org admin) can archive their own project.
    const archived = await archiveProject(ownerAgent, projectId);
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe("archived");

    // While archived, normal writes are frozen at the guard (project:write denied).
    const frozenUpdate = await updateProject(ownerAgent, projectId, {
      version: archived.body.version,
      name: "Nope",
    });
    expect(frozenUpdate.status).toBe(403);
    expect(frozenUpdate.body.message).toBe("Project access denied.");

    // Membership changes pass the guard (project:admin) but are frozen by the service.
    const target = await createUserRecord(harness.db, { organizationId: org.id });
    const frozenMembership = await addMembership(ownerAgent, projectId, {
      userId: target.id,
      role: "Developer",
    });
    expect(frozenMembership.status).toBe(403);
    expect(frozenMembership.body.message).toBe(
      "Archived projects must be restored before membership changes.",
    );

    // The Project Owner can restore, which lifts the freeze.
    const restored = await restoreProject(ownerAgent, projectId);
    expect(restored.status).toBe(200);
    expect(restored.body.status).toBe("active");

    const updateAfterRestore = await updateProject(ownerAgent, projectId, {
      version: restored.body.version,
      name: "Owned Again",
    });
    expect(updateAfterRestore.status).toBe(200);
    expect(updateAfterRestore.body.name).toBe("Owned Again");
  });

  it("audits membership add/change/remove and protects the owner membership", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const adminAgent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, adminAgent, org.id);

    const project = await createProject(adminAgent, {
      name: "Governed",
      type: "internal",
      ownerId: admin.id,
    });
    const projectId: string = project.body.id;

    const target = await createUserRecord(harness.db, { organizationId: org.id });

    // Add -> change -> remove, each producing exactly one audit event.
    const added = await addMembership(adminAgent, projectId, {
      userId: target.id,
      role: "Developer",
    });
    expect(added.status).toBe(201);
    const membershipId: string = added.body.id;

    const changed = await updateMembership(adminAgent, projectId, membershipId, { role: "QA" });
    expect(changed.status).toBe(200);
    expect(changed.body.role).toBe("QA");

    const removedResponse = await removeMembership(adminAgent, projectId, membershipId);
    expect(removedResponse.status).toBe(200);
    expect(removedResponse.body.status).toBe("removed");

    const membershipAudits = await findAuditEvents(harness.db, { entityId: membershipId });
    const actions = membershipAudits.map((row) => row.action).sort();
    expect(actions).toEqual([
      "project.membership.add",
      "project.membership.remove",
      "project.membership.update",
    ]);

    // Locate the auto-created owner membership.
    const memberships = await listMemberships(adminAgent, projectId);
    const ownerMembership = memberships.body.items.find(
      (item: { userId: string; role: string }) =>
        item.userId === admin.id && item.role === "Project Owner",
    );
    expect(ownerMembership).toBeTruthy();
    const ownerMembershipId: string = ownerMembership.id;

    // The current owner's membership cannot be demoted, deactivated or removed.
    const demote = await updateMembership(adminAgent, projectId, ownerMembershipId, {
      role: "Developer",
    });
    expect(demote.status).toBe(403);
    expect(demote.body.message).toBe(
      "Change the project owner before demoting the current owner's role.",
    );

    const deactivate = await updateMembership(adminAgent, projectId, ownerMembershipId, {
      status: "removed",
    });
    expect(deactivate.status).toBe(403);
    expect(deactivate.body.message).toBe(
      "Change the project owner before deactivating the current owner's membership.",
    );

    const remove = await removeMembership(adminAgent, projectId, ownerMembershipId);
    expect(remove.status).toBe(403);
    expect(remove.body.message).toBe(
      "Change the project owner before removing the current owner's membership.",
    );
  });
});
