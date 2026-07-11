import {
  createPaginatedResponseSchema,
  createUuidPathParamsSchema,
  ipReviewChangeInputSchema,
  manualSourceCreateInputSchema,
  referenceCaptureRequestInputSchema,
  referenceSourceCreateInputSchema,
  sourceArchiveInputSchema,
  sourceChunkResponseSchema,
  sourceDocumentDetailResponseSchema,
  sourceDocumentListResponseSchema,
  sourceDocumentSummaryResponseSchema,
  sourceExtractionResponseSchema,
  sourceFileSignedUrlResponseSchema,
  sourceListFilterSchema,
  sourceMetadataPatchInputSchema,
  sourceRestoreInputSchema,
  sourceRetryProcessingInputSchema,
  sourceVaultCapabilitiesResponseSchema,
  sourceVersionManualInputSchema,
  sourceVersionUploadSessionInputSchema,
  uploadSessionCancelInputSchema,
  uploadSessionConfirmInputSchema,
  uploadSessionCreateInputSchema,
  uploadSessionResponseSchema,
  uuidSchema,
} from "@atlashq/validators";
import { z } from "zod";

/**
 * Shared request/query/response schemas re-exported so the controller composes DTOs from a single
 * feature entry point exactly the way `features/projects` composes its DTOs. Response schemas
 * unique to a strict list variant are declared below.
 */
export {
  ipReviewChangeInputSchema,
  manualSourceCreateInputSchema,
  referenceCaptureRequestInputSchema,
  referenceSourceCreateInputSchema,
  sourceArchiveInputSchema,
  sourceChunkResponseSchema,
  sourceDocumentDetailResponseSchema,
  sourceDocumentListResponseSchema,
  sourceDocumentSummaryResponseSchema,
  sourceExtractionResponseSchema,
  sourceFileSignedUrlResponseSchema,
  sourceListFilterSchema,
  sourceMetadataPatchInputSchema,
  sourceRestoreInputSchema,
  sourceRetryProcessingInputSchema,
  sourceVaultCapabilitiesResponseSchema,
  sourceVersionManualInputSchema,
  sourceVersionUploadSessionInputSchema,
  uploadSessionCancelInputSchema,
  uploadSessionConfirmInputSchema,
  uploadSessionCreateInputSchema,
  uploadSessionResponseSchema,
};

export type UploadSessionCreateInput = z.infer<typeof uploadSessionCreateInputSchema>;
export type UploadSessionConfirmInput = z.infer<typeof uploadSessionConfirmInputSchema>;
export type UploadSessionCancelInput = z.infer<typeof uploadSessionCancelInputSchema>;
export type UploadSessionResponse = z.infer<typeof uploadSessionResponseSchema>;
export type SourceListFilter = z.infer<typeof sourceListFilterSchema>;
export type SourceDocumentSummaryResponse = z.infer<typeof sourceDocumentSummaryResponseSchema>;
export type SourceDocumentDetailResponse = z.infer<typeof sourceDocumentDetailResponseSchema>;
export type SourceDocumentListResponse = z.infer<typeof sourceDocumentListResponseSchema>;
export type SourceExtractionResponse = z.infer<typeof sourceExtractionResponseSchema>;
export type SourceChunkResponse = z.infer<typeof sourceChunkResponseSchema>;
export type SourceFileSignedUrlResponse = z.infer<typeof sourceFileSignedUrlResponseSchema>;
export type SourceVaultCapabilitiesResponse = z.infer<typeof sourceVaultCapabilitiesResponseSchema>;
export type ManualSourceCreateInput = z.infer<typeof manualSourceCreateInputSchema>;
export type ReferenceSourceCreateInput = z.infer<typeof referenceSourceCreateInputSchema>;
export type ReferenceCaptureRequestInput = z.infer<typeof referenceCaptureRequestInputSchema>;
export type IpReviewChangeInput = z.infer<typeof ipReviewChangeInputSchema>;
export type SourceMetadataPatchInput = z.infer<typeof sourceMetadataPatchInputSchema>;
export type SourceArchiveInput = z.infer<typeof sourceArchiveInputSchema>;
export type SourceRestoreInput = z.infer<typeof sourceRestoreInputSchema>;
export type SourceRetryProcessingInput = z.infer<typeof sourceRetryProcessingInputSchema>;

/** `POST /source-document-upload-sessions/:sessionId/...` uses `sessionId`. */
export const uploadSessionPathParamsSchema = z
  .object({
    projectId: uuidSchema,
    sessionId: uuidSchema,
  })
  .strict();

/** Every source-scoped route carries `{projectId, sourceId}`. */
export const sourcePathParamsSchema = z
  .object({
    projectId: uuidSchema,
    sourceId: uuidSchema,
  })
  .strict();

/** File-scoped preview/download routes add `fileId`. */
export const sourceFilePathParamsSchema = z
  .object({
    projectId: uuidSchema,
    sourceId: uuidSchema,
    fileId: uuidSchema,
  })
  .strict();

/** Project-only path params, reused for list/create endpoints. */
export const projectPathParamsSchema = createUuidPathParamsSchema("projectId");

/** Session-only (no source) path params for the initial upload session routes. */
export const uploadSessionRootPathParamsSchema = z
  .object({
    projectId: uuidSchema,
    sessionId: uuidSchema,
  })
  .strict();

/** Version-list and extraction/chunk-list responses are simple pagination wrappers. */
export const sourceExtractionListResponseSchema = createPaginatedResponseSchema(
  sourceExtractionResponseSchema,
);
export type SourceExtractionListResponse = z.infer<typeof sourceExtractionListResponseSchema>;

export const sourceChunkListResponseSchema =
  createPaginatedResponseSchema(sourceChunkResponseSchema);
export type SourceChunkListResponse = z.infer<typeof sourceChunkListResponseSchema>;

export const sourceVersionListResponseSchema = createPaginatedResponseSchema(
  sourceDocumentSummaryResponseSchema,
);
export type SourceVersionListResponse = z.infer<typeof sourceVersionListResponseSchema>;
