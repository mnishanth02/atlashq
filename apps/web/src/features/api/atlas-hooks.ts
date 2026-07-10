import type {
  ClientsListQuery,
  OrganizationUsersListQuery,
  ProjectAuditEventsQuery,
  ProjectMembershipsQuery,
  ProjectsListQuery,
} from "@atlashq/api-client";
import {
  getClientQueryKey,
  getClientsListQueryKey,
  getOrganizationUsersListQueryKey,
  getProjectAuditEventsQueryKey,
  getProjectDashboardQueryKey,
  getProjectMembershipsQueryKey,
  getProjectQueryKey,
  getProjectsListQueryKey,
} from "@atlashq/api-client";
import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreateClientInput,
  CreateProjectInput,
  CreateProjectMembershipInput,
  ProjectListResponse,
  UpdateClientInput,
  UpdateProjectInput,
  UpdateProjectMembershipInput,
} from "./atlas-api";
import {
  addProjectMembership,
  archiveClient,
  archiveProject,
  atlasApiClient,
  createClient,
  createProject,
  currentOrganizationQueryKey,
  currentUserQueryKey,
  fetchClient,
  fetchClients,
  fetchCurrentOrganization,
  fetchCurrentUser,
  fetchOrganizationUsers,
  fetchProject,
  fetchProjectAuditEvents,
  fetchProjectDashboard,
  fetchProjectMemberships,
  fetchProjects,
  getClientCreateInvalidationTargets,
  getClientMutationInvalidationTargets,
  getProjectCreateInvalidationTargets,
  getProjectMembershipMutationInvalidationTargets,
  getProjectMutationInvalidationTargets,
  invalidateQueryTargets,
  removeProjectMembership,
  resolveOptionalId,
  restoreProject,
  updateClient,
  updateProject,
  updateProjectMembership,
} from "./atlas-api";

export const PROJECTS_PAGE_SIZE = 25;

export type ProjectsInfiniteFilters = Omit<ProjectsListQuery, "cursor">;
export type ProjectsPageParam = string | null;

export function buildProjectsPageQuery(
  filters: ProjectsInfiniteFilters = {},
  cursor: ProjectsPageParam = null,
): ProjectsListQuery {
  return {
    ...filters,
    limit: filters.limit ?? PROJECTS_PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  };
}

export function mergeProjectPages(
  data: InfiniteData<ProjectListResponse, unknown> | undefined,
): ProjectListResponse["items"] {
  const projects = new Map<string, ProjectListResponse["items"][number]>();

  for (const page of data?.pages ?? []) {
    for (const project of page.items) {
      projects.set(project.id, project);
    }
  }

  return [...projects.values()];
}

export function currentUserQueryOptions(client = atlasApiClient) {
  return queryOptions({
    queryKey: currentUserQueryKey,
    queryFn: ({ signal }) => fetchCurrentUser({ client, signal }),
  });
}

export function currentOrganizationQueryOptions(client = atlasApiClient) {
  return queryOptions({
    queryKey: currentOrganizationQueryKey,
    queryFn: ({ signal }) => fetchCurrentOrganization({ client, signal }),
  });
}

export function clientsQueryOptions(filters: ClientsListQuery = {}, client = atlasApiClient) {
  return queryOptions({
    queryKey: getClientsListQueryKey(filters),
    queryFn: ({ signal }) => fetchClients(filters, { client, signal }),
  });
}

export function clientQueryOptions(clientId: string | undefined, client = atlasApiClient) {
  const resolvedClientId = resolveOptionalId(clientId);

  return queryOptions({
    queryKey: getClientQueryKey(resolvedClientId),
    enabled: Boolean(clientId),
    queryFn: ({ signal }) => fetchClient(resolvedClientId, { client, signal }),
  });
}

export function projectsQueryOptions(filters: ProjectsListQuery = {}, client = atlasApiClient) {
  return queryOptions({
    queryKey: getProjectsListQueryKey(filters),
    queryFn: ({ signal }) => fetchProjects(filters, { client, signal }),
  });
}

export function projectsInfiniteQueryOptions(
  filters: ProjectsInfiniteFilters = {},
  client = atlasApiClient,
) {
  const firstPageQuery = buildProjectsPageQuery(filters);

  return infiniteQueryOptions({
    queryKey: [...getProjectsListQueryKey(firstPageQuery), "infinite"] as const,
    initialPageParam: null as ProjectsPageParam,
    queryFn: ({ pageParam, signal }) =>
      fetchProjects(buildProjectsPageQuery(filters, pageParam), { client, signal }),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasMore ? lastPage.pageInfo.nextCursor : null,
    placeholderData: keepPreviousData,
  });
}

export function projectQueryOptions(projectId: string | undefined, client = atlasApiClient) {
  const resolvedProjectId = resolveOptionalId(projectId);

  return queryOptions({
    queryKey: getProjectQueryKey(resolvedProjectId),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) => fetchProject(resolvedProjectId, { client, signal }),
  });
}

export function projectDashboardQueryOptions(
  projectId: string | undefined,
  client = atlasApiClient,
) {
  const resolvedProjectId = resolveOptionalId(projectId);

  return queryOptions({
    queryKey: getProjectDashboardQueryKey(resolvedProjectId),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) => fetchProjectDashboard(resolvedProjectId, { client, signal }),
  });
}

export function projectMembershipsQueryOptions(
  projectId: string | undefined,
  filters: ProjectMembershipsQuery = {},
  client = atlasApiClient,
) {
  const resolvedProjectId = resolveOptionalId(projectId);

  return queryOptions({
    queryKey: getProjectMembershipsQueryKey(resolvedProjectId, filters),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) =>
      fetchProjectMemberships(resolvedProjectId, filters, { client, signal }),
  });
}

export function projectAuditEventsQueryOptions(
  projectId: string | undefined,
  filters: ProjectAuditEventsQuery = {},
  client = atlasApiClient,
) {
  const resolvedProjectId = resolveOptionalId(projectId);

  return queryOptions({
    queryKey: getProjectAuditEventsQueryKey(resolvedProjectId, filters),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) =>
      fetchProjectAuditEvents(resolvedProjectId, filters, { client, signal }),
  });
}

export function organizationUsersQueryOptions(
  filters: OrganizationUsersListQuery = {},
  client = atlasApiClient,
) {
  return queryOptions({
    queryKey: getOrganizationUsersListQueryKey(filters),
    queryFn: ({ signal }) => fetchOrganizationUsers(filters, { client, signal }),
  });
}

export function useCurrentUserQuery(client = atlasApiClient) {
  return useQuery(currentUserQueryOptions(client));
}

export function useCurrentOrganizationQuery(client = atlasApiClient) {
  return useQuery(currentOrganizationQueryOptions(client));
}

export function useClientsQuery(filters: ClientsListQuery = {}, client = atlasApiClient) {
  return useQuery(clientsQueryOptions(filters, client));
}

export function useClientQuery(clientId: string | undefined, client = atlasApiClient) {
  return useQuery(clientQueryOptions(clientId, client));
}

export function useProjectsQuery(filters: ProjectsListQuery = {}, client = atlasApiClient) {
  return useQuery(projectsQueryOptions(filters, client));
}

export function useInfiniteProjectsQuery(
  filters: ProjectsInfiniteFilters = {},
  client = atlasApiClient,
) {
  return useInfiniteQuery(projectsInfiniteQueryOptions(filters, client));
}

export function useProjectQuery(projectId: string | undefined, client = atlasApiClient) {
  return useQuery(projectQueryOptions(projectId, client));
}

export function useProjectDashboardQuery(projectId: string | undefined, client = atlasApiClient) {
  return useQuery(projectDashboardQueryOptions(projectId, client));
}

export function useProjectMembershipsQuery(
  projectId: string | undefined,
  filters: ProjectMembershipsQuery = {},
  client = atlasApiClient,
) {
  return useQuery(projectMembershipsQueryOptions(projectId, filters, client));
}

export function useProjectAuditEventsQuery(
  projectId: string | undefined,
  filters: ProjectAuditEventsQuery = {},
  client = atlasApiClient,
) {
  return useQuery(projectAuditEventsQueryOptions(projectId, filters, client));
}

export function useOrganizationUsersQuery(
  filters: OrganizationUsersListQuery = {},
  client = atlasApiClient,
) {
  return useQuery(organizationUsersQueryOptions(filters, client));
}

async function invalidateTargets(queryClient: QueryClient, targets: readonly QueryKey[]) {
  await invalidateQueryTargets(queryClient, targets);
}

export function useCreateClientMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClientInput) => createClient(input, { client }),
    onSuccess: async () => {
      await invalidateTargets(queryClient, getClientCreateInvalidationTargets());
    },
  });
}

export function useUpdateClientMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, input }: { clientId: string; input: UpdateClientInput }) =>
      updateClient(clientId, input, { client }),
    onSuccess: async (_data, variables) => {
      await invalidateTargets(
        queryClient,
        getClientMutationInvalidationTargets(variables.clientId),
      );
    },
  });
}

export function useArchiveClientMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => archiveClient(clientId, { client }),
    onSuccess: async (_data, clientId) => {
      await invalidateTargets(queryClient, getClientMutationInvalidationTargets(clientId));
    },
  });
}

export function useCreateProjectMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input, { client }),
    onSuccess: async () => {
      await invalidateTargets(queryClient, getProjectCreateInvalidationTargets());
    },
  });
}

export function useUpdateProjectMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: UpdateProjectInput }) =>
      updateProject(projectId, input, { client }),
    onSuccess: async (_data, variables) => {
      await invalidateTargets(
        queryClient,
        getProjectMutationInvalidationTargets(variables.projectId),
      );
    },
  });
}

export function useArchiveProjectMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => archiveProject(projectId, { client }),
    onSuccess: async (_data, projectId) => {
      await invalidateTargets(queryClient, getProjectMutationInvalidationTargets(projectId));
    },
  });
}

export function useRestoreProjectMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => restoreProject(projectId, { client }),
    onSuccess: async (_data, projectId) => {
      await invalidateTargets(queryClient, getProjectMutationInvalidationTargets(projectId));
    },
  });
}

export function useAddProjectMembershipMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: CreateProjectMembershipInput;
    }) => addProjectMembership(projectId, input, { client }),
    onSuccess: async (_data, variables) => {
      await invalidateTargets(
        queryClient,
        getProjectMembershipMutationInvalidationTargets(variables.projectId),
      );
    },
  });
}

export function useUpdateProjectMembershipMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      membershipId,
      input,
    }: {
      projectId: string;
      membershipId: string;
      input: UpdateProjectMembershipInput;
    }) => updateProjectMembership(projectId, membershipId, input, { client }),
    onSuccess: async (_data, variables) => {
      await invalidateTargets(
        queryClient,
        getProjectMembershipMutationInvalidationTargets(variables.projectId),
      );
    },
  });
}

export function useRemoveProjectMembershipMutation(client = atlasApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, membershipId }: { projectId: string; membershipId: string }) =>
      removeProjectMembership(projectId, membershipId, { client }),
    onSuccess: async (_data, variables) => {
      await invalidateTargets(
        queryClient,
        getProjectMembershipMutationInvalidationTargets(variables.projectId),
      );
    },
  });
}
