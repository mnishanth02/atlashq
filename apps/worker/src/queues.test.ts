import { describe, expect, it } from "vitest";
import { queueNames } from "./queues.js";

describe("queueNames", () => {
  it("registers all Phase 2 placeholder queues", () => {
    expect(queueNames).toEqual([
      "document-processing",
      "ai-analysis",
      "citation-verification",
      "export-generation",
      "github-sync",
      "maintenance",
    ]);
  });
});
