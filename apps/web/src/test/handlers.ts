import { HttpResponse, http } from "msw";
import type {
  CurrentOrganizationResponse,
  CurrentUserResponse,
  OrganizationUserListResponse,
  ProjectAuditEventListResponse,
  ProjectDashboardResponse,
  ProjectListResponse,
  ProjectMembershipListResponse,
  ProjectResponse,
} from "@/features/api";

const api = (path: string) => `*/api/v1${path}`;

export const atlasHandlers = {
  currentUser: (body: CurrentUserResponse) => http.get(api("/me"), () => HttpResponse.json(body)),
  currentOrganization: (body: CurrentOrganizationResponse) =>
    http.get(api("/organizations/current"), () => HttpResponse.json(body)),
  projects: (body: ProjectListResponse) =>
    http.get(api("/projects"), () => HttpResponse.json(body)),
  clients: (
    body: {
      items: Array<Record<string, string | number | boolean | null>>;
      pageInfo: { limit: number; nextCursor: string | null; hasMore: boolean; total?: number };
    } = { items: [], pageInfo: { limit: 100, nextCursor: null, hasMore: false } },
  ) => http.get(api("/clients"), () => HttpResponse.json(body)),
  organizationUsers: (
    body: OrganizationUserListResponse = {
      items: [],
      pageInfo: { limit: 100, nextCursor: null, hasMore: false },
    },
  ) => http.get(api("/organizations/current/users"), () => HttpResponse.json(body)),
  project: (projectId: string, body: ProjectResponse) =>
    http.get(api(`/projects/${projectId}`), () => HttpResponse.json(body)),
  dashboard: (projectId: string, body: ProjectDashboardResponse) =>
    http.get(api(`/projects/${projectId}/dashboard`), () => HttpResponse.json(body)),
  memberships: (projectId: string, body: ProjectMembershipListResponse) =>
    http.get(api(`/projects/${projectId}/memberships`), () => HttpResponse.json(body)),
  activity: (projectId: string, body: ProjectAuditEventListResponse) =>
    http.get(api(`/projects/${projectId}/audit-events`), () => HttpResponse.json(body)),
};

export function apiError(
  status: number,
  message: string,
  details?: Array<{ path: Array<string | number>; message: string; code: string }>,
) {
  return HttpResponse.json(
    {
      statusCode: status,
      code: `error_${status}`,
      message,
      ...(details ? { details } : {}),
      correlationId: `corr-${status}`,
    },
    { status },
  );
}
