import { user } from "@atlashq/db";
import { and, asc, eq, gt, ilike, isNull, or, sql } from "drizzle-orm";
import type {
  OrganizationUserListPage,
  OrganizationUserQueryHandle,
  OrganizationUserRow,
  OrganizationUsersRepository,
} from "./organization-users.types.js";
import { paginateOrganizationUserRows } from "./organization-users.utils.js";

const rowProjection = {
  id: user.id,
  name: user.name,
  email: user.email,
  status: user.status,
  organizationRole: user.organizationRole,
} as const;

export class DrizzleOrganizationUsersRepository implements OrganizationUsersRepository {
  async list(
    handle: OrganizationUserQueryHandle,
    query: {
      organizationId: string;
      status?: string;
      search?: string;
      cursor?: { sortName: string; userId: string };
      limit: number;
    },
  ): Promise<OrganizationUserListPage> {
    const sortNameExpression = sql<string>`lower(${user.name})`;
    const rows = await handle
      .select(rowProjection)
      .from(user)
      .where(
        and(
          eq(user.organizationId, query.organizationId),
          isNull(user.softDeletedAt),
          query.status ? eq(user.status, query.status) : undefined,
          query.search
            ? or(ilike(user.name, `%${query.search}%`), ilike(user.email, `%${query.search}%`))
            : undefined,
          query.cursor
            ? or(
                gt(sortNameExpression, query.cursor.sortName),
                and(
                  eq(sortNameExpression, query.cursor.sortName),
                  gt(user.id, query.cursor.userId),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(sortNameExpression), asc(user.id))
      .limit(query.limit + 1);

    const page = paginateOrganizationUserRows(rows as OrganizationUserRow[], query.limit);
    return {
      items: page.items as OrganizationUserRow[],
      pageInfo: page.pageInfo,
    };
  }
}
