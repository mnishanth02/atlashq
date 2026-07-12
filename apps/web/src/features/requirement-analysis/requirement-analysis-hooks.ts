import {
  infiniteQueryOptions,
  keepPreviousData,
  type Query,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { atlasApiClient } from "@/features/api";
import {
  type AnalysisBatchListQuery,
  type AnalysisBatchListResponse,
  type AnalysisRunCancelBodyInput,
  type AnalysisRunDetailResponse,
  type AnalysisRunFreshBodyInput,
  type AnalysisRunListQuery,
  type AnalysisRunReplayBodyInput,
  type AnalysisRunReprocessBodyInput,
  type AnalysisRunRetryBodyInput,
  type AnalysisRunStatus,
  type AnalysisStageListQuery,
  type AnalysisStageListResponse,
  type AtlasClient,
  type CitationListQuery,
  type CoverageListQuery,
  cancelAnalysisRun,
  createAnalysisFreshRun,
  type DeliveryItemListQuery,
  fetchAnalysisBatches,
  fetchAnalysisCitationEvidence,
  fetchAnalysisCitations,
  fetchAnalysisCoverage,
  fetchAnalysisDeliveryItem,
  fetchAnalysisDeliveryItems,
  fetchAnalysisRequirement,
  fetchAnalysisRequirements,
  fetchAnalysisRunDetail,
  fetchAnalysisRuns,
  fetchAnalysisStages,
  fetchAnalysisTraceability,
  fetchRequirementAnalysisCapabilities,
  fetchRequirementAnalysisEligibleSources,
  fetchRequirementAnalysisProviderPolicies,
  getRequirementAnalysisCapabilitiesQueryKey,
  getRequirementAnalysisCitationEvidenceQueryKey,
  getRequirementAnalysisDeliveryItemDetailQueryKey,
  getRequirementAnalysisEligibleSourcesQueryKey,
  getRequirementAnalysisProviderPoliciesQueryKey,
  getRequirementAnalysisRequirementDetailQueryKey,
  getRequirementAnalysisRunBatchesQueryKey,
  getRequirementAnalysisRunCitationsQueryKey,
  getRequirementAnalysisRunCoverageQueryKey,
  getRequirementAnalysisRunDeliveryItemsQueryKey,
  getRequirementAnalysisRunDetailQueryKey,
  getRequirementAnalysisRunListQueryKey,
  getRequirementAnalysisRunMutationInvalidationTargets,
  getRequirementAnalysisRunRequirementsQueryKey,
  getRequirementAnalysisRunStagesQueryKey,
  getRequirementAnalysisRunTraceabilityQueryKey,
  invalidateRequirementAnalysisTargets,
  isTerminalRunStatus,
  type ProviderPolicyListQuery,
  type RequirementAnalysisCapabilitiesResponse,
  type RequirementListQuery,
  replayAnalysisRun,
  reprocessAnalysisRun,
  retryAnalysisRun,
  type TraceabilityListQuery,
} from "./requirement-analysis-api";

const POLL_INTERVAL_MS = 3_000;
const CAPABILITIES_STALE_MS = 60_000;
const CAPABILITIES_GC_MS = 5 * 60_000;

function resolveId(id: string | undefined) {
  return id ?? "__missing__";
}

/**
 * Server-authoritative safe-disabled fallback. While the capabilities query is
 * pending or has failed, every affordance reads as disabled so the analyzer
 * never guesses that a permission/queue/provider is available before the API
 * has confirmed it (module-03 §7.1, §14.3 "safe-disabled").
 */
export const SAFE_DISABLED_CAPABILITIES: RequirementAnalysisCapabilitiesResponse = {
  analysisEnabled: false,
  readsEnabled: false,
  referenceFeatureExtractionEnabled: false,
  queueAvailable: false,
  approvedProviderPolicyAvailable: false,
  safeDisabled: true,
  safeDisabledReason: "analysis_feature_disabled",
};

export function requirementAnalysisCapabilitiesQueryOptions(
  projectId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  return queryOptions({
    queryKey: getRequirementAnalysisCapabilitiesQueryKey(resolvedProjectId),
    enabled: Boolean(projectId),
    staleTime: CAPABILITIES_STALE_MS,
    gcTime: CAPABILITIES_GC_MS,
    queryFn: ({ signal }) =>
      fetchRequirementAnalysisCapabilities(resolvedProjectId, { client, signal }),
  });
}

export type RequirementAnalysisCapabilitiesState = {
  data: RequirementAnalysisCapabilitiesResponse;
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

export function useRequirementAnalysisCapabilities(
  projectId: string | undefined,
  client?: AtlasClient,
): RequirementAnalysisCapabilitiesState {
  const query = useQuery(requirementAnalysisCapabilitiesQueryOptions(projectId, client));
  return {
    data: query.data ?? SAFE_DISABLED_CAPABILITIES,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
  };
}

export function requirementAnalysisProviderPoliciesQueryOptions(
  projectId: string | undefined,
  filters: ProviderPolicyListQuery = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  return queryOptions({
    queryKey: getRequirementAnalysisProviderPoliciesQueryKey(resolvedProjectId, filters),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) =>
      fetchRequirementAnalysisProviderPolicies(resolvedProjectId, filters, { client, signal }),
  });
}

export function useRequirementAnalysisProviderPolicies(
  projectId: string | undefined,
  filters: ProviderPolicyListQuery = {},
  client?: AtlasClient,
) {
  return useQuery(requirementAnalysisProviderPoliciesQueryOptions(projectId, filters, client));
}

export function requirementAnalysisEligibleSourcesQueryOptions(
  projectId: string | undefined,
  enabled: boolean,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  return queryOptions({
    queryKey: getRequirementAnalysisEligibleSourcesQueryKey(resolvedProjectId),
    enabled: enabled && Boolean(projectId),
    queryFn: ({ signal }) =>
      fetchRequirementAnalysisEligibleSources(resolvedProjectId, { client, signal }),
  });
}

export function useRequirementAnalysisEligibleSources(
  projectId: string | undefined,
  enabled: boolean,
  client?: AtlasClient,
) {
  return useQuery(requirementAnalysisEligibleSourcesQueryOptions(projectId, enabled, client));
}

export function analysisRunListQueryOptions(
  projectId: string | undefined,
  filters: AnalysisRunListQuery = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  return queryOptions({
    queryKey: getRequirementAnalysisRunListQueryKey(resolvedProjectId, filters),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) => fetchAnalysisRuns(resolvedProjectId, filters, { client, signal }),
  });
}

export function useAnalysisRunListQuery(
  projectId: string | undefined,
  filters: AnalysisRunListQuery = {},
  client?: AtlasClient,
) {
  return useQuery(analysisRunListQueryOptions(projectId, filters, client));
}

type AnalysisRunListPageParam = string | null;

/**
 * Cursor-paginated run history (module-03 §8.1): each page carries
 * `pageInfo.nextCursor`/`hasMore`, and `getNextPageParam` stops requesting
 * once the server reports no more pages.
 */
export function analysisRunListInfiniteQueryOptions(
  projectId: string | undefined,
  filters: Omit<AnalysisRunListQuery, "cursor"> = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  return infiniteQueryOptions({
    queryKey: [
      ...getRequirementAnalysisRunListQueryKey(resolvedProjectId, filters),
      "infinite",
    ] as const,
    enabled: Boolean(projectId),
    initialPageParam: null as AnalysisRunListPageParam,
    queryFn: ({ pageParam, signal }) =>
      fetchAnalysisRuns(
        resolvedProjectId,
        { ...filters, ...(pageParam ? { cursor: pageParam } : {}) },
        { client, signal },
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasMore ? lastPage.pageInfo.nextCursor : null,
    placeholderData: keepPreviousData,
  });
}

export function useAnalysisRunListInfiniteQuery(
  projectId: string | undefined,
  filters: Omit<AnalysisRunListQuery, "cursor"> = {},
  client?: AtlasClient,
) {
  return useInfiniteQuery(analysisRunListInfiniteQueryOptions(projectId, filters, client));
}

export function analysisRunDetailQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const isEnabled = Boolean(projectId && runId);

  return queryOptions({
    queryKey: getRequirementAnalysisRunDetailQueryKey(resolvedProjectId, resolvedRunId),
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      fetchAnalysisRunDetail(resolvedProjectId, resolvedRunId, { client, signal }),
    /**
     * Bounded polling (module-03 §6.4, §14.3): keep refetching only while the
     * run is in a non-terminal state, at a fixed 3-second interval. The
     * instant the run reports a terminal status, `refetchInterval` returns
     * `false` so no further requests are scheduled.
     */
    refetchInterval: (query: Query<AnalysisRunDetailResponse>) => {
      const data = query.state.data;
      if (!isEnabled || !data) {
        return false;
      }
      return isTerminalRunStatus(data.status) ? false : POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });
}

export function useAnalysisRunDetailQuery(
  projectId: string | undefined,
  runId: string | undefined,
  client?: AtlasClient,
) {
  return useQuery(analysisRunDetailQueryOptions(projectId, runId, client));
}

export function analysisStagesQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  filters: AnalysisStageListQuery = {},
  client: AtlasClient = atlasApiClient,
  runStatus?: AnalysisRunStatus,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const isEnabled = Boolean(projectId && runId);
  return queryOptions({
    queryKey: getRequirementAnalysisRunStagesQueryKey(resolvedProjectId, resolvedRunId, filters),
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      fetchAnalysisStages(resolvedProjectId, resolvedRunId, filters, { client, signal }),
    /**
     * Bounded polling (module-03 §6.4, §14.3): stage rows keep refetching
     * only while the parent run is non-terminal, at the same fixed
     * 3-second interval used by the run-detail query. Passing no
     * `runStatus` (e.g. before the run-detail query has resolved) disables
     * polling until the caller knows the run is non-terminal.
     */
    refetchInterval: (query: Query<AnalysisStageListResponse>) => {
      if (!isEnabled || !query.state.data || !runStatus) {
        return false;
      }
      return isTerminalRunStatus(runStatus) ? false : POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });
}

export function useAnalysisStagesQuery(
  projectId: string | undefined,
  runId: string | undefined,
  filters: AnalysisStageListQuery = {},
  client?: AtlasClient,
  runStatus?: AnalysisRunStatus,
) {
  return useQuery(analysisStagesQueryOptions(projectId, runId, filters, client, runStatus));
}

export function analysisBatchesQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  filters: AnalysisBatchListQuery = {},
  client: AtlasClient = atlasApiClient,
  runStatus?: AnalysisRunStatus,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const isEnabled = Boolean(projectId && runId);
  return queryOptions({
    queryKey: getRequirementAnalysisRunBatchesQueryKey(resolvedProjectId, resolvedRunId, filters),
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      fetchAnalysisBatches(resolvedProjectId, resolvedRunId, filters, { client, signal }),
    /**
     * Bounded polling (module-03 §6.4, §14.3): the same rule as stages —
     * only poll while the parent run is non-terminal, and stop the instant
     * `runStatus` reports a terminal state.
     */
    refetchInterval: (query: Query<AnalysisBatchListResponse>) => {
      if (!isEnabled || !query.state.data || !runStatus) {
        return false;
      }
      return isTerminalRunStatus(runStatus) ? false : POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });
}

export function useAnalysisBatchesQuery(
  projectId: string | undefined,
  runId: string | undefined,
  filters: AnalysisBatchListQuery = {},
  client?: AtlasClient,
  runStatus?: AnalysisRunStatus,
) {
  return useQuery(analysisBatchesQueryOptions(projectId, runId, filters, client, runStatus));
}

export function analysisRequirementsQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  filters: RequirementListQuery = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const isEnabled = Boolean(projectId && runId);
  return queryOptions({
    queryKey: getRequirementAnalysisRunRequirementsQueryKey(
      resolvedProjectId,
      resolvedRunId,
      filters,
    ),
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      fetchAnalysisRequirements(resolvedProjectId, resolvedRunId, filters, { client, signal }),
  });
}

export function useAnalysisRequirementsQuery(
  projectId: string | undefined,
  runId: string | undefined,
  filters: RequirementListQuery = {},
  client?: AtlasClient,
) {
  return useQuery(analysisRequirementsQueryOptions(projectId, runId, filters, client));
}

export function analysisRequirementDetailQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  requirementId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const resolvedRequirementId = resolveId(requirementId);
  return queryOptions({
    queryKey: getRequirementAnalysisRequirementDetailQueryKey(
      resolvedProjectId,
      resolvedRunId,
      resolvedRequirementId,
    ),
    enabled: Boolean(projectId && runId && requirementId),
    queryFn: ({ signal }) =>
      fetchAnalysisRequirement(resolvedProjectId, resolvedRunId, resolvedRequirementId, {
        client,
        signal,
      }),
  });
}

export function useAnalysisRequirementDetailQuery(
  projectId: string | undefined,
  runId: string | undefined,
  requirementId: string | undefined,
  client?: AtlasClient,
) {
  return useQuery(analysisRequirementDetailQueryOptions(projectId, runId, requirementId, client));
}

export function analysisDeliveryItemsQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  filters: DeliveryItemListQuery = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const isEnabled = Boolean(projectId && runId);
  return queryOptions({
    queryKey: getRequirementAnalysisRunDeliveryItemsQueryKey(
      resolvedProjectId,
      resolvedRunId,
      filters,
    ),
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      fetchAnalysisDeliveryItems(resolvedProjectId, resolvedRunId, filters, { client, signal }),
  });
}

export function useAnalysisDeliveryItemsQuery(
  projectId: string | undefined,
  runId: string | undefined,
  filters: DeliveryItemListQuery = {},
  client?: AtlasClient,
) {
  return useQuery(analysisDeliveryItemsQueryOptions(projectId, runId, filters, client));
}

export function analysisDeliveryItemDetailQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  itemId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const resolvedItemId = resolveId(itemId);
  return queryOptions({
    queryKey: getRequirementAnalysisDeliveryItemDetailQueryKey(
      resolvedProjectId,
      resolvedRunId,
      resolvedItemId,
    ),
    enabled: Boolean(projectId && runId && itemId),
    queryFn: ({ signal }) =>
      fetchAnalysisDeliveryItem(resolvedProjectId, resolvedRunId, resolvedItemId, {
        client,
        signal,
      }),
  });
}

export function useAnalysisDeliveryItemDetailQuery(
  projectId: string | undefined,
  runId: string | undefined,
  itemId: string | undefined,
  client?: AtlasClient,
) {
  return useQuery(analysisDeliveryItemDetailQueryOptions(projectId, runId, itemId, client));
}

export function analysisCoverageQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  filters: CoverageListQuery = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const isEnabled = Boolean(projectId && runId);
  return queryOptions({
    queryKey: getRequirementAnalysisRunCoverageQueryKey(resolvedProjectId, resolvedRunId, filters),
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      fetchAnalysisCoverage(resolvedProjectId, resolvedRunId, filters, { client, signal }),
  });
}

export function useAnalysisCoverageQuery(
  projectId: string | undefined,
  runId: string | undefined,
  filters: CoverageListQuery = {},
  client?: AtlasClient,
) {
  return useQuery(analysisCoverageQueryOptions(projectId, runId, filters, client));
}

export function analysisCitationsQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  filters: CitationListQuery = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const isEnabled = Boolean(projectId && runId);
  return queryOptions({
    queryKey: getRequirementAnalysisRunCitationsQueryKey(resolvedProjectId, resolvedRunId, filters),
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      fetchAnalysisCitations(resolvedProjectId, resolvedRunId, filters, { client, signal }),
  });
}

export function useAnalysisCitationsQuery(
  projectId: string | undefined,
  runId: string | undefined,
  filters: CitationListQuery = {},
  client?: AtlasClient,
) {
  return useQuery(analysisCitationsQueryOptions(projectId, runId, filters, client));
}

export function analysisCitationEvidenceQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  citationId: string | undefined,
  enabled: boolean,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const resolvedCitationId = resolveId(citationId);
  return queryOptions({
    queryKey: getRequirementAnalysisCitationEvidenceQueryKey(
      resolvedProjectId,
      resolvedRunId,
      resolvedCitationId,
    ),
    enabled: enabled && Boolean(projectId && runId && citationId),
    queryFn: ({ signal }) =>
      fetchAnalysisCitationEvidence(resolvedProjectId, resolvedRunId, resolvedCitationId, {
        client,
        signal,
      }),
  });
}

export function useAnalysisCitationEvidenceQuery(
  projectId: string | undefined,
  runId: string | undefined,
  citationId: string | undefined,
  enabled: boolean,
  client?: AtlasClient,
) {
  return useQuery(
    analysisCitationEvidenceQueryOptions(projectId, runId, citationId, enabled, client),
  );
}

export function analysisTraceabilityQueryOptions(
  projectId: string | undefined,
  runId: string | undefined,
  filters: TraceabilityListQuery = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedRunId = resolveId(runId);
  const isEnabled = Boolean(projectId && runId);
  return queryOptions({
    queryKey: getRequirementAnalysisRunTraceabilityQueryKey(
      resolvedProjectId,
      resolvedRunId,
      filters,
    ),
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      fetchAnalysisTraceability(resolvedProjectId, resolvedRunId, filters, { client, signal }),
  });
}

export function useAnalysisTraceabilityQuery(
  projectId: string | undefined,
  runId: string | undefined,
  filters: TraceabilityListQuery = {},
  client?: AtlasClient,
) {
  return useQuery(analysisTraceabilityQueryOptions(projectId, runId, filters, client));
}

/* -------------------- Mutations -------------------- */

export function useCreateAnalysisFreshRunMutation(
  projectId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalysisRunFreshBodyInput) =>
      createAnalysisFreshRun(projectId, input, { client }),
    onSuccess: async (run) => {
      await invalidateRequirementAnalysisTargets(
        queryClient,
        getRequirementAnalysisRunMutationInvalidationTargets(projectId, run.id),
      );
    },
  });
}

export function useCancelAnalysisRunMutation(
  projectId: string,
  runId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalysisRunCancelBodyInput = {}) =>
      cancelAnalysisRun(projectId, runId, input, { client }),
    onSuccess: async () => {
      await invalidateRequirementAnalysisTargets(
        queryClient,
        getRequirementAnalysisRunMutationInvalidationTargets(projectId, runId),
      );
    },
  });
}

export function useRetryAnalysisRunMutation(
  projectId: string,
  runId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalysisRunRetryBodyInput = {}) =>
      retryAnalysisRun(projectId, runId, input, { client }),
    onSuccess: async (run) => {
      await invalidateRequirementAnalysisTargets(
        queryClient,
        getRequirementAnalysisRunMutationInvalidationTargets(projectId, runId),
      );
      await invalidateRequirementAnalysisTargets(
        queryClient,
        getRequirementAnalysisRunMutationInvalidationTargets(projectId, run.id),
      );
    },
  });
}

export function useReplayAnalysisRunMutation(
  projectId: string,
  runId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalysisRunReplayBodyInput = {}) =>
      replayAnalysisRun(projectId, runId, input, { client }),
    onSuccess: async (run) => {
      await invalidateRequirementAnalysisTargets(
        queryClient,
        getRequirementAnalysisRunMutationInvalidationTargets(projectId, runId),
      );
      await invalidateRequirementAnalysisTargets(
        queryClient,
        getRequirementAnalysisRunMutationInvalidationTargets(projectId, run.id),
      );
    },
  });
}

export function useReprocessAnalysisRunMutation(
  projectId: string,
  runId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalysisRunReprocessBodyInput) =>
      reprocessAnalysisRun(projectId, runId, input, { client }),
    onSuccess: async (run) => {
      await invalidateRequirementAnalysisTargets(
        queryClient,
        getRequirementAnalysisRunMutationInvalidationTargets(projectId, runId),
      );
      await invalidateRequirementAnalysisTargets(
        queryClient,
        getRequirementAnalysisRunMutationInvalidationTargets(projectId, run.id),
      );
    },
  });
}
