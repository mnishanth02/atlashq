import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DeterministicReplayMode } from "./replay-runner.js";
import { buildEvaluationReport } from "./report.js";

type EvalMode = "report" | "check" | "baseline" | "live";

type CliOptions = {
  mode: EvalMode;
  reportPath: string;
  baselinePath: string;
  candidateReplayDirPath: string;
};

function parseCliOptions(argv: readonly string[]): CliOptions {
  let mode: EvalMode = "report";
  let reportPath = "../../test-results/ai-eval/report.json";
  let baselinePath = "../../test-results/ai-eval/baseline.json";
  let candidateReplayDirPath = "../../test-results/ai-eval/candidate-replays";

  for (const argument of argv) {
    if (argument.startsWith("--mode=")) {
      const value = argument.slice("--mode=".length);
      if (value === "report" || value === "check" || value === "baseline" || value === "live") {
        mode = value;
      } else {
        throw new TypeError(
          `Unknown eval mode "${value}". Expected report, check, baseline, or live.`,
        );
      }
      continue;
    }

    if (argument.startsWith("--report-path=")) {
      reportPath = argument.slice("--report-path=".length);
      continue;
    }

    if (argument.startsWith("--baseline-path=")) {
      baselinePath = argument.slice("--baseline-path=".length);
      continue;
    }

    if (argument.startsWith("--candidate-replay-dir=")) {
      candidateReplayDirPath = argument.slice("--candidate-replay-dir=".length);
    }
  }

  return {
    mode,
    reportPath,
    baselinePath,
    candidateReplayDirPath,
  };
}

async function writeJsonArtifact(targetPath: string, payload: unknown): Promise<string> {
  const resolvedPath = path.resolve(process.cwd(), targetPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return resolvedPath;
}

async function writeReplayCandidateArtifacts(
  candidateReplayDirPath: string,
  candidates: readonly unknown[],
): Promise<string[]> {
  const resolvedDirectory = path.resolve(process.cwd(), candidateReplayDirPath);
  await mkdir(resolvedDirectory, { recursive: true });

  const paths: string[] = [];
  for (const candidate of candidates) {
    const fixtureIdValue =
      typeof candidate === "object" && candidate !== null && "fixtureId" in candidate
        ? String(candidate.fixtureId)
        : "unknown-fixture";
    const artifactPath = path.join(resolvedDirectory, `${fixtureIdValue}.replay-bound.json`);
    await writeFile(artifactPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    paths.push(artifactPath);
  }
  return paths;
}

function printSummary(report: Awaited<ReturnType<typeof buildEvaluationReport>>): void {
  const replay = report.deterministicReplay;
  console.log(
    `Module 3 AI eval replay (${replay.fixtureSummary.total} fixtures: ${replay.fixtureSummary.gold} gold, ${replay.fixtureSummary.adversarial} adversarial)`,
  );

  for (const gate of report.releaseGate.gates) {
    const status = gate.passed ? "PASS" : "FAIL";
    console.log(
      `${status} ${gate.label}: ${gate.actualDisplay} ${gate.comparator} ${gate.thresholdDisplay}`,
    );
  }

  console.log(`Overall gate: ${report.releaseGate.passed ? "PASS" : "FAIL"}`);
  console.log(
    `Live-provider quality metrics: ${report.liveProviderQuality.status} (${report.liveProviderQuality.note})`,
  );
}

function mapToReplayMode(mode: EvalMode): DeterministicReplayMode {
  if (mode === "baseline") {
    return "baseline";
  }
  return "check";
}

async function runCli(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.mode === "live") {
    console.warn("Live-provider mode currently emits deterministic replay report metadata only.");
  }

  const report = await buildEvaluationReport(mapToReplayMode(options.mode));
  printSummary(report);
  const reportArtifactPath = await writeJsonArtifact(options.reportPath, report);
  console.log(`Report artifact: ${reportArtifactPath}`);

  if (options.mode === "baseline") {
    const baselineArtifact = {
      baselineVersion: "module-03-eval-baseline-v2",
      generatedAt: report.generatedAt,
      fixtureSummary: report.deterministicReplay.fixtureSummary,
      metrics: report.deterministicReplay.metrics,
      releaseGate: report.releaseGate,
      replayIntegrityErrors: report.deterministicReplay.replayIntegrityErrors,
      note: "Candidate replay artifacts are generated for explicit review and manual promotion.",
    };
    const baselineArtifactPath = await writeJsonArtifact(options.baselinePath, baselineArtifact);
    console.log(`Baseline artifact: ${baselineArtifactPath}`);

    const candidateArtifactPaths = await writeReplayCandidateArtifacts(
      options.candidateReplayDirPath,
      report.deterministicReplay.boundReplayCandidates,
    );
    console.log(`Candidate replay artifacts: ${candidateArtifactPaths.length}`);
  }

  if (options.mode === "check" && !report.releaseGate.passed) {
    process.exitCode = 1;
  }
}

await runCli();
