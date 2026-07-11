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

export type SourceVaultCapabilitiesResponse = JsonResponse<
  "SourceDocumentsController_getCapabilities",
  200
>;
export type UploadSessionResponse = JsonResponse<
  "SourceDocumentsController_createUploadSession",
  201
>;
export type UploadSessionResponseGet = JsonResponse<
  "SourceDocumentsController_getUploadSession",
  200
>;
export type UploadSessionCreateInput =
  JsonRequestBody<"SourceDocumentsController_createUploadSession">;
export type UploadSessionConfirmInput =
  JsonRequestBody<"SourceDocumentsController_confirmUploadSession">;
export type UploadSessionCancelInput =
  JsonRequestBody<"SourceDocumentsController_cancelUploadSession">;
export type SourceListResponse = JsonResponse<"SourceDocumentsController_listSources", 200>;
export type SourceListQuery = NonNullable<
  operations["SourceDocumentsController_listSources"]["parameters"]["query"]
>;
export type SourceListItem = SourceListResponse["items"][number];
export type SourceDetailResponse = JsonResponse<"SourceDocumentsController_getSource", 200>;
export type ManualSourceCreateInput =
  JsonRequestBody<"SourceDocumentsController_createManualSource">;
export type ReferenceSourceCreateInput =
  JsonRequestBody<"SourceDocumentsController_createReferenceSource">;
export type SourceMetadataPatchInput = JsonRequestBody<"SourceDocumentsController_updateMetadata">;
export type SourceArchiveInput = JsonRequestBody<"SourceDocumentsController_archiveSource">;
export type SourceRestoreInput = JsonRequestBody<"SourceDocumentsController_restoreSource">;
export type SourceRetryInput = JsonRequestBody<"SourceDocumentsController_retryProcessing">;
export type SourceVersionUploadSessionInput =
  JsonRequestBody<"SourceDocumentsController_createVersionUploadSession">;
export type SourceVersionManualInput =
  JsonRequestBody<"SourceDocumentsController_createVersionManual">;
export type SourceVersionListResponse = JsonResponse<"SourceDocumentsController_listVersions", 200>;
export type SourceExtractionListResponse = JsonResponse<
  "SourceDocumentsController_listExtractions",
  200
>;
export type SourceChunkListResponse = JsonResponse<"SourceDocumentsController_listChunks", 200>;
export type SourceSignedUrlResponse = JsonResponse<"SourceDocumentsController_getPreviewUrl", 200>;
export type ReferenceCaptureInput =
  JsonRequestBody<"SourceDocumentsController_requestReferenceCapture">;
export type IpReviewChangeInput = JsonRequestBody<"SourceDocumentsController_changeIpReview">;

export type SourceProcessingStatus = SourceListItem["processingStatus"];
export type SourceType = SourceListItem["sourceType"];
export type SourceFormat = NonNullable<SourceListItem["documentFormat"]>;
export type SourceIpReviewStatus = NonNullable<SourceListItem["ipReviewStatus"]>;

/**
 * Processing status values that are terminal — polling must stop the moment
 * a query reports one of these states.
 */
export const TERMINAL_PROCESSING_STATUSES: readonly SourceProcessingStatus[] = [
  "ready",
  "quarantined",
  "failed",
];

export function isTerminalProcessingStatus(status: SourceProcessingStatus | undefined): boolean {
  return status !== undefined && TERMINAL_PROCESSING_STATUSES.includes(status);
}

/** Stable Module 2 error codes surfaced by the API. */
export const SOURCE_ERROR_CODES = {
  duplicateConfirmationRequired: "SOURCE_DUPLICATE_CONFIRMATION_REQUIRED",
  uploadSessionExpired: "SOURCE_UPLOAD_SESSION_EXPIRED",
  uploadSessionAlreadyConfirmed: "SOURCE_UPLOAD_SESSION_ALREADY_CONFIRMED",
  fileTooLarge: "SOURCE_FILE_TOO_LARGE",
  uploadSizeMismatch: "SOURCE_UPLOAD_SIZE_MISMATCH",
  mimeMismatch: "SOURCE_MIME_MISMATCH",
  hashMismatch: "SOURCE_HASH_MISMATCH",
  infected: "SOURCE_INFECTED",
  notReady: "SOURCE_NOT_READY",
  superseded: "SOURCE_SUPERSEDED",
  archived: "SOURCE_ARCHIVED",
  referenceAttestationRequired: "SOURCE_REFERENCE_ATTESTATION_REQUIRED",
  referenceRestricted: "SOURCE_REFERENCE_RESTRICTED",
  captureDisabled: "SOURCE_CAPTURE_DISABLED",
  captureUrlBlocked: "SOURCE_CAPTURE_URL_BLOCKED",
  processingNotRetryable: "SOURCE_PROCESSING_NOT_RETRYABLE",
  storageUnavailable: "SOURCE_STORAGE_UNAVAILABLE",
} as const;

export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[keyof typeof SOURCE_ERROR_CODES];

export function isSourceErrorCode(error: unknown, code: SourceErrorCode): boolean {
  return error instanceof AtlasApiError && error.code === code;
}

export type DuplicateMatch = UploadSessionResponse["duplicateMatches"][number];

/**
 * Extract duplicate-match records from a 409/422 error surfaced by the API.
 *
 * The generated `ApiErrorDto.details[].metadata` bag carries the structured
 * payload for a duplicate rejection (module-02 §8). Historically callers
 * probed for an ad-hoc `detail.matches` property; that shape does not exist
 * in the generated contract and must not be relied on. Only the typed
 * `metadata.matches` array is consulted here.
 */
export function extractDuplicateMatches(error: unknown): DuplicateMatch[] {
  if (!(error instanceof AtlasApiError) || error.details === undefined) {
    return [];
  }

  const matches: DuplicateMatch[] = [];
  for (const detail of error.details) {
    const metadata = detail?.metadata;
    if (!metadata || typeof metadata !== "object") continue;
    const payload = (metadata as { matches?: unknown }).matches;
    if (!Array.isArray(payload)) continue;
    for (const match of payload) {
      if (isDuplicateMatchShape(match)) {
        matches.push(match);
      }
    }
  }
  return matches;
}

function isDuplicateMatchShape(value: unknown): value is DuplicateMatch {
  return (
    typeof value === "object" &&
    value !== null &&
    "sourceId" in value &&
    typeof (value as { sourceId: unknown }).sourceId === "string"
  );
}

/**
 * Stable query key families for the source vault. The list/detail/version/
 * extraction/chunks families follow the same `("api", "projects", "detail",
 * projectId, "source-documents", ...)` prefix so a project-scoped
 * invalidation can walk one prefix and hit them all.
 */
export function getSourceListFamilyQueryKey(projectId: string) {
  return ["api", "projects", "detail", projectId, "source-documents", "list"] as const;
}

export function getSourceVaultCapabilitiesQueryKey(projectId: string) {
  return ["api", "projects", "detail", projectId, "source-vault", "capabilities"] as const;
}

export function getSourceListQueryKey(projectId: string, filters: SourceListQuery = {}) {
  return [...getSourceListFamilyQueryKey(projectId), filters] as const;
}

export function getSourceDetailFamilyQueryKey(projectId: string, sourceId: string) {
  return ["api", "projects", "detail", projectId, "source-documents", "detail", sourceId] as const;
}

export function getSourceDetailQueryKey(projectId: string, sourceId: string) {
  return getSourceDetailFamilyQueryKey(projectId, sourceId);
}

export function getSourceVersionsQueryKey(projectId: string, sourceId: string) {
  return [...getSourceDetailFamilyQueryKey(projectId, sourceId), "versions"] as const;
}

export function getSourceExtractionsQueryKey(projectId: string, sourceId: string) {
  return [...getSourceDetailFamilyQueryKey(projectId, sourceId), "extractions"] as const;
}

export function getSourceChunksQueryKey(projectId: string, sourceId: string) {
  return [...getSourceDetailFamilyQueryKey(projectId, sourceId), "chunks"] as const;
}

export function getSourceUploadSessionQueryKey(projectId: string, sessionId: string) {
  return [
    "api",
    "projects",
    "detail",
    projectId,
    "source-documents",
    "upload-sessions",
    sessionId,
  ] as const;
}

export function getSourceFileSignedUrlQueryKey(
  projectId: string,
  sourceId: string,
  fileId: string,
  purpose: "preview" | "download",
) {
  return [
    ...getSourceDetailFamilyQueryKey(projectId, sourceId),
    "files",
    fileId,
    "signed-url",
    purpose,
  ] as const;
}

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

/* ------------------------------------------------------------------------- */
/* Capability flags                                                          */
/* ------------------------------------------------------------------------- */

export async function fetchSourceVaultCapabilities(
  projectId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/source-vault/capabilities",
    {
      params: { path: { projectId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceVaultCapabilitiesResponse>(result);
}

/* ------------------------------------------------------------------------- */
/* Upload sessions                                                           */
/* ------------------------------------------------------------------------- */

export async function createUploadSession(
  projectId: string,
  body: UploadSessionCreateInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-document-upload-sessions",
    {
      body,
      params: { path: { projectId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<UploadSessionResponse>(result);
}

export async function fetchUploadSession(
  projectId: string,
  sessionId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/source-document-upload-sessions/{sessionId}",
    {
      params: { path: { projectId, sessionId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<UploadSessionResponseGet>(result);
}

export async function confirmUploadSession(
  projectId: string,
  sessionId: string,
  body: UploadSessionConfirmInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-document-upload-sessions/{sessionId}/confirm",
    {
      body,
      params: { path: { projectId, sessionId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function cancelUploadSession(
  projectId: string,
  sessionId: string,
  body: UploadSessionCancelInput = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-document-upload-sessions/{sessionId}/cancel",
    {
      body,
      params: { path: { projectId, sessionId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<UploadSessionResponseGet>(result);
}

/* ------------------------------------------------------------------------- */
/* Sources                                                                   */
/* ------------------------------------------------------------------------- */

export async function fetchSources(
  projectId: string,
  filters: SourceListQuery = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET("/api/v1/projects/{projectId}/source-documents", {
    params: { path: { projectId }, query: filters },
    ...withSignal(options.signal),
  });
  return unwrapResponse<SourceListResponse>(result);
}

export async function fetchSource(
  projectId: string,
  sourceId: string,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}",
    {
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function createManualSource(
  projectId: string,
  body: ManualSourceCreateInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/manual",
    {
      body,
      params: { path: { projectId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function createReferenceSource(
  projectId: string,
  body: ReferenceSourceCreateInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/references",
    {
      body,
      params: { path: { projectId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function updateSourceMetadata(
  projectId: string,
  sourceId: string,
  body: SourceMetadataPatchInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).PATCH(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/metadata",
    {
      body,
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function archiveSource(
  projectId: string,
  sourceId: string,
  body: SourceArchiveInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/archive",
    {
      body,
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function restoreSource(
  projectId: string,
  sourceId: string,
  body: SourceRestoreInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/restore",
    {
      body,
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function retrySourceProcessing(
  projectId: string,
  sourceId: string,
  body: SourceRetryInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/retry-processing",
    {
      body,
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function createVersionUploadSession(
  projectId: string,
  sourceId: string,
  body: SourceVersionUploadSessionInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/versions/upload-session",
    {
      body,
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<UploadSessionResponse>(result);
}

export async function createVersionManual(
  projectId: string,
  sourceId: string,
  body: SourceVersionManualInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/versions/manual",
    {
      body,
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

export async function fetchSourceVersions(
  projectId: string,
  sourceId: string,
  filters: NonNullable<
    operations["SourceDocumentsController_listVersions"]["parameters"]["query"]
  > = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/versions",
    {
      params: { path: { projectId, sourceId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceVersionListResponse>(result);
}

export async function fetchSourceExtractions(
  projectId: string,
  sourceId: string,
  filters: NonNullable<
    operations["SourceDocumentsController_listExtractions"]["parameters"]["query"]
  > = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/extractions",
    {
      params: { path: { projectId, sourceId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceExtractionListResponse>(result);
}

export async function fetchSourceChunks(
  projectId: string,
  sourceId: string,
  filters: NonNullable<
    operations["SourceDocumentsController_listChunks"]["parameters"]["query"]
  > = {},
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).GET(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/chunks",
    {
      params: { path: { projectId, sourceId }, query: filters },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceChunkListResponse>(result);
}

export async function fetchSourceFileSignedUrl(
  projectId: string,
  sourceId: string,
  fileId: string,
  purpose: "preview" | "download",
  options: ApiRequestOptions = {},
) {
  const path =
    purpose === "preview"
      ? "/api/v1/projects/{projectId}/source-documents/{sourceId}/files/{fileId}/preview-url"
      : "/api/v1/projects/{projectId}/source-documents/{sourceId}/files/{fileId}/download-url";
  const result = await getClient(options).GET(path, {
    params: { path: { projectId, sourceId, fileId } },
    ...withSignal(options.signal),
  });
  return unwrapResponse<SourceSignedUrlResponse>(result);
}

export async function requestReferenceCapture(
  projectId: string,
  sourceId: string,
  body: ReferenceCaptureInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/reference-capture",
    {
      body,
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  if (result.error) {
    throw AtlasApiError.fromResponse(result.error, result.response);
  }
  if (!result.response.ok) {
    throw AtlasApiError.fromResponse(undefined, result.response);
  }
  return { queued: true } as const;
}

export async function changeSourceIpReview(
  projectId: string,
  sourceId: string,
  body: IpReviewChangeInput,
  options: ApiRequestOptions = {},
) {
  const result = await getClient(options).POST(
    "/api/v1/projects/{projectId}/source-documents/{sourceId}/ip-review",
    {
      body,
      params: { path: { projectId, sourceId } },
      ...withSignal(options.signal),
    },
  );
  return unwrapResponse<SourceDetailResponse>(result);
}

/* ------------------------------------------------------------------------- */
/* Invalidation targets                                                      */
/* ------------------------------------------------------------------------- */

export function getSourceListInvalidationTargets(projectId: string): readonly QueryKey[] {
  return [
    getSourceListFamilyQueryKey(projectId),
    getProjectDashboardQueryKey(projectId),
    projectListFamilyQueryKey,
    getProjectAuditEventsFamilyQueryKey(projectId),
  ];
}

export function getSourceDetailInvalidationTargets(
  projectId: string,
  sourceId: string,
): readonly QueryKey[] {
  return [
    ...getSourceListInvalidationTargets(projectId),
    getSourceDetailFamilyQueryKey(projectId, sourceId),
    getSourceVersionsQueryKey(projectId, sourceId),
    getSourceExtractionsQueryKey(projectId, sourceId),
    getSourceChunksQueryKey(projectId, sourceId),
  ];
}

export async function invalidateSourceTargets(
  queryClient: QueryClient,
  targets: readonly QueryKey[],
) {
  await invalidateQueryTargets(queryClient, targets);
}

export type AtlasClient = AtlasApiClient;
