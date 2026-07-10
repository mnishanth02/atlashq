import { describe, expect, it } from "vitest";
import { listOrganizationUsers } from "./api.js";
import {
  createAgent,
  createOrganization,
  createUserRecord,
  provisionAdmin,
  setUserStatus,
  softDeleteUser,
} from "./fixtures.js";
import { useHarness } from "./suite.js";

const getHarness = useHarness();

describe("integration: organization user directory", () => {
  it("rejects unauthenticated requests with a stable 401 envelope", async () => {
    const harness = getHarness();
    const agent = createAgent(harness);

    const response = await listOrganizationUsers(agent);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
    });
  });

  it("searches by name/email, orders deterministically by name then id, and paginates", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, agent, org.id, { name: "Admin Zed" });

    const grace = await createUserRecord(harness.db, {
      organizationId: org.id,
      name: "Grace Hopper",
      email: "grace.hopper@example.com",
    });
    const ada = await createUserRecord(harness.db, {
      organizationId: org.id,
      name: "Ada Lovelace",
      email: "ada.lovelace@example.com",
    });
    const other = await createUserRecord(harness.db, {
      organizationId: org.id,
      name: "Grace Kelly",
      email: "grace.kelly@example.com",
    });

    // Any active org member (not just admins) may search the directory.
    const searchByName = await listOrganizationUsers(agent, "?search=grace");
    expect(searchByName.status).toBe(200);
    expect(searchByName.body.items.map((item: { id: string }) => item.id).sort()).toEqual(
      [grace.id, other.id].sort(),
    );

    const searchByEmail = await listOrganizationUsers(agent, "?search=ada.lovelace%40example.com");
    expect(searchByEmail.status).toBe(200);
    expect(searchByEmail.body.items.map((item: { id: string }) => item.id)).toEqual([ada.id]);

    // Deterministic name (case-insensitive) then id ordering across the whole org.
    const all = await listOrganizationUsers(agent, "?limit=25");
    expect(all.status).toBe(200);
    const ids = all.body.items.map((item: { id: string; name: string }) => item.id);
    // Alphabetical (case-insensitive) by name: Ada Lovelace, Admin Zed, Grace Hopper, Grace Kelly.
    expect(ids).toEqual([ada.id, admin.id, grace.id, other.id]);

    // Cursor pagination: fetch one at a time and confirm no gaps/duplicates.
    let cursor: string | undefined;
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const query = cursor ? `?limit=1&cursor=${encodeURIComponent(cursor)}` : "?limit=1";
      const page = await listOrganizationUsers(agent, query);
      expect(page.status).toBe(200);
      expect(page.body.items).toHaveLength(1);
      seen.push(page.body.items[0].id);
      cursor = page.body.pageInfo.nextCursor ?? undefined;
      if (i < 3) {
        expect(page.body.pageInfo.hasMore).toBe(true);
      }
    }
    expect(cursor).toBeUndefined();
    expect(seen).toEqual(ids);
  });

  it("returns 400 for a malformed cursor", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    await provisionAdmin(harness, agent, org.id);

    const response = await listOrganizationUsers(agent, "?cursor=not-a-valid-cursor");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ statusCode: 400, code: "BAD_REQUEST" });
  });

  it("returns 400 for an invalid status filter value", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    await provisionAdmin(harness, agent, org.id);

    const response = await listOrganizationUsers(agent, "?status=not-a-real-status");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("filters by active status and excludes soft-deleted users", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    await provisionAdmin(harness, agent, org.id);

    const suspended = await createUserRecord(harness.db, {
      organizationId: org.id,
      name: "Suspended Sam",
    });
    await setUserStatus(harness.db, suspended.id, "suspended");

    const deleted = await createUserRecord(harness.db, {
      organizationId: org.id,
      name: "Deleted Dana",
    });
    await softDeleteUser(harness.db, deleted.id);

    const activeOnly = await listOrganizationUsers(agent, "?status=active&limit=25");
    expect(activeOnly.status).toBe(200);
    const activeIds = activeOnly.body.items.map((item: { id: string }) => item.id);
    expect(activeIds).not.toContain(suspended.id);
    expect(activeIds).not.toContain(deleted.id);

    const suspendedOnly = await listOrganizationUsers(agent, "?status=suspended&limit=25");
    expect(suspendedOnly.status).toBe(200);
    expect(suspendedOnly.body.items.map((item: { id: string }) => item.id)).toEqual([suspended.id]);

    // Soft-deleted users never appear, regardless of filter.
    const everyone = await listOrganizationUsers(agent, "?limit=25");
    expect(everyone.body.items.map((item: { id: string }) => item.id)).not.toContain(deleted.id);
  });

  it("scopes results to the caller's own organization with no cross-org leakage", async () => {
    const harness = getHarness();

    const orgA = await createOrganization(harness.db, { name: "Org A" });
    const agentA = createAgent(harness);
    const { user: adminA } = await provisionAdmin(harness, agentA, orgA.id, { name: "A Admin" });
    const memberA = await createUserRecord(harness.db, {
      organizationId: orgA.id,
      name: "Distinctive Aardvark",
    });

    const orgB = await createOrganization(harness.db, { name: "Org B" });
    const agentB = createAgent(harness);
    const { user: adminB } = await provisionAdmin(harness, agentB, orgB.id, { name: "B Admin" });
    const memberB = await createUserRecord(harness.db, {
      organizationId: orgB.id,
      name: "Distinctive Zebra",
    });

    const resultsA = await listOrganizationUsers(agentA, "?limit=25");
    expect(resultsA.status).toBe(200);
    const idsA = resultsA.body.items.map((item: { id: string }) => item.id);
    expect(idsA.sort()).toEqual([adminA.id, memberA.id].sort());
    expect(idsA).not.toContain(adminB.id);
    expect(idsA).not.toContain(memberB.id);

    const resultsB = await listOrganizationUsers(agentB, "?limit=25");
    expect(resultsB.status).toBe(200);
    const idsB = resultsB.body.items.map((item: { id: string }) => item.id);
    expect(idsB.sort()).toEqual([adminB.id, memberB.id].sort());
    expect(idsB).not.toContain(adminA.id);
    expect(idsB).not.toContain(memberA.id);

    // Cross-org search terms never leak: searching org A for org B's distinctive name is empty.
    const crossSearch = await listOrganizationUsers(agentA, "?search=Zebra");
    expect(crossSearch.status).toBe(200);
    expect(crossSearch.body.items).toEqual([]);
  });

  it("returns only the minimal safe fields", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, agent, org.id, { name: "Field Admin" });

    const response = await listOrganizationUsers(agent, "?limit=25");
    expect(response.status).toBe(200);
    const found = response.body.items.find((item: { id: string }) => item.id === admin.id);
    expect(found).toBeDefined();
    expect(Object.keys(found).sort()).toEqual(
      ["email", "id", "name", "organizationRole", "status"].sort(),
    );
    expect(found.organizationRole).toBe("admin");
    expect(found.status).toBe("active");
  });
});
