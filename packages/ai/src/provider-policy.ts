import { z } from "zod";
import { AiCoreError } from "./errors.js";
import { hashCanonicalJson } from "./json.js";

const requiredTextSchema = z.string().trim().min(1);

export const canonicalAiProviderValues = ["openai", "anthropic", "openai-compatible"] as const;
export type CanonicalAiProvider = (typeof canonicalAiProviderValues)[number];

export const aiProviderAliasValues = ["local", "local-placeholder"] as const;
export type AiProviderAlias = (typeof aiProviderAliasValues)[number];

export const aiProviderValues = [...canonicalAiProviderValues, ...aiProviderAliasValues] as const;
export type AiProvider = (typeof aiProviderValues)[number];

export function normalizeAiProvider(provider: AiProvider): CanonicalAiProvider {
  if (provider === "local" || provider === "local-placeholder") {
    return "openai-compatible";
  }

  return provider;
}

export const providerPolicyStatusValues = ["draft", "approved", "inactive"] as const;
export type ProviderPolicyStatus = (typeof providerPolicyStatusValues)[number];

export const providerPolicyPricingSchema = z
  .object({
    inputUsdPerMillionTokens: z.number().min(0).optional(),
    outputUsdPerMillionTokens: z.number().min(0).optional(),
  })
  .strict();

export type ProviderPolicyPricing = z.infer<typeof providerPolicyPricingSchema>;

export const providerPolicySchema = z
  .object({
    id: requiredTextSchema,
    organizationId: requiredTextSchema,
    provider: z.enum(aiProviderValues),
    policyName: requiredTextSchema,
    modelAlias: requiredTextSchema,
    resolvedModelId: requiredTextSchema,
    dataRetentionMode: requiredTextSchema,
    status: z.enum(providerPolicyStatusValues),
    approvedForRequirementAnalysis: z.boolean(),
    approvedBy: requiredTextSchema.optional(),
    approvedAt: z.string().datetime({ offset: true }).optional(),
    approvalNote: z.string().trim().optional(),
    providerTermsSnapshotHash: z.string().trim().optional(),
    maxUsdPerRun: z.number().min(0).default(3),
    maxInputTokensPerRun: z.number().int().min(0).default(300_000),
    maxOutputTokensPerRun: z.number().int().min(0).default(30_000),
    maxWallClockSeconds: z.number().int().min(1).default(1_800),
    tokenPricing: providerPolicyPricingSchema.optional(),
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.status === "approved") {
      if (!policy.approvedForRequirementAnalysis) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Approved policies must be approved for requirement analysis.",
          path: ["approvedForRequirementAnalysis"],
        });
      }

      if (!policy.approvedBy) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Approved policies require approvedBy.",
          path: ["approvedBy"],
        });
      }

      if (!policy.approvedAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Approved policies require approvedAt.",
          path: ["approvedAt"],
        });
      }
    }
  });

export type ProviderPolicy = z.infer<typeof providerPolicySchema>;

export type ApprovedProviderPolicy = ProviderPolicy & {
  status: "approved";
  approvedForRequirementAnalysis: true;
  approvedBy: string;
  approvedAt: string;
};

export function isApprovedProviderPolicy(policy: ProviderPolicy): policy is ApprovedProviderPolicy {
  return (
    policy.status === "approved" &&
    policy.approvedForRequirementAnalysis &&
    typeof policy.approvedBy === "string" &&
    typeof policy.approvedAt === "string"
  );
}

export function createModelPolicyHash(
  policy: Pick<
    ProviderPolicy,
    | "provider"
    | "policyName"
    | "modelAlias"
    | "resolvedModelId"
    | "dataRetentionMode"
    | "maxUsdPerRun"
    | "maxInputTokensPerRun"
    | "maxOutputTokensPerRun"
    | "maxWallClockSeconds"
  >,
) {
  return hashCanonicalJson({
    provider: normalizeAiProvider(policy.provider),
    policyName: policy.policyName,
    modelAlias: policy.modelAlias,
    resolvedModelId: policy.resolvedModelId,
    dataRetentionMode: policy.dataRetentionMode,
    maxUsdPerRun: policy.maxUsdPerRun,
    maxInputTokensPerRun: policy.maxInputTokensPerRun,
    maxOutputTokensPerRun: policy.maxOutputTokensPerRun,
    maxWallClockSeconds: policy.maxWallClockSeconds,
  });
}

export type ProviderPolicyRegistry = {
  readonly policiesById: ReadonlyMap<string, ProviderPolicy>;
  resolveApprovedPolicy(policyId: string, organizationId: string): ApprovedProviderPolicy;
};

export function createProviderPolicyRegistry(
  policies: readonly ProviderPolicy[],
): ProviderPolicyRegistry {
  const parsedPolicies = policies.map((policy) => providerPolicySchema.parse(policy));
  const map = new Map(parsedPolicies.map((policy) => [policy.id, policy]));

  return {
    policiesById: map,
    resolveApprovedPolicy(policyId, organizationId) {
      const policy = map.get(policyId);

      if (!policy) {
        throw new AiCoreError(
          "AI_PROVIDER_NOT_APPROVED",
          `Provider policy "${policyId}" does not exist.`,
        );
      }

      if (policy.organizationId !== organizationId) {
        throw new AiCoreError(
          "AI_PROVIDER_POLICY_MISMATCH",
          `Provider policy "${policyId}" does not belong to organization "${organizationId}".`,
        );
      }

      if (policy.status === "inactive") {
        throw new AiCoreError(
          "AI_PROVIDER_POLICY_INACTIVE",
          `Provider policy "${policyId}" is inactive for new runs.`,
        );
      }

      if (!isApprovedProviderPolicy(policy)) {
        throw new AiCoreError(
          "AI_PROVIDER_NOT_APPROVED",
          `Provider policy "${policyId}" is not approved for requirement analysis.`,
        );
      }

      return policy;
    },
  };
}
