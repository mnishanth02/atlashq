import { describe, expect, it } from "vitest";
import {
  createModelPolicyHash,
  createProviderPolicyRegistry,
  normalizeAiProvider,
  providerPolicySchema,
} from "./index.js";

describe("provider policy contracts", () => {
  it("normalizes local aliases to openai-compatible", () => {
    expect(normalizeAiProvider("local")).toBe("openai-compatible");
    expect(normalizeAiProvider("local-placeholder")).toBe("openai-compatible");
  });

  it("resolves only approved provider policies", () => {
    const registry = createProviderPolicyRegistry([
      providerPolicySchema.parse({
        id: "policy_approved",
        organizationId: "org_1",
        provider: "openai",
        policyName: "prod-openai",
        modelAlias: "gpt-5",
        resolvedModelId: "gpt-5",
        dataRetentionMode: "strict",
        status: "approved",
        approvedForRequirementAnalysis: true,
        approvedBy: "user_1",
        approvedAt: "2024-01-01T00:00:00Z",
      }),
    ]);

    const policy = registry.resolveApprovedPolicy("policy_approved", "org_1");
    expect(policy.status).toBe("approved");
    expect(policy.approvedForRequirementAnalysis).toBe(true);
  });

  it("rejects inactive policies for new runs", () => {
    const registry = createProviderPolicyRegistry([
      providerPolicySchema.parse({
        id: "policy_inactive",
        organizationId: "org_1",
        provider: "anthropic",
        policyName: "prod-anthropic",
        modelAlias: "claude-sonnet-5",
        resolvedModelId: "claude-sonnet-5",
        dataRetentionMode: "strict",
        status: "inactive",
        approvedForRequirementAnalysis: false,
      }),
    ]);

    expect(() => registry.resolveApprovedPolicy("policy_inactive", "org_1")).toThrow(/inactive/i);
  });

  it("creates deterministic model policy hashes", () => {
    const hashA = createModelPolicyHash({
      provider: "openai-compatible",
      policyName: "local",
      modelAlias: "llama",
      resolvedModelId: "llama-3.1",
      dataRetentionMode: "none",
      maxUsdPerRun: 3,
      maxInputTokensPerRun: 300_000,
      maxOutputTokensPerRun: 30_000,
      maxWallClockSeconds: 1_800,
    });
    const hashB = createModelPolicyHash({
      provider: "openai-compatible",
      policyName: "local",
      modelAlias: "llama",
      resolvedModelId: "llama-3.1",
      dataRetentionMode: "none",
      maxUsdPerRun: 3,
      maxInputTokensPerRun: 300_000,
      maxOutputTokensPerRun: 30_000,
      maxWallClockSeconds: 1_800,
    });
    expect(hashA).toBe(hashB);
  });
});
