import { randomUUID } from "node:crypto";
import { createDatabaseClient, type DatabaseClient } from "@atlashq/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { IncompleteCaptureSuccessorError } from "../errors.js";
import {
  countSourceChunks,
  createReferenceCaptureSuccessor,
  finalizeExtractionPreview,
  findCaptureSuccessorState,
  insertExtractionChunksAndMetadata,
  isCaptureSuccessorComplete,
} from "./source-vault-repository.js";

const CONTENT_HASH = "a".repeat(64);
const SHA256 = "b".repeat(64);

type Seed = { organizationId: string; projectId: string; userId: string };

async function seedOrgProjectUser(client: DatabaseClient): Promise<Seed> {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();

  await client.pool.query(`INSERT INTO organization (id, name) VALUES ($1, $2)`, [
    organizationId,
    `Atomicity Org ${organizationId}`,
  ]);
  await client.pool.query(
    `INSERT INTO "user" (id, organization_id, name, email) VALUES ($1, $2, $3, $4)`,
    [userId, organizationId, "Atomicity User", `atomicity-${userId}@atlashq.test`],
  );
  await client.pool.query(
    `INSERT INTO project (id, organization_id, name, type, owner_id) VALUES ($1, $2, $3, $4, $5)`,
    [projectId, organizationId, `Atomicity Project ${projectId}`, "internal", userId],
  );

  return { organizationId, projectId, userId };
}

/** Inserts a root (no predecessor) `reference`-type `source_document` row, module-02 §8.3. */
async function insertPredecessor(client: DatabaseClient, seed: Seed): Promise<string> {
  const id = randomUUID();

  await client.pool.query(
    `INSERT INTO source_document (
       id, organization_id, project_id, lineage_id, version_number, source_type,
       document_format, title, content_hash, created_by, processing_status
     ) VALUES ($1, $2, $3, $1, 1, 'reference', NULL, $4, $5, $6, 'ready')`,
    [id, seed.organizationId, seed.projectId, "Atomicity Reference", CONTENT_HASH, seed.userId],
  );

  return id;
}

function buildSuccessorInput(
  seed: Seed,
  predecessorId: string,
  overrides: { attestedBy?: string } = {},
) {
  return {
    predecessorId,
    successor: {
      organizationId: seed.organizationId,
      projectId: seed.projectId,
      lineageId: predecessorId,
      versionNumber: 2,
      sourceType: "reference",
      documentFormat: null,
      title: "Atomicity Reference",
      notes: null,
      tags: [],
      provenanceDate: null,
      contentHash: "c".repeat(64),
      processingStatus: "extraction_pending",
      createdBy: seed.userId,
    },
    referenceArtifact: {
      referenceKind: "url",
      captureMethod: "on_demand_single_page_capture",
      accessType: "public",
      intendedUse: "inspiration",
      sourceUrl: "https://example.test/atomicity",
      attestationText: "I attest that I have the right to use this reference material.",
      attestationVersion: "v1",
      attestedBy: overrides.attestedBy ?? seed.userId,
      attestedAt: new Date(),
      capturedAt: new Date(),
    },
    file: {
      ordinal: 0,
      role: "snapshot",
      originalFileName: "capture.png",
      downloadFileName: "capture.png",
      format: "png",
      declaredMimeType: "image/png",
      byteSize: 1024,
      sha256: SHA256,
      objectKey: `atomicity/${predecessorId}/capture.png`,
      objectVersionId: "v1",
      scanStatus: "not_required",
    },
    chunkerVersion: "chunker-v1",
    audit: {
      organizationId: seed.organizationId,
      actorId: seed.userId,
      correlationId: `corr-${predecessorId}`,
      projectId: seed.projectId,
      action: "source.capture.succeeded",
      after: { predecessorId },
    },
  };
}

async function countRows(client: DatabaseClient, table: string, column: string, value: string) {
  const result = await client.pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${table} WHERE ${column} = $1`,
    [value],
  );
  return Number(result.rows[0]?.count ?? "0");
}

/** Inserts a `source_document` in a given (non-terminal) processing status for preview tests. */
async function insertSourceDocumentForPreview(
  client: DatabaseClient,
  seed: Seed,
  processingStatus = "extracting",
): Promise<string> {
  const id = randomUUID();

  await client.pool.query(
    `INSERT INTO source_document (
       id, organization_id, project_id, lineage_id, version_number, source_type,
       document_format, title, content_hash, created_by, processing_status
     ) VALUES ($1, $2, $3, $1, 1, 'document', 'pdf', $4, $5, $6, $7)`,
    [
      id,
      seed.organizationId,
      seed.projectId,
      "Preview Source",
      CONTENT_HASH,
      seed.userId,
      processingStatus,
    ],
  );

  return id;
}

async function insertSourceExtraction(
  client: DatabaseClient,
  sourceDocumentId: string,
  overrides: { status?: string; parserManifest?: string; extractedTextHash?: string | null } = {},
): Promise<string> {
  const id = randomUUID();
  await client.pool.query(
    `INSERT INTO source_extraction (
       id, source_document_id, extraction_version, status, chunker_version, parser_manifest, extracted_text_hash
     ) VALUES ($1, $2, 1, $3, 'chunker-v1', $4::jsonb, $5)`,
    [
      id,
      sourceDocumentId,
      overrides.status ?? "pending",
      overrides.parserManifest ?? "[]",
      overrides.extractedTextHash ?? null,
    ],
  );
  return id;
}

async function insertSourceChunk(
  client: DatabaseClient,
  seed: Seed,
  sourceDocumentId: string,
  sourceExtractionId: string,
  sequence: number,
): Promise<string> {
  const id = randomUUID();
  await client.pool.query(
    `INSERT INTO source_chunk (
       id, organization_id, project_id, source_document_id, source_extraction_id,
       sequence, content, character_count, content_hash
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      seed.organizationId,
      seed.projectId,
      sourceDocumentId,
      sourceExtractionId,
      sequence,
      `chunk ${sequence}`,
      8,
      CONTENT_HASH,
    ],
  );
  return id;
}

/**
 * Failure-injection integration tests, run against a real disposable Postgres (Testcontainers),
 * covering every former crash boundary identified in final review for `capture-reference`
 * successor creation and `extract` chunk/metadata writes (module-02 §6.8, §6.10, §8.3, §8.5,
 * §8.6). These intentionally exercise genuine Postgres constraint violations (foreign-key and
 * unique-index violations) mid-transaction rather than mocking the database, so they prove the
 * actual atomicity guarantee -- not just that the code calls `db.transaction`.
 */
describe("integration: source-vault-repository atomicity", () => {
  let client: DatabaseClient;

  beforeAll(() => {
    const env = inject("workerIntegrationEnv");
    client = createDatabaseClient({ connectionString: env.DATABASE_URL });
  });

  afterAll(async () => {
    await client.close();
  });

  describe("createReferenceCaptureSuccessor", () => {
    it("commits the source_document successor, reference_artifact, source_document_file, source_extraction, and audit event together", async () => {
      const seed = await seedOrgProjectUser(client);
      const predecessorId = await insertPredecessor(client, seed);

      const outcome = await createReferenceCaptureSuccessor(
        client.db,
        buildSuccessorInput(seed, predecessorId),
      );

      expect(outcome.kind).toBe("created");
      expect(await countRows(client, "source_document", "supersedes_id", predecessorId)).toBe(1);
      expect(
        await countRows(client, "reference_artifact", "source_document_id", outcome.successor.id),
      ).toBe(1);
      expect(
        await countRows(client, "source_document_file", "source_document_id", outcome.successor.id),
      ).toBe(1);
      expect(
        await countRows(client, "source_extraction", "source_document_id", outcome.successor.id),
      ).toBe(1);
      expect(await countRows(client, "audit_event", "entity_id", outcome.successor.id)).toBe(1);

      // The predecessor itself is never mutated by successor creation.
      const predecessorRows = await client.pool.query<{
        version_number: number;
        supersedes_id: string | null;
      }>(`SELECT version_number, supersedes_id FROM source_document WHERE id = $1`, [
        predecessorId,
      ]);
      expect(predecessorRows.rows[0]).toEqual({ version_number: 1, supersedes_id: null });
    });

    it("crash boundary: a foreign-key violation partway through the transaction (bad attested_by) rolls back the successor source_document row too -- no partial successor is ever left behind", async () => {
      const seed = await seedOrgProjectUser(client);
      const predecessorId = await insertPredecessor(client, seed);
      const nonExistentUserId = randomUUID();

      await expect(
        createReferenceCaptureSuccessor(
          client.db,
          buildSuccessorInput(seed, predecessorId, { attestedBy: nonExistentUserId }),
        ),
      ).rejects.toThrow();

      // Nothing committed: not the source_document successor, not any companion row.
      expect(await countRows(client, "source_document", "supersedes_id", predecessorId)).toBe(0);
      const artifactCount = await client.pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM reference_artifact ra
         JOIN source_document sd ON sd.id = ra.source_document_id
         WHERE sd.supersedes_id = $1`,
        [predecessorId],
      );
      expect(Number(artifactCount.rows[0]?.count ?? "0")).toBe(0);
    });

    it("replay: a second call for the same predecessor never forks a second successor and idempotently returns the already-committed one", async () => {
      const seed = await seedOrgProjectUser(client);
      const predecessorId = await insertPredecessor(client, seed);

      const first = await createReferenceCaptureSuccessor(
        client.db,
        buildSuccessorInput(seed, predecessorId),
      );
      expect(first.kind).toBe("created");

      const second = await createReferenceCaptureSuccessor(
        client.db,
        buildSuccessorInput(seed, predecessorId),
      );

      expect(second.kind).toBe("already_exists");
      expect(second.successor.id).toBe(first.successor.id);
      expect(second.extraction.id).toBe(first.extraction.id);
      expect(await countRows(client, "source_document", "supersedes_id", predecessorId)).toBe(1);

      // The replay-detection read path agrees, and reports the successor complete.
      const state = await findCaptureSuccessorState(client.db, predecessorId);
      if (!state) {
        throw new Error("Expected findCaptureSuccessorState to find the committed successor.");
      }
      expect(isCaptureSuccessorComplete(state)).toBe(true);
    });

    it("never silently treats an incomplete successor (from an older, pre-atomic-transaction attempt) as complete -- fails explicitly instead", async () => {
      const seed = await seedOrgProjectUser(client);
      const predecessorId = await insertPredecessor(client, seed);

      // Simulate a crash: a successor source_document row exists, but its reference_artifact and
      // source_extraction companion rows were never written (bypassing the atomic function
      // entirely, via direct SQL, to model exactly what an older, pre-atomic-transaction bug could
      // have left behind).
      const successorId = randomUUID();
      await client.pool.query(
        `INSERT INTO source_document (
           id, organization_id, project_id, lineage_id, version_number, supersedes_id,
           source_type, document_format, title, content_hash, created_by, processing_status
         ) VALUES ($1, $2, $3, $4, 2, $4, 'reference', NULL, $5, $6, $7, 'extraction_pending')`,
        [
          successorId,
          seed.organizationId,
          seed.projectId,
          predecessorId,
          "Atomicity Reference",
          "d".repeat(64),
          seed.userId,
        ],
      );

      const state = await findCaptureSuccessorState(client.db, predecessorId);
      if (!state) {
        throw new Error(
          "Expected findCaptureSuccessorState to find the manually seeded partial successor.",
        );
      }
      expect(isCaptureSuccessorComplete(state)).toBe(false);

      await expect(
        createReferenceCaptureSuccessor(client.db, buildSuccessorInput(seed, predecessorId)),
      ).rejects.toBeInstanceOf(IncompleteCaptureSuccessorError);

      // No second successor was forked, and the incomplete one was left untouched (not silently
      // repaired, per the "fail explicitly" design decision).
      expect(await countRows(client, "source_document", "supersedes_id", predecessorId)).toBe(1);
      expect(await countRows(client, "reference_artifact", "source_document_id", successorId)).toBe(
        0,
      );
    });
  });

  describe("insertExtractionChunksAndMetadata", () => {
    it("commits every chunk and the parser_manifest/extracted_text_hash metadata together in one transaction", async () => {
      const seed = await seedOrgProjectUser(client);
      const predecessorId = await insertPredecessor(client, seed);
      const extractionId = await insertSourceExtraction(client, predecessorId);

      const result = await insertExtractionChunksAndMetadata(client.db, {
        sourceExtractionId: extractionId,
        chunks: [0, 1, 2].map((sequence) => ({
          organizationId: seed.organizationId,
          projectId: seed.projectId,
          sourceDocumentId: predecessorId,
          sourceExtractionId: extractionId,
          sequence,
          content: `chunk ${sequence}`,
          characterCount: 7,
          contentHash: CONTENT_HASH,
        })),
        parserManifest: [{ name: "text-adapter", version: "1.0.0" }],
        extractedTextHash: "e".repeat(64),
      });

      expect(result.chunkCount).toBe(3);
      expect(await countSourceChunks(client.db, extractionId)).toBe(3);

      const extractionRows = await client.pool.query<{
        parser_manifest: unknown;
        extracted_text_hash: string | null;
      }>(`SELECT parser_manifest, extracted_text_hash FROM source_extraction WHERE id = $1`, [
        extractionId,
      ]);
      expect(extractionRows.rows[0]?.parser_manifest).toEqual([
        { name: "text-adapter", version: "1.0.0" },
      ]);
      expect(extractionRows.rows[0]?.extracted_text_hash).toBe("e".repeat(64));
    });

    it("crash boundary: a unique-constraint violation (duplicate chunk sequence) rolls back the whole transaction -- zero chunks and unchanged metadata remain", async () => {
      const seed = await seedOrgProjectUser(client);
      const predecessorId = await insertPredecessor(client, seed);
      const extractionId = await insertSourceExtraction(client, predecessorId);

      await expect(
        insertExtractionChunksAndMetadata(client.db, {
          sourceExtractionId: extractionId,
          // Two chunks sharing sequence 0 violates source_chunk_extraction_sequence_uidx.
          chunks: [0, 0].map((sequence) => ({
            organizationId: seed.organizationId,
            projectId: seed.projectId,
            sourceDocumentId: predecessorId,
            sourceExtractionId: extractionId,
            sequence,
            content: "duplicate sequence chunk",
            characterCount: 24,
            contentHash: CONTENT_HASH,
          })),
          parserManifest: [{ name: "text-adapter", version: "1.0.0" }],
          extractedTextHash: "f".repeat(64),
        }),
      ).rejects.toThrow();

      expect(await countSourceChunks(client.db, extractionId)).toBe(0);
      const extractionRows = await client.pool.query<{
        parser_manifest: unknown;
        extracted_text_hash: string | null;
      }>(`SELECT parser_manifest, extracted_text_hash FROM source_extraction WHERE id = $1`, [
        extractionId,
      ]);
      expect(extractionRows.rows[0]?.parser_manifest).toEqual([]);
      expect(extractionRows.rows[0]?.extracted_text_hash).toBeNull();
    });

    it("replay: re-calling with new chunks for an extraction that already has committed chunks never re-inserts (avoiding the sequence unique-constraint) and still refreshes the metadata", async () => {
      const seed = await seedOrgProjectUser(client);
      const predecessorId = await insertPredecessor(client, seed);
      const extractionId = await insertSourceExtraction(client, predecessorId);

      await insertSourceChunk(client, seed, predecessorId, extractionId, 0);
      await insertSourceChunk(client, seed, predecessorId, extractionId, 1);

      const result = await insertExtractionChunksAndMetadata(client.db, {
        sourceExtractionId: extractionId,
        // Different sequence numbers than what's already committed -- if this were (incorrectly)
        // inserted, the chunk count would become 5, not stay at 2.
        chunks: [10, 11, 12].map((sequence) => ({
          organizationId: seed.organizationId,
          projectId: seed.projectId,
          sourceDocumentId: predecessorId,
          sourceExtractionId: extractionId,
          sequence,
          content: `should never be inserted ${sequence}`,
          characterCount: 24,
          contentHash: CONTENT_HASH,
        })),
        parserManifest: [{ name: "text-adapter", version: "1.0.0" }],
        extractedTextHash: "1".repeat(64),
      });

      expect(result.chunkCount).toBe(2);
      expect(await countSourceChunks(client.db, extractionId)).toBe(2);
      const extractionRows = await client.pool.query<{ extracted_text_hash: string | null }>(
        `SELECT extracted_text_hash FROM source_extraction WHERE id = $1`,
        [extractionId],
      );
      expect(extractionRows.rows[0]?.extracted_text_hash).toBe("1".repeat(64));
    });

    it("backfill: recomputed metadata for chunks already committed by an older, pre-atomic-transaction attempt is written without ever re-inserting those chunks", async () => {
      const seed = await seedOrgProjectUser(client);
      const predecessorId = await insertPredecessor(client, seed);
      // Simulate a crash: chunks committed, but the extraction's metadata never got written.
      const extractionId = await insertSourceExtraction(client, predecessorId, {
        parserManifest: "[]",
        extractedTextHash: null,
      });
      await insertSourceChunk(client, seed, predecessorId, extractionId, 0);
      await insertSourceChunk(client, seed, predecessorId, extractionId, 1);
      await insertSourceChunk(client, seed, predecessorId, extractionId, 2);

      const result = await insertExtractionChunksAndMetadata(client.db, {
        sourceExtractionId: extractionId,
        chunks: [], // Backfill path never re-inserts chunks that already exist.
        parserManifest: [{ name: "text-adapter", version: "1.0.0" }],
        extractedTextHash: "2".repeat(64),
      });

      expect(result.chunkCount).toBe(3);
      expect(await countSourceChunks(client.db, extractionId)).toBe(3);
      const extractionRows = await client.pool.query<{
        parser_manifest: unknown;
        extracted_text_hash: string | null;
      }>(`SELECT parser_manifest, extracted_text_hash FROM source_extraction WHERE id = $1`, [
        extractionId,
      ]);
      expect(extractionRows.rows[0]?.parser_manifest).toEqual([
        { name: "text-adapter", version: "1.0.0" },
      ]);
      expect(extractionRows.rows[0]?.extracted_text_hash).toBe("2".repeat(64));
    });
  });

  describe("finalizeExtractionPreview", () => {
    it("commits the source_extraction succeeded transition, source_document ready transition, and audit event together", async () => {
      const seed = await seedOrgProjectUser(client);
      const sourceDocumentId = await insertSourceDocumentForPreview(client, seed, "extracting");
      const extractionId = await insertSourceExtraction(client, sourceDocumentId, {
        status: "running",
      });

      const outcome = await finalizeExtractionPreview(client.db, {
        sourceDocumentId,
        sourceExtractionId: extractionId,
        preview: { previewObjectKey: "preview/key/1", previewObjectVersionId: "v1" },
        audit: {
          organizationId: seed.organizationId,
          actorId: seed.userId,
          projectId: seed.projectId,
          correlationId: `corr-${extractionId}`,
        },
      });

      expect(outcome.kind).toBe("finalized");

      const extractionRows = await client.pool.query<{
        status: string;
        preview_object_key: string | null;
        completed_at: Date | null;
      }>(`SELECT status, preview_object_key, completed_at FROM source_extraction WHERE id = $1`, [
        extractionId,
      ]);
      expect(extractionRows.rows[0]?.status).toBe("succeeded");
      expect(extractionRows.rows[0]?.preview_object_key).toBe("preview/key/1");
      expect(extractionRows.rows[0]?.completed_at).not.toBeNull();

      const documentRows = await client.pool.query<{ processing_status: string }>(
        `SELECT processing_status FROM source_document WHERE id = $1`,
        [sourceDocumentId],
      );
      expect(documentRows.rows[0]?.processing_status).toBe("ready");

      expect(await countRows(client, "audit_event", "entity_id", extractionId)).toBe(1);
    });

    it("crash boundary: a foreign-key violation on the audit actor rolls back the whole transaction -- extraction stays running, document stays non-ready, no audit event", async () => {
      const seed = await seedOrgProjectUser(client);
      const sourceDocumentId = await insertSourceDocumentForPreview(client, seed, "extracting");
      const extractionId = await insertSourceExtraction(client, sourceDocumentId, {
        status: "running",
      });
      const nonExistentActorId = randomUUID();

      await expect(
        finalizeExtractionPreview(client.db, {
          sourceDocumentId,
          sourceExtractionId: extractionId,
          preview: { previewObjectKey: "preview/key/2", previewObjectVersionId: "v1" },
          audit: {
            organizationId: seed.organizationId,
            actorId: nonExistentActorId,
            projectId: seed.projectId,
            correlationId: `corr-${extractionId}`,
          },
        }),
      ).rejects.toThrow();

      const extractionRows = await client.pool.query<{
        status: string;
        preview_object_key: string | null;
      }>(`SELECT status, preview_object_key FROM source_extraction WHERE id = $1`, [extractionId]);
      expect(extractionRows.rows[0]?.status).toBe("running");
      expect(extractionRows.rows[0]?.preview_object_key).toBeNull();

      const documentRows = await client.pool.query<{ processing_status: string }>(
        `SELECT processing_status FROM source_document WHERE id = $1`,
        [sourceDocumentId],
      );
      expect(documentRows.rows[0]?.processing_status).toBe("extracting");
      expect(await countRows(client, "audit_event", "entity_id", extractionId)).toBe(0);

      // A retry with a valid actor now succeeds normally -- the failed attempt left nothing behind
      // to conflict with (source_extraction is still non-terminal, so it can still be updated).
      const retryOutcome = await finalizeExtractionPreview(client.db, {
        sourceDocumentId,
        sourceExtractionId: extractionId,
        preview: { previewObjectKey: "preview/key/2", previewObjectVersionId: "v1" },
        audit: {
          organizationId: seed.organizationId,
          actorId: seed.userId,
          projectId: seed.projectId,
          correlationId: `corr-${extractionId}`,
        },
      });
      expect(retryOutcome.kind).toBe("finalized");
    });

    it("replay: repairs a previously-succeeded extraction whose source_document was never marked ready and whose audit event was never written (a legacy, pre-transaction crash state)", async () => {
      const seed = await seedOrgProjectUser(client);
      const sourceDocumentId = await insertSourceDocumentForPreview(client, seed, "extracting");
      // Simulate the exact legacy crash: an older, non-transactional code path already committed
      // the source_extraction UPDATE (now frozen/terminal) but crashed before the source_document
      // and audit writes ever ran.
      const extractionId = await insertSourceExtraction(client, sourceDocumentId, {
        status: "running",
      });
      await client.pool.query(
        `UPDATE source_extraction
         SET status = 'succeeded', preview_object_key = $2, completed_at = now()
         WHERE id = $1`,
        [extractionId, "preview/key/legacy"],
      );
      expect(await countRows(client, "audit_event", "entity_id", extractionId)).toBe(0);

      const outcome = await finalizeExtractionPreview(client.db, {
        sourceDocumentId,
        sourceExtractionId: extractionId,
        preview: null, // Ignored: source_extraction is already terminal/frozen.
        audit: {
          organizationId: seed.organizationId,
          actorId: seed.userId,
          projectId: seed.projectId,
          correlationId: `corr-${extractionId}`,
        },
      });

      expect(outcome.kind).toBe("repaired");

      const documentRows = await client.pool.query<{ processing_status: string }>(
        `SELECT processing_status FROM source_document WHERE id = $1`,
        [sourceDocumentId],
      );
      expect(documentRows.rows[0]?.processing_status).toBe("ready");
      expect(await countRows(client, "audit_event", "entity_id", extractionId)).toBe(1);

      // The (already-frozen) preview_object_key from the legacy commit is left untouched -- this
      // repair never issues a second source_extraction UPDATE.
      const extractionRows = await client.pool.query<{ preview_object_key: string | null }>(
        `SELECT preview_object_key FROM source_extraction WHERE id = $1`,
        [extractionId],
      );
      expect(extractionRows.rows[0]?.preview_object_key).toBe("preview/key/legacy");

      // A second replay call is now a true no-op: no additional audit event, source stays ready.
      const secondOutcome = await finalizeExtractionPreview(client.db, {
        sourceDocumentId,
        sourceExtractionId: extractionId,
        preview: null,
        audit: {
          organizationId: seed.organizationId,
          actorId: seed.userId,
          projectId: seed.projectId,
          correlationId: `corr-${extractionId}`,
        },
      });
      expect(secondOutcome.kind).toBe("already_finalized");
      expect(await countRows(client, "audit_event", "entity_id", extractionId)).toBe(1);
    });

    it("is a true idempotent no-op when the extraction is already succeeded, the source_document is already ready, and the audit event already exists", async () => {
      const seed = await seedOrgProjectUser(client);
      const sourceDocumentId = await insertSourceDocumentForPreview(client, seed, "extracting");
      const extractionId = await insertSourceExtraction(client, sourceDocumentId, {
        status: "running",
      });

      const first = await finalizeExtractionPreview(client.db, {
        sourceDocumentId,
        sourceExtractionId: extractionId,
        preview: { previewObjectKey: "preview/key/3", previewObjectVersionId: "v1" },
        audit: {
          organizationId: seed.organizationId,
          actorId: seed.userId,
          projectId: seed.projectId,
          correlationId: `corr-${extractionId}`,
        },
      });
      expect(first.kind).toBe("finalized");

      const second = await finalizeExtractionPreview(client.db, {
        sourceDocumentId,
        sourceExtractionId: extractionId,
        preview: { previewObjectKey: "preview/key/3", previewObjectVersionId: "v1" },
        audit: {
          organizationId: seed.organizationId,
          actorId: seed.userId,
          projectId: seed.projectId,
          correlationId: `corr-${extractionId}`,
        },
      });

      expect(second.kind).toBe("already_finalized");
      expect(await countRows(client, "audit_event", "entity_id", extractionId)).toBe(1);
    });

    it("never touches or repairs a failed (immutable) extraction", async () => {
      const seed = await seedOrgProjectUser(client);
      const sourceDocumentId = await insertSourceDocumentForPreview(client, seed, "failed");
      const extractionId = await insertSourceExtraction(client, sourceDocumentId, {
        status: "running",
      });
      await client.pool.query(
        `UPDATE source_extraction
         SET status = 'failed', failure_code = 'PARSE_ERROR', failure_detail = 'boom'
         WHERE id = $1`,
        [extractionId],
      );

      const outcome = await finalizeExtractionPreview(client.db, {
        sourceDocumentId,
        sourceExtractionId: extractionId,
        preview: null,
        audit: {
          organizationId: seed.organizationId,
          actorId: seed.userId,
          projectId: seed.projectId,
          correlationId: `corr-${extractionId}`,
        },
      });

      expect(outcome.kind).toBe("already_finalized");
      expect(await countRows(client, "audit_event", "entity_id", extractionId)).toBe(0);

      const documentRows = await client.pool.query<{ processing_status: string }>(
        `SELECT processing_status FROM source_document WHERE id = $1`,
        [sourceDocumentId],
      );
      expect(documentRows.rows[0]?.processing_status).toBe("failed");
    });
  });
});
