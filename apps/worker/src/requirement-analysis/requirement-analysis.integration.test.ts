import { randomUUID } from "node:crypto";
import { createDatabaseClient, type DatabaseClient } from "@atlashq/db";
import { coverageCategoryDescriptors } from "@atlashq/types";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createFakeAiProviderRegistry } from "./provider-runtime.js";
import { createDrizzleRequirementAnalysisRepository } from "./repository/drizzle-repository.js";
import type { RequirementAnalysisRepository } from "./repository/types.js";
import type { AnalysisRuntime } from "./runtime.js";
import type { CoverageAnalysisOutput } from "./schemas.js";
import { handlePlanBatches } from "./stages/batch-planning.js";
import { handleCitationVerificationStage } from "./stages/citation-verification.js";
import { handleConflictDetectionStage } from "./stages/conflict-detection.js";
import { handleCoverageAnalysisStage } from "./stages/coverage-analysis.js";
import { handleDeliveryItemExtractionStage } from "./stages/delivery-item-extraction.js";
import { handleRunBatch } from "./stages/extraction-batch.js";
import { handleFinalizeRun } from "./stages/finalize.js";
import { handleFreezeSnapshot } from "./stages/freeze-snapshot.js";
import { handleNormalizationDeduplicationStage } from "./stages/normalization.js";
import { handleQuestionGenerationStage } from "./stages/question-generation.js";
import {
  createFakeStructuredExecutor,
  createRecordingAiAnalysisQueue,
  createRecordingCitationVerificationQueue,
} from "./test-support/fixtures.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const NOW = new Date("2025-01-01T00:00:00.000Z");

type Seed = { organizationId: string; projectId: string; userId: string };

/**
 * Real end-to-end exercise of `createDrizzleRequirementAnalysisRepository` against a disposable
 * Testcontainers Postgres (module-03 worker task item 9: "Testcontainers integration where
 * current worker patterns support it"), driving one requirement through the entire module-03 DAG
 * -- freeze -> plan -> confirmed extraction -> citation verification -> normalization ->
 * conflict/coverage/delivery/question branches -> finalize -- with a scripted fake AI executor
 * (never a real network call; see `createFakeStructuredExecutor`) standing in for every
 * model-calling stage. The 200+ unit tests already cover each stage's business logic against the
 * in-memory fake repository; this suite only proves the real Postgres-backed repository wires
 * every one of those same code paths correctly against the actual schema/constraints.
 */
describe("integration: requirement-analysis DAG against real Postgres", () => {
  let client: DatabaseClient;
  let repository: RequirementAnalysisRepository;

  beforeAll(async () => {
    const env = inject("workerIntegrationEnv");
    client = createDatabaseClient({ connectionString: env.DATABASE_URL });
    repository = createDrizzleRequirementAnalysisRepository(client.db);
  });

  afterAll(async () => {
    await client.close();
  });

  async function seedOrgProjectUser(): Promise<Seed> {
    const organizationId = randomUUID();
    const userId = randomUUID();
    const projectId = randomUUID();

    await client.pool.query(`INSERT INTO organization (id, name) VALUES ($1, $2)`, [
      organizationId,
      `RA Worker Integration Org ${organizationId}`,
    ]);
    await client.pool.query(
      `INSERT INTO "user" (id, organization_id, name, email) VALUES ($1, $2, $3, $4)`,
      [userId, organizationId, "RA Worker Integration User", `ra-worker-${userId}@atlashq.test`],
    );
    await client.pool.query(
      `INSERT INTO project (id, organization_id, name, type, owner_id) VALUES ($1, $2, $3, $4, $5)`,
      [projectId, organizationId, `RA Worker Integration Project ${projectId}`, "internal", userId],
    );

    return { organizationId, projectId, userId };
  }

  async function seedEligibleSource(seed: Seed): Promise<{ sourceChunkId: string }> {
    const sourceDocumentId = randomUUID();
    await client.pool.query(
      `INSERT INTO source_document (
         id, organization_id, project_id, lineage_id, version_number, source_type,
         document_format, title, content_hash, created_by, processing_status
       ) VALUES ($1, $2, $3, $1, 1, 'document', 'pdf', 'RA Worker Integration Document', $4, $5, 'ready')`,
      [sourceDocumentId, seed.organizationId, seed.projectId, HASH_A, seed.userId],
    );

    const sourceDocumentFileId = randomUUID();
    await client.pool.query(
      `INSERT INTO source_document_file (
         id, source_document_id, ordinal, role, original_file_name, download_file_name,
         format, declared_mime_type, byte_size, sha256, object_key, object_version_id
       ) VALUES ($1, $2, 0, 'primary', 'original.pdf', 'download.pdf', 'pdf', 'application/pdf', 1024, $3, $4, 'v1')`,
      [sourceDocumentFileId, sourceDocumentId, HASH_B, `ra-worker/${sourceDocumentId}/0.pdf`],
    );

    const sourceExtractionId = randomUUID();
    await client.pool.query(
      `INSERT INTO source_extraction (id, source_document_id, extraction_version, status, chunker_version)
       VALUES ($1, $2, 1, 'succeeded', 'chunker-v1')`,
      [sourceExtractionId, sourceDocumentId],
    );

    const sourceChunkId = randomUUID();
    await client.pool.query(
      `INSERT INTO source_chunk (
         id, organization_id, project_id, source_document_id, source_extraction_id,
         sequence, content, character_count, content_hash
       ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8)`,
      [
        sourceChunkId,
        seed.organizationId,
        seed.projectId,
        sourceDocumentId,
        sourceExtractionId,
        "The system shall authenticate every user before granting access.",
        65,
        HASH_C,
      ],
    );

    return { sourceChunkId };
  }

  async function seedApprovedProviderPolicy(seed: Seed): Promise<string> {
    const id = randomUUID();
    await client.pool.query(
      `INSERT INTO organization_ai_provider_policy (
         id, organization_id, provider, policy_name, model_alias, resolved_model_id,
         data_retention_mode, status, approved_for_requirement_analysis, approved_by, approved_at,
         approval_note
       ) VALUES ($1, $2, 'openai', $3, 'fake-model', 'fake-model-v1', 'zero_retention',
         'approved', true, $4, now(), 'approved for worker integration test')`,
      [id, seed.organizationId, `RA Worker Integration Policy ${id}`, seed.userId],
    );
    return id;
  }

  async function seedRun(seed: Seed, providerPolicyId: string): Promise<string> {
    const id = randomUUID();
    await client.pool.query(
      `INSERT INTO requirement_analysis_run (
         id, organization_id, project_id, requested_by, mode, status, provider_policy_id,
         provider, model_alias, resolved_model_id, provider_data_retention_mode,
         prompt_bundle_version, prompt_bundle_hash, schema_bundle_version, schema_bundle_hash,
         pipeline_version, pipeline_hash, model_policy_hash, max_usd, max_input_tokens,
         max_output_tokens, max_wall_clock_seconds, correlation_id
       ) VALUES ($1, $2, $3, $4, 'fresh', 'requested', $5, 'openai', 'fake-model',
         'fake-model-v1', 'zero_retention', 'v1', $6, 'v1', $7, 'v1', $8, $9, 3, 300000, 30000,
         1800, $10)`,
      [
        id,
        seed.organizationId,
        seed.projectId,
        seed.userId,
        providerPolicyId,
        HASH_A,
        HASH_B,
        HASH_C,
        HASH_D,
        randomUUID(),
      ],
    );
    return id;
  }

  it("runs a single confirmed requirement through freeze -> ... -> finalize and produces exactly 18 coverage rows plus a citation-backed confirmed requirement", async () => {
    const seed = await seedOrgProjectUser();
    await seedEligibleSource(seed);
    const providerPolicyId = await seedApprovedProviderPolicy(seed);
    const runId = await seedRun(seed, providerPolicyId);

    const runtime: AnalysisRuntime = {
      repository,
      providerRegistry: createFakeAiProviderRegistry(),
      featureFlags: { referenceFeatureExtractionEnabled: false },
      now: () => NOW,
    };
    const aiAnalysisQueue = createRecordingAiAnalysisQueue();
    const citationVerificationQueue = createRecordingCitationVerificationQueue();

    // 1. freeze_snapshot -> batch_planning
    const freezeResult = await handleFreezeSnapshot(runtime, aiAnalysisQueue, {
      kind: "freeze-snapshot",
      idempotencyKey: "freeze-1",
      correlationId: runId,
      organizationId: seed.organizationId,
      projectId: seed.projectId,
      runId,
      actorId: seed.userId,
      submittedAt: NOW.toISOString(),
    });

    await handlePlanBatches(runtime, aiAnalysisQueue, {
      kind: "plan-batches",
      idempotencyKey: "plan-1",
      correlationId: runId,
      organizationId: seed.organizationId,
      projectId: seed.projectId,
      runId,
      snapshotId: freezeResult.snapshotId,
      submittedAt: NOW.toISOString(),
    });

    const stages = await repository.listStagesByRun(runId);
    const confirmedStage = stages.find((stage) => stage.kind === "confirmed_extraction");
    const citationStage = stages.find((stage) => stage.kind === "citation_verification");
    const normalizationStage = stages.find((stage) => stage.kind === "normalization_deduplication");
    const conflictStage = stages.find((stage) => stage.kind === "conflict_detection");
    const coverageStage = stages.find((stage) => stage.kind === "coverage_analysis");
    const deliveryStage = stages.find((stage) => stage.kind === "delivery_item_extraction");
    const questionStage = stages.find((stage) => stage.kind === "question_generation");
    const finalizeStage = stages.find((stage) => stage.kind === "finalize_review_package");
    if (
      !confirmedStage ||
      !citationStage ||
      !normalizationStage ||
      !conflictStage ||
      !coverageStage ||
      !deliveryStage ||
      !questionStage ||
      !finalizeStage
    ) {
      throw new Error("expected every module-03 pipeline stage row to exist after planning");
    }

    const batches = await repository.listBatchesByStage(confirmedStage.id);
    const [batch] = batches;
    if (!batch) {
      throw new Error("expected exactly one confirmed_extraction batch");
    }
    const chunks = await repository.listBatchChunkContents(batch.id);
    const [chunk] = chunks;
    if (!chunk) {
      throw new Error("expected the planned batch to carry the seeded chunk");
    }

    // 2. confirmed_extraction (fake executor call -- never a real network call)
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
                  quote: "The system shall authenticate every user",
                },
              ],
            },
          ],
        },
        usage: { inputTokens: 50, outputTokens: 20 },
      },
    ]);
    await handleRunBatch(
      { ...runtime, executor: extractionExecutor },
      aiAnalysisQueue,
      citationVerificationQueue,
      {
        kind: "run-batch",
        idempotencyKey: "run-batch-1",
        correlationId: runId,
        organizationId: seed.organizationId,
        projectId: seed.projectId,
        runId,
        stageId: confirmedStage.id,
        batchId: batch.id,
        submittedAt: NOW.toISOString(),
      },
    );

    // 3. citation_verification (deterministic, no model call)
    await handleCitationVerificationStage(runtime, aiAnalysisQueue, {
      kind: "run-stage",
      idempotencyKey: "citation-1",
      correlationId: runId,
      organizationId: seed.organizationId,
      projectId: seed.projectId,
      runId,
      stageId: citationStage.id,
      stageKind: "citation_verification",
      submittedAt: NOW.toISOString(),
    });

    const requirementsAfterCitation = await repository.listRequirementsByRun(runId);
    expect(requirementsAfterCitation).toHaveLength(1);
    expect(requirementsAfterCitation[0]?.epistemicStatus).toBe("confirmed");
    const requirementCitations = await repository.listCitationsByRequirement(
      requirementsAfterCitation[0]!.id,
    );
    expect(requirementCitations).toHaveLength(1);
    expect(requirementCitations[0]?.verificationStatus).toBe("verified_exact");

    // 4. normalization_deduplication (deterministic, no model call)
    await handleNormalizationDeduplicationStage(runtime, aiAnalysisQueue, {
      kind: "run-stage",
      idempotencyKey: "normalize-1",
      correlationId: runId,
      organizationId: seed.organizationId,
      projectId: seed.projectId,
      runId,
      stageId: normalizationStage.id,
      stageKind: "normalization_deduplication",
      submittedAt: NOW.toISOString(),
    });

    // 5. conflict_detection (fake executor: no conflicts)
    const conflictExecutor = createFakeStructuredExecutor([
      { output: { conflicts: [] }, usage: { inputTokens: 10, outputTokens: 5 } },
    ]);
    await handleConflictDetectionStage(
      { ...runtime, executor: conflictExecutor },
      aiAnalysisQueue,
      {
        kind: "run-stage",
        idempotencyKey: "conflict-1",
        correlationId: runId,
        organizationId: seed.organizationId,
        projectId: seed.projectId,
        runId,
        stageId: conflictStage.id,
        stageKind: "conflict_detection",
        submittedAt: NOW.toISOString(),
      },
    );

    // 6. coverage_analysis (fake executor: full 18-row output, one category addressed)
    const coverageOutput: CoverageAnalysisOutput = {
      categories: coverageCategoryDescriptors.map((descriptor, index) => ({
        categoryKey: descriptor.key,
        status: index === 0 ? "addressed" : "absent",
        rationale: index === 0 ? "Covered by an authenticated requirement." : null,
        evidenceState: index === 0 ? "verified_citation" : "none_found",
        requirementIds: index === 0 ? ["req-auth-1"] : [],
      })),
    };
    const coverageExecutor = createFakeStructuredExecutor([
      { output: coverageOutput, usage: { inputTokens: 30, outputTokens: 15 } },
    ]);
    await handleCoverageAnalysisStage({ ...runtime, executor: coverageExecutor }, aiAnalysisQueue, {
      kind: "run-stage",
      idempotencyKey: "coverage-1",
      correlationId: runId,
      organizationId: seed.organizationId,
      projectId: seed.projectId,
      runId,
      stageId: coverageStage.id,
      stageKind: "coverage_analysis",
      submittedAt: NOW.toISOString(),
    });

    const coverageEntries = await repository.listCoverageEntriesByRun(runId);
    expect(coverageEntries).toHaveLength(coverageCategoryDescriptors.length);

    // 7. delivery_item_extraction (fake executor: no items this run)
    const deliveryExecutor = createFakeStructuredExecutor([
      { output: { items: [] }, usage: { inputTokens: 5, outputTokens: 2 } },
    ]);
    await handleDeliveryItemExtractionStage(
      { ...runtime, executor: deliveryExecutor },
      aiAnalysisQueue,
      {
        kind: "run-stage",
        idempotencyKey: "delivery-1",
        correlationId: runId,
        organizationId: seed.organizationId,
        projectId: seed.projectId,
        runId,
        stageId: deliveryStage.id,
        stageKind: "delivery_item_extraction",
        submittedAt: NOW.toISOString(),
      },
    );

    // 8. question_generation (fake executor: one clarification question per absent coverage
    // category -- the DB's `requirement_analysis_run_completion_guard` trigger rejects finalize
    // when a partial/absent coverage row has no linked clarification question).
    const questionExecutor = createFakeStructuredExecutor([
      {
        output: {
          questions: coverageCategoryDescriptors.slice(1).map((descriptor) => ({
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
    await handleQuestionGenerationStage(
      { ...runtime, executor: questionExecutor },
      aiAnalysisQueue,
      {
        kind: "run-stage",
        idempotencyKey: "question-1",
        correlationId: runId,
        organizationId: seed.organizationId,
        projectId: seed.projectId,
        runId,
        stageId: questionStage.id,
        stageKind: "question_generation",
        submittedAt: NOW.toISOString(),
      },
    );

    // 9. finalize_review_package -- every DB guard must now pass.
    await handleFinalizeRun(runtime, aiAnalysisQueue, {
      kind: "finalize-run",
      idempotencyKey: "finalize-1",
      correlationId: runId,
      organizationId: seed.organizationId,
      projectId: seed.projectId,
      runId,
      submittedAt: NOW.toISOString(),
    });

    const finalRun = await repository.getRun(runId);
    expect(finalRun?.status).toBe("completed");
    expect(finalRun?.artifactCounts).toMatchObject({
      requirementCount: 1,
      coverageEntryCount: coverageCategoryDescriptors.length,
    });

    const finalStage = await repository.getStage(finalizeStage.id);
    expect(finalStage?.status).toBe("completed");
  });
});
