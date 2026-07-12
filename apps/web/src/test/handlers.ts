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
  AnalysisBatchListResponse,
  AnalysisRunDetailResponse,
  AnalysisRunListResponse,
  AnalysisStageListResponse,
  CitationEvidenceResponse,
  CitationListResponse,
  CoverageListResponse,
  DeliveryItemDetailResponse,
  DeliveryItemListResponse,
  EligibleSourcePreviewResponse,
  ProviderPolicyListResponse,
  RequirementAnalysisCapabilitiesResponse,
  RequirementDetailResponse,
  RequirementListResponse,
  TraceabilityListResponse,
} from "@/features/requirement-analysis/requirement-analysis-api";
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

  /* ----------------------- Module 3: Requirement analysis ----------------------- */
  requirementAnalysisCapabilities: (
    projectId: string,
    body: RequirementAnalysisCapabilitiesResponse,
  ) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/capabilities`), () =>
      HttpResponse.json(body),
    ),
  requirementAnalysisProviderPolicies: (projectId: string, body: ProviderPolicyListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/provider-policies`), () =>
      HttpResponse.json(body),
    ),
  requirementAnalysisEligibleSources: (projectId: string, body: EligibleSourcePreviewResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/eligible-sources`), () =>
      HttpResponse.json(body),
    ),
  analysisRuns: (projectId: string, body: AnalysisRunListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs`), () =>
      HttpResponse.json(body),
    ),
  createAnalysisFreshRun: (projectId: string, body: AnalysisRunDetailResponse) =>
    http.post(api(`/projects/${projectId}/requirement-analysis/runs`), () =>
      HttpResponse.json(body, { status: 201 }),
    ),
  analysisRunDetail: (projectId: string, runId: string, body: AnalysisRunDetailResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs/${runId}`), () =>
      HttpResponse.json(body),
    ),
  cancelAnalysisRun: (projectId: string, runId: string, body: AnalysisRunDetailResponse) =>
    http.post(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/cancel`), () =>
      HttpResponse.json(body),
    ),
  retryAnalysisRun: (projectId: string, runId: string, body: AnalysisRunDetailResponse) =>
    http.post(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/retry`), () =>
      HttpResponse.json(body, { status: 201 }),
    ),
  replayAnalysisRun: (projectId: string, runId: string, body: AnalysisRunDetailResponse) =>
    http.post(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/replay`), () =>
      HttpResponse.json(body, { status: 201 }),
    ),
  reprocessAnalysisRun: (projectId: string, runId: string, body: AnalysisRunDetailResponse) =>
    http.post(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/reprocess`), () =>
      HttpResponse.json(body, { status: 201 }),
    ),
  analysisStages: (projectId: string, runId: string, body: AnalysisStageListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/stages`), () =>
      HttpResponse.json(body),
    ),
  analysisBatches: (projectId: string, runId: string, body: AnalysisBatchListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/batches`), () =>
      HttpResponse.json(body),
    ),
  analysisRequirements: (projectId: string, runId: string, body: RequirementListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/requirements`), () =>
      HttpResponse.json(body),
    ),
  analysisRequirementDetail: (
    projectId: string,
    runId: string,
    requirementId: string,
    body: RequirementDetailResponse,
  ) =>
    http.get(
      api(
        `/projects/${projectId}/requirement-analysis/runs/${runId}/requirements/${requirementId}`,
      ),
      () => HttpResponse.json(body),
    ),
  analysisDeliveryItems: (projectId: string, runId: string, body: DeliveryItemListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/delivery-items`), () =>
      HttpResponse.json(body),
    ),
  analysisDeliveryItemDetail: (
    projectId: string,
    runId: string,
    itemId: string,
    body: DeliveryItemDetailResponse,
  ) =>
    http.get(
      api(`/projects/${projectId}/requirement-analysis/runs/${runId}/delivery-items/${itemId}`),
      () => HttpResponse.json(body),
    ),
  analysisCoverage: (projectId: string, runId: string, body: CoverageListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/coverage`), () =>
      HttpResponse.json(body),
    ),
  analysisCitations: (projectId: string, runId: string, body: CitationListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/citations`), () =>
      HttpResponse.json(body),
    ),
  analysisCitationEvidence: (
    projectId: string,
    runId: string,
    citationId: string,
    body: CitationEvidenceResponse,
  ) =>
    http.get(
      api(`/projects/${projectId}/requirement-analysis/runs/${runId}/evidence/${citationId}`),
      () => HttpResponse.json(body),
    ),
  analysisTraceability: (projectId: string, runId: string, body: TraceabilityListResponse) =>
    http.get(api(`/projects/${projectId}/requirement-analysis/runs/${runId}/traceability`), () =>
      HttpResponse.json(body),
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
