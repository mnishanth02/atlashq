import { describe, expect, it, vi } from "vitest";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { ClientsController } from "./clients.controller.js";
import type { ClientsService } from "./clients.service.js";

function session(): RequestSessionContext {
  return {
    user: {
      id: "67dcb6b0-14b9-444a-9cf0-6eb033af62b0",
      email: "ada@example.com",
      name: "Ada Lovelace",
      organizationId: "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90",
      organizationRole: "admin",
      status: "active",
    },
    session: {
      id: "61e6c6c8-6f1a-4c62-84ca-3e4d2a18c2f8",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    },
  };
}

describe("ClientsController", () => {
  it("forwards audit request context from the incoming request", async () => {
    const createClient = vi.fn(async (_session, _input, auditContext) => ({
      id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9",
      organizationId: "b1b2c3d4-5555-6666-7777-88889999aaaa",
      name: "Acme Corp",
      contactPerson: null,
      email: null,
      notes: null,
      status: "active",
      createdAt: "2026-07-09T18:00:00.000Z",
      createdBy: session().user.id,
      updatedAt: "2026-07-09T18:00:00.000Z",
      updatedBy: session().user.id,
      softDeletedAt: null,
      version: 1,
      auditContext,
    }));
    const service = {
      listClients: vi.fn(),
      getClient: vi.fn(),
      createClient,
      updateClient: vi.fn(),
      archiveClient: vi.fn(),
    } as unknown as ClientsService;

    const controller = new ClientsController(service);

    const response = (await controller.createClient(
      session(),
      { headers: { "x-correlation-id": "corr-123" } },
      { name: "Acme Corp" } as never,
    )) as unknown as { auditContext: AuditRequestContext };

    expect(response.auditContext).toEqual({
      actor: { actorId: session().user.id, organizationId: session().user.organizationId },
      correlationId: "corr-123",
    });
  });
});
