import { describe, expect, it } from "vitest";
import { selectPrimaryVerifiedQuote, toNewCitationRow, verifyQuoteCandidates } from "./citation.js";
import type { FrozenSnapshotChunkRef } from "./repository/types.js";
import type { QuoteCandidate } from "./schemas.js";

function buildChunk(overrides: Partial<FrozenSnapshotChunkRef> = {}): FrozenSnapshotChunkRef {
  return {
    snapshotChunkId: "chunk-1",
    sourceDocumentId: "source-1",
    sourceExtractionId: "extraction-1",
    sourceVersionNumber: 1,
    sourceContentHash: "a".repeat(64),
    chunkerVersion: "chunker-v1",
    sourceChunkId: "source-chunk-1",
    sourceOrder: 0,
    sourceExtractionVersion: "1",
    chunkSequence: 0,
    chunkOrder: 0,
    chunkContentHash: "b".repeat(64),
    content: "The system shall authenticate every user before granting access.",
    locator: {},
    origin: "source",
    ...overrides,
  };
}

describe("verifyQuoteCandidates / selectPrimaryVerifiedQuote", () => {
  it("verifies a quote that is an exact substring of the claimed chunk", () => {
    const chunk = buildChunk();
    const candidate: QuoteCandidate = {
      snapshotChunkId: chunk.snapshotChunkId,
      quote: "The system shall authenticate every user",
    };

    const results = verifyQuoteCandidates({
      organizationId: "org-1",
      projectId: "project-1",
      snapshotId: "snapshot-1",
      snapshotHash: "d".repeat(64),
      chunksById: new Map([[chunk.snapshotChunkId, chunk]]),
      quotes: [candidate],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.result.verificationStatus).toBe("verified_exact");
    const primary = selectPrimaryVerifiedQuote(results);
    expect(primary?.result.verificationStatus).toBe("verified_exact");
  });

  it("drops a quote candidate whose snapshotChunkId does not resolve within this run's frozen snapshot", () => {
    const chunk = buildChunk();
    const candidate: QuoteCandidate = {
      snapshotChunkId: "unknown-chunk-id",
      quote: "The system shall authenticate every user",
    };

    const results = verifyQuoteCandidates({
      organizationId: "org-1",
      projectId: "project-1",
      snapshotId: "snapshot-1",
      snapshotHash: "d".repeat(64),
      chunksById: new Map([[chunk.snapshotChunkId, chunk]]),
      quotes: [candidate],
    });

    expect(results).toHaveLength(0);
    expect(selectPrimaryVerifiedQuote(results)).toBeNull();
  });

  it("never selects a failed verification result as primary", () => {
    const chunk = buildChunk();
    const candidate: QuoteCandidate = {
      snapshotChunkId: chunk.snapshotChunkId,
      quote: "This text never appears anywhere in the chunk content.",
    };

    const results = verifyQuoteCandidates({
      organizationId: "org-1",
      projectId: "project-1",
      snapshotId: "snapshot-1",
      snapshotHash: "d".repeat(64),
      chunksById: new Map([[chunk.snapshotChunkId, chunk]]),
      quotes: [candidate],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.result.verificationStatus).toBe("failed");
    expect(selectPrimaryVerifiedQuote(results)).toBeNull();
  });

  it("prefers a verified_exact result over a downgraded_fuzzy one when both are present", () => {
    const chunk = buildChunk();
    const exactCandidate: QuoteCandidate = {
      snapshotChunkId: chunk.snapshotChunkId,
      quote: "The system shall authenticate every user",
    };
    // A near-miss quote (extra whitespace/casing) that should downgrade to fuzzy rather than fail.
    const fuzzyCandidate: QuoteCandidate = {
      snapshotChunkId: chunk.snapshotChunkId,
      quote: "the   system shall authenticate every user",
    };

    const results = verifyQuoteCandidates({
      organizationId: "org-1",
      projectId: "project-1",
      snapshotId: "snapshot-1",
      snapshotHash: "d".repeat(64),
      chunksById: new Map([[chunk.snapshotChunkId, chunk]]),
      quotes: [fuzzyCandidate, exactCandidate],
    });

    const primary = selectPrimaryVerifiedQuote(results);
    expect(primary?.result.verificationStatus).toBe("verified_exact");
    expect(primary?.candidate).toBe(exactCandidate);
  });
});

describe("toNewCitationRow", () => {
  it("maps a verified result onto an insertable citation row targeting exactly one entity", () => {
    const chunk = buildChunk();
    const candidate: QuoteCandidate = {
      snapshotChunkId: chunk.snapshotChunkId,
      quote: "The system shall authenticate every user",
    };
    const [verified] = verifyQuoteCandidates({
      organizationId: "org-1",
      projectId: "project-1",
      snapshotId: "snapshot-1",
      snapshotHash: "d".repeat(64),
      chunksById: new Map([[chunk.snapshotChunkId, chunk]]),
      quotes: [candidate],
    });
    if (!verified) {
      throw new Error("expected a verified quote");
    }

    const row = toNewCitationRow({
      organizationId: "org-1",
      projectId: "project-1",
      analysisRunId: "run-1",
      chunk,
      result: verified.result,
      createdByAiRunId: "ai-run-1",
      target: { requirementId: "requirement-1" },
    });

    expect(row.requirementId).toBe("requirement-1");
    expect(row.verificationStatus).toBe("verified_exact");
    expect(row.sourceChunkId).toBe(chunk.sourceChunkId);
    expect(row.matchStartOffset).toBeGreaterThanOrEqual(0);
    expect(row.matchEndOffset).toBeGreaterThan(row.matchStartOffset);
  });

  it("throws rather than fabricate a row when the result has no match offsets", () => {
    const chunk = buildChunk();

    expect(() =>
      toNewCitationRow({
        organizationId: "org-1",
        projectId: "project-1",
        analysisRunId: "run-1",
        chunk,
        result: {
          verificationStatus: "failed",
          matchStartOffset: null,
          matchEndOffset: null,
          quoteTextOriginal: "nonsense",
          quoteTextNormalized: "nonsense",
          quoteHash: "e".repeat(64),
          chunkHash: chunk.chunkContentHash,
        } as never,
        createdByAiRunId: null,
        target: { requirementId: "requirement-1" },
      }),
    ).toThrow(TypeError);
  });
});
