import type { Database } from "@atlashq/db";
import { Inject, Injectable } from "@nestjs/common";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { DATABASE_CLIENT } from "../../runtime/runtime.js";
import type {
  OrganizationUserListFilter,
  OrganizationUserListResponse,
} from "./organization-users.schemas.js";
import { ORGANIZATION_USERS_REPOSITORY } from "./organization-users.tokens.js";
import type {
  OrganizationUserQueryHandle,
  OrganizationUsersRepository,
} from "./organization-users.types.js";
import {
  decodeOrganizationUserCursor,
  toOrganizationUserResponse,
} from "./organization-users.utils.js";

@Injectable()
export class OrganizationUsersService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database | null,
    @Inject(ORGANIZATION_USERS_REPOSITORY) private readonly repository: OrganizationUsersRepository,
  ) {}

  private requireDb(): Database {
    if (!this.db) {
      throw new Error("Database client is not available for organization-users operations.");
    }

    return this.db;
  }

  /**
   * Search the caller's own organization directory. Every active session user may call this (no
   * elevated role required): the org scope always comes from the session, never a request input,
   * so there is no cross-organization leakage surface.
   */
  async listOrganizationUsers(
    session: RequestSessionContext,
    query: OrganizationUserListFilter,
  ): Promise<OrganizationUserListResponse> {
    const db = this.requireDb();
    const parsedCursor = query.cursor ? decodeOrganizationUserCursor(query.cursor) : undefined;

    const page = await this.repository.list(db as OrganizationUserQueryHandle, {
      organizationId: session.user.organizationId,
      limit: query.limit,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(parsedCursor ? { cursor: parsedCursor } : {}),
    });

    return {
      items: page.items.map((row) => toOrganizationUserResponse(row)),
      pageInfo: page.pageInfo,
    };
  }
}
