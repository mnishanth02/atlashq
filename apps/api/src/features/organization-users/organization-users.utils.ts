import { type OrganizationUserResponse, organizationUserResponseSchema } from "@atlashq/validators";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type { OrganizationUserCursor, OrganizationUserRow } from "./organization-users.types.js";

const organizationUserCursorSchema = z
  .object({
    sortName: z.string().trim().min(1),
    userId: z.uuid(),
  })
  .strict();

// Local cursor shape is intentionally narrower than the response schema and stays opaque.
export function encodeOrganizationUserCursor(cursor: OrganizationUserCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeOrganizationUserCursor(cursor: string): OrganizationUserCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));

    const validated = organizationUserCursorSchema.parse(parsed);
    return {
      sortName: validated.sortName.trim().toLowerCase(),
      userId: validated.userId.trim(),
    };
  } catch {
    throw new BadRequestException("Invalid organization user cursor.");
  }
}

export function toOrganizationUserResponse(row: OrganizationUserRow): OrganizationUserResponse {
  return organizationUserResponseSchema.parse({
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    organizationRole: row.organizationRole,
  });
}

export function paginateOrganizationUserRows<T extends { id: string; name: string }>(
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
          ? encodeOrganizationUserCursor({
              sortName: lastItem.name.trim().toLowerCase(),
              userId: lastItem.id,
            })
          : null,
    },
  };
}
