import {
  type ApprovedProviderPolicy,
  createAnthropicProviderAdapter,
  createFakeProviderAdapter,
  createOpenAiCompatibleProviderAdapter,
  createOpenAiProviderAdapter,
  createProviderPolicyRegistry,
  createProviderRegistry,
  type ProviderAdapter,
  type ProviderPolicy,
  type ProviderRegistry,
  type ResolvedProviderModel,
} from "@atlashq/ai";
import type { OrganizationAiProviderPolicy } from "@atlashq/db";

/**
 * Which real provider adapters to construct at worker boot (module-03 §7.1, §11.4). Only adapters
 * with configured credentials/endpoints are registered -- there is intentionally no automatic
 * fallback between providers, so a run whose frozen policy resolves to an unconfigured provider
 * fails fast with `AI_PROVIDER_POLICY_MISMATCH` from `@atlashq/ai`'s `ProviderRegistry` rather than
 * silently routing to a different model.
 */
export type AiProviderRuntimeConfig = {
  openai?: { apiKey: string };
  anthropic?: { apiKey: string };
  /** Also backs the `local`/`local-placeholder` policy aliases, which normalize to this adapter. */
  openAiCompatible?: { apiKey?: string; baseUrl: string; name?: string };
};

export async function createAiProviderRegistry(
  config: AiProviderRuntimeConfig,
): Promise<ProviderRegistry> {
  const adapters: ProviderAdapter[] = [];

  if (config.openai) {
    adapters.push(await createOpenAiProviderAdapter({ apiKey: config.openai.apiKey }));
  }
  if (config.anthropic) {
    adapters.push(await createAnthropicProviderAdapter({ apiKey: config.anthropic.apiKey }));
  }
  if (config.openAiCompatible) {
    adapters.push(
      await createOpenAiCompatibleProviderAdapter({
        baseUrl: config.openAiCompatible.baseUrl,
        ...(config.openAiCompatible.apiKey ? { apiKey: config.openAiCompatible.apiKey } : {}),
        ...(config.openAiCompatible.name ? { name: config.openAiCompatible.name } : {}),
      }),
    );
  }

  return createProviderRegistry(adapters);
}

/** Test-only registry: every canonical provider backed by `createFakeProviderAdapter`, so unit
 * tests never dynamically `import()` a real AI SDK package or make a network call. */
export function createFakeAiProviderRegistry(): ProviderRegistry {
  return createProviderRegistry([
    createFakeProviderAdapter("openai"),
    createFakeProviderAdapter("anthropic"),
    createFakeProviderAdapter("openai-compatible"),
  ]);
}

/** Maps a DB `organization_ai_provider_policy` row onto `@atlashq/ai`'s `ProviderPolicy` shape. */
export function mapProviderPolicyRow(row: OrganizationAiProviderPolicy): ProviderPolicy {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider as ProviderPolicy["provider"],
    policyName: row.policyName,
    modelAlias: row.modelAlias,
    resolvedModelId: row.resolvedModelId,
    dataRetentionMode: row.dataRetentionMode,
    status: row.status as ProviderPolicy["status"],
    approvedForRequirementAnalysis: row.approvedForRequirementAnalysis,
    ...(row.approvedBy ? { approvedBy: row.approvedBy } : {}),
    ...(row.approvedAt ? { approvedAt: row.approvedAt.toISOString() } : {}),
    ...(row.approvalNote ? { approvalNote: row.approvalNote } : {}),
    ...(row.providerTermsSnapshotHash
      ? { providerTermsSnapshotHash: row.providerTermsSnapshotHash }
      : {}),
    maxUsdPerRun: row.maxUsdPerRun,
    maxInputTokensPerRun: row.maxInputTokensPerRun,
    maxOutputTokensPerRun: row.maxOutputTokensPerRun,
    maxWallClockSeconds: row.maxWallClockSeconds,
  };
}

/**
 * Re-validates a single frozen `organization_ai_provider_policy` row through `@atlashq/ai`'s
 * approval gate (org match, non-inactive, fully approved) every time a stage resolves a model, so
 * a policy that is revoked or deactivated mid-run can never be used for a further model call even
 * though the run itself pinned the policy id at creation time.
 */
export function resolveApprovedPolicyFromRow(
  row: OrganizationAiProviderPolicy,
  organizationId: string,
): ApprovedProviderPolicy {
  const registry = createProviderPolicyRegistry([mapProviderPolicyRow(row)]);
  return registry.resolveApprovedPolicy(row.id, organizationId);
}

export async function resolveProviderModelForPolicy(
  providerRegistry: ProviderRegistry,
  row: OrganizationAiProviderPolicy,
  organizationId: string,
): Promise<{ approvedPolicy: ApprovedProviderPolicy; resolvedModel: ResolvedProviderModel }> {
  const approvedPolicy = resolveApprovedPolicyFromRow(row, organizationId);
  const resolvedModel = await providerRegistry.resolveFromPolicy(approvedPolicy);
  return { approvedPolicy, resolvedModel };
}
