import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  account,
  aiRun,
  auditEvent,
  betterAuthDatabaseOptions,
  betterAuthSchema,
  client,
  close,
  createDatabaseClient,
  type Database,
  type DatabaseClient,
  databaseSchema,
  organization,
  project,
  projectMembership,
  session,
  traceabilityLink,
  user,
  verification,
} from "./index.js";

const expectedTableNames = [
  "account",
  "ai_run",
  "audit_event",
  "client",
  "organization",
  "project",
  "project_membership",
  "rate_limit",
  "session",
  "traceability_link",
  "user",
  "verification",
];

describe("database schema", () => {
  it("exports the complete Module 1 and Better Auth table set", () => {
    const tableNames = Object.values(databaseSchema)
      .map((table) => getTableConfig(table).name)
      .sort();

    expect(tableNames).toEqual(expectedTableNames);
    expect([user, session, account, verification]).toHaveLength(4);
    expect(Object.keys(betterAuthSchema)).toEqual(["user", "session", "account", "verification"]);
    expect(betterAuthDatabaseOptions).toEqual({ generateId: "uuid" });
    expect([organization, client, project, projectMembership]).toHaveLength(4);
    expect([auditEvent, traceabilityLink, aiRun]).toHaveLength(3);
  });

  it("keeps Better Auth core columns and UUID identifiers", () => {
    const userConfig = getTableConfig(user);
    const sessionConfig = getTableConfig(session);
    const accountConfig = getTableConfig(account);
    const verificationConfig = getTableConfig(verification);

    expect(userConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "email",
        "email_verified",
        "image",
        "created_at",
        "updated_at",
      ]),
    );
    expect(sessionConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "expires_at",
        "token",
        "created_at",
        "updated_at",
        "ip_address",
        "user_agent",
        "user_id",
      ]),
    );
    expect(accountConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "account_id",
        "provider_id",
        "user_id",
        "access_token",
        "refresh_token",
        "id_token",
        "access_token_expires_at",
        "refresh_token_expires_at",
        "scope",
        "password",
        "created_at",
        "updated_at",
      ]),
    );
    expect(verificationConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "identifier",
        "value",
        "expires_at",
        "created_at",
        "updated_at",
      ]),
    );
    expect([
      user.id.dataType,
      session.id.dataType,
      account.id.dataType,
      verification.id.dataType,
    ]).toEqual(["string", "string", "string", "string"]);
    expect(user.id.getSQLType()).toBe("uuid");
  });

  it("declares project constraints and search indexes", () => {
    const config = getTableConfig(project);
    const checkNames = config.checks.map((constraint) => constraint.name);
    const indexNames = config.indexes.map((projectIndex) => projectIndex.config.name);

    expect(checkNames).toEqual(
      expect.arrayContaining([
        "project_client_type_check",
        "project_status_check",
        "project_visibility_check",
      ]),
    );
    expect(indexNames).toEqual(
      expect.arrayContaining([
        "project_organization_status_idx",
        "project_name_trgm_idx",
        "project_search_idx",
        "project_tags_idx",
      ]),
    );
  });

  it("enforces a unique non-removed membership relationship", () => {
    const config = getTableConfig(projectMembership);
    const activeIndex = config.indexes.find(
      (membershipIndex) => membershipIndex.config.name === "project_membership_active_uidx",
    );

    expect(activeIndex?.config.unique).toBe(true);
    expect(activeIndex?.config.where).toBeDefined();
  });

  it("indexes every declared foreign key by its leading column", () => {
    for (const table of Object.values(databaseSchema)) {
      const config = getTableConfig(table);
      const indexedLeadingColumns = new Set(
        config.indexes
          .map((tableIndex) => tableIndex.config.columns[0])
          .filter((column) => typeof column !== "undefined")
          .map((column) => ("name" in column ? column.name : undefined))
          .filter((columnName): columnName is string => typeof columnName === "string"),
      );

      for (const foreignKey of config.foreignKeys) {
        const [foreignKeyColumn] = foreignKey.reference().columns;
        expect(indexedLeadingColumns, `${config.name}.${foreignKeyColumn?.name}`).toContain(
          foreignKeyColumn?.name,
        );
      }
    }
  });

  it("keeps audit events append-only at the schema shape", () => {
    const columns = getTableConfig(auditEvent).columns.map((column) => column.name);

    expect(columns).not.toEqual(
      expect.arrayContaining(["updated_at", "updated_by", "soft_deleted_at", "version"]),
    );
  });
});

describe("database client", () => {
  it("creates a lazy pg Pool without opening a connection", async () => {
    const client = createDatabaseClient({
      connectionString: "postgresql://localhost/atlashq_offline_test",
    });

    expect(client.pool.totalCount).toBe(0);
    expectTypeOf(client.db).toMatchTypeOf<Database>();
    expectTypeOf(client).toMatchTypeOf<DatabaseClient>();

    await close(client);
    await close(client);
  });

  it("requires an explicit URL or DATABASE_URL only when a client is created", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(() => createDatabaseClient()).toThrow(
        "DATABASE_URL is required to create a database client.",
      );
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });
});

describe("database invariant check", () => {
  it("validates the checked-in migration and Drizzle journal offline", () => {
    const output = execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/check.mjs", import.meta.url))],
      { encoding: "utf8" },
    );

    expect(output).toContain("DB schema check passed");
  });
});
