import createClient from "openapi-fetch";
import type { operations, paths } from "./generated/openapi.js";

export type { components, operations, paths } from "./generated/openapi.js";

export const DEFAULT_API_BASE_URL = "";

export type AtlasApiClientOptions = {
  /** Root URL for all API requests. Defaults to same-origin (""). */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to globalThis.fetch). */
  fetch?: typeof fetch;
  /**
   * Credentials mode forwarded to every request. Defaults to `"include"` so
   * Better Auth session cookies are sent with same-origin API calls.
   */
  credentials?: RequestCredentials;
};

export function createAtlasApiClient(options: AtlasApiClientOptions = {}) {
  const { baseUrl = DEFAULT_API_BASE_URL, credentials = "include", fetch: fetchImpl } = options;

  return createClient<paths>({
    baseUrl,
    credentials,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
}

export type AtlasApiClient = ReturnType<typeof createAtlasApiClient>;

/** Typed query parameters for the clients list endpoint. */
export type ClientsListQuery = NonNullable<
  operations["ClientsController_listClients"]["parameters"]["query"]
>;

/** Typed query parameters for the projects list endpoint. */
export type ProjectsListQuery = NonNullable<
  operations["ProjectsController_listProjects"]["parameters"]["query"]
>;

/** Typed query parameters for the project memberships list endpoint. */
export type ProjectMembershipsQuery = NonNullable<
  operations["ProjectsController_listMemberships"]["parameters"]["query"]
>;

/** Typed query parameters for the project audit events list endpoint. */
export type ProjectAuditEventsQuery = NonNullable<
  operations["ProjectsController_listAuditEvents"]["parameters"]["query"]
>;

/** Typed query parameters for the organization user directory search endpoint. */
export type OrganizationUsersListQuery = NonNullable<
  operations["OrganizationUsersController_listOrganizationUsers"]["parameters"]["query"]
>;

export function getHealthQueryKey() {
  return ["api", "health"] as const;
}

export function getAuthContextQueryKey() {
  return ["api", "auth", "context"] as const;
}

export function getClientsListQueryKey(filters: ClientsListQuery = {}) {
  return ["api", "clients", "list", filters] as const;
}

export function getClientQueryKey(clientId: string) {
  return ["api", "clients", "detail", clientId] as const;
}

export function getProjectsListQueryKey(filters: ProjectsListQuery = {}) {
  return ["api", "projects", "list", filters] as const;
}

export function getProjectQueryKey(projectId: string) {
  return ["api", "projects", "detail", projectId] as const;
}

export function getProjectDashboardQueryKey(projectId: string) {
  return ["api", "projects", "detail", projectId, "dashboard"] as const;
}

export function getProjectMembershipsQueryKey(
  projectId: string,
  filters: ProjectMembershipsQuery = {},
) {
  return ["api", "projects", "detail", projectId, "memberships", filters] as const;
}

export function getProjectAuditEventsQueryKey(
  projectId: string,
  filters: ProjectAuditEventsQuery = {},
) {
  return ["api", "projects", "detail", projectId, "audit-events", filters] as const;
}

export function getOrganizationUsersListQueryKey(filters: OrganizationUsersListQuery = {}) {
  return ["api", "organizations", "current", "users", "list", filters] as const;
}
