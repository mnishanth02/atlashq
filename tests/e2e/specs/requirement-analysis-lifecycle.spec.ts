import { createHash, randomUUID } from "node:crypto";
import { createDatabaseClient, type DatabaseClient } from "@atlashq/db";
import type { Page } from "@playwright/test";
import { createFakeAiProviderRegistry } from "../../../apps/worker/src/requirement-analysis/provider-runtime";
import { createDrizzleRequirementAnalysisRepository } from "../../../apps/worker/src/requirement-analysis/repository/drizzle-repository";
import type { AnalysisRuntime } from "../../../apps/worker/src/requirement-analysis/runtime";
import type { CoverageAnalysisOutput } from "../../../apps/worker/src/requirement-analysis/schemas";
import { handlePlanBatches } from "../../../apps/worker/src/requirement-analysis/stages/batch-planning";
import { handleCitationVerificationStage } from "../../../apps/worker/src/requirement-analysis/stages/citation-verification";
import { handleConflictDetectionStage } from "../../../apps/worker/src/requirement-analysis/stages/conflict-detection";
import { handleCoverageAnalysisStage } from "../../../apps/worker/src/requirement-analysis/stages/coverage-analysis";
import { handleDeliveryItemExtractionStage } from "../../../apps/worker/src/requirement-analysis/stages/delivery-item-extraction";
import { handleRunBatch } from "../../../apps/worker/src/requirement-analysis/stages/extraction-batch";
import { handleFinalizeRun } from "../../../apps/worker/src/requirement-analysis/stages/finalize";
import { handleFreezeSnapshot } from "../../../apps/worker/src/requirement-analysis/stages/freeze-snapshot";
import { handleNormalizationDeduplicationStage } from "../../../apps/worker/src/requirement-analysis/stages/normalization";
import { handleQuestionGenerationStage } from "../../../apps/worker/src/requirement-analysis/stages/question-generation";
import {
  createFakeStructuredExecutor,
  createRecordingAiAnalysisQueue,
  createRecordingCitationVerificationQueue,
} from "../../../apps/worker/src/requirement-analysis/test-support/fixtures";
import { coverageCategoryDescriptors } from "../../../packages/types/src/index";
import { expect, test } from "../fixtures/base";
import {
  E2E_MEMBER_EMAIL,
  E2E_MEMBER_NAME,
  E2E_MEMBER_PASSWORD,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
} from "../support/test-data";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const FIXTURE_NOW = new Date("2026-01-01T00:00:00.000Z");
const MANUAL_SOURCE_BODY =
  "The system shall authenticate every user before granting access. Session controls must enforce this for every protected action.";
const COVERAGE_CATEGORIES: Array<{
  key: CoverageAnalysisOutput["categories"][number]["categoryKey"];
  label: string;
}> = coverageCategoryDescriptors.map((descriptor) => ({
  key: descriptor.key,
  label: descriptor.label,
}));

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 1440 } });

type ProviderPolicySeed = {
  id: string;
  provider: "openai";
  modelAlias: string;
  resolvedModelId: string;
  dataRetentionMode: "provider_default";
};

type ProjectContext = {
  organizationId: string;
  ownerId: string;
};

function requireDatabaseUrl(): string {
  const value = process.env.E2E_DATABASE_URL;
  if (!value) {
    throw new Error("E2E_DATABASE_URL is not set. global-setup must publish the Postgres URL.");
  }
  return value;
}

function parseRouteUuid(url: string, segment: string): string {
  const match = new RegExp(`/${segment}/([0-9a-f-]{36})(?:$|\\?|/)`, "u").exec(url);
  const value = match?.[1];
  if (!value) {
    throw new Error(`Could not parse ${segment} UUID from URL: ${url}`);
  }
  return value;
}

async function selectOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login/u);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/u);
}

async function createProject(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "New project", exact: true }).first().click();
  const createDialog = page.getByRole("dialog", { name: "Create project" });
  await expect(createDialog).toBeVisible();

  await selectOption(page, "Engagement type", "Internal");
  await createDialog.getByLabel("Project name", { exact: true }).fill(name);
  await createDialog
    .getByLabel("Description", { exact: true })
    .fill("Module 3 requirement-analysis lifecycle integration E2E.");
  await selectOption(page, "Status", "Active");
  await selectOption(page, "Phase", "Requirements");
  await selectOption(page, "Priority", "High");
  await selectOption(page, "Visibility", "Private");
  await createDialog.getByLabel("Start date", { exact: true }).fill("2026-09-01");
  await createDialog.getByLabel("Target date", { exact: true }).fill("2026-12-01");
  await createDialog.getByLabel("Tags", { exact: true }).fill("module-3,e2e");
  await createDialog.getByRole("button", { name: "Create project", exact: true }).click();

  await expect(page).toHaveURL(/\/projects\/([0-9a-f-]{36})$/u);
  return parseRouteUuid(page.url(), "projects");
}

async function openAddSource(page: Page): Promise<void> {
  const addFirst = page.getByRole("button", { name: "Add first source", exact: true });
  const add = page.getByRole("button", { name: "Add source", exact: true });
  if (await addFirst.isVisible().catch(() => false)) {
    await addFirst.click();
  } else {
    await add.click();
  }
  await expect(page.getByRole("dialog", { name: "Add source document" })).toBeVisible();
}

async function createReadyManualSource(
  page: Page,
  client: DatabaseClient,
  projectId: string,
  title: string,
): Promise<string> {
  await page.goto(`/projects/${projectId}/source-documents`);
  await expect(page.getByRole("heading", { name: "Source documents" })).toBeVisible();

  await openAddSource(page);
  await page.getByRole("tab", { name: "Manual text", exact: true }).click();
  await expect(page.getByText("Manual text is immutable once saved")).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Body", { exact: true }).fill(MANUAL_SOURCE_BODY);
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(page.getByText("Manual source created")).toBeVisible();

  const sourceResult = await client.pool.query<{ id: string; organization_id: string }>(
    `SELECT id, organization_id
     FROM source_document
     WHERE project_id = $1 AND title = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId, title],
  );
  const sourceRow = sourceResult.rows[0];
  if (!sourceRow) {
    throw new Error(`Manual source "${title}" was not persisted.`);
  }
  const sourceDocumentId = sourceRow.id;

  await client.pool.query(
    `UPDATE source_document
     SET processing_status = 'ready', updated_at = now()
     WHERE id = $1`,
    [sourceDocumentId],
  );

  const successfulExtractionResult = await client.pool.query<{ id: string }>(
    `SELECT id
     FROM source_extraction
     WHERE source_document_id = $1
       AND status = 'succeeded'
     ORDER BY extraction_version DESC, created_at DESC
     LIMIT 1`,
    [sourceDocumentId],
  );
  let sourceExtractionId = successfulExtractionResult.rows[0]?.id;

  if (!sourceExtractionId) {
    const extractionResult = await client.pool.query<{ id: string }>(
      `SELECT id
       FROM source_extraction
       WHERE source_document_id = $1
         AND status IN ('pending', 'running')
       ORDER BY extraction_version DESC, created_at DESC
       LIMIT 1`,
      [sourceDocumentId],
    );
    sourceExtractionId = extractionResult.rows[0]?.id;
    if (sourceExtractionId) {
      const promotedExtractionResult = await client.pool.query<{ id: string }>(
        `UPDATE source_extraction
         SET status = 'succeeded',
             failure_code = null,
             failure_detail = null,
             completed_at = coalesce(completed_at, now())
         WHERE id = $1
           AND status IN ('pending', 'running')
         RETURNING id`,
        [sourceExtractionId],
      );
      if (!promotedExtractionResult.rows[0]) {
        const refreshedSuccessResult = await client.pool.query<{ id: string }>(
          `SELECT id
           FROM source_extraction
           WHERE source_document_id = $1
             AND status = 'succeeded'
           ORDER BY extraction_version DESC, created_at DESC
           LIMIT 1`,
          [sourceDocumentId],
        );
        sourceExtractionId = refreshedSuccessResult.rows[0]?.id;
      }
    }
  }

  if (!sourceExtractionId) {
    const nextVersionResult = await client.pool.query<{ next_version: number }>(
      `SELECT coalesce(max(extraction_version), 0) + 1 AS next_version
       FROM source_extraction
       WHERE source_document_id = $1`,
      [sourceDocumentId],
    );
    const nextExtractionVersion = nextVersionResult.rows[0]?.next_version ?? 1;
    sourceExtractionId = randomUUID();
    await client.pool.query(
      `INSERT INTO source_extraction (
         id, source_document_id, extraction_version, status, chunker_version, completed_at
       ) VALUES ($1, $2, $3, 'succeeded', 'chunker-v1', now())`,
      [sourceExtractionId, sourceDocumentId, nextExtractionVersion],
    );
  }

  let chunkReady = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const chunkExists = await client.pool.query<{ id: string }>(
      `SELECT id FROM source_chunk WHERE source_extraction_id = $1 LIMIT 1`,
      [sourceExtractionId],
    );
    if (chunkExists.rows[0]) {
      chunkReady = true;
      break;
    }

    try {
      await client.pool.query(
        `INSERT INTO source_chunk (
           id, organization_id, project_id, source_document_id, source_extraction_id,
           sequence, content, character_count, content_hash
         ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8)
         ON CONFLICT ("source_extraction_id", "sequence") DO NOTHING`,
        [
          randomUUID(),
          sourceRow.organization_id,
          projectId,
          sourceDocumentId,
          sourceExtractionId,
          MANUAL_SOURCE_BODY,
          MANUAL_SOURCE_BODY.length,
          createHash("sha256").update(MANUAL_SOURCE_BODY).digest("hex"),
        ],
      );
    } catch (error) {
      if (!(error instanceof Error) || !/deadlock detected/iu.test(error.message)) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!chunkReady) {
    const chunkExists = await client.pool.query<{ id: string }>(
      `SELECT id FROM source_chunk WHERE source_extraction_id = $1 LIMIT 1`,
      [sourceExtractionId],
    );
    if (!chunkExists.rows[0]) {
      throw new Error("Manual source extraction did not produce any source_chunk rows for E2E.");
    }
  }

  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();

  return sourceDocumentId;
}

async function forceReadySourceDocument(
  client: DatabaseClient,
  sourceDocumentId: string,
): Promise<void> {
  await client.pool.query(
    `UPDATE source_document
     SET processing_status = 'ready',
         ai_processing_status = 'completed',
         updated_at = now()
     WHERE id = $1`,
    [sourceDocumentId],
  );
  await client.pool.query(
    `UPDATE source_extraction
     SET status = 'succeeded',
         failure_code = null,
         failure_detail = null,
         completed_at = coalesce(completed_at, now())
     WHERE source_document_id = $1
       AND status IN ('pending', 'running')`,
    [sourceDocumentId],
  );
}

async function createApprovedProviderPolicy(page: Page): Promise<ProviderPolicySeed> {
  const createResponse = await page.request.post(
    "/api/v1/organizations/current/ai-provider-policies",
    {
      data: {
        provider: "openai",
        policyName: `E2E Module 3 Policy ${randomUUID()}`,
        modelAlias: "gpt-4o-mini",
        resolvedModelId: "gpt-4o-mini",
        dataRetentionMode: "provider_default",
        maxUsdPerRun: 2.5,
        maxInputTokensPerRun: 150_000,
        maxOutputTokensPerRun: 20_000,
        maxWallClockSeconds: 1200,
      },
    },
  );
  expect(createResponse.status()).toBe(201);
  const created = (await createResponse.json()) as { id: string };

  const approveResponse = await page.request.post(
    `/api/v1/organizations/current/ai-provider-policies/${created.id}/approve`,
    {
      data: {
        version: 1,
        approvalNote: "Approved for deterministic Module 3 E2E coverage.",
        providerTermsSnapshotHash: HASH_A,
      },
    },
  );
  if (approveResponse.status() !== 200) {
    throw new Error(
      `Policy approval failed with status ${approveResponse.status()}: ${await approveResponse.text()}`,
    );
  }

  return {
    id: created.id,
    provider: "openai",
    modelAlias: "gpt-4o-mini",
    resolvedModelId: "gpt-4o-mini",
    dataRetentionMode: "provider_default",
  };
}

async function getProjectContext(
  client: DatabaseClient,
  projectId: string,
): Promise<ProjectContext> {
  const result = await client.pool.query<{ organization_id: string; owner_id: string }>(
    `SELECT organization_id, owner_id FROM project WHERE id = $1`,
    [projectId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Project not found in DB: ${projectId}`);
  }
  return { organizationId: row.organization_id, ownerId: row.owner_id };
}

async function insertRequestedRun(
  client: DatabaseClient,
  input: {
    organizationId: string;
    projectId: string;
    requestedBy: string;
    providerPolicy: ProviderPolicySeed;
  },
): Promise<string> {
  const runId = randomUUID();
  await client.pool.query(
    `INSERT INTO requirement_analysis_run (
       id, organization_id, project_id, requested_by, mode, status, provider_policy_id,
       provider, model_alias, resolved_model_id, provider_data_retention_mode,
       prompt_bundle_version, prompt_bundle_hash, schema_bundle_version, schema_bundle_hash,
       pipeline_version, pipeline_hash, model_policy_hash, max_usd, max_input_tokens,
       max_output_tokens, max_wall_clock_seconds, correlation_id
     ) VALUES ($1, $2, $3, $4, 'fresh', 'requested', $5, $6, $7, $8, $9, 'v1', $10, 'v1',
       $11, 'v1', $12, $13, 3, 300000, 30000, 1800, $14)`,
    [
      runId,
      input.organizationId,
      input.projectId,
      input.requestedBy,
      input.providerPolicy.id,
      input.providerPolicy.provider,
      input.providerPolicy.modelAlias,
      input.providerPolicy.resolvedModelId,
      input.providerPolicy.dataRetentionMode,
      HASH_A,
      HASH_B,
      HASH_C,
      HASH_D,
      randomUUID(),
    ],
  );
  return runId;
}

async function seedCompletedRun(
  client: DatabaseClient,
  input: {
    organizationId: string;
    projectId: string;
    actorId: string;
    sourceDocumentId: string;
    providerPolicy: ProviderPolicySeed;
  },
): Promise<{ runId: string; sourceSnapshotId: string }> {
  const repository = createDrizzleRequirementAnalysisRepository(client.db);
  const runtime: AnalysisRuntime = {
    repository,
    providerRegistry: createFakeAiProviderRegistry(),
    featureFlags: { referenceFeatureExtractionEnabled: false },
    now: () => FIXTURE_NOW,
  };
  const aiAnalysisQueue = createRecordingAiAnalysisQueue();
  const citationVerificationQueue = createRecordingCitationVerificationQueue();

  const runId = await insertRequestedRun(client, {
    organizationId: input.organizationId,
    projectId: input.projectId,
    requestedBy: input.actorId,
    providerPolicy: input.providerPolicy,
  });

  const freezeResult = await handleFreezeSnapshot(runtime, aiAnalysisQueue, {
    kind: "freeze-snapshot",
    idempotencyKey: `freeze-${runId}`,
    correlationId: runId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId,
    actorId: input.actorId,
    sourceDocumentIds: [input.sourceDocumentId],
    submittedAt: FIXTURE_NOW.toISOString(),
  });

  await handlePlanBatches(runtime, aiAnalysisQueue, {
    kind: "plan-batches",
    idempotencyKey: `plan-${runId}`,
    correlationId: runId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId,
    snapshotId: freezeResult.snapshotId,
    submittedAt: FIXTURE_NOW.toISOString(),
  });

  const stages = await repository.listStagesByRun(runId);
  const confirmedStage = stages.find((stage) => stage.kind === "confirmed_extraction");
  const citationStage = stages.find((stage) => stage.kind === "citation_verification");
  const normalizationStage = stages.find((stage) => stage.kind === "normalization_deduplication");
  const conflictStage = stages.find((stage) => stage.kind === "conflict_detection");
  const coverageStage = stages.find((stage) => stage.kind === "coverage_analysis");
  const deliveryStage = stages.find((stage) => stage.kind === "delivery_item_extraction");
  const questionStage = stages.find((stage) => stage.kind === "question_generation");
  if (
    !confirmedStage ||
    !citationStage ||
    !normalizationStage ||
    !conflictStage ||
    !coverageStage ||
    !deliveryStage ||
    !questionStage
  ) {
    throw new Error("Pipeline stage rows were not created for deterministic E2E run.");
  }

  const batches = await repository.listBatchesByStage(confirmedStage.id);
  const [batch] = batches;
  if (!batch) {
    throw new Error("Confirmed extraction stage has no batches.");
  }
  const chunks = await repository.listBatchChunkContents(batch.id);
  const [chunk] = chunks;
  if (!chunk) {
    throw new Error("Confirmed extraction batch has no chunk contents.");
  }

  const extractionExecutor = createFakeStructuredExecutor([
    {
      output: {
        requirements: [
          {
            stableKey: "req-auth-1",
            title: "System shall authenticate users",
            description: null,
            requirementType: "functional",
            priority: null,
            epistemicStatus: "confirmed",
            inferenceBasis: null,
            citations: [
              {
                snapshotChunkId: chunk.snapshotChunkId,
                quote: "The system shall authenticate every user before granting access.",
              },
            ],
          },
        ],
      },
      usage: { inputTokens: 40, outputTokens: 16 },
    },
  ]);

  await handleRunBatch(
    { ...runtime, executor: extractionExecutor },
    aiAnalysisQueue,
    citationVerificationQueue,
    {
      kind: "run-batch",
      idempotencyKey: `run-batch-${runId}`,
      correlationId: runId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      runId,
      stageId: confirmedStage.id,
      batchId: batch.id,
      submittedAt: FIXTURE_NOW.toISOString(),
    },
  );

  await handleCitationVerificationStage(runtime, aiAnalysisQueue, {
    kind: "run-stage",
    idempotencyKey: `citation-${runId}`,
    correlationId: runId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId,
    stageId: citationStage.id,
    stageKind: "citation_verification",
    submittedAt: FIXTURE_NOW.toISOString(),
  });

  await handleNormalizationDeduplicationStage(runtime, aiAnalysisQueue, {
    kind: "run-stage",
    idempotencyKey: `normalize-${runId}`,
    correlationId: runId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId,
    stageId: normalizationStage.id,
    stageKind: "normalization_deduplication",
    submittedAt: FIXTURE_NOW.toISOString(),
  });

  const conflictExecutor = createFakeStructuredExecutor([
    { output: { conflicts: [] }, usage: { inputTokens: 6, outputTokens: 3 } },
  ]);
  await handleConflictDetectionStage({ ...runtime, executor: conflictExecutor }, aiAnalysisQueue, {
    kind: "run-stage",
    idempotencyKey: `conflict-${runId}`,
    correlationId: runId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId,
    stageId: conflictStage.id,
    stageKind: "conflict_detection",
    submittedAt: FIXTURE_NOW.toISOString(),
  });

  const coverageOutput: CoverageAnalysisOutput = {
    categories: COVERAGE_CATEGORIES.map((descriptor, index) => ({
      categoryKey: descriptor.key,
      status: index === 0 ? "addressed" : "absent",
      rationale: index === 0 ? "Covered by requirement req-auth-1." : null,
      evidenceState: index === 0 ? "verified_citation" : "none_found",
      requirementIds: index === 0 ? ["req-auth-1"] : [],
    })),
  };
  const coverageExecutor = createFakeStructuredExecutor([
    { output: coverageOutput, usage: { inputTokens: 28, outputTokens: 12 } },
  ]);
  await handleCoverageAnalysisStage({ ...runtime, executor: coverageExecutor }, aiAnalysisQueue, {
    kind: "run-stage",
    idempotencyKey: `coverage-${runId}`,
    correlationId: runId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId,
    stageId: coverageStage.id,
    stageKind: "coverage_analysis",
    submittedAt: FIXTURE_NOW.toISOString(),
  });

  const deliveryExecutor = createFakeStructuredExecutor([
    { output: { items: [] }, usage: { inputTokens: 4, outputTokens: 2 } },
  ]);
  await handleDeliveryItemExtractionStage(
    { ...runtime, executor: deliveryExecutor },
    aiAnalysisQueue,
    {
      kind: "run-stage",
      idempotencyKey: `delivery-${runId}`,
      correlationId: runId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      runId,
      stageId: deliveryStage.id,
      stageKind: "delivery_item_extraction",
      submittedAt: FIXTURE_NOW.toISOString(),
    },
  );

  const questionExecutor = createFakeStructuredExecutor([
    {
      output: {
        questions: COVERAGE_CATEGORIES.slice(1).map((descriptor) => ({
          title: `Clarify coverage for ${descriptor.label}`,
          description: null,
          priority: null,
          coverageCategoryKey: descriptor.key,
          relatedRequirementIds: [],
          citations: [],
        })),
      },
      usage: { inputTokens: 5, outputTokens: 2 },
    },
  ]);
  await handleQuestionGenerationStage({ ...runtime, executor: questionExecutor }, aiAnalysisQueue, {
    kind: "run-stage",
    idempotencyKey: `question-${runId}`,
    correlationId: runId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId,
    stageId: questionStage.id,
    stageKind: "question_generation",
    submittedAt: FIXTURE_NOW.toISOString(),
  });

  await handleFinalizeRun(runtime, aiAnalysisQueue, {
    kind: "finalize-run",
    idempotencyKey: `finalize-${runId}`,
    correlationId: runId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId,
    submittedAt: FIXTURE_NOW.toISOString(),
  });

  const finalRun = await repository.getRun(runId);
  if (finalRun?.status !== "completed" || !finalRun.sourceSnapshotId) {
    throw new Error("Deterministic E2E run did not reach completed status with a frozen snapshot.");
  }
  return { runId, sourceSnapshotId: finalRun.sourceSnapshotId };
}

async function seedRetryableFailedRun(
  client: DatabaseClient,
  input: {
    organizationId: string;
    projectId: string;
    requestedBy: string;
    sourceSnapshotId: string;
    providerPolicy: ProviderPolicySeed;
  },
): Promise<string> {
  const runId = randomUUID();
  await client.pool.query(
    `INSERT INTO requirement_analysis_run (
       id, organization_id, project_id, requested_by, mode, status, source_snapshot_id,
       provider_policy_id, provider, model_alias, resolved_model_id, provider_data_retention_mode,
       prompt_bundle_version, prompt_bundle_hash, schema_bundle_version, schema_bundle_hash,
       pipeline_version, pipeline_hash, model_policy_hash, max_usd, max_input_tokens,
       max_output_tokens, max_wall_clock_seconds, started_at, completed_at,
       failure_code, failure_detail, failure_retryable, correlation_id
     ) VALUES (
       $1, $2, $3, $4, 'fresh', 'failed', $5, $6, $7, $8, $9, $10, 'v1', $11, 'v1', $12,
       'v1', $13, $14, 3, 300000, 30000, 1800, now(), now(),
       'AI_RUN_TRANSIENT_PROVIDER_FAILURE', 'Deterministic retry fixture.', true, $15
     )`,
    [
      runId,
      input.organizationId,
      input.projectId,
      input.requestedBy,
      input.sourceSnapshotId,
      input.providerPolicy.id,
      input.providerPolicy.provider,
      input.providerPolicy.modelAlias,
      input.providerPolicy.resolvedModelId,
      input.providerPolicy.dataRetentionMode,
      HASH_A,
      HASH_B,
      HASH_C,
      HASH_D,
      randomUUID(),
    ],
  );
  return runId;
}

async function forceTerminalizeActiveRuns(
  client: DatabaseClient,
  projectId: string,
): Promise<void> {
  let stableZeroChecks = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await client.pool.query(
      `UPDATE requirement_analysis_run
       SET status = 'canceled',
           completed_at = now(),
           cancel_requested_at = coalesce(cancel_requested_at, now()),
           cancel_requested_by = coalesce(cancel_requested_by, requested_by),
           failure_code = null,
           failure_detail = null,
           failure_retryable = null,
           updated_at = now()
       WHERE project_id = $1
         AND status IN ('requested', 'snapshotting', 'queued', 'running', 'waiting_retry')`,
      [projectId],
    );
    const activeResult = await client.pool.query<{ active_count: string }>(
      `SELECT count(*)::text AS active_count
       FROM requirement_analysis_run
       WHERE project_id = $1
         AND status IN ('requested', 'snapshotting', 'queued', 'running', 'waiting_retry')`,
      [projectId],
    );
    const activeCount = Number(activeResult.rows[0]?.active_count ?? "0");
    if (activeCount === 0) {
      stableZeroChecks += 1;
      if (stableZeroChecks >= 3) {
        return;
      }
    } else {
      stableZeroChecks = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Unable to quiesce requirement-analysis active runs in E2E fixture window.");
}

async function getLatestRunId(client: DatabaseClient, projectId: string): Promise<string | null> {
  const result = await client.pool.query<{ id: string }>(
    `SELECT id
     FROM requirement_analysis_run
     WHERE project_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId],
  );
  return result.rows[0]?.id ?? null;
}

async function openRunAction(page: Page, runId: string, actionLabel: string): Promise<void> {
  const row = page.getByRole("row").filter({ hasText: runId });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("menuitem", { name: actionLabel, exact: true }).click();
}

test("module-03 requirement-analysis lifecycle works end-to-end with deterministic fake processing", async ({
  page,
  browser,
}) => {
  test.setTimeout(420_000);

  const databaseClient = createDatabaseClient({ connectionString: requireDatabaseUrl() });
  try {
    await login(page, E2E_USER_EMAIL, E2E_USER_PASSWORD);
    const projectId = await createProject(page, `Requirement Analysis E2E ${randomUUID()}`);
    const projectContext = await getProjectContext(databaseClient, projectId);

    await page.goto(`/projects/${projectId}/requirement-analysis`);
    await expect(page.getByRole("heading", { name: "Requirement analysis" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Requirement analyzer is read-only")).toBeVisible();
    await expect(
      page.getByText("No approved AI provider policy is configured for this project yet."),
    ).toBeVisible();
    await expect(page.getByText("No eligible sources")).toBeVisible();

    const policy = await createApprovedProviderPolicy(page);
    await page.reload();
    await expect(
      page.getByText("No approved AI provider policy is configured for this project yet."),
    ).toHaveCount(0);
    await expect(page.getByText("No eligible sources")).toBeVisible();

    const sourceTitle = `Requirement Analysis Source ${randomUUID()}`;
    const sourceDocumentId = await createReadyManualSource(
      page,
      databaseClient,
      projectId,
      sourceTitle,
    );
    await forceReadySourceDocument(databaseClient, sourceDocumentId);

    await page.goto(`/projects/${projectId}/requirement-analysis`);
    await expect(page.getByText("1 of 1 sources qualify")).toBeVisible({ timeout: 30_000 });
    const startFreshRunButton = page.getByRole("button", { name: "Start fresh run", exact: true });
    await expect(startFreshRunButton).toBeEnabled({ timeout: 30_000 });
    await startFreshRunButton.click();
    const launchDialog = page.getByRole("dialog", { name: "Start a fresh analysis run" });
    await expect(launchDialog).toBeVisible();
    await launchDialog.getByRole("checkbox", { name: "Use all eligible sources" }).click();
    await launchDialog.getByRole("checkbox", { name: sourceTitle }).check();
    await launchDialog.getByRole("button", { name: "Start run", exact: true }).click();
    await expect(page.getByText("Analysis run started.")).toBeVisible();
    const launchedRunId = await getLatestRunId(databaseClient, projectId);
    if (!launchedRunId) {
      throw new Error("Fresh run was not created after Start run.");
    }
    await expect(page.getByRole("row").filter({ hasText: launchedRunId })).toHaveCount(1);

    await openRunAction(page, launchedRunId, "Cancel run");
    const cancelDialog = page.getByRole("alertdialog", { name: "Cancel this analysis run?" });
    await expect(cancelDialog).toBeVisible();
    await cancelDialog.getByRole("button", { name: "Cancel run", exact: true }).click();
    await expect(page.getByText("Cancellation requested.")).toBeVisible();
    await forceTerminalizeActiveRuns(databaseClient, projectId);

    const completedRun = await seedCompletedRun(databaseClient, {
      organizationId: projectContext.organizationId,
      projectId,
      actorId: projectContext.ownerId,
      sourceDocumentId,
      providerPolicy: policy,
    });
    const failedRunId = await seedRetryableFailedRun(databaseClient, {
      organizationId: projectContext.organizationId,
      projectId,
      requestedBy: projectContext.ownerId,
      sourceSnapshotId: completedRun.sourceSnapshotId,
      providerPolicy: policy,
    });

    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: completedRun.runId })).toHaveCount(1);
    await expect(page.getByRole("row").filter({ hasText: failedRunId })).toHaveCount(1);

    await page.getByRole("link", { name: completedRun.runId, exact: true }).click();
    await expect(page.getByText("This is a read-only AI draft")).toBeVisible();
    await page.getByRole("tab", { name: "Requirements", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "View evidence", exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "View evidence", exact: true }).first().click();
    const evidenceDialog = page.getByRole("dialog", { name: /^Evidence —/u });
    await expect(evidenceDialog).toBeVisible();
    await page
      .getByRole("button", { name: /Evidence .* from Source chunk #0/u })
      .first()
      .click();
    await expect(page.getByText("Verification")).toBeVisible();
    await page.keyboard.press("Escape");
    if (await evidenceDialog.isVisible().catch(() => false)) {
      await evidenceDialog.getByRole("button", { name: "Close" }).click();
    }
    await expect(evidenceDialog).toHaveCount(0);

    const coverageTab = page.getByRole("tab", { name: "Coverage", exact: true });
    await expect(coverageTab).toBeVisible({ timeout: 30_000 });
    await coverageTab.click();
    const coverageTable = page
      .getByRole("table")
      .filter({ has: page.getByRole("columnheader", { name: "Category", exact: true }) })
      .first();
    await expect(coverageTable).toBeVisible();
    for (const descriptor of COVERAGE_CATEGORIES) {
      await expect(
        coverageTable.getByRole("cell", { name: descriptor.label, exact: true }).first(),
      ).toBeVisible();
    }
    await page.getByRole("tab", { name: "Citations", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: "Verified exact match", exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to requirement analysis", exact: true }).click();

    await openRunAction(page, failedRunId, "Retry run");
    await expect(page.getByText("Retry started.")).toBeVisible();
    await forceTerminalizeActiveRuns(databaseClient, projectId);
    await page.reload();

    await openRunAction(page, completedRun.runId, "Replay run");
    await expect(page.getByText("Replay started.")).toBeVisible();
    await forceTerminalizeActiveRuns(databaseClient, projectId);
    await page.reload();

    await openRunAction(page, completedRun.runId, "Reprocess run");
    await expect(
      page.getByRole("dialog", { name: `Reprocess run ${completedRun.runId}` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start reprocess", exact: true }).click();
    await expect(page.getByText("Reprocess started.")).toBeVisible();
    await forceTerminalizeActiveRuns(databaseClient, projectId);

    await page.goto(`/projects/${projectId}`);
    await page.getByRole("tab", { name: "Members", exact: true }).click();
    await page.getByRole("combobox", { name: "Member", exact: true }).click();
    await page.getByRole("option", { name: new RegExp(E2E_MEMBER_NAME, "u") }).click();
    await selectOption(page, "Role", "Client Viewer / Approver");
    await page.getByRole("button", { name: "Add member", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: E2E_MEMBER_NAME })).toContainText(
      "Client Viewer / Approver",
    );

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    try {
      await login(memberPage, E2E_MEMBER_EMAIL, E2E_MEMBER_PASSWORD);
      await memberPage.goto(`/projects/${projectId}/requirement-analysis`);
      await expect(memberPage.getByText("Access denied")).toBeVisible();
      await expect(
        memberPage.getByRole("button", { name: "Start fresh run", exact: true }),
      ).toHaveCount(0);
    } finally {
      await memberContext.close();
    }
  } finally {
    await databaseClient.close();
  }
});
