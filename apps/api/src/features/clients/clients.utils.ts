import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { z } from "zod";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { type ClientResponse, clientResponseSchema } from "./clients.schemas.js";
import type { ClientCursor, ClientRow } from "./clients.types.js";

const ARCHIVED_STATUS = "archived";
const clientCursorSchema = z
  .object({
    sortName: z.string().trim().min(1),
    clientId: z.uuid(),
  })
  .strict();

// Local cursor shape is intentionally narrower than the response schema and stays opaque.
export function encodeClientCursor(cursor: ClientCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeClientCursor(cursor: string): ClientCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));

    const validated = clientCursorSchema.parse(parsed);
    return {
      sortName: validated.sortName.trim().toLowerCase(),
      clientId: validated.clientId.trim(),
    };
  } catch {
    throw new BadRequestException("Invalid client cursor.");
  }
}

export function assertOrganizationAdmin(session: RequestSessionContext): void {
  if (session.user.organizationRole !== "admin") {
    throw new ForbiddenException("Organization-admin privileges are required.");
  }
}

export function assertClientCanBeArchived(status: string): void {
  if (status === ARCHIVED_STATUS) {
    throw new ForbiddenException(
      "Archived clients can only be managed through the archive endpoint.",
    );
  }
}

export function toClientResponse(row: ClientRow): ClientResponse {
  return clientResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    contactPerson: row.contactPerson,
    email: row.email,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    softDeletedAt: row.softDeletedAt ? row.softDeletedAt.toISOString() : null,
    version: row.version,
  });
}

export function paginateClientRows<T extends { id: string; name: string }>(
  rows: T[],
  limit: number,
): { items: T[]; pageInfo: { limit: number; nextCursor: string | null; hasMore: boolean } } {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const lastItem = items[items.length - 1];

  return {
    items,
    pageInfo: {
      limit,
      hasMore,
      nextCursor:
        hasMore && lastItem
          ? encodeClientCursor({
              sortName: lastItem.name.trim().toLowerCase(),
              clientId: lastItem.id,
            })
          : null,
    },
  };
}
