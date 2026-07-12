import { describe, expect, it } from "vitest";
import { TERMINAL_RUN_STATUSES } from "./requirement-analysis-api";
import {
  canCancelRun,
  canReplayRun,
  canReprocessRun,
  canRetryRun,
} from "./requirement-analysis-presentation";

describe("run action affordance rules", () => {
  it("only allows cancel while the run is non-terminal and the viewer can analyze", () => {
    expect(canCancelRun("running", true)).toBe(true);
    expect(canCancelRun("waiting_retry", true)).toBe(true);
    expect(canCancelRun("running", false)).toBe(false);
    for (const status of TERMINAL_RUN_STATUSES) {
      expect(canCancelRun(status, true)).toBe(false);
    }
  });

  it("only allows retry for a failed, retryable run when the viewer can analyze", () => {
    expect(canRetryRun("failed", true, true)).toBe(true);
    expect(canRetryRun("failed", false, true)).toBe(false);
    expect(canRetryRun("failed", true, false)).toBe(false);
    // Retry is intentionally narrower than replay/reprocess: canceled runs
    // are terminal but never retryable, only replayable/reprocessable.
    expect(canRetryRun("canceled", true, true)).toBe(false);
    expect(canRetryRun("completed", true, true)).toBe(false);
  });

  it("allows replay for every terminal status, including canceled", () => {
    expect(canReplayRun("completed", true)).toBe(true);
    expect(canReplayRun("completed_with_warnings", true)).toBe(true);
    expect(canReplayRun("failed", true)).toBe(true);
    expect(canReplayRun("canceled", true)).toBe(true);
    expect(canReplayRun("canceled", false)).toBe(false);
    expect(canReplayRun("running", true)).toBe(false);
  });

  it("allows reprocess for every terminal status, including canceled", () => {
    expect(canReprocessRun("completed", true)).toBe(true);
    expect(canReprocessRun("completed_with_warnings", true)).toBe(true);
    expect(canReprocessRun("failed", true)).toBe(true);
    expect(canReprocessRun("canceled", true)).toBe(true);
    expect(canReprocessRun("canceled", false)).toBe(false);
    expect(canReprocessRun("running", true)).toBe(false);
  });

  it("matches the API's TERMINAL_RUN_STATUSES for replay/reprocess eligibility", () => {
    const nonTerminalStatuses = [
      "requested",
      "snapshotting",
      "queued",
      "running",
      "waiting_retry",
    ] as const;
    for (const status of TERMINAL_RUN_STATUSES) {
      expect(canReplayRun(status, true)).toBe(true);
      expect(canReprocessRun(status, true)).toBe(true);
    }
    for (const status of nonTerminalStatuses) {
      expect(canReplayRun(status, true)).toBe(false);
      expect(canReprocessRun(status, true)).toBe(false);
    }
  });
});
