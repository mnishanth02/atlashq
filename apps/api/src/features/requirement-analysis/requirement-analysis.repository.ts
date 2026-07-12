import {
  citation,
  coverageMatrixEntry,
  deliveryItem,
  organization,
  organizationAiProviderPolicy,
  project,
  referenceArtifact,
  requirement,
  requirementAnalysisBatch,
  requirementAnalysisRun,
  requirementAnalysisSnapshot,
  requirementAnalysisSnapshotSource,
  requirementAnalysisStage,
  sourceChunk,
  sourceDocument,
  sourceExtraction,
  traceabilityLink,
} from "@atlashq/db";
import type { JsonObject } from "@atlashq/types";
import { and, asc, desc, eq, gt, ilike, lt, ne, or, sql } from "drizzle-orm";
import type {
  CitationEvidenceRow,
  CitationListQuery,
  CitationRow,
  CoverageRow,
  DeliveryItemListQuery,
  DeliveryItemRow,
  ListPage,
  ProjectScopeRow,
  ProviderPolicyInsertValues,
  ProviderPolicyListQuery,
  ProviderPolicyRow,
  ReferenceArtifactSummaryRow,
  RequirementAnalysisBatchListQuery,
  RequirementAnalysisBatchRow,
  RequirementAnalysisQueryHandle,
  RequirementAnalysisRepository,
  RequirementAnalysisRunInsertValues,
  RequirementAnalysisRunListQuery,
  RequirementAnalysisRunRow,
  RequirementAnalysisSnapshotRow,
  RequirementAnalysisStageListQuery,
  RequirementAnalysisStageRow,
  RequirementListQuery,
  RequirementRow,
  SourceChunkStatRow,
  SourceDocumentEligibilityRow,
  SourceExtractionSummaryRow,
  TraceabilityLinkRow,
  TraceabilityListQuery,
} from "./requirement-analysis.types.js";
import { paginate, timeRowToCursor } from "./requirement-analysis.utils.js";

const ORG_RUN_CREATION_LOCK_NAMESPACE = 4_103;

const runProjection = {
  id: requirementAnalysisRun.id,
  organizationId: requirementAnalysisRun.organizationId,
  projectId: requirementAnalysisRun.projectId,
  requestedBy: requirementAnalysisRun.requestedBy,
  mode: requirementAnalysisRun.mode,
  status: requirementAnalysisRun.status,
  cancelRequestedAt: requirementAnalysisRun.cancelRequestedAt,
  cancelRequestedBy: requirementAnalysisRun.cancelRequestedBy,
  cancelReason: requirementAnalysisRun.cancelReason,
  sourceSnapshotId: requirementAnalysisRun.sourceSnapshotId,
  replayOfRunId: requirementAnalysisRun.replayOfRunId,
  reprocessOfRunId: requirementAnalysisRun.reprocessOfRunId,
  retryOfRunId: requirementAnalysisRun.retryOfRunId,
  providerPolicyId: requirementAnalysisRun.providerPolicyId,
  provider: requirementAnalysisRun.provider,
  modelAlias: requirementAnalysisRun.modelAlias,
  resolvedModelId: requirementAnalysisRun.resolvedModelId,
  providerDataRetentionMode: requirementAnalysisRun.providerDataRetentionMode,
  promptBundleVersion: requirementAnalysisRun.promptBundleVersion,
  promptBundleHash: requirementAnalysisRun.promptBundleHash,
  schemaBundleVersion: requirementAnalysisRun.schemaBundleVersion,
  schemaBundleHash: requirementAnalysisRun.schemaBundleHash,
  pipelineVersion: requirementAnalysisRun.pipelineVersion,
  pipelineHash: requirementAnalysisRun.pipelineHash,
  modelPolicyHash: requirementAnalysisRun.modelPolicyHash,
  maxUsd: requirementAnalysisRun.maxUsd,
  maxInputTokens: requirementAnalysisRun.maxInputTokens,
  maxOutputTokens: requirementAnalysisRun.maxOutputTokens,
  maxWallClockSeconds: requirementAnalysisRun.maxWallClockSeconds,
  inputTokensUsed: requirementAnalysisRun.inputTokensUsed,
  outputTokensUsed: requirementAnalysisRun.outputTokensUsed,
  costUsd: requirementAnalysisRun.costUsd,
  artifactCounts: requirementAnalysisRun.artifactCounts,
  warningCodes: requirementAnalysisRun.warningCodes,
  failureCode: requirementAnalysisRun.failureCode,
  failureDetail: requirementAnalysisRun.failureDetail,
  failureRetryable: requirementAnalysisRun.failureRetryable,
  failedStageId: requirementAnalysisRun.failedStageId,
  startedAt: requirementAnalysisRun.startedAt,
  completedAt: requirementAnalysisRun.completedAt,
  createdAt: requirementAnalysisRun.createdAt,
  updatedAt: requirementAnalysisRun.updatedAt,
  correlationId: requirementAnalysisRun.correlationId,
} as const;

const providerPolicyProjection = {
  id: organizationAiProviderPolicy.id,
  organizationId: organizationAiProviderPolicy.organizationId,
  provider: organizationAiProviderPolicy.provider,
  policyName: organizationAiProviderPolicy.policyName,
  modelAlias: organizationAiProviderPolicy.modelAlias,
  resolvedModelId: organizationAiProviderPolicy.resolvedModelId,
  dataRetentionMode: organizationAiProviderPolicy.dataRetentionMode,
  status: organizationAiProviderPolicy.status,
  approvedForRequirementAnalysis: organizationAiProviderPolicy.approvedForRequirementAnalysis,
  approvedBy: organizationAiProviderPolicy.approvedBy,
  approvedAt: organizationAiProviderPolicy.approvedAt,
  approvalNote: organizationAiProviderPolicy.approvalNote,
  providerTermsSnapshotHash: organizationAiProviderPolicy.providerTermsSnapshotHash,
  maxUsdPerRun: organizationAiProviderPolicy.maxUsdPerRun,
  maxInputTokensPerRun: organizationAiProviderPolicy.maxInputTokensPerRun,
  maxOutputTokensPerRun: organizationAiProviderPolicy.maxOutputTokensPerRun,
  maxWallClockSeconds: organizationAiProviderPolicy.maxWallClockSeconds,
  createdAt: organizationAiProviderPolicy.createdAt,
  updatedAt: organizationAiProviderPolicy.updatedAt,
  version: organizationAiProviderPolicy.version,
} as const;

const sourceEligibilityProjection = {
  id: sourceDocument.id,
  lineageId: sourceDocument.lineageId,
  isLineageHead: sql<boolean>`not exists (
    select 1
    from "source_document" as successor
    where successor.supersedes_id = ${sourceDocument.id}
  )`,
  versionNumber: sourceDocument.versionNumber,
  sourceType: sourceDocument.sourceType,
  documentFormat: sourceDocument.documentFormat,
  title: sourceDocument.title,
  contentHash: sourceDocument.contentHash,
  processingStatus: sourceDocument.processingStatus,
  archivedAt: sourceDocument.archivedAt,
  createdAt: sourceDocument.createdAt,
} as const;

const snapshotProjection = {
  id: requirementAnalysisSnapshot.id,
  organizationId: requirementAnalysisSnapshot.organizationId,
  projectId: requirementAnalysisSnapshot.projectId,
  runId: requirementAnalysisSnapshot.runId,
  snapshotHash: requirementAnalysisSnapshot.snapshotHash,
  sourceCount: requirementAnalysisSnapshot.sourceCount,
  chunkCount: requirementAnalysisSnapshot.chunkCount,
  totalCharacterCount: requirementAnalysisSnapshot.totalCharacterCount,
  eligibilityRulesVersion: requirementAnalysisSnapshot.eligibilityRulesVersion,
  createdAt: requirementAnalysisSnapshot.createdAt,
} as const;

const stageProjection = {
  id: requirementAnalysisStage.id,
  runId: requirementAnalysisStage.runId,
  organizationId: requirementAnalysisStage.organizationId,
  projectId: requirementAnalysisStage.projectId,
  kind: requirementAnalysisStage.kind,
  status: requirementAnalysisStage.status,
  attemptNumber: requirementAnalysisStage.attemptNumber,
  idempotencyKey: requirementAnalysisStage.idempotencyKey,
  inputHash: requirementAnalysisStage.inputHash,
  outputHash: requirementAnalysisStage.outputHash,
  startedAt: requirementAnalysisStage.startedAt,
  completedAt: requirementAnalysisStage.completedAt,
  retryAfter: requirementAnalysisStage.retryAfter,
  failureCode: requirementAnalysisStage.failureCode,
  failureDetail: requirementAnalysisStage.failureDetail,
  createdAt: requirementAnalysisStage.createdAt,
  updatedAt: requirementAnalysisStage.updatedAt,
} as const;

const batchProjection = {
  id: requirementAnalysisBatch.id,
  stageId: requirementAnalysisBatch.stageId,
  runId: requirementAnalysisBatch.runId,
  organizationId: requirementAnalysisBatch.organizationId,
  projectId: requirementAnalysisBatch.projectId,
  batchOrder: requirementAnalysisBatch.batchOrder,
  sourceChunkStartSequence: requirementAnalysisBatch.sourceChunkStartSequence,
  sourceChunkEndSequence: requirementAnalysisBatch.sourceChunkEndSequence,
  inputTokenEstimate: requirementAnalysisBatch.inputTokenEstimate,
  maxOutputTokens: requirementAnalysisBatch.maxOutputTokens,
  status: requirementAnalysisBatch.status,
  attemptNumber: requirementAnalysisBatch.attemptNumber,
  aiRunId: requirementAnalysisBatch.aiRunId,
  repairOfBatchId: requirementAnalysisBatch.repairOfBatchId,
  shapeOnlyRepairUsed: requirementAnalysisBatch.shapeOnlyRepairUsed,
  cacheKey: requirementAnalysisBatch.cacheKey,
  cacheHitOfBatchId: requirementAnalysisBatch.cacheHitOfBatchId,
  failureCode: requirementAnalysisBatch.failureCode,
  failureDetail: requirementAnalysisBatch.failureDetail,
  createdAt: requirementAnalysisBatch.createdAt,
  updatedAt: requirementAnalysisBatch.updatedAt,
} as const;

const requirementProjection = {
  id: requirement.id,
  organizationId: requirement.organizationId,
  projectId: requirement.projectId,
  analysisRunId: requirement.analysisRunId,
  stableKey: requirement.stableKey,
  title: requirement.title,
  description: requirement.description,
  requirementType: requirement.requirementType,
  priority: requirement.priority,
  epistemicStatus: requirement.epistemicStatus,
  confidenceBand: requirement.confidenceBand,
  confidenceReasonCodes: requirement.confidenceReasonCodes,
  inferenceBasis: requirement.inferenceBasis,
  origin: requirement.origin,
  lifecycleState: requirement.lifecycleState,
  dedupeGroupKey: requirement.dedupeGroupKey,
  parentRequirementId: requirement.parentRequirementId,
  sourceSummary: requirement.sourceSummary,
  createdByAiRunId: requirement.createdByAiRunId,
  createdAt: requirement.createdAt,
  updatedAt: requirement.updatedAt,
} as const;

const deliveryItemProjection = {
  id: deliveryItem.id,
  organizationId: deliveryItem.organizationId,
  projectId: deliveryItem.projectId,
  analysisRunId: deliveryItem.analysisRunId,
  itemType: deliveryItem.itemType,
  title: deliveryItem.title,
  description: deliveryItem.description,
  epistemicStatus: deliveryItem.epistemicStatus,
  confidenceBand: deliveryItem.confidenceBand,
  confidenceReasonCodes: deliveryItem.confidenceReasonCodes,
  severity: deliveryItem.severity,
  priority: deliveryItem.priority,
  status: deliveryItem.status,
  visibility: deliveryItem.visibility,
  attributes: deliveryItem.attributes,
  sourceRequirementId: deliveryItem.sourceRequirementId,
  createdByAiRunId: deliveryItem.createdByAiRunId,
  createdAt: deliveryItem.createdAt,
  updatedAt: deliveryItem.updatedAt,
} as const;

const coverageProjection = {
  id: coverageMatrixEntry.id,
  organizationId: coverageMatrixEntry.organizationId,
  projectId: coverageMatrixEntry.projectId,
  analysisRunId: coverageMatrixEntry.analysisRunId,
  categoryKey: coverageMatrixEntry.categoryKey,
  categoryLabel: coverageMatrixEntry.categoryLabel,
  categoryOrder: coverageMatrixEntry.categoryOrder,
  status: coverageMatrixEntry.status,
  rationale: coverageMatrixEntry.rationale,
  evidenceState: coverageMatrixEntry.evidenceState,
  questionDeliveryItemId: coverageMatrixEntry.questionDeliveryItemId,
  createdByAiRunId: coverageMatrixEntry.createdByAiRunId,
  createdAt: coverageMatrixEntry.createdAt,
} as const;

const citationProjection = {
  id: citation.id,
  organizationId: citation.organizationId,
  projectId: citation.projectId,
  analysisRunId: citation.analysisRunId,
  requirementId: citation.requirementId,
  coverageMatrixEntryId: citation.coverageMatrixEntryId,
  deliveryItemId: citation.deliveryItemId,
  sourceDocumentId: citation.sourceDocumentId,
  sourceVersionNumber: citation.sourceVersionNumber,
  sourceContentHash: citation.sourceContentHash,
  sourceExtractionId: citation.sourceExtractionId,
  sourceExtractionVersion: citation.sourceExtractionVersion,
  sourceChunkId: citation.sourceChunkId,
  sourceChunkSequence: citation.sourceChunkSequence,
  chunkContentHash: citation.chunkContentHash,
  locator: citation.locator,
  quoteTextOriginal: citation.quoteTextOriginal,
  quoteTextNormalized: citation.quoteTextNormalized,
  quoteHash: citation.quoteHash,
  matchStartOffset: citation.matchStartOffset,
  matchEndOffset: citation.matchEndOffset,
  normalizationMode: citation.normalizationMode,
  verificationStatus: citation.verificationStatus,
  createdByAiRunId: citation.createdByAiRunId,
  createdAt: citation.createdAt,
} as const;

const traceabilityProjection = {
  id: traceabilityLink.id,
  organizationId: traceabilityLink.organizationId,
  fromType: traceabilityLink.fromType,
  fromId: traceabilityLink.fromId,
  toType: traceabilityLink.toType,
  toId: traceabilityLink.toId,
  relation: traceabilityLink.relation,
  createdBy: traceabilityLink.createdBy,
  createdAt: traceabilityLink.createdAt,
} as const;

export class DrizzleRequirementAnalysisRepository implements RequirementAnalysisRepository {
  async findOrganizationSettings(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
  ): Promise<JsonObject | null> {
    const rows = await handle
      .select({ settings: organization.settings })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    return (rows[0]?.settings as JsonObject | null | undefined) ?? null;
  }

  async countApprovedProviderPolicies(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
  ): Promise<number> {
    const rows = await handle
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationAiProviderPolicy)
      .where(
        and(
          eq(organizationAiProviderPolicy.organizationId, organizationId),
          eq(organizationAiProviderPolicy.status, "approved"),
          eq(organizationAiProviderPolicy.approvedForRequirementAnalysis, true),
        ),
      );
    return rows[0]?.count ?? 0;
  }

  async listProviderPolicies(
    handle: RequirementAnalysisQueryHandle,
    query: ProviderPolicyListQuery,
  ): Promise<ListPage<ProviderPolicyRow>> {
    const rows = await handle
      .select(providerPolicyProjection)
      .from(organizationAiProviderPolicy)
      .where(
        and(
          eq(organizationAiProviderPolicy.organizationId, query.organizationId),
          query.status ? eq(organizationAiProviderPolicy.status, query.status) : undefined,
          query.provider ? eq(organizationAiProviderPolicy.provider, query.provider) : undefined,
          query.includeInactive ? undefined : ne(organizationAiProviderPolicy.status, "inactive"),
          query.search
            ? or(
                ilike(organizationAiProviderPolicy.policyName, `%${query.search}%`),
                ilike(organizationAiProviderPolicy.modelAlias, `%${query.search}%`),
                ilike(organizationAiProviderPolicy.resolvedModelId, `%${query.search}%`),
              )
            : undefined,
          query.cursor
            ? or(
                lt(organizationAiProviderPolicy.createdAt, new Date(query.cursor.createdAt)),
                and(
                  eq(organizationAiProviderPolicy.createdAt, new Date(query.cursor.createdAt)),
                  lt(organizationAiProviderPolicy.id, query.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(organizationAiProviderPolicy.createdAt), desc(organizationAiProviderPolicy.id))
      .limit(query.limit + 1);

    const page = paginate(rows as ProviderPolicyRow[], query.limit, timeRowToCursor);
    return { items: page.items, pageInfo: page.pageInfo };
  }

  async findProviderPolicyById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    policyId: string,
  ): Promise<ProviderPolicyRow | null> {
    const rows = await handle
      .select(providerPolicyProjection)
      .from(organizationAiProviderPolicy)
      .where(
        and(
          eq(organizationAiProviderPolicy.organizationId, organizationId),
          eq(organizationAiProviderPolicy.id, policyId),
        ),
      )
      .limit(1);
    return (rows[0] as ProviderPolicyRow | undefined) ?? null;
  }

  async insertProviderPolicy(
    handle: RequirementAnalysisQueryHandle,
    values: ProviderPolicyInsertValues,
  ): Promise<ProviderPolicyRow> {
    const rows = await handle
      .insert(organizationAiProviderPolicy)
      .values({
        organizationId: values.organizationId,
        provider: values.provider,
        policyName: values.policyName,
        modelAlias: values.modelAlias,
        resolvedModelId: values.resolvedModelId,
        dataRetentionMode: values.dataRetentionMode,
        status: "draft",
        approvedForRequirementAnalysis: false,
        approvalNote: values.approvalNote,
        providerTermsSnapshotHash: values.providerTermsSnapshotHash,
        maxUsdPerRun: values.maxUsdPerRun,
        maxInputTokensPerRun: values.maxInputTokensPerRun,
        maxOutputTokensPerRun: values.maxOutputTokensPerRun,
        maxWallClockSeconds: values.maxWallClockSeconds,
        createdBy: values.createdBy,
        updatedBy: values.updatedBy,
      })
      .returning(providerPolicyProjection);
    const row = rows[0] as ProviderPolicyRow | undefined;
    if (!row) {
      throw new Error("Provider policy insert did not return the inserted row.");
    }
    return row;
  }

  async approveProviderPolicy(
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
  ): Promise<ProviderPolicyRow | null> {
    const rows = await handle
      .update(organizationAiProviderPolicy)
      .set({
        status: "approved",
        approvedForRequirementAnalysis: true,
        approvedBy: values.approvedBy,
        approvedAt: values.approvedAt,
        approvalNote: values.approvalNote,
        providerTermsSnapshotHash: values.providerTermsSnapshotHash,
        updatedBy: values.updatedBy,
        updatedAt: values.updatedAt,
        version: sql`${organizationAiProviderPolicy.version} + 1`,
      })
      .where(
        and(
          eq(organizationAiProviderPolicy.organizationId, organizationId),
          eq(organizationAiProviderPolicy.id, policyId),
          eq(organizationAiProviderPolicy.version, expectedVersion),
        ),
      )
      .returning(providerPolicyProjection);
    return (rows[0] as ProviderPolicyRow | undefined) ?? null;
  }

  async deactivateProviderPolicy(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    policyId: string,
    expectedVersion: number,
    values: {
      updatedBy: string;
      updatedAt: Date;
    },
  ): Promise<ProviderPolicyRow | null> {
    const rows = await handle
      .update(organizationAiProviderPolicy)
      .set({
        status: "inactive",
        approvedForRequirementAnalysis: false,
        updatedBy: values.updatedBy,
        updatedAt: values.updatedAt,
        version: sql`${organizationAiProviderPolicy.version} + 1`,
      })
      .where(
        and(
          eq(organizationAiProviderPolicy.organizationId, organizationId),
          eq(organizationAiProviderPolicy.id, policyId),
          eq(organizationAiProviderPolicy.version, expectedVersion),
        ),
      )
      .returning(providerPolicyProjection);
    return (rows[0] as ProviderPolicyRow | undefined) ?? null;
  }

  async findProjectScope(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<ProjectScopeRow | null> {
    const rows = await handle
      .select({
        id: project.id,
        organizationId: project.organizationId,
        status: project.status,
        softDeletedAt: project.softDeletedAt,
      })
      .from(project)
      .where(and(eq(project.organizationId, organizationId), eq(project.id, projectId)))
      .limit(1);
    return (rows[0] as ProjectScopeRow | undefined) ?? null;
  }

  async listSourceDocumentsForEligibility(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<SourceDocumentEligibilityRow[]> {
    const rows = await handle
      .select(sourceEligibilityProjection)
      .from(sourceDocument)
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
        ),
      )
      .orderBy(asc(sourceDocument.createdAt), asc(sourceDocument.id));
    return rows as SourceDocumentEligibilityRow[];
  }

  async findSourceDocumentById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    sourceId: string,
  ): Promise<SourceDocumentEligibilityRow | null> {
    const rows = await handle
      .select(sourceEligibilityProjection)
      .from(sourceDocument)
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
          eq(sourceDocument.id, sourceId),
        ),
      )
      .limit(1);
    return (rows[0] as SourceDocumentEligibilityRow | undefined) ?? null;
  }

  async findLineageHead(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    lineageId: string,
  ): Promise<SourceDocumentEligibilityRow | null> {
    const rows = await handle
      .select(sourceEligibilityProjection)
      .from(sourceDocument)
      .where(
        and(
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
          eq(sourceDocument.lineageId, lineageId),
          sql`not exists (
            select 1
            from "source_document" as successor
            where successor.supersedes_id = ${sourceDocument.id}
          )`,
        ),
      )
      .limit(1);
    return (rows[0] as SourceDocumentEligibilityRow | undefined) ?? null;
  }

  async findLatestSuccessfulExtraction(
    handle: RequirementAnalysisQueryHandle,
    sourceDocumentId: string,
  ): Promise<SourceExtractionSummaryRow | null> {
    const rows = await handle
      .select({
        id: sourceExtraction.id,
        sourceDocumentId: sourceExtraction.sourceDocumentId,
        extractionVersion: sourceExtraction.extractionVersion,
        chunkerVersion: sourceExtraction.chunkerVersion,
      })
      .from(sourceExtraction)
      .where(
        and(
          eq(sourceExtraction.sourceDocumentId, sourceDocumentId),
          eq(sourceExtraction.status, "succeeded"),
        ),
      )
      .orderBy(
        desc(sourceExtraction.extractionVersion),
        desc(sourceExtraction.createdAt),
        desc(sourceExtraction.id),
      )
      .limit(1);
    return (rows[0] as SourceExtractionSummaryRow | undefined) ?? null;
  }

  async listOrderedChunks(
    handle: RequirementAnalysisQueryHandle,
    sourceExtractionId: string,
  ): Promise<SourceChunkStatRow[]> {
    const rows = await handle
      .select({
        id: sourceChunk.id,
        sequence: sourceChunk.sequence,
        characterCount: sourceChunk.characterCount,
      })
      .from(sourceChunk)
      .where(eq(sourceChunk.sourceExtractionId, sourceExtractionId))
      .orderBy(asc(sourceChunk.sequence), asc(sourceChunk.id));
    return rows as SourceChunkStatRow[];
  }

  async findReferenceArtifactBySource(
    handle: RequirementAnalysisQueryHandle,
    sourceDocumentId: string,
  ): Promise<ReferenceArtifactSummaryRow | null> {
    const rows = await handle
      .select({
        id: referenceArtifact.id,
        sourceDocumentId: referenceArtifact.sourceDocumentId,
        ipReviewStatus: referenceArtifact.ipReviewStatus,
      })
      .from(referenceArtifact)
      .where(eq(referenceArtifact.sourceDocumentId, sourceDocumentId))
      .limit(1);
    return (rows[0] as ReferenceArtifactSummaryRow | undefined) ?? null;
  }

  async acquireOrganizationRunCreationLock(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
  ): Promise<void> {
    await handle.execute(
      sql`select pg_advisory_xact_lock(${ORG_RUN_CREATION_LOCK_NAMESPACE}, hashtext(${organizationId}))`,
    );
  }

  async countActiveRunsByProject(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    activeStatuses: readonly string[],
  ): Promise<number> {
    const rows = await handle
      .select({ count: sql<number>`count(*)::int` })
      .from(requirementAnalysisRun)
      .where(
        and(
          eq(requirementAnalysisRun.organizationId, organizationId),
          eq(requirementAnalysisRun.projectId, projectId),
          sql`${requirementAnalysisRun.status} in (${sql.join(
            activeStatuses.map((status) => sql`${status}`),
            sql`, `,
          )})`,
        ),
      );
    return rows[0]?.count ?? 0;
  }

  async countActiveRunsByOrganization(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    activeStatuses: readonly string[],
  ): Promise<number> {
    const rows = await handle
      .select({ count: sql<number>`count(*)::int` })
      .from(requirementAnalysisRun)
      .where(
        and(
          eq(requirementAnalysisRun.organizationId, organizationId),
          sql`${requirementAnalysisRun.status} in (${sql.join(
            activeStatuses.map((status) => sql`${status}`),
            sql`, `,
          )})`,
        ),
      );
    return rows[0]?.count ?? 0;
  }

  async findRunByCorrelation(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    correlationId: string,
  ): Promise<RequirementAnalysisRunRow | null> {
    const rows = await handle
      .select(runProjection)
      .from(requirementAnalysisRun)
      .where(
        and(
          eq(requirementAnalysisRun.organizationId, organizationId),
          eq(requirementAnalysisRun.projectId, projectId),
          eq(requirementAnalysisRun.correlationId, correlationId),
        ),
      )
      .orderBy(desc(requirementAnalysisRun.createdAt), desc(requirementAnalysisRun.id))
      .limit(1);
    return (rows[0] as RequirementAnalysisRunRow | undefined) ?? null;
  }

  async findRunById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
  ): Promise<RequirementAnalysisRunRow | null> {
    const rows = await handle
      .select(runProjection)
      .from(requirementAnalysisRun)
      .where(
        and(
          eq(requirementAnalysisRun.organizationId, organizationId),
          eq(requirementAnalysisRun.projectId, projectId),
          eq(requirementAnalysisRun.id, runId),
        ),
      )
      .limit(1);
    return (rows[0] as RequirementAnalysisRunRow | undefined) ?? null;
  }

  async insertRun(
    handle: RequirementAnalysisQueryHandle,
    values: RequirementAnalysisRunInsertValues,
  ): Promise<RequirementAnalysisRunRow> {
    const rows = await handle
      .insert(requirementAnalysisRun)
      .values({
        organizationId: values.organizationId,
        projectId: values.projectId,
        requestedBy: values.requestedBy,
        mode: values.mode,
        status: values.status,
        sourceSnapshotId: values.sourceSnapshotId,
        replayOfRunId: values.replayOfRunId,
        reprocessOfRunId: values.reprocessOfRunId,
        retryOfRunId: values.retryOfRunId,
        providerPolicyId: values.providerPolicyId,
        provider: values.provider,
        modelAlias: values.modelAlias,
        resolvedModelId: values.resolvedModelId,
        providerDataRetentionMode: values.providerDataRetentionMode,
        promptBundleVersion: values.promptBundleVersion,
        promptBundleHash: values.promptBundleHash,
        schemaBundleVersion: values.schemaBundleVersion,
        schemaBundleHash: values.schemaBundleHash,
        pipelineVersion: values.pipelineVersion,
        pipelineHash: values.pipelineHash,
        modelPolicyHash: values.modelPolicyHash,
        maxUsd: values.maxUsd,
        maxInputTokens: values.maxInputTokens,
        maxOutputTokens: values.maxOutputTokens,
        maxWallClockSeconds: values.maxWallClockSeconds,
        correlationId: values.correlationId,
      })
      .returning(runProjection);
    const row = rows[0] as RequirementAnalysisRunRow | undefined;
    if (!row) {
      throw new Error("Requirement-analysis run insert did not return the inserted row.");
    }
    return row;
  }

  async markRunQueueFailure(
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
  ): Promise<RequirementAnalysisRunRow | null> {
    const rows = await handle
      .update(requirementAnalysisRun)
      .set({
        status: "failed",
        failureCode: values.failureCode,
        failureDetail: values.failureDetail,
        failureRetryable: true,
        completedAt: values.completedAt,
        updatedAt: values.updatedAt,
      })
      .where(
        and(
          eq(requirementAnalysisRun.organizationId, organizationId),
          eq(requirementAnalysisRun.projectId, projectId),
          eq(requirementAnalysisRun.id, runId),
        ),
      )
      .returning(runProjection);
    return (rows[0] as RequirementAnalysisRunRow | undefined) ?? null;
  }

  async requestRunCancellation(
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
  ): Promise<RequirementAnalysisRunRow | null> {
    const rows = await handle
      .update(requirementAnalysisRun)
      .set({
        cancelRequestedAt: values.cancelRequestedAt,
        cancelRequestedBy: values.cancelRequestedBy,
        cancelReason: values.cancelReason,
        updatedAt: values.updatedAt,
      })
      .where(
        and(
          eq(requirementAnalysisRun.organizationId, organizationId),
          eq(requirementAnalysisRun.projectId, projectId),
          eq(requirementAnalysisRun.id, runId),
        ),
      )
      .returning(runProjection);
    return (rows[0] as RequirementAnalysisRunRow | undefined) ?? null;
  }

  async listRuns(
    handle: RequirementAnalysisQueryHandle,
    query: RequirementAnalysisRunListQuery,
  ): Promise<ListPage<RequirementAnalysisRunRow>> {
    const rows = await handle
      .select(runProjection)
      .from(requirementAnalysisRun)
      .where(
        and(
          eq(requirementAnalysisRun.organizationId, query.organizationId),
          eq(requirementAnalysisRun.projectId, query.projectId),
          query.status ? eq(requirementAnalysisRun.status, query.status) : undefined,
          query.mode ? eq(requirementAnalysisRun.mode, query.mode) : undefined,
          query.requestedBy ? eq(requirementAnalysisRun.requestedBy, query.requestedBy) : undefined,
          query.providerPolicyId
            ? eq(requirementAnalysisRun.providerPolicyId, query.providerPolicyId)
            : undefined,
          query.createdAfter
            ? gt(requirementAnalysisRun.createdAt, new Date(query.createdAfter))
            : undefined,
          query.createdBefore
            ? lt(requirementAnalysisRun.createdAt, new Date(query.createdBefore))
            : undefined,
          query.cursor
            ? or(
                lt(requirementAnalysisRun.createdAt, new Date(query.cursor.createdAt)),
                and(
                  eq(requirementAnalysisRun.createdAt, new Date(query.cursor.createdAt)),
                  lt(requirementAnalysisRun.id, query.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(requirementAnalysisRun.createdAt), desc(requirementAnalysisRun.id))
      .limit(query.limit + 1);

    const page = paginate(rows as RequirementAnalysisRunRow[], query.limit, timeRowToCursor);
    return { items: page.items, pageInfo: page.pageInfo };
  }

  async findSnapshotByRunId(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
  ): Promise<RequirementAnalysisSnapshotRow | null> {
    const rows = await handle
      .select(snapshotProjection)
      .from(requirementAnalysisSnapshot)
      .where(
        and(
          eq(requirementAnalysisSnapshot.organizationId, organizationId),
          eq(requirementAnalysisSnapshot.projectId, projectId),
          eq(requirementAnalysisSnapshot.runId, runId),
        ),
      )
      .limit(1);
    return (rows[0] as RequirementAnalysisSnapshotRow | undefined) ?? null;
  }

  async listSnapshotSourceDocumentIds(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    snapshotId: string,
  ): Promise<string[]> {
    const rows = await handle
      .select({ sourceDocumentId: requirementAnalysisSnapshotSource.sourceDocumentId })
      .from(requirementAnalysisSnapshotSource)
      .where(
        and(
          eq(requirementAnalysisSnapshotSource.organizationId, organizationId),
          eq(requirementAnalysisSnapshotSource.projectId, projectId),
          eq(requirementAnalysisSnapshotSource.snapshotId, snapshotId),
        ),
      )
      .orderBy(
        asc(requirementAnalysisSnapshotSource.sourceOrder),
        asc(requirementAnalysisSnapshotSource.id),
      );
    return rows.map((row) => row.sourceDocumentId);
  }

  async listStages(
    handle: RequirementAnalysisQueryHandle,
    query: RequirementAnalysisStageListQuery,
  ): Promise<ListPage<RequirementAnalysisStageRow>> {
    const rows = await handle
      .select(stageProjection)
      .from(requirementAnalysisStage)
      .where(
        and(
          eq(requirementAnalysisStage.organizationId, query.organizationId),
          eq(requirementAnalysisStage.projectId, query.projectId),
          eq(requirementAnalysisStage.runId, query.runId),
          query.status ? eq(requirementAnalysisStage.status, query.status) : undefined,
          query.kind ? eq(requirementAnalysisStage.kind, query.kind) : undefined,
          query.cursor
            ? or(
                lt(requirementAnalysisStage.createdAt, new Date(query.cursor.createdAt)),
                and(
                  eq(requirementAnalysisStage.createdAt, new Date(query.cursor.createdAt)),
                  lt(requirementAnalysisStage.id, query.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(requirementAnalysisStage.createdAt), desc(requirementAnalysisStage.id))
      .limit(query.limit + 1);

    const page = paginate(rows as RequirementAnalysisStageRow[], query.limit, timeRowToCursor);
    return { items: page.items, pageInfo: page.pageInfo };
  }

  async listBatches(
    handle: RequirementAnalysisQueryHandle,
    query: RequirementAnalysisBatchListQuery,
  ): Promise<ListPage<RequirementAnalysisBatchRow>> {
    const rows = await handle
      .select(batchProjection)
      .from(requirementAnalysisBatch)
      .where(
        and(
          eq(requirementAnalysisBatch.organizationId, query.organizationId),
          eq(requirementAnalysisBatch.projectId, query.projectId),
          eq(requirementAnalysisBatch.runId, query.runId),
          query.stageId ? eq(requirementAnalysisBatch.stageId, query.stageId) : undefined,
          query.status ? eq(requirementAnalysisBatch.status, query.status) : undefined,
          query.cursor
            ? or(
                lt(requirementAnalysisBatch.createdAt, new Date(query.cursor.createdAt)),
                and(
                  eq(requirementAnalysisBatch.createdAt, new Date(query.cursor.createdAt)),
                  lt(requirementAnalysisBatch.id, query.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(requirementAnalysisBatch.createdAt), desc(requirementAnalysisBatch.id))
      .limit(query.limit + 1);

    const page = paginate(rows as RequirementAnalysisBatchRow[], query.limit, timeRowToCursor);
    return { items: page.items, pageInfo: page.pageInfo };
  }

  async listRequirements(
    handle: RequirementAnalysisQueryHandle,
    query: RequirementListQuery,
  ): Promise<ListPage<RequirementRow>> {
    const rows = await handle
      .select(requirementProjection)
      .from(requirement)
      .where(
        and(
          eq(requirement.organizationId, query.organizationId),
          eq(requirement.projectId, query.projectId),
          eq(requirement.analysisRunId, query.runId),
          query.requirementType
            ? eq(requirement.requirementType, query.requirementType)
            : undefined,
          query.priority ? eq(requirement.priority, query.priority) : undefined,
          query.epistemicStatus
            ? eq(requirement.epistemicStatus, query.epistemicStatus)
            : undefined,
          query.lifecycleState ? eq(requirement.lifecycleState, query.lifecycleState) : undefined,
          query.search
            ? or(
                ilike(requirement.title, `%${query.search}%`),
                ilike(requirement.description, `%${query.search}%`),
              )
            : undefined,
          query.cursor
            ? or(
                lt(requirement.createdAt, new Date(query.cursor.createdAt)),
                and(
                  eq(requirement.createdAt, new Date(query.cursor.createdAt)),
                  lt(requirement.id, query.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(requirement.createdAt), desc(requirement.id))
      .limit(query.limit + 1);

    const page = paginate(rows as RequirementRow[], query.limit, timeRowToCursor);
    return { items: page.items, pageInfo: page.pageInfo };
  }

  async findRequirementById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    requirementId: string,
  ): Promise<RequirementRow | null> {
    const rows = await handle
      .select(requirementProjection)
      .from(requirement)
      .where(
        and(
          eq(requirement.organizationId, organizationId),
          eq(requirement.projectId, projectId),
          eq(requirement.analysisRunId, runId),
          eq(requirement.id, requirementId),
        ),
      )
      .limit(1);
    return (rows[0] as RequirementRow | undefined) ?? null;
  }

  async listDeliveryItems(
    handle: RequirementAnalysisQueryHandle,
    query: DeliveryItemListQuery,
  ): Promise<ListPage<DeliveryItemRow>> {
    const rows = await handle
      .select(deliveryItemProjection)
      .from(deliveryItem)
      .where(
        and(
          eq(deliveryItem.organizationId, query.organizationId),
          eq(deliveryItem.projectId, query.projectId),
          eq(deliveryItem.analysisRunId, query.runId),
          query.itemType ? eq(deliveryItem.itemType, query.itemType) : undefined,
          query.status ? eq(deliveryItem.status, query.status) : undefined,
          query.severity ? eq(deliveryItem.severity, query.severity) : undefined,
          query.priority ? eq(deliveryItem.priority, query.priority) : undefined,
          query.sourceRequirementId
            ? eq(deliveryItem.sourceRequirementId, query.sourceRequirementId)
            : undefined,
          query.search
            ? or(
                ilike(deliveryItem.title, `%${query.search}%`),
                ilike(deliveryItem.description, `%${query.search}%`),
              )
            : undefined,
          query.cursor
            ? or(
                lt(deliveryItem.createdAt, new Date(query.cursor.createdAt)),
                and(
                  eq(deliveryItem.createdAt, new Date(query.cursor.createdAt)),
                  lt(deliveryItem.id, query.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(deliveryItem.createdAt), desc(deliveryItem.id))
      .limit(query.limit + 1);

    const page = paginate(rows as DeliveryItemRow[], query.limit, timeRowToCursor);
    return { items: page.items, pageInfo: page.pageInfo };
  }

  async findDeliveryItemById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    itemId: string,
  ): Promise<DeliveryItemRow | null> {
    const rows = await handle
      .select(deliveryItemProjection)
      .from(deliveryItem)
      .where(
        and(
          eq(deliveryItem.organizationId, organizationId),
          eq(deliveryItem.projectId, projectId),
          eq(deliveryItem.analysisRunId, runId),
          eq(deliveryItem.id, itemId),
        ),
      )
      .limit(1);
    return (rows[0] as DeliveryItemRow | undefined) ?? null;
  }

  async listCoverageEntries(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    filters: { status?: string; categoryKey?: string },
  ): Promise<CoverageRow[]> {
    const rows = await handle
      .select(coverageProjection)
      .from(coverageMatrixEntry)
      .where(
        and(
          eq(coverageMatrixEntry.organizationId, organizationId),
          eq(coverageMatrixEntry.projectId, projectId),
          eq(coverageMatrixEntry.analysisRunId, runId),
          filters.status ? eq(coverageMatrixEntry.status, filters.status) : undefined,
          filters.categoryKey
            ? eq(coverageMatrixEntry.categoryKey, filters.categoryKey)
            : undefined,
        ),
      )
      .orderBy(asc(coverageMatrixEntry.categoryOrder), asc(coverageMatrixEntry.id));
    return rows as CoverageRow[];
  }

  async listCitations(
    handle: RequirementAnalysisQueryHandle,
    query: CitationListQuery,
  ): Promise<ListPage<CitationRow>> {
    const rows = await handle
      .select(citationProjection)
      .from(citation)
      .where(
        and(
          eq(citation.organizationId, query.organizationId),
          eq(citation.projectId, query.projectId),
          eq(citation.analysisRunId, query.runId),
          query.verificationStatus
            ? eq(citation.verificationStatus, query.verificationStatus)
            : undefined,
          query.requirementId ? eq(citation.requirementId, query.requirementId) : undefined,
          query.coverageMatrixEntryId
            ? eq(citation.coverageMatrixEntryId, query.coverageMatrixEntryId)
            : undefined,
          query.deliveryItemId ? eq(citation.deliveryItemId, query.deliveryItemId) : undefined,
          query.sourceDocumentId
            ? eq(citation.sourceDocumentId, query.sourceDocumentId)
            : undefined,
          query.cursor
            ? or(
                lt(citation.createdAt, new Date(query.cursor.createdAt)),
                and(
                  eq(citation.createdAt, new Date(query.cursor.createdAt)),
                  lt(citation.id, query.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(citation.createdAt), desc(citation.id))
      .limit(query.limit + 1);

    const page = paginate(rows as CitationRow[], query.limit, timeRowToCursor);
    return { items: page.items, pageInfo: page.pageInfo };
  }

  async findCitationEvidenceById(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
    citationId: string,
  ): Promise<CitationEvidenceRow | null> {
    const rows = await handle
      .select({
        ...citationProjection,
        sourceTitle: sourceDocument.title,
        sourceVersionLabel: sql<string>`concat('v', ${sourceDocument.versionNumber}::text)`,
      })
      .from(citation)
      .innerJoin(
        sourceDocument,
        and(
          eq(sourceDocument.id, citation.sourceDocumentId),
          eq(sourceDocument.organizationId, organizationId),
          eq(sourceDocument.projectId, projectId),
        ),
      )
      .where(
        and(
          eq(citation.organizationId, organizationId),
          eq(citation.projectId, projectId),
          eq(citation.analysisRunId, runId),
          eq(citation.id, citationId),
        ),
      )
      .limit(1);
    return (rows[0] as CitationEvidenceRow | undefined) ?? null;
  }

  async listTraceabilityLinks(
    handle: RequirementAnalysisQueryHandle,
    query: TraceabilityListQuery,
  ): Promise<ListPage<TraceabilityLinkRow>> {
    const rows = await handle
      .select(traceabilityProjection)
      .from(traceabilityLink)
      .where(
        and(
          eq(traceabilityLink.organizationId, query.organizationId),
          or(
            and(
              eq(traceabilityLink.fromType, "requirement_analysis_run"),
              eq(traceabilityLink.fromId, query.runId),
            ),
            and(
              eq(traceabilityLink.toType, "requirement_analysis_run"),
              eq(traceabilityLink.toId, query.runId),
            ),
          ),
          query.relation ? eq(traceabilityLink.relation, query.relation) : undefined,
          query.cursor
            ? or(
                lt(traceabilityLink.createdAt, new Date(query.cursor.createdAt)),
                and(
                  eq(traceabilityLink.createdAt, new Date(query.cursor.createdAt)),
                  lt(traceabilityLink.id, query.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(traceabilityLink.createdAt), desc(traceabilityLink.id))
      .limit(query.limit + 1);

    const page = paginate(rows as TraceabilityLinkRow[], query.limit, timeRowToCursor);
    return { items: page.items, pageInfo: page.pageInfo };
  }

  async insertTraceabilityLink(
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
  ): Promise<TraceabilityLinkRow> {
    const rows = await handle
      .insert(traceabilityLink)
      .values({
        organizationId: values.organizationId,
        fromType: values.fromType,
        fromId: values.fromId,
        toType: values.toType,
        toId: values.toId,
        relation: values.relation,
        createdBy: values.createdBy,
      })
      .returning(traceabilityProjection);
    const row = rows[0] as TraceabilityLinkRow | undefined;
    if (!row) {
      throw new Error("Traceability link insert did not return the inserted row.");
    }
    return row;
  }
}
