import type { NewAuditEvent } from "@atlashq/db";
import type { AuditMetadata } from "@atlashq/types";
import { toJsonSafeSnapshot } from "./audit-json.js";

/** Non-empty, trimmed action string. Mirrors the `audit_event_action_check` DB constraint. */
export type AuditAction = string;

/** Non-empty, trimmed entity-type string. Mirrors the `audit_event_entity_type_check` DB constraint. */
export type AuditEntityType = string;

/**
 * Input accepted by the audit writer. Reuses the canonical `@atlashq/types` `AuditMetadata` shape
 * (module-01 §7.1 "canonical shape") minus `at`, which the database assigns via `DEFAULT now()`.
 * `before`/`after` accept arbitrary values — they are normalized through {@link toJsonSafeSnapshot}
 * before insert, so callers may pass `null` for "no snapshot" or any JSON-safe plain object.
 */
export type AuditRecordInput = Omit<AuditMetadata, "at" | "before" | "after"> & {
  before: unknown;
  after: unknown;
};

function normalizeRequiredText(value: string, field: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new TypeError(`Invalid audit ${field}: value must not be empty.`);
  }

  return trimmed;
}

/** Validate and trim a proposed audit action, matching the DB's non-empty-after-trim check. */
export function normalizeAuditAction(action: string): AuditAction {
  return normalizeRequiredText(action, "action");
}

/** Validate and trim a proposed audit entity type, matching the DB's non-empty-after-trim check. */
export function normalizeAuditEntityType(entityType: string): AuditEntityType {
  return normalizeRequiredText(entityType, "entityType");
}

/**
 * Build the Drizzle insert payload for `audit_event` from a typed {@link AuditRecordInput}: trims
 * and validates `action`/`entityType`/`correlationId`, and normalizes `before`/`after` snapshots to
 * JSON-safe values (throwing on invalid input rather than swallowing it). `projectId` is omitted
 * entirely (not set to `undefined`) when absent, since it is an optional column.
 */
export function buildAuditInsertValues(input: AuditRecordInput): NewAuditEvent {
  const values: NewAuditEvent = {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: normalizeAuditAction(input.action),
    entityType: normalizeAuditEntityType(input.entityType),
    entityId: input.entityId,
    before: toJsonSafeSnapshot(input.before, "before"),
    after: toJsonSafeSnapshot(input.after, "after"),
    correlationId: normalizeRequiredText(input.correlationId, "correlationId"),
  };

  return input.projectId === undefined ? values : { ...values, projectId: input.projectId };
}
