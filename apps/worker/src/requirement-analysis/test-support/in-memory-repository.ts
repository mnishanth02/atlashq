import { hashCanonicalJson, sha256Hex } from "@atlashq/ai";
import type {
  Citation,
  CoverageMatrixEntry,
  DeliveryItem,
  OrganizationAiProviderPolicy,
  Requirement,
  RequirementAnalysisBatch,
  RequirementAnalysisRun,
  RequirementAnalysisSnapshot,
  RequirementAnalysisStage,
} from "@atlashq/db";
import type { AnalysisStageStatus, JsonObject } from "@atlashq/types";
import { NoEligibleSourcesError, RequirementAnalysisInvalidStateError } from "../errors.js";
import type {
  CacheHit,
  CreateBatchInput,
  CreateStageInput,
  EligibleSnapshotSourceCandidate,
  FindExtractionCacheHitInput,
  FreezeSnapshotInput,
  FreezeSnapshotResult,
  FrozenSnapshotChunkRef,
  InsertAiRunInput,
  InsertCitationInput,
  InsertCoverageEntryInput,
  InsertDeliveryItemInput,
  InsertRequirementInput,
  RecordRunUsageInput,
  RequirementAnalysisRepository,
  RunTransitionInput,
  TraceabilityLinkInput,
  UpdateBatchInput,
  UpdateStageInput,
  WorkerAuditInput,
} from "../repository/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Every side effect the in-memory fake recorded, exposed purely for test assertions (never read
 * by production code) -- e.g. task item 9's "logs without raw content" is verified by asserting on
 * `auditEvents` directly rather than parsing log output.
 */
export type InMemoryRequirementAnalysisRepository = RequirementAnalysisRepository & {
  seedRun(run: RequirementAnalysisRun): void;
  seedProviderPolicy(policy: OrganizationAiProviderPolicy): void;
  seedEligibleCandidates(candidates: readonly EligibleSnapshotSourceCandidate[]): void;
  seedCacheHit(cacheKey: string, hit: CacheHit): void;
  setCancellationRequested(runId: string, requested: boolean): void;
  auditEvents: WorkerAuditInput[];
  traceabilityLinks: TraceabilityLinkInput[];
  runs: Map<string, RequirementAnalysisRun>;
  stages: Map<string, RequirementAnalysisStage>;
  batches: Map<string, RequirementAnalysisBatch>;
  requirements: Map<string, Requirement>;
  citations: Map<string, Citation>;
  coverageEntries: Map<string, CoverageMatrixEntry>;
  deliveryItems: Map<string, DeliveryItem>;
};

/**
 * In-memory, dependency-free implementation of {@link RequirementAnalysisRepository} (module-03
 * worker task item 9: "tests with fake DB/provider/queues"). Mirrors the relational invariants
 * `createDrizzleRequirementAnalysisRepository` enforces via real constraints/transactions (stage
 * idempotency-key uniqueness, one-batch-per-stage-order, exactly-one-citation-target) with plain
 * JS Maps so DAG/idempotency/cancellation/finalization tests never require Postgres.
 */
export function createInMemoryRequirementAnalysisRepository(): InMemoryRequirementAnalysisRepository {
  const runs = new Map<string, RequirementAnalysisRun>();
  const providerPolicies = new Map<string, OrganizationAiProviderPolicy>();
  const cancellationRequested = new Set<string>();
  const snapshots = new Map<string, RequirementAnalysisSnapshot>();
  const snapshotChunksById = new Map<string, Map<string, FrozenSnapshotChunkRef>>();
  const stages = new Map<string, RequirementAnalysisStage>();
  const stagesByIdempotencyKey = new Map<string, string>();
  const stageDependencies: { stageId: string; dependsOnStageId: string }[] = [];
  const batches = new Map<string, RequirementAnalysisBatch>();
  const batchChunkIds = new Map<string, string[]>();
  const aiRuns = new Map<string, { output: JsonObject | null }>();
  const cacheHits = new Map<string, CacheHit>();
  const requirements = new Map<string, Requirement>();
  const citations = new Map<string, Citation>();
  const coverageEntries = new Map<string, CoverageMatrixEntry>();
  const deliveryItems = new Map<string, DeliveryItem>();
  let eligibleCandidates: readonly EligibleSnapshotSourceCandidate[] = [];
  const auditEvents: WorkerAuditInput[] = [];
  const traceabilityLinks: TraceabilityLinkInput[] = [];

  function requireRun(runId: string): RequirementAnalysisRun {
    const run = runs.get(runId);
    if (!run) {
      throw new RequirementAnalysisInvalidStateError(`Run "${runId}" does not exist.`);
    }
    return run;
  }

  const repository: InMemoryRequirementAnalysisRepository = {
    runs,
    stages,
    batches,
    requirements,
    citations,
    coverageEntries,
    deliveryItems,
    auditEvents,
    traceabilityLinks,

    seedRun(run) {
      runs.set(run.id, run);
    },
    seedProviderPolicy(policy) {
      providerPolicies.set(policy.id, policy);
    },
    seedEligibleCandidates(candidates) {
      eligibleCandidates = candidates;
    },
    seedCacheHit(cacheKey, hit) {
      cacheHits.set(cacheKey, hit);
    },
    setCancellationRequested(runId, requested) {
      if (requested) {
        cancellationRequested.add(runId);
      } else {
        cancellationRequested.delete(runId);
      }
    },

    async getRun(runId) {
      return runs.get(runId) ?? null;
    },
    async transitionRun(runId, input: RunTransitionInput) {
      const run = requireRun(runId);
      const updated: RequirementAnalysisRun = {
        ...run,
        status: input.status,
        ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
        ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
        ...(input.failureCode !== undefined ? { failureCode: input.failureCode } : {}),
        ...(input.failureDetail !== undefined ? { failureDetail: input.failureDetail } : {}),
        ...(input.failureRetryable !== undefined
          ? { failureRetryable: input.failureRetryable }
          : {}),
        ...(input.failedStageId !== undefined ? { failedStageId: input.failedStageId } : {}),
        ...(input.sourceSnapshotId !== undefined
          ? { sourceSnapshotId: input.sourceSnapshotId }
          : {}),
        ...(input.artifactCounts !== undefined ? { artifactCounts: input.artifactCounts } : {}),
        ...(input.warningCodes !== undefined ? { warningCodes: [...input.warningCodes] } : {}),
      };
      if (
        updated.status === "failed" &&
        (updated.failureCode === null || updated.failureRetryable === null)
      ) {
        throw new RequirementAnalysisInvalidStateError(
          "Failed runs require non-null failureCode and failureRetryable values.",
        );
      }
      runs.set(runId, updated);
      return updated;
    },
    async recordRunUsage(runId, input: RecordRunUsageInput) {
      const run = requireRun(runId);
      const updated: RequirementAnalysisRun = {
        ...run,
        inputTokensUsed: run.inputTokensUsed + input.inputTokensDelta,
        outputTokensUsed: run.outputTokensUsed + input.outputTokensDelta,
        costUsd: run.costUsd + input.costUsdDelta,
      };
      runs.set(runId, updated);
      return updated;
    },
    async isCancellationRequested(runId) {
      return cancellationRequested.has(runId);
    },
    async getApprovedProviderPolicy(policyId) {
      return providerPolicies.get(policyId) ?? null;
    },

    async listEligibleSnapshotCandidates(_scope, filter) {
      if (!filter?.sourceDocumentIdFilter) {
        return eligibleCandidates;
      }
      const allowed = new Set(filter.sourceDocumentIdFilter);
      return eligibleCandidates.filter((candidate) => allowed.has(candidate.sourceDocumentId));
    },
    async freezeSnapshot(input: FreezeSnapshotInput) {
      return freezeSnapshotInMemory({ snapshots, snapshotChunksById }, eligibleCandidates, input);
    },
    async getSnapshot(snapshotId) {
      return snapshots.get(snapshotId) ?? null;
    },
    async findSnapshotByRunId(runId) {
      for (const snapshot of snapshots.values()) {
        if (snapshot.runId === runId) {
          return snapshot;
        }
      }
      return null;
    },
    async listSnapshotChunks(snapshotId) {
      const chunks = snapshotChunksById.get(snapshotId);
      return chunks ? [...chunks.values()] : [];
    },

    async createStage(input: CreateStageInput) {
      const existingId = stagesByIdempotencyKey.get(input.idempotencyKey);
      if (existingId) {
        const existing = stages.get(existingId);
        if (existing) {
          return existing;
        }
      }
      const stage: RequirementAnalysisStage = {
        id: nextId("stage"),
        runId: input.runId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        kind: input.kind,
        status: "pending",
        attemptNumber: input.attemptNumber ?? 1,
        idempotencyKey: input.idempotencyKey,
        inputHash: input.inputHash ?? null,
        outputHash: null,
        startedAt: null,
        completedAt: null,
        retryAfter: null,
        failureCode: null,
        failureDetail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      stages.set(stage.id, stage);
      stagesByIdempotencyKey.set(input.idempotencyKey, stage.id);
      return stage;
    },
    async findStageByIdempotencyKey(idempotencyKey) {
      const stageId = stagesByIdempotencyKey.get(idempotencyKey);
      return stageId ? (stages.get(stageId) ?? null) : null;
    },
    async getStage(stageId) {
      return stages.get(stageId) ?? null;
    },
    async updateStage(stageId, input: UpdateStageInput) {
      const stage = stages.get(stageId);
      if (!stage) {
        throw new RequirementAnalysisInvalidStateError(
          `Stage "${stageId}" was not found for a status update.`,
        );
      }
      const updated: RequirementAnalysisStage = {
        ...stage,
        status: input.status as AnalysisStageStatus,
        ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
        ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
        ...(input.retryAfter !== undefined ? { retryAfter: input.retryAfter } : {}),
        ...(input.failureCode !== undefined ? { failureCode: input.failureCode } : {}),
        ...(input.failureDetail !== undefined ? { failureDetail: input.failureDetail } : {}),
        ...(input.outputHash !== undefined ? { outputHash: input.outputHash } : {}),
        ...(input.attemptNumber !== undefined ? { attemptNumber: input.attemptNumber } : {}),
      };
      stages.set(stageId, updated);
      return updated;
    },
    async listStagesByRun(runId) {
      return [...stages.values()].filter((stage) => stage.runId === runId);
    },
    async createStageDependency(input) {
      const exists = stageDependencies.some(
        (dependency) =>
          dependency.stageId === input.stageId &&
          dependency.dependsOnStageId === input.dependsOnStageId,
      );
      if (!exists) {
        stageDependencies.push({
          stageId: input.stageId,
          dependsOnStageId: input.dependsOnStageId,
        });
      }
    },
    async listStageDependencies(runId) {
      const runStageIds = new Set(
        [...stages.values()].filter((stage) => stage.runId === runId).map((stage) => stage.id),
      );
      return stageDependencies.filter((dependency) => runStageIds.has(dependency.stageId));
    },

    async createBatch(input: CreateBatchInput) {
      const batch: RequirementAnalysisBatch = {
        id: nextId("batch"),
        stageId: input.stageId,
        runId: input.runId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        batchOrder: input.batchOrder,
        sourceChunkStartSequence: input.sourceChunkStartSequence,
        sourceChunkEndSequence: input.sourceChunkEndSequence,
        inputTokenEstimate: input.inputTokenEstimate,
        maxOutputTokens: input.maxOutputTokens,
        status: "pending",
        attemptNumber: input.attemptNumber ?? 1,
        aiRunId: null,
        repairOfBatchId: input.repairOfBatchId ?? null,
        shapeOnlyRepairUsed: false,
        cacheKey: input.cacheKey ?? null,
        cacheHitOfBatchId: input.cacheHitOfBatchId ?? null,
        failureCode: null,
        failureDetail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      batches.set(batch.id, batch);
      batchChunkIds.set(batch.id, [...input.chunkIds]);
      return batch;
    },
    async updateBatch(batchId, input: UpdateBatchInput) {
      const batch = batches.get(batchId);
      if (!batch) {
        throw new RequirementAnalysisInvalidStateError(
          `Batch "${batchId}" was not found for a status update.`,
        );
      }
      const updated: RequirementAnalysisBatch = {
        ...batch,
        status: input.status as AnalysisStageStatus,
        ...(input.aiRunId !== undefined ? { aiRunId: input.aiRunId } : {}),
        ...(input.shapeOnlyRepairUsed !== undefined
          ? { shapeOnlyRepairUsed: input.shapeOnlyRepairUsed }
          : {}),
        ...(input.failureCode !== undefined ? { failureCode: input.failureCode } : {}),
        ...(input.failureDetail !== undefined ? { failureDetail: input.failureDetail } : {}),
      };
      batches.set(batchId, updated);
      return updated;
    },
    async getBatch(batchId) {
      return batches.get(batchId) ?? null;
    },
    async listBatchesByStage(stageId) {
      return [...batches.values()].filter((batch) => batch.stageId === stageId);
    },
    async listBatchChunkContents(batchId) {
      const batch = batches.get(batchId);
      if (!batch) {
        return [];
      }
      const chunkIds = batchChunkIds.get(batchId) ?? [];
      const run = runs.get(batch.runId);
      const snapshotId = run?.sourceSnapshotId;
      const chunksBySnapshotId = snapshotId ? snapshotChunksById.get(snapshotId) : undefined;
      if (!chunksBySnapshotId) {
        return [];
      }
      const result: FrozenSnapshotChunkRef[] = [];
      for (const chunkId of chunkIds) {
        const chunk = chunksBySnapshotId.get(chunkId);
        if (chunk) {
          result.push(chunk);
        }
      }
      return result;
    },

    async insertAiRun(input: InsertAiRunInput) {
      const id = nextId("ai-run");
      aiRuns.set(id, { output: input.output });
      return id;
    },
    async getAiRunOutput(aiRunId) {
      return aiRuns.get(aiRunId)?.output ?? null;
    },
    async findExtractionCacheHit(input: FindExtractionCacheHitInput) {
      return cacheHits.get(input.cacheKey) ?? null;
    },

    async insertRequirementWithCitations(requirementInput: InsertRequirementInput, citationInputs) {
      const requirementRow: Requirement = {
        id: nextId("requirement"),
        organizationId: requirementInput.organizationId,
        projectId: requirementInput.projectId,
        analysisRunId: requirementInput.analysisRunId,
        stableKey: requirementInput.stableKey,
        title: requirementInput.title,
        description: requirementInput.description ?? null,
        requirementType: requirementInput.requirementType,
        priority: requirementInput.priority ?? null,
        epistemicStatus: requirementInput.epistemicStatus,
        confidenceBand: requirementInput.confidenceBand ?? null,
        confidenceReasonCodes: [...requirementInput.confidenceReasonCodes],
        inferenceBasis: requirementInput.inferenceBasis ?? null,
        origin: requirementInput.origin,
        lifecycleState: requirementInput.lifecycleState ?? "ai_suggested",
        dedupeGroupKey: requirementInput.dedupeGroupKey ?? null,
        parentRequirementId: requirementInput.parentRequirementId ?? null,
        sourceSummary: requirementInput.sourceSummary ?? null,
        createdByAiRunId: requirementInput.createdByAiRunId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      requirements.set(requirementRow.id, requirementRow);
      for (const citationInput of citationInputs) {
        insertCitationRow(citations, { ...citationInput, requirementId: requirementRow.id });
      }
      return requirementRow;
    },
    async insertCoverageEntryWithCitations(entryInput: InsertCoverageEntryInput, citationInputs) {
      const entryRow: CoverageMatrixEntry = {
        id: nextId("coverage-entry"),
        organizationId: entryInput.organizationId,
        projectId: entryInput.projectId,
        analysisRunId: entryInput.analysisRunId,
        categoryKey: entryInput.categoryKey,
        categoryLabel: entryInput.categoryLabel,
        categoryOrder: entryInput.categoryOrder,
        status: entryInput.status,
        rationale: entryInput.rationale ?? null,
        evidenceState: entryInput.evidenceState,
        questionDeliveryItemId: entryInput.questionDeliveryItemId ?? null,
        createdByAiRunId: entryInput.createdByAiRunId ?? null,
        createdAt: new Date(),
      };
      coverageEntries.set(entryRow.id, entryRow);
      for (const citationInput of citationInputs) {
        insertCitationRow(citations, {
          ...citationInput,
          coverageMatrixEntryId: entryRow.id,
        });
      }
      return entryRow;
    },
    async insertDeliveryItemWithCitations(itemInput: InsertDeliveryItemInput, citationInputs) {
      const itemRow: DeliveryItem = {
        id: nextId("delivery-item"),
        organizationId: itemInput.organizationId,
        projectId: itemInput.projectId,
        analysisRunId: itemInput.analysisRunId,
        itemType: itemInput.itemType,
        title: itemInput.title,
        description: itemInput.description ?? null,
        epistemicStatus: itemInput.epistemicStatus,
        confidenceBand: itemInput.confidenceBand ?? null,
        confidenceReasonCodes: [...itemInput.confidenceReasonCodes],
        severity: itemInput.severity ?? null,
        priority: itemInput.priority ?? null,
        status: itemInput.status ?? "open",
        visibility: itemInput.visibility ?? "internal",
        attributes: itemInput.attributes,
        sourceRequirementId: itemInput.sourceRequirementId ?? null,
        createdByAiRunId: itemInput.createdByAiRunId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      deliveryItems.set(itemRow.id, itemRow);
      for (const citationInput of citationInputs) {
        insertCitationRow(citations, { ...citationInput, deliveryItemId: itemRow.id });
      }
      return itemRow;
    },
    async linkCoverageQuestion(coverageEntryId, deliveryItemId) {
      const entry = coverageEntries.get(coverageEntryId);
      if (!entry) {
        throw new RequirementAnalysisInvalidStateError(
          `Coverage entry "${coverageEntryId}" does not exist.`,
        );
      }
      coverageEntries.set(coverageEntryId, { ...entry, questionDeliveryItemId: deliveryItemId });
    },
    async updateRequirementClassification(requirementId, input) {
      const requirementRow = requirements.get(requirementId);
      if (!requirementRow) {
        throw new RequirementAnalysisInvalidStateError(
          `Requirement "${requirementId}" does not exist.`,
        );
      }
      const updated: Requirement = {
        ...requirementRow,
        epistemicStatus: input.epistemicStatus,
        confidenceBand: input.confidenceBand,
        confidenceReasonCodes: [...input.confidenceReasonCodes],
        ...(input.dedupeGroupKey !== undefined ? { dedupeGroupKey: input.dedupeGroupKey } : {}),
      };
      requirements.set(requirementId, updated);
      return updated;
    },

    async listRequirementsByRun(runId) {
      return [...requirements.values()].filter((row) => row.analysisRunId === runId);
    },
    async listCitationsByRequirement(requirementId) {
      return [...citations.values()].filter((row) => row.requirementId === requirementId);
    },
    async listCoverageEntriesByRun(runId) {
      return [...coverageEntries.values()].filter((row) => row.analysisRunId === runId);
    },
    async listDeliveryItemsByRun(runId) {
      return [...deliveryItems.values()].filter((row) => row.analysisRunId === runId);
    },

    async recordTraceabilityLink(input: TraceabilityLinkInput) {
      traceabilityLinks.push(input);
    },
    async recordAuditEvent(input: WorkerAuditInput) {
      auditEvents.push(input);
    },
  };

  return repository;
}

function insertCitationRow(
  citations: Map<string, Citation>,
  input: Omit<InsertCitationInput, never> & {
    requirementId?: string | null | undefined;
    coverageMatrixEntryId?: string | null | undefined;
    deliveryItemId?: string | null | undefined;
  },
): Citation {
  const row: Citation = {
    id: nextId("citation"),
    createdAt: new Date(),
    requirementId: input.requirementId ?? null,
    coverageMatrixEntryId: input.coverageMatrixEntryId ?? null,
    deliveryItemId: input.deliveryItemId ?? null,
    organizationId: input.organizationId,
    projectId: input.projectId,
    analysisRunId: input.analysisRunId,
    sourceDocumentId: input.sourceDocumentId,
    sourceVersionNumber: input.sourceVersionNumber,
    sourceContentHash: input.sourceContentHash,
    sourceExtractionId: input.sourceExtractionId,
    sourceExtractionVersion: input.sourceExtractionVersion,
    sourceChunkId: input.sourceChunkId,
    sourceChunkSequence: input.sourceChunkSequence,
    chunkContentHash: input.chunkContentHash,
    locator: input.locator,
    quoteTextOriginal: input.quoteTextOriginal,
    quoteTextNormalized: input.quoteTextNormalized,
    quoteHash: input.quoteHash,
    matchStartOffset: input.matchStartOffset,
    matchEndOffset: input.matchEndOffset,
    normalizationMode: input.normalizationMode,
    verificationStatus: input.verificationStatus,
    createdByAiRunId: input.createdByAiRunId ?? null,
  };
  citations.set(row.id, row);
  return row;
}

function freezeSnapshotInMemory(
  store: {
    snapshots: Map<string, RequirementAnalysisSnapshot>;
    snapshotChunksById: Map<string, Map<string, FrozenSnapshotChunkRef>>;
  },
  eligibleCandidates: readonly EligibleSnapshotSourceCandidate[],
  input: FreezeSnapshotInput,
): FreezeSnapshotResult {
  const excludedReferenceSourceDocumentIds: string[] = [];
  const candidates = input.sourceDocumentIdFilter
    ? eligibleCandidates.filter((candidate) =>
        input.sourceDocumentIdFilter?.includes(candidate.sourceDocumentId),
      )
    : eligibleCandidates;

  const frozenCandidates = candidates.filter((candidate) => {
    if (candidate.isReference && !input.includeReferenceFeatureExtraction) {
      excludedReferenceSourceDocumentIds.push(candidate.sourceDocumentId);
      return false;
    }
    return true;
  });

  if (frozenCandidates.length === 0) {
    throw new NoEligibleSourcesError(
      `No eligible sources are available to freeze for project ${input.projectId}.`,
    );
  }

  const sourceManifests = frozenCandidates.map((candidate) => ({
    sourceDocumentId: candidate.sourceDocumentId,
    sourceExtractionId: candidate.sourceExtractionId,
    contentHash: candidate.contentHash,
    chunkContentHashes: candidate.chunks.map((chunk) => chunk.contentHash),
  }));
  const snapshotHash = hashCanonicalJson({ sources: sourceManifests });
  const totalCharacterCount = frozenCandidates.reduce(
    (sum, candidate) =>
      sum + candidate.chunks.reduce((chunkSum, chunk) => chunkSum + chunk.characterCount, 0),
    0,
  );
  const totalChunkCount = frozenCandidates.reduce(
    (sum, candidate) => sum + candidate.chunks.length,
    0,
  );

  const snapshot: RequirementAnalysisSnapshot = {
    id: nextId("snapshot"),
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId: input.runId,
    snapshotHash,
    sourceCount: frozenCandidates.length,
    chunkCount: totalChunkCount,
    totalCharacterCount,
    eligibilityRulesVersion: input.eligibilityRulesVersion,
    createdAt: new Date(),
  };
  store.snapshots.set(snapshot.id, snapshot);

  const chunkRefs: FrozenSnapshotChunkRef[] = [];
  const chunksById = new Map<string, FrozenSnapshotChunkRef>();
  for (const [sourceOrder, candidate] of frozenCandidates.entries()) {
    for (const [chunkOrder, chunk] of candidate.chunks.entries()) {
      const ref: FrozenSnapshotChunkRef = {
        snapshotChunkId: nextId("snapshot-chunk"),
        sourceDocumentId: candidate.sourceDocumentId,
        sourceExtractionId: candidate.sourceExtractionId,
        sourceVersionNumber: candidate.versionNumber,
        sourceContentHash: candidate.contentHash,
        chunkerVersion: candidate.chunkerVersion,
        sourceChunkId: chunk.sourceChunkId,
        sourceOrder,
        sourceExtractionVersion: String(candidate.extractionVersion),
        chunkSequence: chunk.sequence,
        chunkOrder,
        chunkContentHash: chunk.contentHash,
        content: chunk.content,
        locator: chunk.locator,
        origin: candidate.isReference ? "reference" : "source",
      };
      chunkRefs.push(ref);
      chunksById.set(ref.snapshotChunkId, ref);
    }
  }
  store.snapshotChunksById.set(snapshot.id, chunksById);

  return { snapshot, chunks: chunkRefs, excludedReferenceSourceDocumentIds };
}

/** Re-exported so tests can build deterministic hashes the same way the real freeze path does. */
export { sha256Hex };
