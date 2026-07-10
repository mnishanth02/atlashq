import { describe, expect, it } from "vitest";
import { clientListResponseSchema, clientResponseSchema } from "./clients.schemas.js";

const client = {
  id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9",
  organizationId: "73c6bd18-7e02-4ad3-b2c3-5b99ad1e6d1e",
  name: "Acme Corp",
  contactPerson: "Jane Doe",
  email: "ops@acme.test",
  notes: "Enterprise client",
  status: "active",
  createdAt: "2026-07-09T18:00:00.000Z",
  createdBy: "11de9f7a-4eb2-4ad8-9f9e-4f4efdb3f5d2",
  updatedAt: "2026-07-09T19:00:00.000Z",
  updatedBy: "11de9f7a-4eb2-4ad8-9f9e-4f4efdb3f5d2",
  softDeletedAt: null,
  version: 3,
};

describe("clientResponseSchema", () => {
  it("accepts the documented response shape", () => {
    expect(clientResponseSchema.parse(client)).toEqual(client);
  });
});

describe("clientListResponseSchema", () => {
  it("accepts the paginated response shape", () => {
    expect(
      clientListResponseSchema.parse({
        items: [client],
        pageInfo: { limit: 1, nextCursor: null, hasMore: false },
      }),
    ).toEqual({
      items: [client],
      pageInfo: { limit: 1, nextCursor: null, hasMore: false },
    });
  });
});
