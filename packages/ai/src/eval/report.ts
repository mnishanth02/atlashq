import {
  evaluateReleaseGate,
  type ReleaseGateEvaluation,
  type ReleaseGateResultEntry,
} from "./gate.js";
import {
  computeEvaluationMetrics,
  type EvaluationDiagnostics,
  type EvaluationMetrics,
  type FixtureEvaluationResult,
} from "./metrics.js";
import {
  type DeterministicReplayMode,
  type DeterministicReplayRunOptions,
  type ReplayBoundCandidate,
  runDeterministicReplay,
} from "./replay-runner.js";

export const evalReportVersion = "module-03-eval-report-v2";

export type DeterministicReplayReport = {
  fixtureSummary: {
    total: number;
    gold: number;
    adversarial: number;
  };
  replayIntegrityPassed: boolean;
  replayIntegrityErrors: readonly string[];
  metrics: EvaluationMetrics;
  fixtureResults: readonly FixtureEvaluationResult[];
  diagnostics: EvaluationDiagnostics;
  releaseGate: ReleaseGateEvaluation;
  boundReplayCandidates: readonly ReplayBoundCandidate[];
};

export type LiveProviderQualityReport = {
  status: "not_run";
  note: string;
};

export type EvaluationReport = {
  reportVersion: string;
  generatedAt: string;
  deterministicReplay: DeterministicReplayReport;
  liveProviderQuality: LiveProviderQualityReport;
  releaseGate: ReleaseGateEvaluation;
};

export type BuildEvaluationReportOptions = {
  replay?: DeterministicReplayRunOptions;
};

function buildReplayIntegrityGate(
  replayIntegrityErrors: readonly string[],
): ReleaseGateResultEntry {
  return {
    id: "replay_artifact_integrity",
    label: "Replay artifact integrity (prompt/schema/pipeline/hash binding)",
    kind: "count",
    comparator: "<=",
    threshold: 0,
    thresholdDisplay: "0",
    actual: replayIntegrityErrors.length,
    actualDisplay: `${replayIntegrityErrors.length}`,
    passed: replayIntegrityErrors.length === 0,
  };
}

function summarizeFixtures(
  fixtureResults: readonly { kind: "gold" | "adversarial" }[],
): DeterministicReplayReport["fixtureSummary"] {
  const gold = fixtureResults.filter((fixture) => fixture.kind === "gold").length;
  const adversarial = fixtureResults.filter((fixture) => fixture.kind === "adversarial").length;
  return {
    total: fixtureResults.length,
    gold,
    adversarial,
  };
}

export async function buildEvaluationReport(
  mode: DeterministicReplayMode,
  options: BuildEvaluationReportOptions = {},
): Promise<EvaluationReport> {
  const deterministicReplayRun = await runDeterministicReplay(mode, options.replay);
  const computedMetrics = computeEvaluationMetrics(deterministicReplayRun.fixtureResults);
  const releaseGateFromThresholds = evaluateReleaseGate(computedMetrics.metrics);
  const replayIntegrityGate = buildReplayIntegrityGate(
    deterministicReplayRun.replayIntegrityErrors,
  );

  const releaseGate: ReleaseGateEvaluation = {
    thresholdVersion: releaseGateFromThresholds.thresholdVersion,
    passed: releaseGateFromThresholds.passed && replayIntegrityGate.passed,
    gates: [...releaseGateFromThresholds.gates, replayIntegrityGate],
  };

  const deterministicReplay: DeterministicReplayReport = {
    fixtureSummary: summarizeFixtures(computedMetrics.fixtureResults),
    replayIntegrityPassed: deterministicReplayRun.replayIntegrityPassed,
    replayIntegrityErrors: deterministicReplayRun.replayIntegrityErrors,
    metrics: computedMetrics.metrics,
    fixtureResults: computedMetrics.fixtureResults,
    diagnostics: computedMetrics.diagnostics,
    releaseGate,
    boundReplayCandidates: deterministicReplayRun.boundCandidates,
  };

  return {
    reportVersion: evalReportVersion,
    generatedAt: new Date().toISOString(),
    deterministicReplay,
    liveProviderQuality: {
      status: "not_run",
      note: "Run `pnpm ai:eval:live` to generate optional live-provider quality metrics.",
    },
    releaseGate,
  };
}
