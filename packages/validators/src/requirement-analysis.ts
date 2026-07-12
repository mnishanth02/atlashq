import {
  analysisArtifactOriginValues,
  analysisBatchStatusValues,
  analysisEligibleSourceExclusionReasonValues,
  analysisProviderValues,
  analysisRunModeValues,
  analysisRunStatusValues,
  analysisStageKindValues,
  analysisStageStatusValues,
  blockerSubtypeValues,
  citationVerificationStatusValues,
  confidenceBandValues,
  confidenceReasonCodeValues,
  coverageCategoryKeyValues,
  coverageEvidenceStateValues,
  coverageStatusValues,
  deliveryItemPriorityValues,
  deliveryItemSeverityValues,
  deliveryItemStatusValues,
  deliveryItemTypeValues,
  deliveryItemVisibilityValues,
  dependencyDirectionValues,
  ipReviewStatusValues,
  providerDataRetentionModeValues,
  providerPolicyStatusValues,
  requirementEpistemicStatusValues,
  requirementLifecycleStateValues,
  requirementPriorityValues,
  requirementTypeValues,
  scopeChangeClassificationValues,
  sourceDocumentFormatValues,
  sourceTypeValues,
} from "@atlashq/types";
import { z } from "zod";
import { booleanQuerySchema } from "./helpers.js";
import {
  isoDateTimeSchema,
  organizationIdSchema,
  projectIdSchema,
  userIdSchema,
  uuidSchema,
} from "./ids.js";
import { createPaginatedResponseSchema, paginationQuerySchema } from "./pagination.js";

const nonEmptyStringSchema = z.string().trim().min(1);
const shortTextSchema = z.string().trim().min(1).max(500);
const mediumTextSchema = z.string().trim().min(1).max(4_000);
const longTextSchema = z.string().trim().min(1).max(20_000);
const nullableNonEmptyStringSchema = nonEmptyStringSchema.nullable();
const nullableIsoDateTimeSchema = isoDateTimeSchema.nullable();
const nullableUuidSchema = uuidSchema.nullable();
const nonNegativeIntSchema = z.number().int().min(0);
const positiveIntSchema = z.number().int().positive();
const usdValueSchema = z.number().nonnegative();
const hashSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 hex digest.");

// ---------------------------------------------------------------------------
// Controlled values
// ---------------------------------------------------------------------------

export const requirementEpistemicStatusSchema = z.enum(requirementEpistemicStatusValues);
export const confidenceBandSchema = z.enum(confidenceBandValues);
export const confidenceReasonCodeSchema = z.enum(confidenceReasonCodeValues);
export const analysisRunModeSchema = z.enum(analysisRunModeValues);
export const analysisRunStatusSchema = z.enum(analysisRunStatusValues);
export const analysisStageStatusSchema = z.enum(analysisStageStatusValues);
export const analysisBatchStatusSchema = z.enum(analysisBatchStatusValues);
export const analysisStageKindSchema = z.enum(analysisStageKindValues);
export const analysisArtifactOriginSchema = z.enum(analysisArtifactOriginValues);
export const requirementTypeSchema = z.enum(requirementTypeValues);
export const requirementPrioritySchema = z.enum(requirementPriorityValues);
export const requirementLifecycleStateSchema = z.enum(requirementLifecycleStateValues);
export const citationVerificationStatusSchema = z.enum(citationVerificationStatusValues);
export const coverageCategoryKeySchema = z.enum(coverageCategoryKeyValues);
export const coverageStatusSchema = z.enum(coverageStatusValues);
export const coverageEvidenceStateSchema = z.enum(coverageEvidenceStateValues);
export const deliveryItemTypeSchema = z.enum(deliveryItemTypeValues);
export const deliveryItemStatusSchema = z.enum(deliveryItemStatusValues);
export const deliveryItemVisibilitySchema = z.enum(deliveryItemVisibilityValues);
export const deliveryItemSeveritySchema = z.enum(deliveryItemSeverityValues);
export const deliveryItemPrioritySchema = z.enum(deliveryItemPriorityValues);
export const providerPolicyStatusSchema = z.enum(providerPolicyStatusValues);
export const providerDataRetentionModeSchema = z.enum(providerDataRetentionModeValues);
export const analysisProviderSchema = z.enum(analysisProviderValues);
export const analysisEligibleSourceExclusionReasonSchema = z.enum(
  analysisEligibleSourceExclusionReasonValues,
);
export const dependencyDirectionSchema = z.enum(dependencyDirectionValues);
export const blockerSubtypeSchema = z.enum(blockerSubtypeValues);
export const scopeChangeClassificationSchema = z.enum(scopeChangeClassificationValues);

// ---------------------------------------------------------------------------
// Provider-policy request/response contracts
// ---------------------------------------------------------------------------

export const providerPolicyCreateInputSchema = z
  .object({
    provider: analysisProviderSchema,
    policyName: z.string().trim().min(1).max(120),
    modelAlias: z.string().trim().min(1).max(120),
    resolvedModelId: z.string().trim().min(1).max(255),
    dataRetentionMode: providerDataRetentionModeSchema,
    providerTermsSnapshotHash: hashSchema.optional(),
    approvalNote: mediumTextSchema.optional(),
    maxUsdPerRun: z.number().positive().optional(),
    maxInputTokensPerRun: positiveIntSchema.optional(),
    maxOutputTokensPerRun: positiveIntSchema.optional(),
    maxWallClockSeconds: positiveIntSchema.optional(),
  })
  .strict();

export type ProviderPolicyCreateInput = z.infer<typeof providerPolicyCreateInputSchema>;

export const providerPolicyApproveInputSchema = z
  .object({
    approvalNote: mediumTextSchema.optional(),
    providerTermsSnapshotHash: hashSchema.optional(),
  })
  .strict();

export type ProviderPolicyApproveInput = z.infer<typeof providerPolicyApproveInputSchema>;

export const providerPolicyDeactivateInputSchema = z
  .object({
    reason: mediumTextSchema,
  })
  .strict();

export type ProviderPolicyDeactivateInput = z.infer<typeof providerPolicyDeactivateInputSchema>;

export const providerPolicyListFilterSchema = paginationQuerySchema
  .extend({
    status: providerPolicyStatusSchema.optional(),
    provider: analysisProviderSchema.optional(),
    includeInactive: booleanQuerySchema.default(false),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type ProviderPolicyListFilter = z.infer<typeof providerPolicyListFilterSchema>;

export const providerPolicyResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: organizationIdSchema,
    version: positiveIntSchema,
    provider: analysisProviderSchema,
    policyName: z.string().trim().min(1),
    modelAlias: z.string().trim().min(1),
    resolvedModelId: z.string().trim().min(1),
    dataRetentionMode: providerDataRetentionModeSchema,
    status: providerPolicyStatusSchema,
    approvedForRequirementAnalysis: z.boolean(),
    approvedBy: userIdSchema.nullable(),
    approvedAt: nullableIsoDateTimeSchema,
    approvalNote: nullableNonEmptyStringSchema,
    providerTermsSnapshotHash: hashSchema.nullable(),
    maxUsdPerRun: z.number().positive(),
    maxInputTokensPerRun: positiveIntSchema,
    maxOutputTokensPerRun: positiveIntSchema,
    maxWallClockSeconds: positiveIntSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type ProviderPolicyResponse = z.infer<typeof providerPolicyResponseSchema>;

export const providerPolicyListResponseSchema = createPaginatedResponseSchema(
  providerPolicyResponseSchema,
);

// ---------------------------------------------------------------------------
// Eligible-source preview contracts
// ---------------------------------------------------------------------------

export const eligibleSourcePreviewItemSchema = z
  .object({
    sourceDocumentId: uuidSchema,
    sourceLineageId: uuidSchema,
    sourceVersionNumber: positiveIntSchema,
    sourceType: z.enum(sourceTypeValues),
    documentFormat: z.enum(sourceDocumentFormatValues).nullable(),
    title: z.string().trim().min(1).max(200),
    contentHash: hashSchema,
    sourceExtractionId: nullableUuidSchema,
    sourceExtractionVersion: positiveIntSchema.nullable(),
    chunkerVersion: nullableNonEmptyStringSchema,
    chunkCount: nonNegativeIntSchema,
    totalCharacterCount: nonNegativeIntSchema,
    referenceIpReviewStatus: z.enum(ipReviewStatusValues).nullable(),
    included: z.boolean(),
    exclusionReason: analysisEligibleSourceExclusionReasonSchema.nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.included && value.exclusionReason !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exclusionReason"],
        message: "Included sources cannot carry an exclusion reason.",
      });
    }
    if (!value.included && value.exclusionReason === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exclusionReason"],
        message: "Excluded sources must include a stable exclusion reason.",
      });
    }
  });

export type EligibleSourcePreviewItem = z.infer<typeof eligibleSourcePreviewItemSchema>;

export const eligibleSourcePreviewResponseSchema = z
  .object({
    sources: z.array(eligibleSourcePreviewItemSchema),
    includedCount: nonNegativeIntSchema,
    excludedCount: nonNegativeIntSchema,
    generatedAt: isoDateTimeSchema,
  })
  .strict();

export type EligibleSourcePreviewResponse = z.infer<typeof eligibleSourcePreviewResponseSchema>;

// ---------------------------------------------------------------------------
// Run action requests
// ---------------------------------------------------------------------------

export const analysisRunFreshRequestSchema = z
  .object({
    providerPolicyId: uuidSchema,
    sourceDocumentIds: z.array(uuidSchema).min(1).optional(),
  })
  .strict();

export type AnalysisRunFreshRequest = z.infer<typeof analysisRunFreshRequestSchema>;

export const analysisRunRetryRequestSchema = z
  .object({
    reason: shortTextSchema.optional(),
  })
  .strict();

export type AnalysisRunRetryRequest = z.infer<typeof analysisRunRetryRequestSchema>;

export const analysisRunReplayRequestSchema = z
  .object({
    reason: shortTextSchema.optional(),
  })
  .strict();

export type AnalysisRunReplayRequest = z.infer<typeof analysisRunReplayRequestSchema>;

export const analysisRunReprocessRequestSchema = z
  .object({
    providerPolicyId: uuidSchema,
    promptBundleVersion: nonEmptyStringSchema,
    schemaBundleVersion: nonEmptyStringSchema,
    pipelineVersion: nonEmptyStringSchema,
    reason: shortTextSchema.optional(),
  })
  .strict();

export type AnalysisRunReprocessRequest = z.infer<typeof analysisRunReprocessRequestSchema>;

export const analysisRunCancelRequestSchema = z
  .object({
    reason: shortTextSchema.optional(),
  })
  .strict();

export type AnalysisRunCancelRequest = z.infer<typeof analysisRunCancelRequestSchema>;

// ---------------------------------------------------------------------------
// Run list/detail response contracts
// ---------------------------------------------------------------------------

export const analysisRunBudgetResponseSchema = z
  .object({
    maxUsd: z.number().positive(),
    maxInputTokens: positiveIntSchema,
    maxOutputTokens: positiveIntSchema,
    maxWallClockSeconds: positiveIntSchema,
  })
  .strict();

export type AnalysisRunBudgetResponse = z.infer<typeof analysisRunBudgetResponseSchema>;

export const analysisRunUsageResponseSchema = z
  .object({
    inputTokensUsed: nonNegativeIntSchema,
    outputTokensUsed: nonNegativeIntSchema,
    costUsd: usdValueSchema,
  })
  .strict();

export type AnalysisRunUsageResponse = z.infer<typeof analysisRunUsageResponseSchema>;

export const analysisRunArtifactCountsResponseSchema = z
  .object({
    requirements: nonNegativeIntSchema,
    citations: nonNegativeIntSchema,
    coverageEntries: nonNegativeIntSchema,
    deliveryItems: nonNegativeIntSchema,
  })
  .strict();

export type AnalysisRunArtifactCountsResponse = z.infer<
  typeof analysisRunArtifactCountsResponseSchema
>;

export const analysisRunProviderPolicyDescriptorSchema = z
  .object({
    providerPolicyId: uuidSchema,
    provider: analysisProviderSchema,
    modelAlias: nonEmptyStringSchema,
    resolvedModelId: nonEmptyStringSchema,
    dataRetentionMode: providerDataRetentionModeSchema,
  })
  .strict();

export type AnalysisRunProviderPolicyDescriptor = z.infer<
  typeof analysisRunProviderPolicyDescriptorSchema
>;

export const analysisRunProvenanceDescriptorSchema = z
  .object({
    promptBundleVersion: nonEmptyStringSchema,
    promptBundleHash: hashSchema,
    schemaBundleVersion: nonEmptyStringSchema,
    schemaBundleHash: hashSchema,
    pipelineVersion: nonEmptyStringSchema,
    pipelineHash: hashSchema,
    modelPolicyHash: hashSchema,
  })
  .strict();

export type AnalysisRunProvenanceDescriptor = z.infer<typeof analysisRunProvenanceDescriptorSchema>;

export const analysisSnapshotDescriptorSchema = z
  .object({
    id: uuidSchema,
    snapshotHash: hashSchema,
    sourceCount: nonNegativeIntSchema,
    chunkCount: nonNegativeIntSchema,
    totalCharacterCount: nonNegativeIntSchema,
    eligibilityRulesVersion: nonEmptyStringSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type AnalysisSnapshotDescriptor = z.infer<typeof analysisSnapshotDescriptorSchema>;

export const analysisRunSummaryResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: organizationIdSchema,
    projectId: projectIdSchema,
    requestedBy: userIdSchema,
    mode: analysisRunModeSchema,
    status: analysisRunStatusSchema,
    sourceSnapshotId: nullableUuidSchema,
    replayOfRunId: nullableUuidSchema,
    reprocessOfRunId: nullableUuidSchema,
    retryOfRunId: nullableUuidSchema,
    warningCodes: z.array(nonEmptyStringSchema),
    failureCode: nullableNonEmptyStringSchema,
    failureDetail: nullableNonEmptyStringSchema,
    failureRetryable: z.boolean(),
    failedStageId: nullableUuidSchema,
    cancelRequestedAt: nullableIsoDateTimeSchema,
    cancelRequestedBy: userIdSchema.nullable(),
    cancelReason: nullableNonEmptyStringSchema,
    startedAt: nullableIsoDateTimeSchema,
    completedAt: nullableIsoDateTimeSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    correlationId: nonEmptyStringSchema,
    providerPolicy: analysisRunProviderPolicyDescriptorSchema,
    provenance: analysisRunProvenanceDescriptorSchema,
    budgets: analysisRunBudgetResponseSchema,
    usage: analysisRunUsageResponseSchema,
    artifactCounts: analysisRunArtifactCountsResponseSchema,
  })
  .strict();

export type AnalysisRunSummaryResponse = z.infer<typeof analysisRunSummaryResponseSchema>;

export const analysisRunDetailResponseSchema = analysisRunSummaryResponseSchema
  .extend({
    snapshot: analysisSnapshotDescriptorSchema.nullable(),
    readNotices: z.array(nonEmptyStringSchema),
  })
  .strict();

export type AnalysisRunDetailResponse = z.infer<typeof analysisRunDetailResponseSchema>;

export const analysisRunListResponseSchema = createPaginatedResponseSchema(
  analysisRunSummaryResponseSchema,
);

export const analysisRunListFilterSchema = paginationQuerySchema
  .extend({
    status: analysisRunStatusSchema.optional(),
    mode: analysisRunModeSchema.optional(),
    requestedBy: userIdSchema.optional(),
    providerPolicyId: uuidSchema.optional(),
    createdAfter: isoDateTimeSchema.optional(),
    createdBefore: isoDateTimeSchema.optional(),
  })
  .strict();

export type AnalysisRunListFilter = z.infer<typeof analysisRunListFilterSchema>;

// ---------------------------------------------------------------------------
// Stage and batch response contracts
// ---------------------------------------------------------------------------

export const analysisStageResponseSchema = z
  .object({
    id: uuidSchema,
    runId: uuidSchema,
    organizationId: organizationIdSchema,
    projectId: projectIdSchema,
    kind: analysisStageKindSchema,
    status: analysisStageStatusSchema,
    attemptNumber: positiveIntSchema,
    idempotencyKey: nonEmptyStringSchema,
    inputHash: hashSchema.nullable(),
    outputHash: hashSchema.nullable(),
    startedAt: nullableIsoDateTimeSchema,
    completedAt: nullableIsoDateTimeSchema,
    retryAfter: nullableIsoDateTimeSchema,
    failureCode: nullableNonEmptyStringSchema,
    failureDetail: nullableNonEmptyStringSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type AnalysisStageResponse = z.infer<typeof analysisStageResponseSchema>;

export const analysisStageListFilterSchema = paginationQuerySchema
  .extend({
    status: analysisStageStatusSchema.optional(),
    kind: analysisStageKindSchema.optional(),
  })
  .strict();

export type AnalysisStageListFilter = z.infer<typeof analysisStageListFilterSchema>;

export const analysisStageListResponseSchema = createPaginatedResponseSchema(
  analysisStageResponseSchema,
);

export const analysisBatchResponseSchema = z
  .object({
    id: uuidSchema,
    stageId: uuidSchema,
    runId: uuidSchema,
    organizationId: organizationIdSchema,
    projectId: projectIdSchema,
    batchOrder: nonNegativeIntSchema,
    sourceChunkStartSequence: nonNegativeIntSchema,
    sourceChunkEndSequence: nonNegativeIntSchema,
    inputTokenEstimate: nonNegativeIntSchema,
    maxOutputTokens: positiveIntSchema,
    status: analysisBatchStatusSchema,
    attemptNumber: positiveIntSchema,
    aiRunId: uuidSchema.nullable(),
    repairOfBatchId: nullableUuidSchema,
    shapeOnlyRepairUsed: z.boolean(),
    cacheKey: nullableNonEmptyStringSchema,
    cacheHitOfBatchId: nullableUuidSchema,
    failureCode: nullableNonEmptyStringSchema,
    failureDetail: nullableNonEmptyStringSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type AnalysisBatchResponse = z.infer<typeof analysisBatchResponseSchema>;

export const analysisBatchListFilterSchema = paginationQuerySchema
  .extend({
    stageId: uuidSchema.optional(),
    status: analysisBatchStatusSchema.optional(),
  })
  .strict();

export type AnalysisBatchListFilter = z.infer<typeof analysisBatchListFilterSchema>;

export const analysisBatchListResponseSchema = createPaginatedResponseSchema(
  analysisBatchResponseSchema,
);

// ---------------------------------------------------------------------------
// Requirement, citation, coverage, and delivery-item artifacts
// ---------------------------------------------------------------------------

function validateEpistemicConfidence(
  value: {
    epistemicStatus: z.infer<typeof requirementEpistemicStatusSchema>;
    confidenceBand: z.infer<typeof confidenceBandSchema> | null;
    confidenceReasonCodes: z.infer<typeof confidenceReasonCodeSchema>[];
  },
  ctx: z.RefinementCtx,
) {
  if (
    (value.epistemicStatus === "unknown" || value.epistemicStatus === "conflicting") &&
    value.confidenceBand !== null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confidenceBand"],
      message: "Unknown/conflicting artifacts must not expose a confidence band.",
    });
  }

  if (value.confidenceBand !== null && value.confidenceReasonCodes.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confidenceReasonCodes"],
      message: "Non-null confidence bands require at least one deterministic reason code.",
    });
  }
}

export const requirementResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: organizationIdSchema,
    projectId: projectIdSchema,
    analysisRunId: uuidSchema,
    stableKey: nonEmptyStringSchema,
    title: shortTextSchema,
    description: longTextSchema,
    requirementType: requirementTypeSchema,
    priority: requirementPrioritySchema.nullable(),
    epistemicStatus: requirementEpistemicStatusSchema,
    confidenceBand: confidenceBandSchema.nullable(),
    confidenceReasonCodes: z.array(confidenceReasonCodeSchema),
    inferenceBasis: nullableNonEmptyStringSchema,
    origin: analysisArtifactOriginSchema,
    lifecycleState: requirementLifecycleStateSchema,
    dedupeGroupKey: nullableNonEmptyStringSchema,
    parentRequirementId: nullableUuidSchema,
    sourceSummary: nullableNonEmptyStringSchema,
    createdByAiRunId: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    validateEpistemicConfidence(value, ctx);
    if (value.epistemicStatus === "assumed" && value.inferenceBasis === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inferenceBasis"],
        message: "Assumed requirements must include an inference basis.",
      });
    }
  });

export type RequirementResponse = z.infer<typeof requirementResponseSchema>;

export const requirementListFilterSchema = paginationQuerySchema
  .extend({
    requirementType: requirementTypeSchema.optional(),
    priority: requirementPrioritySchema.optional(),
    epistemicStatus: requirementEpistemicStatusSchema.optional(),
    lifecycleState: requirementLifecycleStateSchema.optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type RequirementListFilter = z.infer<typeof requirementListFilterSchema>;

export const requirementListResponseSchema =
  createPaginatedResponseSchema(requirementResponseSchema);

export const citationLocatorSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export const citationResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: organizationIdSchema,
    projectId: projectIdSchema,
    analysisRunId: uuidSchema,
    requirementId: nullableUuidSchema,
    coverageMatrixEntryId: nullableUuidSchema,
    deliveryItemId: nullableUuidSchema,
    sourceDocumentId: uuidSchema,
    sourceVersionNumber: positiveIntSchema,
    sourceContentHash: hashSchema,
    sourceExtractionId: uuidSchema,
    sourceExtractionVersion: positiveIntSchema,
    sourceChunkId: uuidSchema,
    sourceChunkSequence: nonNegativeIntSchema,
    chunkContentHash: hashSchema,
    locator: citationLocatorSchema,
    quoteTextOriginal: mediumTextSchema,
    quoteTextNormalized: mediumTextSchema,
    quoteHash: hashSchema,
    matchStartOffset: nonNegativeIntSchema,
    matchEndOffset: positiveIntSchema,
    normalizationMode: nonEmptyStringSchema,
    verificationStatus: citationVerificationStatusSchema,
    createdByAiRunId: uuidSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const targetCount = [
      value.requirementId,
      value.coverageMatrixEntryId,
      value.deliveryItemId,
    ].filter((id) => id !== null).length;

    if (targetCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requirementId"],
        message: "Exactly one citation target must be set.",
      });
    }

    if (value.matchEndOffset <= value.matchStartOffset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matchEndOffset"],
        message: "matchEndOffset must be greater than matchStartOffset.",
      });
    }
  });

export type CitationResponse = z.infer<typeof citationResponseSchema>;

export const citationListFilterSchema = paginationQuerySchema
  .extend({
    verificationStatus: citationVerificationStatusSchema.optional(),
    requirementId: uuidSchema.optional(),
    coverageMatrixEntryId: uuidSchema.optional(),
    deliveryItemId: uuidSchema.optional(),
    sourceDocumentId: uuidSchema.optional(),
  })
  .strict();

export type CitationListFilter = z.infer<typeof citationListFilterSchema>;

export const citationListResponseSchema = createPaginatedResponseSchema(citationResponseSchema);

export const citationEvidenceResponseSchema = citationResponseSchema
  .extend({
    sourceTitle: nonEmptyStringSchema,
    sourceVersionLabel: nonEmptyStringSchema,
  })
  .strict();

export type CitationEvidenceResponse = z.infer<typeof citationEvidenceResponseSchema>;

export const coverageMatrixEntryResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: organizationIdSchema,
    projectId: projectIdSchema,
    analysisRunId: uuidSchema,
    categoryKey: coverageCategoryKeySchema,
    categoryLabel: nonEmptyStringSchema,
    categoryOrder: positiveIntSchema,
    status: coverageStatusSchema,
    rationale: mediumTextSchema,
    evidenceState: coverageEvidenceStateSchema,
    questionDeliveryItemId: nullableUuidSchema,
    createdByAiRunId: uuidSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type CoverageMatrixEntryResponse = z.infer<typeof coverageMatrixEntryResponseSchema>;

export const coverageListFilterSchema = z
  .object({
    status: coverageStatusSchema.optional(),
    categoryKey: coverageCategoryKeySchema.optional(),
  })
  .strict();

export type CoverageListFilter = z.infer<typeof coverageListFilterSchema>;

export const coverageListResponseSchema = z
  .object({
    items: z.array(coverageMatrixEntryResponseSchema).max(18),
  })
  .strict();

// ---------------------------------------------------------------------------
// Delivery-item discriminated attributes
// ---------------------------------------------------------------------------

export const riskDeliveryItemAttributesSchema = z
  .object({
    category: nonEmptyStringSchema,
    probabilityBand: deliveryItemSeveritySchema,
    impactBand: deliveryItemSeveritySchema,
    mitigationPrompt: mediumTextSchema,
    trigger: mediumTextSchema,
  })
  .strict();

export const assumptionDeliveryItemAttributesSchema = z
  .object({
    inferenceBasis: mediumTextSchema,
    validationNeeded: z.boolean(),
    validationMethod: mediumTextSchema,
  })
  .strict();

export const dependencyDeliveryItemAttributesSchema = z
  .object({
    dependencyName: nonEmptyStringSchema,
    dependencyDirection: dependencyDirectionSchema,
    blockedArea: nonEmptyStringSchema,
    riskIfDelayed: mediumTextSchema,
  })
  .strict();

export const blockerDeliveryItemAttributesSchema = z
  .object({
    subtype: blockerSubtypeSchema,
    contradictionSummary: mediumTextSchema,
    conflictingCitationIds: z.array(uuidSchema).min(2),
    suggestedResolutionQuestion: mediumTextSchema,
  })
  .strict();

export const questionDeliveryItemAttributesSchema = z
  .object({
    questionText: mediumTextSchema,
    whyItMatters: mediumTextSchema,
    suggestedResponseFormat: nonEmptyStringSchema,
    impactIfUnanswered: mediumTextSchema,
    linkedCoverageEntryIds: z.array(uuidSchema),
    linkedRequirementIds: z.array(uuidSchema),
    linkedConflictDeliveryItemIds: z.array(uuidSchema),
  })
  .strict();

export const scopeCreepDeliveryItemAttributesSchema = z
  .object({
    classification: z.literal("scope_creep"),
    changeSource: nonEmptyStringSchema,
    baselineImpactHypothesis: mediumTextSchema,
    approvalNeeded: z.boolean(),
  })
  .strict();

export const outOfScopeDeliveryItemAttributesSchema = z
  .object({
    classification: z.literal("out_of_scope"),
    exclusionBasis: mediumTextSchema,
    supportingRationale: mediumTextSchema,
  })
  .strict();

export const scopeChangeCandidateDeliveryItemAttributesSchema = z.discriminatedUnion(
  "classification",
  [scopeCreepDeliveryItemAttributesSchema, outOfScopeDeliveryItemAttributesSchema],
);

const deliveryItemBaseShape = {
  id: uuidSchema,
  organizationId: organizationIdSchema,
  projectId: projectIdSchema,
  analysisRunId: uuidSchema,
  title: shortTextSchema,
  description: longTextSchema,
  epistemicStatus: requirementEpistemicStatusSchema,
  confidenceBand: confidenceBandSchema.nullable(),
  confidenceReasonCodes: z.array(confidenceReasonCodeSchema),
  severity: deliveryItemSeveritySchema.nullable(),
  priority: deliveryItemPrioritySchema.nullable(),
  status: deliveryItemStatusSchema,
  visibility: deliveryItemVisibilitySchema,
  sourceRequirementId: nullableUuidSchema,
  createdByAiRunId: uuidSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
};

const questionDeliveryItemResponseSchema = z
  .object({
    ...deliveryItemBaseShape,
    itemType: z.literal("question"),
    attributes: questionDeliveryItemAttributesSchema,
  })
  .strict();

const riskDeliveryItemResponseSchema = z
  .object({
    ...deliveryItemBaseShape,
    itemType: z.literal("risk"),
    attributes: riskDeliveryItemAttributesSchema,
  })
  .strict();

const assumptionDeliveryItemResponseSchema = z
  .object({
    ...deliveryItemBaseShape,
    itemType: z.literal("assumption"),
    attributes: assumptionDeliveryItemAttributesSchema,
  })
  .strict();

const dependencyDeliveryItemResponseSchema = z
  .object({
    ...deliveryItemBaseShape,
    itemType: z.literal("dependency"),
    attributes: dependencyDeliveryItemAttributesSchema,
  })
  .strict();

const blockerDeliveryItemResponseSchema = z
  .object({
    ...deliveryItemBaseShape,
    itemType: z.literal("blocker"),
    attributes: blockerDeliveryItemAttributesSchema,
  })
  .strict();

const scopeChangeDeliveryItemResponseSchema = z
  .object({
    ...deliveryItemBaseShape,
    itemType: z.literal("scope_change_candidate"),
    attributes: scopeChangeCandidateDeliveryItemAttributesSchema,
  })
  .strict();

export const deliveryItemResponseSchema = z
  .discriminatedUnion("itemType", [
    questionDeliveryItemResponseSchema,
    riskDeliveryItemResponseSchema,
    assumptionDeliveryItemResponseSchema,
    dependencyDeliveryItemResponseSchema,
    blockerDeliveryItemResponseSchema,
    scopeChangeDeliveryItemResponseSchema,
  ])
  .superRefine((value, ctx) => {
    validateEpistemicConfidence(value, ctx);
  });

export type DeliveryItemResponse = z.infer<typeof deliveryItemResponseSchema>;

export const deliveryItemListFilterSchema = paginationQuerySchema
  .extend({
    itemType: deliveryItemTypeSchema.optional(),
    status: deliveryItemStatusSchema.optional(),
    severity: deliveryItemSeveritySchema.optional(),
    priority: deliveryItemPrioritySchema.optional(),
    sourceRequirementId: uuidSchema.optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type DeliveryItemListFilter = z.infer<typeof deliveryItemListFilterSchema>;

export const deliveryItemListResponseSchema = createPaginatedResponseSchema(
  deliveryItemResponseSchema,
);

export const analysisArtifactsResponseSchema = z
  .object({
    requirements: z.array(requirementResponseSchema),
    deliveryItems: z.array(deliveryItemResponseSchema),
    coverage: z.array(coverageMatrixEntryResponseSchema).max(18),
    citations: z.array(citationResponseSchema),
  })
  .strict();

export type AnalysisArtifactsResponse = z.infer<typeof analysisArtifactsResponseSchema>;
