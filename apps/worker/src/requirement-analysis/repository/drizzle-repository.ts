import { randomUUID } from "node:crypto";
import {
  type AiRunCost,
  aiRun,
  citation,
  coverageMatrixEntry,
  type Database,
  deliveryItem,
  organizationAiProviderPolicy,
  referenceArtifact,
  requirement,
  requirementAnalysisBatch,
  requirementAnalysisBatchChunk,
  requirementAnalysisRun,
  requirementAnalysisSnapshot,
  requirementAnalysisSnapshotChunk,
  requirementAnalysisSnapshotFile,
  requirementAnalysisSnapshotSource,
  requirementAnalysisStage,
  requirementAnalysisStageDependency,
  sourceChunk,
  sourceDocument,
  sourceDocumentFile,
  sourceExtraction,
  traceabilityLink,
} from "@atlashq/db";
import type { JsonObject } from "@atlashq/types";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { recordWorkerAuditEvent } from "../../runtime/audit.js";
import { NoEligibleSourcesError, RequirementAnalysisInvalidStateError } from "../errors.js";
import type {
  AnalysisScope,
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
} from "./types.js";

function toJsonObject(value: JsonObject | null | undefined): JsonObject {
  return value ?? {};
}

/**
 * Real Postgres-backed implementation of {@link RequirementAnalysisRepository} against the
 * Module 3 tables in `@atlashq/db` (module-03 §9). Every write that must be atomic with a
 * deferred-constraint-trigger-guarded invariant (a `confirmed` requirement's citation, a
 * `partial`/`absent` coverage row's later question link, batch/stage/dependency scoping) uses
 * `db.transaction` so a crash never leaves a half-committed row the append-only guards would then
 * make impossible to repair (`packages/db/src/requirement-analysis-guard.test.ts`).
 */
export function createDrizzleRequirementAnalysisRepository(
  db: Database,
): RequirementAnalysisRepository {
  return {
    async getRun(runId) {
      const rows = await db
        .select()
        .from(requirementAnalysisRun)
        .where(eq(requirementAnalysisRun.id, runId))
        .limit(1);
      return rows[0] ?? null;
    },

    async transitionRun(runId, input: RunTransitionInput) {
      const updated = await db
        .update(requirementAnalysisRun)
        .set({
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
        })
        .where(eq(requirementAnalysisRun.id, runId))
        .returning();

      const row = updated[0];
      if (!row) {
        throw new RequirementAnalysisInvalidStateError(
          `requirement_analysis_run ${runId} was not found for a status transition.`,
        );
      }
      return row;
    },

    async recordRunUsage(runId, input: RecordRunUsageInput) {
      const updated = await db
        .update(requirementAnalysisRun)
        .set({
          inputTokensUsed: sql`${requirementAnalysisRun.inputTokensUsed} + ${input.inputTokensDelta}`,
          outputTokensUsed: sql`${requirementAnalysisRun.outputTokensUsed} + ${input.outputTokensDelta}`,
          costUsd: sql`${requirementAnalysisRun.costUsd} + ${input.costUsdDelta}`,
        })
        .where(eq(requirementAnalysisRun.id, runId))
        .returning();

      const row = updated[0];
      if (!row) {
        throw new RequirementAnalysisInvalidStateError(
          `requirement_analysis_run ${runId} was not found for a usage update.`,
        );
      }
      return row;
    },

    async isCancellationRequested(runId) {
      const rows = await db
        .select({ cancelRequestedAt: requirementAnalysisRun.cancelRequestedAt })
        .from(requirementAnalysisRun)
        .where(eq(requirementAnalysisRun.id, runId))
        .limit(1);
      return rows[0]?.cancelRequestedAt !== null && rows[0]?.cancelRequestedAt !== undefined;
    },

    async getApprovedProviderPolicy(policyId) {
      const rows = await db
        .select()
        .from(organizationAiProviderPolicy)
        .where(eq(organizationAiProviderPolicy.id, policyId))
        .limit(1);
      return rows[0] ?? null;
    },

    async listEligibleSnapshotCandidates(scope, filter) {
      return listEligibleSnapshotCandidates(db, scope, filter);
    },

    async freezeSnapshot(input: FreezeSnapshotInput) {
      return freezeSnapshot(db, input);
    },

    async getSnapshot(snapshotId) {
      const rows = await db
        .select()
        .from(requirementAnalysisSnapshot)
        .where(eq(requirementAnalysisSnapshot.id, snapshotId))
        .limit(1);
      return rows[0] ?? null;
    },

    async findSnapshotByRunId(runId) {
      const rows = await db
        .select()
        .from(requirementAnalysisSnapshot)
        .where(eq(requirementAnalysisSnapshot.runId, runId))
        .limit(1);
      return rows[0] ?? null;
    },

    async listSnapshotChunks(snapshotId) {
      return listSnapshotChunks(db, snapshotId);
    },

    async createStage(input: CreateStageInput) {
      const rows = await db
        .insert(requirementAnalysisStage)
        .values({
          id: randomUUID(),
          runId: input.runId,
          organizationId: input.organizationId,
          projectId: input.projectId,
          kind: input.kind,
          status: "pending",
          attemptNumber: input.attemptNumber ?? 1,
          idempotencyKey: input.idempotencyKey,
          inputHash: input.inputHash ?? null,
        })
        .onConflictDoNothing({ target: requirementAnalysisStage.idempotencyKey })
        .returning();

      const row = rows[0];
      if (row) {
        return row;
      }

      const existing = await db
        .select()
        .from(requirementAnalysisStage)
        .where(eq(requirementAnalysisStage.idempotencyKey, input.idempotencyKey))
        .limit(1);
      const existingRow = existing[0];
      if (!existingRow) {
        throw new RequirementAnalysisInvalidStateError(
          `Stage idempotency key ${input.idempotencyKey} conflicted but no row could be re-read.`,
        );
      }
      return existingRow;
    },

    async findStageByIdempotencyKey(idempotencyKey) {
      const rows = await db
        .select()
        .from(requirementAnalysisStage)
        .where(eq(requirementAnalysisStage.idempotencyKey, idempotencyKey))
        .limit(1);
      return rows[0] ?? null;
    },

    async getStage(stageId) {
      const rows = await db
        .select()
        .from(requirementAnalysisStage)
        .where(eq(requirementAnalysisStage.id, stageId))
        .limit(1);
      return rows[0] ?? null;
    },

    async updateStage(stageId, input: UpdateStageInput) {
      const updated = await db
        .update(requirementAnalysisStage)
        .set({
          status: input.status,
          ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
          ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
          ...(input.retryAfter !== undefined ? { retryAfter: input.retryAfter } : {}),
          ...(input.failureCode !== undefined ? { failureCode: input.failureCode } : {}),
          ...(input.failureDetail !== undefined ? { failureDetail: input.failureDetail } : {}),
          ...(input.outputHash !== undefined ? { outputHash: input.outputHash } : {}),
          ...(input.attemptNumber !== undefined ? { attemptNumber: input.attemptNumber } : {}),
        })
        .where(eq(requirementAnalysisStage.id, stageId))
        .returning();

      const row = updated[0];
      if (!row) {
        throw new RequirementAnalysisInvalidStateError(
          `requirement_analysis_stage ${stageId} was not found for a status update.`,
        );
      }
      return row;
    },

    async listStagesByRun(runId) {
      return db
        .select()
        .from(requirementAnalysisStage)
        .where(eq(requirementAnalysisStage.runId, runId));
    },

    async createStageDependency(input) {
      await db
        .insert(requirementAnalysisStageDependency)
        .values({
          stageId: input.stageId,
          dependsOnStageId: input.dependsOnStageId,
          runId: input.scope.runId,
          organizationId: input.scope.organizationId,
          projectId: input.scope.projectId,
        })
        .onConflictDoNothing();
    },

    async listStageDependencies(runId) {
      const rows = await db
        .select({
          stageId: requirementAnalysisStageDependency.stageId,
          dependsOnStageId: requirementAnalysisStageDependency.dependsOnStageId,
        })
        .from(requirementAnalysisStageDependency)
        .where(eq(requirementAnalysisStageDependency.runId, runId));
      return rows;
    },

    async createBatch(input: CreateBatchInput) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(requirementAnalysisBatch)
          .values({
            id: randomUUID(),
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
            cacheKey: input.cacheKey ?? null,
            cacheHitOfBatchId: input.cacheHitOfBatchId ?? null,
            repairOfBatchId: input.repairOfBatchId ?? null,
          })
          .returning();

        const batch = inserted[0];
        if (!batch) {
          throw new RequirementAnalysisInvalidStateError("Failed to insert analysis batch.");
        }

        if (input.chunkIds.length > 0) {
          await tx.insert(requirementAnalysisBatchChunk).values(
            input.chunkIds.map((snapshotChunkId, chunkOrder) => ({
              batchId: batch.id,
              snapshotChunkId,
              chunkOrder,
              organizationId: input.organizationId,
              projectId: input.projectId,
            })),
          );
        }

        return batch;
      });
    },

    async updateBatch(batchId, input: UpdateBatchInput) {
      const updated = await db
        .update(requirementAnalysisBatch)
        .set({
          status: input.status,
          ...(input.aiRunId !== undefined ? { aiRunId: input.aiRunId } : {}),
          ...(input.shapeOnlyRepairUsed !== undefined
            ? { shapeOnlyRepairUsed: input.shapeOnlyRepairUsed }
            : {}),
          ...(input.failureCode !== undefined ? { failureCode: input.failureCode } : {}),
          ...(input.failureDetail !== undefined ? { failureDetail: input.failureDetail } : {}),
        })
        .where(eq(requirementAnalysisBatch.id, batchId))
        .returning();

      const row = updated[0];
      if (!row) {
        throw new RequirementAnalysisInvalidStateError(
          `requirement_analysis_batch ${batchId} was not found for a status update.`,
        );
      }
      return row;
    },

    async getBatch(batchId) {
      const rows = await db
        .select()
        .from(requirementAnalysisBatch)
        .where(eq(requirementAnalysisBatch.id, batchId))
        .limit(1);
      return rows[0] ?? null;
    },

    async listBatchesByStage(stageId) {
      return db
        .select()
        .from(requirementAnalysisBatch)
        .where(eq(requirementAnalysisBatch.stageId, stageId))
        .orderBy(asc(requirementAnalysisBatch.batchOrder));
    },

    async listBatchChunkContents(batchId) {
      return listBatchChunkContents(db, batchId);
    },

    async insertAiRun(input: InsertAiRunInput) {
      const rows = await db
        .insert(aiRun)
        .values({
          id: randomUUID(),
          organizationId: input.organizationId,
          projectId: input.projectId,
          agent: input.agent,
          model: input.model,
          provider: input.provider,
          promptVersion: input.promptVersion,
          inputArtifactVersions: [...input.inputArtifactVersions],
          output: input.output,
          runStatus: input.runStatus,
          cost: input.cost as AiRunCost | null,
          reviewStatus: "pending",
        })
        .returning({ id: aiRun.id });

      const row = rows[0];
      if (!row) {
        throw new RequirementAnalysisInvalidStateError("Failed to insert ai_run row.");
      }
      return row.id;
    },

    async findExtractionCacheHit(input: FindExtractionCacheHitInput): Promise<CacheHit | null> {
      const rows = await db
        .select({
          batchId: requirementAnalysisBatch.id,
          aiRunId: requirementAnalysisBatch.aiRunId,
          output: aiRun.output,
        })
        .from(requirementAnalysisBatch)
        .innerJoin(aiRun, eq(aiRun.id, requirementAnalysisBatch.aiRunId))
        .where(
          and(
            eq(requirementAnalysisBatch.organizationId, input.organizationId),
            eq(requirementAnalysisBatch.cacheKey, input.cacheKey),
            eq(requirementAnalysisBatch.status, "completed"),
          ),
        )
        .orderBy(desc(requirementAnalysisBatch.createdAt))
        .limit(1);

      const row = rows[0];
      if (!row || !row.aiRunId || !row.output) {
        return null;
      }
      return { aiRunId: row.aiRunId, sourceBatchId: row.batchId, output: row.output };
    },

    async getAiRunOutput(aiRunId) {
      const rows = await db
        .select({ output: aiRun.output })
        .from(aiRun)
        .where(eq(aiRun.id, aiRunId))
        .limit(1);
      return rows[0]?.output ?? null;
    },

    async insertRequirementWithCitations(requirementInput: InsertRequirementInput, citations) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(requirement)
          .values({
            id: randomUUID(),
            ...requirementInput,
            confidenceReasonCodes: [...requirementInput.confidenceReasonCodes],
          })
          .returning();
        const row = inserted[0];
        if (!row) {
          throw new RequirementAnalysisInvalidStateError("Failed to insert requirement.");
        }

        if (citations.length > 0) {
          await tx.insert(citation).values(
            citations.map((citationInput) => ({
              id: randomUUID(),
              ...citationInput,
              requirementId: row.id,
              locator: toJsonObject(citationInput.locator),
            })),
          );
        }

        return row;
      });
    },

    async insertCoverageEntryWithCitations(entryInput: InsertCoverageEntryInput, citations) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(coverageMatrixEntry)
          .values({
            id: randomUUID(),
            ...entryInput,
            questionDeliveryItemId: entryInput.questionDeliveryItemId ?? null,
          })
          .returning();
        const row = inserted[0];
        if (!row) {
          throw new RequirementAnalysisInvalidStateError("Failed to insert coverage_matrix_entry.");
        }

        if (citations.length > 0) {
          await tx.insert(citation).values(
            citations.map((citationInput) => ({
              id: randomUUID(),
              ...citationInput,
              coverageMatrixEntryId: row.id,
              locator: toJsonObject(citationInput.locator),
            })),
          );
        }

        return row;
      });
    },

    async insertDeliveryItemWithCitations(itemInput: InsertDeliveryItemInput, citations) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(deliveryItem)
          .values({
            id: randomUUID(),
            ...itemInput,
            confidenceReasonCodes: [...itemInput.confidenceReasonCodes],
            attributes: itemInput.attributes,
          })
          .returning();
        const row = inserted[0];
        if (!row) {
          throw new RequirementAnalysisInvalidStateError("Failed to insert delivery_item.");
        }

        if (citations.length > 0) {
          await tx.insert(citation).values(
            citations.map((citationInput) => ({
              id: randomUUID(),
              ...citationInput,
              deliveryItemId: row.id,
              locator: toJsonObject(citationInput.locator),
            })),
          );
        }

        return row;
      });
    },

    async linkCoverageQuestion(coverageEntryId, deliveryItemId) {
      await db
        .update(coverageMatrixEntry)
        .set({ questionDeliveryItemId: deliveryItemId })
        .where(eq(coverageMatrixEntry.id, coverageEntryId));
    },

    async updateRequirementClassification(requirementId, input) {
      const updated = await db
        .update(requirement)
        .set({
          epistemicStatus: input.epistemicStatus,
          confidenceBand: input.confidenceBand,
          confidenceReasonCodes: [...input.confidenceReasonCodes],
          ...(input.dedupeGroupKey !== undefined ? { dedupeGroupKey: input.dedupeGroupKey } : {}),
        })
        .where(eq(requirement.id, requirementId))
        .returning();

      const row = updated[0];
      if (!row) {
        throw new RequirementAnalysisInvalidStateError(
          `requirement ${requirementId} was not found for a classification update.`,
        );
      }
      return row;
    },

    async listRequirementsByRun(runId) {
      return db.select().from(requirement).where(eq(requirement.analysisRunId, runId));
    },

    async listCitationsByRequirement(requirementId) {
      return db.select().from(citation).where(eq(citation.requirementId, requirementId));
    },

    async listCoverageEntriesByRun(runId) {
      return db
        .select()
        .from(coverageMatrixEntry)
        .where(eq(coverageMatrixEntry.analysisRunId, runId))
        .orderBy(asc(coverageMatrixEntry.categoryOrder));
    },

    async listDeliveryItemsByRun(runId) {
      return db.select().from(deliveryItem).where(eq(deliveryItem.analysisRunId, runId));
    },

    async recordTraceabilityLink(input: TraceabilityLinkInput) {
      await db
        .insert(traceabilityLink)
        .values({
          id: randomUUID(),
          organizationId: input.organizationId,
          fromType: input.fromType,
          fromId: input.fromId,
          toType: input.toType,
          toId: input.toId,
          relation: input.relation,
          createdBy: input.createdBy ?? null,
        })
        .onConflictDoNothing();
    },

    async recordAuditEvent(input) {
      await recordWorkerAuditEvent(db, input);
    },
  };
}

async function listEligibleSnapshotCandidates(
  db: Database,
  scope: { organizationId: string; projectId: string },
  filter?: { sourceDocumentIdFilter?: readonly string[] },
): Promise<readonly EligibleSnapshotSourceCandidate[]> {
  const documentRows = await db
    .select()
    .from(sourceDocument)
    .where(
      and(
        eq(sourceDocument.organizationId, scope.organizationId),
        eq(sourceDocument.projectId, scope.projectId),
        eq(sourceDocument.processingStatus, "ready"),
        sql`${sourceDocument.archivedAt} is null`,
        ...(filter?.sourceDocumentIdFilter && filter.sourceDocumentIdFilter.length > 0
          ? [inArray(sourceDocument.id, [...filter.sourceDocumentIdFilter])]
          : []),
      ),
    )
    .orderBy(asc(sourceDocument.lineageId), desc(sourceDocument.versionNumber));

  // Keep only the current lineage head: the first row seen per `lineageId` once ordered by
  // version descending (module-02 §1312-1379 read-only Module 3 handoff invariant).
  const headByLineage = new Map<string, (typeof documentRows)[number]>();
  for (const row of documentRows) {
    if (!headByLineage.has(row.lineageId)) {
      headByLineage.set(row.lineageId, row);
    }
  }
  const headDocuments = [...headByLineage.values()].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
  );

  if (headDocuments.length === 0) {
    return [];
  }

  const documentIds = headDocuments.map((row) => row.id);

  const [extractions, referenceArtifacts] = await Promise.all([
    db
      .select()
      .from(sourceExtraction)
      .where(
        and(
          inArray(sourceExtraction.sourceDocumentId, documentIds),
          eq(sourceExtraction.status, "succeeded"),
        ),
      )
      .orderBy(desc(sourceExtraction.extractionVersion)),
    db
      .select()
      .from(referenceArtifact)
      .where(inArray(referenceArtifact.sourceDocumentId, documentIds)),
  ]);

  const latestExtractionByDocument = new Map<string, (typeof extractions)[number]>();
  for (const extraction of extractions) {
    if (!latestExtractionByDocument.has(extraction.sourceDocumentId)) {
      latestExtractionByDocument.set(extraction.sourceDocumentId, extraction);
    }
  }
  const referenceByDocument = new Map(
    referenceArtifacts.map((artifact) => [artifact.sourceDocumentId, artifact] as const),
  );

  const eligibleExtractionIds = [...latestExtractionByDocument.values()].map((row) => row.id);
  const [files, chunks] = await Promise.all([
    db
      .select()
      .from(sourceDocumentFile)
      .where(inArray(sourceDocumentFile.sourceDocumentId, documentIds))
      .orderBy(asc(sourceDocumentFile.ordinal)),
    eligibleExtractionIds.length > 0
      ? db
          .select()
          .from(sourceChunk)
          .where(inArray(sourceChunk.sourceExtractionId, eligibleExtractionIds))
          .orderBy(asc(sourceChunk.sequence), asc(sourceChunk.id))
      : Promise.resolve([]),
  ]);

  const filesByDocument = new Map<string, typeof files>();
  for (const file of files) {
    const list = filesByDocument.get(file.sourceDocumentId) ?? [];
    list.push(file);
    filesByDocument.set(file.sourceDocumentId, list);
  }
  const chunksByExtraction = new Map<string, typeof chunks>();
  for (const chunk of chunks) {
    const list = chunksByExtraction.get(chunk.sourceExtractionId) ?? [];
    list.push(chunk);
    chunksByExtraction.set(chunk.sourceExtractionId, list);
  }

  const candidates: EligibleSnapshotSourceCandidate[] = [];
  for (const documentRow of headDocuments) {
    const extraction = latestExtractionByDocument.get(documentRow.id);
    if (!extraction) {
      continue; // module-03 §8.1: missing_successful_extraction sources are never frozen.
    }

    const reference = referenceByDocument.get(documentRow.id) ?? null;
    if (reference && reference.ipReviewStatus !== "cleared") {
      continue; // module-03 §8.1: reference_not_cleared sources are never frozen.
    }

    candidates.push({
      sourceDocumentId: documentRow.id,
      lineageId: documentRow.lineageId,
      versionNumber: documentRow.versionNumber,
      contentHash: documentRow.contentHash,
      sourceExtractionId: extraction.id,
      extractionVersion: extraction.extractionVersion,
      chunkerVersion: extraction.chunkerVersion,
      extractedTextHash: extraction.extractedTextHash,
      referenceArtifactId: reference?.id ?? null,
      referenceIpReviewStatus: reference?.ipReviewStatus ?? null,
      isReference: documentRow.sourceType === "reference",
      files: (filesByDocument.get(documentRow.id) ?? []).map((file) => ({
        sourceDocumentFileId: file.id,
        ordinal: file.ordinal,
        sha256: file.sha256,
        objectVersionId: file.objectVersionId,
      })),
      chunks: (chunksByExtraction.get(extraction.id) ?? []).map((chunk) => ({
        sourceChunkId: chunk.id,
        sequence: chunk.sequence,
        contentHash: chunk.contentHash,
        characterCount: chunk.characterCount,
        locator: toJsonObject(chunk.locator),
        content: chunk.content,
      })),
    });
  }

  return candidates;
}

async function freezeSnapshot(
  db: Database,
  input: FreezeSnapshotInput,
): Promise<FreezeSnapshotResult> {
  const candidates = await listEligibleSnapshotCandidates(
    db,
    input,
    input.sourceDocumentIdFilter
      ? { sourceDocumentIdFilter: input.sourceDocumentIdFilter }
      : undefined,
  );

  const excludedReferenceSourceDocumentIds: string[] = [];
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

  return db.transaction(async (tx) => {
    const { hashCanonicalJson, sha256Hex } = await import("@atlashq/ai");

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

    const snapshotInserted = await tx
      .insert(requirementAnalysisSnapshot)
      .values({
        id: randomUUID(),
        organizationId: input.organizationId,
        projectId: input.projectId,
        runId: input.runId,
        snapshotHash,
        sourceCount: frozenCandidates.length,
        chunkCount: totalChunkCount,
        totalCharacterCount,
        eligibilityRulesVersion: input.eligibilityRulesVersion,
      })
      .returning();
    const snapshot = snapshotInserted[0];
    if (!snapshot) {
      throw new RequirementAnalysisInvalidStateError("Failed to insert snapshot header.");
    }

    const chunkRefs: FrozenSnapshotChunkRef[] = [];

    for (const [sourceOrder, candidate] of frozenCandidates.entries()) {
      const chunkManifestHash = hashCanonicalJson({
        chunks: candidate.chunks.map((chunk) => chunk.contentHash),
      });
      const sequenceNumbers = candidate.chunks.map((chunk) => chunk.sequence);
      const snapshotSourceInserted = await tx
        .insert(requirementAnalysisSnapshotSource)
        .values({
          id: randomUUID(),
          snapshotId: snapshot.id,
          organizationId: input.organizationId,
          projectId: input.projectId,
          sourceDocumentId: candidate.sourceDocumentId,
          sourceLineageId: candidate.lineageId,
          sourceVersionNumber: candidate.versionNumber,
          sourceContentHash: candidate.contentHash,
          sourceExtractionId: candidate.sourceExtractionId,
          sourceExtractionVersion: candidate.extractionVersion,
          chunkerVersion: candidate.chunkerVersion,
          extractedTextHash: candidate.extractedTextHash,
          referenceArtifactId: candidate.referenceArtifactId,
          referenceIpReviewStatus: candidate.referenceArtifactId
            ? candidate.referenceIpReviewStatus
            : null,
          chunkManifestHash,
          chunkSequenceStart: sequenceNumbers.length > 0 ? Math.min(...sequenceNumbers) : 0,
          chunkSequenceEnd: sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0,
          chunkCount: candidate.chunks.length,
          characterCount: candidate.chunks.reduce((sum, chunk) => sum + chunk.characterCount, 0),
          sourceOrder,
        })
        .returning();
      const snapshotSource = snapshotSourceInserted[0];
      if (!snapshotSource) {
        throw new RequirementAnalysisInvalidStateError("Failed to insert snapshot source row.");
      }

      if (candidate.files.length > 0) {
        await tx.insert(requirementAnalysisSnapshotFile).values(
          candidate.files.map((file) => ({
            id: randomUUID(),
            snapshotSourceId: snapshotSource.id,
            organizationId: input.organizationId,
            projectId: input.projectId,
            sourceDocumentFileId: file.sourceDocumentFileId,
            fileOrdinal: file.ordinal,
            fileSha256: file.sha256,
            objectVersionId: file.objectVersionId,
          })),
        );
      }

      for (const [chunkOrder, chunk] of candidate.chunks.entries()) {
        const locatorHash = sha256Hex(JSON.stringify(chunk.locator ?? {}));
        const snapshotChunkInserted = await tx
          .insert(requirementAnalysisSnapshotChunk)
          .values({
            id: randomUUID(),
            snapshotSourceId: snapshotSource.id,
            organizationId: input.organizationId,
            projectId: input.projectId,
            sourceChunkId: chunk.sourceChunkId,
            chunkSequence: chunk.sequence,
            chunkOrder,
            chunkContentHash: chunk.contentHash,
            locatorHash,
            characterCount: chunk.characterCount,
          })
          .returning();
        const snapshotChunk = snapshotChunkInserted[0];
        if (!snapshotChunk) {
          throw new RequirementAnalysisInvalidStateError("Failed to insert snapshot chunk row.");
        }

        chunkRefs.push({
          snapshotChunkId: snapshotChunk.id,
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
        });
      }
    }

    return { snapshot, chunks: chunkRefs, excludedReferenceSourceDocumentIds };
  });
}

async function listSnapshotChunks(
  db: Database,
  snapshotId: string,
): Promise<readonly FrozenSnapshotChunkRef[]> {
  const rows = await db
    .select({
      snapshotChunkId: requirementAnalysisSnapshotChunk.id,
      chunkSequence: requirementAnalysisSnapshotChunk.chunkSequence,
      chunkOrder: requirementAnalysisSnapshotChunk.chunkOrder,
      chunkContentHash: requirementAnalysisSnapshotChunk.chunkContentHash,
      characterCount: requirementAnalysisSnapshotChunk.characterCount,
      sourceChunkId: requirementAnalysisSnapshotChunk.sourceChunkId,
      sourceOrder: requirementAnalysisSnapshotSource.sourceOrder,
      sourceDocumentId: requirementAnalysisSnapshotSource.sourceDocumentId,
      sourceExtractionId: requirementAnalysisSnapshotSource.sourceExtractionId,
      sourceVersionNumber: requirementAnalysisSnapshotSource.sourceVersionNumber,
      sourceContentHash: requirementAnalysisSnapshotSource.sourceContentHash,
      chunkerVersion: requirementAnalysisSnapshotSource.chunkerVersion,
      sourceExtractionVersion: requirementAnalysisSnapshotSource.sourceExtractionVersion,
      referenceArtifactId: requirementAnalysisSnapshotSource.referenceArtifactId,
      content: sourceChunk.content,
      locator: sourceChunk.locator,
    })
    .from(requirementAnalysisSnapshotChunk)
    .innerJoin(
      requirementAnalysisSnapshotSource,
      eq(requirementAnalysisSnapshotSource.id, requirementAnalysisSnapshotChunk.snapshotSourceId),
    )
    .innerJoin(sourceChunk, eq(sourceChunk.id, requirementAnalysisSnapshotChunk.sourceChunkId))
    .where(eq(requirementAnalysisSnapshotSource.snapshotId, snapshotId))
    .orderBy(
      asc(requirementAnalysisSnapshotSource.sourceOrder),
      asc(requirementAnalysisSnapshotChunk.chunkOrder),
    );

  return rows.map((row) => ({
    snapshotChunkId: row.snapshotChunkId,
    sourceDocumentId: row.sourceDocumentId,
    sourceExtractionId: row.sourceExtractionId,
    sourceVersionNumber: row.sourceVersionNumber,
    sourceContentHash: row.sourceContentHash,
    chunkerVersion: row.chunkerVersion,
    sourceChunkId: row.sourceChunkId,
    sourceOrder: row.sourceOrder,
    sourceExtractionVersion: String(row.sourceExtractionVersion),
    chunkSequence: row.chunkSequence,
    chunkOrder: row.chunkOrder,
    chunkContentHash: row.chunkContentHash,
    content: row.content,
    locator: toJsonObject(row.locator),
    origin: row.referenceArtifactId ? "reference" : "source",
  }));
}

async function listBatchChunkContents(
  db: Database,
  batchId: string,
): Promise<readonly FrozenSnapshotChunkRef[]> {
  const rows = await db
    .select({
      snapshotChunkId: requirementAnalysisSnapshotChunk.id,
      chunkSequence: requirementAnalysisSnapshotChunk.chunkSequence,
      chunkOrder: requirementAnalysisBatchChunk.chunkOrder,
      chunkContentHash: requirementAnalysisSnapshotChunk.chunkContentHash,
      sourceChunkId: requirementAnalysisSnapshotChunk.sourceChunkId,
      sourceOrder: requirementAnalysisSnapshotSource.sourceOrder,
      sourceDocumentId: requirementAnalysisSnapshotSource.sourceDocumentId,
      sourceExtractionId: requirementAnalysisSnapshotSource.sourceExtractionId,
      sourceVersionNumber: requirementAnalysisSnapshotSource.sourceVersionNumber,
      sourceContentHash: requirementAnalysisSnapshotSource.sourceContentHash,
      chunkerVersion: requirementAnalysisSnapshotSource.chunkerVersion,
      sourceExtractionVersion: requirementAnalysisSnapshotSource.sourceExtractionVersion,
      referenceArtifactId: requirementAnalysisSnapshotSource.referenceArtifactId,
      content: sourceChunk.content,
      locator: sourceChunk.locator,
    })
    .from(requirementAnalysisBatchChunk)
    .innerJoin(
      requirementAnalysisSnapshotChunk,
      eq(requirementAnalysisSnapshotChunk.id, requirementAnalysisBatchChunk.snapshotChunkId),
    )
    .innerJoin(
      requirementAnalysisSnapshotSource,
      eq(requirementAnalysisSnapshotSource.id, requirementAnalysisSnapshotChunk.snapshotSourceId),
    )
    .innerJoin(sourceChunk, eq(sourceChunk.id, requirementAnalysisSnapshotChunk.sourceChunkId))
    .where(eq(requirementAnalysisBatchChunk.batchId, batchId))
    .orderBy(asc(requirementAnalysisBatchChunk.chunkOrder));

  return rows.map((row) => ({
    snapshotChunkId: row.snapshotChunkId,
    sourceDocumentId: row.sourceDocumentId,
    sourceExtractionId: row.sourceExtractionId,
    sourceVersionNumber: row.sourceVersionNumber,
    sourceContentHash: row.sourceContentHash,
    chunkerVersion: row.chunkerVersion,
    sourceChunkId: row.sourceChunkId,
    sourceOrder: row.sourceOrder,
    sourceExtractionVersion: String(row.sourceExtractionVersion),
    chunkSequence: row.chunkSequence,
    chunkOrder: row.chunkOrder,
    chunkContentHash: row.chunkContentHash,
    content: row.content,
    locator: toJsonObject(row.locator),
    origin: row.referenceArtifactId ? "reference" : "source",
  }));
}
