import { z } from "zod";
import { hashCanonicalJson } from "./json.js";

const requiredTextSchema = z.string().trim().min(1);

export const batchPlannerWarningCodeValues = [
  "budget_input_tokens_exceeded",
  "budget_output_tokens_exceeded",
  "chunk_too_large_for_batch_budget",
] as const;

export type BatchPlannerWarningCode = (typeof batchPlannerWarningCodeValues)[number];

export const tokenEstimationProfileSchema = z
  .object({
    charsPerToken: z.number().positive().default(4),
    fixedPromptTokens: z.number().int().min(0).default(200),
    perChunkOverheadTokens: z.number().int().min(0).default(12),
  })
  .strict();

export type TokenEstimationProfile = z.infer<typeof tokenEstimationProfileSchema>;

export const defaultTokenEstimationProfile = tokenEstimationProfileSchema.parse({});

export function estimateTokensFromText(
  text: string,
  profile: TokenEstimationProfile = defaultTokenEstimationProfile,
): number {
  const parsedProfile = tokenEstimationProfileSchema.parse(profile);
  const charCount = Array.from(text).length;
  return Math.ceil(charCount / parsedProfile.charsPerToken);
}

export const extractionCacheStageKindValues = [
  "confirmed_extraction",
  "reference_feature_extraction",
] as const;

export type ExtractionCacheStageKind = (typeof extractionCacheStageKindValues)[number];

export const batchPlannerChunkSchema = z
  .object({
    snapshotChunkId: requiredTextSchema,
    sourceDocumentId: requiredTextSchema,
    sourceOrder: z.number().int().min(0),
    sourceExtractionVersion: requiredTextSchema,
    chunkSequence: z.number().int().min(0),
    chunkContentHash: requiredTextSchema,
    text: z.string(),
    estimatedInputTokens: z.number().int().min(1).optional(),
  })
  .strict();

export type BatchPlannerChunk = z.infer<typeof batchPlannerChunkSchema>;

export const batchPlannerInputSchema = z
  .object({
    chunks: z.array(batchPlannerChunkSchema),
    maxInputTokensPerRun: z.number().int().min(1),
    maxInputTokensPerBatch: z.number().int().min(1),
    maxOutputTokensPerRun: z.number().int().min(1),
    maxOutputTokensPerBatch: z.number().int().min(1),
    inputTokensUsed: z.number().int().min(0).default(0),
    outputTokensUsed: z.number().int().min(0).default(0),
    profile: tokenEstimationProfileSchema.default(defaultTokenEstimationProfile),
  })
  .strict();

export type BatchPlannerInput = z.input<typeof batchPlannerInputSchema>;

export type PlannedBatch = {
  batchOrder: number;
  snapshotChunkIds: readonly string[];
  sourceChunkStartSequence: number;
  sourceChunkEndSequence: number;
  inputTokenEstimate: number;
  maxOutputTokens: number;
};

export type BatchPlanResult = {
  batches: readonly PlannedBatch[];
  excludedChunkIds: readonly string[];
  warningCodes: readonly BatchPlannerWarningCode[];
  projectedInputTokensUsed: number;
  projectedOutputTokensUsed: number;
};

function comparePlannerChunks(left: BatchPlannerChunk, right: BatchPlannerChunk): number {
  if (left.sourceOrder !== right.sourceOrder) {
    return left.sourceOrder - right.sourceOrder;
  }

  const extractionVersionCompare = left.sourceExtractionVersion.localeCompare(
    right.sourceExtractionVersion,
  );
  if (extractionVersionCompare !== 0) {
    return extractionVersionCompare;
  }

  if (left.chunkSequence !== right.chunkSequence) {
    return left.chunkSequence - right.chunkSequence;
  }

  return left.snapshotChunkId.localeCompare(right.snapshotChunkId);
}

export function planDeterministicBatches(input: BatchPlannerInput): BatchPlanResult {
  const parsed = batchPlannerInputSchema.parse(input);
  const sortedChunks = [...parsed.chunks].sort((left, right) => comparePlannerChunks(left, right));

  const warnings = new Set<BatchPlannerWarningCode>();
  const excludedChunkIds: string[] = [];
  const batches: PlannedBatch[] = [];

  let projectedInputTokens = parsed.inputTokensUsed;
  let projectedOutputTokens = parsed.outputTokensUsed;
  let currentBatchChunkIds: string[] = [];
  let currentBatchTokenEstimate = parsed.profile.fixedPromptTokens;
  let currentBatchStartSequence = 0;
  let currentBatchEndSequence = 0;
  let currentBatchHasData = false;

  const flushBatch = () => {
    if (!currentBatchHasData) {
      return;
    }

    const remainingOutput = parsed.maxOutputTokensPerRun - projectedOutputTokens;
    if (remainingOutput <= 0) {
      warnings.add("budget_output_tokens_exceeded");
      return;
    }

    const batchMaxOutputTokens = Math.min(parsed.maxOutputTokensPerBatch, remainingOutput);
    batches.push({
      batchOrder: batches.length,
      snapshotChunkIds: currentBatchChunkIds,
      sourceChunkStartSequence: currentBatchStartSequence,
      sourceChunkEndSequence: currentBatchEndSequence,
      inputTokenEstimate: currentBatchTokenEstimate,
      maxOutputTokens: batchMaxOutputTokens,
    });
    projectedOutputTokens += batchMaxOutputTokens;
    currentBatchChunkIds = [];
    currentBatchTokenEstimate = parsed.profile.fixedPromptTokens;
    currentBatchHasData = false;
  };

  for (const chunk of sortedChunks) {
    const estimatedTokens =
      chunk.estimatedInputTokens ??
      estimateTokensFromText(chunk.text, parsed.profile) + parsed.profile.perChunkOverheadTokens;

    if (estimatedTokens + parsed.profile.fixedPromptTokens > parsed.maxInputTokensPerBatch) {
      warnings.add("chunk_too_large_for_batch_budget");
      excludedChunkIds.push(chunk.snapshotChunkId);
      continue;
    }

    if (projectedInputTokens + estimatedTokens > parsed.maxInputTokensPerRun) {
      warnings.add("budget_input_tokens_exceeded");
      excludedChunkIds.push(chunk.snapshotChunkId);
      continue;
    }

    const wouldExceedBatch =
      currentBatchTokenEstimate + estimatedTokens > parsed.maxInputTokensPerBatch;
    if (wouldExceedBatch) {
      flushBatch();
    }

    if (!currentBatchHasData) {
      currentBatchStartSequence = chunk.chunkSequence;
      currentBatchHasData = true;
    }

    currentBatchEndSequence = chunk.chunkSequence;
    currentBatchChunkIds.push(chunk.snapshotChunkId);
    currentBatchTokenEstimate += estimatedTokens;
    projectedInputTokens += estimatedTokens;
  }

  flushBatch();

  return {
    batches,
    excludedChunkIds,
    warningCodes: Array.from(warnings.values()),
    projectedInputTokensUsed: projectedInputTokens,
    projectedOutputTokensUsed: projectedOutputTokens,
  };
}

export type ExtractionCacheKeyInput = {
  organizationId: string;
  stageKind: ExtractionCacheStageKind;
  sourceDocumentId: string;
  sourceContentHash: string;
  sourceExtractionVersion: string;
  chunkerVersion: string;
  chunkContentHashes: readonly string[];
  promptHash: string;
  schemaHash: string;
  pipelineHash: string;
  modelPolicyHash: string;
  temperature: 0;
  seed: number | null;
};

export function buildExtractionCacheKey(input: ExtractionCacheKeyInput): string {
  const stageKind = z.enum(extractionCacheStageKindValues).parse(input.stageKind);
  const payload = {
    organizationId: input.organizationId,
    stageKind,
    sourceDocumentId: input.sourceDocumentId,
    sourceContentHash: input.sourceContentHash,
    sourceExtractionVersion: input.sourceExtractionVersion,
    chunkerVersion: input.chunkerVersion,
    chunkContentHashes: [...input.chunkContentHashes],
    promptHash: input.promptHash,
    schemaHash: input.schemaHash,
    pipelineHash: input.pipelineHash,
    modelPolicyHash: input.modelPolicyHash,
    temperature: input.temperature,
    seed: input.seed,
  };

  return `${input.organizationId}:${hashCanonicalJson(payload)}`;
}
