import { describe, expect, it } from "vitest";
import { loadReplayBoundFixtures, loadReplayRawFixtures } from "../fixtures/replay.js";
import { hashCanonicalJson } from "../json.js";
import { buildEvaluationReport } from "./report.js";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("deterministic replay runner integrity", () => {
  it("fails eval check when bound pipeline hash no longer matches runtime pipeline hash", async () => {
    const boundFixtures = cloneValue(loadReplayBoundFixtures());
    const targetFixture = boundFixtures[0];
    if (!targetFixture) {
      throw new TypeError("Expected at least one bound replay fixture.");
    }

    targetFixture.pipelineHash = "pipeline-hash-regression";

    const report = await buildEvaluationReport("check", {
      replay: {
        boundFixtures,
      },
    });

    expect(report.releaseGate.passed).toBe(false);
    expect(
      report.deterministicReplay.replayIntegrityErrors.some((error) =>
        error.includes("pipeline-hash-mismatch"),
      ),
    ).toBe(true);
  });

  it("fails eval check when recorded raw responses are malformed/fabricated", async () => {
    const rawFixtures = cloneValue(loadReplayRawFixtures());
    const boundFixtures = cloneValue(loadReplayBoundFixtures());

    const targetRaw = rawFixtures.find(
      (fixture) => fixture.fixtureId === "gold-clean-well-specified-v1",
    );
    const targetBound = boundFixtures.find(
      (fixture) => fixture.fixtureId === "gold-clean-well-specified-v1",
    );
    if (!targetRaw || !targetBound) {
      throw new TypeError("Expected replay fixtures for gold-clean-well-specified-v1.");
    }

    targetRaw.responses = [
      {
        output: {
          malformed: "fabricated-response",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 10,
        },
      },
    ];
    targetBound.rawResponsesHash = hashCanonicalJson(targetRaw);

    const report = await buildEvaluationReport("check", {
      replay: {
        rawFixtures,
        boundFixtures,
      },
    });

    expect(report.releaseGate.passed).toBe(false);
    expect(
      report.deterministicReplay.replayIntegrityErrors.some((error) =>
        error.includes("bound-output-hash-mismatch"),
      ) ||
        report.deterministicReplay.replayIntegrityErrors.some((error) =>
          error.includes("bound-expected-error-mismatch"),
        ),
    ).toBe(true);
  });
});
