import { client } from "@atlashq/db";
import { and, asc, eq, gt, ilike, isNull, ne, or, sql } from "drizzle-orm";
import type { ClientListPage, ClientQueryHandle, ClientRow } from "./clients.types.js";
import { paginateClientRows } from "./clients.utils.js";

const rowProjection = {
  id: client.id,
  organizationId: client.organizationId,
  name: client.name,
  contactPerson: client.contactPerson,
  email: client.email,
  notes: client.notes,
  status: client.status,
  createdAt: client.createdAt,
  createdBy: client.createdBy,
  updatedAt: client.updatedAt,
  updatedBy: client.updatedBy,
  softDeletedAt: client.softDeletedAt,
  version: client.version,
} as const;

export class DrizzleClientsRepository {
  async list(
    handle: ClientQueryHandle,
    query: {
      organizationId: string;
      status?: string;
      search?: string;
      cursor?: { sortName: string; clientId: string };
      limit: number;
    },
  ): Promise<ClientListPage> {
    const sortNameExpression = sql<string>`lower(${client.name})`;
    const rows = await handle
      .select(rowProjection)
      .from(client)
      .where(
        and(
          eq(client.organizationId, query.organizationId),
          isNull(client.softDeletedAt),
          query.status ? eq(client.status, query.status) : undefined,
          query.search
            ? or(
                ilike(client.name, `%${query.search}%`),
                ilike(client.contactPerson, `%${query.search}%`),
                ilike(client.email, `%${query.search}%`),
              )
            : undefined,
          query.cursor
            ? or(
                gt(sortNameExpression, query.cursor.sortName),
                and(
                  eq(sortNameExpression, query.cursor.sortName),
                  gt(client.id, query.cursor.clientId),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(sortNameExpression), asc(client.id))
      .limit(query.limit + 1);

    const page = paginateClientRows(rows as ClientRow[], query.limit);
    return {
      items: page.items as ClientRow[],
      pageInfo: page.pageInfo,
    };
  }

  async findById(
    handle: ClientQueryHandle,
    organizationId: string,
    clientId: string,
  ): Promise<ClientRow | null> {
    const rows = await handle
      .select(rowProjection)
      .from(client)
      .where(
        and(
          eq(client.organizationId, organizationId),
          eq(client.id, clientId),
          isNull(client.softDeletedAt),
        ),
      )
      .limit(1);

    return (rows[0] as ClientRow | undefined) ?? null;
  }

  async create(
    handle: ClientQueryHandle,
    values: {
      organizationId: string;
      name: string;
      contactPerson: string | null;
      email: string | null;
      notes: string | null;
      status: string;
      createdAt: Date;
      createdBy: string;
      updatedAt: Date;
      updatedBy: string;
      version: number;
    },
  ): Promise<ClientRow> {
    const rows = await handle
      .insert(client)
      .values({
        organizationId: values.organizationId,
        name: values.name,
        contactPerson: values.contactPerson,
        email: values.email,
        notes: values.notes,
        status: values.status,
        createdAt: values.createdAt,
        createdBy: values.createdBy,
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
        version: values.version,
      })
      .returning(rowProjection);

    const row = rows[0] as ClientRow | undefined;
    if (!row) {
      throw new Error("Client insert did not return the inserted row.");
    }

    return row;
  }

  async update(
    handle: ClientQueryHandle,
    organizationId: string,
    clientId: string,
    expectedVersion: number,
    values: {
      name?: string;
      contactPerson?: string | null;
      email?: string | null;
      notes?: string | null;
      status?: string;
      updatedAt: Date;
      updatedBy: string;
    },
  ): Promise<ClientRow | null> {
    const rows = await handle
      .update(client)
      .set({
        ...(values.name !== undefined ? { name: values.name } : {}),
        ...(values.contactPerson !== undefined ? { contactPerson: values.contactPerson } : {}),
        ...(values.email !== undefined ? { email: values.email } : {}),
        ...(values.notes !== undefined ? { notes: values.notes } : {}),
        ...(values.status !== undefined ? { status: values.status } : {}),
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
        version: sql`${client.version} + 1`,
      })
      .where(
        and(
          eq(client.organizationId, organizationId),
          eq(client.id, clientId),
          eq(client.version, expectedVersion),
          isNull(client.softDeletedAt),
          ne(client.status, "archived"),
        ),
      )
      .returning(rowProjection);

    return (rows[0] as ClientRow | undefined) ?? null;
  }

  async archive(
    handle: ClientQueryHandle,
    organizationId: string,
    clientId: string,
    values: {
      updatedAt: Date;
      updatedBy: string;
      status: "archived";
      version: number;
    },
  ): Promise<ClientRow | null> {
    const rows = await handle
      .update(client)
      .set({
        status: values.status,
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
        version: values.version,
      })
      .where(
        and(
          eq(client.organizationId, organizationId),
          eq(client.id, clientId),
          isNull(client.softDeletedAt),
        ),
      )
      .returning(rowProjection);

    return (rows[0] as ClientRow | undefined) ?? null;
  }
}
