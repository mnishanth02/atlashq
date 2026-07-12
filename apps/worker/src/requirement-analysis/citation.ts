import {
  type CitationVerificationResult,
  citationNormalizationMode,
  verifyCitationDeterministically,
} from "@atlashq/ai";
import type { NewCitation } from "@atlashq/db";
import type { FrozenSnapshotChunkRef } from "./repository/types.js";
import type { QuoteCandidate } from "./schemas.js";

/**
 * Deterministically verifies one proposed quote against the exact frozen chunk it claims to come
 * from (module-03 §10). This is the *only* legitimate path to a citation row: citations are never
 * fabricated from a model's own offsets/hashes, only computed here from the immutable snapshot
 * chunk content.
 */
export function verifyQuoteCandidate(input: {
  organizationId: string;
  projectId: string;
  snapshotId: string;
  snapshotHash: string;
  chunk: FrozenSnapshotChunkRef;
  quote: string;
}): CitationVerificationResult {
  return verifyCitationDeterministically({
    organizationId: input.organizationId,
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    snapshotHash: input.snapshotHash,
    sourceDocumentId: input.chunk.sourceDocumentId,
    sourceChunkId: input.chunk.sourceChunkId,
    chunkContent: input.chunk.content,
    chunkContentHash: input.chunk.chunkContentHash,
    locator: input.chunk.locator,
    proposedQuote: input.quote,
  });
}

export type VerifiedQuote = {
  candidate: QuoteCandidate;
  chunk: FrozenSnapshotChunkRef;
  result: CitationVerificationResult;
};

/** Verifies every quote candidate against its claimed chunk, dropping candidates whose
 * `snapshotChunkId` does not resolve inside this run's frozen snapshot (a model may never invent
 * or misattribute a chunk id) rather than trusting the model's own chunk reference blindly. */
export function verifyQuoteCandidates(input: {
  organizationId: string;
  projectId: string;
  snapshotId: string;
  snapshotHash: string;
  chunksById: ReadonlyMap<string, FrozenSnapshotChunkRef>;
  quotes: readonly QuoteCandidate[];
}): VerifiedQuote[] {
  const verified: VerifiedQuote[] = [];
  for (const candidate of input.quotes) {
    const chunk = input.chunksById.get(candidate.snapshotChunkId);
    if (!chunk) {
      continue; // Unattributable chunk id: never fabricate a citation for it.
    }

    const result = verifyQuoteCandidate({
      organizationId: input.organizationId,
      projectId: input.projectId,
      snapshotId: input.snapshotId,
      snapshotHash: input.snapshotHash,
      chunk,
      quote: candidate.quote,
    });
    verified.push({ candidate, chunk, result });
  }
  return verified;
}

/** Best verified quote first (`verified_exact` before `downgraded_fuzzy`); `failed` never wins. */
export function selectPrimaryVerifiedQuote(
  verifiedQuotes: readonly VerifiedQuote[],
): VerifiedQuote | null {
  const exact = verifiedQuotes.find(
    (entry) => entry.result.verificationStatus === "verified_exact",
  );
  if (exact) {
    return exact;
  }
  const fuzzy = verifiedQuotes.find(
    (entry) => entry.result.verificationStatus === "downgraded_fuzzy",
  );
  return fuzzy ?? null;
}

export type CitationTarget =
  | { requirementId: string }
  | { coverageMatrixEntryId: string }
  | { deliveryItemId: string };

/** Maps a verified citation result onto an insertable `citation` row for exactly one target. */
export function toNewCitationRow(input: {
  organizationId: string;
  projectId: string;
  analysisRunId: string;
  chunk: FrozenSnapshotChunkRef;
  result: CitationVerificationResult;
  createdByAiRunId: string | null;
  target: CitationTarget;
}): Omit<NewCitation, "id" | "createdAt"> {
  if (input.result.matchStartOffset === null || input.result.matchEndOffset === null) {
    throw new TypeError(
      "toNewCitationRow requires a verified (non-failed) citation result with match offsets.",
    );
  }

  return {
    organizationId: input.organizationId,
    projectId: input.projectId,
    analysisRunId: input.analysisRunId,
    ...input.target,
    sourceDocumentId: input.chunk.sourceDocumentId,
    sourceVersionNumber: input.chunk.sourceVersionNumber,
    sourceContentHash: input.chunk.sourceContentHash,
    sourceExtractionId: input.chunk.sourceExtractionId,
    sourceExtractionVersion: Number(input.chunk.sourceExtractionVersion),
    sourceChunkId: input.chunk.sourceChunkId,
    sourceChunkSequence: input.chunk.chunkSequence,
    chunkContentHash: input.result.chunkHash,
    locator: input.chunk.locator,
    quoteTextOriginal: input.result.quoteTextOriginal,
    quoteTextNormalized: input.result.quoteTextNormalized,
    quoteHash: input.result.quoteHash,
    matchStartOffset: input.result.matchStartOffset,
    matchEndOffset: input.result.matchEndOffset,
    normalizationMode: citationNormalizationMode,
    verificationStatus: input.result.verificationStatus,
    createdByAiRunId: input.createdByAiRunId,
  };
}
