import type { DeterministicReplayFixtureResult } from "./replay-runner.js";

export type RatioMetric = {
  numerator: number;
  denominator: number;
  value: number;
};

export type CountMetric = {
  count: number;
};

export type EvaluationMetrics = {
  schemaValidity: RatioMetric & {
    shapeOnlyRepairUsedCount: number;
  };
  citationPrecision: RatioMetric;
  citationRecall: RatioMetric;
  criticalRequirementPrecision: RatioMetric;
  criticalRequirementRecall: RatioMetric;
  coverageClassificationAccuracy: RatioMetric;
  abstentionCorrectness: RatioMetric;
  conflictPrecision: RatioMetric;
  conflictRecall: RatioMetric;
  questionLinkageCorrectness: RatioMetric;
  persistedConfirmedWithUnverifiedCitation: CountMetric;
  unsupportedPersistedConfirmedClaims: CountMetric;
  crossTenantLeakageAssertions: CountMetric;
  budgetCompliance: RatioMetric;
};

export type FixtureEvaluationResult = {
  id: string;
  kind: "gold" | "adversarial";
  runtimeStatus: "success" | "error";
  runtimeErrorCode: string | null;
  replayBindingPassed: boolean;
  promptFindingCodes: readonly string[];
  schemaValid: boolean;
  budgetCompliant: boolean;
  verifiedCitationCount: number;
  labeledCitationCount: number;
  persistedConfirmedWithUnverifiedCitationCount: number;
  unsupportedPersistedConfirmedClaimCount: number;
  crossTenantLeakageCount: number;
};

export type EvaluationDiagnostics = {
  invalidSchemaFixtures: string[];
  falsePositiveVerifiedCitations: string[];
  missingCoveragePredictions: string[];
  incorrectQuestionLinkage: string[];
  persistedConfirmedWithUnverifiedCitation: string[];
  unsupportedPersistedConfirmedClaims: string[];
  crossTenantLeakageAssertions: string[];
  budgetViolations: string[];
  replayBindingFailures: string[];
  runtimeFailures: string[];
};

export type EvaluationMetricComputationResult = {
  metrics: EvaluationMetrics;
  fixtureResults: readonly FixtureEvaluationResult[];
  diagnostics: EvaluationDiagnostics;
};

function createRatioMetric(numerator: number, denominator: number): RatioMetric {
  if (denominator === 0) {
    return {
      numerator,
      denominator,
      value: 1,
    };
  }

  return {
    numerator,
    denominator,
    value: numerator / denominator,
  };
}

function createScopedConflictKey(
  fixtureId: string,
  leftRequirementKey: string,
  rightRequirementKey: string,
): string {
  const sortedPair = [leftRequirementKey, rightRequirementKey].sort();
  const first = sortedPair[0] ?? "";
  const second = sortedPair[1] ?? "";
  return `${fixtureId}::${first}::${second}`;
}

function toUniqueSorted(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values)).sort();
}

function areEqualSets(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = toUniqueSorted(left);
  const normalizedRight = toUniqueSorted(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function formatFixtureRequirementKey(fixtureId: string, requirementKey: string): string {
  return `${fixtureId}::${requirementKey}`;
}

export function computeEvaluationMetrics(
  replayResults: readonly DeterministicReplayFixtureResult[],
): EvaluationMetricComputationResult {
  let schemaValidNumerator = 0;
  let schemaValidDenominator = 0;
  let shapeOnlyRepairUsedCount = 0;

  let verifiedCitationTruePositiveCount = 0;
  let verifiedCitationPredictedCount = 0;
  let verifiedCitationLabelCount = 0;

  let criticalRequirementTruePositiveCount = 0;
  let criticalRequirementPredictedCount = 0;
  let criticalRequirementLabelCount = 0;

  let coverageCorrectCount = 0;
  let coverageTotalCount = 0;

  let abstentionCorrectCount = 0;
  let abstentionTotalCount = 0;

  let conflictTruePositiveCount = 0;
  let conflictPredictedCount = 0;
  let conflictLabelCount = 0;

  let questionLinkageCorrectCount = 0;
  let questionLinkageTotalCount = 0;

  let persistedConfirmedWithUnverifiedCitationCount = 0;
  let unsupportedPersistedConfirmedClaimCount = 0;
  let crossTenantLeakageAssertionCount = 0;

  let budgetCompliantCount = 0;
  let budgetTotalCount = 0;

  const diagnostics: EvaluationDiagnostics = {
    invalidSchemaFixtures: [],
    falsePositiveVerifiedCitations: [],
    missingCoveragePredictions: [],
    incorrectQuestionLinkage: [],
    persistedConfirmedWithUnverifiedCitation: [],
    unsupportedPersistedConfirmedClaims: [],
    crossTenantLeakageAssertions: [],
    budgetViolations: [],
    replayBindingFailures: [],
    runtimeFailures: [],
  };

  const fixtureResults: FixtureEvaluationResult[] = [];

  for (const replayResult of replayResults) {
    const fixture = replayResult.fixture;
    const output = replayResult.output;
    schemaValidDenominator += 1;
    budgetTotalCount += 1;

    if (replayResult.shapeOnlyRepairUsed) {
      shapeOnlyRepairUsedCount += 1;
    }

    if (!replayResult.replayBindingPassed) {
      diagnostics.replayBindingFailures.push(...replayResult.replayBindingErrors);
    }

    const runtimeExpected = fixture.runtime.expectedErrorCode;
    const runtimeFailedUnexpectedly =
      replayResult.runtimeStatus === "error" && replayResult.runtimeErrorCode !== runtimeExpected;
    if (runtimeFailedUnexpectedly) {
      diagnostics.runtimeFailures.push(
        `${fixture.id}:${replayResult.runtimeErrorCode ?? "unknown_runtime_error"}`,
      );
    }

    const schemaValid =
      replayResult.runtimeStatus === "success"
        ? replayResult.schemaValidAfterRepair
        : runtimeExpected !== null && replayResult.runtimeErrorCode === runtimeExpected;
    if (schemaValid) {
      schemaValidNumerator += 1;
    } else {
      diagnostics.invalidSchemaFixtures.push(fixture.id);
    }

    const labeledConfirmedCitationKeys = new Set(
      fixture.labels.confirmedCitations.map(
        (citation) => `${citation.requirementKey}::${citation.sourceChunkId}::${citation.quote}`,
      ),
    );
    const verifiedCitationKeysForRequirements = new Set<string>();
    verifiedCitationLabelCount += fixture.labels.confirmedCitations.length;

    let fixtureCrossTenantLeakageCount = 0;
    let fixturePersistedConfirmedWithUnverifiedCitationCount = 0;
    let fixtureUnsupportedPersistedConfirmedClaimCount = 0;
    let fixtureVerifiedCitationCount = 0;

    for (const citationEvaluation of replayResult.citationEvaluations) {
      if (citationEvaluation.verificationStatus !== "verified_exact") {
        continue;
      }

      verifiedCitationPredictedCount += 1;
      fixtureVerifiedCitationCount += 1;
      verifiedCitationKeysForRequirements.add(citationEvaluation.requirementKey);

      const citationKey = `${citationEvaluation.requirementKey}::${citationEvaluation.sourceChunkId}::${citationEvaluation.quote}`;
      if (labeledConfirmedCitationKeys.has(citationKey)) {
        verifiedCitationTruePositiveCount += 1;
      } else {
        diagnostics.falsePositiveVerifiedCitations.push(`${fixture.id}:${citationKey}`);
      }
    }

    const labelConfirmedRequirementKeys = new Set(
      fixture.labels.requirements
        .filter((requirement) => requirement.epistemicStatus === "confirmed")
        .map((requirement) => requirement.key),
    );
    const unsupportedClaimKeys = new Set(fixture.labels.unsupportedClaimKeys);

    for (const requirement of output.requirements) {
      if (!requirement.persisted) {
        continue;
      }

      if (
        requirement.organizationId !== fixture.input.context.organizationId ||
        requirement.projectId !== fixture.input.context.projectId
      ) {
        fixtureCrossTenantLeakageCount += 1;
        diagnostics.crossTenantLeakageAssertions.push(
          `${fixture.id}:requirement:${requirement.key}`,
        );
      }

      if (requirement.epistemicStatus !== "confirmed") {
        continue;
      }

      if (!verifiedCitationKeysForRequirements.has(requirement.key)) {
        persistedConfirmedWithUnverifiedCitationCount += 1;
        fixturePersistedConfirmedWithUnverifiedCitationCount += 1;
        diagnostics.persistedConfirmedWithUnverifiedCitation.push(
          formatFixtureRequirementKey(fixture.id, requirement.key),
        );
      }

      if (
        unsupportedClaimKeys.has(requirement.key) ||
        !labelConfirmedRequirementKeys.has(requirement.key)
      ) {
        unsupportedPersistedConfirmedClaimCount += 1;
        fixtureUnsupportedPersistedConfirmedClaimCount += 1;
        diagnostics.unsupportedPersistedConfirmedClaims.push(
          formatFixtureRequirementKey(fixture.id, requirement.key),
        );
      }
    }

    for (const citation of output.citations) {
      if (
        citation.organizationId !== fixture.input.context.organizationId ||
        citation.projectId !== fixture.input.context.projectId ||
        citation.snapshotId !== fixture.input.context.snapshotId
      ) {
        fixtureCrossTenantLeakageCount += 1;
        diagnostics.crossTenantLeakageAssertions.push(
          `${fixture.id}:citation:${citation.requirementKey}`,
        );
      }
    }

    const hasTenantMismatchInput = replayResult.promptFindingCodes.some(
      (code) => code === "cross_tenant_metadata_mismatch" || code === "cross_snapshot_mismatch",
    );
    const persistedArtifactCount =
      output.requirements.filter((requirement) => requirement.persisted).length +
      output.citations.length;
    if (hasTenantMismatchInput && persistedArtifactCount > 0) {
      fixtureCrossTenantLeakageCount += persistedArtifactCount;
      diagnostics.crossTenantLeakageAssertions.push(
        `${fixture.id}:persisted_artifacts_after_scope_mismatch`,
      );
    }

    crossTenantLeakageAssertionCount += fixtureCrossTenantLeakageCount;

    const criticalLabelRequirementKeys = new Set(
      fixture.labels.requirements
        .filter(
          (requirement) =>
            requirement.requirementType === "functional" && requirement.priority === "must_have",
        )
        .map((requirement) => requirement.key),
    );
    const criticalPredictedRequirementKeys = new Set(
      output.requirements
        .filter(
          (requirement) =>
            requirement.persisted &&
            requirement.requirementType === "functional" &&
            requirement.priority === "must_have",
        )
        .map((requirement) => requirement.key),
    );

    criticalRequirementLabelCount += criticalLabelRequirementKeys.size;
    criticalRequirementPredictedCount += criticalPredictedRequirementKeys.size;

    for (const key of criticalPredictedRequirementKeys) {
      if (criticalLabelRequirementKeys.has(key)) {
        criticalRequirementTruePositiveCount += 1;
      }
    }

    const predictedCoverageByCategory = new Map(
      output.coverage.map((coverage) => [coverage.categoryKey, coverage.status]),
    );
    for (const coverageLabel of fixture.labels.coverage) {
      coverageTotalCount += 1;
      if (predictedCoverageByCategory.get(coverageLabel.categoryKey) === coverageLabel.status) {
        coverageCorrectCount += 1;
      } else {
        diagnostics.missingCoveragePredictions.push(`${fixture.id}:${coverageLabel.categoryKey}`);
      }
    }

    for (const unsupportedClaimKey of unsupportedClaimKeys) {
      abstentionTotalCount += 1;
      const hasConfirmedUnsupportedClaim = output.requirements.some(
        (requirement) =>
          requirement.persisted &&
          requirement.key === unsupportedClaimKey &&
          requirement.epistemicStatus === "confirmed",
      );

      if (!hasConfirmedUnsupportedClaim) {
        abstentionCorrectCount += 1;
      }
    }

    const labelConflictKeys = new Set(
      fixture.labels.conflicts.map((conflict) =>
        createScopedConflictKey(
          fixture.id,
          conflict.leftRequirementKey,
          conflict.rightRequirementKey,
        ),
      ),
    );
    const predictedConflictKeys = new Set(
      output.conflicts.map((conflict) =>
        createScopedConflictKey(
          fixture.id,
          conflict.leftRequirementKey,
          conflict.rightRequirementKey,
        ),
      ),
    );

    conflictLabelCount += labelConflictKeys.size;
    conflictPredictedCount += predictedConflictKeys.size;

    for (const key of predictedConflictKeys) {
      if (labelConflictKeys.has(key)) {
        conflictTruePositiveCount += 1;
      }
    }

    const labelQuestionsByKey = new Map(
      fixture.labels.questions.map((question) => [question.questionKey, question]),
    );
    const predictedQuestionsByKey = new Map(
      output.questions.map((question) => [question.questionKey, question]),
    );
    const questionKeys = new Set([
      ...labelQuestionsByKey.keys(),
      ...predictedQuestionsByKey.keys(),
    ]);

    questionLinkageTotalCount += questionKeys.size;
    for (const questionKey of questionKeys) {
      const expected = labelQuestionsByKey.get(questionKey);
      const actual = predictedQuestionsByKey.get(questionKey);
      if (!expected || !actual) {
        diagnostics.incorrectQuestionLinkage.push(`${fixture.id}:${questionKey}`);
        continue;
      }

      const requirementLinksMatch = areEqualSets(
        expected.linkedRequirementKeys,
        actual.linkedRequirementKeys,
      );
      const coverageLinksMatch = areEqualSets(
        expected.linkedCoverageCategoryKeys,
        actual.linkedCoverageCategoryKeys,
      );
      if (requirementLinksMatch && coverageLinksMatch) {
        questionLinkageCorrectCount += 1;
      } else {
        diagnostics.incorrectQuestionLinkage.push(`${fixture.id}:${questionKey}`);
      }
    }

    const budgetCompliant =
      replayResult.usage.stoppedBeforeCeiling &&
      replayResult.usage.inputTokensUsed <= fixture.input.budget.maxInputTokensPerRun &&
      replayResult.usage.outputTokensUsed <= fixture.input.budget.maxOutputTokensPerRun &&
      replayResult.usage.costUsdUsed <= fixture.input.budget.maxUsdPerRun &&
      replayResult.usage.wallClockMs <= fixture.input.budget.maxWallClockMs;
    if (budgetCompliant) {
      budgetCompliantCount += 1;
    } else {
      diagnostics.budgetViolations.push(fixture.id);
    }

    fixtureResults.push({
      id: fixture.id,
      kind: fixture.kind,
      runtimeStatus: replayResult.runtimeStatus,
      runtimeErrorCode: replayResult.runtimeErrorCode,
      replayBindingPassed: replayResult.replayBindingPassed,
      promptFindingCodes: replayResult.promptFindingCodes,
      schemaValid,
      budgetCompliant,
      verifiedCitationCount: fixtureVerifiedCitationCount,
      labeledCitationCount: fixture.labels.confirmedCitations.length,
      persistedConfirmedWithUnverifiedCitationCount:
        fixturePersistedConfirmedWithUnverifiedCitationCount,
      unsupportedPersistedConfirmedClaimCount: fixtureUnsupportedPersistedConfirmedClaimCount,
      crossTenantLeakageCount: fixtureCrossTenantLeakageCount,
    });
  }

  return {
    metrics: {
      schemaValidity: {
        ...createRatioMetric(schemaValidNumerator, schemaValidDenominator),
        shapeOnlyRepairUsedCount,
      },
      citationPrecision: createRatioMetric(
        verifiedCitationTruePositiveCount,
        verifiedCitationPredictedCount,
      ),
      citationRecall: createRatioMetric(
        verifiedCitationTruePositiveCount,
        verifiedCitationLabelCount,
      ),
      criticalRequirementPrecision: createRatioMetric(
        criticalRequirementTruePositiveCount,
        criticalRequirementPredictedCount,
      ),
      criticalRequirementRecall: createRatioMetric(
        criticalRequirementTruePositiveCount,
        criticalRequirementLabelCount,
      ),
      coverageClassificationAccuracy: createRatioMetric(coverageCorrectCount, coverageTotalCount),
      abstentionCorrectness: createRatioMetric(abstentionCorrectCount, abstentionTotalCount),
      conflictPrecision: createRatioMetric(conflictTruePositiveCount, conflictPredictedCount),
      conflictRecall: createRatioMetric(conflictTruePositiveCount, conflictLabelCount),
      questionLinkageCorrectness: createRatioMetric(
        questionLinkageCorrectCount,
        questionLinkageTotalCount,
      ),
      persistedConfirmedWithUnverifiedCitation: {
        count: persistedConfirmedWithUnverifiedCitationCount,
      },
      unsupportedPersistedConfirmedClaims: {
        count: unsupportedPersistedConfirmedClaimCount,
      },
      crossTenantLeakageAssertions: {
        count: crossTenantLeakageAssertionCount,
      },
      budgetCompliance: createRatioMetric(budgetCompliantCount, budgetTotalCount),
    },
    fixtureResults,
    diagnostics,
  };
}
