import type { AtlasApiClient, operations } from "@atlashq/api-client";
import { getProjectDashboardQueryKey } from "@atlashq/api-client";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  type ApiRequestOptions,
  AtlasApiError,
  atlasApiClient,
  getProjectAuditEventsFamilyQueryKey,
  invalidateQueryTargets,
  projectListFamilyQueryKey,
} from "@/features/api";

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

/* ------------------------------------------------------------------------- */
/* Response / request types                                                  */
/* ------------------------------------------------------------------------- */

export type RequirementAnalysisCapabilitiesResponse = JsonResponse<
  "RequirementAnalysisController_getCapabilities",
  200
>;
export type ProviderPolicyListResponse = JsonResponse<
  "RequirementAnalysisController_listProjectProviderPolicies",
  200
>;
export type ProviderPolicyListQuery = NonNullable<
  operations["RequirementAnalysisController_listProjectProviderPolicies"]["parameters"]["query"]
>;
export type ProviderPolicySummary = ProviderPolicyListResponse["items"][number];
export type EligibleSourcePreviewResponse = JsonResponse<
  "RequirementAnalysisController_previewEligibleSources",
  200
>;
export type EligibleSourcePreviewItem = EligibleSourcePreviewResponse["sources"][number];
export type AnalysisEligibleSourceExclusionReason = NonNullable<
  EligibleSourcePreviewItem["exclusionReason"]
>;
export type AnalysisRunListResponse = JsonResponse<"RequirementAnalysisController_listRuns", 200>;
export type AnalysisRunListQuery = NonNullable<
  operations["RequirementAnalysisController_listRuns"]["parameters"]["query"]
>;
export type AnalysisRunSummary = AnalysisRunListResponse["items"][number];
export type AnalysisRunDetailResponse = JsonResponse<
  "RequirementAnalysisController_getRunDetail",
  200
>;
export type AnalysisRunFreshBodyInput =
  JsonRequestBody<"RequirementAnalysisController_createFreshRun">;
export type AnalysisRunCancelBodyInput = JsonRequestBody<"RequirementAnalysisController_cancelRun">;
export type AnalysisRunRetryBodyInput = JsonRequestBody<"RequirementAnalysisController_retryRun">;
export type AnalysisRunReplayBodyInput = JsonRequestBody<"RequirementAnalysisController_replayRun">;
export type AnalysisRunReprocessBodyInput =
  JsonRequestBody<"RequirementAnalysisController_reprocessRun">;
export type AnalysisStageListResponse = JsonResponse<
  "RequirementAnalysisController_listStages",
  200
>;
export type AnalysisStageListQuery = NonNullable<
  operations["RequirementAnalysisController_listStages"]["parameters"]["query"]
>;
export type AnalysisStageSummary = AnalysisStageListResponse["items"][number];
export type AnalysisBatchListResponse = JsonResponse<
  "RequirementAnalysisController_listBatches",
  200
>;
export type AnalysisBatchListQuery = NonNullable<
  operations["RequirementAnalysisController_listBatches"]["parameters"]["query"]
>;
export type AnalysisBatchSummary = AnalysisBatchListResponse["items"][number];
export type RequirementListResponse = JsonResponse<
  "RequirementAnalysisController_listRequirements",
  200
>;
export type RequirementListQuery = NonNullable<
  operations["RequirementAnalysisController_listRequirements"]["parameters"]["query"]
>;
export type RequirementListItem = RequirementListResponse["items"][number];
export type RequirementDetailResponse = JsonResponse<
  "RequirementAnalysisController_getRequirement",
  200
>;
export type DeliveryItemListResponse = JsonResponse<
  "RequirementAnalysisController_listDeliveryItems",
  200
>;
export type DeliveryItemListQuery = NonNullable<
  operations["RequirementAnalysisController_listDeliveryItems"]["parameters"]["query"]
>;
export type DeliveryItemListItem = DeliveryItemListResponse["items"][number];
export type DeliveryItemDetailResponse = JsonResponse<
  "RequirementAnalysisController_getDeliveryItem",
  200
>;
export type CoverageListResponse = JsonResponse<"RequirementAnalysisController_listCoverage", 200>;
export type CoverageListQuery = NonNullable<
  operations["RequirementAnalysisController_listCoverage"]["parameters"]["query"]
>;
export type CoverageEntry = CoverageListResponse["items"][number];
export type CitationListResponse = JsonResponse<"RequirementAnalysisController_listCitations", 200>;
export type CitationListQuery = NonNullable<
  operations["RequirementAnalysisController_listCitations"]["parameters"]["query"]
>;
export type CitationListItem = CitationListResponse["items"][number];
export type CitationEvidenceResponse = JsonResponse<
  "RequirementAnalysisController_getCitationEvidence",
  200
>;
export type TraceabilityListResponse = JsonResponse<
  "RequirementAnalysisController_listTraceability",
  200
>;
export type TraceabilityListQuery = NonNullable<
  operations["RequirementAnalysisController_listTraceability"]["parameters"]["query"]
>;
export type TraceabilityLink = TraceabilityListResponse["items"][number];

export type AnalysisRunStatus = AnalysisRunSummary["status"];
export type AnalysisRunMode = AnalysisRunSummary["mode"];
export type AnalysisStageStatus = AnalysisStageSummary["status"];
export type AnalysisStageKind = AnalysisStageSummary["kind"];

/**
 * Run statuses that will never change again without an explicit new run.
 * Bounded polling (module-03 §14.3, module-03 §6.4) must stop the instant a
 * run reports one of these — otherwise a completed/failed/canceled run keeps
 * refetching forever.
 */
export const TERMINAL_RUN_STATUSES: readonly AnalysisRunStatus[] = [
  "completed",
  "completed_with_warnings",
  "failed",
  "canceled",
];

export function isTerminalRunStatus(status: AnalysisRunStatus | undefined): boolean {
  return status !== undefined && TERMINAL_RUN_STATUSES.includes(status);
}

/** Stable Module 3 error codes surfaced by the API (module-03 §12.3). */
export const ANALYSIS_ERROR_CODES = {
  analysisDisabled: "AI_ANALYSIS_DISABLED",
  providerNotApproved: "AI_PROVIDER_NOT_APPROVED",
  providerPolicyInactive: "AI_PROVIDER_POLICY_INACTIVE",
  providerPolicyMismatch: "AI_PROVIDER_POLICY_MISMATCH",
  runBudgetExceeded: "AI_RUN_BUDGET_EXCEEDED",
  runConcurrencyExceeded: "AI_RUN_CONCURRENCY_EXCEEDED",
  runNotCancelable: "AI_RUN_NOT_CANCELABLE",
  runNotRetryable: "AI_RUN_NOT_RETRYABLE",
  runSnapshotEmpty: "AI_RUN_SNAPSHOT_EMPTY",
  runSourceNotEligible: "AI_RUN_SOURCE_NOT_ELIGIBLE",
  runSourceSnapshotStale: "AI_RUN_SOURCE_SNAPSHOT_STALE",
  runSchemaValidationFailed: "AI_RUN_SCHEMA_VALIDATION_FAILED",
  runSemanticValidationFailed: "AI_RUN_SEMANTIC_VALIDATION_FAILED",
  runCitationVerificationFailed: "AI_RUN_CITATION_VERIFICATION_FAILED",
  runPromptInjectionGuardTriggered: "AI_RUN_PROMPT_INJECTION_GUARD_TRIGGERED",
  runTransientProviderFailure: "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
  runProviderTimeout: "AI_RUN_PROVIDER_TIMEOUT",
  runProviderRateLimited: "AI_RUN_PROVIDER_RATE_LIMITED",
  runReferenceFeatureExtractionDisabled: "AI_RUN_REFERENCE_FEATURE_EXTRACTION_DISABLED",
  artifactNotFound: "AI_ARTIFACT_NOT_FOUND",
  evidenceAccessDenied: "AI_EVIDENCE_ACCESS_DENIED",
} as const;

export type AnalysisErrorCode = (typeof ANALYSIS_ERROR_CODES)[keyof typeof ANALYSIS_ERROR_CODES];

export function isAnalysisErrorCode(error: unknown, code: AnalysisErrorCode): boolean {
  return error instanceof AtlasApiError && error.code === code;
}

/* ------------------------------------------------------------------------- */
/* Query key factories — hierarchical so a project/run-scoped invalidation   */
/* can walk one prefix and hit every descendant.                             */
/* ------------------------------------------------------------------------- */

export function getRequirementAnalysisFamilyQueryKey(projectId: string) {
  return ["api", "projects", "detail", projectId, "requirement-analysis"] as const;
}

export function getRequirementAnalysisCapabilitiesQueryKey(projectId: string) {
  return [...getRequirementAnalysisFamilyQueryKey(projectId), "capabilities"] as const;
}

export function getRequirementAnalysisProviderPoliciesQueryKey(
  projectId: string,
  filters: ProviderPolicyListQuery = {},
) {
  return [
    ...getRequirementAnalysisFamilyQueryKey(projectId),
    "provider-policies",
    filters,
  ] as const;
}

export function getRequirementAnalysisEligibleSourcesQueryKey(projectId: string) {
  return [...getRequirementAnalysisFamilyQueryKey(projectId), "eligible-sources"] as const;
}

export function getRequirementAnalysisRunListFamilyQueryKey(projectId: string) {
  return [...getRequirementAnalysisFamilyQueryKey(projectId), "runs", "list"] as const;
}

export function getRequirementAnalysisRunListQueryKey(
  projectId: string,
  filters: AnalysisRunListQuery = {},
) {
  return [...getRequirementAnalysisRunListFamilyQueryKey(projectId), filters] as const;
}

export function getRequirementAnalysisRunFamilyQueryKey(projectId: string, runId: string) {
  return [...getRequirementAnalysisFamilyQueryKey(projectId), "runs", "detail", runId] as const;
}

export function getRequirementAnalysisRunDetailQueryKey(projectId: string, runId: string) {
  return getRequirementAnalysisRunFamilyQueryKey(projectId, runId);
}

export function getRequirementAnalysisRunStagesQueryKey(
  projectId: string,
  runId: string,
  filters: AnalysisStageListQuery = {},
) {
  return [...getRequirementAnalysisRunFamilyQueryKey(projectId, runId), "stages", filters] as const;
}

export function getRequirementAnalysisRunBatchesQueryKey(
  projectId: string,
  runId: string,
  filters: AnalysisBatchListQuery = {},
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "batches",
    filters,
  ] as const;
}

export function getRequirementAnalysisRunRequirementsQueryKey(
  projectId: string,
  runId: string,
  filters: RequirementListQuery = {},
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "requirements",
    filters,
  ] as const;
}

export function getRequirementAnalysisRequirementDetailQueryKey(
  projectId: string,
  runId: string,
  requirementId: string,
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "requirements",
    "detail",
    requirementId,
  ] as const;
}

export function getRequirementAnalysisRunDeliveryItemsQueryKey(
  projectId: string,
  runId: string,
  filters: DeliveryItemListQuery = {},
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "delivery-items",
    filters,
  ] as const;
}

export function getRequirementAnalysisDeliveryItemDetailQueryKey(
  projectId: string,
  runId: string,
  itemId: string,
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "delivery-items",
    "detail",
    itemId,
  ] as const;
}

export function getRequirementAnalysisRunCoverageQueryKey(
  projectId: string,
  runId: string,
  filters: CoverageListQuery = {},
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "coverage",
    filters,
  ] as const;
}

export function getRequirementAnalysisRunCitationsQueryKey(
  projectId: string,
  runId: string,
  filters: CitationListQuery = {},
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "citations",
    filters,
  ] as const;
}

export function getRequirementAnalysisCitationEvidenceQueryKey(
  projectId: string,
  runId: string,
  citationId: string,
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "evidence",
    citationId,
  ] as const;
}

export function getRequirementAnalysisRunTraceabilityQueryKey(
  projectId: string,
  runId: string,
  filters: TraceabilityListQuery = {},
) {
  return [
    ...getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
    "traceability",
    filters,
  ] as const;
}

/* ------------------------------------------------------------------------- */
/* Fetch helpers                                                             */
/* ------------------------------------------------------------------------- */

function getClient(options: ApiRequestOptions = {}) {
  return options.client ?? atlasApiClient;
}

function withSignal(signal?: AbortSignal) {
  return signal ? { signal } : {};
}

function unwrapResponse<T>(result: {
  data?: T;
  error?: Partial<import("@atlashq/api-client").components["schemas"]["ApiErrorDto"]>;
  response: Response;
}) {
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

export async function fetchRequirementAnalysisCapabilities(
  projectId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/capabilities",
    {
      params: { path: { projectId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<RequirementAnalysisCapabilitiesResponse>(result);
}

export async function fetchRequirementAnalysisProviderPolicies(
  projectId: string,
  filters: ProviderPolicyListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/provider-policies",
    {
      params: { path: { projectId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<ProviderPolicyListResponse>(result);
}

export async function fetchRequirementAnalysisEligibleSources(
  projectId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/eligible-sources",
    {
      params: { path: { projectId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<EligibleSourcePreviewResponse>(result);
}

export async function fetchAnalysisRuns(
  projectId: string,
  filters: AnalysisRunListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs",
    {
      params: { path: { projectId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisRunListResponse>(result);
}

export async function createAnalysisFreshRun(
  projectId: string,
  body: AnalysisRunFreshBodyInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/requirement-analysis/runs",
    {
      body,
      params: { path: { projectId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisRunDetailResponse>(result);
}

export async function fetchAnalysisRunDetail(
  projectId: string,
  runId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}",
    {
      params: { path: { projectId, runId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisRunDetailResponse>(result);
}

export async function cancelAnalysisRun(
  projectId: string,
  runId: string,
  body: AnalysisRunCancelBodyInput = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/cancel",
    {
      body,
      params: { path: { projectId, runId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisRunDetailResponse>(result);
}

export async function retryAnalysisRun(
  projectId: string,
  runId: string,
  body: AnalysisRunRetryBodyInput = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/retry",
    {
      body,
      params: { path: { projectId, runId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisRunDetailResponse>(result);
}

export async function replayAnalysisRun(
  projectId: string,
  runId: string,
  body: AnalysisRunReplayBodyInput = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/replay",
    {
      body,
      params: { path: { projectId, runId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisRunDetailResponse>(result);
}

export async function reprocessAnalysisRun(
  projectId: string,
  runId: string,
  body: AnalysisRunReprocessBodyInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/reprocess",
    {
      body,
      params: { path: { projectId, runId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisRunDetailResponse>(result);
}

export async function fetchAnalysisStages(
  projectId: string,
  runId: string,
  filters: AnalysisStageListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/stages",
    {
      params: { path: { projectId, runId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisStageListResponse>(result);
}

export async function fetchAnalysisBatches(
  projectId: string,
  runId: string,
  filters: AnalysisBatchListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/batches",
    {
      params: { path: { projectId, runId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<AnalysisBatchListResponse>(result);
}

export async function fetchAnalysisRequirements(
  projectId: string,
  runId: string,
  filters: RequirementListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/requirements",
    {
      params: { path: { projectId, runId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<RequirementListResponse>(result);
}

export async function fetchAnalysisRequirement(
  projectId: string,
  runId: string,
  requirementId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/requirements/{requirementId}",
    {
      params: { path: { projectId, runId, requirementId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<RequirementDetailResponse>(result);
}

export async function fetchAnalysisDeliveryItems(
  projectId: string,
  runId: string,
  filters: DeliveryItemListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/delivery-items",
    {
      params: { path: { projectId, runId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<DeliveryItemListResponse>(result);
}

export async function fetchAnalysisDeliveryItem(
  projectId: string,
  runId: string,
  itemId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/delivery-items/{itemId}",
    {
      params: { path: { projectId, runId, itemId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<DeliveryItemDetailResponse>(result);
}

export async function fetchAnalysisCoverage(
  projectId: string,
  runId: string,
  filters: CoverageListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/coverage",
    {
      params: { path: { projectId, runId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<CoverageListResponse>(result);
}

export async function fetchAnalysisCitations(
  projectId: string,
  runId: string,
  filters: CitationListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/citations",
    {
      params: { path: { projectId, runId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<CitationListResponse>(result);
}

export async function fetchAnalysisCitationEvidence(
  projectId: string,
  runId: string,
  citationId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/evidence/{citationId}",
    {
      params: { path: { projectId, runId, citationId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<CitationEvidenceResponse>(result);
}

export async function fetchAnalysisTraceability(
  projectId: string,
  runId: string,
  filters: TraceabilityListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/traceability",
    {
      params: { path: { projectId, runId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<TraceabilityListResponse>(result);
}

/* ------------------------------------------------------------------------- */
/* Invalidation targets                                                      */
/* ------------------------------------------------------------------------- */

export function getRequirementAnalysisRunListInvalidationTargets(
  projectId: string,
): readonly QueryKey[] {
  return [
    getRequirementAnalysisRunListFamilyQueryKey(projectId),
    getProjectDashboardQueryKey(projectId),
    projectListFamilyQueryKey,
    getProjectAuditEventsFamilyQueryKey(projectId),
  ];
}

export function getRequirementAnalysisRunMutationInvalidationTargets(
  projectId: string,
  runId: string,
): readonly QueryKey[] {
  return [
    ...getRequirementAnalysisRunListInvalidationTargets(projectId),
    getRequirementAnalysisRunFamilyQueryKey(projectId, runId),
  ];
}

export async function invalidateRequirementAnalysisTargets(
  queryClient: QueryClient,
  targets: readonly QueryKey[],
) {
  await invalidateQueryTargets(queryClient, targets);
}

export type AtlasClient = AtlasApiClient;
