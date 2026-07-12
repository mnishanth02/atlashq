import type {
  AiReviewStatus,
  AiRunStatus,
  JsonObject,
  JsonValue,
  OrganizationId,
  ProjectId,
  UserId,
} from "@atlashq/types";
import { aiReviewStatusValues, aiRunStatusValues } from "@atlashq/types";
import { z } from "zod";
import { type AiProvider, aiProviderValues, normalizeAiProvider } from "./provider-policy.js";

export const promptContractPurposeValues = [
  "requirements-analysis",
  "architecture-review",
  "citation-check",
  "confirmed_extraction",
  "reference_feature_extraction",
  "normalization_proposals",
  "conflict_detection",
  "coverage_analysis",
  "delivery_item_extraction",
  "question_generation",
] as const;

export type PromptContractPurpose = (typeof promptContractPurposeValues)[number];

export const promptContractSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    purpose: z.enum(promptContractPurposeValues),
    inputSchemaName: z.string().min(1),
    outputSchemaName: z.string().min(1),
  })
  .strict();

export type PromptContract = z.infer<typeof promptContractSchema>;

export type AiRunCost = {
  currency: string;
  amount: number;
  inputTokens?: number;
  outputTokens?: number;
};

export const aiRunCostSchema = z
  .object({
    currency: z.string().trim().min(1),
    amount: z.number().min(0),
    inputTokens: z.number().int().min(0).optional(),
    outputTokens: z.number().int().min(0).optional(),
  })
  .strict();

export type AiRun = {
  id?: string;
  organizationId: OrganizationId;
  projectId: ProjectId;
  agent: string;
  model: string;
  provider: AiProvider;
  promptVersion: string;
  inputArtifactVersions: readonly string[];
  output: JsonObject | null;
  runStatus: AiRunStatus;
  cost: AiRunCost | null;
  reviewedBy?: UserId;
  reviewStatus: AiReviewStatus;
  createdAt: string;
  updatedAt: string;
};

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jsonOutputSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema);

export const aiRunSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    organizationId: z.string().trim().min(1),
    projectId: z.string().trim().min(1),
    agent: z.string().trim().min(1),
    model: z.string().trim().min(1),
    provider: z.enum(aiProviderValues),
    promptVersion: z.string().trim().min(1),
    inputArtifactVersions: z.array(z.string().trim().min(1)),
    output: jsonOutputSchema.nullable(),
    runStatus: z.enum(aiRunStatusValues),
    cost: aiRunCostSchema.nullable(),
    reviewedBy: z.string().trim().min(1).optional(),
    reviewStatus: z.enum(aiReviewStatusValues),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const aiRunPlanInputSchema = z
  .object({
    organizationId: z.string().trim().min(1),
    projectId: z.string().trim().min(1),
    agent: z.string().trim().min(1),
    model: z.string().trim().min(1),
    provider: z.enum(aiProviderValues),
    prompt: promptContractSchema,
    inputArtifactVersions: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export type AiRunPlanInput = z.input<typeof aiRunPlanInputSchema>;

export function createAiProviderRegistry(providers: readonly AiProvider[] = ["openai-compatible"]) {
  const canonicalProviders = providers.map((provider) => normalizeAiProvider(provider));
  return {
    providers: canonicalProviders,
    defaultProvider: canonicalProviders[0] ?? "openai-compatible",
    note: "Each run freezes one provider/model policy. Automatic provider/model fallback is disabled.",
  } as const;
}

export function planAiRun(
  input: AiRunPlanInput,
  now: () => string = () => new Date().toISOString(),
): AiRun {
  const parsed = aiRunPlanInputSchema.parse(input);
  const timestamp = now();

  return {
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    agent: parsed.agent,
    model: parsed.model,
    provider: parsed.provider,
    promptVersion: parsed.prompt.version,
    inputArtifactVersions: parsed.inputArtifactVersions,
    output: null,
    runStatus: "planned",
    cost: null,
    reviewStatus: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
