import { z } from "zod";
import { estimateTokensFromText } from "./batch-planner.js";
import { AiCoreError, classifyProviderError } from "./errors.js";
import { hashCanonicalJson, stableStringifyJson } from "./json.js";
import { type AnalysisStageKind, module03PipelineDescriptor } from "./pipeline.js";
import {
  promptBundleHash,
  promptBundleVersion,
  type RegisteredPromptAsset,
  renderPrompt,
} from "./prompt-assets.js";
import {
  runPromptInjectionStructuralChecks,
  type StructuredEvidenceBlock,
} from "./prompt-injection.js";
import type { ApprovedProviderPolicy } from "./provider-policy.js";
import { isFakeLanguageModel, type ResolvedProviderModel } from "./provider-registry.js";

const requiredTextSchema = z.string().trim().min(1);

export const generationBudgetSchema = z
  .object({
    maxUsdPerRun: z.number().min(0),
    maxInputTokensPerRun: z.number().int().min(0),
    maxOutputTokensPerRun: z.number().int().min(0),
    maxWallClockMs: z.number().int().min(1),
    inputTokensUsed: z.number().int().min(0).default(0),
    outputTokensUsed: z.number().int().min(0).default(0),
    costUsdUsed: z.number().min(0).default(0),
    maxOutputTokensPerCall: z.number().int().min(1).optional(),
  })
  .strict();

export type GenerationBudget = z.infer<typeof generationBudgetSchema>;

export const schemaDescriptorSchema = z
  .object({
    name: requiredTextSchema,
    version: requiredTextSchema,
    hash: requiredTextSchema.optional(),
  })
  .strict();

export type SchemaDescriptor = z.infer<typeof schemaDescriptorSchema>;

export type GenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number | null;
};

export type StructuredGenerateExecutorRequest<TSchema extends z.ZodTypeAny> = {
  model: unknown;
  schema: TSchema;
  system: string;
  prompt: string;
  temperature: 0;
  seed?: number;
  abortSignal?: AbortSignal;
  maxOutputTokens: number;
};

export type StructuredGenerateExecutorResponse = {
  output: unknown;
  usage: GenerationUsage | null;
  rawText: string | null;
  providerMetadata: Readonly<Record<string, unknown>> | null;
};

export type StructuredGenerateExecutor = <TSchema extends z.ZodTypeAny>(
  request: StructuredGenerateExecutorRequest<TSchema>,
) => Promise<StructuredGenerateExecutorResponse>;

export type GenerateStructuredAnalysisStepInput<TSchema extends z.ZodTypeAny> = {
  organizationId: string;
  projectId: string;
  snapshotId: string;
  runId: string;
  batchId: string;
  idempotencyKey: string;
  stageKind: AnalysisStageKind;
  providerPolicy: ApprovedProviderPolicy;
  resolvedModel: ResolvedProviderModel;
  promptAsset: RegisteredPromptAsset;
  schema: TSchema;
  schemaDescriptor: SchemaDescriptor;
  evidenceBlocks: readonly StructuredEvidenceBlock[];
  budget: GenerationBudget;
  timeoutMs?: number;
  seed?: number;
  abortSignal?: AbortSignal;
  semanticValidator?: (value: z.infer<TSchema>) => { ok: true } | { ok: false; detail: string };
  executor?: StructuredGenerateExecutor;
};

export type StructuredStepProvenance = {
  providerPolicyId: string;
  provider: string;
  modelAlias: string;
  resolvedModelId: string;
  providerDataRetentionMode: string;
  promptAssetId: string;
  promptVersion: string;
  promptHash: string;
  promptBundleVersion: string;
  promptBundleHash: string;
  schemaName: string;
  schemaVersion: string;
  schemaHash: string;
  pipelineVersion: string;
  pipelineHash: string;
  modelPolicyHash: string;
  idempotencyKey: string;
  temperature: 0;
  seedRequested: number | null;
  seedApplied: number | null;
};

export type GenerateStructuredAnalysisStepResult<TOutput> = {
  output: TOutput;
  usage: GenerationUsage;
  provenance: StructuredStepProvenance;
  shapeOnlyRepairUsed: boolean;
  warnings: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFunction(value: unknown): value is (...args: readonly unknown[]) => unknown {
  return typeof value === "function";
}

function getPropertyAsFunction(
  value: unknown,
  propertyName: string,
): (...args: readonly unknown[]) => unknown {
  if (!isRecord(value) || !isFunction(value[propertyName])) {
    throw new AiCoreError(
      "AI_RUN_PROVIDER_FAILURE",
      `AI SDK module is missing function "${propertyName}".`,
    );
  }

  return value[propertyName];
}

function getUsageFromResult(result: Record<string, unknown>): GenerationUsage | null {
  const usageCandidate = result.usage;
  if (!isRecord(usageCandidate)) {
    return null;
  }

  const inputTokens = Number(usageCandidate.inputTokens ?? 0);
  const outputTokens = Number(usageCandidate.outputTokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return null;
  }

  return {
    inputTokens: Math.max(0, Math.floor(inputTokens)),
    outputTokens: Math.max(0, Math.floor(outputTokens)),
    totalTokens: Math.max(0, Math.floor(inputTokens + outputTokens)),
    costUsd: null,
  };
}

export const aiSdkStructuredGenerateExecutor: StructuredGenerateExecutor = async (request) => {
  if (isFakeLanguageModel(request.model)) {
    throw new AiCoreError(
      "AI_RUN_PROVIDER_FAILURE",
      "Fake models can only be used with an injected test executor.",
    );
  }

  const aiModule = (await import("ai")) as unknown;
  const generateText = getPropertyAsFunction(aiModule, "generateText") as (
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
  const outputNamespace = isRecord(aiModule) ? aiModule.Output : undefined;
  const outputObjectFactory = getPropertyAsFunction(outputNamespace, "object") as (
    payload: Record<string, unknown>,
  ) => unknown;

  const payload: Record<string, unknown> = {
    model: request.model,
    system: request.system,
    prompt: request.prompt,
    output: outputObjectFactory({ schema: request.schema }),
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
  };

  if (request.seed !== undefined) {
    payload.seed = request.seed;
  }
  if (request.abortSignal) {
    payload.abortSignal = request.abortSignal;
  }

  const rawResult = await generateText(payload);
  if (!isRecord(rawResult)) {
    throw new AiCoreError(
      "AI_RUN_PROVIDER_FAILURE",
      "AI SDK returned an invalid response payload.",
    );
  }

  const output = rawResult.output ?? rawResult.object;
  if (output === undefined) {
    throw new AiCoreError(
      "AI_RUN_SCHEMA_VALIDATION_FAILED",
      "AI SDK response did not contain a structured output object.",
    );
  }

  const textCandidate = rawResult.text;
  const providerMetadata = isRecord(rawResult.providerMetadata) ? rawResult.providerMetadata : null;
  return {
    output,
    usage: getUsageFromResult(rawResult),
    rawText: typeof textCandidate === "string" ? textCandidate : null,
    providerMetadata,
  };
};

function mergeAbortSignals(signalA?: AbortSignal, signalB?: AbortSignal): AbortSignal | undefined {
  if (!signalA && !signalB) {
    return undefined;
  }

  if (!signalA) {
    return signalB;
  }

  if (!signalB) {
    return signalA;
  }

  const controller = new AbortController();
  const onAbortA = () => controller.abort(signalA.reason);
  const onAbortB = () => controller.abort(signalB.reason);
  signalA.addEventListener("abort", onAbortA, { once: true });
  signalB.addEventListener("abort", onAbortB, { once: true });
  return controller.signal;
}

function createTimeoutAbortSignal(timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("AI wrapper timeout reached."));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  };
}

function calculateSchemaHash(schema: z.ZodTypeAny, descriptor: SchemaDescriptor): string {
  if (descriptor.hash) {
    return descriptor.hash;
  }

  const toJsonSchemaFunction = (
    z as unknown as { toJSONSchema?: (candidate: z.ZodTypeAny) => unknown }
  ).toJSONSchema;
  const jsonSchema = toJsonSchemaFunction
    ? toJsonSchemaFunction(schema)
    : { name: descriptor.name };
  return hashCanonicalJson(jsonSchema);
}

function sumUsage(attempts: readonly StructuredGenerateExecutorResponse[]): GenerationUsage {
  const totals = attempts.reduce(
    (accumulator, attempt) => {
      if (!attempt.usage) {
        return accumulator;
      }

      return {
        inputTokens: accumulator.inputTokens + attempt.usage.inputTokens,
        outputTokens: accumulator.outputTokens + attempt.usage.outputTokens,
      };
    },
    { inputTokens: 0, outputTokens: 0 },
  );

  return {
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    totalTokens: totals.inputTokens + totals.outputTokens,
    costUsd: null,
  };
}

function estimateUsageCostUsd(
  usage: GenerationUsage,
  policy: ApprovedProviderPolicy,
): number | null {
  if (!policy.tokenPricing) {
    return null;
  }

  const inputRate = policy.tokenPricing.inputUsdPerMillionTokens ?? 0;
  const outputRate = policy.tokenPricing.outputUsdPerMillionTokens ?? 0;
  return (
    (usage.inputTokens / 1_000_000) * inputRate + (usage.outputTokens / 1_000_000) * outputRate
  );
}

function createShapeRepairPrompt(failedOutput: unknown): string {
  return [
    "Shape-only repair requested.",
    "Repair the JSON object so it matches the schema exactly.",
    "Do not add new facts, quotes, citations, or claims.",
    "Only remove invalid fields, coerce obvious scalar/list shape mistakes, or set nullable fields to null.",
    "<invalid-output>",
    stableStringifyJson(failedOutput),
    "</invalid-output>",
  ].join("\n");
}

async function executeStructuredCall<TSchema extends z.ZodTypeAny>(input: {
  executor: StructuredGenerateExecutor;
  request: StructuredGenerateExecutorRequest<TSchema>;
}): Promise<StructuredGenerateExecutorResponse> {
  try {
    return await input.executor(input.request);
  } catch (error) {
    if (error instanceof AiCoreError) {
      throw error;
    }

    const classification = classifyProviderError(error);
    throw new AiCoreError(classification.code, classification.detail, {
      retryable: classification.retryable,
      safeDetail: classification.detail,
      cause: error,
    });
  }
}

export async function generateStructuredAnalysisStep<TSchema extends z.ZodTypeAny>(
  input: GenerateStructuredAnalysisStepInput<TSchema>,
): Promise<GenerateStructuredAnalysisStepResult<z.infer<TSchema>>> {
  const budget = generationBudgetSchema.parse(input.budget);
  const schemaDescriptor = schemaDescriptorSchema.parse(input.schemaDescriptor);
  const executor = input.executor ?? aiSdkStructuredGenerateExecutor;
  const warnings: string[] = [];

  if (input.promptAsset.stageKind !== input.stageKind) {
    throw new AiCoreError(
      "AI_PROVIDER_POLICY_MISMATCH",
      `Prompt asset "${input.promptAsset.id}" does not match stage "${input.stageKind}".`,
    );
  }

  const promptInjectionCheck = runPromptInjectionStructuralChecks({
    expectedOrganizationId: input.organizationId,
    expectedProjectId: input.projectId,
    expectedSnapshotId: input.snapshotId,
    blocks: [...input.evidenceBlocks],
  });

  if (!promptInjectionCheck.safe) {
    const detail = promptInjectionCheck.findings.map((finding) => finding.code).join(", ");
    throw new AiCoreError("AI_RUN_PROMPT_INJECTION_GUARD_TRIGGERED", detail);
  }

  const renderedPrompt = renderPrompt({
    promptAsset: input.promptAsset,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId: input.runId,
    batchId: input.batchId,
    snapshotId: input.snapshotId,
    evidenceBlocks: input.evidenceBlocks,
  });

  const projectedInputTokens =
    budget.inputTokensUsed +
    estimateTokensFromText(renderedPrompt.prompt) +
    estimateTokensFromText(renderedPrompt.developer);

  if (projectedInputTokens > budget.maxInputTokensPerRun) {
    throw new AiCoreError(
      "AI_RUN_BUDGET_EXCEEDED",
      "Input token budget exceeded before provider call.",
      { retryable: false },
    );
  }

  const remainingOutputTokens = budget.maxOutputTokensPerRun - budget.outputTokensUsed;
  if (remainingOutputTokens <= 0) {
    throw new AiCoreError("AI_RUN_BUDGET_EXCEEDED", "Output token budget already exhausted.");
  }

  const maxOutputTokens = Math.max(
    1,
    Math.min(remainingOutputTokens, budget.maxOutputTokensPerCall ?? remainingOutputTokens),
  );

  let seedToApply: number | undefined;
  if (input.seed !== undefined) {
    if (input.resolvedModel.supportsSeed) {
      seedToApply = input.seed;
    } else {
      warnings.push("seed_not_supported_by_provider");
    }
  }

  const timeoutSignal = createTimeoutAbortSignal(input.timeoutMs ?? budget.maxWallClockMs);
  const mergedAbortSignal = mergeAbortSignals(input.abortSignal, timeoutSignal.signal);

  const primaryRequest: StructuredGenerateExecutorRequest<TSchema> = {
    model: input.resolvedModel.model,
    schema: input.schema,
    system: renderedPrompt.system,
    prompt: `${renderedPrompt.developer}\n\n${renderedPrompt.prompt}`,
    temperature: 0,
    maxOutputTokens,
    ...(seedToApply !== undefined ? { seed: seedToApply } : {}),
    ...(mergedAbortSignal ? { abortSignal: mergedAbortSignal } : {}),
  };

  const attempts: StructuredGenerateExecutorResponse[] = [];

  try {
    const firstAttempt = await executeStructuredCall({
      executor,
      request: primaryRequest,
    });
    attempts.push(firstAttempt);

    let parsedOutput = input.schema.safeParse(firstAttempt.output);
    let repairUsed = false;

    if (!parsedOutput.success) {
      repairUsed = true;
      warnings.push("shape_only_repair_attempted");

      const repairAttempt = await executeStructuredCall({
        executor,
        request: {
          ...primaryRequest,
          prompt: createShapeRepairPrompt(firstAttempt.output),
        },
      });
      attempts.push(repairAttempt);
      parsedOutput = input.schema.safeParse(repairAttempt.output);
      if (!parsedOutput.success) {
        throw new AiCoreError(
          "AI_RUN_SCHEMA_VALIDATION_FAILED",
          "Schema validation failed after one shape-only repair attempt.",
          { retryable: false },
        );
      }
    }

    if (input.semanticValidator) {
      const semanticValidation = input.semanticValidator(parsedOutput.data);
      if (!semanticValidation.ok) {
        throw new AiCoreError("AI_RUN_SEMANTIC_VALIDATION_FAILED", semanticValidation.detail, {
          retryable: false,
        });
      }
    }

    const usage = sumUsage(attempts);
    const estimatedCostUsd = estimateUsageCostUsd(usage, input.providerPolicy);
    usage.costUsd = estimatedCostUsd;

    if (estimatedCostUsd !== null && budget.costUsdUsed + estimatedCostUsd > budget.maxUsdPerRun) {
      throw new AiCoreError(
        "AI_RUN_BUDGET_EXCEEDED",
        "Cost budget exceeded after provider call usage aggregation.",
        { retryable: false },
      );
    }

    const schemaHash = calculateSchemaHash(input.schema, schemaDescriptor);
    return {
      output: parsedOutput.data,
      usage,
      shapeOnlyRepairUsed: repairUsed,
      warnings,
      provenance: {
        providerPolicyId: input.providerPolicy.id,
        provider: input.resolvedModel.provider,
        modelAlias: input.resolvedModel.modelAlias,
        resolvedModelId: input.resolvedModel.resolvedModelId,
        providerDataRetentionMode: input.resolvedModel.providerDataRetentionMode,
        promptAssetId: input.promptAsset.id,
        promptVersion: input.promptAsset.version,
        promptHash: input.promptAsset.hash,
        promptBundleVersion,
        promptBundleHash,
        schemaName: schemaDescriptor.name,
        schemaVersion: schemaDescriptor.version,
        schemaHash,
        pipelineVersion: module03PipelineDescriptor.version,
        pipelineHash: module03PipelineDescriptor.hash,
        modelPolicyHash: input.resolvedModel.modelPolicyHash,
        idempotencyKey: input.idempotencyKey,
        temperature: 0,
        seedRequested: input.seed ?? null,
        seedApplied: seedToApply ?? null,
      },
    };
  } finally {
    timeoutSignal.cleanup();
  }
}
