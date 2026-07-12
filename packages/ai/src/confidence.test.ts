import { confidenceReasonCodeValues } from "@atlashq/types";
import { describe, expect, it } from "vitest";
import { calculateConfidenceBand } from "./index.js";

describe("deterministic confidence bands", () => {
  it("returns high for confirmed with corroboration, complete evidence, and addressed coverage", () => {
    const result = calculateConfidenceBand({
      epistemicStatus: "confirmed",
      verifiedExactCitationCount: 2,
      corroboratingSourceDocumentCount: 2,
      evidenceSpanCompleteness: "complete",
      stageAgreement: "agree",
      mappedCoverageStatus: "addressed",
      hasInferenceBasis: false,
      supportingContextVerifiedCitationCount: 0,
      hasConflict: false,
    });
    expect(result.confidenceBand).toBe("high");
    expect(
      result.confidenceReasonCodes.every((reason) => confidenceReasonCodeValues.includes(reason)),
    ).toBe(true);
  });

  it("returns low for confirmed when evidence is ambiguous or stages disagree", () => {
    const result = calculateConfidenceBand({
      epistemicStatus: "confirmed",
      verifiedExactCitationCount: 1,
      corroboratingSourceDocumentCount: 1,
      evidenceSpanCompleteness: "incomplete_or_ambiguous",
      stageAgreement: "disagree_non_conflicting",
      mappedCoverageStatus: "addressed",
      hasInferenceBasis: false,
      supportingContextVerifiedCitationCount: 0,
      hasConflict: false,
    });
    expect(result.confidenceBand).toBe("low");
  });

  it("returns medium for assumed with inference basis and supporting citation", () => {
    const result = calculateConfidenceBand({
      epistemicStatus: "assumed",
      verifiedExactCitationCount: 0,
      corroboratingSourceDocumentCount: 0,
      evidenceSpanCompleteness: "complete",
      stageAgreement: "agree",
      mappedCoverageStatus: "partial",
      hasInferenceBasis: true,
      supportingContextVerifiedCitationCount: 1,
      hasConflict: false,
    });
    expect(result.confidenceBand).toBe("medium");
  });

  it("returns null for unknown and conflicting statuses", () => {
    const unknown = calculateConfidenceBand({
      epistemicStatus: "unknown",
      verifiedExactCitationCount: 0,
      corroboratingSourceDocumentCount: 0,
      evidenceSpanCompleteness: "complete",
      stageAgreement: "agree",
      mappedCoverageStatus: null,
      hasInferenceBasis: false,
      supportingContextVerifiedCitationCount: 0,
      hasConflict: false,
    });
    expect(unknown.confidenceBand).toBeNull();

    const conflicting = calculateConfidenceBand({
      epistemicStatus: "confirmed",
      verifiedExactCitationCount: 2,
      corroboratingSourceDocumentCount: 2,
      evidenceSpanCompleteness: "complete",
      stageAgreement: "agree",
      mappedCoverageStatus: "addressed",
      hasInferenceBasis: false,
      supportingContextVerifiedCitationCount: 0,
      hasConflict: true,
    });
    expect(conflicting.resolvedEpistemicStatus).toBe("conflicting");
    expect(conflicting.confidenceBand).toBeNull();
  });
});
