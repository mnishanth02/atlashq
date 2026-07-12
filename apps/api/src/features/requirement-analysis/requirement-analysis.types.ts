import type { Database } from "@atlashq/db";
import type { JsonObject } from "@atlashq/types";
import type {
  AnalysisBatchListFilter,
  AnalysisRunListFilter,
  AnalysisStageListFilter,
  CitationListFilter,
  DeliveryItemListFilter,
  PaginationMeta,
  ProviderPolicyListFilter,
  RequirementListFilter,
} from "@atlashq/validators";

export type RequirementAnalysisQueryHandle = Pick<
  Database,
  "select" | "insert" | "update" | "delete" | "execute"
>;

export type TimeCursor = {
  createdAt: string;
  id: string;
};

export type ListPage<Item> = {
  items: Item[];
  pageInfo: PaginationMeta;
};

export type ProviderPolicyRow = {
  id: string;
  organizationId: string;
  provider: string;
  policyName: string;
  modelAlias: string;
  resolvedModelId: string;
  dataRetentionMode: string;
  status: string;
  approvedForRequirementAnalysis: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  approvalNote: string | null;
  providerTermsSnapshotHash: string | null;
  maxUsdPerRun: number;
  maxInputTokensPerRun: number;
  maxOutputTokensPerRun: number;
  maxWallClockSeconds: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ProviderPolicyInsertValues = {
  organizationId: string;
  provider: string;
  policyName: string;
  modelAlias: string;
  resolvedModelId: string;
  dataRetentionMode: string;
  approvalNote: string | null;
  providerTermsSnapshotHash: string | null;
  maxUsdPerRun: number;
  maxInputTokensPerRun: number;
  maxOutputTokensPerRun: number;
  maxWallClockSeconds: number;
  createdBy: string;
  updatedBy: string;
};

export type ProviderPolicyListQuery = Omit<ProviderPolicyListFilter, "cursor"> & {
  organizationId: string;
  cursor?: TimeCursor;
};

export type ProjectScopeRow = {
  id: string;
  organizationId: string;
  status: string;
  softDeletedAt: Date | null;
};

export type SourceDocumentEligibilityRow = {
  id: string;
  lineageId: string;
  isLineageHead: boolean;
  versionNumber: number;
  sourceType: string;
  documentFormat: string | null;
  title: string;
  contentHash: string;
  processingStatus: string;
  archivedAt: Date | null;
  createdAt: Date;
};

export type SourceExtractionSummaryRow = {
  id: string;
  sourceDocumentId: string;
  extractionVersion: number;
  chunkerVersion: string;
};

export type SourceChunkStatRow = {
  id: string;
  sequence: number;
  characterCount: number;
};

export type ReferenceArtifactSummaryRow = {
  id: string;
  sourceDocumentId: string;
  ipReviewStatus: string;
};

export type RequirementAnalysisRunRow = {
  id: string;
  organizationId: string;
  projectId: string;
  requestedBy: string;
  mode: string;
  status: string;
  cancelRequestedAt: Date | null;
  cancelRequestedBy: string | null;
  cancelReason: string | null;
  sourceSnapshotId: string | null;
  replayOfRunId: string | null;
  reprocessOfRunId: string | null;
  retryOfRunId: string | null;
  providerPolicyId: string;
  provider: string;
  modelAlias: string;
  resolvedModelId: string;
  providerDataRetentionMode: string;
  promptBundleVersion: string;
  promptBundleHash: string;
  schemaBundleVersion: string;
  schemaBundleHash: string;
  pipelineVersion: string;
  pipelineHash: string;
  modelPolicyHash: string;
  maxUsd: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxWallClockSeconds: number;
  inputTokensUsed: number;
  outputTokensUsed: number;
  costUsd: number;
  artifactCounts: JsonObject;
  warningCodes: string[];
  failureCode: string | null;
  failureDetail: string | null;
  failureRetryable: boolean | null;
  failedStageId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  correlationId: string;
};

export type RequirementAnalysisRunInsertValues = {
  organizationId: string;
  projectId: string;
  requestedBy: string;
  mode: string;
  status: string;
  sourceSnapshotId: string | null;
  replayOfRunId: string | null;
  reprocessOfRunId: string | null;
  retryOfRunId: string | null;
  providerPolicyId: string;
  provider: string;
  modelAlias: string;
  resolvedModelId: string;
  providerDataRetentionMode: string;
  promptBundleVersion: string;
  promptBundleHash: string;
  schemaBundleVersion: string;
  schemaBundleHash: string;
  pipelineVersion: string;
  pipelineHash: string;
  modelPolicyHash: string;
  maxUsd: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxWallClockSeconds: number;
  correlationId: string;
};

export type RequirementAnalysisSnapshotRow = {
  id: string;
  organizationId: string;
  projectId: string;
  runId: string;
  snapshotHash: string;
  sourceCount: number;
  chunkCount: number;
  totalCharacterCount: number;
  eligibilityRulesVersion: string;
  createdAt: Date;
};

export type RequirementAnalysisRunListQuery = Omit<AnalysisRunListFilter, "cursor"> & {
  organizationId: string;
  projectId: string;
  cursor?: TimeCursor;
};

export type RequirementAnalysisStageRow = {
  id: string;
  runId: string;
  organizationId: string;
  projectId: string;
  kind: string;
  status: string;
  attemptNumber: number;
  idempotencyKey: string;
  inputHash: string | null;
  outputHash: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  retryAfter: Date | null;
  failureCode: string | null;
  failureDetail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RequirementAnalysisStageListQuery = Omit<AnalysisStageListFilter, "cursor"> & {
  organizationId: string;
  projectId: string;
  runId: string;
  cursor?: TimeCursor;
};

export type RequirementAnalysisBatchRow = {
  id: string;
  stageId: string;
  runId: string;
  organizationId: string;
  projectId: string;
  batchOrder: number;
  sourceChunkStartSequence: number;
  sourceChunkEndSequence: number;
  inputTokenEstimate: number;
  maxOutputTokens: number;
  status: string;
  attemptNumber: number;
  aiRunId: string | null;
  repairOfBatchId: string | null;
  shapeOnlyRepairUsed: boolean;
  cacheKey: string | null;
  cacheHitOfBatchId: string | null;
  failureCode: string | null;
  failureDetail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RequirementAnalysisBatchListQuery = Omit<AnalysisBatchListFilter, "cursor"> & {
  organizationId: string;
  projectId: string;
  runId: string;
  cursor?: TimeCursor;
};

export type RequirementRow = {
  id: string;
  organizationId: string;
  projectId: string;
  analysisRunId: string;
  stableKey: string;
  title: string;
  description: string | null;
  requirementType: string;
  priority: string | null;
  epistemicStatus: string;
  confidenceBand: string | null;
  confidenceReasonCodes: string[];
  inferenceBasis: string | null;
  origin: string;
  lifecycleState: string;
  dedupeGroupKey: string | null;
  parentRequirementId: string | null;
  sourceSummary: string | null;
  createdByAiRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RequirementListQuery = Omit<RequirementListFilter, "cursor"> & {
  organizationId: string;
  projectId: string;
  runId: string;
  cursor?: TimeCursor;
};

export type DeliveryItemRow = {
  id: string;
  organizationId: string;
  projectId: string;
  analysisRunId: string;
  itemType: string;
  title: string;
  description: string | null;
  epistemicStatus: string;
  confidenceBand: string | null;
  confidenceReasonCodes: string[];
  severity: string | null;
  priority: string | null;
  status: string;
  visibility: string;
  attributes: JsonObject;
  sourceRequirementId: string | null;
  createdByAiRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DeliveryItemListQuery = Omit<DeliveryItemListFilter, "cursor"> & {
  organizationId: string;
  projectId: string;
  runId: string;
  cursor?: TimeCursor;
};

export type CoverageRow = {
  id: string;
  organizationId: string;
  projectId: string;
  analysisRunId: string;
  categoryKey: string;
  categoryLabel: string;
  categoryOrder: number;
  status: string;
  rationale: string | null;
  evidenceState: string;
  questionDeliveryItemId: string | null;
  createdByAiRunId: string | null;
  createdAt: Date;
};

export type CitationRow = {
  id: string;
  organizationId: string;
  projectId: string;
  analysisRunId: string;
  requirementId: string | null;
  coverageMatrixEntryId: string | null;
  deliveryItemId: string | null;
  sourceDocumentId: string;
  sourceVersionNumber: number;
  sourceContentHash: string;
  sourceExtractionId: string;
  sourceExtractionVersion: number;
  sourceChunkId: string;
  sourceChunkSequence: number;
  chunkContentHash: string;
  locator: JsonObject;
  quoteTextOriginal: string;
  quoteTextNormalized: string;
  quoteHash: string;
  matchStartOffset: number;
  matchEndOffset: number;
  normalizationMode: string;
  verificationStatus: string;
  createdByAiRunId: string | null;
  createdAt: Date;
};

export type CitationEvidenceRow = CitationRow & {
  sourceTitle: string;
  sourceVersionLabel: string;
};

export type CitationListQuery = Omit<CitationListFilter, "cursor"> & {
  organizationId: string;
  projectId: string;
  runId: string;
  cursor?: TimeCursor;
};

export type TraceabilityLinkRow = {
  id: string;
  organizationId: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
  createdBy: string | null;
  createdAt: Date;
};

export type TraceabilityListQuery = {
  organizationId: string;
  runId: string;
  relation?: string;
  cursor?: TimeCursor;
  limit: number;
};

export interface RequirementAnalysisRepository {
  findOrganizationSettings(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
  ): Promise<JsonObject | null>;

  countApprovedProviderPolicies(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
  ): Promise<number>;

  listProviderPolicies(
    handle: RequirementAnalysisQueryHandle,
    query: ProviderPolicyListQuery,
  ): Promise<ListPage<ProviderPolicyRow>>;

  findProviderPolicyById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    policyId: string,
  ): Promise<ProviderPolicyRow | null>;

  insertProviderPolicy(
    handle: RequirementAnalysisQueryHandle,
    values: ProviderPolicyInsertValues,
  ): Promise<ProviderPolicyRow>;

  approveProviderPolicy(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    policyId: string,
    expectedVersion: number,
    values: {
      approvedBy: string;
      approvedAt: Date;
      approvalNote: string;
      providerTermsSnapshotHash: string | null;
      updatedBy: string;
      updatedAt: Date;
    },
  ): Promise<ProviderPolicyRow | null>;

  deactivateProviderPolicy(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    policyId: string,
    expectedVersion: number,
    values: {
      updatedBy: string;
      updatedAt: Date;
    },
  ): Promise<ProviderPolicyRow | null>;

  findProjectScope(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<ProjectScopeRow | null>;

  listSourceDocumentsForEligibility(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<SourceDocumentEligibilityRow[]>;

  findSourceDocumentById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    sourceId: string,
  ): Promise<SourceDocumentEligibilityRow | null>;

  findLineageHead(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    lineageId: string,
  ): Promise<SourceDocumentEligibilityRow | null>;

  findLatestSuccessfulExtraction(
    handle: RequirementAnalysisQueryHandle,
    sourceDocumentId: string,
  ): Promise<SourceExtractionSummaryRow | null>;

  listOrderedChunks(
    handle: RequirementAnalysisQueryHandle,
    sourceExtractionId: string,
  ): Promise<SourceChunkStatRow[]>;

  findReferenceArtifactBySource(
    handle: RequirementAnalysisQueryHandle,
    sourceDocumentId: string,
  ): Promise<ReferenceArtifactSummaryRow | null>;

  acquireOrganizationRunCreationLock(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
  ): Promise<void>;

  countActiveRunsByProject(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    activeStatuses: readonly string[],
  ): Promise<number>;

  countActiveRunsByOrganization(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    activeStatuses: readonly string[],
  ): Promise<number>;

  findRunByCorrelation(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    correlationId: string,
  ): Promise<RequirementAnalysisRunRow | null>;

  findRunById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
  ): Promise<RequirementAnalysisRunRow | null>;

  insertRun(
    handle: RequirementAnalysisQueryHandle,
    values: RequirementAnalysisRunInsertValues,
  ): Promise<RequirementAnalysisRunRow>;

  markRunQueueFailure(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    values: {
      failureCode: string;
      failureDetail: string;
      updatedAt: Date;
      completedAt: Date;
    },
  ): Promise<RequirementAnalysisRunRow | null>;

  requestRunCancellation(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    values: {
      cancelRequestedAt: Date;
      cancelRequestedBy: string;
      cancelReason: string | null;
      updatedAt: Date;
    },
  ): Promise<RequirementAnalysisRunRow | null>;

  listRuns(
    handle: RequirementAnalysisQueryHandle,
    query: RequirementAnalysisRunListQuery,
  ): Promise<ListPage<RequirementAnalysisRunRow>>;

  findSnapshotByRunId(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
  ): Promise<RequirementAnalysisSnapshotRow | null>;

  listSnapshotSourceDocumentIds(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    snapshotId: string,
  ): Promise<string[]>;

  listStages(
    handle: RequirementAnalysisQueryHandle,
    query: RequirementAnalysisStageListQuery,
  ): Promise<ListPage<RequirementAnalysisStageRow>>;

  listBatches(
    handle: RequirementAnalysisQueryHandle,
    query: RequirementAnalysisBatchListQuery,
  ): Promise<ListPage<RequirementAnalysisBatchRow>>;

  listRequirements(
    handle: RequirementAnalysisQueryHandle,
    query: RequirementListQuery,
  ): Promise<ListPage<RequirementRow>>;

  findRequirementById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    requirementId: string,
  ): Promise<RequirementRow | null>;

  listDeliveryItems(
    handle: RequirementAnalysisQueryHandle,
    query: DeliveryItemListQuery,
  ): Promise<ListPage<DeliveryItemRow>>;

  findDeliveryItemById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    itemId: string,
  ): Promise<DeliveryItemRow | null>;

  listCoverageEntries(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    filters: { status?: string; categoryKey?: string },
  ): Promise<CoverageRow[]>;

  listCitations(
    handle: RequirementAnalysisQueryHandle,
    query: CitationListQuery,
  ): Promise<ListPage<CitationRow>>;

  findCitationEvidenceById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    citationId: string,
  ): Promise<CitationEvidenceRow | null>;

  listTraceabilityLinks(
    handle: RequirementAnalysisQueryHandle,
    query: TraceabilityListQuery,
  ): Promise<ListPage<TraceabilityLinkRow>>;

  insertTraceabilityLink(
    handle: RequirementAnalysisQueryHandle,
    values: {
      organizationId: string;
      fromType: string;
      fromId: string;
      toType: string;
      toId: string;
      relation: string;
      createdBy: string;
    },
  ): Promise<TraceabilityLinkRow>;
}
