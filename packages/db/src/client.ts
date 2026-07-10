import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolConfig } from "pg";
import { databaseSchema } from "./schema.js";

export type Database = NodePgDatabase<typeof databaseSchema>;

export type CreateDatabaseClientOptions = {
  connectionString?: string;
  pool?: Omit<PoolConfig, "connectionString">;
};

export type DatabaseClient = {
  db: Database;
  pool: Pool;
  close: () => Promise<void>;
};

export function createDatabaseClient(options: CreateDatabaseClientOptions = {}): DatabaseClient {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a database client.");
  }

  const pool = new Pool({
    ...options.pool,
    connectionString,
  });
  const db = drizzle({ client: pool, schema: databaseSchema });
  let closed = false;

  return {
    db,
    pool,
    async close() {
      if (closed) {
        return;
      }

      closed = true;
      await pool.end();
    },
  };
}

export async function close(client: Pick<DatabaseClient, "close">): Promise<void> {
  await client.close();
}

export async function migrateDatabase(
  client: Pick<DatabaseClient, "db">,
  migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url)),
): Promise<void> {
  await migrate(client.db, { migrationsFolder });
}
