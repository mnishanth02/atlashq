// Runtime Drizzle migration CLI.
//
// Applies every committed migration in `packages/db/migrations` against the
// database named by `DATABASE_URL`, using the same production Drizzle migrator
// (`node-postgres`) the API relies on. It intentionally depends only on the
// compiled `@atlashq/db` runtime (`../dist/index.js`) and `drizzle-orm`/`pg` —
// no `drizzle-kit`/dev tooling — so Docker Compose can run migrations from the
// same slim runtime image that runs the API.
//
// Contract: reads `DATABASE_URL`, always closes the pool, and exits non-zero on
// any failure so an orchestrator (Compose `service_completed_successfully`) can
// gate the API on a clean migration.
import process from "node:process";
import { createDatabaseClient, migrateDatabase } from "../dist/index.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const client = createDatabaseClient({ connectionString });
  try {
    await migrateDatabase(client);
    console.log("Database migrations applied successfully.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
