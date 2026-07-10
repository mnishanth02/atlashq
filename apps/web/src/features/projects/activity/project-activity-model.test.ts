import { describe, expect, it } from "vitest";
import { summarizeAuditChange } from "./project-activity-model";

describe("summarizeAuditChange", () => {
  it("summarizes created payloads without dumping JSON", () => {
    expect(summarizeAuditChange(null, { name: "Atlas", visibility: "private" })).toBe(
      "Created 2 recorded fields.",
    );
  });

  it("redacts sensitive fields and omits raw values from summaries", () => {
    const summary = summarizeAuditChange(
      {
        notes: "Old note",
        token: "secret-before",
      },
      {
        notes: "Updated note",
        token: "secret-after",
      },
    );

    expect(summary).toContain("Changed Notes");
    expect(summary).toContain("sensitive field");
    expect(summary).not.toContain("secret-before");
    expect(summary).not.toContain("secret-after");
    expect(summary.toLowerCase()).not.toContain("token");
  });
});
