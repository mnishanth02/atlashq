import { describe, expect, it, vi } from "vitest";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { OrganizationUsersController } from "./organization-users.controller.js";
import type { OrganizationUsersService } from "./organization-users.service.js";

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

describe("OrganizationUsersController", () => {
  it("delegates to the service with the session and parsed query", async () => {
    const listOrganizationUsers = vi.fn(async () => ({
      items: [],
      pageInfo: { limit: 25, nextCursor: null, hasMore: false },
    }));
    const service = { listOrganizationUsers } as unknown as OrganizationUsersService;
    const controller = new OrganizationUsersController(service);

    const query = { limit: 25, search: "grace" };
    const response = await controller.listOrganizationUsers(session(), query as never);

    expect(listOrganizationUsers).toHaveBeenCalledWith(session(), query);
    expect(response).toEqual({
      items: [],
      pageInfo: { limit: 25, nextCursor: null, hasMore: false },
    });
  });
});
