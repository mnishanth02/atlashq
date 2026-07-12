import type {
  AiRunCost,
  Citation,
  CoverageMatrixEntry,
  DeliveryItem,
  NewCitation,
  NewCoverageMatrixEntry,
  NewDeliveryItem,
  NewRequirement,
  OrganizationAiProviderPolicy,
  Requirement,
  RequirementAnalysisBatch,
  RequirementAnalysisRun,
  RequirementAnalysisSnapshot,
  RequirementAnalysisSnapshotChunk,
  RequirementAnalysisStage,
} from "@atlashq/db";
import type { AnalysisStageKind, AnalysisStageStatus, JsonObject } from "@atlashq/types";
import type { WorkerAuditInput as ImportedWorkerAuditInput } from "../../runtime/audit.js";

/** Scoping tuple every Module 3 repository call is anchored to (module-03 §6.2, tenant isolation). */
export type AnalysisScope = {
  organizationId: string;
  projectId: string;
  runId: string;
};

export type EligibleSnapshotSourceCandidate = {
  sourceDocumentId: string;
  lineageId: string;
  versionNumber: number;
  contentHash: string;
  sourceExtractionId: string;
  extractionVersion: number;
  chunkerVersion: string;
  extractedTextHash: string | null;
  referenceArtifactId: string | null;
  referenceIpReviewStatus: string | null;
  isReference: boolean;
  files: readonly {
    sourceDocumentFileId: string;
    ordinal: number;
    sha256: string;
    objectVersionId: string;
  }[];
  chunks: readonly {
    sourceChunkId: string;
    sequence: number;
    contentHash: string;
    characterCount: number;
    locator: JsonObject;
    content: string;
  }[];
};

export type FreezeSnapshotInput = AnalysisScope & {
  eligibilityRulesVersion: string;
  includeReferenceFeatureExtraction: boolean;
  sourceDocumentIdFilter?: readonly string[];
};

export type FrozenSnapshotChunkRef = {
  snapshotChunkId: string;
  sourceDocumentId: string;
  sourceExtractionId: string;
  sourceVersionNumber: number;
  sourceContentHash: string;
  chunkerVersion: string;
  sourceChunkId: string;
  sourceOrder: number;
  sourceExtractionVersion: string;
  chunkSequence: number;
  chunkOrder: number;
  chunkContentHash: string;
  content: string;
  locator: JsonObject;
  origin: "source" | "reference";
};

export type FreezeSnapshotResult = {
  snapshot: RequirementAnalysisSnapshot;
  chunks: readonly FrozenSnapshotChunkRef[];
  excludedReferenceSourceDocumentIds: readonly string[];
};

export type CreateStageInput = AnalysisScope & {
  kind: AnalysisStageKind;
  idempotencyKey: string;
  attemptNumber?: number;
  inputHash?: string | null;
};

export type UpdateStageInput = {
  status: AnalysisStageStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  retryAfter?: Date | null;
  failureCode?: string | null;
  failureDetail?: string | null;
  outputHash?: string | null;
  /** Bumped by a derived stage's own bounded retry-exhaustion tracking (module-03 task: mid-stage
   * retry safety) whenever a transient model/persistence failure moves the stage to
   * `waiting_retry` -- independent of BullMQ's own `job.attemptsMade`, which this worker never
   * observes (see `stages/derived-common.ts#runDerivedModelStage`). */
  attemptNumber?: number;
};

export type CreateBatchInput = AnalysisScope & {
  stageId: string;
  batchOrder: number;
  sourceChunkStartSequence: number;
  sourceChunkEndSequence: number;
  inputTokenEstimate: number;
  maxOutputTokens: number;
  attemptNumber?: number;
  cacheKey?: string | null;
  cacheHitOfBatchId?: string | null;
  repairOfBatchId?: string | null;
  chunkIds: readonly string[];
};

export type UpdateBatchInput = {
  status: AnalysisStageStatus;
  aiRunId?: string | null;
  shapeOnlyRepairUsed?: boolean;
  failureCode?: string | null;
  failureDetail?: string | null;
};

export type InsertAiRunInput = {
  organizationId: string;
  projectId: string;
  agent: string;
  model: string;
  provider: string;
  promptVersion: string;
  inputArtifactVersions: readonly string[];
  output: JsonObject | null;
  runStatus: "planned" | "succeeded" | "failed";
  cost: AiRunCost | null;
};

export type CacheHit = {
  aiRunId: string;
  sourceBatchId: string;
  output: JsonObject;
};

export type FindExtractionCacheHitInput = {
  organizationId: string;
  cacheKey: string;
};

export type InsertRequirementInput = Omit<
  NewRequirement,
  "id" | "createdAt" | "updatedAt" | "confidenceReasonCodes"
> & {
  confidenceReasonCodes: readonly string[];
};

export type InsertCitationInput = Omit<NewCitation, "id" | "createdAt" | "locator"> & {
  locator: JsonObject;
};

export type InsertCoverageEntryInput = Omit<
  NewCoverageMatrixEntry,
  "id" | "createdAt" | "questionDeliveryItemId"
> & {
  questionDeliveryItemId?: string | null;
};

export type InsertDeliveryItemInput = Omit<
  NewDeliveryItem,
  "id" | "createdAt" | "updatedAt" | "confidenceReasonCodes" | "attributes"
> & {
  confidenceReasonCodes: readonly string[];
  attributes: JsonObject;
};

export type RunTransitionInput = {
  status: RequirementAnalysisRun["status"];
  startedAt?: Date | null;
  completedAt?: Date | null;
  failureCode?: string | null;
  failureDetail?: string | null;
  failureRetryable?: boolean | null;
  failedStageId?: string | null;
  sourceSnapshotId?: string | null;
  artifactCounts?: JsonObject;
  warningCodes?: readonly string[];
};

export type RecordRunUsageInput = {
  inputTokensDelta: number;
  outputTokensDelta: number;
  costUsdDelta: number;
};

export type UpdateRequirementClassificationInput = {
  epistemicStatus: Requirement["epistemicStatus"];
  confidenceBand: Requirement["confidenceBand"];
  confidenceReasonCodes: readonly string[];
  dedupeGroupKey?: string | null;
};

export type TraceabilityLinkInput = {
  organizationId: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
  createdBy?: string | null;
};

export type WorkerAuditInput = ImportedWorkerAuditInput;

/**
 * Storage port for the Module 3 analyzer DAG. Every stage/orchestrator function in
 * `apps/worker/src/requirement-analysis` depends only on this interface (never directly on
 * `@atlashq/db`'s drizzle client), so tests can inject `createInMemoryRequirementAnalysisRepository`
 * (module 3 fake DB) while `createDrizzleRequirementAnalysisRepository` backs production and
 * Testcontainers integration tests.
 */
export type RequirementAnalysisRepository = {
  getRun(runId: string): Promise<RequirementAnalysisRun | null>;
  transitionRun(runId: string, input: RunTransitionInput): Promise<RequirementAnalysisRun>;
  recordRunUsage(runId: string, input: RecordRunUsageInput): Promise<RequirementAnalysisRun>;
  isCancellationRequested(runId: string): Promise<boolean>;
  getApprovedProviderPolicy(policyId: string): Promise<OrganizationAiProviderPolicy | null>;

  listEligibleSnapshotCandidates(
    scope: Pick<AnalysisScope, "organizationId" | "projectId">,
    filter?: { sourceDocumentIdFilter?: readonly string[] },
  ): Promise<readonly EligibleSnapshotSourceCandidate[]>;
  freezeSnapshot(input: FreezeSnapshotInput): Promise<FreezeSnapshotResult>;
  getSnapshot(snapshotId: string): Promise<RequirementAnalysisSnapshot | null>;
  /** Crash/retry idempotency (module-03 task item 2): the snapshot table enforces a unique
   * `run_id` index, so a repeated `freeze_snapshot` attempt after the snapshot row already
   * committed -- but before stage/run bookkeeping finished -- must find and reuse it instead of
   * re-inserting (which would violate the unique index forever). */
  findSnapshotByRunId(runId: string): Promise<RequirementAnalysisSnapshot | null>;
  listSnapshotChunks(snapshotId: string): Promise<readonly FrozenSnapshotChunkRef[]>;

  createStage(input: CreateStageInput): Promise<RequirementAnalysisStage>;
  findStageByIdempotencyKey(idempotencyKey: string): Promise<RequirementAnalysisStage | null>;
  getStage(stageId: string): Promise<RequirementAnalysisStage | null>;
  updateStage(stageId: string, input: UpdateStageInput): Promise<RequirementAnalysisStage>;
  listStagesByRun(runId: string): Promise<readonly RequirementAnalysisStage[]>;
  createStageDependency(input: {
    scope: AnalysisScope;
    stageId: string;
    dependsOnStageId: string;
  }): Promise<void>;
  listStageDependencies(
    runId: string,
  ): Promise<readonly { stageId: string; dependsOnStageId: string }[]>;

  createBatch(input: CreateBatchInput): Promise<RequirementAnalysisBatch>;
  updateBatch(batchId: string, input: UpdateBatchInput): Promise<RequirementAnalysisBatch>;
  getBatch(batchId: string): Promise<RequirementAnalysisBatch | null>;
  listBatchesByStage(stageId: string): Promise<readonly RequirementAnalysisBatch[]>;
  listBatchChunkContents(batchId: string): Promise<readonly FrozenSnapshotChunkRef[]>;

  insertAiRun(input: InsertAiRunInput): Promise<string>;
  getAiRunOutput(aiRunId: string): Promise<JsonObject | null>;
  findExtractionCacheHit(input: FindExtractionCacheHitInput): Promise<CacheHit | null>;

  insertRequirementWithCitations(
    requirementInput: InsertRequirementInput,
    citations: readonly Omit<InsertCitationInput, "requirementId">[],
  ): Promise<Requirement>;
  insertCoverageEntryWithCitations(
    entryInput: InsertCoverageEntryInput,
    citations: readonly Omit<InsertCitationInput, "coverageMatrixEntryId">[],
  ): Promise<CoverageMatrixEntry>;
  insertDeliveryItemWithCitations(
    itemInput: InsertDeliveryItemInput,
    citations: readonly Omit<InsertCitationInput, "deliveryItemId">[],
  ): Promise<DeliveryItem>;
  linkCoverageQuestion(coverageEntryId: string, deliveryItemId: string): Promise<void>;
  updateRequirementClassification(
    requirementId: string,
    input: UpdateRequirementClassificationInput,
  ): Promise<Requirement>;

  listRequirementsByRun(runId: string): Promise<readonly Requirement[]>;
  listCitationsByRequirement(requirementId: string): Promise<readonly Citation[]>;
  listCoverageEntriesByRun(runId: string): Promise<readonly CoverageMatrixEntry[]>;
  listDeliveryItemsByRun(runId: string): Promise<readonly DeliveryItem[]>;

  recordTraceabilityLink(input: TraceabilityLinkInput): Promise<void>;
  recordAuditEvent(input: WorkerAuditInput): Promise<void>;
};
