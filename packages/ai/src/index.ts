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

export const aiProviderValues = ["openai", "anthropic", "local-placeholder"] as const;
export type AiProvider = (typeof aiProviderValues)[number];

export const promptContractSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  purpose: z.enum(["requirements-analysis", "architecture-review", "citation-check"]),
  inputSchemaName: z.string().min(1),
  outputSchemaName: z.string().min(1),
});

export type PromptContract = z.infer<typeof promptContractSchema>;

/** Structured, JSON-safe token/dollar accounting for a single AI run. */
export type AiRunCost = {
  currency: string;
  amount: number;
  inputTokens?: number;
  outputTokens?: number;
};

export const aiRunCostSchema = z.object({
  currency: z.string().trim().min(1),
  amount: z.number().min(0),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
});

/**
 * Canonical application-level shape of the `ai_run` table (see
 * docs/architecture/v1-architecture-and-tech-stack.md §10.6 and
 * docs/impl-plan/module-01-project-workspace.md §7.1). This is a type/schema foundation only:
 * Module 1 creates the table shape, no AI runs execute yet.
 */
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

export const aiRunSchema = z.object({
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
});

/** Input required to plan (but not yet execute) a new AI run. */
export const aiRunPlanInputSchema = z.object({
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  agent: z.string().trim().min(1),
  model: z.string().trim().min(1),
  provider: z.enum(aiProviderValues),
  prompt: promptContractSchema,
  inputArtifactVersions: z.array(z.string().trim().min(1)).default([]),
});

export type AiRunPlanInput = z.input<typeof aiRunPlanInputSchema>;

export function createAiProviderRegistry(providers: readonly AiProvider[] = ["local-placeholder"]) {
  return {
    providers,
    defaultProvider: providers[0] ?? "local-placeholder",
    note: "Vercel AI SDK wiring is deferred until real AI workflows are implemented.",
  } as const;
}

/**
 * Builds a canonical `AiRun` record in the `planned` state. No AI provider call happens here;
 * this only stamps the provenance fields the `ai_run` table requires before execution begins.
 */
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
