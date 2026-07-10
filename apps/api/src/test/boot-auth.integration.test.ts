import { randomUUID } from "node:crypto";
import { correlationIdHeader } from "@atlashq/logger";
import { describe, expect, it } from "vitest";
import { createClient, listClients, listProjects } from "./api.js";
import {
  API_PREFIX,
  attemptPublicSignUp,
  createAgent,
  createOrganization,
  getAuthSession,
  provisionAdmin,
  signIn,
  signOut,
  signUp,
} from "./fixtures.js";
import { useHarness } from "./suite.js";

const getHarness = useHarness();

describe("integration: boot, migrations and authentication", () => {
  it("serves health and proves migrations 0000-0005 applied without live S3/Redis", async () => {
    const harness = getHarness();
    const agent = createAgent(harness);

    const health = await agent.get(`${API_PREFIX}/health`);
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: "ok", service: "api", version: "0.0.0" });

    // Migration 0000 (text-search extensions).
    const extensions = await harness.client.pool.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent') ORDER BY extname",
    );
    expect(extensions.rows.map((row) => row.extname)).toEqual(["pg_trgm", "unaccent"]);

    // Migration 0004-0005 (append-only audit guard triggers).
    const triggers = await harness.client.pool.query<{ tgname: string }>(
      "SELECT tgname FROM pg_trigger WHERE tgname IN ('audit_event_no_update', 'audit_event_no_delete', 'audit_event_no_truncate') ORDER BY tgname",
    );
    expect(triggers.rows.map((row) => row.tgname)).toEqual([
      "audit_event_no_delete",
      "audit_event_no_truncate",
      "audit_event_no_update",
    ]);

    // Migration 0001-0002 core tables exist (organization + rate_limit).
    const tables = await harness.client.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('organization', 'user', 'client', 'project', 'project_membership', 'audit_event', 'rate_limit')",
    );
    expect(tables.rows[0]?.count).toBe("7");
  });

  it("rejects unauthenticated /me, /clients and /projects with a stable 401 envelope", async () => {
    const harness = getHarness();
    const agent = createAgent(harness);

    for (const response of [
      await agent.get(`${API_PREFIX}/me`),
      await listClients(agent),
      await listProjects(agent),
    ]) {
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required.",
      });
      expect(typeof response.body.correlationId).toBe("string");
    }
  });

  it("rejects public email/password sign-up on the mounted app while login stays enabled", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db, { name: "Closed Signup Org" });
    const agent = createAgent(harness);

    // Public self sign-up is closed: an unauthenticated caller cannot enrol into
    // a tenant by supplying a known organizationId.
    const rejected = await attemptPublicSignUp(harness, agent, { organizationId: org.id });
    expect(rejected.status).toBe(400);
    expect(rejected.body).toMatchObject({ code: "EMAIL_PASSWORD_SIGN_UP_DISABLED" });

    // No user was created and no session cookie was issued.
    const session = await getAuthSession(agent);
    expect(session.status).toBe(200);
    expect(session.body?.user).toBeFalsy();
    const me = await agent.get(`${API_PREFIX}/me`);
    expect(me.status).toBe(401);

    // Login still works for a trusted-provisioned user, proving only sign-up is closed.
    const loginAgent = createAgent(harness);
    const { email, password, user } = await signUp(harness, loginAgent, {
      organizationId: org.id,
    });
    const afterProvision = await loginAgent.get(`${API_PREFIX}/me`);
    expect(afterProvision.status).toBe(200);
    expect(afterProvision.body.user.id).toBe(user.id);

    const reSignInAgent = createAgent(harness);
    const signedIn = await signIn(harness, reSignInAgent, { email, password });
    expect(signedIn.status).toBe(200);
    const reAuthed = await reSignInAgent.get(`${API_PREFIX}/me`);
    expect(reAuthed.status).toBe(200);
    expect(reAuthed.body.user.id).toBe(user.id);
  });

  it("supports sign-up, session, sign-out and sign-in with cookie preservation", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db, { name: "Acme" });
    const agent = createAgent(harness);

    const { email, password, user } = await signUp(harness, agent, { organizationId: org.id });

    const session = await getAuthSession(agent);
    expect(session.status).toBe(200);
    expect(session.body?.user?.id).toBe(user.id);

    const me = await agent.get(`${API_PREFIX}/me`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      user: {
        id: user.id,
        email,
        organizationId: org.id,
        organizationRole: "member",
        status: "active",
      },
    });
    expect(me.body.session.id).toBeTruthy();

    const currentOrg = await agent.get(`${API_PREFIX}/organizations/current`);
    expect(currentOrg.status).toBe(200);
    expect(currentOrg.body).toMatchObject({ id: org.id, name: "Acme", role: "member" });

    // Sign out invalidates the cookie; /me becomes unauthenticated.
    const signedOut = await signOut(harness, agent);
    expect(signedOut.status).toBe(200);
    const afterSignOut = await agent.get(`${API_PREFIX}/me`);
    expect(afterSignOut.status).toBe(401);

    // Sign back in; the agent re-acquires a valid session cookie.
    const signedIn = await signIn(harness, agent, { email, password });
    expect(signedIn.status).toBe(200);
    const afterSignIn = await agent.get(`${API_PREFIX}/me`);
    expect(afterSignIn.status).toBe(200);
    expect(afterSignIn.body.user.id).toBe(user.id);
  });

  it("returns stable 400 Zod error details and echoes the correlation id", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    await provisionAdmin(harness, agent, org.id);

    const correlationId = `corr-${randomUUID()}`;
    const response = await createClient(agent, { name: "" }, correlationId);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      correlationId,
    });
    expect(response.headers).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);
    for (const detail of response.body.details) {
      expect(Array.isArray(detail.path)).toBe(true);
      expect(typeof detail.message).toBe("string");
      expect(typeof detail.code).toBe("string");
    }
    expect(
      response.body.details.some((detail: { path: unknown[] }) => detail.path.includes("name")),
    ).toBe(true);
  });

  it("resolves the correlation id from the x-correlation-id header on the request logger", async () => {
    const harness = getHarness();
    const agent = createAgent(harness);
    const correlationId = `corr-${randomUUID()}`;

    const response = await agent.get(`${API_PREFIX}/me`).set(correlationIdHeader, correlationId);
    expect(response.status).toBe(401);
    expect(response.body.correlationId).toBe(correlationId);
  });
});
