import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AiCoreError,
  createFakeProviderAdapter,
  createProviderRegistry,
  generateStructuredAnalysisStep,
  isApprovedProviderPolicy,
  promptAssetRegistry,
  providerPolicySchema,
  type StructuredGenerateExecutor,
} from "./index.js";

const outputSchema = z
  .object({
    requirements: z.array(z.string().min(1)),
  })
  .strict();

async function resolveFakeModel() {
  const registry = createProviderRegistry([createFakeProviderAdapter("openai-compatible")]);
  const parsedPolicy = providerPolicySchema.parse({
    id: "policy_1",
    organizationId: "org_1",
    provider: "openai-compatible",
    policyName: "local-approved",
    modelAlias: "local-model",
    resolvedModelId: "local-model-v1",
    dataRetentionMode: "none",
    status: "approved",
    approvedForRequirementAnalysis: true,
    approvedBy: "user_1",
    approvedAt: "2024-01-01T00:00:00Z",
    maxUsdPerRun: 3,
    maxInputTokensPerRun: 300_000,
    maxOutputTokensPerRun: 30_000,
    maxWallClockSeconds: 1_800,
    tokenPricing: {
      inputUsdPerMillionTokens: 1,
      outputUsdPerMillionTokens: 1,
    },
  });
  if (!isApprovedProviderPolicy(parsedPolicy)) {
    throw new Error("Fixture policy must remain approved.");
  }
  const policy = parsedPolicy;

  return {
    policy,
    resolvedModel: await registry.resolveFromPolicy(policy),
  };
}

function buildExecutor(
  responses: ReadonlyArray<{
    output?: unknown;
    throws?: unknown;
    usage?: { inputTokens: number; outputTokens: number };
  }>,
): StructuredGenerateExecutor & { readonly calls: number } {
  let calls = 0;

  const executor = (async () => {
    const current = responses[calls];
    calls += 1;
    if (!current) {
      throw new Error("No fake response configured.");
    }
    if (current.throws) {
      throw current.throws;
    }
    return {
      output: current.output,
      usage: current.usage
        ? {
            inputTokens: current.usage.inputTokens,
            outputTokens: current.usage.outputTokens,
            totalTokens: current.usage.inputTokens + current.usage.outputTokens,
            costUsd: null,
          }
        : null,
      rawText: null,
      providerMetadata: null,
    };
  }) as StructuredGenerateExecutor;

  return Object.defineProperty(executor, "calls", {
    get() {
      return calls;
    },
  }) as StructuredGenerateExecutor & { readonly calls: number };
}

describe("generateStructuredAnalysisStep", () => {
  it("performs one shape-only repair and succeeds when repair output is valid", async () => {
    const fake = await resolveFakeModel();
    const executor = buildExecutor([
      {
        output: { requirements: "not-an-array" },
        usage: { inputTokens: 100, outputTokens: 10 },
      },
      {
        output: { requirements: ["Use SSO"] },
        usage: { inputTokens: 60, outputTokens: 15 },
      },
    ]);

    const result = await generateStructuredAnalysisStep({
      organizationId: "org_1",
      projectId: "project_1",
      snapshotId: "snapshot_1",
      runId: "run_1",
      batchId: "batch_1",
      idempotencyKey: "idem_1",
      stageKind: "confirmed_extraction",
      providerPolicy: fake.policy,
      resolvedModel: fake.resolvedModel,
      promptAsset: promptAssetRegistry.getByKind("confirmed_extraction"),
      schema: outputSchema,
      schemaDescriptor: {
        name: "ConfirmedExtractionOutput",
        version: "1.0.0",
      },
      evidenceBlocks: [
        {
          blockId: "block_1",
          organizationId: "org_1",
          projectId: "project_1",
          snapshotId: "snapshot_1",
          sourceDocumentId: "source_1",
          sourceChunkId: "chunk_1",
          chunkContentHash: "hash_chunk_1",
          origin: "source",
          text: "All users must authenticate with SSO.",
        },
      ],
      budget: {
        maxUsdPerRun: 3,
        maxInputTokensPerRun: 1_000,
        maxOutputTokensPerRun: 500,
        maxWallClockMs: 30_000,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        costUsdUsed: 0,
      },
      executor,
    });

    expect(result.output).toEqual({ requirements: ["Use SSO"] });
    expect(result.shapeOnlyRepairUsed).toBe(true);
    expect(result.warnings).toContain("shape_only_repair_attempted");
    expect(executor.calls).toBe(2);
  });

  it("fails when schema remains invalid after one repair", async () => {
    const fake = await resolveFakeModel();
    const executor = buildExecutor([
      {
        output: { requirements: "still-invalid" },
      },
      {
        output: { requirements: "still-invalid" },
      },
    ]);

    await expect(
      generateStructuredAnalysisStep({
        organizationId: "org_1",
        projectId: "project_1",
        snapshotId: "snapshot_1",
        runId: "run_1",
        batchId: "batch_1",
        idempotencyKey: "idem_2",
        stageKind: "confirmed_extraction",
        providerPolicy: fake.policy,
        resolvedModel: fake.resolvedModel,
        promptAsset: promptAssetRegistry.getByKind("confirmed_extraction"),
        schema: outputSchema,
        schemaDescriptor: {
          name: "ConfirmedExtractionOutput",
          version: "1.0.0",
        },
        evidenceBlocks: [
          {
            blockId: "block_1",
            organizationId: "org_1",
            projectId: "project_1",
            snapshotId: "snapshot_1",
            sourceDocumentId: "source_1",
            sourceChunkId: "chunk_1",
            chunkContentHash: "hash_chunk_1",
            origin: "source",
            text: "All users must authenticate with SSO.",
          },
        ],
        budget: {
          maxUsdPerRun: 3,
          maxInputTokensPerRun: 1_000,
          maxOutputTokensPerRun: 500,
          maxWallClockMs: 30_000,
          inputTokensUsed: 0,
          outputTokensUsed: 0,
          costUsdUsed: 0,
        },
        executor,
      }),
    ).rejects.toMatchObject({
      code: "AI_RUN_SCHEMA_VALIDATION_FAILED",
    });
  });

  it("stops before model calls when budgets are exhausted", async () => {
    const fake = await resolveFakeModel();
    const executor = buildExecutor([
      {
        output: { requirements: ["never-used"] },
      },
    ]);

    await expect(
      generateStructuredAnalysisStep({
        organizationId: "org_1",
        projectId: "project_1",
        snapshotId: "snapshot_1",
        runId: "run_1",
        batchId: "batch_1",
        idempotencyKey: "idem_3",
        stageKind: "confirmed_extraction",
        providerPolicy: fake.policy,
        resolvedModel: fake.resolvedModel,
        promptAsset: promptAssetRegistry.getByKind("confirmed_extraction"),
        schema: outputSchema,
        schemaDescriptor: {
          name: "ConfirmedExtractionOutput",
          version: "1.0.0",
        },
        evidenceBlocks: [
          {
            blockId: "block_1",
            organizationId: "org_1",
            projectId: "project_1",
            snapshotId: "snapshot_1",
            sourceDocumentId: "source_1",
            sourceChunkId: "chunk_1",
            chunkContentHash: "hash_chunk_1",
            origin: "source",
            text: "Very long text ".repeat(300),
          },
        ],
        budget: {
          maxUsdPerRun: 3,
          maxInputTokensPerRun: 20,
          maxOutputTokensPerRun: 100,
          maxWallClockMs: 30_000,
          inputTokensUsed: 0,
          outputTokensUsed: 0,
          costUsdUsed: 0,
        },
        executor,
      }),
    ).rejects.toMatchObject({
      code: "AI_RUN_BUDGET_EXCEEDED",
    });

    expect(executor.calls).toBe(0);
  });

  it("classifies provider rate limits and surfaces typed ai-core errors", async () => {
    const fake = await resolveFakeModel();
    const executor = buildExecutor([
      {
        throws: { status: 429, message: "too many requests" },
      },
    ]);

    try {
      await generateStructuredAnalysisStep({
        organizationId: "org_1",
        projectId: "project_1",
        snapshotId: "snapshot_1",
        runId: "run_1",
        batchId: "batch_1",
        idempotencyKey: "idem_4",
        stageKind: "confirmed_extraction",
        providerPolicy: fake.policy,
        resolvedModel: fake.resolvedModel,
        promptAsset: promptAssetRegistry.getByKind("confirmed_extraction"),
        schema: outputSchema,
        schemaDescriptor: {
          name: "ConfirmedExtractionOutput",
          version: "1.0.0",
        },
        evidenceBlocks: [
          {
            blockId: "block_1",
            organizationId: "org_1",
            projectId: "project_1",
            snapshotId: "snapshot_1",
            sourceDocumentId: "source_1",
            sourceChunkId: "chunk_1",
            chunkContentHash: "hash_chunk_1",
            origin: "source",
            text: "All users must authenticate with SSO.",
          },
        ],
        budget: {
          maxUsdPerRun: 3,
          maxInputTokensPerRun: 1_000,
          maxOutputTokensPerRun: 500,
          maxWallClockMs: 30_000,
          inputTokensUsed: 0,
          outputTokensUsed: 0,
          costUsdUsed: 0,
        },
        executor,
      });
      throw new Error("Expected wrapped AiCoreError.");
    } catch (error) {
      expect(error).toBeInstanceOf(AiCoreError);
      expect((error as AiCoreError).code).toBe("AI_RUN_PROVIDER_RATE_LIMITED");
    }
  });
});
