import {
  createAtlasApiClient,
  getClientQueryKey,
  getClientsListQueryKey,
  getOrganizationUsersListQueryKey,
  getProjectAuditEventsQueryKey,
  getProjectDashboardQueryKey,
  getProjectMembershipsQueryKey,
  getProjectQueryKey,
  getProjectsListQueryKey,
} from "@atlashq/api-client";
import { describe, expect, it, vi } from "vitest";
import {
  addProjectMembership,
  buildProjectsPageQuery,
  clientQueryOptions,
  clientsQueryOptions,
  createClient,
  fetchClients,
  fetchCurrentOrganization,
  fetchCurrentUser,
  fetchOrganizationUsers,
  getClientCreateInvalidationTargets,
  getClientMutationInvalidationTargets,
  getProjectAuditEventsFamilyQueryKey,
  getProjectCreateInvalidationTargets,
  getProjectMembershipMutationInvalidationTargets,
  getProjectMembershipsFamilyQueryKey,
  getProjectMutationInvalidationTargets,
  mergeProjectPages,
  organizationUsersQueryOptions,
  type ProjectListResponse,
  projectAuditEventsQueryOptions,
  projectDashboardQueryOptions,
  projectMembershipsQueryOptions,
  projectQueryOptions,
  projectsInfiniteQueryOptions,
  projectsQueryOptions,
  updateProject,
} from "./index";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function createRecordingClient(respond: (request: Request) => Response | Promise<Response>) {
  const calls: Array<{
    method: string;
    url: URL;
    body: unknown;
    signal: AbortSignal | null;
  }> = [];

  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const bodyText =
      request.method === "GET" || request.method === "HEAD" ? "" : await request.clone().text();
    calls.push({
      method: request.method,
      url: new URL(request.url),
      body: bodyText ? JSON.parse(bodyText) : undefined,
      signal: init?.signal ?? request.signal ?? null,
    });
    return respond(request);
  });

  return {
    client: createAtlasApiClient({ baseUrl: "https://api.test", fetch }),
    calls,
  };
}

describe("atlas api services", () => {
  it("sends query params and abort signals", async () => {
    const { client, calls } = createRecordingClient(() =>
      jsonResponse({ items: [], pageInfo: { limit: 10, nextCursor: null, hasMore: false } }),
    );
    const controller = new AbortController();

    await fetchClients(
      { cursor: "after-1", limit: 10, search: "Atlas" },
      { client, signal: controller.signal },
    );

    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    if (!firstCall) {
      throw new Error("missing first call");
    }
    expect(firstCall).toMatchObject({
      method: "GET",
      signal: controller.signal,
    });
    expect(firstCall.url.pathname).toBe("/api/v1/clients");
    expect(firstCall.url.searchParams.get("cursor")).toBe("after-1");
    expect(firstCall.url.searchParams.get("limit")).toBe("10");
    expect(firstCall.url.searchParams.get("search")).toBe("Atlas");
  });

  it("searches the organization user directory with query params and abort signals", async () => {
    const { client, calls } = createRecordingClient(() =>
      jsonResponse({ items: [], pageInfo: { limit: 25, nextCursor: null, hasMore: false } }),
    );
    const controller = new AbortController();

    await fetchOrganizationUsers(
      { search: "grace", status: "active", limit: 25 },
      { client, signal: controller.signal },
    );

    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    if (!firstCall) {
      throw new Error("missing first call");
    }
    expect(firstCall).toMatchObject({ method: "GET", signal: controller.signal });
    expect(firstCall.url.pathname).toBe("/api/v1/organizations/current/users");
    expect(firstCall.url.searchParams.get("search")).toBe("grace");
    expect(firstCall.url.searchParams.get("status")).toBe("active");
    expect(firstCall.url.searchParams.get("limit")).toBe("25");
  });

  it("sends request bodies and path params for writes", async () => {
    const { client, calls } = createRecordingClient((request) =>
      jsonResponse(
        {
          id: "entity-1",
          organizationId: "org-1",
          name: "Atlas",
          contactPerson: null,
          email: null,
          notes: null,
          status: "active",
          createdAt: "2026-07-10T00:00:00.000Z",
          createdBy: null,
          updatedAt: "2026-07-10T00:00:00.000Z",
          updatedBy: null,
          softDeletedAt: null,
          version: 1,
        },
        { status: request.method === "PATCH" ? 200 : 201 },
      ),
    );

    await createClient({ name: "Atlas", status: "active" }, { client });
    await updateProject("project-1", { version: 1, ownerId: "user-1" }, { client });
    await addProjectMembership("project-1", { userId: "user-2", role: "Developer" }, { client });

    expect(calls).toHaveLength(3);
    const [createCall, updateCall, membershipCall] = calls;
    if (!createCall || !updateCall || !membershipCall) {
      throw new Error("missing mutation call");
    }
    expect(createCall).toMatchObject({
      method: "POST",
      body: { name: "Atlas", status: "active" },
    });
    expect(createCall.url.pathname).toBe("/api/v1/clients");
    expect(updateCall).toMatchObject({
      method: "PATCH",
      body: { version: 1, ownerId: "user-1" },
    });
    expect(updateCall.url.pathname).toBe("/api/v1/projects/project-1");
    expect(membershipCall).toMatchObject({
      method: "POST",
      body: { userId: "user-2", role: "Developer" },
    });
    expect(membershipCall.url.pathname).toBe("/api/v1/projects/project-1/memberships");
  });

  it("normalizes openapi errors and preserves network failures", async () => {
    const apiError = {
      statusCode: 403,
      code: "forbidden",
      message: "No access",
      details: [{ path: ["projectId"], message: "Required", code: "missing" }],
      correlationId: "corr-123",
    };
    const errorClient = createAtlasApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () =>
        jsonResponse(apiError, {
          status: 403,
          headers: { "x-correlation-id": "header-corr" },
        }),
      ),
    });

    await expect(fetchCurrentUser({ client: errorClient })).rejects.toMatchObject({
      name: "AtlasApiError",
      status: 403,
      code: "forbidden",
      message: "No access",
      details: apiError.details,
      correlationId: "corr-123",
    });

    const networkError = new TypeError("network down");
    const networkClient = createAtlasApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () => {
        throw networkError;
      }),
    });

    await expect(fetchCurrentOrganization({ client: networkClient })).rejects.toBe(networkError);
  });
});

describe("atlas query options", () => {
  it("uses generated query keys and disables absent id queries", () => {
    expect(clientsQueryOptions({ cursor: "c1", limit: 20 }).queryKey).toEqual(
      getClientsListQueryKey({ cursor: "c1", limit: 20 }),
    );
    expect(clientQueryOptions(undefined).queryKey).toEqual(getClientQueryKey("__missing__"));
    expect(clientQueryOptions(undefined).enabled).toBe(false);
    expect(projectsQueryOptions({ cursor: "p1", includeArchived: true }).queryKey).toEqual(
      getProjectsListQueryKey({ cursor: "p1", includeArchived: true }),
    );
    expect(projectMembershipsQueryOptions("project-1", { limit: 5 }).queryKey).toEqual(
      getProjectMembershipsQueryKey("project-1", { limit: 5 }),
    );
    expect(projectAuditEventsQueryOptions("project-1", { actorId: "user-1" }).queryKey).toEqual(
      getProjectAuditEventsQueryKey("project-1", { actorId: "user-1" }),
    );
    expect(projectQueryOptions(undefined).queryKey).toEqual(getProjectQueryKey("__missing__"));
    expect(projectQueryOptions(undefined).enabled).toBe(false);
    expect(projectDashboardQueryOptions(undefined).queryKey).toEqual(
      getProjectDashboardQueryKey("__missing__"),
    );
    expect(projectMembershipsQueryOptions(undefined).enabled).toBe(false);
    expect(organizationUsersQueryOptions({ search: "grace" }).queryKey).toEqual(
      getOrganizationUsersListQueryKey({ search: "grace" }),
    );
  });

  it("constructs stable infinite-project keys and cursor page requests", () => {
    const filters = {
      search: "atlas",
      status: "active" as const,
      includeArchived: true,
      sort: "name_asc" as const,
    };

    expect(buildProjectsPageQuery(filters)).toEqual({
      ...filters,
      limit: 25,
    });
    expect(buildProjectsPageQuery(filters, "next-page")).toEqual({
      ...filters,
      limit: 25,
      cursor: "next-page",
    });
    expect(projectsInfiniteQueryOptions(filters).queryKey).toEqual([
      ...getProjectsListQueryKey({ ...filters, limit: 25 }),
      "infinite",
    ]);
  });

  it("merges infinite pages in order and replaces duplicate ids with fresh rows", () => {
    const project = (id: string, name: string) =>
      ({ id, name }) as ProjectListResponse["items"][number];
    const page = (
      items: ProjectListResponse["items"],
      nextCursor: string | null,
    ): ProjectListResponse => ({
      items,
      pageInfo: {
        limit: 2,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    });

    expect(
      mergeProjectPages({
        pages: [
          page([project("project-1", "One"), project("project-2", "Old")], "cursor-2"),
          page([project("project-2", "Updated"), project("project-3", "Three")], null),
        ],
        pageParams: [null, "cursor-2"],
      }),
    ).toEqual([
      project("project-1", "One"),
      project("project-2", "Updated"),
      project("project-3", "Three"),
    ]);
  });
});

describe("atlas invalidation targets", () => {
  it("returns coherent family targets for mutations", () => {
    expect(getClientCreateInvalidationTargets()).toEqual([["api", "clients", "list"]]);
    expect(getClientMutationInvalidationTargets("client-1")).toEqual([
      ["api", "clients", "list"],
      getClientQueryKey("client-1"),
    ]);
    expect(getProjectCreateInvalidationTargets()).toEqual([["api", "projects", "list"]]);
    expect(getProjectMutationInvalidationTargets("project-1")).toEqual([
      ["api", "projects", "list"],
      getProjectQueryKey("project-1"),
      getProjectDashboardQueryKey("project-1"),
      getProjectMembershipsFamilyQueryKey("project-1"),
      getProjectAuditEventsFamilyQueryKey("project-1"),
    ]);
    expect(getProjectMembershipMutationInvalidationTargets("project-1")).toEqual([
      ["api", "projects", "list"],
      getProjectMembershipsFamilyQueryKey("project-1"),
      getProjectQueryKey("project-1"),
      getProjectDashboardQueryKey("project-1"),
      getProjectAuditEventsFamilyQueryKey("project-1"),
    ]);
  });
});
