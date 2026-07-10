import type { Database } from "@atlashq/db";
import { describe, expect, it, vi } from "vitest";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { AuditTransaction } from "../../audit/audit-transaction.js";
import type { AuditWriter } from "../../audit/audit-writer.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { ClientsService } from "./clients.service.js";
import type { ClientListPage, ClientRow, ClientsRepository } from "./clients.types.js";

function session(role: "admin" | "member" = "admin"): RequestSessionContext {
  return {
    user: {
      id: "67dcb6b0-14b9-444a-9cf0-6eb033af62b0",
      email: "ada@example.com",
      name: "Ada Lovelace",
      organizationId: "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90",
      organizationRole: role,
      status: "active",
    },
    session: {
      id: "61e6c6c8-6f1a-4c62-84ca-3e4d2a18c2f8",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    },
  };
}

function row(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9",
    organizationId: "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90",
    name: "Acme Corp",
    contactPerson: "Jane Doe",
    email: "ops@acme.test",
    notes: "Enterprise client",
    status: "active",
    createdAt: new Date("2026-07-09T18:00:00.000Z"),
    createdBy: "67dcb6b0-14b9-444a-9cf0-6eb033af62b0",
    updatedAt: new Date("2026-07-09T19:00:00.000Z"),
    updatedBy: "67dcb6b0-14b9-444a-9cf0-6eb033af62b0",
    softDeletedAt: null,
    version: 1,
    ...overrides,
  };
}

function fakeDb(tx: unknown, onCommit?: () => void): Database {
  return {
    async transaction(callback: (transaction: AuditTransaction) => Promise<unknown>) {
      const result = await callback(tx as AuditTransaction);
      onCommit?.();
      return result;
    },
  } as unknown as Database;
}

function fakeAudit(record: ReturnType<typeof vi.fn>): AuditWriter {
  return {
    record,
  } as unknown as AuditWriter;
}

function callArg<T = unknown>(
  mock: { mock: { calls: readonly (readonly unknown[])[] } },
  call: number,
  arg: number,
): T {
  return mock.mock.calls[call]?.[arg] as T;
}

function fakeRepository(overrides: Partial<ClientsRepository> = {}): ClientsRepository {
  return {
    async list() {
      const page: ClientListPage = {
        items: [row()],
        pageInfo: { limit: 25, nextCursor: null, hasMore: false },
      };
      return page;
    },
    async findById() {
      return row();
    },
    async create() {
      return row();
    },
    async update() {
      return row({ version: 2 });
    },
    async archive() {
      return row({ status: "archived", version: 2 });
    },
    ...overrides,
  };
}

describe("ClientsService", () => {
  it("rejects non-admin mutations", async () => {
    const service = new ClientsService(fakeDb({}), fakeRepository(), fakeAudit(vi.fn()));

    await expect(
      service.createClient(session("member"), { name: "Acme Corp", status: "active" }, {
        actor: { actorId: "x", organizationId: "y" },
        correlationId: "corr",
      } as AuditRequestContext),
    ).rejects.toThrow();
  });

  it("scopes reads to the caller's organization", async () => {
    const findById = vi.fn(async (_handle: unknown, organizationId: string) =>
      row({ organizationId }),
    );
    const service = new ClientsService(
      fakeDb({}),
      fakeRepository({ findById }),
      fakeAudit(vi.fn()),
    );

    const response = await service.getClient(session(), "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9");

    expect(response.organizationId).toBe(session().user.organizationId);
    expect(findById).toHaveBeenCalledWith(
      expect.anything(),
      session().user.organizationId,
      expect.any(String),
    );
  });

  it("uses the same transaction handle for writes and audit records", async () => {
    const tx = { marker: "tx" };
    const record = vi.fn(async (transaction: AuditTransaction) => {
      expect(transaction).toBe(tx);
      return {} as never;
    });
    const create = vi.fn(async (handle: unknown) => {
      expect(handle).toBe(tx);
      return row();
    });
    const service = new ClientsService(fakeDb(tx), fakeRepository({ create }), fakeAudit(record));

    const response = await service.createClient(
      session(),
      { name: "Acme Corp", email: "ops@acme.test", status: "active" },
      {
        actor: { actorId: session().user.id, organizationId: session().user.organizationId },
        correlationId: "corr",
      },
    );

    expect(response.id).toBe(row().id);
    expect(create).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("rolls back when audit recording fails", async () => {
    const tx = { marker: "tx" };
    let committed = false;
    const audit = vi.fn(async () => {
      throw new Error("audit failed");
    });
    const service = new ClientsService(
      fakeDb(tx, () => {
        committed = true;
      }),
      fakeRepository({
        create: vi.fn(async () => row()),
      }),
      fakeAudit(audit),
    );

    await expect(
      service.createClient(
        session(),
        { name: "Acme Corp", status: "active" },
        {
          actor: { actorId: session().user.id, organizationId: session().user.organizationId },
          correlationId: "corr",
        },
      ),
    ).rejects.toThrow("audit failed");

    expect(committed).toBe(false);
  });

  it("returns archived clients without mutating them on archive requests", async () => {
    const archivedRow = row({ status: "archived", version: 4 });
    const findById = vi.fn(async () => archivedRow);
    const archive = vi.fn();
    const audit = vi.fn(async (transaction: AuditTransaction, input: Record<string, unknown>) => {
      expect(transaction).toBe(tx);
      expect(input.before).toEqual(input.after);
    });
    const tx = { marker: "tx" };
    const service = new ClientsService(
      fakeDb(tx),
      fakeRepository({ findById, archive }),
      fakeAudit(audit),
    );

    const response = await service.archiveClient(session(), archivedRow.id, {
      actor: { actorId: session().user.id, organizationId: session().user.organizationId },
      correlationId: "corr",
    });

    expect(response.status).toBe("archived");
    expect(archive).not.toHaveBeenCalled();
  });

  it("rejects updates to archived clients", async () => {
    const service = new ClientsService(
      fakeDb({}),
      fakeRepository({
        findById: vi.fn(async () => row({ status: "archived" })),
      }),
      fakeAudit(vi.fn()),
    );

    await expect(
      service.updateClient(
        session(),
        "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9",
        { version: 1, name: "Renamed" },
        {
          actor: { actorId: session().user.id, organizationId: session().user.organizationId },
          correlationId: "corr",
        },
      ),
    ).rejects.toThrow();
  });

  it("passes explicit nulls through while leaving omitted fields unchanged", async () => {
    const update = vi.fn(async (_handle, _organizationId, _clientId, _version, values) =>
      row({
        contactPerson: values.contactPerson,
        email: values.email,
        notes: values.notes,
        version: 2,
      }),
    );
    const service = new ClientsService(fakeDb({}), fakeRepository({ update }), fakeAudit(vi.fn()));

    const response = await service.updateClient(
      session(),
      row().id,
      { version: 1, contactPerson: null, email: null, notes: null },
      {
        actor: { actorId: session().user.id, organizationId: session().user.organizationId },
        correlationId: "corr",
      },
    );

    expect(callArg(update, 0, 4)).toMatchObject({
      contactPerson: null,
      email: null,
      notes: null,
    });
    expect(callArg(update, 0, 4)).not.toHaveProperty("name");
    expect(response).toMatchObject({ contactPerson: null, email: null, notes: null });
  });

  it("returns a conflict when the optimistic update loses a race", async () => {
    const service = new ClientsService(
      fakeDb({}),
      fakeRepository({ update: vi.fn(async () => null) }),
      fakeAudit(vi.fn()),
    );

    await expect(
      service.updateClient(
        session(),
        row().id,
        { version: 1, name: "Renamed" },
        {
          actor: { actorId: session().user.id, organizationId: session().user.organizationId },
          correlationId: "corr",
        },
      ),
    ).rejects.toThrow("modified by another request");
  });
});
