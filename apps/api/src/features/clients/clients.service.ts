import type { Database } from "@atlashq/db";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { AuditTransaction } from "../../audit/audit-transaction.js";
import { AuditWriter } from "../../audit/audit-writer.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { DATABASE_CLIENT } from "../../runtime/runtime.js";
import type {
  ClientCreateInput,
  ClientListFilter,
  ClientListResponse,
  ClientResponse,
  ClientUpdateInput,
} from "./clients.schemas.js";
import { CLIENTS_REPOSITORY } from "./clients.tokens.js";
import type { ClientQueryHandle, ClientsRepository } from "./clients.types.js";
import {
  assertClientCanBeArchived,
  assertOrganizationAdmin,
  decodeClientCursor,
  toClientResponse,
} from "./clients.utils.js";

const ARCHIVED_STATUS = "archived";

@Injectable()
export class ClientsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database | null,
    @Inject(CLIENTS_REPOSITORY) private readonly repository: ClientsRepository,
    @Inject(AuditWriter)
    private readonly auditWriter: AuditWriter,
  ) {}

  private requireDb(): Database {
    if (!this.db) {
      throw new Error("Database client is not available for clients feature operations.");
    }

    return this.db;
  }

  async listClients(
    session: RequestSessionContext,
    query: ClientListFilter,
  ): Promise<ClientListResponse> {
    const db = this.requireDb();
    const parsedCursor = query.cursor ? decodeClientCursor(query.cursor) : undefined;

    const page = await this.repository.list(db as ClientQueryHandle, {
      organizationId: session.user.organizationId,
      limit: query.limit,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(parsedCursor ? { cursor: parsedCursor } : {}),
    });

    return {
      items: page.items.map((row) => toClientResponse(row)),
      pageInfo: page.pageInfo,
    };
  }

  async getClient(session: RequestSessionContext, clientId: string): Promise<ClientResponse> {
    const row = await this.repository.findById(
      this.requireDb() as ClientQueryHandle,
      session.user.organizationId,
      clientId,
    );

    if (!row) {
      throw new NotFoundException("Client not found.");
    }

    return toClientResponse(row);
  }

  async createClient(
    session: RequestSessionContext,
    input: ClientCreateInput,
    auditContext: AuditRequestContext,
  ): Promise<ClientResponse> {
    assertOrganizationAdmin(session);
    assertClientCanBeArchived(input.status);

    const now = new Date();
    const response = await this.requireDb().transaction(async (tx: AuditTransaction) => {
      const row = await this.repository.create(tx as ClientQueryHandle, {
        organizationId: auditContext.actor.organizationId,
        name: input.name,
        contactPerson: input.contactPerson ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
        status: input.status,
        createdAt: now,
        createdBy: auditContext.actor.actorId,
        updatedAt: now,
        updatedBy: auditContext.actor.actorId,
        version: 1,
      });

      const responseRow = toClientResponse(row);
      await this.auditWriter.record(tx, {
        organizationId: auditContext.actor.organizationId,
        actorId: auditContext.actor.actorId,
        action: "client.create",
        entityType: "client",
        entityId: row.id,
        before: null,
        after: responseRow,
        correlationId: auditContext.correlationId,
      });

      return responseRow;
    });

    return response;
  }

  async updateClient(
    session: RequestSessionContext,
    clientId: string,
    input: ClientUpdateInput,
    auditContext: AuditRequestContext,
  ): Promise<ClientResponse> {
    assertOrganizationAdmin(session);
    if (input.status !== undefined) {
      assertClientCanBeArchived(input.status);
    }

    const now = new Date();
    return this.requireDb().transaction(async (tx: AuditTransaction) => {
      const current = await this.repository.findById(
        tx as ClientQueryHandle,
        session.user.organizationId,
        clientId,
      );

      if (!current) {
        throw new NotFoundException("Client not found.");
      }

      if (current.status === ARCHIVED_STATUS) {
        throw new ForbiddenException(
          "Archived clients can only be managed through the archive endpoint.",
        );
      }

      const row = await this.repository.update(
        tx as ClientQueryHandle,
        session.user.organizationId,
        clientId,
        input.version,
        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.contactPerson !== undefined
            ? { contactPerson: input.contactPerson ?? null }
            : {}),
          ...(input.email !== undefined ? { email: input.email ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedAt: now,
          updatedBy: auditContext.actor.actorId,
        },
      );

      if (!row) {
        throw new ConflictException(
          "Client was modified by another request. Reload it and try again.",
        );
      }

      const response = toClientResponse(row);
      await this.auditWriter.record(tx, {
        organizationId: auditContext.actor.organizationId,
        actorId: auditContext.actor.actorId,
        action: "client.update",
        entityType: "client",
        entityId: row.id,
        before: toClientResponse(current),
        after: response,
        correlationId: auditContext.correlationId,
      });

      return response;
    });
  }

  async archiveClient(
    session: RequestSessionContext,
    clientId: string,
    auditContext: AuditRequestContext,
  ): Promise<ClientResponse> {
    assertOrganizationAdmin(session);

    const now = new Date();
    return this.requireDb().transaction(async (tx: AuditTransaction) => {
      const current = await this.repository.findById(
        tx as ClientQueryHandle,
        session.user.organizationId,
        clientId,
      );

      if (!current) {
        throw new NotFoundException("Client not found.");
      }

      const before = toClientResponse(current);
      if (current.status === ARCHIVED_STATUS) {
        await this.auditWriter.record(tx, {
          organizationId: auditContext.actor.organizationId,
          actorId: auditContext.actor.actorId,
          action: "client.archive",
          entityType: "client",
          entityId: current.id,
          before,
          after: before,
          correlationId: auditContext.correlationId,
        });

        return before;
      }

      const row = await this.repository.archive(
        tx as ClientQueryHandle,
        session.user.organizationId,
        clientId,
        {
          updatedAt: now,
          updatedBy: auditContext.actor.actorId,
          status: "archived",
          version: current.version + 1,
        },
      );

      if (!row) {
        throw new NotFoundException("Client not found.");
      }

      const response = toClientResponse(row);
      await this.auditWriter.record(tx, {
        organizationId: auditContext.actor.organizationId,
        actorId: auditContext.actor.actorId,
        action: "client.archive",
        entityType: "client",
        entityId: row.id,
        before,
        after: response,
        correlationId: auditContext.correlationId,
      });

      return response;
    });
  }
}
