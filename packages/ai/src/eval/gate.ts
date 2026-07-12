import type { EvaluationMetrics } from "./metrics.js";

export const releaseGateThresholdVersion = "module-03-initial-thresholds-v1";

type RatioGateDefinition = {
  id: string;
  label: string;
  kind: "ratio";
  threshold: number;
  getActual: (metrics: EvaluationMetrics) => number;
};

type CountGateDefinition = {
  id: string;
  label: string;
  kind: "count";
  threshold: number;
  getActual: (metrics: EvaluationMetrics) => number;
};

type GateDefinition = RatioGateDefinition | CountGateDefinition;

export type ReleaseGateResultEntry = {
  id: string;
  label: string;
  kind: "ratio" | "count";
  comparator: ">=" | "<=";
  threshold: number;
  thresholdDisplay: string;
  actual: number;
  actualDisplay: string;
  passed: boolean;
};

export type ReleaseGateEvaluation = {
  thresholdVersion: string;
  passed: boolean;
  gates: readonly ReleaseGateResultEntry[];
};

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatCount(value: number): string {
  return `${value}`;
}

const gateDefinitions: readonly GateDefinition[] = [
  {
    id: "schema_validity_after_max_one_repair",
    label: "Schema validity after max one repair",
    kind: "ratio",
    threshold: 1,
    getActual: (metrics) => metrics.schemaValidity.value,
  },
  {
    id: "persisted_confirmed_with_unverified_citation",
    label: "Persisted confirmed with unverified citation",
    kind: "count",
    threshold: 0,
    getActual: (metrics) => metrics.persistedConfirmedWithUnverifiedCitation.count,
  },
  {
    id: "cross_tenant_leakage",
    label: "Cross-tenant leakage",
    kind: "count",
    threshold: 0,
    getActual: (metrics) => metrics.crossTenantLeakageAssertions.count,
  },
  {
    id: "unsupported_persisted_confirmed_claim",
    label: "Unsupported persisted confirmed claim",
    kind: "count",
    threshold: 0,
    getActual: (metrics) => metrics.unsupportedPersistedConfirmedClaims.count,
  },
  {
    id: "verified_citation_precision",
    label: "Verified citation precision",
    kind: "ratio",
    threshold: 0.99,
    getActual: (metrics) => metrics.citationPrecision.value,
  },
  {
    id: "verified_citation_recall",
    label: "Verified citation recall",
    kind: "ratio",
    threshold: 0.9,
    getActual: (metrics) => metrics.citationRecall.value,
  },
  {
    id: "must_have_functional_requirement_precision",
    label: "Requirement precision for must-have/functional labels",
    kind: "ratio",
    threshold: 0.85,
    getActual: (metrics) => metrics.criticalRequirementPrecision.value,
  },
  {
    id: "must_have_functional_requirement_recall",
    label: "Requirement recall for must-have/functional labels",
    kind: "ratio",
    threshold: 0.75,
    getActual: (metrics) => metrics.criticalRequirementRecall.value,
  },
  {
    id: "coverage_classification_accuracy",
    label: "Coverage classification accuracy",
    kind: "ratio",
    threshold: 0.85,
    getActual: (metrics) => metrics.coverageClassificationAccuracy.value,
  },
  {
    id: "question_linkage_correctness",
    label: "Question linkage correctness",
    kind: "ratio",
    threshold: 0.9,
    getActual: (metrics) => metrics.questionLinkageCorrectness.value,
  },
  {
    id: "conflict_precision",
    label: "Conflict precision",
    kind: "ratio",
    threshold: 0.85,
    getActual: (metrics) => metrics.conflictPrecision.value,
  },
  {
    id: "conflict_recall",
    label: "Conflict recall",
    kind: "ratio",
    threshold: 0.7,
    getActual: (metrics) => metrics.conflictRecall.value,
  },
  {
    id: "abstention_correctness_on_unsupported_claims",
    label: "Abstention correctness on unsupported claims",
    kind: "ratio",
    threshold: 0.95,
    getActual: (metrics) => metrics.abstentionCorrectness.value,
  },
  {
    id: "budget_compliance",
    label: "Budget compliance",
    kind: "ratio",
    threshold: 1,
    getActual: (metrics) => metrics.budgetCompliance.value,
  },
];

export function evaluateReleaseGate(metrics: EvaluationMetrics): ReleaseGateEvaluation {
  const gateResults: ReleaseGateResultEntry[] = gateDefinitions.map((definition) => {
    const actual = definition.getActual(metrics);

    if (definition.kind === "ratio") {
      return {
        id: definition.id,
        label: definition.label,
        kind: definition.kind,
        comparator: ">=",
        threshold: definition.threshold,
        thresholdDisplay: formatRatio(definition.threshold),
        actual,
        actualDisplay: formatRatio(actual),
        passed: actual + Number.EPSILON >= definition.threshold,
      };
    }

    return {
      id: definition.id,
      label: definition.label,
      kind: definition.kind,
      comparator: "<=",
      threshold: definition.threshold,
      thresholdDisplay: formatCount(definition.threshold),
      actual,
      actualDisplay: formatCount(actual),
      passed: actual <= definition.threshold,
    };
  });

  return {
    thresholdVersion: releaseGateThresholdVersion,
    passed: gateResults.every((gate) => gate.passed),
    gates: gateResults,
  };
}
