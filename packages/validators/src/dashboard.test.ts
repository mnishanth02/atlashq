import { describe, expect, it } from "vitest";
import { createDashboardZeroState, dashboardZeroStateSchema } from "./dashboard.js";

describe("dashboard zero-state", () => {
  it("produces sections that read as not-started rather than implying real analysis", () => {
    const zeroState = createDashboardZeroState();

    expect(zeroState.requirements).toEqual({
      state: "not_started",
      count: 0,
      label: "Requirements",
    });
    expect(zeroState.openQuestions.count).toBe(0);
    expect(zeroState.risksAndDeliveryItems.state).toBe("not_started");
    expect(zeroState.architectureReview.state).toBe("not_started");
    expect(zeroState.nextActions).toEqual(["Prepare for source document intake."]);
  });

  it("validates against the shared zero-state schema", () => {
    expect(() => dashboardZeroStateSchema.parse(createDashboardZeroState())).not.toThrow();
  });

  it("rejects a section state outside the controlled set", () => {
    const invalid = {
      ...createDashboardZeroState(),
      requirements: { state: "in_progress", count: 0, label: "Requirements" },
    };

    expect(() => dashboardZeroStateSchema.parse(invalid)).toThrow();
  });
});
