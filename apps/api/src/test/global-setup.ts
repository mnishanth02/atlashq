import { createDatabaseClient, migrateDatabase } from "@atlashq/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Minimal shape of the Vitest global-setup context we rely on. Vitest 4 no longer exports a
 * `GlobalSetupContext` type from `vitest/node`, so the `provide` channel is typed locally against
 * the augmented {@link ProvidedContext} below.
 */
type IntegrationGlobalSetupContext = {
  provide: (key: "integrationDatabaseUrl", value: string) => void;
};

/**
 * Disposable PostgreSQL image used for the whole integration suite. A single
 * container is started once here (Testcontainers waits for the built-in
 * readiness strategy — no fixed sleeps), all migrations are applied once, and
 * the connection string is shared with every integration test file through
 * Vitest's `provide`/`inject` channel. Each test file builds its own Nest app
 * against this database and truncates between tests for deterministic isolation.
 */
const POSTGRES_IMAGE = "postgres:17-alpine";

let container: StartedPostgreSqlContainer | undefined;

export default async function setup({
  provide,
}: IntegrationGlobalSetupContext): Promise<() => Promise<void>> {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase("atlashq_test").start();

  const connectionString = container.getConnectionUri();

  // Apply every committed migration (0000-0005) against the disposable database
  // exactly once, using the real Drizzle migrator the production client uses.
  const client = createDatabaseClient({ connectionString });
  try {
    await migrateDatabase(client);
  } finally {
    await client.close();
  }

  provide("integrationDatabaseUrl", connectionString);

  return async () => {
    await container?.stop();
    container = undefined;
  };
}

declare module "vitest" {
  interface ProvidedContext {
    integrationDatabaseUrl: string;
  }
}
