import { describe, expect, it } from "vitest";
import { toJsonSafeSnapshot } from "./audit-json.js";

describe("toJsonSafeSnapshot", () => {
  it("normalizes null and undefined to null", () => {
    expect(toJsonSafeSnapshot(null)).toBeNull();
    expect(toJsonSafeSnapshot(undefined)).toBeNull();
  });

  it("passes through a JSON-safe plain object, including nested arrays/objects", () => {
    const snapshot = {
      name: "Atlas",
      count: 3,
      active: true,
      note: null,
      tags: ["a", "b"],
      nested: { deeper: [{ value: 1 }, { value: 2 }] },
    };

    expect(toJsonSafeSnapshot(snapshot)).toEqual(snapshot);
  });

  it("rejects a top-level array (audit_event.before/after must be an object or null)", () => {
    expect(() => toJsonSafeSnapshot([1, 2, 3])).toThrow(/expected a JSON object or null/);
  });

  it("rejects a top-level non-object primitive", () => {
    expect(() => toJsonSafeSnapshot("not-an-object")).toThrow(/expected a JSON object or null/);
    expect(() => toJsonSafeSnapshot(42)).toThrow(/expected a JSON object or null/);
  });

  it("rejects functions, symbols, and bigints nested in the snapshot", () => {
    expect(() => toJsonSafeSnapshot({ fn: () => 1 })).toThrow(/is not JSON-safe/);
    expect(() => toJsonSafeSnapshot({ sym: Symbol("x") })).toThrow(/is not JSON-safe/);
    expect(() => toJsonSafeSnapshot({ big: 1n })).toThrow(/is not JSON-safe/);
  });

  it("rejects non-finite numbers", () => {
    expect(() => toJsonSafeSnapshot({ value: Number.NaN })).toThrow(/is not JSON-safe/);
    expect(() => toJsonSafeSnapshot({ value: Number.POSITIVE_INFINITY })).toThrow(
      /is not JSON-safe/,
    );
    expect(() => toJsonSafeSnapshot({ value: Number.NEGATIVE_INFINITY })).toThrow(
      /is not JSON-safe/,
    );
  });

  it("rejects Date instances, class instances, Map, and Set instead of silently coercing them", () => {
    expect(() => toJsonSafeSnapshot({ at: new Date() })).toThrow(/JSON-safe/);
    expect(() => toJsonSafeSnapshot({ items: new Set([1, 2]) })).toThrow(/JSON-safe/);
    expect(() => toJsonSafeSnapshot({ items: new Map() })).toThrow(/JSON-safe/);

    class Custom {
      value = 1;
    }
    expect(() => toJsonSafeSnapshot({ custom: new Custom() })).toThrow(/JSON-safe/);
  });

  it("rejects circular references", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;

    expect(() => toJsonSafeSnapshot(circular)).toThrow(/circular reference/);
  });

  it("does not falsely flag the same nested object reused in two sibling branches", () => {
    const shared = { value: 1 };
    const snapshot = { left: shared, right: shared };

    expect(toJsonSafeSnapshot(snapshot)).toEqual({ left: { value: 1 }, right: { value: 1 } });
  });

  it("rejects circular references nested inside arrays", () => {
    const circular: Record<string, unknown>[] = [];
    circular.push({ self: circular });

    expect(() => toJsonSafeSnapshot({ items: circular })).toThrow(/circular reference/);
  });
});
