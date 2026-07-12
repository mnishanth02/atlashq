import { randomUUID } from "node:crypto";
import {
  referenceArtifact,
  requirement,
  requirementAnalysisRun,
  requirementAnalysisSnapshot,
  sourceChunk,
  sourceDocument,
  sourceExtraction,
} from "@atlashq/db";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addMembership,
  approveAiProviderPolicy,
  cancelRequirementAnalysisRun,
  createAiProviderPolicy,
  createProject,
  createRequirementAnalysisRun,
  deactivateAiProviderPolicy,
  findAuditEvents,
  getRequirementAnalysisCapabilities,
  getRequirementAnalysisRequirement,
  getRequirementAnalysisRun,
  listAiProviderPolicies,
  listRequirementAnalysisTraceability,
  previewRequirementAnalysisEligibleSources,
  replayRequirementAnalysisRun,
  reprocessRequirementAnalysisRun,
  retryRequirementAnalysisRun,
} from "./api.js";
import {
  createAgent,
  createOrganization,
  provisionAdmin,
  signUp,
  type TestAgent,
} from "./fixtures.js";
import {
  InMemoryAnalysisQueueDouble,
  TEST_AI_REQUIREMENT_ANALYSIS_ENV,
} from "./requirement-analysis-doubles.js";
import { useHarness } from "./suite.js";

const queue = new InMemoryAnalysisQueueDouble();
const getHarness = useHarness({
  analysisQueue: queue,
  aiRequirementAnalysis: TEST_AI_REQUIREMENT_ANALYSIS_ENV,
});

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);

type ProvisionedProject = {
  organizationId: string;
  adminAgent: TestAgent;
  adminId: string;
  projectId: string;
};

function hashFromSeed(seed: string): string {
  return seed.replaceAll("-", "").padEnd(64, "a").slice(0, 64);
}

async function provisionProject(): Promise<ProvisionedProject> {
  const harness = getHarness();
  const org = await createOrganization(harness.db);
  const adminAgent = createAgent(harness);
  const { user: admin } = await provisionAdmin(harness, adminAgent, org.id);
  const createdProject = await createProject(adminAgent, {
    name: `Requirement Analysis ${randomUUID()}`,
    type: "internal",
    ownerId: admin.id,
    status: "active",
  });
  expect(createdProject.status).toBe(201);
  return {
    organizationId: org.id,
    adminAgent,
    adminId: admin.id,
    projectId: createdProject.body.id as string,
  };
}

async function createApprovedPolicy(agent: TestAgent) {
  const created = await createAiProviderPolicy(
    agent,
    {
      provider: "openai",
      policyName: `Primary ${randomUUID()}`,
      modelAlias: "gpt-4o-mini",
      resolvedModelId: "gpt-4o-mini",
      dataRetentionMode: "provider_default",
      maxUsdPerRun: 2.5,
      maxInputTokensPerRun: 150000,
      maxOutputTokensPerRun: 20000,
      maxWallClockSeconds: 1200,
    },
    `policy-create-${randomUUID()}`,
  );
  expect(created.status).toBe(201);

  const approved = await approveAiProviderPolicy(
    agent,
    created.body.id as string,
    {
      version: 1,
      approvalNote: "Approved for module-03 integration tests.",
      providerTermsSnapshotHash: HASH_A,
    },
    `policy-approve-${randomUUID()}`,
  );
  expect(approved.status).toBe(200);
  return approved.body;
}

async function insertSource(
  setup: ProvisionedProject,
  input: {
    title: string;
    sourceType?: "document" | "manual" | "reference";
    processingStatus?: string;
    archived?: boolean;
    lineageId?: string;
    versionNumber?: number;
    supersedesId?: string | null;
    withExtraction?: boolean;
    referenceIpReviewStatus?: "not_reviewed" | "cleared" | "restricted";
  },
) {
  const harness = getHarness();
  const sourceType = input.sourceType ?? "document";
  const sourceId = randomUUID();
  const versionNumber = input.versionNumber ?? 1;
  const isRootVersion = versionNumber === 1 && (input.supersedesId ?? null) === null;
  const lineageId = isRootVersion ? sourceId : (input.lineageId ?? sourceId);

  const inserted = await harness.db
    .insert(sourceDocument)
    .values({
      id: sourceId,
      organizationId: setup.organizationId,
      projectId: setup.projectId,
      lineageId,
      versionNumber,
      supersedesId: input.supersedesId ?? null,
      sourceType,
      documentFormat: sourceType === "document" ? "pdf" : null,
      title: input.title,
      contentHash: hashFromSeed(randomUUID()),
      processingStatus: input.processingStatus ?? "ready",
      createdBy: setup.adminId,
      updatedBy: setup.adminId,
      archivedAt: input.archived ? new Date("2026-01-02T00:00:00.000Z") : null,
      archivedBy: input.archived ? setup.adminId : null,
    })
    .returning({
      id: sourceDocument.id,
      lineageId: sourceDocument.lineageId,
      contentHash: sourceDocument.contentHash,
      versionNumber: sourceDocument.versionNumber,
    });
  const sourceRow = inserted[0];
  if (!sourceRow) {
    throw new Error("Failed to seed source document.");
  }

  let extractionId: string | null = null;
  if (input.withExtraction ?? true) {
    const extracted = await harness.db
      .insert(sourceExtraction)
      .values({
        sourceDocumentId: sourceRow.id,
        extractionVersion: 1,
        status: "succeeded",
        chunkerVersion: "chunker-v1",
        extractedTextHash: HASH_B,
      })
      .returning({ id: sourceExtraction.id });
    extractionId = extracted[0]?.id ?? null;
    if (!extractionId) {
      throw new Error("Failed to seed source extraction.");
    }

    await harness.db.insert(sourceChunk).values([
      {
        organizationId: setup.organizationId,
        projectId: setup.projectId,
        sourceDocumentId: sourceRow.id,
        sourceExtractionId: extractionId,
        sequence: 0,
        content: `${input.title} chunk 1`,
        characterCount: 24,
        contentHash: HASH_C,
      },
      {
        organizationId: setup.organizationId,
        projectId: setup.projectId,
        sourceDocumentId: sourceRow.id,
        sourceExtractionId: extractionId,
        sequence: 1,
        content: `${input.title} chunk 2`,
        characterCount: 24,
        contentHash: HASH_D,
      },
    ]);
  }

  if (sourceType === "reference") {
    await harness.db.insert(referenceArtifact).values({
      sourceDocumentId: sourceRow.id,
      organizationId: setup.organizationId,
      projectId: setup.projectId,
      referenceKind: "url",
      captureMethod: "manual_paste",
      accessType: "public",
      intendedUse: "inspiration",
      sourceUrl: "https://example.test/reference",
      ipReviewStatus: input.referenceIpReviewStatus ?? "not_reviewed",
      attestationText: "I confirm I have rights to provide this reference for inspiration only.",
      attestationVersion: "v1",
      attestedBy: setup.adminId,
      attestedAt: new Date("2026-01-01T00:00:00.000Z"),
      ipReviewedBy:
        input.referenceIpReviewStatus && input.referenceIpReviewStatus !== "not_reviewed"
          ? setup.adminId
          : null,
      ipReviewedAt:
        input.referenceIpReviewStatus && input.referenceIpReviewStatus !== "not_reviewed"
          ? new Date("2026-01-01T00:00:00.000Z")
          : null,
    });
  }

  return { sourceId: sourceRow.id, lineageId: sourceRow.lineageId, extractionId };
}

async function insertCompletedRun(setup: ProvisionedProject, providerPolicyId: string) {
  const harness = getHarness();
  const inserted = await harness.db
    .insert(requirementAnalysisRun)
    .values({
      organizationId: setup.organizationId,
      projectId: setup.projectId,
      requestedBy: setup.adminId,
      mode: "fresh",
      status: "completed",
      providerPolicyId,
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
      correlationId: `run-${randomUUID()}`,
      completedAt: new Date("2026-01-02T00:00:00.000Z"),
    })
    .returning({ id: requirementAnalysisRun.id });
  const row = inserted[0];
  if (!row) {
    throw new Error("Failed to insert requirement-analysis run.");
  }
  return row.id;
}

beforeEach(() => {
  queue.reset();
});

describe("integration: requirement-analysis API", () => {
  it("enforces requirements:read/requirements:analyze RBAC and excludes Client Viewer", async () => {
    const harness = getHarness();
    const setup = await provisionProject();
    const policy = await createApprovedPolicy(setup.adminAgent);
    await insertSource(setup, { title: "Eligible document" });

    const developerAgent = createAgent(harness);
    const developer = await signUp(harness, developerAgent, {
      organizationId: setup.organizationId,
    });
    const developerMembership = await addMembership(setup.adminAgent, setup.projectId, {
      userId: developer.user.id,
      role: "Developer",
    });
    expect(developerMembership.status).toBe(201);

    const baAgent = createAgent(harness);
    const ba = await signUp(harness, baAgent, { organizationId: setup.organizationId });
    const baMembership = await addMembership(setup.adminAgent, setup.projectId, {
      userId: ba.user.id,
      role: "Business Analyst / Coordinator",
    });
    expect(baMembership.status).toBe(201);

    const clientViewerAgent = createAgent(harness);
    const clientViewer = await signUp(harness, clientViewerAgent, {
      organizationId: setup.organizationId,
    });
    const clientViewerMembership = await addMembership(setup.adminAgent, setup.projectId, {
      userId: clientViewer.user.id,
      role: "Client Viewer / Approver",
    });
    expect(clientViewerMembership.status).toBe(201);

    const developerPreview = await previewRequirementAnalysisEligibleSources(
      developerAgent,
      setup.projectId,
    );
    expect(developerPreview.status).toBe(200);

    const developerCreate = await createRequirementAnalysisRun(
      developerAgent,
      setup.projectId,
      { providerPolicyId: policy.id },
      `dev-run-${randomUUID()}`,
    );
    expect(developerCreate.status).toBe(403);

    const baCreate = await createRequirementAnalysisRun(
      baAgent,
      setup.projectId,
      { providerPolicyId: policy.id },
      `ba-run-${randomUUID()}`,
    );
    expect(baCreate.status).toBe(201);

    const clientViewerPreview = await previewRequirementAnalysisEligibleSources(
      clientViewerAgent,
      setup.projectId,
    );
    expect(clientViewerPreview.status).toBe(403);
  });

  it("enforces admin-only provider-policy lifecycle with optimistic version checks and audit records", async () => {
    const harness = getHarness();
    const setup = await provisionProject();
    const memberAgent = createAgent(harness);
    await signUp(harness, memberAgent, { organizationId: setup.organizationId });

    const memberList = await listAiProviderPolicies(memberAgent);
    expect(memberList.status).toBe(403);

    const memberCreate = await createAiProviderPolicy(memberAgent, {
      provider: "openai",
      policyName: "Blocked",
      modelAlias: "gpt-4o-mini",
      resolvedModelId: "gpt-4o-mini",
      dataRetentionMode: "provider_default",
    });
    expect(memberCreate.status).toBe(403);

    const created = await createAiProviderPolicy(
      setup.adminAgent,
      {
        provider: "openai",
        policyName: `Policy ${randomUUID()}`,
        modelAlias: "gpt-4o-mini",
        resolvedModelId: "gpt-4o-mini",
        dataRetentionMode: "provider_default",
      },
      `create-${randomUUID()}`,
    );
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("draft");

    const staleApprove = await approveAiProviderPolicy(
      setup.adminAgent,
      created.body.id,
      { version: 9, approvalNote: "stale" },
      `approve-stale-${randomUUID()}`,
    );
    expect(staleApprove.status).toBe(409);

    const approved = await approveAiProviderPolicy(
      setup.adminAgent,
      created.body.id,
      { version: 1, approvalNote: "approved" },
      `approve-${randomUUID()}`,
    );
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("approved");

    const staleDeactivate = await deactivateAiProviderPolicy(
      setup.adminAgent,
      created.body.id,
      { version: 1, reason: "stale" },
      `deactivate-stale-${randomUUID()}`,
    );
    expect(staleDeactivate.status).toBe(409);

    const deactivated = await deactivateAiProviderPolicy(
      setup.adminAgent,
      created.body.id,
      { version: 2, reason: "retire" },
      `deactivate-${randomUUID()}`,
    );
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.status).toBe("inactive");

    const audits = await findAuditEvents(harness.db, {
      entityType: "organization_ai_provider_policy",
      entityId: created.body.id,
    });
    const actions = audits.map((row) => row.action).sort();
    expect(actions).toEqual([
      "ai.provider_policy.approve",
      "ai.provider_policy.create",
      "ai.provider_policy.deactivate",
    ]);
  });

  it("reports safe-disabled capabilities for missing approved policy and queue unavailability", async () => {
    const setup = await provisionProject();
    queue.available = false;
    queue.availabilityDetail = "queue unavailable";

    const withoutPolicy = await getRequirementAnalysisCapabilities(
      setup.adminAgent,
      setup.projectId,
    );
    expect(withoutPolicy.status).toBe(200);
    expect(withoutPolicy.body.safeDisabled).toBe(true);
    expect(withoutPolicy.body.safeDisabledReason).toBe("provider_not_approved");

    await createApprovedPolicy(setup.adminAgent);
    const queueDown = await getRequirementAnalysisCapabilities(setup.adminAgent, setup.projectId);
    expect(queueDown.status).toBe(200);
    expect(queueDown.body.safeDisabled).toBe(true);
    expect(queueDown.body.safeDisabledReason).toBe("queue_unavailable");
  });

  it("returns eligible-source preview with module-2 exclusion reasons and reference flag gating", async () => {
    const setup = await provisionProject();
    await createApprovedPolicy(setup.adminAgent);

    const included = await insertSource(setup, { title: "Included ready source" });
    const notReady = await insertSource(setup, {
      title: "Not ready source",
      processingStatus: "verification_pending",
      withExtraction: false,
    });
    const archived = await insertSource(setup, { title: "Archived source", archived: true });

    const v1 = await insertSource(setup, {
      title: "Lineage old",
      versionNumber: 1,
    });
    await insertSource(setup, {
      title: "Lineage head",
      lineageId: v1.lineageId,
      versionNumber: 2,
      supersedesId: v1.sourceId,
    });
    const reference = await insertSource(setup, {
      title: "Reference cleared",
      sourceType: "reference",
      referenceIpReviewStatus: "cleared",
    });

    const preview = await previewRequirementAnalysisEligibleSources(
      setup.adminAgent,
      setup.projectId,
    );
    expect(preview.status).toBe(200);
    const byId = new Map(
      (
        preview.body.sources as Array<{
          sourceDocumentId: string;
          included: boolean;
          exclusionReason: string | null;
        }>
      ).map((item) => [item.sourceDocumentId, item]),
    );

    expect(byId.get(included.sourceId)).toMatchObject({ included: true, exclusionReason: null });
    expect(byId.get(notReady.sourceId)).toMatchObject({
      included: false,
      exclusionReason: "not_ready",
    });
    expect(byId.get(archived.sourceId)).toMatchObject({
      included: false,
      exclusionReason: "archived",
    });
    expect(byId.get(v1.sourceId)).toMatchObject({
      included: false,
      exclusionReason: "non_head_version",
    });
    expect(byId.get(reference.sourceId)).toMatchObject({
      included: false,
      exclusionReason: "reference_feature_extraction_disabled",
    });
  });

  it("creates fresh runs idempotently, enforces concurrency, and allows archived freeze checks", async () => {
    const setup = await provisionProject();
    const policy = await createApprovedPolicy(setup.adminAgent);
    const selected = await insertSource(setup, { title: "Selected source" });
    await insertSource(setup, { title: "Non-selected source" });

    const correlation = `fresh-${randomUUID()}`;
    const first = await createRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      { providerPolicyId: policy.id, sourceDocumentIds: [selected.sourceId] },
      correlation,
    );
    expect(first.status).toBe(201);
    expect(queue.jobs.filter((job) => job.kind === "freeze-snapshot")).toHaveLength(1);
    const freezeJob = queue.jobs.find((job) => job.kind === "freeze-snapshot");
    expect(freezeJob?.payload.sourceDocumentIds).toEqual([selected.sourceId]);
    const traceability = await listRequirementAnalysisTraceability(
      setup.adminAgent,
      setup.projectId,
      first.body.id as string,
      "?relation=selected_source_document&limit=50",
    );
    expect(traceability.status).toBe(200);
    expect(traceability.body.items).toHaveLength(1);
    expect(traceability.body.items[0]).toMatchObject({
      relation: "selected_source_document",
      toType: "source_document",
      toId: selected.sourceId,
    });

    const second = await createRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      { providerPolicyId: policy.id, sourceDocumentIds: [selected.sourceId] },
      correlation,
    );
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(queue.jobs.filter((job) => job.kind === "freeze-snapshot")).toHaveLength(1);

    const concurrent = await createRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      { providerPolicyId: policy.id },
      `fresh-${randomUUID()}`,
    );
    expect(concurrent.status).toBe(409);
    expect(concurrent.body.code).toBe("AI_RUN_CONCURRENCY_EXCEEDED");
  });

  it("prevents concurrent cross-project run creation from exceeding the org active-run cap", async () => {
    const harness = getHarness();
    const setup = await provisionProject();
    const policy = await createApprovedPolicy(setup.adminAgent);

    const projectB = await createProject(setup.adminAgent, {
      name: `Org cap B ${randomUUID()}`,
      type: "internal",
      ownerId: setup.adminId,
      status: "active",
    });
    expect(projectB.status).toBe(201);
    const projectC = await createProject(setup.adminAgent, {
      name: `Org cap C ${randomUUID()}`,
      type: "internal",
      ownerId: setup.adminId,
      status: "active",
    });
    expect(projectC.status).toBe(201);
    const projectD = await createProject(setup.adminAgent, {
      name: `Org cap D ${randomUUID()}`,
      type: "internal",
      ownerId: setup.adminId,
      status: "active",
    });
    expect(projectD.status).toBe(201);

    await insertSource(setup, { title: "Org cap baseline A" });
    await insertSource(
      { ...setup, projectId: projectB.body.id as string },
      { title: "Org cap baseline B" },
    );
    await insertSource(
      { ...setup, projectId: projectC.body.id as string },
      { title: "Org cap contender C" },
    );
    await insertSource(
      { ...setup, projectId: projectD.body.id as string },
      { title: "Org cap contender D" },
    );

    const baselineA = await createRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      { providerPolicyId: policy.id },
      `org-cap-a-${randomUUID()}`,
    );
    expect(baselineA.status).toBe(201);
    const baselineB = await createRequirementAnalysisRun(
      setup.adminAgent,
      projectB.body.id as string,
      { providerPolicyId: policy.id },
      `org-cap-b-${randomUUID()}`,
    );
    expect(baselineB.status).toBe(201);

    const [contenderC, contenderD] = await Promise.all([
      createRequirementAnalysisRun(
        setup.adminAgent,
        projectC.body.id as string,
        { providerPolicyId: policy.id },
        `org-cap-c-${randomUUID()}`,
      ),
      createRequirementAnalysisRun(
        setup.adminAgent,
        projectD.body.id as string,
        { providerPolicyId: policy.id },
        `org-cap-d-${randomUUID()}`,
      ),
    ]);
    const statuses = [contenderC.status, contenderD.status].sort((left, right) => left - right);
    expect(statuses).toEqual([201, 409]);
    const rejected = contenderC.status === 409 ? contenderC : contenderD;
    expect(rejected.body.code).toBe("AI_RUN_CONCURRENCY_EXCEEDED");
    expect(queue.jobs.filter((job) => job.kind === "freeze-snapshot")).toHaveLength(3);

    const activeCountRows = await harness.db
      .select({ count: sql<number>`count(*)::int` })
      .from(requirementAnalysisRun)
      .where(
        and(
          eq(requirementAnalysisRun.organizationId, setup.organizationId),
          sql`${requirementAnalysisRun.status} in ('requested', 'snapshotting', 'queued', 'running', 'waiting_retry')`,
        ),
      );
    expect(activeCountRows[0]?.count).toBe(3);
  });

  it("supports retry/replay/reprocess lineage, cooperative cancel, and retry-rule enforcement", async () => {
    const harness = getHarness();
    const setup = await provisionProject();
    const policy = await createApprovedPolicy(setup.adminAgent);
    await insertSource(setup, { title: "Ready source for lineage" });

    const fresh = await createRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      { providerPolicyId: policy.id },
      `fresh-lineage-${randomUUID()}`,
    );
    expect(fresh.status).toBe(201);
    const sourceRunId = fresh.body.id as string;

    const snapshotInserted = await harness.db
      .insert(requirementAnalysisSnapshot)
      .values({
        organizationId: setup.organizationId,
        projectId: setup.projectId,
        runId: sourceRunId,
        snapshotHash: HASH_E,
        sourceCount: 1,
        chunkCount: 2,
        totalCharacterCount: 48,
        eligibilityRulesVersion: "module-03-eligibility-v1",
      })
      .returning({ id: requirementAnalysisSnapshot.id });
    const snapshotId = snapshotInserted[0]?.id;
    if (!snapshotId) {
      throw new Error("Failed to seed run snapshot.");
    }

    await harness.db
      .update(requirementAnalysisRun)
      .set({
        status: "failed",
        sourceSnapshotId: snapshotId,
        failureCode: "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
        failureDetail: "provider timeout",
        failureRetryable: true,
        completedAt: new Date("2026-01-02T00:00:00.000Z"),
      })
      .where(eq(requirementAnalysisRun.id, sourceRunId));

    const retry = await retryRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      sourceRunId,
      { reason: "retry transient failure" },
      `retry-${randomUUID()}`,
    );
    expect(retry.status).toBe(201);
    expect(retry.body.mode).toBe("retry");
    expect(retry.body.retryOfRunId).toBe(sourceRunId);
    await harness.db
      .update(requirementAnalysisRun)
      .set({
        status: "failed",
        failureCode: "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
        failureDetail: "synthetic retry terminalization",
        failureRetryable: false,
        completedAt: new Date("2026-01-03T00:00:00.000Z"),
      })
      .where(eq(requirementAnalysisRun.id, retry.body.id as string));

    const replay = await replayRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      sourceRunId,
      { reason: "replay for audit" },
      `replay-${randomUUID()}`,
    );
    expect(replay.status).toBe(201);
    expect(replay.body.mode).toBe("replay");
    expect(replay.body.replayOfRunId).toBe(sourceRunId);
    await harness.db
      .update(requirementAnalysisRun)
      .set({
        status: "failed",
        failureCode: "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
        failureDetail: "synthetic replay terminalization",
        failureRetryable: false,
        completedAt: new Date("2026-01-03T00:00:00.000Z"),
      })
      .where(eq(requirementAnalysisRun.id, replay.body.id as string));

    const reprocess = await reprocessRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      sourceRunId,
      {
        providerPolicyId: policy.id,
        promptBundleVersion: fresh.body.provenance.promptBundleVersion,
        schemaBundleVersion: fresh.body.provenance.schemaBundleVersion,
        pipelineVersion: fresh.body.provenance.pipelineVersion,
        reason: "reprocess with explicit versions",
      },
      `reprocess-${randomUUID()}`,
    );
    expect(reprocess.status).toBe(201);
    expect(reprocess.body.mode).toBe("reprocess");
    expect(reprocess.body.reprocessOfRunId).toBe(sourceRunId);

    const cancel = await cancelRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      reprocess.body.id as string,
      { reason: "stop now" },
      `cancel-${randomUUID()}`,
    );
    expect(cancel.status).toBe(200);
    expect(cancel.body.cancelRequestedAt).toBeTruthy();

    const cancelAgain = await cancelRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      reprocess.body.id as string,
      { reason: "stop now again" },
      `cancel-${randomUUID()}`,
    );
    expect(cancelAgain.status).toBe(200);
    expect(queue.jobs.filter((job) => job.kind === "cancel-run")).toHaveLength(1);
    await harness.db
      .update(requirementAnalysisRun)
      .set({ status: "canceled", completedAt: new Date("2026-01-03T00:00:00.000Z") })
      .where(eq(requirementAnalysisRun.id, reprocess.body.id as string));

    await harness.db
      .update(requirementAnalysisRun)
      .set({
        status: "canceled",
        failureCode: null,
        failureDetail: null,
        failureRetryable: null,
        completedAt: new Date("2026-01-04T00:00:00.000Z"),
      })
      .where(eq(requirementAnalysisRun.id, sourceRunId));

    const retryDenied = await retryRequirementAnalysisRun(
      setup.adminAgent,
      setup.projectId,
      sourceRunId,
      { reason: "should fail" },
      `retry-denied-${randomUUID()}`,
    );
    expect(retryDenied.status).toBe(409);
    expect(retryDenied.body.code).toBe("AI_RUN_NOT_RETRYABLE");
  });

  it("scopes artifact reads by project/run and exposes no module-4 mutation route", async () => {
    const harness = getHarness();
    const setup = await provisionProject();
    const policy = await createApprovedPolicy(setup.adminAgent);

    const project2 = await createProject(setup.adminAgent, {
      name: `Secondary ${randomUUID()}`,
      type: "internal",
      ownerId: setup.adminId,
      status: "active",
    });
    expect(project2.status).toBe(201);

    const runId = await insertCompletedRun(setup, policy.id as string);
    const insertedRequirement = await harness.db
      .insert(requirement)
      .values({
        organizationId: setup.organizationId,
        projectId: setup.projectId,
        analysisRunId: runId,
        stableKey: `req-${randomUUID()}`,
        title: "Signed-in users can create projects",
        description: "Project creation requires an active organization member session.",
        requirementType: "functional",
        epistemicStatus: "unknown",
        confidenceBand: null,
        confidenceReasonCodes: [],
        origin: "source",
        lifecycleState: "ai_suggested",
      })
      .returning({ id: requirement.id });
    const requirementId = insertedRequirement[0]?.id;
    if (!requirementId) {
      throw new Error("Failed to seed requirement artifact.");
    }

    const read = await getRequirementAnalysisRequirement(
      setup.adminAgent,
      setup.projectId,
      runId,
      requirementId,
    );
    expect(read.status).toBe(200);
    expect(read.body.id).toBe(requirementId);

    const wrongProject = await getRequirementAnalysisRequirement(
      setup.adminAgent,
      project2.body.id as string,
      runId,
      requirementId,
    );
    expect(wrongProject.status).toBe(404);
    expect(wrongProject.body.code).toBe("AI_ARTIFACT_NOT_FOUND");

    const unknownMutation = await setup.adminAgent
      .post(
        `/api/v1/projects/${setup.projectId}/requirement-analysis/runs/${runId}/requirements/${requirementId}/review`,
      )
      .send({});
    expect(unknownMutation.status).toBe(404);

    const orgB = await createOrganization(harness.db);
    const orgBAdminAgent = createAgent(harness);
    await provisionAdmin(harness, orgBAdminAgent, orgB.id);
    const crossOrgRead = await getRequirementAnalysisRun(orgBAdminAgent, setup.projectId, runId);
    expect(crossOrgRead.status).toBe(403);
  });
});
