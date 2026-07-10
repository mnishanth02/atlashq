import { describe, expect, it } from "vitest";
import {
  type AiRun,
  aiRunPlanInputSchema,
  aiRunSchema,
  createAiProviderRegistry,
  planAiRun,
  promptContractSchema,
} from "./index.js";

describe("ai placeholder contracts", () => {
  it("creates a local provider registry until real AI workflows are added", () => {
    expect(createAiProviderRegistry()).toEqual({
      providers: ["local-placeholder"],
      defaultProvider: "local-placeholder",
      note: "Vercel AI SDK wiring is deferred until real AI workflows are implemented.",
    });
  });

  it("validates prompt contracts and stamps a canonical planned ai_run", () => {
    const prompt = promptContractSchema.parse({
      id: "requirements-analysis-v1",
      version: "0.0.1",
      purpose: "requirements-analysis",
      inputSchemaName: "Input",
      outputSchemaName: "Output",
    });

    const run = planAiRun(
      {
        organizationId: "org_1",
        projectId: "project_1",
        agent: "requirements-analyzer",
        model: "gpt-4.1",
        provider: "local-placeholder",
        prompt,
        inputArtifactVersions: ["source_document@v1"],
      },
      () => "2024-01-01T00:00:00Z",
    );

    expect(run.runStatus).toBe("planned");
    expect(run.reviewStatus).toBe("pending");
    expect(run.output).toBeNull();
    expect(run.cost).toBeNull();
    expect(run.promptVersion).toBe("0.0.1");
    expect(run.createdAt).toBe("2024-01-01T00:00:00Z");
    expect(run.updatedAt).toBe("2024-01-01T00:00:00Z");
  });

  it("defaults inputArtifactVersions to an empty list when omitted", () => {
    const prompt = promptContractSchema.parse({
      id: "architecture-review-v1",
      version: "0.0.1",
      purpose: "architecture-review",
      inputSchemaName: "Input",
      outputSchemaName: "Output",
    });

    const run = planAiRun({
      organizationId: "org_1",
      projectId: "project_1",
      agent: "architecture-reviewer",
      model: "gpt-4.1",
      provider: "openai",
      prompt,
    });

    expect(run.inputArtifactVersions).toEqual([]);
  });

  it("rejects plan input missing required identifiers", () => {
    expect(() => aiRunPlanInputSchema.parse({})).toThrow();
  });

  it("validates a fully persisted ai_run record against the canonical schema", () => {
    const record: AiRun = {
      organizationId: "org_1",
      projectId: "project_1",
      agent: "requirements-analyzer",
      model: "gpt-4.1",
      provider: "openai",
      promptVersion: "1.0.0",
      inputArtifactVersions: ["source_document@v2"],
      output: { summary: "ok", citations: [1, 2, 3] },
      runStatus: "succeeded",
      cost: { currency: "USD", amount: 0.42, inputTokens: 1200, outputTokens: 300 },
      reviewStatus: "accepted",
      reviewedBy: "user_1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:05:00Z",
    };

    expect(aiRunSchema.parse(record)).toEqual(record);
  });

  it("rejects an ai_run with an invalid runStatus/reviewStatus value", () => {
    expect(() =>
      aiRunSchema.parse({
        organizationId: "org_1",
        projectId: "project_1",
        agent: "requirements-analyzer",
        model: "gpt-4.1",
        provider: "openai",
        promptVersion: "1.0.0",
        inputArtifactVersions: [],
        output: null,
        runStatus: "accepted",
        cost: null,
        reviewStatus: "pending",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      }),
    ).toThrow();
  });
});
