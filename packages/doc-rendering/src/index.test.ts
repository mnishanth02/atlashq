import { describe, expect, it } from "vitest";
import { createRenderPlan, renderRequestSchema } from "./index.js";

describe("doc rendering placeholder", () => {
  it("creates worker-backed render plans for supported export formats", () => {
    expect(createRenderPlan({ source: "# Handoff", format: "markdown" })).toEqual({
      format: "markdown",
      status: "placeholder",
      requiresWorkerQueue: true,
    });
  });

  it("rejects unsupported formats before worker execution", () => {
    expect(() => renderRequestSchema.parse({ source: "# Handoff", format: "docx" })).toThrow();
  });
});
