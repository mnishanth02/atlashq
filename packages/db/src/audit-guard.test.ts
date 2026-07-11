import { randomUUID } from "node:crypto";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient, migrateDatabase } from "./index.js";

const POSTGRES_IMAGE = "postgres:17-alpine";

async function seedAuditEvent(client: DatabaseClient): Promise<void> {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const entityId = randomUUID();

  await client.pool.query(`INSERT INTO organization (id, name) VALUES ($1, $2)`, [
    organizationId,
    "Audit Guard Org",
  ]);
  await client.pool.query(
    `INSERT INTO "user" (id, organization_id, name, email)
     VALUES ($1, $2, $3, $4)`,
    [userId, organizationId, "Audit Guard User", `audit-guard-${userId}@atlashq.test`],
  );
  await client.pool.query(
    `INSERT INTO audit_event (
       organization_id,
       actor_id,
       action,
       entity_type,
       entity_id,
       after,
       correlation_id
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      organizationId,
      userId,
      "client.create",
      "client",
      entityId,
      JSON.stringify({ id: entityId }),
      `corr-${randomUUID()}`,
    ],
  );
}

async function expectAppendOnlyFailure(
  client: DatabaseClient,
  statement: string,
  operation: "UPDATE" | "DELETE" | "TRUNCATE",
): Promise<void> {
  let error: (Error & { code?: string }) | undefined;

  try {
    await client.pool.query(statement);
  } catch (failure) {
    error = failure as Error & { code?: string };
  }

  expect(error).toBeInstanceOf(Error);
  expect(error?.code).toBe("23001");
  expect(error?.message).toMatch(new RegExp(`append-only: ${operation} is not permitted`, "i"));

  const count = await client.pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM audit_event`,
  );
  expect(count.rows[0]?.count).toBe("1");
}

describe("audit_event append-only guard", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let client: DatabaseClient | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
    await container?.stop();
    container = undefined;
  });

  it("blocks UPDATE, DELETE, and TRUNCATE in a disposable migrated database", async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase("atlashq_db_test")
      .start();
    client = createDatabaseClient({ connectionString: container.getConnectionUri() });
    await migrateDatabase(client);
    await seedAuditEvent(client);

    await expectAppendOnlyFailure(client, `UPDATE audit_event SET action = 'tampered'`, "UPDATE");
    await expectAppendOnlyFailure(client, `DELETE FROM audit_event`, "DELETE");
    // Module 2's reference_artifact.audit_event_id FK now references audit_event, so a bare
    // TRUNCATE is rejected by Postgres itself (0A000) before any trigger runs; CASCADE clears
    // that structural restriction so the append-only guard trigger is what actually fires.
    await expectAppendOnlyFailure(client, `TRUNCATE TABLE audit_event CASCADE`, "TRUNCATE");
  }, 120_000);
});
