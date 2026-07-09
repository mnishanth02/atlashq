import { drizzleSchemaPlaceholder, postgresExtensions } from "./schema.js";

export type DatabaseClientPlaceholder = {
  kind: "drizzle-postgres-placeholder";
  connection: "env:DATABASE_URL";
  extensions: typeof postgresExtensions;
  close: () => Promise<void>;
};

export function createDatabaseClientPlaceholder(): DatabaseClientPlaceholder {
  return {
    kind: "drizzle-postgres-placeholder",
    connection: "env:DATABASE_URL",
    extensions: postgresExtensions,
    async close() {
      return Promise.resolve();
    },
  };
}

export { drizzleSchemaPlaceholder };
