import { randomUUID } from "node:crypto";
import { type Database, organization, user } from "@atlashq/db";
import { eq } from "drizzle-orm";
import request from "supertest";
import type { IntegrationHarness } from "./harness.js";

/** Test-only credentials. `password` satisfies Better Auth's 12-char minimum. */
export const TEST_PASSWORD = "IntegrationTest!2345";

export const API_PREFIX = "/api/v1";

const AUTH_SIGN_UP = "/api/auth/sign-up/email";
const AUTH_SIGN_IN = "/api/auth/sign-in/email";
const AUTH_SIGN_OUT = "/api/auth/sign-out";
const AUTH_GET_SESSION = "/api/auth/get-session";

export type TestAgent = ReturnType<typeof request.agent>;

export type CreatedUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
};

/** Globally-unique email so tests never collide on the unique `user.email`. */
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}.${randomUUID()}@atlashq.test`;
}

/** A cookie-preserving Supertest agent bound to the harness HTTP server. */
export function createAgent(harness: IntegrationHarness): TestAgent {
  return request.agent(harness.server);
}

export async function createOrganization(
  db: Database,
  overrides: { name?: string } = {},
): Promise<{ id: string; name: string }> {
  const [row] = await db
    .insert(organization)
    .values({ name: overrides.name ?? `Org ${randomUUID()}` })
    .returning({ id: organization.id, name: organization.name });

  if (!row) {
    throw new Error("Failed to insert organization.");
  }

  return row;
}

/**
 * Insert a bare user row (no password/account) for members that never
 * authenticate but must exist to be referenced as owners/members/targets.
 */
export async function createUserRecord(
  db: Database,
  input: {
    organizationId: string;
    email?: string;
    name?: string;
    organizationRole?: string;
    status?: string;
  },
): Promise<CreatedUser> {
  const [row] = await db
    .insert(user)
    .values({
      organizationId: input.organizationId,
      email: input.email ?? uniqueEmail("member"),
      name: input.name ?? "Member User",
      organizationRole: input.organizationRole ?? "member",
      status: input.status ?? "active",
      emailVerified: true,
    })
    .returning({
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
    });

  if (!row) {
    throw new Error("Failed to insert user.");
  }

  return row;
}

export async function findUserByEmail(db: Database, email: string): Promise<CreatedUser | null> {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
    })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return rows[0] ?? null;
}

/** Promote/demote the organization role directly in the database (server-controlled). */
export async function setOrganizationRole(
  db: Database,
  userId: string,
  role: string,
): Promise<void> {
  await db.update(user).set({ organizationRole: role }).where(eq(user.id, userId));
}

/** Set the user account status directly in the database (server-controlled). */
export async function setUserStatus(db: Database, userId: string, status: string): Promise<void> {
  await db.update(user).set({ status }).where(eq(user.id, userId));
}

/** Soft-delete a user directly in the database; no API path exposes this. */
export async function softDeleteUser(db: Database, userId: string): Promise<void> {
  await db.update(user).set({ softDeletedAt: new Date() }).where(eq(user.id, userId));
}

// --- Real Better Auth flows: trusted provisioning + cookie-preserving sign-in ---

export type SignUpResult = { email: string; password: string; user: CreatedUser };

/**
 * Provision an email/password user directly through the trusted, non-mounted
 * provisioning Better Auth instance (`allowSignUp: true`), mirroring the
 * initial-admin CLI. This never touches the mounted HTTP app, so it works even
 * though public `POST /api/auth/sign-up/email` is disabled in production.
 */
export async function provisionUser(
  harness: IntegrationHarness,
  input: { organizationId: string; email: string; password: string; name: string },
): Promise<void> {
  await harness.provisioningAuth.api.signUpEmail({
    body: {
      email: input.email,
      password: input.password,
      name: input.name,
      organizationId: input.organizationId,
    },
  });
}

/**
 * Attempt a public email/password sign-up over the real mounted HTTP app. Used
 * by the integration suite to assert public sign-up is rejected. Returns the raw
 * Supertest response so callers can assert on status/body.
 */
export function attemptPublicSignUp(
  harness: IntegrationHarness,
  agent: TestAgent,
  input: { organizationId: string; email?: string; password?: string; name?: string },
) {
  return agent
    .post(AUTH_SIGN_UP)
    .set("origin", harness.authOrigin)
    .send({
      email: input.email ?? uniqueEmail(),
      password: input.password ?? TEST_PASSWORD,
      name: input.name ?? "Rejected User",
      organizationId: input.organizationId,
    });
}

/**
 * Provision an email/password user with the required `organizationId` through
 * the trusted provisioning path, then establish the agent's session cookie via
 * the real, still-enabled sign-in route (the Origin header is a trusted origin
 * so Better Auth's CSRF check passes). The agent is left authenticated exactly
 * as before, but without relying on public HTTP sign-up.
 */
export async function signUp(
  harness: IntegrationHarness,
  agent: TestAgent,
  input: { organizationId: string; email?: string; password?: string; name?: string },
): Promise<SignUpResult> {
  const email = input.email ?? uniqueEmail();
  const password = input.password ?? TEST_PASSWORD;
  const name = input.name ?? "Test User";

  await provisionUser(harness, { organizationId: input.organizationId, email, password, name });

  const signedIn = await signIn(harness, agent, { email, password });
  if (signedIn.status !== 200) {
    throw new Error(
      `sign-in after provisioning failed (${signedIn.status}): ${JSON.stringify(signedIn.body)}`,
    );
  }

  const created = await findUserByEmail(harness.db, email);
  if (!created) {
    throw new Error("Provisioned user not found in database.");
  }

  return { email, password, user: created };
}

/**
 * Provision an organization admin: provision a member and promote them to
 * `admin` in the database (the role is server-controlled, not settable at
 * signup).
 */
export async function provisionAdmin(
  harness: IntegrationHarness,
  agent: TestAgent,
  organizationId: string,
  input: { email?: string; name?: string } = {},
): Promise<SignUpResult> {
  const result = await signUp(harness, agent, {
    organizationId,
    email: input.email ?? uniqueEmail("admin"),
    name: input.name ?? "Admin User",
  });
  await setOrganizationRole(harness.db, result.user.id, "admin");
  return result;
}

export function signIn(
  harness: IntegrationHarness,
  agent: TestAgent,
  input: { email: string; password: string },
) {
  return agent.post(AUTH_SIGN_IN).set("origin", harness.authOrigin).send(input);
}

export function signOut(harness: IntegrationHarness, agent: TestAgent) {
  return agent.post(AUTH_SIGN_OUT).set("origin", harness.authOrigin).send({});
}

export function getAuthSession(agent: TestAgent) {
  return agent.get(AUTH_GET_SESSION);
}
