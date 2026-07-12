import { z } from "zod";
import {
  generateStructuredAnalysisStep,
  type StructuredGenerateExecutor,
  type StructuredGenerateExecutorRequest,
} from "../ai-wrapper.js";
import type { CitationVerificationStatus } from "../citation-verifier.js";
import { verifyCitationDeterministically } from "../citation-verifier.js";
import type { ConfidenceBandResult } from "../confidence.js";
import { calculateConfidenceBand } from "../confidence.js";
import { AiCoreError } from "../errors.js";
import {
  type AnalysisFixture,
  analysisFixtureModelOutputSchema,
  type FixtureKind,
  loadDefaultFixtureSet,
} from "../fixtures/harness.js";
import {
  loadReplayBoundFixtures,
  loadReplayRawFixtures,
  type ReplayBoundFixture,
  type ReplayRawFixture,
} from "../fixtures/replay.js";
import { hashCanonicalJson } from "../json.js";
import { module03PipelineDescriptor } from "../pipeline.js";
import { promptAssetRegistry, renderPrompt } from "../prompt-assets.js";
import { runPromptInjectionStructuralChecks } from "../prompt-injection.js";
import { isApprovedProviderPolicy, providerPolicySchema } from "../provider-policy.js";
import { createFakeProviderAdapter, createProviderRegistry } from "../provider-registry.js";

const evalOutputSchemaName = "EvalReplayOutput";
const evalOutputSchemaVersion = "1.0.0";

export type EvalReplayOutput = z.infer<typeof analysisFixtureModelOutputSchema>;

export type ReplayCitationEvaluation = {
  requirementKey: string;
  sourceChunkId: string;
  quote: string;
  verificationStatus: CitationVerificationStatus;
};

export type ReplayConfidenceEvaluation = {
  requirementKey: string;
  confidence: ConfidenceBandResult;
};

export type ReplayUsageSummary = {
  inputTokensUsed: number;
  outputTokensUsed: number;
  costUsdUsed: number;
  wallClockMs: number;
  stoppedBeforeCeiling: boolean;
};

export type DeterministicReplayFixtureResult = {
  fixtureId: string;
  fixtureKind: FixtureKind;
  fixture: AnalysisFixture;
  output: EvalReplayOutput;
  runtimeStatus: "success" | "error";
  runtimeErrorCode: string | null;
  schemaValidAfterRepair: boolean;
  shapeOnlyRepairUsed: boolean;
  usage: ReplayUsageSummary;
  promptFindingCodes: readonly string[];
  citationEvaluations: readonly ReplayCitationEvaluation[];
  confidenceEvaluations: readonly ReplayConfidenceEvaluation[];
  replayBindingPassed: boolean;
  replayBindingErrors: readonly string[];
};

export type ReplayBoundCandidate = ReplayBoundFixture;

export type DeterministicReplayMode = "report" | "check" | "baseline";

export type DeterministicReplayRunResult = {
  fixtures: readonly AnalysisFixture[];
  fixtureResults: readonly DeterministicReplayFixtureResult[];
  boundCandidates: readonly ReplayBoundCandidate[];
  replayIntegrityPassed: boolean;
  replayIntegrityErrors: readonly string[];
};

export type DeterministicReplayRunOptions = {
  fixtures?: readonly AnalysisFixture[];
  rawFixtures?: readonly ReplayRawFixture[];
  boundFixtures?: readonly ReplayBoundFixture[];
};

function createFixtureMap<T extends { fixtureId: string }>(
  entries: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(entries.map((entry) => [entry.fixtureId, entry]));
}

function calculateSchemaHash(schema: z.ZodTypeAny): string {
  const toJsonSchemaFunction = (
    z as unknown as { toJSONSchema?: (candidate: z.ZodTypeAny) => unknown }
  ).toJSONSchema;
  const jsonSchema = toJsonSchemaFunction
    ? toJsonSchemaFunction(schema)
    : { name: evalOutputSchemaName };
  return hashCanonicalJson(jsonSchema);
}

function normalizeReplayOutput(output: EvalReplayOutput): EvalReplayOutput {
  const requirements = [...output.requirements].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
  const citations = [...output.citations].sort((left, right) => {
    const leftKey = `${left.requirementKey}::${left.sourceChunkId}::${left.quote}`;
    const rightKey = `${right.requirementKey}::${right.sourceChunkId}::${right.quote}`;
    return leftKey.localeCompare(rightKey);
  });
  const coverage = [...output.coverage].sort((left, right) =>
    left.categoryKey.localeCompare(right.categoryKey),
  );
  const conflicts = [...output.conflicts].sort((left, right) => {
    const leftKey = `${left.leftRequirementKey}::${left.rightRequirementKey}`;
    const rightKey = `${right.leftRequirementKey}::${right.rightRequirementKey}`;
    return leftKey.localeCompare(rightKey);
  });
  const questions = [...output.questions].sort((left, right) =>
    left.questionKey.localeCompare(right.questionKey),
  );

  return analysisFixtureModelOutputSchema.parse({
    requirements,
    citations,
    coverage,
    conflicts,
    questions,
  });
}

function buildReplayInputHash(input: {
  fixture: AnalysisFixture;
  schemaHash: string;
  promptAssetHash: string;
  renderedPrompt: { system: string; developer: string; prompt: string };
}): string {
  return hashCanonicalJson({
    fixtureId: input.fixture.id,
    stageKind: input.fixture.runtime.stageKind,
    promptAssetKind: input.fixture.runtime.promptAssetKind,
    promptAssetHash: input.promptAssetHash,
    promptBundleHash: promptAssetRegistry.hash,
    pipelineHash: module03PipelineDescriptor.hash,
    schemaName: evalOutputSchemaName,
    schemaVersion: evalOutputSchemaVersion,
    schemaHash: input.schemaHash,
    context: input.fixture.input.context,
    evidenceBlocks: input.fixture.input.evidenceBlocks,
    renderedPrompt: input.renderedPrompt,
  });
}

function buildReplayRequestHash<TSchema extends z.ZodTypeAny>(
  request: StructuredGenerateExecutorRequest<TSchema>,
  schemaHash: string,
): string {
  return hashCanonicalJson({
    schemaHash,
    system: request.system,
    prompt: request.prompt,
    temperature: request.temperature,
    seed: request.seed ?? null,
    maxOutputTokens: request.maxOutputTokens,
  });
}

function createEmptyOutput(): EvalReplayOutput {
  return analysisFixtureModelOutputSchema.parse({
    requirements: [],
    citations: [],
    coverage: [],
    conflicts: [],
    questions: [],
  });
}

function createReplayProviderPolicy() {
  const parsedPolicy = providerPolicySchema.parse({
    id: "eval_replay_policy",
    organizationId: "eval_org",
    provider: "openai-compatible",
    policyName: "eval-replay-fake-provider",
    modelAlias: "eval-replay-model",
    resolvedModelId: "eval-replay-model-v1",
    dataRetentionMode: "none",
    status: "approved",
    approvedForRequirementAnalysis: true,
    approvedBy: "eval_system",
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
    throw new TypeError("Replay evaluation policy must remain approved.");
  }
  return parsedPolicy;
}

type ReplayExecutorFactoryInput = {
  rawFixture: ReplayRawFixture;
  schemaHash: string;
  expectedRequestHashes: readonly string[] | null;
  replayErrors: string[];
};

function createReplayExecutor(
  input: ReplayExecutorFactoryInput,
): StructuredGenerateExecutor & { getRequestHashes(): readonly string[] } {
  let requestIndex = 0;
  const requestHashes: string[] = [];

  const executor = (async (request) => {
    const response = input.rawFixture.responses[requestIndex];
    if (!response) {
      throw new TypeError(
        `Replay raw responses exhausted for fixture "${input.rawFixture.fixtureId}" at call ${requestIndex + 1}.`,
      );
    }

    const requestHash = buildReplayRequestHash(request, input.schemaHash);
    requestHashes.push(requestHash);
    const expectedRequestHash = input.expectedRequestHashes?.[requestIndex] ?? null;
    if (expectedRequestHash !== null && expectedRequestHash !== requestHash) {
      input.replayErrors.push(
        `${input.rawFixture.fixtureId}:request-hash-mismatch:${requestIndex}:${requestHash}:${expectedRequestHash}`,
      );
    }

    requestIndex += 1;
    return {
      output: response.output,
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.inputTokens + response.usage.outputTokens,
        costUsd: null,
      },
      rawText: null,
      providerMetadata: null,
    };
  }) as StructuredGenerateExecutor;

  return Object.assign(executor, {
    getRequestHashes() {
      return requestHashes;
    },
  });
}

function scoreOutput(
  fixture: AnalysisFixture,
  output: EvalReplayOutput,
): {
  citationEvaluations: readonly ReplayCitationEvaluation[];
  confidenceEvaluations: readonly ReplayConfidenceEvaluation[];
} {
  const evidenceByChunkId = new Map(
    fixture.input.evidenceBlocks.map((block) => [block.sourceChunkId, block]),
  );

  const citationEvaluations: ReplayCitationEvaluation[] = output.citations.map((citation) => {
    const sourceBlock = evidenceByChunkId.get(citation.sourceChunkId);
    if (!sourceBlock) {
      return {
        requirementKey: citation.requirementKey,
        sourceChunkId: citation.sourceChunkId,
        quote: citation.quote,
        verificationStatus: "failed",
      };
    }

    const verification = verifyCitationDeterministically({
      organizationId: citation.organizationId,
      projectId: citation.projectId,
      snapshotId: citation.snapshotId,
      snapshotHash: `${fixture.id}:snapshot-hash`,
      sourceDocumentId: citation.sourceDocumentId,
      sourceChunkId: citation.sourceChunkId,
      chunkContent: sourceBlock.text,
      chunkContentHash: sourceBlock.chunkContentHash,
      locator: {
        fixtureId: fixture.id,
      },
      proposedQuote: citation.quote,
    });
    return {
      requirementKey: citation.requirementKey,
      sourceChunkId: citation.sourceChunkId,
      quote: citation.quote,
      verificationStatus: verification.verificationStatus,
    };
  });

  const verifiedCitationsByRequirement = new Map<string, number>();
  const verifiedSourceDocsByRequirement = new Map<string, Set<string>>();
  for (const citation of output.citations) {
    const evaluation = citationEvaluations.find(
      (entry) =>
        entry.requirementKey === citation.requirementKey &&
        entry.sourceChunkId === citation.sourceChunkId &&
        entry.quote === citation.quote,
    );
    if (evaluation?.verificationStatus !== "verified_exact") {
      continue;
    }

    const count = verifiedCitationsByRequirement.get(citation.requirementKey) ?? 0;
    verifiedCitationsByRequirement.set(citation.requirementKey, count + 1);

    const sourceDocs =
      verifiedSourceDocsByRequirement.get(citation.requirementKey) ?? new Set<string>();
    sourceDocs.add(citation.sourceDocumentId);
    verifiedSourceDocsByRequirement.set(citation.requirementKey, sourceDocs);
  }

  const coverageByCategory = new Map(
    output.coverage.map((entry) => [entry.categoryKey, entry.status]),
  );
  const confidenceEvaluations: ReplayConfidenceEvaluation[] = output.requirements.map(
    (requirement) => {
      const hasConflict = output.conflicts.some(
        (conflict) =>
          conflict.leftRequirementKey === requirement.key ||
          conflict.rightRequirementKey === requirement.key,
      );
      const verifiedCitationCount = verifiedCitationsByRequirement.get(requirement.key) ?? 0;
      const corroboratingSourceDocumentCount =
        verifiedSourceDocsByRequirement.get(requirement.key)?.size ?? 0;
      const matchedCoverage = fixture.labels.coverage.find((entry) =>
        coverageByCategory.has(entry.categoryKey),
      );

      return {
        requirementKey: requirement.key,
        confidence: calculateConfidenceBand({
          epistemicStatus: requirement.epistemicStatus,
          verifiedExactCitationCount: verifiedCitationCount,
          corroboratingSourceDocumentCount,
          evidenceSpanCompleteness:
            verifiedCitationCount > 0 ? "complete" : "incomplete_or_ambiguous",
          stageAgreement: hasConflict ? "disagree_non_conflicting" : "agree",
          mappedCoverageStatus: matchedCoverage?.status ?? null,
          hasInferenceBasis: requirement.epistemicStatus === "assumed",
          supportingContextVerifiedCitationCount: verifiedCitationCount,
          hasConflict,
        }),
      };
    },
  );

  return {
    citationEvaluations,
    confidenceEvaluations,
  };
}

function normalizeUsage(input: {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  wallClockMs: number;
  budget: AnalysisFixture["input"]["budget"];
  runtimeErrorCode: string | null;
}): ReplayUsageSummary {
  const normalizedCost = input.costUsd ?? 0;
  const stoppedBeforeCeiling =
    input.runtimeErrorCode === "AI_RUN_BUDGET_EXCEEDED" ||
    (input.inputTokens <= input.budget.maxInputTokensPerRun &&
      input.outputTokens <= input.budget.maxOutputTokensPerRun &&
      normalizedCost <= input.budget.maxUsdPerRun &&
      input.wallClockMs <= input.budget.maxWallClockMs);

  return {
    inputTokensUsed: input.inputTokens,
    outputTokensUsed: input.outputTokens,
    costUsdUsed: normalizedCost,
    wallClockMs: input.wallClockMs,
    stoppedBeforeCeiling,
  };
}

async function runFixtureReplay(input: {
  mode: DeterministicReplayMode;
  fixture: AnalysisFixture;
  rawFixture: ReplayRawFixture;
  boundFixture: ReplayBoundFixture | null;
}): Promise<{
  fixtureResult: DeterministicReplayFixtureResult;
  candidate: ReplayBoundCandidate;
  replayErrors: readonly string[];
}> {
  const replayErrors: string[] = [];
  const fixture = input.fixture;
  const promptAsset = promptAssetRegistry.getByKind(fixture.runtime.promptAssetKind);
  const promptFindingCodes = runPromptInjectionStructuralChecks({
    expectedOrganizationId: fixture.input.context.organizationId,
    expectedProjectId: fixture.input.context.projectId,
    expectedSnapshotId: fixture.input.context.snapshotId,
    blocks: fixture.input.evidenceBlocks,
  }).findings.map((finding) => finding.code);

  const replayPolicy = createReplayProviderPolicy();
  const providerRegistry = createProviderRegistry([createFakeProviderAdapter("openai-compatible")]);
  const resolvedModel = await providerRegistry.resolveFromPolicy(replayPolicy);

  const schemaHash = calculateSchemaHash(analysisFixtureModelOutputSchema);
  const renderedPrompt = renderPrompt({
    promptAsset,
    organizationId: fixture.input.context.organizationId,
    projectId: fixture.input.context.projectId,
    runId: `eval-run:${fixture.id}`,
    batchId: `eval-batch:${fixture.id}`,
    snapshotId: fixture.input.context.snapshotId,
    evidenceBlocks: fixture.input.evidenceBlocks,
  });
  const inputHash = buildReplayInputHash({
    fixture,
    schemaHash,
    promptAssetHash: promptAsset.hash,
    renderedPrompt,
  });
  const rawResponsesHash = hashCanonicalJson(input.rawFixture);

  if (input.boundFixture) {
    if (input.boundFixture.fixtureId !== fixture.id) {
      replayErrors.push(`${fixture.id}:bound-fixture-id-mismatch`);
    }
    if (input.boundFixture.stageKind !== fixture.runtime.stageKind) {
      replayErrors.push(`${fixture.id}:bound-stage-kind-mismatch`);
    }
    if (input.boundFixture.promptAssetKind !== fixture.runtime.promptAssetKind) {
      replayErrors.push(`${fixture.id}:bound-prompt-kind-mismatch`);
    }
    if (input.boundFixture.schemaHash !== schemaHash) {
      replayErrors.push(`${fixture.id}:schema-hash-mismatch`);
    }
    if (input.boundFixture.pipelineHash !== module03PipelineDescriptor.hash) {
      replayErrors.push(`${fixture.id}:pipeline-hash-mismatch`);
    }
    if (input.boundFixture.promptBundleHash !== promptAssetRegistry.hash) {
      replayErrors.push(`${fixture.id}:prompt-bundle-hash-mismatch`);
    }
    if (input.boundFixture.promptAssetHash !== promptAsset.hash) {
      replayErrors.push(`${fixture.id}:prompt-asset-hash-mismatch`);
    }
    if (input.boundFixture.inputHash !== inputHash) {
      replayErrors.push(`${fixture.id}:input-hash-mismatch`);
    }
    if (input.boundFixture.rawResponsesHash !== rawResponsesHash) {
      replayErrors.push(`${fixture.id}:raw-response-hash-mismatch`);
    }
  }

  const executor = createReplayExecutor({
    rawFixture: input.rawFixture,
    schemaHash,
    expectedRequestHashes: input.boundFixture?.attemptRequestHashes ?? null,
    replayErrors,
  });

  let output = createEmptyOutput();
  let runtimeStatus: "success" | "error" = "success";
  let runtimeErrorCode: string | null = null;
  let shapeOnlyRepairUsed = false;
  let usage = normalizeUsage({
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    wallClockMs: 0,
    budget: fixture.input.budget,
    runtimeErrorCode: null,
  });
  let wallClockMs = 0;

  const startedAt = Date.now();
  try {
    const result = await generateStructuredAnalysisStep({
      organizationId: fixture.input.context.organizationId,
      projectId: fixture.input.context.projectId,
      snapshotId: fixture.input.context.snapshotId,
      runId: `eval-run:${fixture.id}`,
      batchId: `eval-batch:${fixture.id}`,
      idempotencyKey: `eval-idempotency:${fixture.id}`,
      stageKind: fixture.runtime.stageKind,
      providerPolicy: replayPolicy,
      resolvedModel,
      promptAsset,
      schema: analysisFixtureModelOutputSchema,
      schemaDescriptor: {
        name: evalOutputSchemaName,
        version: evalOutputSchemaVersion,
        hash: schemaHash,
      },
      evidenceBlocks: fixture.input.evidenceBlocks,
      budget: {
        maxUsdPerRun: fixture.input.budget.maxUsdPerRun,
        maxInputTokensPerRun: fixture.input.budget.maxInputTokensPerRun,
        maxOutputTokensPerRun: fixture.input.budget.maxOutputTokensPerRun,
        maxWallClockMs: fixture.input.budget.maxWallClockMs,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        costUsdUsed: 0,
      },
      executor,
      seed: 7,
    });

    wallClockMs = Date.now() - startedAt;
    output = normalizeReplayOutput(result.output);
    shapeOnlyRepairUsed = result.shapeOnlyRepairUsed;
    usage = normalizeUsage({
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.costUsd,
      wallClockMs,
      budget: fixture.input.budget,
      runtimeErrorCode: null,
    });

    if (result.provenance.pipelineHash !== module03PipelineDescriptor.hash) {
      replayErrors.push(`${fixture.id}:runtime-pipeline-hash-mismatch`);
    }
    if (result.provenance.promptBundleHash !== promptAssetRegistry.hash) {
      replayErrors.push(`${fixture.id}:runtime-prompt-bundle-hash-mismatch`);
    }
    if (result.provenance.promptHash !== promptAsset.hash) {
      replayErrors.push(`${fixture.id}:runtime-prompt-asset-hash-mismatch`);
    }
    if (result.provenance.schemaHash !== schemaHash) {
      replayErrors.push(`${fixture.id}:runtime-schema-hash-mismatch`);
    }
  } catch (error) {
    wallClockMs = Date.now() - startedAt;
    runtimeStatus = "error";
    if (error instanceof AiCoreError) {
      runtimeErrorCode = error.code;
    } else {
      runtimeErrorCode = "AI_EVAL_REPLAY_UNEXPECTED_ERROR";
    }
    usage = normalizeUsage({
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      wallClockMs,
      budget: fixture.input.budget,
      runtimeErrorCode,
    });
    output = createEmptyOutput();
  }

  if (fixture.runtime.expectedErrorCode !== runtimeErrorCode) {
    replayErrors.push(
      `${fixture.id}:expected-runtime-code-mismatch:${fixture.runtime.expectedErrorCode ?? "null"}:${runtimeErrorCode ?? "null"}`,
    );
  }

  const requestHashes = executor.getRequestHashes();
  if (requestHashes.length !== input.rawFixture.responses.length) {
    replayErrors.push(`${fixture.id}:request-count-mismatch`);
  }

  const scored = scoreOutput(fixture, output);
  const outputHash = runtimeStatus === "success" ? hashCanonicalJson(output) : null;
  const totalTokens = usage.inputTokensUsed + usage.outputTokensUsed;

  const candidate: ReplayBoundCandidate = {
    fixtureId: fixture.id,
    stageKind: fixture.runtime.stageKind,
    promptAssetKind: fixture.runtime.promptAssetKind,
    schemaName: evalOutputSchemaName,
    schemaVersion: evalOutputSchemaVersion,
    schemaHash,
    pipelineHash: module03PipelineDescriptor.hash,
    promptBundleHash: promptAssetRegistry.hash,
    promptAssetHash: promptAsset.hash,
    inputHash,
    rawResponsesHash,
    attemptRequestHashes: [...requestHashes],
    expectedErrorCode: runtimeErrorCode,
    expectedOutputHash: outputHash,
    expectedShapeOnlyRepairUsed: shapeOnlyRepairUsed,
    expectedUsage:
      runtimeStatus === "success"
        ? {
            inputTokens: usage.inputTokensUsed,
            outputTokens: usage.outputTokensUsed,
            totalTokens,
            costUsd: usage.costUsdUsed,
          }
        : null,
  };

  if (input.boundFixture) {
    if (input.boundFixture.expectedErrorCode !== candidate.expectedErrorCode) {
      replayErrors.push(`${fixture.id}:bound-expected-error-mismatch`);
    }
    if (input.boundFixture.expectedOutputHash !== candidate.expectedOutputHash) {
      replayErrors.push(`${fixture.id}:bound-output-hash-mismatch`);
    }
    if (input.boundFixture.expectedShapeOnlyRepairUsed !== candidate.expectedShapeOnlyRepairUsed) {
      replayErrors.push(`${fixture.id}:bound-repair-flag-mismatch`);
    }
    if (
      hashCanonicalJson(input.boundFixture.expectedUsage) !==
      hashCanonicalJson(candidate.expectedUsage)
    ) {
      replayErrors.push(`${fixture.id}:bound-usage-mismatch`);
    }
  } else if (input.mode !== "baseline") {
    replayErrors.push(`${fixture.id}:missing-bound-replay`);
  }

  const fixtureResult: DeterministicReplayFixtureResult = {
    fixtureId: fixture.id,
    fixtureKind: fixture.kind,
    fixture,
    output,
    runtimeStatus,
    runtimeErrorCode,
    schemaValidAfterRepair: runtimeStatus === "success" || runtimeErrorCode !== null,
    shapeOnlyRepairUsed,
    usage,
    promptFindingCodes,
    citationEvaluations: scored.citationEvaluations,
    confidenceEvaluations: scored.confidenceEvaluations,
    replayBindingPassed: replayErrors.length === 0,
    replayBindingErrors: replayErrors,
  };

  return {
    fixtureResult,
    candidate,
    replayErrors,
  };
}

export async function runDeterministicReplay(
  mode: DeterministicReplayMode,
  options: DeterministicReplayRunOptions = {},
): Promise<DeterministicReplayRunResult> {
  const fixtures = [...(options.fixtures ?? loadDefaultFixtureSet())];
  const rawFixturesById = createFixtureMap(options.rawFixtures ?? loadReplayRawFixtures());
  const boundFixturesById =
    mode === "baseline"
      ? new Map<string, ReplayBoundFixture>()
      : createFixtureMap(options.boundFixtures ?? loadReplayBoundFixtures());

  const fixtureResults: DeterministicReplayFixtureResult[] = [];
  const boundCandidates: ReplayBoundCandidate[] = [];
  const replayIntegrityErrors: string[] = [];

  for (const fixture of fixtures) {
    const rawFixture = rawFixturesById.get(fixture.id);
    if (!rawFixture) {
      replayIntegrityErrors.push(`${fixture.id}:missing-replay-raw`);
      fixtureResults.push({
        fixtureId: fixture.id,
        fixtureKind: fixture.kind,
        fixture,
        output: createEmptyOutput(),
        runtimeStatus: "error",
        runtimeErrorCode: "AI_EVAL_REPLAY_MISSING_RAW",
        schemaValidAfterRepair: false,
        shapeOnlyRepairUsed: false,
        usage: {
          inputTokensUsed: 0,
          outputTokensUsed: 0,
          costUsdUsed: 0,
          wallClockMs: 0,
          stoppedBeforeCeiling: false,
        },
        promptFindingCodes: [],
        citationEvaluations: [],
        confidenceEvaluations: [],
        replayBindingPassed: false,
        replayBindingErrors: [`${fixture.id}:missing-replay-raw`],
      });
      continue;
    }

    const boundFixture = boundFixturesById.get(fixture.id) ?? null;
    const replayed = await runFixtureReplay({
      mode,
      fixture,
      rawFixture,
      boundFixture,
    });
    fixtureResults.push(replayed.fixtureResult);
    boundCandidates.push(replayed.candidate);
    replayIntegrityErrors.push(...replayed.replayErrors);
  }

  if (mode !== "baseline") {
    for (const fixtureId of boundFixturesById.keys()) {
      if (!fixtures.some((fixture) => fixture.id === fixtureId)) {
        replayIntegrityErrors.push(`${fixtureId}:orphan-bound-replay`);
      }
    }
  }

  return {
    fixtures,
    fixtureResults,
    boundCandidates,
    replayIntegrityPassed: replayIntegrityErrors.length === 0,
    replayIntegrityErrors,
  };
}
