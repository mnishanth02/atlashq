import { describe, expect, it } from "vitest";
import {
  createFakeProviderAdapter,
  createProviderRegistry,
  isApprovedProviderPolicy,
  isFakeLanguageModel,
  providerPolicySchema,
} from "./index.js";

describe("provider registry", () => {
  it("resolves a frozen policy against a registered provider without fallback", async () => {
    const registry = createProviderRegistry([createFakeProviderAdapter("openai-compatible")]);
    const parsedPolicy = providerPolicySchema.parse({
      id: "policy_1",
      organizationId: "org_1",
      provider: "local",
      policyName: "local-approved",
      modelAlias: "llama",
      resolvedModelId: "llama-3.1",
      dataRetentionMode: "none",
      status: "approved",
      approvedForRequirementAnalysis: true,
      approvedBy: "user_1",
      approvedAt: "2024-01-01T00:00:00Z",
    });
    if (!isApprovedProviderPolicy(parsedPolicy)) {
      throw new Error("Fixture policy must remain approved.");
    }
    const policy = parsedPolicy;

    const resolved = await registry.resolveFromPolicy(policy);
    expect(resolved.provider).toBe("openai-compatible");
    expect(resolved.resolvedModelId).toBe("llama-3.1");
    expect(isFakeLanguageModel(resolved.model)).toBe(true);
  });
});
