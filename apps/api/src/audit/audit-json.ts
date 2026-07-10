import type { JsonObject, JsonValue } from "@atlashq/types";

/**
 * Normalize an arbitrary snapshot value into the canonical `audit_event.before`/`after` shape.
 *
 * `null` and `undefined` both normalize to `null` — "no snapshot" is a valid, common case (for
 * example, `before` on a create action, or `after` on a delete action). Anything else must
 * already be a JSON-safe plain object: functions, symbols, `bigint`s, non-finite numbers (`NaN`,
 * `Infinity`), `Date`/`Map`/`Set`/class instances, and circular references all throw explicitly
 * instead of being silently dropped, stringified, or coerced. A caller that accidentally passes a
 * live Drizzle row (which may carry `Date` columns) or a non-serializable object must fix the
 * snapshot at the source rather than have it audited as an approximation.
 */
export function toJsonSafeSnapshot(value: unknown, label = "snapshot"): JsonObject | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isPlainObject(value)) {
    throw new TypeError(`Invalid audit ${label}: expected a JSON object or null.`);
  }

  return assertJsonObject(value, label, new Set());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertJsonObject(
  value: Record<string, unknown>,
  path: string,
  seen: Set<unknown>,
): JsonObject {
  if (seen.has(value)) {
    throw new TypeError(`Invalid audit value at ${path}: circular reference is not JSON-safe.`);
  }

  seen.add(value);
  try {
    const result: JsonObject = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = assertJsonValue(entryValue, `${path}.${key}`, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function assertJsonArray(value: unknown[], path: string, seen: Set<unknown>): JsonValue[] {
  if (seen.has(value)) {
    throw new TypeError(`Invalid audit value at ${path}: circular reference is not JSON-safe.`);
  }

  seen.add(value);
  try {
    return value.map((entry, index) => assertJsonValue(entry, `${path}[${index}]`, seen));
  } finally {
    seen.delete(value);
  }
}

function assertJsonValue(value: unknown, path: string, seen: Set<unknown>): JsonValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`Invalid audit value at ${path}: ${String(value)} is not JSON-safe.`);
      }
      return value;
    case "object":
      break;
    default:
      throw new TypeError(`Invalid audit value at ${path}: ${typeof value} is not JSON-safe.`);
  }

  if (Array.isArray(value)) {
    return assertJsonArray(value, path, seen);
  }

  if (!isPlainObject(value)) {
    throw new TypeError(
      `Invalid audit value at ${path}: only plain objects, arrays, and primitives are JSON-safe.`,
    );
  }

  return assertJsonObject(value, path, seen);
}
