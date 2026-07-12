import { randomUUID } from "node:crypto";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Pool, PoolClient } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  coverageCategoryKeyValues,
  createDatabaseClient,
  type DatabaseClient,
  migrateDatabase,
} from "./index.js";

const POSTGRES_IMAGE = "postgres:17-alpine";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);

/** Every insert helper accepts a plain Pool for one-statement-per-implicit-transaction calls, or a
 * checked-out PoolClient inside an explicit BEGIN/COMMIT block (see `withTransaction`) so tests can
 * exercise the DEFERRABLE INITIALLY DEFERRED constraint triggers, which only evaluate at commit. */
type Queryable = Pool | PoolClient;

type Seed = { organizationId: string; projectId: string; userId: string };

async function withTransaction<T>(
  client: DatabaseClient,
  fn: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const tx = await client.pool.connect();
  try {
    await tx.query("BEGIN");
    const result = await fn(tx);
    await tx.query("COMMIT");
    return result;
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}

async function seedOrgProjectUser(db: Queryable, label = "RA Guard"): Promise<Seed> {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();

  await db.query(`INSERT INTO organization (id, name) VALUES ($1, $2)`, [
    organizationId,
    `${label} Org ${organizationId}`,
  ]);
  await db.query(`INSERT INTO "user" (id, organization_id, name, email) VALUES ($1, $2, $3, $4)`, [
    userId,
    organizationId,
    `${label} User`,
    `${label.toLowerCase().replace(/\s+/gu, "-")}-${userId}@atlashq.test`,
  ]);
  await db.query(
    `INSERT INTO project (id, organization_id, name, type, owner_id) VALUES ($1, $2, $3, $4, $5)`,
    [projectId, organizationId, `${label} Project ${projectId}`, "internal", userId],
  );

  return { organizationId, projectId, userId };
}

async function insertSourceDocument(db: Queryable, seed: Seed): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO source_document (
       id, organization_id, project_id, lineage_id, version_number, source_type,
       document_format, title, content_hash, created_by
     ) VALUES ($1, $2, $3, $1, 1, 'document', 'pdf', 'RA Guard Document', $4, $5)`,
    [id, seed.organizationId, seed.projectId, HASH_A, seed.userId],
  );
  return id;
}

async function insertSourceDocumentFile(
  db: Queryable,
  sourceDocumentId: string,
  ordinal = 0,
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO source_document_file (
       id, source_document_id, ordinal, role, original_file_name, download_file_name,
       format, declared_mime_type, byte_size, sha256, object_key, object_version_id
     ) VALUES ($1, $2, $3, 'primary', 'original.pdf', 'download.pdf', 'pdf', 'application/pdf', 1024, $4, $5, 'v1')`,
    [id, sourceDocumentId, ordinal, HASH_B, `ra-guard/${sourceDocumentId}/${ordinal}.pdf`],
  );
  return id;
}

async function insertSourceExtraction(db: Queryable, sourceDocumentId: string): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO source_extraction (id, source_document_id, extraction_version, status, chunker_version)
     VALUES ($1, $2, 1, 'succeeded', 'chunker-v1')`,
    [id, sourceDocumentId],
  );
  return id;
}

async function insertSourceChunk(
  db: Queryable,
  seed: Seed,
  sourceDocumentId: string,
  sourceExtractionId: string,
  sequence = 0,
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO source_chunk (
       id, organization_id, project_id, source_document_id, source_extraction_id,
       sequence, content, character_count, content_hash
     ) VALUES ($1, $2, $3, $4, $5, $6, 'chunk content', 13, $7)`,
    [
      id,
      seed.organizationId,
      seed.projectId,
      sourceDocumentId,
      sourceExtractionId,
      sequence,
      HASH_C,
    ],
  );
  return id;
}

async function insertProviderPolicy(
  db: Queryable,
  seed: Seed,
  overrides: Partial<{ status: string; approved: boolean }> = {},
): Promise<string> {
  const id = randomUUID();
  const status = overrides.status ?? "approved";
  const approved = overrides.approved ?? status === "approved";
  await db.query(
    `INSERT INTO organization_ai_provider_policy (
       id, organization_id, provider, policy_name, model_alias, resolved_model_id,
       data_retention_mode, status, approved_for_requirement_analysis, approved_by,
       approved_at, approval_note
     ) VALUES ($1, $2, 'openai', $3, 'balanced', 'gpt-guard-test', 'zero_retention', $4, $5,
       $6, now(), 'approved for guard tests')`,
    [
      id,
      seed.organizationId,
      `RA Guard Policy ${id}`,
      status,
      approved,
      approved ? seed.userId : null,
    ],
  );
  return id;
}

async function insertAnalysisRun(
  db: Queryable,
  seed: Seed,
  providerPolicyId: string,
  overrides: Partial<{ mode: string; status: string }> = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO requirement_analysis_run (
       id, organization_id, project_id, requested_by, mode, status, provider_policy_id,
       provider, model_alias, resolved_model_id, provider_data_retention_mode,
       prompt_bundle_version, prompt_bundle_hash, schema_bundle_version, schema_bundle_hash,
       pipeline_version, pipeline_hash, model_policy_hash, max_usd, max_input_tokens,
       max_output_tokens, max_wall_clock_seconds, correlation_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'openai', 'balanced', 'gpt-guard-test',
       'zero_retention', 'v1', $8, 'v1', $9, 'v1', $10, $11, 3, 300000, 30000, 1800, $12)`,
    [
      id,
      seed.organizationId,
      seed.projectId,
      seed.userId,
      overrides.mode ?? "fresh",
      overrides.status ?? "requested",
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

async function insertSnapshot(db: Queryable, seed: Seed, runId: string): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO requirement_analysis_snapshot (
       id, organization_id, project_id, run_id, snapshot_hash, source_count, chunk_count,
       total_character_count, eligibility_rules_version
     ) VALUES ($1, $2, $3, $4, $5, 1, 1, 13, 'v1')`,
    [id, seed.organizationId, seed.projectId, runId, HASH_A],
  );
  return id;
}

async function insertSnapshotSource(
  db: Queryable,
  seed: Seed,
  snapshotId: string,
  sourceDocumentId: string,
  sourceExtractionId: string,
  overrides: Partial<{ organizationId: string; projectId: string; sourceOrder: number }> = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO requirement_analysis_snapshot_source (
       id, snapshot_id, organization_id, project_id, source_document_id, source_lineage_id,
       source_version_number, source_content_hash, source_extraction_id,
       source_extraction_version, chunker_version, chunk_manifest_hash, chunk_sequence_start,
       chunk_sequence_end, chunk_count, character_count, source_order
     ) VALUES ($1, $2, $3, $4, $5, $5, 1, $6, $7, 1, 'chunker-v1', $8, 0, 0, 1, 13, $9)`,
    [
      id,
      snapshotId,
      overrides.organizationId ?? seed.organizationId,
      overrides.projectId ?? seed.projectId,
      sourceDocumentId,
      HASH_A,
      sourceExtractionId,
      HASH_B,
      overrides.sourceOrder ?? 0,
    ],
  );
  return id;
}

async function insertSnapshotFile(
  db: Queryable,
  seed: Seed,
  snapshotSourceId: string,
  sourceDocumentFileId: string,
  fileOrdinal = 0,
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO requirement_analysis_snapshot_file (
       id, snapshot_source_id, organization_id, project_id, source_document_file_id,
       file_ordinal, file_sha256, object_version_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'v1')`,
    [
      id,
      snapshotSourceId,
      seed.organizationId,
      seed.projectId,
      sourceDocumentFileId,
      fileOrdinal,
      HASH_B,
    ],
  );
  return id;
}

async function insertSnapshotChunk(
  db: Queryable,
  seed: Seed,
  snapshotSourceId: string,
  sourceChunkId: string,
  chunkSequence = 0,
  overrides: Partial<{ organizationId: string; projectId: string }> = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO requirement_analysis_snapshot_chunk (
       id, snapshot_source_id, organization_id, project_id, source_chunk_id, chunk_sequence,
       chunk_order, chunk_content_hash, locator_hash, character_count
     ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, 13)`,
    [
      id,
      snapshotSourceId,
      overrides.organizationId ?? seed.organizationId,
      overrides.projectId ?? seed.projectId,
      sourceChunkId,
      chunkSequence,
      HASH_C,
      HASH_D,
    ],
  );
  return id;
}

async function insertStage(
  db: Queryable,
  seed: Seed,
  runId: string,
  kind: string,
  overrides: Partial<{ organizationId: string; projectId: string }> = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO requirement_analysis_stage (
       id, run_id, organization_id, project_id, kind, idempotency_key
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      runId,
      overrides.organizationId ?? seed.organizationId,
      overrides.projectId ?? seed.projectId,
      kind,
      `${runId}:${kind}:${id}`,
    ],
  );
  return id;
}

async function insertStageDependency(
  db: Queryable,
  stageId: string,
  dependsOnStageId: string,
  overrides: { runId: string; organizationId: string; projectId: string },
): Promise<void> {
  await db.query(
    `INSERT INTO requirement_analysis_stage_dependency (
       stage_id, depends_on_stage_id, run_id, organization_id, project_id
     ) VALUES ($1, $2, $3, $4, $5)`,
    [stageId, dependsOnStageId, overrides.runId, overrides.organizationId, overrides.projectId],
  );
}

async function insertBatch(
  db: Queryable,
  seed: Seed,
  stageId: string,
  runId: string,
  overrides: Partial<{ organizationId: string; projectId: string; batchOrder: number }> = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO requirement_analysis_batch (
       id, stage_id, run_id, organization_id, project_id, batch_order,
       source_chunk_start_sequence, source_chunk_end_sequence, input_token_estimate,
       max_output_tokens
     ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 100, 1000)`,
    [
      id,
      stageId,
      runId,
      overrides.organizationId ?? seed.organizationId,
      overrides.projectId ?? seed.projectId,
      overrides.batchOrder ?? 0,
    ],
  );
  return id;
}

async function insertBatchChunk(
  db: Queryable,
  seed: Seed,
  batchId: string,
  snapshotChunkId: string,
  chunkOrder = 0,
  overrides: Partial<{ organizationId: string; projectId: string }> = {},
): Promise<void> {
  await db.query(
    `INSERT INTO requirement_analysis_batch_chunk (
       batch_id, snapshot_chunk_id, chunk_order, organization_id, project_id
     ) VALUES ($1, $2, $3, $4, $5)`,
    [
      batchId,
      snapshotChunkId,
      chunkOrder,
      overrides.organizationId ?? seed.organizationId,
      overrides.projectId ?? seed.projectId,
    ],
  );
}

async function insertRequirement(
  db: Queryable,
  seed: Seed,
  runId: string,
  overrides: Partial<{
    epistemicStatus: string;
    inferenceBasis: string | null;
    confidenceBand: string | null;
  }> = {},
): Promise<string> {
  const id = randomUUID();
  const epistemicStatus = overrides.epistemicStatus ?? "assumed";
  const inferenceBasis =
    overrides.inferenceBasis !== undefined
      ? overrides.inferenceBasis
      : epistemicStatus === "assumed"
        ? "pattern inferred from adjacent clauses"
        : null;
  await db.query(
    `INSERT INTO requirement (
       id, organization_id, project_id, analysis_run_id, stable_key, title,
       requirement_type, epistemic_status, confidence_band, inference_basis, origin
     ) VALUES ($1, $2, $3, $4, $5, 'Guard requirement', 'functional', $6, $7, $8, 'source')`,
    [
      id,
      seed.organizationId,
      seed.projectId,
      runId,
      `stable-${id}`,
      epistemicStatus,
      overrides.confidenceBand ?? null,
      inferenceBasis,
    ],
  );
  return id;
}

async function insertCitation(
  db: Queryable,
  seed: Seed,
  runId: string,
  sourceDocumentId: string,
  sourceExtractionId: string,
  sourceChunkId: string,
  target: { requirementId?: string; coverageMatrixEntryId?: string; deliveryItemId?: string },
  overrides: Partial<{ verificationStatus: string; quoteHash: string }> = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO citation (
       id, organization_id, project_id, analysis_run_id, requirement_id,
       coverage_matrix_entry_id, delivery_item_id, source_document_id,
       source_version_number, source_content_hash, source_extraction_id,
       source_extraction_version, source_chunk_id, source_chunk_sequence, chunk_content_hash,
       quote_text_original, quote_text_normalized, quote_hash, match_start_offset,
       match_end_offset, normalization_mode, verification_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, 1, $11, 0, $12, 'exact quote',
       'exact quote', $13, 0, 11, 'none', $14)`,
    [
      id,
      seed.organizationId,
      seed.projectId,
      runId,
      target.requirementId ?? null,
      target.coverageMatrixEntryId ?? null,
      target.deliveryItemId ?? null,
      sourceDocumentId,
      HASH_A,
      sourceExtractionId,
      sourceChunkId,
      HASH_C,
      overrides.quoteHash ?? randomUUID().replace(/-/gu, "").padEnd(64, "0"),
      overrides.verificationStatus ?? "verified_exact",
    ],
  );
  return id;
}

async function insertCoverageEntry(
  db: Queryable,
  seed: Seed,
  runId: string,
  categoryKey: string,
  categoryOrder: number,
  overrides: Partial<{
    status: string;
    evidenceState: string;
    questionDeliveryItemId: string | null;
  }> = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO coverage_matrix_entry (
       id, organization_id, project_id, analysis_run_id, category_key, category_label,
       category_order, status, evidence_state, question_delivery_item_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      seed.organizationId,
      seed.projectId,
      runId,
      categoryKey,
      categoryKey,
      categoryOrder,
      overrides.status ?? "partial",
      overrides.evidenceState ?? "none_found",
      overrides.questionDeliveryItemId ?? null,
    ],
  );
  return id;
}

async function insertDeliveryItem(
  db: Queryable,
  seed: Seed,
  runId: string,
  itemType = "question",
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO delivery_item (
       id, organization_id, project_id, analysis_run_id, item_type, title, epistemic_status
     ) VALUES ($1, $2, $3, $4, $5, 'Guard delivery item', 'unknown')`,
    [id, seed.organizationId, seed.projectId, runId, itemType],
  );
  return id;
}

/** Builds one valid run through freeze_snapshot/batch_planning with a two-file, two-chunk snapshot. */
async function buildBaselinePipeline(db: Queryable, seed: Seed) {
  const providerPolicyId = await insertProviderPolicy(db, seed);
  const runId = await insertAnalysisRun(db, seed, providerPolicyId);

  const sourceDocumentId = await insertSourceDocument(db, seed);
  const sourceDocumentFileId1 = await insertSourceDocumentFile(db, sourceDocumentId, 0);
  const sourceDocumentFileId2 = await insertSourceDocumentFile(db, sourceDocumentId, 1);
  const sourceExtractionId = await insertSourceExtraction(db, sourceDocumentId);
  const sourceChunkId1 = await insertSourceChunk(db, seed, sourceDocumentId, sourceExtractionId, 0);
  const sourceChunkId2 = await insertSourceChunk(db, seed, sourceDocumentId, sourceExtractionId, 1);

  const snapshotId = await insertSnapshot(db, seed, runId);
  const snapshotSourceId = await insertSnapshotSource(
    db,
    seed,
    snapshotId,
    sourceDocumentId,
    sourceExtractionId,
  );
  const snapshotFileId1 = await insertSnapshotFile(
    db,
    seed,
    snapshotSourceId,
    sourceDocumentFileId1,
    0,
  );
  const snapshotFileId2 = await insertSnapshotFile(
    db,
    seed,
    snapshotSourceId,
    sourceDocumentFileId2,
    1,
  );
  const snapshotChunkId1 = await insertSnapshotChunk(db, seed, snapshotSourceId, sourceChunkId1, 0);
  const snapshotChunkId2 = await insertSnapshotChunk(db, seed, snapshotSourceId, sourceChunkId2, 1);

  const freezeStageId = await insertStage(db, seed, runId, "freeze_snapshot");
  const batchStageId = await insertStage(db, seed, runId, "batch_planning");
  await insertStageDependency(db, batchStageId, freezeStageId, {
    runId,
    organizationId: seed.organizationId,
    projectId: seed.projectId,
  });

  const batchId = await insertBatch(db, seed, batchStageId, runId);
  await insertBatchChunk(db, seed, batchId, snapshotChunkId1, 0);
  await insertBatchChunk(db, seed, batchId, snapshotChunkId2, 1);

  return {
    providerPolicyId,
    runId,
    sourceDocumentId,
    sourceDocumentFileId1,
    sourceDocumentFileId2,
    sourceExtractionId,
    sourceChunkId1,
    sourceChunkId2,
    snapshotId,
    snapshotSourceId,
    snapshotFileId1,
    snapshotFileId2,
    snapshotChunkId1,
    snapshotChunkId2,
    freezeStageId,
    batchStageId,
    batchId,
  };
}

async function expectGuardFailure(
  action: () => Promise<unknown>,
  messagePattern: RegExp,
  code?: string,
): Promise<void> {
  let error: (Error & { code?: string }) | undefined;
  try {
    await action();
  } catch (failure) {
    error = failure as Error & { code?: string };
  }
  expect(error).toBeInstanceOf(Error);
  if (code) expect(error?.code).toBe(code);
  expect(error?.message).toMatch(messagePattern);
}

describe("requirement analysis guards", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let client: DatabaseClient | undefined;
  let seed: Seed | undefined;

  beforeEach(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase("atlashq_db_test")
      .start();
    client = createDatabaseClient({ connectionString: container.getConnectionUri() });
    await migrateDatabase(client);
    seed = await seedOrgProjectUser(client.pool);
  }, 120_000);

  afterEach(async () => {
    await client?.close();
    client = undefined;
    await container?.stop();
    container = undefined;
    seed = undefined;
  });

  it("replays every migration and builds a full multi-file snapshot pipeline through a completed run", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const s = seed;
    const pipeline = await buildBaselinePipeline(client.pool, seed);

    const fileCount = await client.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM requirement_analysis_snapshot_file WHERE snapshot_source_id = $1`,
      [pipeline.snapshotSourceId],
    );
    expect(fileCount.rows[0]?.count).toBe(2);
    const chunkCount = await client.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM requirement_analysis_snapshot_chunk WHERE snapshot_source_id = $1`,
      [pipeline.snapshotSourceId],
    );
    expect(chunkCount.rows[0]?.count).toBe(2);

    // A confirmed requirement and its verified_exact citation must be inserted atomically: the
    // deferred constraint trigger only checks at commit, so both inserts share one transaction.
    await withTransaction(client, async (tx) => {
      const requirementId = await insertRequirement(tx, s, pipeline.runId, {
        epistemicStatus: "confirmed",
        confidenceBand: "high",
        inferenceBasis: null,
      });
      await insertCitation(
        tx,
        s,
        pipeline.runId,
        pipeline.sourceDocumentId,
        pipeline.sourceExtractionId,
        pipeline.sourceChunkId1,
        { requirementId },
      );
    });

    // Populate all 18 fixed rubric categories: 17 addressed-with-citation, 1 partial-with-question.
    const deliveryItemId = await insertDeliveryItem(client.pool, seed, pipeline.runId, "question");
    for (const [index, categoryKey] of coverageCategoryKeyValues.entries()) {
      if (index === coverageCategoryKeyValues.length - 1) {
        await insertCoverageEntry(client.pool, seed, pipeline.runId, categoryKey, index + 1, {
          status: "partial",
          evidenceState: "none_found",
          questionDeliveryItemId: deliveryItemId,
        });
        continue;
      }
      await withTransaction(client, async (tx) => {
        const coverageId = await insertCoverageEntry(
          tx,
          s,
          pipeline.runId,
          categoryKey,
          index + 1,
          {
            status: "addressed",
            evidenceState: "verified_citation",
          },
        );
        await insertCitation(
          tx,
          s,
          pipeline.runId,
          pipeline.sourceDocumentId,
          pipeline.sourceExtractionId,
          pipeline.sourceChunkId2,
          { coverageMatrixEntryId: coverageId },
          { quoteHash: `${index}`.padStart(64, "0") },
        );
      });
    }

    await expect(
      client.pool.query(`UPDATE requirement_analysis_run SET status = 'completed' WHERE id = $1`, [
        pipeline.runId,
      ]),
    ).resolves.not.toThrow();

    const run = await client.pool.query<{ status: string }>(
      `SELECT status FROM requirement_analysis_run WHERE id = $1`,
      [pipeline.runId],
    );
    expect(run.rows[0]?.status).toBe("completed");
  }, 120_000);

  it("rejects a stage_dependency spanning two different runs", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const providerPolicyId = await insertProviderPolicy(client.pool, seed);
    const runId1 = await insertAnalysisRun(client.pool, seed, providerPolicyId);
    // A second run for the same project must be non-active to respect the one-active-run-per-
    // project partial unique index; this test only exercises cross-run scope, not run lifecycle.
    const runId2 = await insertAnalysisRun(client.pool, seed, providerPolicyId, {
      status: "canceled",
    });
    const stage1 = await insertStage(client.pool, seed, runId1, "freeze_snapshot");
    const stage2 = await insertStage(client.pool, seed, runId2, "batch_planning");

    await expectGuardFailure(
      () =>
        insertStageDependency(c.pool, stage2, stage1, {
          runId: runId2,
          organizationId: s.organizationId,
          projectId: s.projectId,
        }),
      /must share run/i,
      "23001",
    );
  }, 120_000);

  it("rejects a batch scoped to a different run than its stage", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const pipeline = await buildBaselinePipeline(client.pool, seed);
    const otherRunId = await insertAnalysisRun(client.pool, seed, pipeline.providerPolicyId, {
      status: "canceled",
    });

    await expectGuardFailure(
      () => insertBatch(c.pool, s, pipeline.batchStageId, otherRunId),
      /must share run\/organization\/project with stage/i,
      "23001",
    );
  }, 120_000);

  it("allows a replay run's batch to reuse an earlier run's frozen snapshot chunk, but rejects cross-project batch_chunk", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const pipeline = await buildBaselinePipeline(client.pool, seed);

    // A "replay" run legitimately reuses the exact same snapshot/chunks from the original run; the
    // original run must be non-active first to respect the one-active-run-per-project index.
    await client.pool.query(
      `UPDATE requirement_analysis_run SET status = 'canceled' WHERE id = $1`,
      [pipeline.runId],
    );
    const replayRunId = await insertAnalysisRun(client.pool, seed, pipeline.providerPolicyId, {
      mode: "fresh",
    });
    const replayStageId = await insertStage(client.pool, seed, replayRunId, "batch_planning");
    const replayBatchId = await insertBatch(client.pool, seed, replayStageId, replayRunId);

    await expect(
      insertBatchChunk(client.pool, seed, replayBatchId, pipeline.snapshotChunkId1, 0),
    ).resolves.not.toThrow();

    const otherSeed = await seedOrgProjectUser(client.pool, "RA Guard Other");
    await expectGuardFailure(
      () =>
        insertBatchChunk(c.pool, s, replayBatchId, pipeline.snapshotChunkId2, 1, {
          organizationId: otherSeed.organizationId,
          projectId: otherSeed.projectId,
        }),
      /requirement_analysis_batch_chunk organization\/project must match (batch|snapshot chunk)/i,
      "23001",
    );
  }, 120_000);

  it("rejects a snapshot_source whose source_extraction belongs to a different source_document", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const providerPolicyId = await insertProviderPolicy(client.pool, seed);
    const runId = await insertAnalysisRun(client.pool, seed, providerPolicyId);
    const snapshotId = await insertSnapshot(client.pool, seed, runId);

    const sourceDocumentId1 = await insertSourceDocument(client.pool, seed);
    const sourceDocumentId2 = await insertSourceDocument(client.pool, seed);
    const mismatchedExtractionId = await insertSourceExtraction(client.pool, sourceDocumentId2);

    await expectGuardFailure(
      () => insertSnapshotSource(c.pool, s, snapshotId, sourceDocumentId1, mismatchedExtractionId),
      /source_extraction .* must belong to source_document/i,
      "23001",
    );
  }, 120_000);

  it("rejects a snapshot_chunk whose source_chunk belongs to a different snapshot source's document", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const pipeline = await buildBaselinePipeline(client.pool, seed);

    const otherDocumentId = await insertSourceDocument(client.pool, seed);
    const otherExtractionId = await insertSourceExtraction(client.pool, otherDocumentId);
    const otherChunkId = await insertSourceChunk(
      client.pool,
      seed,
      otherDocumentId,
      otherExtractionId,
      0,
    );

    await expectGuardFailure(
      () => insertSnapshotChunk(c.pool, s, pipeline.snapshotSourceId, otherChunkId, 5),
      /source_chunk .* must belong to snapshot source/i,
      "23001",
    );
  }, 120_000);

  it("rejects a confirmed requirement with no citation at commit but allows insert+citation in one transaction", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const pipeline = await buildBaselinePipeline(client.pool, seed);

    await expectGuardFailure(
      () =>
        insertRequirement(c.pool, s, pipeline.runId, {
          epistemicStatus: "confirmed",
          confidenceBand: "high",
          inferenceBasis: null,
        }),
      /confirmed but has no same-tenant\/project verified_exact citation/i,
      "23001",
    );

    await expect(
      withTransaction(client, async (tx) => {
        const requirementId = await insertRequirement(tx, s, pipeline.runId, {
          epistemicStatus: "confirmed",
          confidenceBand: "high",
          inferenceBasis: null,
        });
        await insertCitation(
          tx,
          s,
          pipeline.runId,
          pipeline.sourceDocumentId,
          pipeline.sourceExtractionId,
          pipeline.sourceChunkId1,
          { requirementId },
        );
      }),
    ).resolves.not.toThrow();
  }, 120_000);

  it("rejects an addressed coverage_matrix_entry with no citation at commit", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const pipeline = await buildBaselinePipeline(client.pool, seed);

    await expectGuardFailure(
      () =>
        insertCoverageEntry(
          c.pool,
          s,
          pipeline.runId,
          coverageCategoryKeyValues[0] ?? "auth_identity",
          1,
          {
            status: "addressed",
            evidenceState: "verified_citation",
          },
        ),
      /addressed but has no same-tenant\/project verified_exact citation/i,
      "23001",
    );
  }, 120_000);

  it("enforces exactly 18 coverage rows and partial/absent question-linkage before a run can complete", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const pipeline = await buildBaselinePipeline(client.pool, seed);

    // Only a handful of the 18 required categories exist.
    await insertCoverageEntry(
      client.pool,
      seed,
      pipeline.runId,
      coverageCategoryKeyValues[0] ?? "auth_identity",
      1,
    );
    await expectGuardFailure(
      () =>
        c.pool.query(`UPDATE requirement_analysis_run SET status = 'completed' WHERE id = $1`, [
          pipeline.runId,
        ]),
      /expected 18 coverage_matrix_entry rows/i,
      "23001",
    );

    // Fill out all 18, but leave the last one partial without a question link.
    for (const [index, categoryKey] of coverageCategoryKeyValues.slice(1).entries()) {
      const order = index + 2;
      if (order === coverageCategoryKeyValues.length) {
        await insertCoverageEntry(client.pool, seed, pipeline.runId, categoryKey, order, {
          status: "partial",
          evidenceState: "none_found",
        });
        continue;
      }
      await withTransaction(client, async (tx) => {
        const coverageId = await insertCoverageEntry(tx, s, pipeline.runId, categoryKey, order, {
          status: "addressed",
          evidenceState: "verified_citation",
        });
        await insertCitation(
          tx,
          s,
          pipeline.runId,
          pipeline.sourceDocumentId,
          pipeline.sourceExtractionId,
          pipeline.sourceChunkId2,
          { coverageMatrixEntryId: coverageId },
          { quoteHash: `${order}`.padStart(64, "0") },
        );
      });
    }

    await expectGuardFailure(
      () =>
        c.pool.query(`UPDATE requirement_analysis_run SET status = 'completed' WHERE id = $1`, [
          pipeline.runId,
        ]),
      /missing a clarification question/i,
      "23001",
    );
  }, 120_000);

  it("freezes coverage_matrix_entry rows once the run reaches a terminal status", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const pipeline = await buildBaselinePipeline(client.pool, seed);
    const coverageId = await insertCoverageEntry(
      client.pool,
      seed,
      pipeline.runId,
      coverageCategoryKeyValues[0] ?? "auth_identity",
      1,
      {
        status: "partial",
        evidenceState: "none_found",
      },
    );

    await client.pool.query(
      `UPDATE requirement_analysis_run
       SET status = 'failed', failure_code = 'x', failure_retryable = false
       WHERE id = $1`,
      [pipeline.runId],
    );

    await expectGuardFailure(
      () =>
        c.pool.query(`UPDATE coverage_matrix_entry SET rationale = 'late edit' WHERE id = $1`, [
          coverageId,
        ]),
      /append-only once run .* is terminal/i,
      "23001",
    );
  }, 120_000);

  it("rejects hard DELETE/TRUNCATE on requirement, citation, coverage_matrix_entry, delivery_item, and snapshot rows", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const pipeline = await buildBaselinePipeline(client.pool, seed);
    const requirementId = await insertRequirement(client.pool, seed, pipeline.runId);
    const citationId = await insertCitation(
      client.pool,
      seed,
      pipeline.runId,
      pipeline.sourceDocumentId,
      pipeline.sourceExtractionId,
      pipeline.sourceChunkId1,
      { requirementId },
    );
    const coverageId = await insertCoverageEntry(
      client.pool,
      seed,
      pipeline.runId,
      coverageCategoryKeyValues[0] ?? "auth_identity",
      1,
    );
    const deliveryItemId = await insertDeliveryItem(client.pool, seed, pipeline.runId);

    await expectGuardFailure(
      () => c.pool.query(`DELETE FROM requirement WHERE id = $1`, [requirementId]),
      /append-only/i,
      "23001",
    );
    await expectGuardFailure(
      () => c.pool.query(`DELETE FROM citation WHERE id = $1`, [citationId]),
      /append-only/i,
      "23001",
    );
    await expectGuardFailure(
      () => c.pool.query(`DELETE FROM coverage_matrix_entry WHERE id = $1`, [coverageId]),
      /append-only/i,
      "23001",
    );
    await expectGuardFailure(
      () => c.pool.query(`DELETE FROM delivery_item WHERE id = $1`, [deliveryItemId]),
      /append-only/i,
      "23001",
    );
    await expectGuardFailure(
      () =>
        c.pool.query(`UPDATE requirement_analysis_snapshot SET snapshot_hash = $1 WHERE id = $2`, [
          HASH_D,
          pipeline.snapshotId,
        ]),
      /append-only/i,
      "23001",
    );
    await expectGuardFailure(
      () => c.pool.query(`TRUNCATE TABLE citation CASCADE`),
      /append-only/i,
      "23001",
    );
  }, 120_000);

  it("enforces only one active run per project", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const c = client;
    const s = seed;
    const providerPolicyId = await insertProviderPolicy(client.pool, seed);
    await insertAnalysisRun(client.pool, seed, providerPolicyId, { status: "running" });

    await expectGuardFailure(
      () => insertAnalysisRun(c.pool, s, providerPolicyId, { status: "queued" }),
      /requirement_analysis_run_active_per_project_uidx/i,
    );
  }, 120_000);
});
