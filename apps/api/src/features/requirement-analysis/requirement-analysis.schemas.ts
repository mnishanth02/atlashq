import {
  analysisBatchListFilterSchema,
  analysisBatchListResponseSchema,
  analysisRunCancelRequestSchema,
  analysisRunDetailResponseSchema,
  analysisRunFreshRequestSchema,
  analysisRunListFilterSchema,
  analysisRunListResponseSchema,
  analysisRunReplayRequestSchema,
  analysisRunReprocessRequestSchema,
  analysisRunRetryRequestSchema,
  analysisStageListFilterSchema,
  analysisStageListResponseSchema,
  citationEvidenceResponseSchema,
  citationListFilterSchema,
  citationListResponseSchema,
  coverageListFilterSchema,
  coverageListResponseSchema,
  createPaginatedResponseSchema,
  createUuidPathParamsSchema,
  deliveryItemListFilterSchema,
  deliveryItemListResponseSchema,
  deliveryItemResponseSchema,
  eligibleSourcePreviewResponseSchema,
  isoDateTimeSchema,
  optimisticVersionSchema,
  paginationQuerySchema,
  providerPolicyApproveInputSchema,
  providerPolicyCreateInputSchema,
  providerPolicyDeactivateInputSchema,
  providerPolicyListFilterSchema,
  providerPolicyListResponseSchema,
  providerPolicyResponseSchema,
  requirementListFilterSchema,
  requirementListResponseSchema,
  requirementResponseSchema,
  uuidSchema,
} from "@atlashq/validators";
import { z } from "zod";

// Re-export shared Module 3 request/response schemas from @atlashq/validators.
export {
  analysisBatchListFilterSchema,
  analysisBatchListResponseSchema,
  analysisRunCancelRequestSchema,
  analysisRunDetailResponseSchema,
  analysisRunFreshRequestSchema,
  analysisRunListFilterSchema,
  analysisRunListResponseSchema,
  analysisRunReplayRequestSchema,
  analysisRunReprocessRequestSchema,
  analysisRunRetryRequestSchema,
  analysisStageListFilterSchema,
  analysisStageListResponseSchema,
  citationEvidenceResponseSchema,
  citationListFilterSchema,
  citationListResponseSchema,
  coverageListFilterSchema,
  coverageListResponseSchema,
  deliveryItemListFilterSchema,
  deliveryItemListResponseSchema,
  deliveryItemResponseSchema,
  eligibleSourcePreviewResponseSchema,
  providerPolicyCreateInputSchema,
  providerPolicyListFilterSchema,
  providerPolicyListResponseSchema,
  providerPolicyResponseSchema,
  requirementListFilterSchema,
  requirementListResponseSchema,
  requirementResponseSchema,
};

export const providerPolicyApproveActionInputSchema = providerPolicyApproveInputSchema
  .extend({ version: optimisticVersionSchema })
  .strict();

export const providerPolicyDeactivateActionInputSchema = providerPolicyDeactivateInputSchema
  .extend({ version: optimisticVersionSchema })
  .strict();

export type ProviderPolicyApproveActionInput = z.infer<
  typeof providerPolicyApproveActionInputSchema
>;
export type ProviderPolicyDeactivateActionInput = z.infer<
  typeof providerPolicyDeactivateActionInputSchema
>;

export const providerPolicyPathParamsSchema = z
  .object({
    policyId: uuidSchema,
  })
  .strict();

export const projectPathParamsSchema = createUuidPathParamsSchema("projectId");

export const runPathParamsSchema = z
  .object({
    projectId: uuidSchema,
    runId: uuidSchema,
  })
  .strict();

export const runRequirementPathParamsSchema = z
  .object({
    projectId: uuidSchema,
    runId: uuidSchema,
    requirementId: uuidSchema,
  })
  .strict();

export const runDeliveryItemPathParamsSchema = z
  .object({
    projectId: uuidSchema,
    runId: uuidSchema,
    itemId: uuidSchema,
  })
  .strict();

export const runCitationPathParamsSchema = z
  .object({
    projectId: uuidSchema,
    runId: uuidSchema,
    citationId: uuidSchema,
  })
  .strict();

export const requirementAnalysisCapabilitiesResponseSchema = z
  .object({
    analysisEnabled: z.boolean(),
    readsEnabled: z.boolean(),
    referenceFeatureExtractionEnabled: z.boolean(),
    queueAvailable: z.boolean(),
    approvedProviderPolicyAvailable: z.boolean(),
    safeDisabled: z.boolean(),
    safeDisabledReason: z
      .enum([
        "analysis_feature_disabled",
        "provider_not_approved",
        "queue_unavailable",
        "reads_disabled",
      ])
      .nullable(),
  })
  .strict();

export type RequirementAnalysisCapabilitiesResponse = z.infer<
  typeof requirementAnalysisCapabilitiesResponseSchema
>;

export const traceabilityLinkResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: uuidSchema,
    fromType: z.string().trim().min(1),
    fromId: uuidSchema,
    toType: z.string().trim().min(1),
    toId: uuidSchema,
    relation: z.string().trim().min(1),
    createdBy: uuidSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const traceabilityListFilterSchema = paginationQuerySchema
  .extend({
    relation: z.string().trim().min(1).optional(),
  })
  .strict();

export const traceabilityListResponseSchema = createPaginatedResponseSchema(
  traceabilityLinkResponseSchema,
);

export type TraceabilityListFilter = z.infer<typeof traceabilityListFilterSchema>;
export type TraceabilityListResponse = z.infer<typeof traceabilityListResponseSchema>;
