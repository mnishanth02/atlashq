import type { Server } from "node:http";
import { type Auth, createAuth } from "@atlashq/auth";
import { createDatabaseClient, type Database, type DatabaseClient } from "@atlashq/db";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApiApp } from "../app.factory.js";

/**
 * Test-only Better Auth secret. Never a real secret — an obvious, disposable
 * value that satisfies the 32-character minimum enforced by `authEnvSchema`.
 */
export const TEST_AUTH_SECRET = "atlashq-integration-tests-secret-key-0123456789";

/** Base URL Better Auth is configured with; also the trusted CSRF origin. */
export const TEST_AUTH_URL = "http://localhost:3000";

/** Web origin used for CORS and as a second trusted CSRF origin. */
export const TEST_WEB_ORIGIN = "http://localhost:4187";

/** Every table created by migrations 0000-0005, ordered for readable TRUNCATE. */
const ALL_TABLES = [
  "organization",
  "user",
  "session",
  "account",
  "verification",
  "rate_limit",
  "client",
  "project",
  "project_membership",
  "audit_event",
  "traceability_link",
  "ai_run",
] as const;

const AUDIT_EVENT_TRUNCATE_TRIGGER = "audit_event_no_truncate";

export type IntegrationHarness = {
  app: NestExpressApplication;
  db: Database;
  client: DatabaseClient;
  auth: Auth;
  /**
   * Trusted, **non-mounted** Better Auth instance with public sign-up explicitly
   * enabled (`allowSignUp: true`). Used only to provision users directly in
   * tests — the mounted app ({@link auth}) keeps public sign-up disabled, so
   * `POST /api/auth/sign-up/email` over HTTP is rejected exactly as in
   * production.
   */
  provisioningAuth: Auth;
  server: Server;
  /** Trusted origin to send on Better Auth mutations so CSRF checks pass. */
  authOrigin: string;
  /** Remove all business/auth/audit rows between tests (append-only safe). */
  truncateAll: () => Promise<void>;
  /** Close the Nest app and the database pool. Safe to call more than once. */
  close: () => Promise<void>;
};

/**
 * Build a fully wired integration harness: a real Drizzle client against the
 * disposable container database, a real Better Auth instance, and the Nest app
 * assembled by the exact production {@link createApiApp} factory (identical CORS
 * / logger / auth-handler / body-parser / prefix / filter ordering). The app is
 * initialized (not listening) so Supertest can drive it via its HTTP server.
 *
 * The mounted `auth` keeps public sign-up disabled (production default); a
 * separate, non-mounted `provisioningAuth` with `allowSignUp: true` is used by
 * the fixtures to create users directly, mirroring the trusted provisioning CLI.
 */
export async function createIntegrationHarness(
  connectionString: string,
): Promise<IntegrationHarness> {
  const client = createDatabaseClient({ connectionString });
  const authEnv = {
    NODE_ENV: "test",
    AUTH_SECRET: TEST_AUTH_SECRET,
    AUTH_URL: TEST_AUTH_URL,
    WEB_ORIGIN: TEST_WEB_ORIGIN,
  } as const;
  const auth = createAuth({ db: client.db, env: authEnv });
  const provisioningAuth = createAuth({ db: client.db, env: authEnv, allowSignUp: true });

  const app = await createApiApp({
    auth,
    db: client.db,
    webOrigin: TEST_WEB_ORIGIN,
    setupSwagger: false,
  });
  await app.init();

  let closed = false;

  return {
    app,
    db: client.db,
    client,
    auth,
    provisioningAuth,
    server: app.getHttpServer() as Server,
    authOrigin: TEST_AUTH_URL,
    async truncateAll() {
      const quoted = ALL_TABLES.map((table) => `"${table}"`).join(", ");
      const connection = await client.pool.connect();
      try {
        await connection.query("BEGIN");
        await connection.query(
          `ALTER TABLE "audit_event" DISABLE TRIGGER "${AUDIT_EVENT_TRUNCATE_TRIGGER}"`,
        );
        await connection.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
        await connection.query(
          `ALTER TABLE "audit_event" ENABLE TRIGGER "${AUDIT_EVENT_TRUNCATE_TRIGGER}"`,
        );
        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
    },
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await app.close();
      await client.close();
    },
  };
}
