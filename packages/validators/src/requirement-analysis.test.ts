import { describe, expect, it } from "vitest";
import {
  analysisArtifactsResponseSchema,
  analysisBatchResponseSchema,
  analysisRunDetailResponseSchema,
  analysisRunFreshRequestSchema,
  analysisRunListFilterSchema,
  analysisRunReplayRequestSchema,
  analysisRunReprocessRequestSchema,
  analysisRunRetryRequestSchema,
  analysisStageResponseSchema,
  citationResponseSchema,
  coverageListResponseSchema,
  deliveryItemResponseSchema,
  eligibleSourcePreviewItemSchema,
  providerPolicyApproveInputSchema,
  providerPolicyCreateInputSchema,
  providerPolicyDeactivateInputSchema,
  providerPolicyListFilterSchema,
  providerPolicyResponseSchema,
  requirementResponseSchema,
} from "./requirement-analysis.js";

const ORG = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const RUN = "44444444-4444-4444-8444-444444444444";
const SNAPSHOT = "55555555-5555-4555-8555-555555555555";
const STAGE = "66666666-6666-4666-8666-666666666666";
const BATCH = "77777777-7777-4777-8777-777777777777";
const REQUIREMENT = "88888888-8888-4888-8888-888888888888";
const DELIVERY_ITEM = "99999999-9999-4999-8999-999999999999";
const COVERAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SOURCE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SOURCE_EXTRACTION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SOURCE_CHUNK = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const POLICY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const AI_RUN = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const HASH = "a".repeat(64);

function runSummary() {
  return {
    id: RUN,
    organizationId: ORG,
    projectId: PROJECT,
    requestedBy: USER,
    mode: "fresh" as const,
    status: "running" as const,
    sourceSnapshotId: SNAPSHOT,
    replayOfRunId: null,
    reprocessOfRunId: null,
    retryOfRunId: null,
    warningCodes: [],
    failureCode: null,
    failureDetail: null,
    failureRetryable: false,
    failedStageId: null,
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    cancelReason: null,
    startedAt: "2026-07-11T04:00:00.000Z",
    completedAt: null,
    createdAt: "2026-07-11T03:59:00.000Z",
    updatedAt: "2026-07-11T04:00:30.000Z",
    correlationId: "corr-1",
    providerPolicy: {
      providerPolicyId: POLICY,
      provider: "openai" as const,
      modelAlias: "gpt-4o-mini",
      resolvedModelId: "gpt-4o-mini",
      dataRetentionMode: "provider_default" as const,
    },
    provenance: {
      promptBundleVersion: "prompt-v1",
      promptBundleHash: HASH,
      schemaBundleVersion: "schema-v1",
      schemaBundleHash: HASH,
      pipelineVersion: "pipeline-v1",
      pipelineHash: HASH,
      modelPolicyHash: HASH,
    },
    budgets: {
      maxUsd: 3,
      maxInputTokens: 300000,
      maxOutputTokens: 30000,
      maxWallClockSeconds: 1800,
    },
    usage: {
      inputTokensUsed: 1200,
      outputTokensUsed: 240,
      costUsd: 0.12,
    },
    artifactCounts: {
      requirements: 1,
      citations: 1,
      coverageEntries: 18,
      deliveryItems: 1,
    },
  };
}

describe("provider policy schemas", () => {
  it("validates create/approve/deactivate inputs and list filters", () => {
    expect(
      providerPolicyCreateInputSchema.parse({
        provider: "openai",
        policyName: "Default policy",
        modelAlias: "gpt-4o-mini",
        resolvedModelId: "gpt-4o-mini",
        dataRetentionMode: "provider_default",
      }),
    ).toMatchObject({ provider: "openai", dataRetentionMode: "provider_default" });

    expect(providerPolicyApproveInputSchema.parse({ approvalNote: "Legal approved." })).toEqual({
      approvalNote: "Legal approved.",
    });
    expect(providerPolicyDeactivateInputSchema.parse({ reason: "Provider paused." })).toEqual({
      reason: "Provider paused.",
    });
    expect(providerPolicyListFilterSchema.parse({ status: "approved" })).toMatchObject({
      status: "approved",
      includeInactive: false,
      limit: 25,
    });
  });

  it("validates provider policy responses", () => {
    expect(
      providerPolicyResponseSchema.parse({
        id: POLICY,
        organizationId: ORG,
        version: 2,
        provider: "openai",
        policyName: "Default policy",
        modelAlias: "gpt-4o-mini",
        resolvedModelId: "gpt-4o-mini",
        dataRetentionMode: "provider_default",
        status: "approved",
        approvedForRequirementAnalysis: true,
        approvedBy: USER,
        approvedAt: "2026-07-11T03:00:00.000Z",
        approvalNote: "Approved by security.",
        providerTermsSnapshotHash: HASH,
        maxUsdPerRun: 3,
        maxInputTokensPerRun: 300000,
        maxOutputTokensPerRun: 30000,
        maxWallClockSeconds: 1800,
        createdAt: "2026-07-11T02:00:00.000Z",
        updatedAt: "2026-07-11T03:00:00.000Z",
      }),
    ).toMatchObject({
      version: 2,
      status: "approved",
      approvedForRequirementAnalysis: true,
    });
  });
});

describe("eligible source preview schema", () => {
  it("requires exclusion reasons for excluded sources and forbids them for included sources", () => {
    const included = eligibleSourcePreviewItemSchema.safeParse({
      sourceDocumentId: SOURCE,
      sourceLineageId: SOURCE,
      sourceVersionNumber: 1,
      sourceType: "document",
      documentFormat: "pdf",
      title: "SRS",
      contentHash: HASH,
      sourceExtractionId: SOURCE_EXTRACTION,
      sourceExtractionVersion: 2,
      chunkerVersion: "chunker-v1",
      chunkCount: 20,
      totalCharacterCount: 4000,
      referenceIpReviewStatus: null,
      included: true,
      exclusionReason: null,
    });
    expect(included.success).toBe(true);

    const excluded = eligibleSourcePreviewItemSchema.safeParse({
      sourceDocumentId: SOURCE,
      sourceLineageId: SOURCE,
      sourceVersionNumber: 1,
      sourceType: "reference",
      documentFormat: null,
      title: "Reference site",
      contentHash: HASH,
      sourceExtractionId: null,
      sourceExtractionVersion: null,
      chunkerVersion: null,
      chunkCount: 0,
      totalCharacterCount: 0,
      referenceIpReviewStatus: "cleared",
      included: false,
      exclusionReason: "reference_feature_extraction_disabled",
    });
    expect(excluded.success).toBe(true);
  });
});

describe("run request and response schemas", () => {
  it("validates fresh/retry/replay/reprocess requests", () => {
    expect(
      analysisRunFreshRequestSchema.parse({
        providerPolicyId: POLICY,
        sourceDocumentIds: [SOURCE],
      }),
    ).toMatchObject({ providerPolicyId: POLICY });
    expect(analysisRunRetryRequestSchema.parse({ reason: "Transient timeout." })).toEqual({
      reason: "Transient timeout.",
    });
    expect(analysisRunReplayRequestSchema.parse({})).toEqual({});
    expect(
      analysisRunReprocessRequestSchema.parse({
        providerPolicyId: POLICY,
        promptBundleVersion: "prompt-v2",
        schemaBundleVersion: "schema-v2",
        pipelineVersion: "pipeline-v2",
      }),
    ).toMatchObject({ providerPolicyId: POLICY });
  });

  it("validates run list filters and detail responses", () => {
    expect(analysisRunListFilterSchema.parse({ status: "running" })).toMatchObject({
      status: "running",
      limit: 25,
    });

    expect(
      analysisRunDetailResponseSchema.parse({
        ...runSummary(),
        snapshot: {
          id: SNAPSHOT,
          snapshotHash: HASH,
          sourceCount: 4,
          chunkCount: 120,
          totalCharacterCount: 80000,
          eligibilityRulesVersion: "eligibility-v1",
          createdAt: "2026-07-11T04:00:00.000Z",
        },
        readNotices: [],
      }),
    ).toMatchObject({ id: RUN, mode: "fresh" });
  });
});

describe("stage and batch response schemas", () => {
  it("validates stage and batch payloads", () => {
    expect(
      analysisStageResponseSchema.parse({
        id: STAGE,
        runId: RUN,
        organizationId: ORG,
        projectId: PROJECT,
        kind: "coverage_analysis",
        status: "running",
        attemptNumber: 1,
        idempotencyKey: "ai-analysis:run-stage:run-1:stage-1",
        inputHash: HASH,
        outputHash: null,
        startedAt: "2026-07-11T04:00:10.000Z",
        completedAt: null,
        retryAfter: null,
        failureCode: null,
        failureDetail: null,
        createdAt: "2026-07-11T04:00:00.000Z",
        updatedAt: "2026-07-11T04:00:10.000Z",
      }),
    ).toMatchObject({ kind: "coverage_analysis" });

    expect(
      analysisBatchResponseSchema.parse({
        id: BATCH,
        stageId: STAGE,
        runId: RUN,
        organizationId: ORG,
        projectId: PROJECT,
        batchOrder: 0,
        sourceChunkStartSequence: 0,
        sourceChunkEndSequence: 12,
        inputTokenEstimate: 2048,
        maxOutputTokens: 512,
        status: "running",
        attemptNumber: 1,
        aiRunId: AI_RUN,
        repairOfBatchId: null,
        shapeOnlyRepairUsed: false,
        cacheKey: null,
        cacheHitOfBatchId: null,
        failureCode: null,
        failureDetail: null,
        createdAt: "2026-07-11T04:00:00.000Z",
        updatedAt: "2026-07-11T04:00:10.000Z",
      }),
    ).toMatchObject({ status: "running" });
  });
});

describe("artifact response schemas", () => {
  it("enforces requirement confidence/epistemic invariants", () => {
    expect(
      requirementResponseSchema.parse({
        id: REQUIREMENT,
        organizationId: ORG,
        projectId: PROJECT,
        analysisRunId: RUN,
        stableKey: "req-auth-1",
        title: "Implement SSO",
        description: "System must support SSO login.",
        requirementType: "functional",
        priority: "must_have",
        epistemicStatus: "confirmed",
        confidenceBand: "high",
        confidenceReasonCodes: ["verified_exact_citation", "multiple_source_corroboration"],
        inferenceBasis: null,
        origin: "source",
        lifecycleState: "ai_suggested",
        dedupeGroupKey: null,
        parentRequirementId: null,
        sourceSummary: "SRS section 4.1",
        createdByAiRunId: AI_RUN,
        createdAt: "2026-07-11T04:00:00.000Z",
        updatedAt: "2026-07-11T04:00:00.000Z",
      }),
    ).toMatchObject({ epistemicStatus: "confirmed" });

    expect(
      requirementResponseSchema.safeParse({
        id: REQUIREMENT,
        organizationId: ORG,
        projectId: PROJECT,
        analysisRunId: RUN,
        stableKey: "req-auth-1",
        title: "Needs clarification",
        description: "Unknown requirement.",
        requirementType: "functional",
        priority: null,
        epistemicStatus: "unknown",
        confidenceBand: "low",
        confidenceReasonCodes: ["verified_exact_citation"],
        inferenceBasis: null,
        origin: "source",
        lifecycleState: "ai_suggested",
        dedupeGroupKey: null,
        parentRequirementId: null,
        sourceSummary: null,
        createdByAiRunId: AI_RUN,
        createdAt: "2026-07-11T04:00:00.000Z",
        updatedAt: "2026-07-11T04:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("enforces citation targeting and delivery-item discriminated attributes", () => {
    const citation = citationResponseSchema.safeParse({
      id: "12121212-1212-4121-8121-121212121212",
      organizationId: ORG,
      projectId: PROJECT,
      analysisRunId: RUN,
      requirementId: REQUIREMENT,
      coverageMatrixEntryId: null,
      deliveryItemId: null,
      sourceDocumentId: SOURCE,
      sourceVersionNumber: 3,
      sourceContentHash: HASH,
      sourceExtractionId: SOURCE_EXTRACTION,
      sourceExtractionVersion: 2,
      sourceChunkId: SOURCE_CHUNK,
      sourceChunkSequence: 42,
      chunkContentHash: HASH,
      locator: { page: 2, line: 10 },
      quoteTextOriginal: "Users can sign in via SSO.",
      quoteTextNormalized: "Users can sign in via SSO.",
      quoteHash: HASH,
      matchStartOffset: 10,
      matchEndOffset: 35,
      normalizationMode: "nfc_ws",
      verificationStatus: "verified_exact",
      createdByAiRunId: AI_RUN,
      createdAt: "2026-07-11T04:00:00.000Z",
    });
    expect(citation.success).toBe(true);

    const deliveryItem = deliveryItemResponseSchema.safeParse({
      id: DELIVERY_ITEM,
      organizationId: ORG,
      projectId: PROJECT,
      analysisRunId: RUN,
      itemType: "scope_change_candidate",
      title: "Potential scope creep",
      description: "New mobile app request appears out of baseline scope.",
      epistemicStatus: "assumed",
      confidenceBand: "medium",
      confidenceReasonCodes: ["inference_basis_present"],
      severity: "medium",
      priority: "high",
      status: "open",
      visibility: "internal",
      sourceRequirementId: REQUIREMENT,
      createdByAiRunId: AI_RUN,
      createdAt: "2026-07-11T04:00:00.000Z",
      updatedAt: "2026-07-11T04:00:00.000Z",
      attributes: {
        classification: "scope_creep",
        changeSource: "Stakeholder workshop",
        baselineImpactHypothesis: "Adds 3 sprints",
        approvalNeeded: true,
      },
    });
    expect(deliveryItem.success).toBe(true);
  });

  it("validates coverage and combined artifact responses", () => {
    const coverage = coverageListResponseSchema.parse({
      items: [
        {
          id: COVERAGE,
          organizationId: ORG,
          projectId: PROJECT,
          analysisRunId: RUN,
          categoryKey: "security_compliance",
          categoryLabel: "Security/compliance",
          categoryOrder: 11,
          status: "partial",
          rationale: "Encryption at rest is specified, in transit is not explicit.",
          evidenceState: "verified_citation",
          questionDeliveryItemId: DELIVERY_ITEM,
          createdByAiRunId: AI_RUN,
          createdAt: "2026-07-11T04:00:00.000Z",
        },
      ],
    });
    expect(coverage.items).toHaveLength(1);

    expect(
      analysisArtifactsResponseSchema.parse({
        requirements: [],
        deliveryItems: [],
        coverage: coverage.items,
        citations: [],
      }),
    ).toMatchObject({ coverage: coverage.items });
  });
});
