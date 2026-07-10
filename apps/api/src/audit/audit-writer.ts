import { type AuditEvent, auditEvent } from "@atlashq/db";
import { Injectable } from "@nestjs/common";
import type { AuditRecordInput } from "./audit-input.js";
import { buildAuditInsertValues } from "./audit-input.js";
import type { AuditTransaction } from "./audit-transaction.js";

/**
 * Transaction-bound, append-only audit writer.
 *
 * `record` never opens its own transaction — the caller must supply the same Drizzle transaction
 * used for the surrounding mutation, so the business state change (project/client/membership, ...)
 * and its audit event always commit or roll back together. There is intentionally no
 * update/delete API on this class: `audit_event` is append-only both here and at the database
 * level (see the `audit_event_no_update`/`audit_event_no_delete` triggers).
 */
@Injectable()
export class AuditWriter {
  async record(tx: AuditTransaction, input: AuditRecordInput): Promise<AuditEvent> {
    const [row] = await tx.insert(auditEvent).values(buildAuditInsertValues(input)).returning();

    if (!row) {
      throw new Error("Audit event insert did not return the inserted row.");
    }

    return row;
  }
}
