import { auditEvent, type Database, type NewAuditEvent } from "@atlashq/db";
import type { JsonObject } from "@atlashq/types";

/**
 * Worker-side mirror of `apps/api/src/audit/audit-writer.ts`. The worker cannot import app code
 * from `apps/api`, so this is a small, self-contained append-only writer against the shared
 * `audit_event` table (`@atlashq/db`). `audit_event` has no update/delete API here either — the
 * database's `audit_event_no_update`/`audit_event_no_delete` triggers make it append-only at the
 * storage layer regardless of what application code attempts.
 */
export type WorkerAuditInput = {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  projectId?: string;
  correlationId: string;
  before?: JsonObject | null;
  after?: JsonObject | null;
};

export async function recordWorkerAuditEvent(
  db: Pick<Database, "insert">,
  input: WorkerAuditInput,
): Promise<void> {
  const action = input.action.trim();
  const entityType = input.entityType.trim();
  const correlationId = input.correlationId.trim();

  if (action.length === 0) {
    throw new TypeError("Invalid audit action: value must not be empty.");
  }
  if (entityType.length === 0) {
    throw new TypeError("Invalid audit entityType: value must not be empty.");
  }
  if (correlationId.length === 0) {
    throw new TypeError("Invalid audit correlationId: value must not be empty.");
  }

  const values: NewAuditEvent = {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action,
    entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    correlationId,
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
  };

  await db.insert(auditEvent).values(values);
}
