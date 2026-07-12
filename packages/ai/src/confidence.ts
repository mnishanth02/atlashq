import type {
  ConfidenceBand,
  ConfidenceReasonCode,
  CoverageStatus,
  RequirementEpistemicStatus,
} from "@atlashq/types";

export {
  confidenceBandValues,
  confidenceReasonCodeValues,
  coverageStatusValues,
  requirementEpistemicStatusValues,
} from "@atlashq/types";

export type ConfidenceSignals = {
  epistemicStatus: RequirementEpistemicStatus;
  verifiedExactCitationCount: number;
  corroboratingSourceDocumentCount: number;
  evidenceSpanCompleteness: "complete" | "incomplete_or_ambiguous";
  stageAgreement: "agree" | "disagree_non_conflicting";
  mappedCoverageStatus: CoverageStatus | null;
  hasInferenceBasis: boolean;
  supportingContextVerifiedCitationCount: number;
  hasConflict: boolean;
};

export type ConfidenceBandResult = {
  resolvedEpistemicStatus: RequirementEpistemicStatus;
  confidenceBand: ConfidenceBand | null;
  confidenceReasonCodes: readonly ConfidenceReasonCode[];
};

function clampToNonNegativeInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function calculateConfidenceBand(signals: ConfidenceSignals): ConfidenceBandResult {
  const reasons = new Set<ConfidenceReasonCode>();
  const verifiedExactCitationCount = clampToNonNegativeInteger(signals.verifiedExactCitationCount);
  const corroboratingSourceDocumentCount = clampToNonNegativeInteger(
    signals.corroboratingSourceDocumentCount,
  );
  const supportingCitationCount = clampToNonNegativeInteger(
    signals.supportingContextVerifiedCitationCount,
  );

  if (signals.hasConflict || signals.epistemicStatus === "conflicting") {
    return {
      resolvedEpistemicStatus: "conflicting",
      confidenceBand: null,
      confidenceReasonCodes: [],
    };
  }

  if (signals.epistemicStatus === "unknown") {
    return {
      resolvedEpistemicStatus: "unknown",
      confidenceBand: null,
      confidenceReasonCodes: [],
    };
  }

  if (signals.epistemicStatus === "confirmed") {
    if (verifiedExactCitationCount < 1) {
      return {
        resolvedEpistemicStatus: "confirmed",
        confidenceBand: null,
        confidenceReasonCodes: [],
      };
    }

    reasons.add("verified_exact_citation");

    const hasIndependentCorroboration = corroboratingSourceDocumentCount >= 2;
    if (hasIndependentCorroboration) {
      reasons.add("multiple_source_corroboration");
    }

    const evidenceComplete = signals.evidenceSpanCompleteness === "complete";
    if (evidenceComplete) {
      reasons.add("evidence_span_complete");
    } else {
      reasons.add("evidence_span_ambiguous");
    }

    const stageAgreement = signals.stageAgreement === "agree";
    if (stageAgreement) {
      reasons.add("stage_agreement");
    } else {
      reasons.add("stage_disagreement");
    }

    const coverageAddressed = signals.mappedCoverageStatus === "addressed";
    if (coverageAddressed) {
      reasons.add("coverage_addressed");
    }

    const highConfidence =
      hasIndependentCorroboration && evidenceComplete && stageAgreement && coverageAddressed;
    if (highConfidence) {
      return {
        resolvedEpistemicStatus: "confirmed",
        confidenceBand: "high",
        confidenceReasonCodes: Array.from(reasons.values()),
      };
    }

    if (!evidenceComplete || !stageAgreement) {
      return {
        resolvedEpistemicStatus: "confirmed",
        confidenceBand: "low",
        confidenceReasonCodes: Array.from(reasons.values()),
      };
    }

    return {
      resolvedEpistemicStatus: "confirmed",
      confidenceBand: "medium",
      confidenceReasonCodes: Array.from(reasons.values()),
    };
  }

  if (signals.hasInferenceBasis) {
    reasons.add("inference_basis_present");
  } else {
    return {
      resolvedEpistemicStatus: "assumed",
      confidenceBand: null,
      confidenceReasonCodes: [],
    };
  }

  if (supportingCitationCount > 0) {
    reasons.add("supporting_context_citation_verified");
    return {
      resolvedEpistemicStatus: "assumed",
      confidenceBand: "medium",
      confidenceReasonCodes: Array.from(reasons.values()),
    };
  }

  reasons.add("supporting_context_citation_missing");
  return {
    resolvedEpistemicStatus: "assumed",
    confidenceBand: "low",
    confidenceReasonCodes: Array.from(reasons.values()),
  };
}
