import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { advanceDag } from "../dag.js";
import { RequirementAnalysisInvalidStateError } from "../errors.js";
import type { AiAnalysisQueue } from "../queue-helpers.js";
import type { AnalysisScope, FrozenSnapshotChunkRef } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import {
  confirmedExtractionOutputSchema,
  referenceFeatureExtractionOutputSchema,
} from "../schemas.js";
import { assertNotCanceled, assertWithinWallClock, loadRunInScope } from "./common.js";
import { persistExtractionCandidate } from "./persist-requirement.js";

export type RunStageJobPayload = Extract<RequirementAnalysisJobPayload, { kind: "run-stage" }>;

/**
 * module-03 §11.2 `citation_verification` (a deterministic stage: `module03PipelineDescriptor`
 * marks it `usesModel: false`) -- the authoritative half of the dual-path design described in
 * task item 2/7. This is where extraction candidates first become persisted `requirement` +
 * `citation` rows: every proposed quote is (re)verified here against the immutable frozen
 * snapshot content, independent of whether the batch that produced it was a fresh model call or a
 * cache hit (task item 5: cache hits always reverify citations).
 *
 * The *other* half of the dual path is `citation-consumer.ts`, the real `citation-verification`
 * BullMQ queue consumer registered in `main.ts`: it independently reverifies each batch's
 * candidates (using the same deterministic helper) and records an audit trail, without mutating
 * `requirement`/`citation` rows itself -- this stage remains the single writer so no batch's
 * candidates can ever be persisted twice by two different code paths racing each other.
 */
export async function handleCitationVerificationStage(
  runtime: AnalysisRuntime,
  aiAnalysisQueue: AiAnalysisQueue,
  payload: RunStageJobPayload,
): Promise<void> {
  const scope: AnalysisScope = {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    runId: payload.runId,
  };
  const run = await loadRunInScope(runtime, scope);
  await assertNotCanceled(runtime, run);
  assertWithinWallClock(run, runtime.now());

  const stage = await runtime.repository.getStage(payload.stageId);
  if (!stage || stage.kind !== "citation_verification") {
    throw new RequirementAnalysisInvalidStateError(
      `Stage "${payload.stageId}" is not a citation_verification stage.`,
    );
  }
  if (stage.status !== "running" && stage.status !== "pending") {
    // Idempotent replay of an already-terminal job (e.g. duplicate delivery); nothing left to do
    // besides making sure downstream stages are still progressing.
    await advanceDag(runtime, aiAnalysisQueue, scope);
    return;
  }

  const snapshotId = run.sourceSnapshotId;
  if (!snapshotId) {
    throw new RequirementAnalysisInvalidStateError(`Run "${run.id}" has no frozen snapshot.`);
  }
  const snapshot = await runtime.repository.getSnapshot(snapshotId);
  if (!snapshot) {
    throw new RequirementAnalysisInvalidStateError(`Snapshot "${snapshotId}" does not exist.`);
  }

  const allStages = await runtime.repository.listStagesByRun(scope.runId);
  const extractionStages = allStages.filter(
    (row) => row.kind === "confirmed_extraction" || row.kind === "reference_feature_extraction",
  );

  const existingStableKeys = new Set(
    (await runtime.repository.listRequirementsByRun(run.id)).map((row) => row.stableKey),
  );

  let verificationAiRunId: string | null = null;
  let persistedCount = 0;
  let downgradedCount = 0;
  let droppedCitationCount = 0;
  const consideredBatchIds: string[] = [];

  for (const extractionStage of extractionStages) {
    const batches = await runtime.repository.listBatchesByStage(extractionStage.id);
    const origin = extractionStage.kind === "confirmed_extraction" ? "source" : "reference";
    const schema =
      extractionStage.kind === "confirmed_extraction"
        ? confirmedExtractionOutputSchema
        : referenceFeatureExtractionOutputSchema;

    for (const batch of batches) {
      if (batch.status !== "completed" || !batch.aiRunId) {
        continue; // Failed/canceled/skipped batches contribute no candidates.
      }
      consideredBatchIds.push(batch.id);

      const output = await runtime.repository.getAiRunOutput(batch.aiRunId);
      if (!output) {
        throw new RequirementAnalysisInvalidStateError(
          `Batch "${batch.id}" is completed but its ai_run has no output.`,
        );
      }
      const parsed = schema.parse(output);
      const chunks = await runtime.repository.listBatchChunkContents(batch.id);
      const chunksById = new Map<string, FrozenSnapshotChunkRef>(
        chunks.map((chunk) => [chunk.snapshotChunkId, chunk]),
      );

      for (const candidate of parsed.requirements) {
        if (existingStableKeys.has(candidate.stableKey)) {
          continue; // Already persisted by a prior attempt of this same stage (idempotent replay).
        }

        if (!verificationAiRunId) {
          verificationAiRunId = await runtime.repository.insertAiRun({
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            agent: "module-03-requirement-analyzer",
            model: "deterministic-citation-verifier",
            provider: "internal-deterministic",
            promptVersion: "citation-verifier@1",
            inputArtifactVersions: [snapshotId],
            output: null,
            runStatus: "succeeded",
            cost: null,
          });
        }

        const result = await persistExtractionCandidate(runtime.repository, {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          runId: run.id,
          verificationAiRunId,
          snapshotId,
          snapshotHash: snapshot.snapshotHash,
          origin,
          candidate,
          chunksById,
        });

        existingStableKeys.add(candidate.stableKey);
        persistedCount += 1;
        droppedCitationCount += result.droppedCitationCount;
        if (result.downgradedToUnknown) {
          downgradedCount += 1;
        }
      }
    }
  }

  await runtime.repository.updateStage(stage.id, {
    status:
      downgradedCount > 0 || droppedCitationCount > 0 ? "completed_with_warnings" : "completed",
    completedAt: runtime.now(),
  });

  await runtime.repository.recordAuditEvent({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    actorId: run.requestedBy,
    action: "requirement_analysis.citation_verification_completed",
    entityType: "requirement_analysis_stage",
    entityId: stage.id,
    correlationId: run.id,
    after: {
      batchesConsidered: consideredBatchIds.length,
      requirementsPersisted: persistedCount,
      downgradedToUnknownCount: downgradedCount,
      droppedCitationCount,
    },
  });

  await advanceDag(runtime, aiAnalysisQueue, scope);
}
