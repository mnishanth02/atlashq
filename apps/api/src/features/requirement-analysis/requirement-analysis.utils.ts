import type { JsonObject } from "@atlashq/types";
import {
  analysisBatchResponseSchema,
  analysisRunDetailResponseSchema,
  analysisRunSummaryResponseSchema,
  analysisStageResponseSchema,
  citationEvidenceResponseSchema,
  citationResponseSchema,
  coverageMatrixEntryResponseSchema,
  deliveryItemResponseSchema,
  isoDateTimeSchema,
  providerPolicyResponseSchema,
  requirementResponseSchema,
  uuidSchema,
} from "@atlashq/validators";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type {
  CitationEvidenceRow,
  CitationRow,
  CoverageRow,
  DeliveryItemRow,
  ProviderPolicyRow,
  RequirementAnalysisBatchRow,
  RequirementAnalysisRunRow,
  RequirementAnalysisSnapshotRow,
  RequirementAnalysisStageRow,
  RequirementRow,
  TimeCursor,
  TraceabilityLinkRow,
} from "./requirement-analysis.types.js";

const cursorSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    id: uuidSchema,
  })
  .strict();

export function encodeTimeCursor(cursor: TimeCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeTimeCursor(
  cursor: string,
  message = "Invalid requirement-analysis cursor.",
): TimeCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return cursorSchema.parse(parsed);
  } catch {
    throw new BadRequestException(message);
  }
}

export function timeRowToCursor(row: { createdAt: Date; id: string }): string {
  return encodeTimeCursor({ createdAt: row.createdAt.toISOString(), id: row.id });
}

export function paginate<Item>(rows: Item[], limit: number, toCursor: (item: Item) => string) {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = items[items.length - 1];
  return {
    items,
    pageInfo: {
      limit,
      hasMore,
      nextCursor: hasMore && last ? toCursor(last) : null,
    },
  };
}

function normalizeNullableNonEmpty(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNonEmpty(value: string | null, fallback: string): string {
  const normalized = normalizeNullableNonEmpty(value);
  return normalized ?? fallback;
}

function toArtifactCounts(value: JsonObject): {
  requirements: number;
  citations: number;
  coverageEntries: number;
  deliveryItems: number;
} {
  const readCount = (key: string) => {
    const raw = value[key];
    return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
  };
  return {
    requirements: readCount("requirements"),
    citations: readCount("citations"),
    coverageEntries: readCount("coverageEntries"),
    deliveryItems: readCount("deliveryItems"),
  };
}

function toSnapshotDescriptor(snapshot: RequirementAnalysisSnapshotRow) {
  return {
    id: snapshot.id,
    snapshotHash: snapshot.snapshotHash,
    sourceCount: snapshot.sourceCount,
    chunkCount: snapshot.chunkCount,
    totalCharacterCount: snapshot.totalCharacterCount,
    eligibilityRulesVersion: snapshot.eligibilityRulesVersion,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toProviderPolicyResponse(row: ProviderPolicyRow) {
  return providerPolicyResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    version: row.version,
    provider: row.provider,
    policyName: row.policyName,
    modelAlias: row.modelAlias,
    resolvedModelId: row.resolvedModelId,
    dataRetentionMode: row.dataRetentionMode,
    status: row.status,
    approvedForRequirementAnalysis: row.approvedForRequirementAnalysis,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvalNote: normalizeNullableNonEmpty(row.approvalNote),
    providerTermsSnapshotHash: normalizeNullableNonEmpty(row.providerTermsSnapshotHash),
    maxUsdPerRun: row.maxUsdPerRun,
    maxInputTokensPerRun: row.maxInputTokensPerRun,
    maxOutputTokensPerRun: row.maxOutputTokensPerRun,
    maxWallClockSeconds: row.maxWallClockSeconds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toRunSummaryResponse(row: RequirementAnalysisRunRow) {
  return analysisRunSummaryResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    requestedBy: row.requestedBy,
    mode: row.mode,
    status: row.status,
    sourceSnapshotId: row.sourceSnapshotId,
    replayOfRunId: row.replayOfRunId,
    reprocessOfRunId: row.reprocessOfRunId,
    retryOfRunId: row.retryOfRunId,
    warningCodes: row.warningCodes,
    failureCode: normalizeNullableNonEmpty(row.failureCode),
    failureDetail: normalizeNullableNonEmpty(row.failureDetail),
    failureRetryable: row.failureRetryable ?? false,
    failedStageId: row.failedStageId,
    cancelRequestedAt: row.cancelRequestedAt?.toISOString() ?? null,
    cancelRequestedBy: row.cancelRequestedBy,
    cancelReason: normalizeNullableNonEmpty(row.cancelReason),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    correlationId: row.correlationId,
    providerPolicy: {
      providerPolicyId: row.providerPolicyId,
      provider: row.provider,
      modelAlias: row.modelAlias,
      resolvedModelId: row.resolvedModelId,
      dataRetentionMode: row.providerDataRetentionMode,
    },
    provenance: {
      promptBundleVersion: row.promptBundleVersion,
      promptBundleHash: row.promptBundleHash,
      schemaBundleVersion: row.schemaBundleVersion,
      schemaBundleHash: row.schemaBundleHash,
      pipelineVersion: row.pipelineVersion,
      pipelineHash: row.pipelineHash,
      modelPolicyHash: row.modelPolicyHash,
    },
    budgets: {
      maxUsd: row.maxUsd,
      maxInputTokens: row.maxInputTokens,
      maxOutputTokens: row.maxOutputTokens,
      maxWallClockSeconds: row.maxWallClockSeconds,
    },
    usage: {
      inputTokensUsed: row.inputTokensUsed,
      outputTokensUsed: row.outputTokensUsed,
      costUsd: row.costUsd,
    },
    artifactCounts: toArtifactCounts(row.artifactCounts),
  });
}

export function toRunDetailResponse(
  row: RequirementAnalysisRunRow,
  snapshot: RequirementAnalysisSnapshotRow | null,
  readNotices: readonly string[],
) {
  return analysisRunDetailResponseSchema.parse({
    ...toRunSummaryResponse(row),
    snapshot: snapshot ? toSnapshotDescriptor(snapshot) : null,
    readNotices,
  });
}

export function toStageResponse(row: RequirementAnalysisStageRow) {
  return analysisStageResponseSchema.parse({
    id: row.id,
    runId: row.runId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    kind: row.kind,
    status: row.status,
    attemptNumber: row.attemptNumber,
    idempotencyKey: row.idempotencyKey,
    inputHash: normalizeNullableNonEmpty(row.inputHash),
    outputHash: normalizeNullableNonEmpty(row.outputHash),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    retryAfter: row.retryAfter?.toISOString() ?? null,
    failureCode: normalizeNullableNonEmpty(row.failureCode),
    failureDetail: normalizeNullableNonEmpty(row.failureDetail),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toBatchResponse(row: RequirementAnalysisBatchRow) {
  return analysisBatchResponseSchema.parse({
    id: row.id,
    stageId: row.stageId,
    runId: row.runId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    batchOrder: row.batchOrder,
    sourceChunkStartSequence: row.sourceChunkStartSequence,
    sourceChunkEndSequence: row.sourceChunkEndSequence,
    inputTokenEstimate: row.inputTokenEstimate,
    maxOutputTokens: row.maxOutputTokens,
    status: row.status,
    attemptNumber: row.attemptNumber,
    aiRunId: row.aiRunId,
    repairOfBatchId: row.repairOfBatchId,
    shapeOnlyRepairUsed: row.shapeOnlyRepairUsed,
    cacheKey: normalizeNullableNonEmpty(row.cacheKey),
    cacheHitOfBatchId: row.cacheHitOfBatchId,
    failureCode: normalizeNullableNonEmpty(row.failureCode),
    failureDetail: normalizeNullableNonEmpty(row.failureDetail),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toRequirementResponse(row: RequirementRow) {
  return requirementResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    analysisRunId: row.analysisRunId,
    stableKey: row.stableKey,
    title: row.title,
    description: asNonEmpty(row.description, row.title),
    requirementType: row.requirementType,
    priority: row.priority,
    epistemicStatus: row.epistemicStatus,
    confidenceBand: row.confidenceBand,
    confidenceReasonCodes: row.confidenceReasonCodes,
    inferenceBasis: normalizeNullableNonEmpty(row.inferenceBasis),
    origin: row.origin,
    lifecycleState: row.lifecycleState,
    dedupeGroupKey: normalizeNullableNonEmpty(row.dedupeGroupKey),
    parentRequirementId: row.parentRequirementId,
    sourceSummary: normalizeNullableNonEmpty(row.sourceSummary),
    createdByAiRunId: row.createdByAiRunId ?? row.analysisRunId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toDeliveryItemResponse(row: DeliveryItemRow) {
  return deliveryItemResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    analysisRunId: row.analysisRunId,
    itemType: row.itemType,
    title: row.title,
    description: asNonEmpty(row.description, row.title),
    epistemicStatus: row.epistemicStatus,
    confidenceBand: row.confidenceBand,
    confidenceReasonCodes: row.confidenceReasonCodes,
    severity: row.severity,
    priority: row.priority,
    status: row.status,
    visibility: row.visibility,
    attributes: row.attributes,
    sourceRequirementId: row.sourceRequirementId,
    createdByAiRunId: row.createdByAiRunId ?? row.analysisRunId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toCoverageResponse(row: CoverageRow) {
  return coverageMatrixEntryResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    analysisRunId: row.analysisRunId,
    categoryKey: row.categoryKey,
    categoryLabel: row.categoryLabel,
    categoryOrder: row.categoryOrder,
    status: row.status,
    rationale: asNonEmpty(row.rationale, "No rationale provided."),
    evidenceState: row.evidenceState,
    questionDeliveryItemId: row.questionDeliveryItemId,
    createdByAiRunId: row.createdByAiRunId ?? row.analysisRunId,
    createdAt: row.createdAt.toISOString(),
  });
}

export function toCitationResponse(row: CitationRow) {
  return citationResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    analysisRunId: row.analysisRunId,
    requirementId: row.requirementId,
    coverageMatrixEntryId: row.coverageMatrixEntryId,
    deliveryItemId: row.deliveryItemId,
    sourceDocumentId: row.sourceDocumentId,
    sourceVersionNumber: row.sourceVersionNumber,
    sourceContentHash: row.sourceContentHash,
    sourceExtractionId: row.sourceExtractionId,
    sourceExtractionVersion: row.sourceExtractionVersion,
    sourceChunkId: row.sourceChunkId,
    sourceChunkSequence: row.sourceChunkSequence,
    chunkContentHash: row.chunkContentHash,
    locator: row.locator as Record<string, string | number | boolean | null>,
    quoteTextOriginal: row.quoteTextOriginal,
    quoteTextNormalized: row.quoteTextNormalized,
    quoteHash: row.quoteHash,
    matchStartOffset: row.matchStartOffset,
    matchEndOffset: row.matchEndOffset,
    normalizationMode: row.normalizationMode,
    verificationStatus: row.verificationStatus,
    createdByAiRunId: row.createdByAiRunId ?? row.analysisRunId,
    createdAt: row.createdAt.toISOString(),
  });
}

export function toCitationEvidenceResponse(row: CitationEvidenceRow) {
  return citationEvidenceResponseSchema.parse({
    ...toCitationResponse(row),
    sourceTitle: row.sourceTitle,
    sourceVersionLabel: row.sourceVersionLabel,
  });
}

export function toTraceabilityLinkResponse(row: TraceabilityLinkRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fromType: row.fromType,
    fromId: row.fromId,
    toType: row.toType,
    toId: row.toId,
    relation: row.relation,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function sanitizeFailureDetail(detail: string): string {
  const normalized = detail.replace(/\s+/gu, " ").trim();
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 217)}...`;
}
