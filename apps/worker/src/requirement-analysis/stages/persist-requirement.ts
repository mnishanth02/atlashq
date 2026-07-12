import { calculateConfidenceBand } from "@atlashq/ai";
import type { Requirement } from "@atlashq/db";
import { toNewCitationRow, type VerifiedQuote, verifyQuoteCandidates } from "../citation.js";
import type { FrozenSnapshotChunkRef, RequirementAnalysisRepository } from "../repository/types.js";
import type { RequirementCandidate } from "../schemas.js";

export type PersistExtractionCandidateInput = {
  organizationId: string;
  projectId: string;
  runId: string;
  /** The `ai_run` row that performed (or last reverified, on a cache hit) this candidate's
   * deterministic citation verification pass -- recorded as `created_by_ai_run_id` provenance. */
  verificationAiRunId: string;
  snapshotId: string;
  snapshotHash: string;
  origin: "source" | "reference";
  candidate: RequirementCandidate;
  chunksById: ReadonlyMap<string, FrozenSnapshotChunkRef>;
};

export type PersistExtractionCandidateResult = {
  requirement: Requirement;
  verifiedExactCount: number;
  droppedCitationCount: number;
  downgradedToUnknown: boolean;
};

/**
 * Turns one validated LLM `RequirementCandidate` into a persisted `requirement` row plus its
 * verified `citation` rows (module-03 §10-§11.4, task items 3, 6, 7, 8):
 *
 * - Every proposed quote is deterministically reverified here (never trusted from a prior pass;
 *   task item 5: "cache hits ... always reverify citations").
 * - Only `verified_exact` results ever become citation rows -- `downgraded_fuzzy`/`failed` quotes
 *   are dropped, never persisted as a lesser-status citation (the `citation` table's
 *   `match_start_offset`/`match_end_offset` are `NOT NULL`, and the verifier only ever returns
 *   non-null offsets for `verified_exact`).
 * - A "confirmed" candidate that ends up with zero verified citations is downgraded to "unknown"
 *   before insertion: the shared `calculateConfidenceBand` helper deliberately does not perform
 *   this downgrade itself (it returns `resolvedEpistemicStatus: "confirmed"` either way), so this
 *   worker-owned policy is what actually satisfies "never persist confirmed without verified
 *   citation".
 */
export async function persistExtractionCandidate(
  repository: RequirementAnalysisRepository,
  input: PersistExtractionCandidateInput,
): Promise<PersistExtractionCandidateResult> {
  const verifiedQuotes = verifyQuoteCandidates({
    organizationId: input.organizationId,
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    snapshotHash: input.snapshotHash,
    chunksById: input.chunksById,
    quotes: input.candidate.citations,
  });

  const verifiedExact = verifiedQuotes.filter(
    (entry: VerifiedQuote) => entry.result.verificationStatus === "verified_exact",
  );
  const droppedCitationCount = verifiedQuotes.length - verifiedExact.length;

  let epistemicStatus = input.candidate.epistemicStatus;
  const downgradedToUnknown = epistemicStatus === "confirmed" && verifiedExact.length === 0;
  if (downgradedToUnknown) {
    epistemicStatus = "unknown";
  }

  const corroboratingSourceDocumentCount = new Set(
    verifiedExact.map((entry) => entry.chunk.sourceDocumentId),
  ).size;

  const confidence = calculateConfidenceBand({
    epistemicStatus,
    verifiedExactCitationCount: verifiedExact.length,
    corroboratingSourceDocumentCount,
    // No cross-batch/cross-stage corroboration signal exists yet at first-persistence time;
    // `normalization_deduplication` and `conflict_detection` refine this via
    // `updateRequirementClassification` once duplicates/conflicts across batches are known.
    evidenceSpanCompleteness: "complete",
    stageAgreement: "agree",
    mappedCoverageStatus: null,
    hasInferenceBasis: input.candidate.inferenceBasis !== null,
    supportingContextVerifiedCitationCount: verifiedExact.length,
    hasConflict: false,
  });

  const citationsToInsert = verifiedExact.map((entry) => {
    const built = toNewCitationRow({
      organizationId: input.organizationId,
      projectId: input.projectId,
      analysisRunId: input.runId,
      chunk: entry.chunk,
      result: entry.result,
      createdByAiRunId: input.verificationAiRunId,
      target: { requirementId: "" },
    });
    const { requirementId: _requirementIdPlaceholder, ...withoutTarget } = built;
    return { ...withoutTarget, locator: entry.chunk.locator };
  });

  const requirement = await repository.insertRequirementWithCitations(
    {
      organizationId: input.organizationId,
      projectId: input.projectId,
      analysisRunId: input.runId,
      stableKey: input.candidate.stableKey,
      title: input.candidate.title,
      description: input.candidate.description,
      requirementType: input.candidate.requirementType,
      priority: input.candidate.priority,
      epistemicStatus,
      confidenceBand: confidence.confidenceBand,
      confidenceReasonCodes: confidence.confidenceReasonCodes,
      inferenceBasis: input.candidate.inferenceBasis,
      origin: input.origin,
      lifecycleState: "ai_suggested",
      dedupeGroupKey: null,
      parentRequirementId: null,
      sourceSummary: null,
      createdByAiRunId: input.verificationAiRunId,
    },
    citationsToInsert,
  );

  return {
    requirement,
    verifiedExactCount: verifiedExact.length,
    droppedCitationCount,
    downgradedToUnknown,
  };
}
