import type { CitationVerificationJobPayload } from "@atlashq/jobs";
import { InvalidJobDataError } from "../../errors.js";
import { verifyQuoteCandidates } from "../citation.js";
import { RequirementAnalysisInvalidStateError } from "../errors.js";
import type { AnalysisScope, FrozenSnapshotChunkRef } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import {
  confirmedExtractionOutputSchema,
  referenceFeatureExtractionOutputSchema,
} from "../schemas.js";
import { assertNotCanceled, loadRunInScope } from "./common.js";

/**
 * The real `citation-verification` BullMQ queue consumer (task item 2: "register real ai-analysis
 * and citation-verification Queue/Worker consumers"). This is the second half of the dual-path
 * design documented in `citation-verification.ts`: it independently reverifies one batch's
 * candidate citations using the exact same deterministic helper the authoritative
 * `citation_verification` DAG stage uses, and records only aggregate counts to the audit log (task
 * item 9: "logs without raw content") -- it never mutates `requirement`/`citation` rows itself, so
 * persistence always has exactly one writer (the DAG stage handler) and this consumer can never
 * race it into a duplicate insert.
 */
export async function handleCitationVerificationJob(
  runtime: AnalysisRuntime,
  payload: CitationVerificationJobPayload,
): Promise<void> {
  const scope: AnalysisScope = {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    runId: payload.runId,
  };
  const run = await loadRunInScope(runtime, scope);
  await assertNotCanceled(runtime, run);

  const snapshotId = run.sourceSnapshotId;
  if (!snapshotId) {
    return; // Snapshot not frozen yet somehow raced ahead of this stale job; nothing to verify.
  }
  const snapshot = await runtime.repository.getSnapshot(snapshotId);
  if (!snapshot) {
    throw new RequirementAnalysisInvalidStateError(`Snapshot "${snapshotId}" does not exist.`);
  }

  const batch = await runtime.repository.getBatch(payload.batchId);
  if (!batch) {
    throw new InvalidJobDataError(`Batch "${payload.batchId}" does not exist.`);
  }
  if (batch.status !== "completed" || !batch.aiRunId) {
    return; // Batch failed/was canceled/hasn't completed yet; nothing to independently verify.
  }

  const stage = await runtime.repository.getStage(payload.stageId);
  if (!stage) {
    throw new InvalidJobDataError(`Stage "${payload.stageId}" does not exist.`);
  }
  const schema =
    stage.kind === "confirmed_extraction"
      ? confirmedExtractionOutputSchema
      : referenceFeatureExtractionOutputSchema;

  const output = await runtime.repository.getAiRunOutput(batch.aiRunId);
  if (!output) {
    return;
  }
  const parsed = schema.parse(output);
  const chunks = await runtime.repository.listBatchChunkContents(batch.id);
  const chunksById = new Map<string, FrozenSnapshotChunkRef>(
    chunks.map((chunk) => [chunk.snapshotChunkId, chunk]),
  );

  let verifiedExactCount = 0;
  let downgradedFuzzyCount = 0;
  let failedCount = 0;
  for (const candidate of parsed.requirements) {
    const verified = verifyQuoteCandidates({
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      snapshotId,
      snapshotHash: snapshot.snapshotHash,
      chunksById,
      quotes: candidate.citations,
    });
    for (const entry of verified) {
      if (entry.result.verificationStatus === "verified_exact") {
        verifiedExactCount += 1;
      } else if (entry.result.verificationStatus === "downgraded_fuzzy") {
        downgradedFuzzyCount += 1;
      } else {
        failedCount += 1;
      }
    }
  }

  await runtime.repository.recordAuditEvent({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    actorId: run.requestedBy,
    action: "requirement_analysis.citation_verification_consumer_checked",
    entityType: "requirement_analysis_batch",
    entityId: batch.id,
    correlationId: run.id,
    after: {
      stageId: stage.id,
      candidateCount: parsed.requirements.length,
      verifiedExactCount,
      downgradedFuzzyCount,
      failedCount,
    },
  });
}
