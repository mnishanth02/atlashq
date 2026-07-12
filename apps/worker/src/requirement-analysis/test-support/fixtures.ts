import type { StructuredGenerateExecutor } from "@atlashq/ai";
import { citationNormalizationMode } from "@atlashq/ai";
import type {
  Citation,
  OrganizationAiProviderPolicy,
  Requirement,
  RequirementAnalysisRun,
} from "@atlashq/db";
import type { CitationVerificationJobPayload, RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { createFakeAiProviderRegistry } from "../provider-runtime.js";
import type { AiAnalysisQueue, CitationVerificationQueue } from "../queue-helpers.js";
import type { InsertCitationInput, InsertRequirementInput } from "../repository/types.js";
import type { AnalysisRuntime } from "../runtime.js";
import {
  createInMemoryRequirementAnalysisRepository,
  type InMemoryRequirementAnalysisRepository,
} from "./in-memory-repository.js";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

const FIXED_NOW = new Date("2025-01-01T00:00:00.000Z");

/** Builds a valid, minimal `requirement_analysis_run` row for tests, with every field a stage
 * handler reads populated with a deterministic default; pass `overrides` to vary just what a test
 * cares about (module-03 worker task item 9: fake-DB-driven unit tests, never a live Postgres). */
export function buildTestRun(
  overrides: Partial<RequirementAnalysisRun> = {},
): RequirementAnalysisRun {
  const organizationId = overrides.organizationId ?? nextId("org");
  const projectId = overrides.projectId ?? nextId("project");
  return {
    id: overrides.id ?? nextId("run"),
    organizationId,
    projectId,
    requestedBy: overrides.requestedBy ?? nextId("user"),
    mode: "fresh",
    status: "requested",
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    cancelReason: null,
    sourceSnapshotId: null,
    replayOfRunId: null,
    reprocessOfRunId: null,
    retryOfRunId: null,
    providerPolicyId: overrides.providerPolicyId ?? nextId("policy"),
    provider: "fake",
    modelAlias: "fake-model",
    resolvedModelId: "fake-model-v1",
    providerDataRetentionMode: "provider_default",
    promptBundleVersion: "v1",
    promptBundleHash: "prompt-hash",
    schemaBundleVersion: "v1",
    schemaBundleHash: "schema-hash",
    pipelineVersion: "v1",
    pipelineHash: "pipeline-hash",
    modelPolicyHash: "model-policy-hash",
    maxUsd: 3,
    maxInputTokens: 300_000,
    maxOutputTokens: 30_000,
    maxWallClockSeconds: 1_800,
    inputTokensUsed: 0,
    outputTokensUsed: 0,
    costUsd: 0,
    artifactCounts: {},
    warningCodes: [],
    failureCode: null,
    failureDetail: null,
    failureRetryable: null,
    failedStageId: null,
    startedAt: null,
    completedAt: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    correlationId: overrides.correlationId ?? nextId("correlation"),
    ...overrides,
  };
}

/** Builds a valid, fully-approved `organization_ai_provider_policy` row matching the fake provider
 * registry's canonical `"openai"`/`"anthropic"`/`"openai-compatible"` adapters. */
export function buildTestProviderPolicy(
  overrides: Partial<OrganizationAiProviderPolicy> = {},
): OrganizationAiProviderPolicy {
  return {
    id: overrides.id ?? nextId("policy"),
    organizationId: overrides.organizationId ?? nextId("org"),
    policyName: "default",
    provider: "openai",
    modelAlias: "fake-model",
    resolvedModelId: "fake-model-v1",
    dataRetentionMode: "provider_default",
    status: "approved",
    approvedForRequirementAnalysis: true,
    approvedBy: overrides.approvedBy ?? nextId("user"),
    approvedAt: FIXED_NOW,
    approvalNote: null,
    providerTermsSnapshotHash: null,
    maxUsdPerRun: 3,
    maxInputTokensPerRun: 300_000,
    maxOutputTokensPerRun: 30_000,
    maxWallClockSeconds: 1_800,
    createdAt: FIXED_NOW,
    createdBy: null,
    updatedAt: FIXED_NOW,
    updatedBy: null,
    version: 1,
    ...overrides,
  };
}

/** Records every job a test's fake queue was asked to enqueue, for assertions on DAG fan-out
 * ordering without any real Redis/BullMQ connection. */
export function createRecordingAiAnalysisQueue(): AiAnalysisQueue & {
  jobs: RequirementAnalysisJobPayload[];
} {
  const jobs: RequirementAnalysisJobPayload[] = [];
  return {
    jobs,
    async add(_name, payload) {
      jobs.push(payload as RequirementAnalysisJobPayload);
      return {} as never;
    },
  };
}

export function createRecordingCitationVerificationQueue(): CitationVerificationQueue & {
  jobs: CitationVerificationJobPayload[];
} {
  const jobs: CitationVerificationJobPayload[] = [];
  return {
    jobs,
    async add(_name, payload) {
      jobs.push(payload as CitationVerificationJobPayload);
      return {} as never;
    },
  };
}

/**
 * Builds a scripted {@link StructuredGenerateExecutor} that returns a fixed sequence of
 * outputs/usages/errors, one per call, without ever invoking a real AI SDK or making a network
 * call (module-03 worker task item 1: "Build test/fake provider injection so tests never call
 * external APIs"; task item 6: shape-only repair is exercised by scripting an invalid-then-valid
 * pair of responses). Mirrors `@atlashq/ai`'s own `ai-wrapper.test.ts` fake executor shape.
 */
export function createFakeStructuredExecutor(
  responses: ReadonlyArray<{
    output?: unknown;
    throws?: unknown;
    usage?: { inputTokens: number; outputTokens: number };
  }>,
): StructuredGenerateExecutor & { readonly calls: number } {
  let calls = 0;
  const executor = (async () => {
    const current = responses[calls];
    calls += 1;
    if (!current) {
      throw new Error("createFakeStructuredExecutor: no scripted response left for this call.");
    }
    if (current.throws) {
      throw current.throws;
    }
    return {
      output: current.output,
      usage: current.usage
        ? {
            inputTokens: current.usage.inputTokens,
            outputTokens: current.usage.outputTokens,
            totalTokens: current.usage.inputTokens + current.usage.outputTokens,
            costUsd: null,
          }
        : null,
      rawText: null,
      providerMetadata: null,
    };
  }) as StructuredGenerateExecutor;

  return Object.defineProperty(executor, "calls", {
    get() {
      return calls;
    },
  }) as StructuredGenerateExecutor & { readonly calls: number };
}

/** Builds a full {@link AnalysisRuntime} backed by the in-memory repository, the fake provider
 * registry (never a real AI SDK/network call), and a deterministic clock -- everything a stage
 * handler needs, with zero live infrastructure. Returns the repository separately (still typed as
 * the full in-memory fake, with its extra seed/inspection methods) so tests can seed rows and
 * assert on captured audit/traceability events. */
export function buildTestRuntime(overrides: Partial<Omit<AnalysisRuntime, "repository">> = {}): {
  runtime: AnalysisRuntime;
  repository: InMemoryRequirementAnalysisRepository;
} {
  const repository = createInMemoryRequirementAnalysisRepository();
  const runtime: AnalysisRuntime = {
    repository,
    providerRegistry: createFakeAiProviderRegistry(),
    featureFlags: { referenceFeatureExtractionEnabled: false },
    now: () => FIXED_NOW,
    ...overrides,
  };
  return { runtime, repository };
}

export { FIXED_NOW };

/**
 * Seeds one persisted `requirement` row plus one already-verified `citation` row directly through
 * the repository port (bypassing freeze/extraction), for tests of the derived stages
 * (`conflict_detection`/`coverage_analysis`/`delivery_item_extraction`/`question_generation`/
 * `normalization_deduplication`) that only need an existing requirement+citation to build evidence
 * blocks from -- these stages never read snapshot chunks directly (see `derived-common.ts`).
 */
export async function seedRequirementWithCitation(
  repository: InMemoryRequirementAnalysisRepository,
  input: {
    organizationId: string;
    projectId: string;
    runId: string;
    stableKey?: string;
    title?: string;
    requirementType?: Requirement["requirementType"];
    quote?: string;
    sourceDocumentId?: string;
  },
): Promise<{ requirement: Requirement; citation: Citation }> {
  const requirementInput: InsertRequirementInput = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    analysisRunId: input.runId,
    stableKey: input.stableKey ?? nextId("req-key"),
    title: input.title ?? "System shall authenticate users",
    description: null,
    requirementType: input.requirementType ?? "functional",
    priority: null,
    epistemicStatus: "confirmed",
    confidenceBand: "high",
    confidenceReasonCodes: [],
    inferenceBasis: null,
    origin: "source",
    lifecycleState: "ai_suggested",
    dedupeGroupKey: null,
    parentRequirementId: null,
    sourceSummary: null,
    createdByAiRunId: null,
  };
  const citationInput: Omit<InsertCitationInput, "requirementId"> = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    analysisRunId: input.runId,
    sourceDocumentId: input.sourceDocumentId ?? nextId("source-doc"),
    sourceVersionNumber: 1,
    sourceContentHash: "a".repeat(64),
    sourceExtractionId: nextId("extraction"),
    sourceExtractionVersion: 1,
    sourceChunkId: nextId("chunk"),
    sourceChunkSequence: 0,
    chunkContentHash: "b".repeat(64),
    locator: {},
    quoteTextOriginal: input.quote ?? "The system shall authenticate every user",
    quoteTextNormalized: input.quote ?? "the system shall authenticate every user",
    quoteHash: "c".repeat(64),
    matchStartOffset: 0,
    matchEndOffset: 10,
    normalizationMode: citationNormalizationMode,
    verificationStatus: "verified_exact",
    createdByAiRunId: null,
  };
  const requirement = await repository.insertRequirementWithCitations(requirementInput, [
    citationInput,
  ]);
  const citations = await repository.listCitationsByRequirement(requirement.id);
  const citation = citations[0];
  if (!citation) {
    throw new Error("expected the just-inserted citation to be persisted");
  }
  return { requirement, citation };
}
