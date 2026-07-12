import { describe, expect, it } from "vitest";
import { evaluateReleaseGate } from "./gate.js";
import { buildEvaluationReport } from "./report.js";

describe("release gate thresholds", () => {
  it("passes with checked-in deterministic replay metrics", async () => {
    const report = await buildEvaluationReport("check");
    expect(report.releaseGate.passed).toBe(true);
  });

  it("fails transparent threshold checks when ratio metrics regress", async () => {
    const report = await buildEvaluationReport("check");
    const degradedMetrics = {
      ...report.deterministicReplay.metrics,
      citationPrecision: {
        ...report.deterministicReplay.metrics.citationPrecision,
        value: 0.5,
      },
    };

    const gate = evaluateReleaseGate(degradedMetrics);
    expect(gate.passed).toBe(false);
    const citationGate = gate.gates.find((entry) => entry.id === "verified_citation_precision");
    expect(citationGate?.passed).toBe(false);
  });

  it("fails zero-tolerance gates when unsupported confirmed claims appear", async () => {
    const report = await buildEvaluationReport("check");
    const degradedMetrics = {
      ...report.deterministicReplay.metrics,
      unsupportedPersistedConfirmedClaims: {
        count: 1,
      },
    };

    const gate = evaluateReleaseGate(degradedMetrics);
    expect(gate.passed).toBe(false);
    const unsupportedGate = gate.gates.find(
      (entry) => entry.id === "unsupported_persisted_confirmed_claim",
    );
    expect(unsupportedGate?.passed).toBe(false);
  });
});
