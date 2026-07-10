import "reflect-metadata";
import process from "node:process";
import { authEnvSchema, createAuth } from "@atlashq/auth";
import { createDatabaseClient, migrateDatabase } from "@atlashq/db";
import { createDrizzleInitialAdminGateway, provisionInitialAdmin } from "./initial-admin.js";

/**
 * Initial-admin provisioning CLI (NOT an HTTP route).
 *
 * Trusted, operator-run entrypoint that bootstraps the first organization admin.
 * Every secret and identity value is supplied through the environment — nothing
 * is read from argv and no password is ever logged — so the provisioning path
 * is safe to run inside CI, a shell, or the opt-in Docker Compose `bootstrap`
 * profile.
 *
 * Inputs (environment only):
 *   INITIAL_ADMIN_ORG_NAME   organization display name
 *   INITIAL_ADMIN_NAME       admin display name
 *   INITIAL_ADMIN_EMAIL      admin email (unique)
 *   INITIAL_ADMIN_PASSWORD   admin password (>= 12 chars)
 *   DATABASE_URL, AUTH_SECRET, AUTH_URL, WEB_ORIGIN, NODE_ENV  standard API env
 *
 * It applies all committed migrations (idempotent) so it is self-sufficient even
 * when run before the API, provisions the admin through a trusted, non-mounted
 * Better Auth instance whose sign-up is explicitly enabled, is idempotent on
 * rerun, always closes the pool, and exits non-zero on any failure.
 */
async function main(): Promise<void> {
  const env = authEnvSchema.parse(process.env);

  const input = {
    organizationName: process.env.INITIAL_ADMIN_ORG_NAME,
    adminName: process.env.INITIAL_ADMIN_NAME,
    adminEmail: process.env.INITIAL_ADMIN_EMAIL,
    adminPassword: process.env.INITIAL_ADMIN_PASSWORD,
  };

  const databaseClient = createDatabaseClient({ connectionString: env.DATABASE_URL });

  try {
    // Self-sufficient: apply every committed migration before provisioning. The
    // Drizzle migrator is idempotent, so this is safe even when the Compose
    // `migrate` service has already run.
    await migrateDatabase(databaseClient);

    // Trusted, non-mounted Better Auth instance with sign-up explicitly enabled.
    // This instance is never wired into the HTTP app, so enabling sign-up here
    // does not open public enrolment on the mounted API.
    const provisioningAuth = createAuth({ db: databaseClient.db, env, allowSignUp: true });

    const gateway = createDrizzleInitialAdminGateway({
      db: databaseClient.db,
      auth: provisioningAuth,
    });

    const result = await provisionInitialAdmin(gateway, input);

    if (result.alreadyProvisioned) {
      console.log("Initial admin bootstrap: already provisioned (no changes).");
    } else {
      console.log(
        `Initial admin bootstrap complete: organization=${result.organizationId} ` +
          `user=${result.userId} organizationCreated=${result.organizationCreated} ` +
          `userCreated=${result.userCreated} promoted=${result.promoted}`,
      );
    }
  } finally {
    await databaseClient.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Initial admin provisioning failed: ${message}`);
  process.exitCode = 1;
});
