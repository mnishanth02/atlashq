import {
  type Query,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { atlasApiClient } from "@/features/api";
import {
  type AtlasClient,
  archiveSource,
  cancelUploadSession,
  changeSourceIpReview,
  confirmUploadSession,
  createManualSource,
  createReferenceSource,
  createUploadSession,
  createVersionManual,
  createVersionUploadSession,
  type DuplicateMatch,
  fetchSource,
  fetchSourceChunks,
  fetchSourceExtractions,
  fetchSourceFileSignedUrl,
  fetchSources,
  fetchSourceVaultCapabilities,
  fetchSourceVersions,
  fetchUploadSession,
  getSourceChunksQueryKey,
  getSourceDetailInvalidationTargets,
  getSourceDetailQueryKey,
  getSourceExtractionsQueryKey,
  getSourceFileSignedUrlQueryKey,
  getSourceListInvalidationTargets,
  getSourceListQueryKey,
  getSourceUploadSessionQueryKey,
  getSourceVaultCapabilitiesQueryKey,
  getSourceVersionsQueryKey,
  type IpReviewChangeInput,
  invalidateSourceTargets,
  isTerminalProcessingStatus,
  type ManualSourceCreateInput,
  type ReferenceCaptureInput,
  type ReferenceSourceCreateInput,
  requestReferenceCapture,
  restoreSource,
  retrySourceProcessing,
  type SourceArchiveInput,
  type SourceDetailResponse,
  type SourceListQuery,
  type SourceMetadataPatchInput,
  type SourceRestoreInput,
  type SourceRetryInput,
  type SourceVaultCapabilitiesResponse,
  type SourceVersionManualInput,
  type SourceVersionUploadSessionInput,
  type UploadSessionCancelInput,
  type UploadSessionConfirmInput,
  type UploadSessionCreateInput,
  updateSourceMetadata,
} from "./sources-api";

export const SOURCE_LIST_PAGE_SIZE = 25;

const POLL_INTERVAL_MS = 3_000;
const SIGNED_URL_STALE_MS = 60_000;
const SIGNED_URL_GC_MS = 5 * 60_000;

function resolveId(id: string | undefined) {
  return id ?? "__missing__";
}

/**
 * Server-authoritative Source Vault capability flags. The API returns whether
 * writes/on-demand captures/OCR are enabled, and whether required storage/queue
 * infrastructure is currently reachable. When the query fails or is disabled we
 * fall back to `SAFE_DISABLED_CAPABILITIES` so the UI never guesses "enabled"
 * for a permission it cannot verify.
 */
export const SAFE_DISABLED_CAPABILITIES: SourceVaultCapabilitiesResponse = {
  writesEnabled: false,
  singlePageCaptureEnabled: false,
  ocrProcessingEnabled: false,
  storageAvailable: false,
  queueAvailable: false,
};

const CAPABILITIES_STALE_MS = 60_000;
const CAPABILITIES_GC_MS = 5 * 60_000;

export function sourceVaultCapabilitiesQueryOptions(
  projectId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  return queryOptions({
    queryKey: getSourceVaultCapabilitiesQueryKey(resolvedProjectId),
    enabled: Boolean(projectId),
    // Capabilities rarely flip within a session; a minute of freshness keeps
    // affordances stable across navigations without pinning stale flags after
    // an operator change.
    staleTime: CAPABILITIES_STALE_MS,
    gcTime: CAPABILITIES_GC_MS,
    queryFn: ({ signal }) => fetchSourceVaultCapabilities(resolvedProjectId, { client, signal }),
  });
}

export type SourceVaultCapabilitiesState = {
  data: SourceVaultCapabilitiesResponse;
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

/**
 * Returns capability flags with a safe-disabled fallback: while the query is
 * pending or has failed, every write flag reads as `false`. That way the UI
 * hides mutating affordances until the server has confirmed they're allowed —
 * the API remains authoritative but we don't leak controls we couldn't verify.
 */
export function useSourceVaultCapabilities(
  projectId: string | undefined,
  client?: AtlasClient,
): SourceVaultCapabilitiesState {
  const query = useQuery(sourceVaultCapabilitiesQueryOptions(projectId, client));
  return {
    data: query.data ?? SAFE_DISABLED_CAPABILITIES,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
  };
}

export function sourcesListQueryOptions(
  projectId: string | undefined,
  filters: SourceListQuery = {},
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  return queryOptions({
    queryKey: getSourceListQueryKey(resolvedProjectId, filters),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) => fetchSources(resolvedProjectId, filters, { client, signal }),
  });
}

export function sourceDetailQueryOptions(
  projectId: string | undefined,
  sourceId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedSourceId = resolveId(sourceId);
  const isEnabled = Boolean(projectId && sourceId);

  return queryOptions({
    queryKey: getSourceDetailQueryKey(resolvedProjectId, resolvedSourceId),
    enabled: isEnabled,
    queryFn: ({ signal }) => fetchSource(resolvedProjectId, resolvedSourceId, { client, signal }),
    /**
     * Bounded polling: keep refetching only while the source is in a
     * non-terminal processing state. `terminal` sources — ready, quarantined,
     * failed — return `false` so no further intervals are scheduled.
     */
    refetchInterval: (query: Query<SourceDetailResponse>) => {
      const data = query.state.data;
      if (!isEnabled || !data) {
        return false;
      }
      if (data.isArchived) {
        return false;
      }
      return isTerminalProcessingStatus(data.processingStatus) ? false : POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });
}

export function sourceVersionsQueryOptions(
  projectId: string | undefined,
  sourceId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedSourceId = resolveId(sourceId);
  return queryOptions({
    queryKey: getSourceVersionsQueryKey(resolvedProjectId, resolvedSourceId),
    enabled: Boolean(projectId && sourceId),
    queryFn: ({ signal }) =>
      fetchSourceVersions(resolvedProjectId, resolvedSourceId, {}, { client, signal }),
  });
}

export function sourceExtractionsQueryOptions(
  projectId: string | undefined,
  sourceId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedSourceId = resolveId(sourceId);
  return queryOptions({
    queryKey: getSourceExtractionsQueryKey(resolvedProjectId, resolvedSourceId),
    enabled: Boolean(projectId && sourceId),
    queryFn: ({ signal }) =>
      fetchSourceExtractions(resolvedProjectId, resolvedSourceId, {}, { client, signal }),
  });
}

export function sourceChunksQueryOptions(
  projectId: string | undefined,
  sourceId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedSourceId = resolveId(sourceId);
  return queryOptions({
    queryKey: getSourceChunksQueryKey(resolvedProjectId, resolvedSourceId),
    enabled: Boolean(projectId && sourceId),
    queryFn: ({ signal }) =>
      fetchSourceChunks(resolvedProjectId, resolvedSourceId, {}, { client, signal }),
  });
}

export function sourceUploadSessionQueryOptions(
  projectId: string | undefined,
  sessionId: string | undefined,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedSessionId = resolveId(sessionId);
  return queryOptions({
    queryKey: getSourceUploadSessionQueryKey(resolvedProjectId, resolvedSessionId),
    enabled: Boolean(projectId && sessionId),
    queryFn: ({ signal }) =>
      fetchUploadSession(resolvedProjectId, resolvedSessionId, { client, signal }),
  });
}

/**
 * Signed URL queries are short-lived and MUST NOT be invalidated by list
 * mutations. They are cached for a small window so a repeated preview open
 * doesn't re-issue a signed URL, but they are garbage collected quickly.
 */
export function sourceFileSignedUrlQueryOptions(
  projectId: string | undefined,
  sourceId: string | undefined,
  fileId: string | undefined,
  purpose: "preview" | "download",
  enabled: boolean,
  client: AtlasClient = atlasApiClient,
) {
  const resolvedProjectId = resolveId(projectId);
  const resolvedSourceId = resolveId(sourceId);
  const resolvedFileId = resolveId(fileId);
  const isEnabled = enabled && Boolean(projectId && sourceId && fileId);

  return queryOptions({
    queryKey: getSourceFileSignedUrlQueryKey(
      resolvedProjectId,
      resolvedSourceId,
      resolvedFileId,
      purpose,
    ),
    enabled: isEnabled,
    staleTime: SIGNED_URL_STALE_MS,
    gcTime: SIGNED_URL_GC_MS,
    queryFn: ({ signal }) =>
      fetchSourceFileSignedUrl(resolvedProjectId, resolvedSourceId, resolvedFileId, purpose, {
        client,
        signal,
      }),
  });
}

/* -------------------- React hooks -------------------- */

export function useSourcesQuery(
  projectId: string | undefined,
  filters: SourceListQuery = {},
  client?: AtlasClient,
) {
  return useQuery(sourcesListQueryOptions(projectId, filters, client));
}

export function useSourceDetailQuery(
  projectId: string | undefined,
  sourceId: string | undefined,
  client?: AtlasClient,
) {
  return useQuery(sourceDetailQueryOptions(projectId, sourceId, client));
}

export function useSourceVersionsQuery(
  projectId: string | undefined,
  sourceId: string | undefined,
  client?: AtlasClient,
) {
  return useQuery(sourceVersionsQueryOptions(projectId, sourceId, client));
}

export function useSourceExtractionsQuery(
  projectId: string | undefined,
  sourceId: string | undefined,
  client?: AtlasClient,
) {
  return useQuery(sourceExtractionsQueryOptions(projectId, sourceId, client));
}

export function useSourceChunksQuery(
  projectId: string | undefined,
  sourceId: string | undefined,
  client?: AtlasClient,
) {
  return useQuery(sourceChunksQueryOptions(projectId, sourceId, client));
}

export function useUploadSessionQuery(
  projectId: string | undefined,
  sessionId: string | undefined,
  client?: AtlasClient,
) {
  return useQuery(sourceUploadSessionQueryOptions(projectId, sessionId, client));
}

export function useSourceFileSignedUrlQuery(
  projectId: string | undefined,
  sourceId: string | undefined,
  fileId: string | undefined,
  purpose: "preview" | "download",
  enabled: boolean,
  client?: AtlasClient,
) {
  return useQuery(
    sourceFileSignedUrlQueryOptions(projectId, sourceId, fileId, purpose, enabled, client),
  );
}

/* -------------------- Mutations -------------------- */

export function useCreateUploadSessionMutation(
  projectId: string,
  client: AtlasClient = atlasApiClient,
) {
  return useMutation({
    mutationFn: (input: UploadSessionCreateInput) =>
      createUploadSession(projectId, input, { client }),
  });
}

export function useConfirmUploadSessionMutation(
  projectId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: UploadSessionConfirmInput }) =>
      confirmUploadSession(projectId, sessionId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(queryClient, getSourceListInvalidationTargets(projectId));
    },
  });
}

export function useCancelUploadSessionMutation(
  projectId: string,
  client: AtlasClient = atlasApiClient,
) {
  return useMutation({
    mutationFn: ({
      sessionId,
      input = {},
    }: {
      sessionId: string;
      input?: UploadSessionCancelInput;
    }) => cancelUploadSession(projectId, sessionId, input, { client }),
  });
}

export function useCreateManualSourceMutation(
  projectId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualSourceCreateInput) =>
      createManualSource(projectId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(queryClient, getSourceListInvalidationTargets(projectId));
    },
  });
}

export function useCreateReferenceSourceMutation(
  projectId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReferenceSourceCreateInput) =>
      createReferenceSource(projectId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(queryClient, getSourceListInvalidationTargets(projectId));
    },
  });
}

export function useUpdateSourceMetadataMutation(
  projectId: string,
  sourceId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SourceMetadataPatchInput) =>
      updateSourceMetadata(projectId, sourceId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(
        queryClient,
        getSourceDetailInvalidationTargets(projectId, sourceId),
      );
    },
  });
}

export function useArchiveSourceMutation(
  projectId: string,
  sourceId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SourceArchiveInput) =>
      archiveSource(projectId, sourceId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(
        queryClient,
        getSourceDetailInvalidationTargets(projectId, sourceId),
      );
    },
  });
}

export function useRestoreSourceMutation(
  projectId: string,
  sourceId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SourceRestoreInput) =>
      restoreSource(projectId, sourceId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(
        queryClient,
        getSourceDetailInvalidationTargets(projectId, sourceId),
      );
    },
  });
}

export function useRetrySourceProcessingMutation(
  projectId: string,
  sourceId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SourceRetryInput) =>
      retrySourceProcessing(projectId, sourceId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(
        queryClient,
        getSourceDetailInvalidationTargets(projectId, sourceId),
      );
    },
  });
}

export function useCreateVersionUploadSessionMutation(
  projectId: string,
  sourceId: string,
  client: AtlasClient = atlasApiClient,
) {
  return useMutation({
    mutationFn: (input: SourceVersionUploadSessionInput) =>
      createVersionUploadSession(projectId, sourceId, input, { client }),
  });
}

export function useCreateVersionManualMutation(
  projectId: string,
  sourceId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SourceVersionManualInput) =>
      createVersionManual(projectId, sourceId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(
        queryClient,
        getSourceDetailInvalidationTargets(projectId, sourceId),
      );
    },
  });
}

export function useRequestReferenceCaptureMutation(
  projectId: string,
  sourceId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReferenceCaptureInput) =>
      requestReferenceCapture(projectId, sourceId, input, { client }),
    onSuccess: async () => {
      // Capture will publish a new version once the worker completes; invalidate
      // versions + detail so the UI can show the new head.
      await invalidateSourceTargets(
        queryClient,
        getSourceDetailInvalidationTargets(projectId, sourceId),
      );
    },
  });
}

export function useChangeSourceIpReviewMutation(
  projectId: string,
  sourceId: string,
  client: AtlasClient = atlasApiClient,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IpReviewChangeInput) =>
      changeSourceIpReview(projectId, sourceId, input, { client }),
    onSuccess: async () => {
      await invalidateSourceTargets(
        queryClient,
        getSourceDetailInvalidationTargets(projectId, sourceId),
      );
    },
  });
}

/* -------------------- Utility exports for tests -------------------- */

export type { DuplicateMatch };
