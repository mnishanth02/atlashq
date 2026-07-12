import { AiCoreError } from "./errors.js";
import {
  type ApprovedProviderPolicy,
  type CanonicalAiProvider,
  createModelPolicyHash,
  normalizeAiProvider,
} from "./provider-policy.js";

type ProviderModelFactory = (
  config?: Readonly<Record<string, unknown>>,
) => (modelId: string) => unknown;

export type ProviderAdapter = {
  provider: CanonicalAiProvider;
  adapterId: string;
  supportsSeed: boolean;
  resolveModel: (resolvedModelId: string) => Promise<unknown> | unknown;
};

export type ResolvedProviderModel = {
  provider: CanonicalAiProvider;
  adapterId: string;
  modelAlias: string;
  resolvedModelId: string;
  providerDataRetentionMode: string;
  modelPolicyHash: string;
  supportsSeed: boolean;
  model: unknown;
};

export type ProviderRegistry = {
  readonly adapters: ReadonlyMap<CanonicalAiProvider, ProviderAdapter>;
  resolveFromPolicy(policy: ApprovedProviderPolicy): Promise<ResolvedProviderModel>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFunction(value: unknown): value is (...args: readonly unknown[]) => unknown {
  return typeof value === "function";
}

function removeUndefinedValues(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const entries = Object.entries(input).filter((entry) => entry[1] !== undefined);
  return Object.fromEntries(entries);
}

async function loadProviderModelFactory(
  moduleName: string,
  exportCandidates: readonly string[],
): Promise<ProviderModelFactory> {
  const loaded = (await import(moduleName as string)) as unknown;

  if (isFunction(loaded)) {
    return loaded as ProviderModelFactory;
  }

  if (!isRecord(loaded)) {
    throw new AiCoreError(
      "AI_PROVIDER_POLICY_MISMATCH",
      `Provider adapter module "${moduleName}" did not load as an object.`,
    );
  }

  for (const candidate of exportCandidates) {
    const maybeFactory = loaded[candidate];
    if (isFunction(maybeFactory)) {
      return maybeFactory as ProviderModelFactory;
    }
  }

  if (isFunction(loaded.default)) {
    return loaded.default as ProviderModelFactory;
  }

  throw new AiCoreError(
    "AI_PROVIDER_POLICY_MISMATCH",
    `Provider adapter module "${moduleName}" is missing a supported factory export.`,
  );
}

export async function createOpenAiProviderAdapter(
  options: { apiKey?: string; baseUrl?: string; organization?: string } = {},
): Promise<ProviderAdapter> {
  const modelFactory = await loadProviderModelFactory("@ai-sdk/openai", ["createOpenAI", "openai"]);
  const provider = modelFactory(
    removeUndefinedValues({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
      organization: options.organization,
    }),
  );

  return {
    provider: "openai",
    adapterId: "@ai-sdk/openai",
    supportsSeed: true,
    resolveModel: (resolvedModelId) => provider(resolvedModelId),
  };
}

export async function createAnthropicProviderAdapter(
  options: { apiKey?: string; baseUrl?: string } = {},
): Promise<ProviderAdapter> {
  const modelFactory = await loadProviderModelFactory("@ai-sdk/anthropic", [
    "createAnthropic",
    "anthropic",
  ]);
  const provider = modelFactory(
    removeUndefinedValues({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
    }),
  );

  return {
    provider: "anthropic",
    adapterId: "@ai-sdk/anthropic",
    supportsSeed: true,
    resolveModel: (resolvedModelId) => provider(resolvedModelId),
  };
}

export async function createOpenAiCompatibleProviderAdapter(options: {
  apiKey?: string;
  baseUrl: string;
  name?: string;
}): Promise<ProviderAdapter> {
  const modelFactory = await loadProviderModelFactory("@ai-sdk/openai-compatible", [
    "createOpenAICompatible",
    "openaiCompatible",
  ]);
  const provider = modelFactory(
    removeUndefinedValues({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
      name: options.name,
    }),
  );

  return {
    provider: "openai-compatible",
    adapterId: "@ai-sdk/openai-compatible",
    supportsSeed: true,
    resolveModel: (resolvedModelId) => provider(resolvedModelId),
  };
}

export type FakeLanguageModel = {
  kind: "fake-language-model";
  provider: CanonicalAiProvider;
  modelId: string;
};

export function createFakeProviderAdapter(
  provider: CanonicalAiProvider = "openai-compatible",
): ProviderAdapter {
  return {
    provider,
    adapterId: "fake-provider-adapter",
    supportsSeed: true,
    resolveModel: (resolvedModelId) =>
      ({
        kind: "fake-language-model",
        provider,
        modelId: resolvedModelId,
      }) satisfies FakeLanguageModel,
  };
}

export function isFakeLanguageModel(value: unknown): value is FakeLanguageModel {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.kind === "fake-language-model" &&
    typeof value.provider === "string" &&
    typeof value.modelId === "string"
  );
}

export function createProviderRegistry(adapters: readonly ProviderAdapter[]): ProviderRegistry {
  const adapterEntries = new Map<CanonicalAiProvider, ProviderAdapter>();

  for (const adapter of adapters) {
    if (adapterEntries.has(adapter.provider)) {
      throw new AiCoreError(
        "AI_PROVIDER_POLICY_MISMATCH",
        `Duplicate provider adapter registration for "${adapter.provider}".`,
      );
    }
    adapterEntries.set(adapter.provider, adapter);
  }

  return {
    adapters: adapterEntries,
    async resolveFromPolicy(policy) {
      const canonicalProvider = normalizeAiProvider(policy.provider);
      const adapter = adapterEntries.get(canonicalProvider);

      if (!adapter) {
        throw new AiCoreError(
          "AI_PROVIDER_POLICY_MISMATCH",
          `No adapter registered for provider "${canonicalProvider}".`,
        );
      }

      const model = await adapter.resolveModel(policy.resolvedModelId);
      return {
        provider: canonicalProvider,
        adapterId: adapter.adapterId,
        modelAlias: policy.modelAlias,
        resolvedModelId: policy.resolvedModelId,
        providerDataRetentionMode: policy.dataRetentionMode,
        modelPolicyHash: createModelPolicyHash(policy),
        supportsSeed: adapter.supportsSeed,
        model,
      };
    },
  };
}
