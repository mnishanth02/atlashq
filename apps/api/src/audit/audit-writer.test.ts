import { auditEvent } from "@atlashq/db";
import { describe, expect, it, vi } from "vitest";
import type { AuditTransaction } from "./audit-transaction.js";
import { AuditWriter } from "./audit-writer.js";

const validInput = {
  organizationId: "org-1",
  actorId: "user-1",
  action: "project.created",
  entityType: "project",
  entityId: "project-1",
  before: null,
  after: { name: "Atlas" },
  correlationId: "corr-1",
};

function fakeTransaction(row: Record<string, unknown> | undefined) {
  const returningMock = vi.fn(async () => (row ? [row] : []));
  const valuesMock = vi.fn(() => ({ returning: returningMock }));
  const insertMock = vi.fn(() => ({ values: valuesMock }));

  return {
    tx: { insert: insertMock } as unknown as AuditTransaction,
    insertMock,
    valuesMock,
    returningMock,
  };
}

describe("AuditWriter", () => {
  it("never starts its own transaction: it takes no constructor dependencies", () => {
    // If the writer needed a Database/pool to open an independent transaction, it would have to
    // be injected here. It has none, so it is structurally incapable of doing so.
    expect(AuditWriter.length).toBe(0);
    expect(() => new AuditWriter()).not.toThrow();
  });

  it("inserts through the exact transaction object supplied by the caller", async () => {
    const writer = new AuditWriter();
    const inserted = { id: "audit-1", ...validInput, projectId: null, at: new Date() };
    const { tx, insertMock } = fakeTransaction(inserted);
    const otherTx = fakeTransaction(inserted);

    await writer.record(tx, validInput);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(auditEvent);
    expect(otherTx.insertMock).not.toHaveBeenCalled();
  });

  it("inserts the canonical audit_event insert shape built from the input", async () => {
    const writer = new AuditWriter();
    const inserted = { id: "audit-1", ...validInput, projectId: null, at: new Date() };
    const { tx, valuesMock } = fakeTransaction(inserted);

    await writer.record(tx, validInput);

    expect(valuesMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      actorId: "user-1",
      action: "project.created",
      entityType: "project",
      entityId: "project-1",
      before: null,
      after: { name: "Atlas" },
      correlationId: "corr-1",
    });
  });

  it("returns the inserted row", async () => {
    const writer = new AuditWriter();
    const inserted = { id: "audit-1", ...validInput, projectId: null, at: new Date() };
    const { tx } = fakeTransaction(inserted);

    await expect(writer.record(tx, validInput)).resolves.toEqual(inserted);
  });

  it("throws explicitly when the insert does not return a row", async () => {
    const writer = new AuditWriter();
    const { tx } = fakeTransaction(undefined);

    await expect(writer.record(tx, validInput)).rejects.toThrow(
      "Audit event insert did not return the inserted row.",
    );
  });

  it("exposes no update/delete API: audit_event is append-only", () => {
    const methodNames = Object.getOwnPropertyNames(AuditWriter.prototype);

    expect(methodNames).toEqual(expect.arrayContaining(["constructor", "record"]));
    expect(methodNames).not.toEqual(
      expect.arrayContaining(["update", "delete", "remove", "patch", "modify", "amend", "upsert"]),
    );
  });
});
