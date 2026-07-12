import type { Database } from "@atlashq/db";
import { describe, expect, it, vi } from "vitest";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { AuditTransaction } from "../../audit/audit-transaction.js";
import type { AuditWriter } from "../../audit/audit-writer.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import type { RequirementAnalysisQueue } from "../../runtime/requirement-analysis-runtime.js";
import { RequirementAnalysisService } from "./requirement-analysis.service.js";
import type {
  ProviderPolicyRow,
  RequirementAnalysisRepository,
  RequirementAnalysisRunRow,
  SourceDocumentEligibilityRow,
} from "./requirement-analysis.types.js";

const ORG = "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90";
const ADMIN = "67dcb6b0-14b9-444a-9cf0-6eb033af62b0";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const POLICY = "33333333-3333-4333-8333-333333333333";
const RUN = "44444444-4444-4444-8444-444444444444";
const SOURCE = "55555555-5555-4555-8555-555555555555";
const SOURCE_B = "56565656-5656-4656-8656-565656565656";
const EXTRACTION = "66666666-6666-4666-8666-666666666666";
const EXTRACTION_B = "67676767-6767-4676-8676-676767676767";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);

const baseAnalysisConfig = {
  AI_REQUIREMENT_ANALYSIS_ENABLED: true,
  AI_MODEL_CALLS_ENABLED: true,
  AI_ANALYSIS_READS_ENABLED: true,
  AI_REFERENCE_FEATURE_EXTRACTION_ENABLED: false,
  AI_ANALYSIS_MAX_USD_PER_RUN: 3,
  AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN: 300_000,
  AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN: 30_000,
  AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS: 1_800,
  AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT: 1,
  AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION: 3,
  AI_ANALYSIS_DEFAULT_PROVIDER: "openai",
  AI_ANALYSIS_DEFAULT_MODEL_ALIAS: "gpt-4o-mini",
  AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID: "gpt-4o-mini",
  AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE: "provider_default",
  AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY: "explicit_policy_only",
  AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK: true,
} as const;

function session(role: "admin" | "member" = "admin"): RequestSessionContext {
  return {
    user: {
      id: ADMIN,
      email: "admin@example.com",
      name: "Ada Lovelace",
      organizationId: ORG,
      organizationRole: role,
      status: "active",
    },
    session: {
      id: "61e6c6c8-6f1a-4c62-84ca-3e4d2a18c2f8",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    },
  };
}

function auditContext(correlationId = "corr-123"): AuditRequestContext {
  return {
    actor: { organizationId: ORG, actorId: ADMIN },
    correlationId,
  };
}

function providerPolicy(overrides: Partial<ProviderPolicyRow> = {}): ProviderPolicyRow {
  return {
    id: POLICY,
    organizationId: ORG,
    provider: "openai",
    policyName: "Primary policy",
    modelAlias: "gpt-4o-mini",
    resolvedModelId: "gpt-4o-mini",
    dataRetentionMode: "provider_default",
    status: "approved",
    approvedForRequirementAnalysis: true,
    approvedBy: ADMIN,
    approvedAt: new Date("2026-01-01T00:00:00.000Z"),
    approvalNote: "approved",
    providerTermsSnapshotHash: HASH_A,
    maxUsdPerRun: 3,
    maxInputTokensPerRun: 300_000,
    maxOutputTokensPerRun: 30_000,
    maxWallClockSeconds: 1_800,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    version: 1,
    ...overrides,
  };
}

function run(overrides: Partial<RequirementAnalysisRunRow> = {}): RequirementAnalysisRunRow {
  return {
    id: RUN,
    organizationId: ORG,
    projectId: PROJECT,
    requestedBy: ADMIN,
    mode: "fresh",
    status: "requested",
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    cancelReason: null,
    sourceSnapshotId: null,
    replayOfRunId: null,
    reprocessOfRunId: null,
    retryOfRunId: null,
    providerPolicyId: POLICY,
    provider: "openai",
    modelAlias: "gpt-4o-mini",
    resolvedModelId: "gpt-4o-mini",
    providerDataRetentionMode: "provider_default",
    promptBundleVersion: "module-03-prompt-v1",
    promptBundleHash: HASH_A,
    schemaBundleVersion: "module-03-schema-contracts-v1",
    schemaBundleHash: HASH_B,
    pipelineVersion: "module-03-pipeline-v1",
    pipelineHash: HASH_C,
    modelPolicyHash: HASH_D,
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    correlationId: "corr-123",
    ...overrides,
  };
}

function source(
  overrides: Partial<SourceDocumentEligibilityRow> = {},
): SourceDocumentEligibilityRow {
  return {
    id: SOURCE,
    lineageId: SOURCE,
    isLineageHead: true,
    versionNumber: 1,
    sourceType: "document",
    documentFormat: "pdf",
    title: "Requirements",
    contentHash: HASH_E,
    processingStatus: "ready",
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function fakeDb(txHandle: unknown = {}): Database {
  return {
    async transaction(callback: (transaction: AuditTransaction) => Promise<unknown>) {
      return callback(txHandle as AuditTransaction);
    },
  } as unknown as Database;
}

function fakeAudit(record: ReturnType<typeof vi.fn> = vi.fn(async () => undefined)): AuditWriter {
  return { record } as unknown as AuditWriter;
}

function queueDouble(overrides: Partial<RequirementAnalysisQueue> = {}): RequirementAnalysisQueue {
  return {
    async checkAvailability() {
      return { ok: true, detail: "ok" };
    },
    async addFreezeSnapshot() {},
    async addCancelRun() {},
    async close() {},
    ...overrides,
  };
}

describe("RequirementAnalysisService capabilities", () => {
  it("returns safe-disabled reason provider_not_approved when no approved policy exists", async () => {
    const repository = {
      findProjectScope: vi.fn(async () => ({
        id: PROJECT,
        organizationId: ORG,
        status: "active",
        softDeletedAt: null,
      })),
      countApprovedProviderPolicies: vi.fn(async () => 0),
    } as unknown as RequirementAnalysisRepository;

    const service = new RequirementAnalysisService(
      fakeDb(),
      repository,
      queueDouble(),
      { ...baseAnalysisConfig },
      fakeAudit(),
    );

    const capabilities = await service.getCapabilities(session(), PROJECT);
    expect(capabilities.safeDisabled).toBe(true);
    expect(capabilities.safeDisabledReason).toBe("provider_not_approved");
  });
});

describe("RequirementAnalysisService policy lifecycle", () => {
  it("rejects policy creation for non-admin users", async () => {
    const service = new RequirementAnalysisService(
      fakeDb(),
      {} as RequirementAnalysisRepository,
      queueDouble(),
      { ...baseAnalysisConfig },
      fakeAudit(),
    );

    await expect(
      service.createOrganizationProviderPolicy(
        session("member"),
        {
          provider: "openai",
          policyName: "Policy A",
          modelAlias: "gpt-4o-mini",
          resolvedModelId: "gpt-4o-mini",
          dataRetentionMode: "provider_default",
        },
        auditContext(),
      ),
    ).rejects.toMatchObject({
      response: {
        code: "ACCESS_DENIED",
      },
    });
  });

  it("rejects approving non-draft policies", async () => {
    const repository = {
      findProviderPolicyById: vi.fn(async () => providerPolicy({ status: "approved", version: 2 })),
    } as unknown as RequirementAnalysisRepository;

    const service = new RequirementAnalysisService(
      fakeDb(),
      repository,
      queueDouble(),
      { ...baseAnalysisConfig },
      fakeAudit(),
    );

    await expect(
      service.approveOrganizationProviderPolicy(
        session(),
        POLICY,
        { version: 2, approvalNote: "approve" },
        auditContext(),
      ),
    ).rejects.toMatchObject({
      response: {
        code: "AI_PROVIDER_POLICY_MISMATCH",
      },
    });
  });
});

describe("RequirementAnalysisService run orchestration", () => {
  it("creates a fresh run with selected source subset in queue payload and traceability", async () => {
    const insertTraceabilityLink = vi.fn(
      async (
        _handle: unknown,
        values: {
          organizationId: string;
          fromType: string;
          fromId: string;
          toType: string;
          toId: string;
          relation: string;
          createdBy: string;
        },
      ) => ({
        id: "77777777-7777-4777-8777-777777777777",
        organizationId: values.organizationId,
        fromType: values.fromType,
        fromId: values.fromId,
        toType: values.toType,
        toId: values.toId,
        relation: values.relation,
        createdBy: values.createdBy,
        createdAt: new Date(),
      }),
    );
    const repository = {
      findProjectScope: vi.fn(async () => ({
        id: PROJECT,
        organizationId: ORG,
        status: "active",
        softDeletedAt: null,
      })),
      findProviderPolicyById: vi.fn(async () => providerPolicy()),
      acquireOrganizationRunCreationLock: vi.fn(async () => undefined),
      countActiveRunsByProject: vi.fn(async () => 0),
      countActiveRunsByOrganization: vi.fn(async () => 0),
      listSourceDocumentsForEligibility: vi.fn(async () => [
        source(),
        source({
          id: SOURCE_B,
          lineageId: SOURCE_B,
          title: "Secondary source",
          contentHash: HASH_D,
        }),
      ]),
      findLineageHead: vi.fn(async (_handle, _org, _project, lineageId: string) =>
        lineageId === SOURCE_B
          ? source({
              id: SOURCE_B,
              lineageId: SOURCE_B,
              title: "Secondary source",
              contentHash: HASH_D,
            })
          : source(),
      ),
      findLatestSuccessfulExtraction: vi.fn(async (_handle, sourceDocumentId: string) =>
        sourceDocumentId === SOURCE_B
          ? {
              id: EXTRACTION_B,
              sourceDocumentId: SOURCE_B,
              extractionVersion: 1,
              chunkerVersion: "chunker-v1",
            }
          : {
              id: EXTRACTION,
              sourceDocumentId: SOURCE,
              extractionVersion: 1,
              chunkerVersion: "chunker-v1",
            },
      ),
      listOrderedChunks: vi.fn(async () => [
        {
          id: "88888888-8888-4888-8888-888888888888",
          sequence: 0,
          characterCount: 42,
        },
      ]),
      findReferenceArtifactBySource: vi.fn(async () => null),
      findRunByCorrelation: vi.fn(async () => null),
      insertRun: vi.fn(async () => run()),
      insertTraceabilityLink,
    } as unknown as RequirementAnalysisRepository;
    const addFreezeSnapshot = vi.fn(async () => undefined);
    const record = vi.fn(async () => undefined);

    const service = new RequirementAnalysisService(
      fakeDb(),
      repository,
      queueDouble({ addFreezeSnapshot }),
      { ...baseAnalysisConfig },
      fakeAudit(record),
    );

    const result = await service.createFreshRun(
      session(),
      PROJECT,
      { providerPolicyId: POLICY, sourceDocumentIds: [SOURCE_B] },
      auditContext(),
    );

    expect(result.id).toBe(RUN);
    expect(addFreezeSnapshot).toHaveBeenCalledTimes(1);
    expect(addFreezeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDocumentIds: [SOURCE_B] }),
    );
    expect(insertTraceabilityLink).toHaveBeenCalledTimes(2);
    const selectedSourceCalls = insertTraceabilityLink.mock.calls.filter(
      (call) => call[1].relation === "selected_source_document",
    );
    expect(selectedSourceCalls).toHaveLength(1);
    expect(selectedSourceCalls[0]?.[1]).toMatchObject({
      relation: "selected_source_document",
      toId: SOURCE_B,
    });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("marks the run failed when freeze-snapshot queue dispatch fails", async () => {
    const markRunQueueFailure = vi.fn(async () =>
      run({ status: "failed", failureRetryable: true }),
    );
    const repository = {
      findProjectScope: vi.fn(async () => ({
        id: PROJECT,
        organizationId: ORG,
        status: "active",
        softDeletedAt: null,
      })),
      findProviderPolicyById: vi.fn(async () => providerPolicy()),
      acquireOrganizationRunCreationLock: vi.fn(async () => undefined),
      countActiveRunsByProject: vi.fn(async () => 0),
      countActiveRunsByOrganization: vi.fn(async () => 0),
      listSourceDocumentsForEligibility: vi.fn(async () => [source()]),
      findLineageHead: vi.fn(async () => source()),
      findLatestSuccessfulExtraction: vi.fn(async () => ({
        id: EXTRACTION,
        sourceDocumentId: SOURCE,
        extractionVersion: 1,
        chunkerVersion: "chunker-v1",
      })),
      listOrderedChunks: vi.fn(async () => [
        {
          id: "88888888-8888-4888-8888-888888888888",
          sequence: 0,
          characterCount: 42,
        },
      ]),
      findReferenceArtifactBySource: vi.fn(async () => null),
      findRunByCorrelation: vi.fn(async () => null),
      insertRun: vi.fn(async () => run()),
      insertTraceabilityLink: vi.fn(async () => ({
        id: "77777777-7777-4777-8777-777777777777",
        organizationId: ORG,
        fromType: "requirement_analysis_run",
        fromId: RUN,
        toType: "source_document",
        toId: SOURCE,
        relation: "selected_source_document",
        createdBy: ADMIN,
        createdAt: new Date(),
      })),
      markRunQueueFailure,
    } as unknown as RequirementAnalysisRepository;

    const service = new RequirementAnalysisService(
      fakeDb(),
      repository,
      queueDouble({
        addFreezeSnapshot: vi.fn(async () => {
          throw new Error("redis unavailable");
        }),
      }),
      { ...baseAnalysisConfig },
      fakeAudit(),
    );

    await expect(
      service.createFreshRun(session(), PROJECT, { providerPolicyId: POLICY }, auditContext()),
    ).rejects.toMatchObject({
      response: {
        code: "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
      },
    });
    expect(markRunQueueFailure).toHaveBeenCalledTimes(1);
  });

  it("carries snapshot-selected source ids into derived run traceability and freeze-snapshot payload", async () => {
    const insertTraceabilityLink = vi.fn(
      async (
        _handle: unknown,
        values: {
          organizationId: string;
          fromType: string;
          fromId: string;
          toType: string;
          toId: string;
          relation: string;
          createdBy: string;
        },
      ) => ({
        id: "77777777-7777-4777-8777-777777777777",
        organizationId: values.organizationId,
        fromType: values.fromType,
        fromId: values.fromId,
        toType: values.toType,
        toId: values.toId,
        relation: values.relation,
        createdBy: values.createdBy,
        createdAt: new Date(),
      }),
    );
    const repository = {
      findProjectScope: vi.fn(async () => ({
        id: PROJECT,
        organizationId: ORG,
        status: "active",
        softDeletedAt: null,
      })),
      findRunById: vi.fn(async () =>
        run({
          id: RUN,
          status: "failed",
          failureRetryable: true,
          sourceSnapshotId: "99999999-9999-4999-8999-999999999999",
        }),
      ),
      acquireOrganizationRunCreationLock: vi.fn(async () => undefined),
      findRunByCorrelation: vi.fn(async () => null),
      countActiveRunsByProject: vi.fn(async () => 0),
      countActiveRunsByOrganization: vi.fn(async () => 0),
      listSnapshotSourceDocumentIds: vi.fn(async () => [SOURCE_B]),
      findProviderPolicyById: vi.fn(async () => providerPolicy()),
      insertRun: vi.fn(async () =>
        run({
          id: "77777777-7777-4777-8777-777777777777",
          mode: "retry",
          sourceSnapshotId: "99999999-9999-4999-8999-999999999999",
          retryOfRunId: RUN,
          correlationId: "corr-derived",
        }),
      ),
      insertTraceabilityLink,
    } as unknown as RequirementAnalysisRepository;
    const addFreezeSnapshot = vi.fn(async () => undefined);

    const service = new RequirementAnalysisService(
      fakeDb(),
      repository,
      queueDouble({ addFreezeSnapshot }),
      { ...baseAnalysisConfig },
      fakeAudit(),
    );

    const result = await service.retryRun(
      session(),
      PROJECT,
      RUN,
      { reason: "retry" },
      auditContext("corr-derived"),
    );

    expect(result.mode).toBe("retry");
    expect(addFreezeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDocumentIds: [SOURCE_B] }),
    );
    const selectedSourceCalls = insertTraceabilityLink.mock.calls.filter(
      (call) => call[1].relation === "selected_source_document",
    );
    expect(selectedSourceCalls).toHaveLength(1);
    expect(selectedSourceCalls[0]?.[1]).toMatchObject({
      relation: "selected_source_document",
      toId: SOURCE_B,
    });
  });

  it("rejects retry when source run is not a terminal retryable failure", async () => {
    const repository = {
      findProjectScope: vi.fn(async () => ({
        id: PROJECT,
        organizationId: ORG,
        status: "active",
        softDeletedAt: null,
      })),
      acquireOrganizationRunCreationLock: vi.fn(async () => undefined),
      countActiveRunsByProject: vi.fn(async () => 0),
      countActiveRunsByOrganization: vi.fn(async () => 0),
      findRunById: vi.fn(async () =>
        run({
          status: "completed",
          sourceSnapshotId: "99999999-9999-4999-8999-999999999999",
        }),
      ),
    } as unknown as RequirementAnalysisRepository;

    const service = new RequirementAnalysisService(
      fakeDb(),
      repository,
      queueDouble(),
      { ...baseAnalysisConfig },
      fakeAudit(),
    );

    await expect(
      service.retryRun(session(), PROJECT, RUN, { reason: "retry" }, auditContext("corr-retry")),
    ).rejects.toMatchObject({
      response: {
        code: "AI_RUN_NOT_RETRYABLE",
      },
    });
  });

  it("applies cooperative cancellation only for active runs and enqueues cancel-run", async () => {
    const requestedAt = new Date("2026-01-01T01:00:00.000Z");
    const requestRunCancellation = vi.fn(async () =>
      run({
        status: "running",
        cancelRequestedAt: requestedAt,
        cancelRequestedBy: ADMIN,
        cancelReason: "stop",
      }),
    );
    const repository = {
      findRunById: vi.fn(async () => run({ status: "running" })),
      requestRunCancellation,
    } as unknown as RequirementAnalysisRepository;
    const addCancelRun = vi.fn(async () => undefined);

    const service = new RequirementAnalysisService(
      fakeDb(),
      repository,
      queueDouble({ addCancelRun }),
      { ...baseAnalysisConfig },
      fakeAudit(),
    );

    const canceled = await service.cancelRun(
      session(),
      PROJECT,
      RUN,
      { reason: "stop" },
      auditContext("corr-cancel"),
    );
    expect(canceled.cancelRequestedAt).toBe("2026-01-01T01:00:00.000Z");
    expect(addCancelRun).toHaveBeenCalledTimes(1);

    const terminalRepository = {
      findRunById: vi.fn(async () => run({ status: "completed" })),
    } as unknown as RequirementAnalysisRepository;
    const terminalService = new RequirementAnalysisService(
      fakeDb(),
      terminalRepository,
      queueDouble(),
      { ...baseAnalysisConfig },
      fakeAudit(),
    );

    await expect(
      terminalService.cancelRun(session(), PROJECT, RUN, {}, auditContext("corr-cancel-2")),
    ).rejects.toMatchObject({
      response: {
        code: "AI_RUN_NOT_CANCELABLE",
      },
    });
  });
});
