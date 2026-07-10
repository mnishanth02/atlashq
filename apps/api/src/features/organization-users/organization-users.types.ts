import type { Database } from "@atlashq/db";
import type { PaginationMeta } from "@atlashq/validators";

/** Query handle: reads never need a write-capable handle, unlike the mutating features. */
export type OrganizationUserQueryHandle = Pick<Database, "select">;

export type OrganizationUserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  organizationRole: string;
};

export type OrganizationUserCursor = {
  sortName: string;
  userId: string;
};

export type OrganizationUserListQuery = {
  organizationId: string;
  status?: string;
  search?: string;
  cursor?: OrganizationUserCursor;
  limit: number;
};

export type OrganizationUserListPage = {
  items: OrganizationUserRow[];
  pageInfo: PaginationMeta;
};

export interface OrganizationUsersRepository {
  list(
    handle: OrganizationUserQueryHandle,
    query: OrganizationUserListQuery,
  ): Promise<OrganizationUserListPage>;
}
