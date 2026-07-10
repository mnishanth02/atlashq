import type { ProjectAuditEventListResponse } from "@/features/api";

type AuditEvent = ProjectAuditEventListResponse["items"][number];
type AuditSnapshot = AuditEvent["before"] | AuditEvent["after"];
type JsonRecord = Record<string, unknown>;

const SENSITIVE_FIELD_PATTERN = /(auth|cookie|credential|hash|key|password|secret|token)/i;

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toComparableShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return `array:${value.length}`;
  }

  if (isPlainRecord(value)) {
    return `object:${Object.keys(value).sort().join(",")}`;
  }

  return value;
}

function humanize(value: string) {
  const normalized = value.replace(/[._-]+/g, " ").trim();

  if (normalized.length === 0) {
    return "record";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatFieldList(labels: string[]) {
  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function summarizeRecordSize(snapshot: JsonRecord) {
  const size = Object.keys(snapshot).length;
  return size === 1 ? "1 recorded field" : `${size} recorded fields`;
}

export function formatAuditActionLabel(action: string) {
  return humanize(action);
}

export function formatAuditEntityLabel(entityType: string) {
  return humanize(entityType);
}

export function summarizeAuditChange(before: AuditSnapshot, after: AuditSnapshot) {
  const beforeRecord = isPlainRecord(before) ? before : null;
  const afterRecord = isPlainRecord(after) ? after : null;

  if (beforeRecord === null && afterRecord === null) {
    return "No structured change summary was recorded.";
  }

  if (beforeRecord === null && afterRecord !== null) {
    return `Created ${summarizeRecordSize(afterRecord)}.`;
  }

  if (beforeRecord !== null && afterRecord === null) {
    return `Removed ${summarizeRecordSize(beforeRecord)}.`;
  }

  const beforeKeys = beforeRecord ? Object.keys(beforeRecord) : [];
  const afterKeys = afterRecord ? Object.keys(afterRecord) : [];
  const keys = [...new Set([...beforeKeys, ...afterKeys])];
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  let sensitiveFieldCount = 0;

  for (const key of keys) {
    const hasBefore = beforeRecord ? Object.hasOwn(beforeRecord, key) : false;
    const hasAfter = afterRecord ? Object.hasOwn(afterRecord, key) : false;

    if (!hasBefore && !hasAfter) {
      continue;
    }

    const changedValue =
      !hasBefore ||
      !hasAfter ||
      toComparableShape(beforeRecord?.[key]) !== toComparableShape(afterRecord?.[key]);

    if (!changedValue) {
      continue;
    }

    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      sensitiveFieldCount += 1;
      continue;
    }

    const label = humanize(key);

    if (!hasBefore) {
      added.push(label);
      continue;
    }

    if (!hasAfter) {
      removed.push(label);
      continue;
    }

    changed.push(label);
  }

  const segments: string[] = [];

  if (changed.length > 0) {
    segments.push(`Changed ${formatFieldList(changed.slice(0, 3))}`);
  }

  if (added.length > 0) {
    segments.push(`Added ${formatFieldList(added.slice(0, 3))}`);
  }

  if (removed.length > 0) {
    segments.push(`Removed ${formatFieldList(removed.slice(0, 3))}`);
  }

  if (sensitiveFieldCount > 0) {
    segments.push(
      `Updated ${sensitiveFieldCount} sensitive field${sensitiveFieldCount === 1 ? "" : "s"}`,
    );
  }

  if (segments.length === 0) {
    return "Updated recorded fields.";
  }

  return `${segments.slice(0, 2).join(". ")}.`;
}

export function formatAuditActorLabel(actorId: string, viewerId?: string) {
  return actorId === viewerId ? "You" : actorId;
}
