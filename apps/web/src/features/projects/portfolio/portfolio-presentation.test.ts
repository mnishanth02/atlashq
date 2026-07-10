import { describe, expect, it } from "vitest";
import {
  formatPersonName,
  formatProjectClient,
  formatProjectDate,
  formatProjectPhase,
  formatProjectPriority,
  formatProjectType,
  formatProjectVisibility,
  formatRelativeUpdated,
  projectPriorityToSeverity,
  summarizeTags,
} from "./portfolio-presentation";

describe("label helpers", () => {
  it("maps enum values to human labels", () => {
    expect(formatProjectType("internal")).toBe("Internal");
    expect(formatProjectPhase("handoff")).toBe("Handoff");
    expect(formatProjectPriority("critical")).toBe("Critical");
    expect(formatProjectVisibility("organization")).toBe("Organization");
  });
});

describe("projectPriorityToSeverity", () => {
  it("maps priority onto the shared severity vocabulary", () => {
    expect(projectPriorityToSeverity("low")).toBe("low");
    expect(projectPriorityToSeverity("critical")).toBe("critical");
  });
});

describe("formatProjectClient", () => {
  it("returns 'Internal' for internal projects", () => {
    expect(formatProjectClient({ type: "internal", client: null })).toBe("Internal");
  });

  it("returns the client name for client projects", () => {
    expect(formatProjectClient({ type: "client", client: { id: "c1", name: "Northwind" } })).toBe(
      "Northwind",
    );
  });

  it("flags an unassigned client on a client project", () => {
    expect(formatProjectClient({ type: "client", client: null })).toBe("Unassigned client");
  });
});

describe("formatPersonName", () => {
  it("returns the name or an em dash fallback", () => {
    expect(formatPersonName({ name: "Ada" })).toBe("Ada");
    expect(formatPersonName(null)).toBe("—");
    expect(formatPersonName(undefined, "n/a")).toBe("n/a");
  });
});

describe("formatProjectDate", () => {
  it("formats an ISO datetime as a short UTC date", () => {
    expect(formatProjectDate("2024-06-01T00:00:00.000Z")).toBe("Jun 1, 2024");
  });

  it("falls back for null or invalid input", () => {
    expect(formatProjectDate(null)).toBe("—");
    expect(formatProjectDate("nonsense")).toBe("—");
  });
});

describe("formatRelativeUpdated", () => {
  const now = new Date("2024-06-10T00:00:00.000Z");

  it("formats past times deterministically against an injected now", () => {
    expect(formatRelativeUpdated("2024-06-08T00:00:00.000Z", now)).toBe("2 days ago");
    expect(formatRelativeUpdated("2024-06-09T00:00:00.000Z", now)).toBe("yesterday");
  });

  it("returns 'just now' for sub-minute differences", () => {
    expect(formatRelativeUpdated("2024-06-10T00:00:30.000Z", now)).toBe("just now");
  });

  it("falls back for null or invalid input", () => {
    expect(formatRelativeUpdated(null, now)).toBe("—");
    expect(formatRelativeUpdated("bad", now)).toBe("—");
  });
});

describe("summarizeTags", () => {
  it("returns the first N tags and an overflow count", () => {
    expect(summarizeTags(["a", "b", "c", "d", "e"], 3)).toEqual({
      visible: ["a", "b", "c"],
      overflow: 2,
    });
  });

  it("reports no overflow when within the limit", () => {
    expect(summarizeTags(["a", "b"], 3)).toEqual({ visible: ["a", "b"], overflow: 0 });
  });
});
