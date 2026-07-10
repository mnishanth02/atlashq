import { currentOrganizationResponseSchema } from "@atlashq/validators";
import { describe, expect, it } from "vitest";
import type { AuthDirectory } from "../auth/auth-directory.js";
import type { RequestSessionContext } from "../auth/session-context.js";
import { OrganizationController } from "./organization.controller.js";

const userId = "b4d2d9bf-6f4e-4a5e-9b39-850f5f4ca949";
const organizationId = "f0fa124f-3578-4698-a451-688ef04b5c16";

const session: RequestSessionContext = {
  user: {
    id: userId,
    email: "ada@example.com",
    name: "Ada Lovelace",
    organizationId,
    organizationRole: "admin",
    status: "active",
  },
  session: {
    id: "0d863d1d-fc54-4b13-aa15-fd54585b6639",
    expiresAt: new Date("2999-01-01T00:00:00.000Z"),
  },
};

const directory: AuthDirectory = {
  async findUser() {
    return {
      id: userId,
      email: "ada@example.com",
      name: "Ada Lovelace",
      organizationId,
      organizationRole: "admin",
      status: "active",
    };
  },
  async findOrganization() {
    return {
      id: organizationId,
      name: "AtlasHQ",
      plan: "starter",
    };
  },
};

describe("OrganizationController", () => {
  it("returns the documented current-organization response shape", async () => {
    const response = await new OrganizationController(directory).getCurrentOrganization(session);

    expect(currentOrganizationResponseSchema.parse(response)).toEqual(response);
  });
});
