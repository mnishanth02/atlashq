import type { Database } from "@atlashq/db";
import { describe, expect, it, vi } from "vitest";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { OrganizationUsersService } from "./organization-users.service.js";
import type {
  OrganizationUserListPage,
  OrganizationUserListQuery,
  OrganizationUserQueryHandle,
  OrganizationUserRow,
  OrganizationUsersRepository,
} from "./organization-users.types.js";
import { encodeOrganizationUserCursor } from "./organization-users.utils.js";

function session(): RequestSessionContext {
  return {
    user: {
      id: "67dcb6b0-14b9-444a-9cf0-6eb033af62b0",
      email: "ada@example.com",
      name: "Ada Lovelace",
      organizationId: "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90",
      organizationRole: "member",
      status: "active",
    },
    session: {
      id: "61e6c6c8-6f1a-4c62-84ca-3e4d2a18c2f8",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    },
  };
}

function row(overrides: Partial<OrganizationUserRow> = {}): OrganizationUserRow {
  return {
    id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9",
    name: "Grace Hopper",
    email: "grace@example.com",
    status: "active",
    organizationRole: "member",
    ...overrides,
  };
}

function fakeDb(): Database {
  return {} as unknown as Database;
}

function fakeRepository(
  overrides: Partial<OrganizationUsersRepository> = {},
): OrganizationUsersRepository {
  return {
    async list() {
      const page: OrganizationUserListPage = {
        items: [row()],
        pageInfo: { limit: 25, nextCursor: null, hasMore: false },
      };
      return page;
    },
    ...overrides,
  };
}

describe("OrganizationUsersService", () => {
  it("allows a plain member (no elevated role required) to search the directory", async () => {
    const service = new OrganizationUsersService(fakeDb(), fakeRepository());

    const response = await service.listOrganizationUsers(session(), { limit: 25 });

    expect(response.items).toEqual([
      {
        id: row().id,
        name: row().name,
        email: row().email,
        status: row().status,
        organizationRole: row().organizationRole,
      },
    ]);
  });

  it("always scopes the repository query to the caller's session organization", async () => {
    const list = vi.fn(async (_handle: unknown, query: { organizationId: string }) => ({
      items: [row({ id: query.organizationId === session().user.organizationId ? row().id : "x" })],
      pageInfo: { limit: 25, nextCursor: null, hasMore: false },
    }));
    const service = new OrganizationUsersService(fakeDb(), fakeRepository({ list }));

    await service.listOrganizationUsers(session(), { limit: 25 });

    expect(list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: session().user.organizationId }),
    );
  });

  it("forwards search and status filters, omitting them when absent", async () => {
    const list = vi.fn(
      async (_handle: OrganizationUserQueryHandle, _query: OrganizationUserListQuery) => ({
        items: [row()],
        pageInfo: { limit: 25, nextCursor: null, hasMore: false },
      }),
    );
    const service = new OrganizationUsersService(fakeDb(), fakeRepository({ list }));

    await service.listOrganizationUsers(session(), {
      limit: 25,
      search: "grace",
      status: "active",
    });

    expect(list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: "grace", status: "active" }),
    );
    expect(list.mock.calls[0]?.[1]).not.toHaveProperty("cursor");
  });

  it("decodes a supplied cursor before delegating to the repository", async () => {
    const cursor = encodeOrganizationUserCursor({ sortName: "ada lovelace", userId: row().id });
    const list = vi.fn(async () => ({
      items: [row()],
      pageInfo: { limit: 25, nextCursor: null, hasMore: false },
    }));
    const service = new OrganizationUsersService(fakeDb(), fakeRepository({ list }));

    await service.listOrganizationUsers(session(), { limit: 25, cursor });

    expect(list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cursor: { sortName: "ada lovelace", userId: row().id } }),
    );
  });

  it("rejects a malformed cursor with a validation error", async () => {
    const service = new OrganizationUsersService(fakeDb(), fakeRepository());

    await expect(
      service.listOrganizationUsers(session(), { limit: 25, cursor: "not-a-cursor" }),
    ).rejects.toThrow("Invalid organization user cursor.");
  });
});
