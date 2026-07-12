import { describe, expect, it } from "vitest";
import {
  type AiRun,
  aiRunPlanInputSchema,
  aiRunSchema,
  createAiProviderRegistry,
  planAiRun,
  promptContractSchema,
} from "./index.js";

describe("compatibility exports", () => {
  it("creates a provider registry without automatic fallback", () => {
    expect(createAiProviderRegistry()).toEqual({
      providers: ["openai-compatible"],
      defaultProvider: "openai-compatible",
      note: "Each run freezes one provider/model policy. Automatic provider/model fallback is disabled.",
    });
  });

  it("validates prompt contracts and plans canonical ai_run rows", () => {
    const prompt = promptContractSchema.parse({
      id: "confirmed-extraction-v1",
      version: "1.0.0",
      purpose: "confirmed_extraction",
      inputSchemaName: "ConfirmedExtractionInput",
      outputSchemaName: "ConfirmedExtractionOutput",
    });

    const run = planAiRun(
      {
        organizationId: "org_1",
        projectId: "project_1",
        agent: "requirements-analyzer",
        model: "gpt-5",
        provider: "openai-compatible",
        prompt,
        inputArtifactVersions: ["snapshot@v1"],
      },
      () => "2024-01-01T00:00:00Z",
    );

    expect(run.runStatus).toBe("planned");
    expect(run.reviewStatus).toBe("pending");
    expect(run.output).toBeNull();
    expect(run.cost).toBeNull();
  });

  it("defaults inputArtifactVersions to an empty array", () => {
    const prompt = promptContractSchema.parse({
      id: "coverage-v1",
      version: "1.0.0",
      purpose: "coverage_analysis",
      inputSchemaName: "CoverageInput",
      outputSchemaName: "CoverageOutput",
    });

    const run = planAiRun({
      organizationId: "org_1",
      projectId: "project_1",
      agent: "requirements-analyzer",
      model: "gpt-5",
      provider: "openai",
      prompt,
    });

    expect(run.inputArtifactVersions).toEqual([]);
  });

  it("validates persisted ai_run records against the canonical schema", () => {
    const record: AiRun = {
      organizationId: "org_1",
      projectId: "project_1",
      agent: "requirements-analyzer",
      model: "gpt-5",
      provider: "openai",
      promptVersion: "1.0.0",
      inputArtifactVersions: ["snapshot@v2"],
      output: { summary: "ok", citations: [1, 2, 3] },
      runStatus: "succeeded",
      cost: { currency: "USD", amount: 0.42, inputTokens: 1_200, outputTokens: 300 },
      reviewStatus: "accepted",
      reviewedBy: "user_1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:05:00Z",
    };

    expect(aiRunSchema.parse(record)).toEqual(record);
  });

  it("rejects invalid plan input shapes", () => {
    expect(() => aiRunPlanInputSchema.parse({})).toThrow();
  });
});
