import type {
  AtlasApiClient,
  ClientsListQuery,
  components,
  OrganizationUsersListQuery,
  operations,
  ProjectAuditEventsQuery,
  ProjectMembershipsQuery,
  ProjectsListQuery,
} from "@atlashq/api-client";
import {
  createAtlasApiClient,
  getClientQueryKey,
  getProjectDashboardQueryKey,
  getProjectQueryKey,
} from "@atlashq/api-client";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type ApiRequestOptions = {
  client?: AtlasApiClient;
  signal?: AbortSignal;
};

type JsonResponse<
  Operation extends keyof operations,
  Status extends keyof operations[Operation]["responses"],
> = operations[Operation]["responses"][Status] extends {
  content: { "application/json": infer Body };
}
  ? Body
  : never;

type JsonRequestBody<Operation extends keyof operations> = operations[Operation] extends {
  requestBody: { content: { "application/json": infer Body } };
}
  ? Body
  : never;

type ApiErrorDto = components["schemas"]["ApiErrorDto"];
type ApiErrorDetails = ApiErrorDto["details"];

const MISSING_ID = "__missing__";
const HTTP_ERROR_CODE = "HTTP_ERROR";

export function getAtlasApiBaseUrl() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

const dynamicFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

export const atlasApiClient = createAtlasApiClient({
  baseUrl: getAtlasApiBaseUrl(),
  fetch: dynamicFetch,
});

export const currentUserQueryKey = ["api", "me"] as const;
export const currentOrganizationQueryKey = ["api", "organizations", "current"] as const;
export const clientListFamilyQueryKey = ["api", "clients", "list"] as const;
export const clientDetailFamilyQueryKey = ["api", "clients", "detail"] as const;
export const projectListFamilyQueryKey = ["api", "projects", "list"] as const;
export const projectDetailFamilyQueryKey = ["api", "projects", "detail"] as const;
export const organizationUsersListFamilyQueryKey = [
  "api",
  "organizations",
  "current",
  "users",
  "list",
] as const;

export function getProjectMembershipsFamilyQueryKey(projectId: string) {
  return ["api", "projects", "detail", projectId, "memberships"] as const;
}

export function getProjectAuditEventsFamilyQueryKey(projectId: string) {
  return ["api", "projects", "detail", projectId, "audit-events"] as const;
}

export type CurrentUserResponse = JsonResponse<"MeController_getCurrentUser", 200>;
export type CurrentOrganizationResponse = JsonResponse<
  "OrganizationController_getCurrentOrganization",
  200
>;
export type ClientListResponse = JsonResponse<"ClientsController_listClients", 200>;
export type ClientResponse = JsonResponse<"ClientsController_getClient", 200>;
export type CreateClientResponse = JsonResponse<"ClientsController_createClient", 201>;
export type CreateClientInput = JsonRequestBody<"ClientsController_createClient">;
export type UpdateClientInput = JsonRequestBody<"ClientsController_updateClient">;
export type ProjectListResponse = JsonResponse<"ProjectsController_listProjects", 200>;
export type ProjectResponse = JsonResponse<"ProjectsController_getProject", 200>;
export type CreateProjectResponse = JsonResponse<"ProjectsController_createProject", 201>;
export type CreateProjectInput = JsonRequestBody<"ProjectsController_createProject">;
export type UpdateProjectInput = JsonRequestBody<"ProjectsController_updateProject">;
export type ProjectDashboardResponse = JsonResponse<"ProjectsController_getDashboard", 200>;
export type ProjectMembershipListResponse = JsonResponse<"ProjectsController_listMemberships", 200>;
export type CreateProjectMembershipInput = JsonRequestBody<"ProjectsController_addMembership">;
export type UpdateProjectMembershipInput = JsonRequestBody<"ProjectsController_updateMembership">;
export type ProjectMembershipCreatedResponse = JsonResponse<
  "ProjectsController_addMembership",
  201
>;
export type ProjectMembershipResponse = JsonResponse<"ProjectsController_removeMembership", 200>;
export type ProjectAuditEventListResponse = JsonResponse<"ProjectsController_listAuditEvents", 200>;
export type OrganizationUserListResponse = JsonResponse<
  "OrganizationUsersController_listOrganizationUsers",
  200
>;

export class AtlasApiError extends Error {
  readonly status: number;

  readonly statusCode: number;

  readonly code: string;

  readonly details: ApiErrorDetails | undefined;

  readonly correlationId: string | undefined;

  constructor({
    status,
    code,
    message,
    details,
    correlationId,
    cause,
  }: {
    status: number;
    code: string;
    message: string;
    details?: ApiErrorDetails | undefined;
    correlationId?: string | undefined;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "AtlasApiError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }

  static fromResponse(error: Partial<ApiErrorDto> | undefined, response: Response) {
    const status = error?.statusCode ?? response.status;
    const code =
      typeof error?.code === "string" && error.code.length > 0
        ? error.code
        : `${HTTP_ERROR_CODE}_${status}`;
    const message =
      typeof error?.message === "string" && error.message.length > 0
        ? error.message
        : response.statusText || `Request failed with status ${status}`;
    const details = Array.isArray(error?.details) ? error.details : undefined;
    const correlationId =
      typeof error?.correlationId === "string" && error.correlationId.length > 0
        ? error.correlationId
        : (response.headers.get("x-correlation-id") ??
          response.headers.get("x-request-id") ??
          undefined);

    return new AtlasApiError({
      status,
      code,
      message,
      details,
      correlationId,
      cause: error,
    });
  }
}

function getClient(options: ApiRequestOptions = {}) {
  return options.client ?? atlasApiClient;
}

function withSignal(signal?: AbortSignal) {
  return signal ? { signal } : {};
}

function unwrapResponse<T>(result: { data?: T; error?: Partial<ApiErrorDto>; response: Response }) {
  if (result.error) {
    throw AtlasApiError.fromResponse(result.error, result.response);
  }

  if (!result.response.ok) {
    throw AtlasApiError.fromResponse(undefined, result.response);
  }

  if (result.data === undefined) {
    throw new Error("Atlas API returned no response data");
  }

  return result.data;
}

export async function fetchCurrentUser(options: ApiRequestOptions = {}) {
  const result = await getClient(options).GET("/api/v1/me", {
    ...withSignal(options.signal),
  });

  return unwrapResponse<CurrentUserResponse>(result);
}

export async function fetchCurrentOrganization(options: ApiRequestOptions = {}) {
  const result = await getClient(options).GET("/api/v1/organizations/current", {
    ...withSignal(options.signal),
  });

  return unwrapResponse<CurrentOrganizationResponse>(result);
}

export async function fetchClients(
  filters: ClientsListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET("/api/v1/clients", {
    params: { query: filters },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ClientListResponse>(result);
}

export async function fetchClient(clientId: string, options: ApiRequestOptions = {}) {
  const result = await getClient(options).GET("/api/v1/clients/{clientId}", {
    params: { path: { clientId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ClientResponse>(result);
}

export async function createClient(input: CreateClientInput, options: ApiRequestOptions = {}) {
  const result = await getClient(options).POST("/api/v1/clients", {
    body: input,
    ...withSignal(options.signal),
  });

  return unwrapResponse<CreateClientResponse>(result);
}

export async function updateClient(
  clientId: string,
  input: UpdateClientInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).PATCH("/api/v1/clients/{clientId}", {
    body: input,
    params: { path: { clientId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ClientResponse>(result);
}

export async function archiveClient(clientId: string, options: ApiRequestOptions = {}) {
  const result = await getClient(options).POST("/api/v1/clients/{clientId}/archive", {
    params: { path: { clientId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ClientResponse>(result);
}

export async function fetchProjects(
  filters: ProjectsListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET("/api/v1/projects", {
    params: { query: filters },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectListResponse>(result);
}

export async function fetchProject(projectId: string, options: ApiRequestOptions = {}) {
  const result = await getClient(options).GET("/api/v1/projects/{projectId}", {
    params: { path: { projectId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectResponse>(result);
}

export async function createProject(input: CreateProjectInput, options: ApiRequestOptions = {}) {
  const result = await getClient(options).POST("/api/v1/projects", {
    body: input,
    ...withSignal(options.signal),
  });

  return unwrapResponse<CreateProjectResponse>(result);
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).PATCH("/api/v1/projects/{projectId}", {
    body: input,
    params: { path: { projectId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectResponse>(result);
}

export async function archiveProject(projectId: string, options: ApiRequestOptions = {}) {
  const result = await getClient(options).POST("/api/v1/projects/{projectId}/archive", {
    params: { path: { projectId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectResponse>(result);
}

export async function restoreProject(projectId: string, options: ApiRequestOptions = {}) {
  const result = await getClient(options).POST("/api/v1/projects/{projectId}/restore", {
    params: { path: { projectId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectResponse>(result);
}

export async function fetchProjectDashboard(projectId: string, options: ApiRequestOptions = {}) {
  const result = await getClient(options).GET("/api/v1/projects/{projectId}/dashboard", {
    params: { path: { projectId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectDashboardResponse>(result);
}

export async function fetchProjectMemberships(
  projectId: string,
  filters: ProjectMembershipsQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET("/api/v1/projects/{projectId}/memberships", {
    params: { path: { projectId }, query: filters },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectMembershipListResponse>(result);
}

export async function addProjectMembership(
  projectId: string,
  input: CreateProjectMembershipInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST("/api/v1/projects/{projectId}/memberships", {
    body: input,
    params: { path: { projectId } },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectMembershipCreatedResponse>(result);
}

export async function updateProjectMembership(
  projectId: string,
  membershipId: string,
  input: UpdateProjectMembershipInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).PATCH(
    "/api/v1/projects/{projectId}/memberships/{membershipId}",
    {
      body: input,
      params: { path: { membershipId, projectId } },
      ...withSignal(options.signal),
    },
  );

  return unwrapResponse<ProjectMembershipResponse>(result);
}

export async function removeProjectMembership(
  projectId: string,
  membershipId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).DELETE(
    "/api/v1/projects/{projectId}/memberships/{membershipId}",
    {
      params: { path: { membershipId, projectId } },
      ...withSignal(options.signal),
    },
  );

  return unwrapResponse<ProjectMembershipResponse>(result);
}

export async function fetchProjectAuditEvents(
  projectId: string,
  filters: ProjectAuditEventsQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET("/api/v1/projects/{projectId}/audit-events", {
    params: { path: { projectId }, query: filters },
    ...withSignal(options.signal),
  });

  return unwrapResponse<ProjectAuditEventListResponse>(result);
}

export async function fetchOrganizationUsers(
  filters: OrganizationUsersListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET("/api/v1/organizations/current/users", {
    params: { query: filters },
    ...withSignal(options.signal),
  });

  return unwrapResponse<OrganizationUserListResponse>(result);
}

export function getCurrentUserInvalidationTargets() {
  return [currentUserQueryKey] as const;
}

export function getCurrentOrganizationInvalidationTargets() {
  return [currentOrganizationQueryKey] as const;
}

export function getClientCreateInvalidationTargets() {
  return [clientListFamilyQueryKey] as const;
}

export function getClientMutationInvalidationTargets(clientId: string) {
  return [clientListFamilyQueryKey, getClientQueryKey(clientId)] as const;
}

export function getProjectCreateInvalidationTargets() {
  return [projectListFamilyQueryKey] as const;
}

export function getProjectMutationInvalidationTargets(projectId: string) {
  return [
    projectListFamilyQueryKey,
    getProjectQueryKey(projectId),
    getProjectDashboardQueryKey(projectId),
    getProjectMembershipsFamilyQueryKey(projectId),
    getProjectAuditEventsFamilyQueryKey(projectId),
  ] as const;
}

export function getProjectMembershipMutationInvalidationTargets(projectId: string) {
  return [
    projectListFamilyQueryKey,
    getProjectMembershipsFamilyQueryKey(projectId),
    getProjectQueryKey(projectId),
    getProjectDashboardQueryKey(projectId),
    getProjectAuditEventsFamilyQueryKey(projectId),
  ] as const;
}

export async function invalidateQueryTargets(
  queryClient: QueryClient,
  targets: readonly QueryKey[],
) {
  await Promise.all(targets.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function resolveOptionalId(id?: string) {
  return id ?? MISSING_ID;
}
