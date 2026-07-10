import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createClient, findAuditEvents } from "./api.js";
import { createAgent, createOrganization, provisionAdmin } from "./fixtures.js";
import { useHarness } from "./suite.js";

const getHarness = useHarness();

/** Sentinel correlation id the test-only BEFORE INSERT trigger raises on. */
const FORCE_AUDIT_FAILURE = "FORCE-AUDIT-FAILURE";

describe("integration: audit append-only and transactional atomicity", () => {
  it("rejects direct UPDATE, DELETE, and TRUNCATE on audit_event via the append-only triggers", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    await provisionAdmin(harness, agent, org.id);

    // Produce a real audit row so the row-level triggers have something to fire on.
    const created = await createClient(agent, { name: "Ledger Co" });
    expect(created.status).toBe(201);
    const audits = await findAuditEvents(harness.db, { action: "client.create" });
    expect(audits.length).toBeGreaterThan(0);

    await expect(
      harness.client.pool.query("UPDATE audit_event SET action = 'tampered'"),
    ).rejects.toThrow(/append-only/);

    await expect(harness.client.pool.query("DELETE FROM audit_event")).rejects.toThrow(
      /append-only/,
    );

    await expect(harness.client.pool.query("TRUNCATE TABLE audit_event")).rejects.toThrow(
      /append-only/,
    );

    // The row is untouched.
    const stillThere = await findAuditEvents(harness.db, { action: "client.create" });
    expect(stillThere.length).toBe(audits.length);
  });

  it("rolls the business row back when the audit insert fails inside the mutation transaction", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    const agent = createAgent(harness);
    await provisionAdmin(harness, agent, org.id);

    // A test-controlled BEFORE INSERT trigger that fails only for the sentinel correlation id.
    // This forces a deterministic audit failure without weakening any production code path.
    await harness.client.pool.query(`
      CREATE OR REPLACE FUNCTION test_force_audit_failure() RETURNS trigger AS $$
      BEGIN
        IF NEW.correlation_id = '${FORCE_AUDIT_FAILURE}' THEN
          RAISE EXCEPTION 'forced audit failure for rollback test';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await harness.client.pool.query(`
      CREATE TRIGGER test_force_audit_failure_trigger
      BEFORE INSERT ON audit_event
      FOR EACH ROW EXECUTE FUNCTION test_force_audit_failure();
    `);

    const clientName = `Rollback ${randomUUID()}`;
    try {
      const response = await createClient(agent, { name: clientName }, FORCE_AUDIT_FAILURE);

      // The audit insert raises, the whole transaction rolls back, and the request surfaces a 500.
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
      });

      // The business row never committed.
      const clientRows = await harness.client.pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM client WHERE name = $1",
        [clientName],
      );
      expect(clientRows.rows[0]?.count).toBe("0");

      // No audit row was persisted for the sentinel correlation id either.
      const auditRows = await findAuditEvents(harness.db, { correlationId: FORCE_AUDIT_FAILURE });
      expect(auditRows).toHaveLength(0);
    } finally {
      await harness.client.pool.query(
        "DROP TRIGGER IF EXISTS test_force_audit_failure_trigger ON audit_event",
      );
      await harness.client.pool.query("DROP FUNCTION IF EXISTS test_force_audit_failure()");
    }

    // With the trigger gone, an ordinary mutation commits normally again.
    const recovered = await createClient(agent, { name: `Recovered ${randomUUID()}` });
    expect(recovered.status).toBe(201);
  });
});
