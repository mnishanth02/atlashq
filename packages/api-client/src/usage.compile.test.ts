import type { FetchResponse, MethodResponse } from "openapi-fetch";
import { describe, expect, it } from "vitest";
import type { AtlasApiClient, components, paths } from "./index.js";

/**
 * Compile-time contract tests. These assertions are validated by `tsc`
 * (this file is part of the api-client typecheck) and exercised trivially by
 * vitest. `@ts-expect-error` proves that invalid calls fail to compile; the
 * typed functions below are never invoked at runtime, so no network happens.
 */

type Expect<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;

// --- Response/error data resolve to the generated component schemas ---------

type ProjectDetailData = MethodResponse<AtlasApiClient, "get", "/api/v1/projects/{projectId}">;
type ProjectDetailError = NonNullable<
  FetchResponse<
    paths["/api/v1/projects/{projectId}"]["get"],
    Record<string, never>,
    `${string}/${string}`
  >["error"]
>;
type ClientsListData = MethodResponse<AtlasApiClient, "get", "/api/v1/clients">;
type OrganizationUsersListData = MethodResponse<
  AtlasApiClient,
  "get",
  "/api/v1/organizations/current/users"
>;

type ContractTypeChecks = [
  Expect<Extends<ProjectDetailData, components["schemas"]["ProjectResponseDto_Output"]>>,
  Expect<Extends<components["schemas"]["ProjectResponseDto_Output"], ProjectDetailData>>,
  Expect<Extends<ProjectDetailError, components["schemas"]["ApiErrorDto"]>>,
  Expect<Extends<ClientsListData, components["schemas"]["ClientListResponseDto_Output"]>>,
  Expect<
    Extends<
      OrganizationUsersListData,
      components["schemas"]["OrganizationUserListResponseDto_Output"]
    >
  >,
];

const contractTypeChecks: ContractTypeChecks = [true, true, true, true, true];

// --- Valid calls must compile ------------------------------------------------

async function positiveContractCalls(client: AtlasApiClient) {
  // Project list query fields are typed (numbers, enums, and booleans).
  await client.GET("/api/v1/projects", {
    params: {
      query: {
        limit: 10,
        type: "client",
        includeArchived: false,
        search: "atlas",
        sort: "name_asc",
      },
    },
  });

  // GET project detail with the required path param resolves and is typed.
  const projectDetail = await client.GET("/api/v1/projects/{projectId}", {
    params: { path: { projectId: "project-1" } },
  });
  if (projectDetail.data) {
    const owner: string = projectDetail.data.ownerId;
    void owner;
  }

  // POST client body is typed; only `name` is required.
  await client.POST("/api/v1/clients", { body: { name: "Acme", status: "active" } });

  // Client projects require clientId.
  await client.POST("/api/v1/projects", {
    body: {
      name: "Atlas",
      type: "client",
      clientId: "33333333-3333-4333-8333-333333333333",
      ownerId: "11111111-1111-4111-8111-111111111111",
      priority: "high",
    },
  });

  // Internal projects omit clientId.
  await client.POST("/api/v1/projects", {
    body: {
      name: "Atlas Internal",
      type: "internal",
      ownerId: "11111111-1111-4111-8111-111111111111",
    },
  });

  // Version is required and nullable PATCH fields accept explicit null.
  await client.PATCH("/api/v1/projects/{projectId}", {
    params: { path: { projectId: "project-1" } },
    body: {
      version: 3,
      clientId: null,
      techLeadId: null,
      description: null,
      name: "Renamed",
    },
  });

  await client.PATCH("/api/v1/clients/{clientId}", {
    params: { path: { clientId: "client-1" } },
    body: { version: 2, contactPerson: null, email: null, notes: null },
  });

  // Membership create body only needs userId/role, not a duplicated projectId.
  await client.POST("/api/v1/projects/{projectId}/memberships", {
    params: { path: { projectId: "project-1" } },
    body: { userId: "user-1", role: "Developer" },
  });

  // No-body POST operation (archive) only needs the path param.
  await client.POST("/api/v1/clients/{clientId}/archive", {
    params: { path: { clientId: "client-1" } },
  });

  // Organization user directory search: query params are optional and typed.
  const directory = await client.GET("/api/v1/organizations/current/users", {
    params: { query: { search: "grace", status: "active", limit: 25 } },
  });
  if (directory.data) {
    const first = directory.data.items[0];
    if (first) {
      const status: "active" | "suspended" | "archived" = first.status;
      const role: "admin" | "member" = first.organizationRole;
      void status;
      void role;
    }
  }

  // No query params at all is also valid (every field is optional).
  await client.GET("/api/v1/organizations/current/users");

  await client.POST("/api/v1/projects", {
    // @ts-expect-error - client projects require clientId.
    body: {
      name: "Missing client",
      type: "client",
      ownerId: "11111111-1111-4111-8111-111111111111",
    },
  });

  await client.POST("/api/v1/projects", {
    body: {
      name: "Archived create",
      type: "internal",
      ownerId: "11111111-1111-4111-8111-111111111111",
      // @ts-expect-error - archived is managed through the lifecycle endpoint.
      status: "archived",
    },
  });

  await client.PATCH("/api/v1/projects/{projectId}", {
    params: { path: { projectId: "project-1" } },
    // @ts-expect-error - optimistic version is required.
    body: { name: "Missing version" },
  });

  await client.PATCH("/api/v1/projects/{projectId}", {
    params: { path: { projectId: "project-1" } },
    body: {
      version: 3,
      // @ts-expect-error - archived is not a normal PATCH status.
      status: "archived",
    },
  });

  await client.PATCH("/api/v1/clients/{clientId}", {
    params: { path: { clientId: "client-1" } },
    // @ts-expect-error - optimistic version is required.
    body: { name: "Missing version" },
  });
}

// --- Invalid calls must fail to compile -------------------------------------

async function negativeContractCalls(client: AtlasApiClient) {
  // @ts-expect-error - projectId path param is required.
  await client.GET("/api/v1/projects/{projectId}");

  await client.GET("/api/v1/projects/{projectId}", {
    // @ts-expect-error - path.projectId is required.
    params: { path: {} },
  });

  await client.GET("/api/v1/projects", {
    // @ts-expect-error - limit must be a number, not a string.
    params: { query: { limit: "10" } },
  });

  await client.GET("/api/v1/projects", {
    // @ts-expect-error - unknownFilter is not a valid query parameter.
    params: { query: { unknownFilter: true } },
  });

  // @ts-expect-error - the create body is required.
  await client.POST("/api/v1/clients");

  // @ts-expect-error - name is required in the client create body.
  await client.POST("/api/v1/clients", { body: {} });

  await client.POST("/api/v1/projects/{projectId}/memberships", {
    params: { path: { projectId: "project-1" } },
    // @ts-expect-error - role must be one of the membership role enum values.
    body: { userId: "user-1", role: "not-a-role" },
  });

  await client.GET("/api/v1/organizations/current/users", {
    // @ts-expect-error - status must be one of the account status enum values.
    params: { query: { status: "not-a-status" } },
  });

  await client.GET("/api/v1/organizations/current/users", {
    // @ts-expect-error - unknownFilter is not a valid query parameter.
    params: { query: { unknownFilter: true } },
  });
}

describe("generated contract", () => {
  it("type-checks against openapi-fetch", () => {
    expect(contractTypeChecks).toHaveLength(5);
    expect(typeof positiveContractCalls).toBe("function");
    expect(typeof negativeContractCalls).toBe("function");
  });
});
