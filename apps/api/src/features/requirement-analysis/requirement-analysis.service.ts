import {
  createModelPolicyHash,
  hashCanonicalJson,
  module03PipelineDescriptor,
  normalizeAiProvider,
  promptBundleHash,
  promptBundleVersion,
} from "@atlashq/ai";
import { aiRequirementAnalysisDefaults } from "@atlashq/config";
import { analysisRunActiveStatusValues, type Database } from "@atlashq/db";
import { createRequirementAnalysisIdempotencyKey } from "@atlashq/jobs";
import type {
  AnalysisBatchListFilter,
  AnalysisRunCancelRequest,
  AnalysisRunDetailResponse,
  AnalysisRunFreshRequest,
  AnalysisRunListFilter,
  AnalysisRunReplayRequest,
  AnalysisRunReprocessRequest,
  AnalysisRunRetryRequest,
  AnalysisStageListFilter,
  CitationEvidenceResponse,
  CitationListFilter,
  CoverageListFilter,
  DeliveryItemListFilter,
  DeliveryItemResponse,
  EligibleSourcePreviewResponse,
  ProviderPolicyCreateInput,
  ProviderPolicyListFilter,
  ProviderPolicyResponse,
  RequirementListFilter,
  RequirementResponse,
} from "@atlashq/validators";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AuditRecordInput } from "../../audit/audit-input.js";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { AuditTransaction } from "../../audit/audit-transaction.js";
// biome-ignore lint/style/useImportType: Nest needs runtime metadata for constructor injection.
import { AuditWriter } from "../../audit/audit-writer.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import type { RequirementAnalysisQueue } from "../../runtime/requirement-analysis-runtime.js";
import {
  AI_ANALYSIS_QUEUE,
  AI_REQUIREMENT_ANALYSIS_CONFIG,
  DATABASE_CLIENT,
} from "../../runtime/runtime.js";
import { apiErrorCodes } from "../../validation/dto-conventions.js";
import type {
  ProviderPolicyApproveActionInput,
  ProviderPolicyDeactivateActionInput,
  RequirementAnalysisCapabilitiesResponse,
  TraceabilityListFilter,
  TraceabilityListResponse,
} from "./requirement-analysis.schemas.js";
import { REQUIREMENT_ANALYSIS_REPOSITORY } from "./requirement-analysis.tokens.js";
import type {
  ProviderPolicyRow,
  RequirementAnalysisQueryHandle,
  RequirementAnalysisRepository,
  RequirementAnalysisRunRow,
} from "./requirement-analysis.types.js";
import {
  decodeTimeCursor,
  sanitizeFailureDetail,
  toBatchResponse,
  toCitationEvidenceResponse,
  toCitationResponse,
  toCoverageResponse,
  toDeliveryItemResponse,
  toProviderPolicyResponse,
  toRequirementResponse,
  toRunDetailResponse,
  toRunSummaryResponse,
  toStageResponse,
  toTraceabilityLinkResponse,
} from "./requirement-analysis.utils.js";

const ORGANIZATION_ADMIN_ROLE = "admin";
const ACTIVE_PROJECT_STATUS = "active";
const POLICY_ENTITY = "organization_ai_provider_policy";
const RUN_ENTITY = "requirement_analysis_run";
const TRACEABILITY_FROM_RUN = "requirement_analysis_run";
const TRACEABILITY_TO_POLICY = "organization_ai_provider_policy";
const TRACEABILITY_TO_SOURCE = "source_document";

const ACTION_POLICY_CREATE = "ai.provider_policy.create";
const ACTION_POLICY_APPROVE = "ai.provider_policy.approve";
const ACTION_POLICY_DEACTIVATE = "ai.provider_policy.deactivate";
const ACTION_RUN_CREATE = "ai.requirement_analysis.run.create";
const ACTION_RUN_CANCEL = "ai.requirement_analysis.run.cancel";

const RUN_TERMINAL_STATUSES = new Set([
  "completed",
  "completed_with_warnings",
  "failed",
  "canceled",
]);
const RUN_CANCELABLE_STATUSES = new Set([
  "requested",
  "snapshotting",
  "queued",
  "running",
  "waiting_retry",
]);
const ELIGIBILITY_RULES_VERSION = "module-03-eligibility-v1";
const SCHEMA_BUNDLE_VERSION = "module-03-schema-contracts-v1";
const SCHEMA_BUNDLE_HASH = hashCanonicalJson({
  kind: "schema-bundle",
  version: SCHEMA_BUNDLE_VERSION,
});

type RequirementAnalysisRuntimeConfig = {
  AI_REQUIREMENT_ANALYSIS_ENABLED: boolean;
  AI_MODEL_CALLS_ENABLED: boolean;
  AI_ANALYSIS_READS_ENABLED: boolean;
  AI_REFERENCE_FEATURE_EXTRACTION_ENABLED: boolean;
  AI_ANALYSIS_MAX_USD_PER_RUN: number;
  AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN: number;
  AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN: number;
  AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS: number;
  AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT: number;
  AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION: number;
  AI_ANALYSIS_DEFAULT_PROVIDER: string;
  AI_ANALYSIS_DEFAULT_MODEL_ALIAS: string;
  AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID: string;
  AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE: string;
  AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY: string;
  AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK: boolean;
};

type RequestedSourceSelection = {
  selectedSourceIds: string[];
  preview: EligibleSourcePreviewResponse;
};

@Injectable()
export class RequirementAnalysisService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database | null,
    @Inject(REQUIREMENT_ANALYSIS_REPOSITORY)
    private readonly repository: RequirementAnalysisRepository,
    @Inject(AI_ANALYSIS_QUEUE) private readonly analysisQueue: RequirementAnalysisQueue | null,
    @Inject(AI_REQUIREMENT_ANALYSIS_CONFIG)
    private readonly analysisConfig: RequirementAnalysisRuntimeConfig | null,
    private readonly auditWriter: AuditWriter,
  ) {}

  private requireDb(): Database {
    if (!this.db) {
      throw new Error("Database client is not available for requirement-analysis operations.");
    }
    return this.db;
  }

  private resolvedConfig(): RequirementAnalysisRuntimeConfig {
    return {
      AI_REQUIREMENT_ANALYSIS_ENABLED:
        this.analysisConfig?.AI_REQUIREMENT_ANALYSIS_ENABLED ??
        aiRequirementAnalysisDefaults.featureFlags.aiRequirementAnalysisEnabled,
      AI_MODEL_CALLS_ENABLED:
        this.analysisConfig?.AI_MODEL_CALLS_ENABLED ??
        aiRequirementAnalysisDefaults.featureFlags.aiModelCallsEnabled,
      AI_ANALYSIS_READS_ENABLED:
        this.analysisConfig?.AI_ANALYSIS_READS_ENABLED ??
        aiRequirementAnalysisDefaults.featureFlags.aiAnalysisReadsEnabled,
      AI_REFERENCE_FEATURE_EXTRACTION_ENABLED:
        this.analysisConfig?.AI_REFERENCE_FEATURE_EXTRACTION_ENABLED ??
        aiRequirementAnalysisDefaults.featureFlags.aiReferenceFeatureExtractionEnabled,
      AI_ANALYSIS_MAX_USD_PER_RUN:
        this.analysisConfig?.AI_ANALYSIS_MAX_USD_PER_RUN ??
        aiRequirementAnalysisDefaults.budgets.maxUsdPerRun,
      AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN:
        this.analysisConfig?.AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN ??
        aiRequirementAnalysisDefaults.budgets.maxInputTokensPerRun,
      AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN:
        this.analysisConfig?.AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN ??
        aiRequirementAnalysisDefaults.budgets.maxOutputTokensPerRun,
      AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS:
        this.analysisConfig?.AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS ??
        aiRequirementAnalysisDefaults.budgets.maxWallClockSeconds,
      AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT:
        this.analysisConfig?.AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT ??
        aiRequirementAnalysisDefaults.budgets.maxActiveRunsPerProject,
      AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION:
        this.analysisConfig?.AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION ??
        aiRequirementAnalysisDefaults.budgets.maxActiveRunsPerOrganization,
      AI_ANALYSIS_DEFAULT_PROVIDER:
        this.analysisConfig?.AI_ANALYSIS_DEFAULT_PROVIDER ??
        aiRequirementAnalysisDefaults.providerSelection.provider,
      AI_ANALYSIS_DEFAULT_MODEL_ALIAS:
        this.analysisConfig?.AI_ANALYSIS_DEFAULT_MODEL_ALIAS ??
        aiRequirementAnalysisDefaults.providerSelection.modelAlias,
      AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID:
        this.analysisConfig?.AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID ??
        aiRequirementAnalysisDefaults.providerSelection.resolvedModelId,
      AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE:
        this.analysisConfig?.AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE ??
        aiRequirementAnalysisDefaults.providerSelection.dataRetentionMode,
      AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY:
        this.analysisConfig?.AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY ??
        aiRequirementAnalysisDefaults.providerSelection.strategy,
      AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK:
        this.analysisConfig?.AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK ??
        aiRequirementAnalysisDefaults.providerSelection.disableAutomaticFallback,
    };
  }

  private assertOrganizationAdmin(session: RequestSessionContext) {
    if (session.user.organizationRole !== ORGANIZATION_ADMIN_ROLE) {
      throw new ForbiddenException({
        code: apiErrorCodes.accessDenied,
        message: "Organization-admin privileges are required.",
      });
    }
  }

  private assertReadsEnabled() {
    const config = this.resolvedConfig();
    if (!config.AI_ANALYSIS_READS_ENABLED) {
      throw new ServiceUnavailableException({
        code: apiErrorCodes.aiAnalysisDisabled,
        message: "Requirement-analysis reads are disabled for this environment.",
      });
    }
  }

  private assertRunCreationEnabled() {
    const config = this.resolvedConfig();
    if (!config.AI_REQUIREMENT_ANALYSIS_ENABLED) {
      throw new ConflictException({
        code: apiErrorCodes.aiAnalysisDisabled,
        message: "Requirement-analysis run creation is disabled for this environment.",
      });
    }
    if (config.AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY !== "explicit_policy_only") {
      throw new ConflictException({
        code: apiErrorCodes.aiProviderPolicyMismatch,
        message: "Run creation requires explicit provider policy selection in this environment.",
      });
    }
    if (!config.AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK) {
      throw new ConflictException({
        code: apiErrorCodes.aiProviderPolicyMismatch,
        message: "Automatic provider fallback must remain disabled for requirement-analysis runs.",
      });
    }
  }

  private auditInput(
    auditContext: AuditRequestContext,
    action: string,
    entityType: string,
    entityId: string,
    projectId: string | undefined,
    before: unknown,
    after: unknown,
  ): AuditRecordInput {
    return {
      organizationId: auditContext.actor.organizationId,
      actorId: auditContext.actor.actorId,
      action,
      entityType,
      entityId,
      ...(projectId ? { projectId } : {}),
      before,
      after,
      correlationId: auditContext.correlationId,
    };
  }

  private async assertProjectActiveForAnalysis(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
  ) {
    const project = await this.repository.findProjectScope(handle, organizationId, projectId);
    if (!project) {
      throw new NotFoundException({
        code: apiErrorCodes.resourceNotFound,
        message: "Project not found.",
      });
    }
    if (project.softDeletedAt !== null || project.status !== ACTIVE_PROJECT_STATUS) {
      throw new ConflictException({
        code: apiErrorCodes.aiAnalysisDisabled,
        message: "Requirement-analysis runs are only allowed for active projects.",
        details: [
          {
            path: ["project", "status"],
            code: "project_not_active",
            message: "Project must be active and not archived to start requirement-analysis runs.",
          },
        ],
      });
    }
  }

  private async ensureRunScoped(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    runId: string,
  ): Promise<RequirementAnalysisRunRow> {
    const run = await this.repository.findRunById(handle, organizationId, projectId, runId);
    if (!run) {
      throw new NotFoundException({
        code: apiErrorCodes.aiArtifactNotFound,
        message: "Requirement-analysis run not found.",
      });
    }
    return run;
  }

  private async requireApprovedPolicy(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    providerPolicyId: string,
  ): Promise<ProviderPolicyRow> {
    const policy = await this.repository.findProviderPolicyById(
      handle,
      organizationId,
      providerPolicyId,
    );
    if (!policy) {
      throw new ConflictException({
        code: apiErrorCodes.aiProviderNotApproved,
        message: "Provider policy is not approved for requirement-analysis.",
      });
    }
    if (policy.status === "inactive") {
      throw new ConflictException({
        code: apiErrorCodes.aiProviderPolicyInactive,
        message: "Provider policy is inactive for new runs.",
      });
    }
    if (policy.status !== "approved" || !policy.approvedForRequirementAnalysis) {
      throw new ConflictException({
        code: apiErrorCodes.aiProviderNotApproved,
        message: "Provider policy is not approved for requirement-analysis.",
      });
    }
    return policy;
  }

  private async assertConcurrency(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
  ) {
    const config = this.resolvedConfig();
    const activeStatuses = [...analysisRunActiveStatusValues];
    const activeProjectRuns = await this.repository.countActiveRunsByProject(
      handle,
      organizationId,
      projectId,
      activeStatuses,
    );
    if (activeProjectRuns >= config.AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT) {
      throw new ConflictException({
        code: apiErrorCodes.aiRunConcurrencyExceeded,
        message: "Project already has the maximum number of active requirement-analysis runs.",
      });
    }
    const activeOrganizationRuns = await this.repository.countActiveRunsByOrganization(
      handle,
      organizationId,
      activeStatuses,
    );
    if (activeOrganizationRuns >= config.AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION) {
      throw new ConflictException({
        code: apiErrorCodes.aiRunConcurrencyExceeded,
        message: "Organization already has the maximum number of active requirement-analysis runs.",
      });
    }
  }

  private freezeBudget(policy: ProviderPolicyRow) {
    const config = this.resolvedConfig();
    return {
      maxUsd: Math.min(policy.maxUsdPerRun, config.AI_ANALYSIS_MAX_USD_PER_RUN),
      maxInputTokens: Math.min(
        policy.maxInputTokensPerRun,
        config.AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN,
      ),
      maxOutputTokens: Math.min(
        policy.maxOutputTokensPerRun,
        config.AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN,
      ),
      maxWallClockSeconds: Math.min(
        policy.maxWallClockSeconds,
        config.AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS,
      ),
    };
  }

  private hashBundleVersion(kind: "prompt" | "schema" | "pipeline", version: string) {
    return hashCanonicalJson({ kind, version });
  }

  private buildModelPolicyHash(policy: ProviderPolicyRow) {
    return createModelPolicyHash({
      provider: policy.provider as "openai" | "anthropic" | "openai-compatible" | "local",
      policyName: policy.policyName,
      modelAlias: policy.modelAlias,
      resolvedModelId: policy.resolvedModelId,
      dataRetentionMode: policy.dataRetentionMode,
      maxUsdPerRun: policy.maxUsdPerRun,
      maxInputTokensPerRun: policy.maxInputTokensPerRun,
      maxOutputTokensPerRun: policy.maxOutputTokensPerRun,
      maxWallClockSeconds: policy.maxWallClockSeconds,
    });
  }

  private assertPolicyAvailableInDeployment(policy: {
    provider: string;
    modelAlias: string;
    resolvedModelId: string;
    dataRetentionMode: string;
  }) {
    const config = this.resolvedConfig();
    if (!config.AI_MODEL_CALLS_ENABLED) {
      throw new ConflictException({
        code: apiErrorCodes.aiAnalysisDisabled,
        message:
          "Provider-policy approval and run creation are blocked while model calls are disabled.",
      });
    }
    const requestedProvider = normalizeAiProvider(
      policy.provider as "openai" | "anthropic" | "openai-compatible" | "local",
    );
    const deployedProvider = normalizeAiProvider(
      config.AI_ANALYSIS_DEFAULT_PROVIDER as "openai" | "anthropic" | "openai-compatible" | "local",
    );
    if (
      requestedProvider !== deployedProvider ||
      policy.resolvedModelId !== config.AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID ||
      policy.dataRetentionMode !== config.AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE
    ) {
      throw new ConflictException({
        code: apiErrorCodes.aiProviderPolicyMismatch,
        message:
          "Selected provider policy is not available in the current deployment configuration.",
        details: [
          {
            path: ["provider"],
            code: "provider_unavailable",
            message: `Requested provider "${policy.provider}" is unavailable.`,
          },
          {
            path: ["resolvedModelId"],
            code: "model_unavailable",
            message: `Requested model "${policy.resolvedModelId}" is unavailable.`,
          },
          {
            path: ["dataRetentionMode"],
            code: "retention_mode_unavailable",
            message: `Requested retention mode "${policy.dataRetentionMode}" is unavailable.`,
          },
        ],
      });
    }
  }

  private async buildEligibleSourcePreview(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<EligibleSourcePreviewResponse> {
    const config = this.resolvedConfig();
    const sources = await this.repository.listSourceDocumentsForEligibility(
      handle,
      organizationId,
      projectId,
    );

    const items = [];
    for (const source of sources) {
      const lineageHead = await this.repository.findLineageHead(
        handle,
        organizationId,
        projectId,
        source.lineageId,
      );
      const isLineageHead = lineageHead?.id === source.id;
      const extraction = await this.repository.findLatestSuccessfulExtraction(handle, source.id);
      const chunks = extraction
        ? await this.repository.listOrderedChunks(handle, extraction.id)
        : [];
      const chunkCount = chunks.length;
      const totalCharacterCount = chunks.reduce((total, chunk) => total + chunk.characterCount, 0);
      const reference =
        source.sourceType === "reference"
          ? await this.repository.findReferenceArtifactBySource(handle, source.id)
          : null;

      let exclusionReason:
        | "not_ready"
        | "archived"
        | "non_head_version"
        | "missing_successful_extraction"
        | "reference_not_cleared"
        | "reference_feature_extraction_disabled"
        | null = null;

      if (!isLineageHead) {
        exclusionReason = "non_head_version";
      } else if (source.archivedAt !== null) {
        exclusionReason = "archived";
      } else if (source.processingStatus !== "ready") {
        exclusionReason = "not_ready";
      } else if (!extraction) {
        exclusionReason = "missing_successful_extraction";
      } else if (source.sourceType === "reference") {
        if (reference?.ipReviewStatus !== "cleared") {
          exclusionReason = "reference_not_cleared";
        } else if (!config.AI_REFERENCE_FEATURE_EXTRACTION_ENABLED) {
          exclusionReason = "reference_feature_extraction_disabled";
        }
      }

      items.push({
        sourceDocumentId: source.id,
        sourceLineageId: source.lineageId,
        sourceVersionNumber: source.versionNumber,
        sourceType: source.sourceType as "document" | "reference" | "manual",
        documentFormat: source.documentFormat as
          | "pdf"
          | "docx"
          | "txt"
          | "md"
          | "xlsx"
          | "csv"
          | "pptx"
          | "png"
          | "jpg"
          | "jpeg"
          | "webp"
          | null,
        title: source.title,
        contentHash: source.contentHash,
        sourceExtractionId: extraction?.id ?? null,
        sourceExtractionVersion: extraction?.extractionVersion ?? null,
        chunkerVersion: extraction?.chunkerVersion ?? null,
        chunkCount,
        totalCharacterCount,
        referenceIpReviewStatus:
          (reference?.ipReviewStatus as "not_reviewed" | "cleared" | "restricted" | null) ?? null,
        included: exclusionReason === null,
        exclusionReason,
      });
    }

    return {
      sources: items,
      includedCount: items.filter((item) => item.included).length,
      excludedCount: items.filter((item) => !item.included).length,
      generatedAt: new Date().toISOString(),
    };
  }

  private async resolveRequestedSources(
    handle: RequirementAnalysisQueryHandle,
    organizationId: string,
    projectId: string,
    requestedSourceIds: readonly string[] | undefined,
  ): Promise<RequestedSourceSelection> {
    const preview = await this.buildEligibleSourcePreview(handle, organizationId, projectId);
    const byId = new Map(preview.sources.map((item) => [item.sourceDocumentId, item]));

    const selectedSourceIds: string[] = [];
    if (requestedSourceIds && requestedSourceIds.length > 0) {
      const uniqueRequested = [...new Set(requestedSourceIds)];
      for (const sourceId of uniqueRequested) {
        const item = byId.get(sourceId);
        if (!item) {
          throw new ConflictException({
            code: apiErrorCodes.aiRunSourceNotEligible,
            message: "One or more requested sources are not eligible for requirement-analysis.",
            details: [
              {
                path: ["sourceDocumentIds"],
                code: "source_not_found",
                message: `Source "${sourceId}" does not exist in this project.`,
              },
            ],
          });
        }
        if (!item.included) {
          throw new ConflictException({
            code: apiErrorCodes.aiRunSourceNotEligible,
            message: "One or more requested sources are not eligible for requirement-analysis.",
            details: [
              {
                path: ["sourceDocumentIds"],
                code: item.exclusionReason ?? "not_eligible",
                message: `Source "${sourceId}" is excluded with reason "${item.exclusionReason}".`,
              },
            ],
          });
        }
        selectedSourceIds.push(sourceId);
      }
    } else {
      selectedSourceIds.push(
        ...preview.sources.filter((item) => item.included).map((item) => item.sourceDocumentId),
      );
    }

    if (selectedSourceIds.length === 0) {
      throw new ConflictException({
        code: apiErrorCodes.aiRunSnapshotEmpty,
        message: "No eligible sources are currently available for requirement-analysis.",
      });
    }

    return { selectedSourceIds, preview };
  }

  private async enqueueFreezeSnapshot(
    run: RequirementAnalysisRunRow,
    actorId: string,
    correlationId: string,
    sourceDocumentIds: readonly string[],
  ) {
    if (!this.analysisQueue) {
      throw new ServiceUnavailableException({
        code: apiErrorCodes.aiAnalysisDisabled,
        message: "ai-analysis queue is not configured for this environment.",
      });
    }
    const uniqueSourceDocumentIds = [...new Set(sourceDocumentIds)];
    await this.analysisQueue.addFreezeSnapshot({
      kind: "freeze-snapshot",
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      ...(uniqueSourceDocumentIds.length > 0 ? { sourceDocumentIds: uniqueSourceDocumentIds } : {}),
      actorId,
      idempotencyKey: createRequirementAnalysisIdempotencyKey({
        kind: "freeze-snapshot",
        runId: run.id,
      }),
      correlationId,
      submittedAt: new Date().toISOString(),
    });
  }

  private async enqueueCancelRun(
    run: RequirementAnalysisRunRow,
    actorId: string,
    correlationId: string,
  ) {
    if (!this.analysisQueue) {
      return;
    }
    await this.analysisQueue.addCancelRun({
      kind: "cancel-run",
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      actorId,
      idempotencyKey: createRequirementAnalysisIdempotencyKey({
        kind: "cancel-run",
        runId: run.id,
      }),
      correlationId,
      submittedAt: new Date().toISOString(),
    });
  }

  private async recordRunCreationTraceability(
    handle: RequirementAnalysisQueryHandle,
    run: RequirementAnalysisRunRow,
    createdBy: string,
    selectedSourceIds: readonly string[],
  ) {
    await this.repository.insertTraceabilityLink(handle, {
      organizationId: run.organizationId,
      fromType: TRACEABILITY_FROM_RUN,
      fromId: run.id,
      toType: TRACEABILITY_TO_POLICY,
      toId: run.providerPolicyId,
      relation: "uses_provider_policy",
      createdBy,
    });
    for (const sourceId of selectedSourceIds) {
      await this.repository.insertTraceabilityLink(handle, {
        organizationId: run.organizationId,
        fromType: TRACEABILITY_FROM_RUN,
        fromId: run.id,
        toType: TRACEABILITY_TO_SOURCE,
        toId: sourceId,
        relation: "selected_source_document",
        createdBy,
      });
    }
    if (run.replayOfRunId) {
      await this.repository.insertTraceabilityLink(handle, {
        organizationId: run.organizationId,
        fromType: TRACEABILITY_FROM_RUN,
        fromId: run.id,
        toType: TRACEABILITY_FROM_RUN,
        toId: run.replayOfRunId,
        relation: "replay_of",
        createdBy,
      });
    }
    if (run.retryOfRunId) {
      await this.repository.insertTraceabilityLink(handle, {
        organizationId: run.organizationId,
        fromType: TRACEABILITY_FROM_RUN,
        fromId: run.id,
        toType: TRACEABILITY_FROM_RUN,
        toId: run.retryOfRunId,
        relation: "retry_of",
        createdBy,
      });
    }
    if (run.reprocessOfRunId) {
      await this.repository.insertTraceabilityLink(handle, {
        organizationId: run.organizationId,
        fromType: TRACEABILITY_FROM_RUN,
        fromId: run.id,
        toType: TRACEABILITY_FROM_RUN,
        toId: run.reprocessOfRunId,
        relation: "reprocess_of",
        createdBy,
      });
    }
  }

  async getCapabilities(
    session: RequestSessionContext,
    projectId: string,
  ): Promise<RequirementAnalysisCapabilitiesResponse> {
    const db = this.requireDb();
    const handle = db as RequirementAnalysisQueryHandle;
    const config = this.resolvedConfig();
    const project = await this.repository.findProjectScope(
      handle,
      session.user.organizationId,
      projectId,
    );
    if (!project) {
      throw new NotFoundException({
        code: apiErrorCodes.resourceNotFound,
        message: "Project not found.",
      });
    }
    const approvedPolicyCount = await this.repository.countApprovedProviderPolicies(
      handle,
      session.user.organizationId,
    );
    const queueAvailable = this.analysisQueue
      ? (await this.analysisQueue.checkAvailability()).ok
      : false;

    let safeDisabledReason:
      | "analysis_feature_disabled"
      | "provider_not_approved"
      | "queue_unavailable"
      | "reads_disabled"
      | null = null;

    if (!config.AI_ANALYSIS_READS_ENABLED) {
      safeDisabledReason = "reads_disabled";
    } else if (!config.AI_REQUIREMENT_ANALYSIS_ENABLED) {
      safeDisabledReason = "analysis_feature_disabled";
    } else if (approvedPolicyCount === 0) {
      safeDisabledReason = "provider_not_approved";
    } else if (!queueAvailable) {
      safeDisabledReason = "queue_unavailable";
    }

    return {
      analysisEnabled: config.AI_REQUIREMENT_ANALYSIS_ENABLED,
      readsEnabled: config.AI_ANALYSIS_READS_ENABLED,
      referenceFeatureExtractionEnabled: config.AI_REFERENCE_FEATURE_EXTRACTION_ENABLED,
      queueAvailable,
      approvedProviderPolicyAvailable: approvedPolicyCount > 0,
      safeDisabled: safeDisabledReason !== null,
      safeDisabledReason,
    };
  }

  async listOrganizationProviderPolicies(
    session: RequestSessionContext,
    query: ProviderPolicyListFilter,
  ) {
    this.assertOrganizationAdmin(session);
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    const cursor = query.cursor
      ? decodeTimeCursor(query.cursor, "Invalid provider-policy cursor.")
      : undefined;
    const page = await this.repository.listProviderPolicies(handle, {
      organizationId: session.user.organizationId,
      limit: query.limit,
      includeInactive: query.includeInactive,
      ...(query.status ? { status: query.status } : {}),
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return { items: page.items.map(toProviderPolicyResponse), pageInfo: page.pageInfo };
  }

  async createOrganizationProviderPolicy(
    session: RequestSessionContext,
    input: ProviderPolicyCreateInput,
    auditContext: AuditRequestContext,
  ): Promise<ProviderPolicyResponse> {
    this.assertOrganizationAdmin(session);
    const config = this.resolvedConfig();
    if (config.AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY !== "explicit_policy_only") {
      throw new ConflictException({
        code: apiErrorCodes.aiProviderPolicyMismatch,
        message: "Provider policies are unavailable under the current deployment strategy.",
      });
    }

    const budgets = this.freezeBudget({
      id: "",
      organizationId: session.user.organizationId,
      provider: input.provider,
      policyName: input.policyName,
      modelAlias: input.modelAlias,
      resolvedModelId: input.resolvedModelId,
      dataRetentionMode: input.dataRetentionMode,
      status: "draft",
      approvedForRequirementAnalysis: false,
      approvedBy: null,
      approvedAt: null,
      approvalNote: null,
      providerTermsSnapshotHash: null,
      maxUsdPerRun: input.maxUsdPerRun ?? config.AI_ANALYSIS_MAX_USD_PER_RUN,
      maxInputTokensPerRun:
        input.maxInputTokensPerRun ?? config.AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN,
      maxOutputTokensPerRun:
        input.maxOutputTokensPerRun ?? config.AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN,
      maxWallClockSeconds: input.maxWallClockSeconds ?? config.AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });

    const db = this.requireDb();
    const inserted = await db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as RequirementAnalysisQueryHandle;
      const row = await this.repository.insertProviderPolicy(handle, {
        organizationId: session.user.organizationId,
        provider: input.provider,
        policyName: input.policyName,
        modelAlias: input.modelAlias,
        resolvedModelId: input.resolvedModelId,
        dataRetentionMode: input.dataRetentionMode,
        approvalNote: input.approvalNote ?? null,
        providerTermsSnapshotHash: input.providerTermsSnapshotHash ?? null,
        maxUsdPerRun: budgets.maxUsd,
        maxInputTokensPerRun: budgets.maxInputTokens,
        maxOutputTokensPerRun: budgets.maxOutputTokens,
        maxWallClockSeconds: budgets.maxWallClockSeconds,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      });
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_POLICY_CREATE,
          POLICY_ENTITY,
          row.id,
          undefined,
          null,
          {
            provider: row.provider,
            modelAlias: row.modelAlias,
            resolvedModelId: row.resolvedModelId,
            dataRetentionMode: row.dataRetentionMode,
            status: row.status,
          },
        ),
      );
      return row;
    });

    return toProviderPolicyResponse(inserted);
  }

  async approveOrganizationProviderPolicy(
    session: RequestSessionContext,
    policyId: string,
    input: ProviderPolicyApproveActionInput,
    auditContext: AuditRequestContext,
  ): Promise<ProviderPolicyResponse> {
    this.assertOrganizationAdmin(session);
    const db = this.requireDb();
    return db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as RequirementAnalysisQueryHandle;
      const existing = await this.repository.findProviderPolicyById(
        handle,
        session.user.organizationId,
        policyId,
      );
      if (!existing) {
        throw new NotFoundException({
          code: apiErrorCodes.resourceNotFound,
          message: "Provider policy not found.",
        });
      }
      if (existing.status !== "draft") {
        throw new ConflictException({
          code:
            existing.status === "inactive"
              ? apiErrorCodes.aiProviderPolicyInactive
              : apiErrorCodes.aiProviderPolicyMismatch,
          message: "Only draft provider policies can be approved.",
        });
      }
      this.assertPolicyAvailableInDeployment(existing);

      const approvalNote =
        input.approvalNote ?? existing.approvalNote ?? "Approved for requirement-analysis.";
      const updated = await this.repository.approveProviderPolicy(
        handle,
        session.user.organizationId,
        policyId,
        input.version,
        {
          approvedBy: session.user.id,
          approvedAt: new Date(),
          approvalNote,
          providerTermsSnapshotHash:
            input.providerTermsSnapshotHash ?? existing.providerTermsSnapshotHash,
          updatedBy: session.user.id,
          updatedAt: new Date(),
        },
      );
      if (!updated) {
        throw new ConflictException({
          code: apiErrorCodes.conflict,
          message: "Provider policy was modified by another request. Reload and try again.",
        });
      }
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_POLICY_APPROVE,
          POLICY_ENTITY,
          policyId,
          undefined,
          {
            status: existing.status,
            approvedForRequirementAnalysis: existing.approvedForRequirementAnalysis,
          },
          {
            status: updated.status,
            approvedForRequirementAnalysis: updated.approvedForRequirementAnalysis,
          },
        ),
      );
      return toProviderPolicyResponse(updated);
    });
  }

  async deactivateOrganizationProviderPolicy(
    session: RequestSessionContext,
    policyId: string,
    input: ProviderPolicyDeactivateActionInput,
    auditContext: AuditRequestContext,
  ): Promise<ProviderPolicyResponse> {
    this.assertOrganizationAdmin(session);
    const db = this.requireDb();
    return db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as RequirementAnalysisQueryHandle;
      const existing = await this.repository.findProviderPolicyById(
        handle,
        session.user.organizationId,
        policyId,
      );
      if (!existing) {
        throw new NotFoundException({
          code: apiErrorCodes.resourceNotFound,
          message: "Provider policy not found.",
        });
      }
      if (existing.status !== "approved") {
        throw new ConflictException({
          code:
            existing.status === "inactive"
              ? apiErrorCodes.aiProviderPolicyInactive
              : apiErrorCodes.aiProviderNotApproved,
          message: "Only approved provider policies can be deactivated.",
        });
      }
      const updated = await this.repository.deactivateProviderPolicy(
        handle,
        session.user.organizationId,
        policyId,
        input.version,
        {
          updatedBy: session.user.id,
          updatedAt: new Date(),
        },
      );
      if (!updated) {
        throw new ConflictException({
          code: apiErrorCodes.conflict,
          message: "Provider policy was modified by another request. Reload and try again.",
        });
      }
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_POLICY_DEACTIVATE,
          POLICY_ENTITY,
          policyId,
          undefined,
          { status: existing.status },
          { status: updated.status, reason: input.reason },
        ),
      );
      return toProviderPolicyResponse(updated);
    });
  }

  async listProjectProviderPolicies(
    session: RequestSessionContext,
    projectId: string,
    query: ProviderPolicyListFilter,
  ) {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    const project = await this.repository.findProjectScope(
      handle,
      session.user.organizationId,
      projectId,
    );
    if (!project) {
      throw new NotFoundException({
        code: apiErrorCodes.resourceNotFound,
        message: "Project not found.",
      });
    }
    const cursor = query.cursor
      ? decodeTimeCursor(query.cursor, "Invalid provider-policy cursor.")
      : undefined;
    const page = await this.repository.listProviderPolicies(handle, {
      organizationId: session.user.organizationId,
      limit: query.limit,
      includeInactive: query.includeInactive,
      status: query.status ?? "approved",
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return { items: page.items.map(toProviderPolicyResponse), pageInfo: page.pageInfo };
  }

  async previewEligibleSources(
    session: RequestSessionContext,
    projectId: string,
  ): Promise<EligibleSourcePreviewResponse> {
    this.assertReadsEnabled();
    const db = this.requireDb();
    const handle = db as RequirementAnalysisQueryHandle;
    await this.assertProjectActiveForAnalysis(handle, session.user.organizationId, projectId);
    return this.buildEligibleSourcePreview(handle, session.user.organizationId, projectId);
  }

  async createFreshRun(
    session: RequestSessionContext,
    projectId: string,
    input: AnalysisRunFreshRequest,
    auditContext: AuditRequestContext,
  ): Promise<AnalysisRunDetailResponse> {
    this.assertRunCreationEnabled();
    const db = this.requireDb();
    const runCreation = await db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as RequirementAnalysisQueryHandle;
      await this.assertProjectActiveForAnalysis(handle, session.user.organizationId, projectId);
      const policy = await this.requireApprovedPolicy(
        handle,
        session.user.organizationId,
        input.providerPolicyId,
      );
      this.assertPolicyAvailableInDeployment(policy);
      const { selectedSourceIds } = await this.resolveRequestedSources(
        handle,
        session.user.organizationId,
        projectId,
        input.sourceDocumentIds,
      );
      await this.repository.acquireOrganizationRunCreationLock(handle, session.user.organizationId);
      const existing = await this.repository.findRunByCorrelation(
        handle,
        session.user.organizationId,
        projectId,
        auditContext.correlationId,
      );
      if (existing) {
        if (
          existing.mode !== "fresh" ||
          existing.providerPolicyId !== policy.id ||
          existing.requestedBy !== session.user.id
        ) {
          throw new ConflictException({
            code: apiErrorCodes.aiProviderPolicyMismatch,
            message: "Correlation ID is already associated with a different run request.",
          });
        }
        return { run: existing, shouldEnqueue: false, sourceDocumentIds: [] as string[] };
      }
      await this.assertConcurrency(handle, session.user.organizationId, projectId);

      const budget = this.freezeBudget(policy);
      const created = await this.repository.insertRun(handle, {
        organizationId: session.user.organizationId,
        projectId,
        requestedBy: session.user.id,
        mode: "fresh",
        status: "requested",
        sourceSnapshotId: null,
        replayOfRunId: null,
        reprocessOfRunId: null,
        retryOfRunId: null,
        providerPolicyId: policy.id,
        provider: policy.provider,
        modelAlias: policy.modelAlias,
        resolvedModelId: policy.resolvedModelId,
        providerDataRetentionMode: policy.dataRetentionMode,
        promptBundleVersion,
        promptBundleHash,
        schemaBundleVersion: SCHEMA_BUNDLE_VERSION,
        schemaBundleHash: SCHEMA_BUNDLE_HASH,
        pipelineVersion: module03PipelineDescriptor.version,
        pipelineHash: module03PipelineDescriptor.hash,
        modelPolicyHash: this.buildModelPolicyHash(policy),
        maxUsd: budget.maxUsd,
        maxInputTokens: budget.maxInputTokens,
        maxOutputTokens: budget.maxOutputTokens,
        maxWallClockSeconds: budget.maxWallClockSeconds,
        correlationId: auditContext.correlationId,
      });
      await this.recordRunCreationTraceability(handle, created, session.user.id, selectedSourceIds);
      await this.auditWriter.record(
        tx,
        this.auditInput(auditContext, ACTION_RUN_CREATE, RUN_ENTITY, created.id, projectId, null, {
          mode: created.mode,
          providerPolicyId: created.providerPolicyId,
          requestedSourceCount: selectedSourceIds.length,
          eligibilityRulesVersion: ELIGIBILITY_RULES_VERSION,
        }),
      );
      return { run: created, shouldEnqueue: true, sourceDocumentIds: selectedSourceIds };
    });

    if (runCreation.shouldEnqueue) {
      try {
        await this.enqueueFreezeSnapshot(
          runCreation.run,
          session.user.id,
          auditContext.correlationId,
          runCreation.sourceDocumentIds,
        );
      } catch (error) {
        const message = sanitizeFailureDetail(
          error instanceof Error ? error.message : "Failed to enqueue freeze-snapshot job.",
        );
        await this.requireDb().transaction(async (tx: AuditTransaction) => {
          const handle = tx as RequirementAnalysisQueryHandle;
          await this.repository.markRunQueueFailure(
            handle,
            runCreation.run.organizationId,
            runCreation.run.projectId,
            runCreation.run.id,
            {
              failureCode: apiErrorCodes.aiRunTransientProviderFailure,
              failureDetail: message,
              updatedAt: new Date(),
              completedAt: new Date(),
            },
          );
        });
        throw new ServiceUnavailableException({
          code: apiErrorCodes.aiRunTransientProviderFailure,
          message:
            "Requirement-analysis run was created but queue dispatch failed. Retry with the same correlation ID.",
        });
      }
    }

    return toRunDetailResponse(runCreation.run, null, []);
  }

  private async createDerivedRun(
    session: RequestSessionContext,
    projectId: string,
    auditContext: AuditRequestContext,
    sourceRunId: string,
    mode: "replay" | "retry" | "reprocess",
    options: {
      reason?: string;
      providerPolicyId?: string;
      promptBundleVersion?: string;
      schemaBundleVersion?: string;
      pipelineVersion?: string;
    } = {},
  ): Promise<AnalysisRunDetailResponse> {
    this.assertRunCreationEnabled();
    const db = this.requireDb();
    const runCreation = await db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as RequirementAnalysisQueryHandle;
      await this.assertProjectActiveForAnalysis(handle, session.user.organizationId, projectId);
      const sourceRun = await this.ensureRunScoped(
        handle,
        session.user.organizationId,
        projectId,
        sourceRunId,
      );

      if (!RUN_TERMINAL_STATUSES.has(sourceRun.status)) {
        throw new ConflictException({
          code: apiErrorCodes.aiRunNotRetryable,
          message: "Run-mode operations require a terminal source run.",
        });
      }
      if (!sourceRun.sourceSnapshotId) {
        throw new ConflictException({
          code: apiErrorCodes.aiRunSourceSnapshotStale,
          message: "Source run has no frozen snapshot available for lineage operations.",
        });
      }
      await this.repository.acquireOrganizationRunCreationLock(handle, session.user.organizationId);

      if (mode === "retry") {
        if (sourceRun.status !== "failed" || sourceRun.failureRetryable !== true) {
          throw new ConflictException({
            code: apiErrorCodes.aiRunNotRetryable,
            message: "Only terminal retryable failed runs may be retried.",
          });
        }
      }

      const existing = await this.repository.findRunByCorrelation(
        handle,
        session.user.organizationId,
        projectId,
        auditContext.correlationId,
      );
      if (existing) {
        if (existing.mode !== mode) {
          throw new ConflictException({
            code: apiErrorCodes.aiProviderPolicyMismatch,
            message: "Correlation ID is already associated with a different run request.",
          });
        }
        return { run: existing, shouldEnqueue: false, sourceDocumentIds: [] as string[] };
      }
      await this.assertConcurrency(handle, session.user.organizationId, projectId);
      const selectedSourceIds = [
        ...new Set(
          await this.repository.listSnapshotSourceDocumentIds(
            handle,
            session.user.organizationId,
            projectId,
            sourceRun.sourceSnapshotId,
          ),
        ),
      ];

      let providerPolicy = await this.requireApprovedPolicy(
        handle,
        session.user.organizationId,
        sourceRun.providerPolicyId,
      );
      this.assertPolicyAvailableInDeployment(providerPolicy);
      let promptVersion = sourceRun.promptBundleVersion;
      let promptHash = sourceRun.promptBundleHash;
      let schemaVersion = sourceRun.schemaBundleVersion;
      let schemaHash = sourceRun.schemaBundleHash;
      let pipelineVersion = sourceRun.pipelineVersion;
      let pipelineHash = sourceRun.pipelineHash;
      let modelPolicyHash = sourceRun.modelPolicyHash;

      if (mode === "reprocess") {
        if (
          !options.providerPolicyId ||
          !options.promptBundleVersion ||
          !options.schemaBundleVersion ||
          !options.pipelineVersion
        ) {
          throw new BadRequestException({
            code: apiErrorCodes.validationFailed,
            message:
              "Reprocess requests require providerPolicyId and explicit prompt/schema/pipeline versions.",
          });
        }
        providerPolicy = await this.requireApprovedPolicy(
          handle,
          session.user.organizationId,
          options.providerPolicyId,
        );
        this.assertPolicyAvailableInDeployment(providerPolicy);
        promptVersion = options.promptBundleVersion;
        schemaVersion = options.schemaBundleVersion;
        pipelineVersion = options.pipelineVersion;
        promptHash =
          promptVersion === promptBundleVersion
            ? promptBundleHash
            : this.hashBundleVersion("prompt", promptVersion);
        schemaHash =
          schemaVersion === SCHEMA_BUNDLE_VERSION
            ? SCHEMA_BUNDLE_HASH
            : this.hashBundleVersion("schema", schemaVersion);
        pipelineHash =
          pipelineVersion === module03PipelineDescriptor.version
            ? module03PipelineDescriptor.hash
            : this.hashBundleVersion("pipeline", pipelineVersion);
        modelPolicyHash = this.buildModelPolicyHash(providerPolicy);
      }

      const budget = this.freezeBudget(providerPolicy);
      const created = await this.repository.insertRun(handle, {
        organizationId: session.user.organizationId,
        projectId,
        requestedBy: session.user.id,
        mode,
        status: "requested",
        sourceSnapshotId: sourceRun.sourceSnapshotId,
        replayOfRunId: mode === "replay" ? sourceRun.id : null,
        reprocessOfRunId: mode === "reprocess" ? sourceRun.id : null,
        retryOfRunId: mode === "retry" ? sourceRun.id : null,
        providerPolicyId: providerPolicy.id,
        provider: providerPolicy.provider,
        modelAlias: providerPolicy.modelAlias,
        resolvedModelId: providerPolicy.resolvedModelId,
        providerDataRetentionMode: providerPolicy.dataRetentionMode,
        promptBundleVersion: promptVersion,
        promptBundleHash: promptHash,
        schemaBundleVersion: schemaVersion,
        schemaBundleHash: schemaHash,
        pipelineVersion,
        pipelineHash,
        modelPolicyHash,
        maxUsd: budget.maxUsd,
        maxInputTokens: budget.maxInputTokens,
        maxOutputTokens: budget.maxOutputTokens,
        maxWallClockSeconds: budget.maxWallClockSeconds,
        correlationId: auditContext.correlationId,
      });
      await this.recordRunCreationTraceability(handle, created, session.user.id, selectedSourceIds);
      await this.auditWriter.record(
        tx,
        this.auditInput(auditContext, ACTION_RUN_CREATE, RUN_ENTITY, created.id, projectId, null, {
          mode: created.mode,
          sourceRunId: sourceRun.id,
          reason: options.reason ?? null,
        }),
      );
      return { run: created, shouldEnqueue: true, sourceDocumentIds: selectedSourceIds };
    });

    if (runCreation.shouldEnqueue) {
      try {
        await this.enqueueFreezeSnapshot(
          runCreation.run,
          session.user.id,
          auditContext.correlationId,
          runCreation.sourceDocumentIds,
        );
      } catch (error) {
        const message = sanitizeFailureDetail(
          error instanceof Error ? error.message : "Failed to enqueue freeze-snapshot job.",
        );
        await this.requireDb().transaction(async (tx: AuditTransaction) => {
          const handle = tx as RequirementAnalysisQueryHandle;
          await this.repository.markRunQueueFailure(
            handle,
            runCreation.run.organizationId,
            runCreation.run.projectId,
            runCreation.run.id,
            {
              failureCode: apiErrorCodes.aiRunTransientProviderFailure,
              failureDetail: message,
              updatedAt: new Date(),
              completedAt: new Date(),
            },
          );
        });
        throw new ServiceUnavailableException({
          code: apiErrorCodes.aiRunTransientProviderFailure,
          message:
            "Requirement-analysis run was created but queue dispatch failed. Retry with the same correlation ID.",
        });
      }
    }

    return toRunDetailResponse(runCreation.run, null, []);
  }

  async replayRun(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    input: AnalysisRunReplayRequest,
    auditContext: AuditRequestContext,
  ): Promise<AnalysisRunDetailResponse> {
    return this.createDerivedRun(session, projectId, auditContext, runId, "replay", {
      ...(input.reason ? { reason: input.reason } : {}),
    });
  }

  async retryRun(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    input: AnalysisRunRetryRequest,
    auditContext: AuditRequestContext,
  ): Promise<AnalysisRunDetailResponse> {
    return this.createDerivedRun(session, projectId, auditContext, runId, "retry", {
      ...(input.reason ? { reason: input.reason } : {}),
    });
  }

  async reprocessRun(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    input: AnalysisRunReprocessRequest,
    auditContext: AuditRequestContext,
  ): Promise<AnalysisRunDetailResponse> {
    return this.createDerivedRun(session, projectId, auditContext, runId, "reprocess", {
      providerPolicyId: input.providerPolicyId,
      promptBundleVersion: input.promptBundleVersion,
      schemaBundleVersion: input.schemaBundleVersion,
      pipelineVersion: input.pipelineVersion,
      ...(input.reason ? { reason: input.reason } : {}),
    });
  }

  async listRuns(session: RequestSessionContext, projectId: string, query: AnalysisRunListFilter) {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    const cursor = query.cursor ? decodeTimeCursor(query.cursor) : undefined;
    const page = await this.repository.listRuns(handle, {
      organizationId: session.user.organizationId,
      projectId,
      limit: query.limit,
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.requestedBy ? { requestedBy: query.requestedBy } : {}),
      ...(query.providerPolicyId ? { providerPolicyId: query.providerPolicyId } : {}),
      ...(query.createdAfter ? { createdAfter: query.createdAfter } : {}),
      ...(query.createdBefore ? { createdBefore: query.createdBefore } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return {
      items: page.items.map(toRunSummaryResponse),
      pageInfo: page.pageInfo,
    };
  }

  async getRunDetail(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
  ): Promise<AnalysisRunDetailResponse> {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    const run = await this.ensureRunScoped(handle, session.user.organizationId, projectId, runId);
    const snapshot = await this.repository.findSnapshotByRunId(
      handle,
      session.user.organizationId,
      projectId,
      run.id,
    );
    const notices: string[] = [];
    if (!this.resolvedConfig().AI_REQUIREMENT_ANALYSIS_ENABLED) {
      notices.push(
        "New requirement-analysis runs are disabled; existing artifacts remain readable.",
      );
    }
    return toRunDetailResponse(run, snapshot, notices);
  }

  async cancelRun(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    input: AnalysisRunCancelRequest,
    auditContext: AuditRequestContext,
  ): Promise<AnalysisRunDetailResponse> {
    const db = this.requireDb();
    const run = await db.transaction(async (tx: AuditTransaction) => {
      const handle = tx as RequirementAnalysisQueryHandle;
      const current = await this.ensureRunScoped(
        handle,
        session.user.organizationId,
        projectId,
        runId,
      );
      if (!RUN_CANCELABLE_STATUSES.has(current.status)) {
        throw new ConflictException({
          code: apiErrorCodes.aiRunNotCancelable,
          message: "Only active runs can accept a cooperative cancellation request.",
        });
      }
      if (current.cancelRequestedAt) {
        return current;
      }
      const updated = await this.repository.requestRunCancellation(
        handle,
        session.user.organizationId,
        projectId,
        runId,
        {
          cancelRequestedAt: new Date(),
          cancelRequestedBy: session.user.id,
          cancelReason: input.reason ?? null,
          updatedAt: new Date(),
        },
      );
      if (!updated) {
        throw new ConflictException({
          code: apiErrorCodes.aiRunNotCancelable,
          message: "Run cancellation request could not be applied.",
        });
      }
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_RUN_CANCEL,
          RUN_ENTITY,
          updated.id,
          projectId,
          {
            cancelRequestedAt: null,
            cancelRequestedBy: null,
          },
          {
            cancelRequestedAt: updated.cancelRequestedAt?.toISOString() ?? null,
            cancelRequestedBy: updated.cancelRequestedBy,
            reason: input.reason ?? null,
          },
        ),
      );
      return updated;
    });

    await this.enqueueCancelRun(run, session.user.id, auditContext.correlationId);
    return toRunDetailResponse(run, null, []);
  }

  async listStages(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    query: AnalysisStageListFilter,
  ) {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    await this.ensureRunScoped(handle, session.user.organizationId, projectId, runId);
    const cursor = query.cursor
      ? decodeTimeCursor(query.cursor, "Invalid stage cursor.")
      : undefined;
    const page = await this.repository.listStages(handle, {
      organizationId: session.user.organizationId,
      projectId,
      runId,
      limit: query.limit,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return { items: page.items.map(toStageResponse), pageInfo: page.pageInfo };
  }

  async listBatches(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    query: AnalysisBatchListFilter,
  ) {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    await this.ensureRunScoped(handle, session.user.organizationId, projectId, runId);
    const cursor = query.cursor
      ? decodeTimeCursor(query.cursor, "Invalid batch cursor.")
      : undefined;
    const page = await this.repository.listBatches(handle, {
      organizationId: session.user.organizationId,
      projectId,
      runId,
      limit: query.limit,
      ...(query.stageId ? { stageId: query.stageId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return { items: page.items.map(toBatchResponse), pageInfo: page.pageInfo };
  }

  async listRequirements(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    query: RequirementListFilter,
  ) {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    await this.ensureRunScoped(handle, session.user.organizationId, projectId, runId);
    const cursor = query.cursor
      ? decodeTimeCursor(query.cursor, "Invalid requirement cursor.")
      : undefined;
    const page = await this.repository.listRequirements(handle, {
      organizationId: session.user.organizationId,
      projectId,
      runId,
      limit: query.limit,
      ...(query.requirementType ? { requirementType: query.requirementType } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.epistemicStatus ? { epistemicStatus: query.epistemicStatus } : {}),
      ...(query.lifecycleState ? { lifecycleState: query.lifecycleState } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return { items: page.items.map(toRequirementResponse), pageInfo: page.pageInfo };
  }

  async getRequirement(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    requirementId: string,
  ): Promise<RequirementResponse> {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    const row = await this.repository.findRequirementById(
      handle,
      session.user.organizationId,
      projectId,
      runId,
      requirementId,
    );
    if (!row) {
      throw new NotFoundException({
        code: apiErrorCodes.aiArtifactNotFound,
        message: "Requirement artifact not found for this run.",
      });
    }
    return toRequirementResponse(row);
  }

  async listDeliveryItems(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    query: DeliveryItemListFilter,
  ) {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    await this.ensureRunScoped(handle, session.user.organizationId, projectId, runId);
    const cursor = query.cursor
      ? decodeTimeCursor(query.cursor, "Invalid delivery-item cursor.")
      : undefined;
    const page = await this.repository.listDeliveryItems(handle, {
      organizationId: session.user.organizationId,
      projectId,
      runId,
      limit: query.limit,
      ...(query.itemType ? { itemType: query.itemType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.sourceRequirementId ? { sourceRequirementId: query.sourceRequirementId } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return { items: page.items.map(toDeliveryItemResponse), pageInfo: page.pageInfo };
  }

  async getDeliveryItem(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    itemId: string,
  ): Promise<DeliveryItemResponse> {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    const row = await this.repository.findDeliveryItemById(
      handle,
      session.user.organizationId,
      projectId,
      runId,
      itemId,
    );
    if (!row) {
      throw new NotFoundException({
        code: apiErrorCodes.aiArtifactNotFound,
        message: "Delivery-item artifact not found for this run.",
      });
    }
    return toDeliveryItemResponse(row);
  }

  async listCoverage(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    query: CoverageListFilter,
  ) {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    await this.ensureRunScoped(handle, session.user.organizationId, projectId, runId);
    const rows = await this.repository.listCoverageEntries(
      handle,
      session.user.organizationId,
      projectId,
      runId,
      {
        ...(query.status ? { status: query.status } : {}),
        ...(query.categoryKey ? { categoryKey: query.categoryKey } : {}),
      },
    );
    return { items: rows.map(toCoverageResponse) };
  }

  async listCitations(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    query: CitationListFilter,
  ) {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    await this.ensureRunScoped(handle, session.user.organizationId, projectId, runId);
    const cursor = query.cursor
      ? decodeTimeCursor(query.cursor, "Invalid citation cursor.")
      : undefined;
    const page = await this.repository.listCitations(handle, {
      organizationId: session.user.organizationId,
      projectId,
      runId,
      limit: query.limit,
      ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
      ...(query.requirementId ? { requirementId: query.requirementId } : {}),
      ...(query.coverageMatrixEntryId
        ? { coverageMatrixEntryId: query.coverageMatrixEntryId }
        : {}),
      ...(query.deliveryItemId ? { deliveryItemId: query.deliveryItemId } : {}),
      ...(query.sourceDocumentId ? { sourceDocumentId: query.sourceDocumentId } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return { items: page.items.map(toCitationResponse), pageInfo: page.pageInfo };
  }

  async getCitationEvidence(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    citationId: string,
  ): Promise<CitationEvidenceResponse> {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    const row = await this.repository.findCitationEvidenceById(
      handle,
      session.user.organizationId,
      projectId,
      runId,
      citationId,
    );
    if (!row) {
      throw new NotFoundException({
        code: apiErrorCodes.aiArtifactNotFound,
        message: "Citation evidence not found for this run.",
      });
    }
    return toCitationEvidenceResponse(row);
  }

  async listTraceability(
    session: RequestSessionContext,
    projectId: string,
    runId: string,
    query: TraceabilityListFilter,
  ): Promise<TraceabilityListResponse> {
    this.assertReadsEnabled();
    const handle = this.requireDb() as RequirementAnalysisQueryHandle;
    await this.ensureRunScoped(handle, session.user.organizationId, projectId, runId);
    const cursor = query.cursor
      ? decodeTimeCursor(query.cursor, "Invalid traceability cursor.")
      : undefined;
    const page = await this.repository.listTraceabilityLinks(handle, {
      organizationId: session.user.organizationId,
      runId,
      limit: query.limit,
      ...(query.relation ? { relation: query.relation } : {}),
      ...(cursor ? { cursor } : {}),
    });
    return {
      items: page.items.map(toTraceabilityLinkResponse),
      pageInfo: page.pageInfo,
    };
  }
}
