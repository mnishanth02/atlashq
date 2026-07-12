import { describe, expect, it } from "vitest";
import { verifyCitationDeterministically } from "./index.js";

function buildInput(
  overrides: Partial<Parameters<typeof verifyCitationDeterministically>[0]> = {},
) {
  return {
    organizationId: "org_1",
    projectId: "project_1",
    snapshotId: "snapshot_1",
    snapshotHash: "snapshot_hash",
    sourceDocumentId: "source_1",
    sourceChunkId: "chunk_1",
    chunkContent: "All users must authenticate with SSO.",
    chunkContentHash: "chunk_hash",
    proposedQuote: "All users must authenticate with SSO.",
    ...overrides,
  };
}

describe("deterministic citation verifier", () => {
  it("verifies exact contiguous matches with offsets", () => {
    const result = verifyCitationDeterministically(buildInput());
    expect(result.verificationStatus).toBe("verified_exact");
    expect(result.matchStartOffset).toBe(0);
    expect(result.matchEndOffset).toBe("All users must authenticate with SSO.".length);
  });

  it("matches normalized smart quotes, dashes, and whitespace", () => {
    const result = verifyCitationDeterministically(
      buildInput({
        chunkContent: "The “priority” is high — do\nnot delay.",
        proposedQuote: 'The "priority" is high - do not delay.',
      }),
    );

    expect(result.verificationStatus).toBe("verified_exact");
    expect(result.matchStartOffset).toBe(0);
    expect(result.matchEndOffset).toBeGreaterThan(10);
  });

  it("reports multiple-match warning and uses the earliest deterministic offset", () => {
    const result = verifyCitationDeterministically(
      buildInput({
        chunkContent: "Alpha Beta. Alpha Beta.",
        proposedQuote: "Alpha Beta.",
      }),
    );

    expect(result.verificationStatus).toBe("verified_exact");
    expect(result.matchStartOffset).toBe(0);
    expect(result.warnings).toContain("multiple_match_warning");
  });

  it("rejects hallucinated words and negation mismatches as non-verified", () => {
    const hallucinated = verifyCitationDeterministically(
      buildInput({
        chunkContent: "Payments are processed weekly.",
        proposedQuote: "Payments are processed weekly and instantly.",
      }),
    );
    expect(hallucinated.verificationStatus).not.toBe("verified_exact");

    const negated = verifyCitationDeterministically(
      buildInput({
        chunkContent: "Data is encrypted at rest.",
        proposedQuote: "Data is not encrypted at rest.",
      }),
    );
    expect(negated.verificationStatus).not.toBe("verified_exact");
  });

  it("only downgrades to fuzzy diagnostics and never upgrades to verified", () => {
    const result = verifyCitationDeterministically(
      buildInput({
        chunkContent: "The API supports audit trails for all updates.",
        proposedQuote: "The API support audit trail for all updates.",
      }),
    );
    expect(["downgraded_fuzzy", "failed"]).toContain(result.verificationStatus);
    expect(result.verificationStatus).not.toBe("verified_exact");
  });
});
