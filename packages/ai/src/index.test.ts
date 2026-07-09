import { describe, expect, it } from "vitest";
import { createAiProviderRegistry, planAiRun, promptContractSchema } from "./index.js";

describe("ai placeholder contracts", () => {
  it("creates a local provider registry until real AI workflows are added", () => {
    expect(createAiProviderRegistry()).toEqual({
      providers: ["local-placeholder"],
      defaultProvider: "local-placeholder",
      note: "Vercel AI SDK wiring is deferred until real AI workflows are implemented.",
    });
  });

  it("validates prompt contracts and preserves planned AI run metadata", () => {
    const prompt = promptContractSchema.parse({
      id: "requirements-analysis-v1",
      version: "0.0.0",
      purpose: "requirements-analysis",
      inputSchemaName: "Input",
      outputSchemaName: "Output",
    });
    const run = planAiRun({
      projectId: "project_123",
      provider: "local-placeholder",
      prompt,
      status: "planned",
    });

    expect(run.prompt).toBe(prompt);
    expect(run.status).toBe("planned");
  });
});
