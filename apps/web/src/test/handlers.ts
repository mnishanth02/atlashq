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
import type {
  SourceChunkListResponse,
  SourceDetailResponse,
  SourceExtractionListResponse,
  SourceListResponse,
  SourceSignedUrlResponse,
  SourceVaultCapabilitiesResponse,
  SourceVersionListResponse,
  UploadSessionResponse,
} from "@/features/source-documents";

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
  sources: (projectId: string, body: SourceListResponse) =>
    http.get(api(`/projects/${projectId}/source-documents`), () => HttpResponse.json(body)),
  sourceVaultCapabilities: (projectId: string, body: SourceVaultCapabilitiesResponse) =>
    http.get(api(`/projects/${projectId}/source-vault/capabilities`), () =>
      HttpResponse.json(body),
    ),
  source: (projectId: string, sourceId: string, body: SourceDetailResponse) =>
    http.get(api(`/projects/${projectId}/source-documents/${sourceId}`), () =>
      HttpResponse.json(body),
    ),
  sourceVersions: (projectId: string, sourceId: string, body: SourceVersionListResponse) =>
    http.get(api(`/projects/${projectId}/source-documents/${sourceId}/versions`), () =>
      HttpResponse.json(body),
    ),
  sourceExtractions: (projectId: string, sourceId: string, body: SourceExtractionListResponse) =>
    http.get(api(`/projects/${projectId}/source-documents/${sourceId}/extractions`), () =>
      HttpResponse.json(body),
    ),
  sourceChunks: (projectId: string, sourceId: string, body: SourceChunkListResponse) =>
    http.get(api(`/projects/${projectId}/source-documents/${sourceId}/chunks`), () =>
      HttpResponse.json(body),
    ),
  sourceSignedUrl: (
    projectId: string,
    sourceId: string,
    fileId: string,
    purpose: "preview" | "download",
    body: SourceSignedUrlResponse,
  ) =>
    http.get(
      api(`/projects/${projectId}/source-documents/${sourceId}/files/${fileId}/${purpose}-url`),
      () => HttpResponse.json(body),
    ),
  createUploadSession: (projectId: string, body: UploadSessionResponse) =>
    http.post(api(`/projects/${projectId}/source-document-upload-sessions`), () =>
      HttpResponse.json(body, { status: 201 }),
    ),
  confirmUploadSession: (projectId: string, sessionId: string, body: SourceDetailResponse) =>
    http.post(
      api(`/projects/${projectId}/source-document-upload-sessions/${sessionId}/confirm`),
      () => HttpResponse.json(body),
    ),
  createManualSource: (projectId: string, body: SourceDetailResponse) =>
    http.post(api(`/projects/${projectId}/source-documents/manual`), () =>
      HttpResponse.json(body, { status: 201 }),
    ),
  createReferenceSource: (projectId: string, body: SourceDetailResponse) =>
    http.post(api(`/projects/${projectId}/source-documents/references`), () =>
      HttpResponse.json(body, { status: 201 }),
    ),
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
