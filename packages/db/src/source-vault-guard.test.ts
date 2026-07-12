import { randomUUID } from "node:crypto";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient, migrateDatabase } from "./index.js";

const POSTGRES_IMAGE = "postgres:17-alpine";
const CONTENT_HASH = "a".repeat(64);
const OTHER_CONTENT_HASH = "b".repeat(64);
const SHA256 = "c".repeat(64);

type Seed = {
  organizationId: string;
  projectId: string;
  userId: string;
};

async function seedOrgProjectUser(
  client: DatabaseClient,
  label = "Source Vault Guard",
): Promise<Seed> {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();

  await client.pool.query(`INSERT INTO organization (id, name) VALUES ($1, $2)`, [
    organizationId,
    `${label} Org ${organizationId}`,
  ]);
  await client.pool.query(
    `INSERT INTO "user" (id, organization_id, name, email) VALUES ($1, $2, $3, $4)`,
    [
      userId,
      organizationId,
      `${label} User`,
      `${label.toLowerCase().replace(/\s+/gu, "-")}-${userId}@atlashq.test`,
    ],
  );
  await client.pool.query(
    `INSERT INTO project (id, organization_id, name, type, owner_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [projectId, organizationId, `${label} Project ${projectId}`, "internal", userId],
  );

  return { organizationId, projectId, userId };
}

async function insertProject(
  client: DatabaseClient,
  organizationId: string,
  ownerId: string,
  name: string,
): Promise<string> {
  const projectId = randomUUID();
  await client.pool.query(
    `INSERT INTO project (id, organization_id, name, type, owner_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [projectId, organizationId, name, "internal", ownerId],
  );
  return projectId;
}

async function insertSourceDocument(
  client: DatabaseClient,
  seed: Seed,
  overrides: Partial<{
    id: string;
    organizationId: string;
    projectId: string;
    lineageId: string;
    versionNumber: number;
    supersedesId: string | null;
    contentHash: string;
    createdBy: string;
    sourceType: string;
    documentFormat: string | null;
  }> = {},
): Promise<string> {
  const id = overrides.id ?? randomUUID();
  const supersedesId = overrides.supersedesId ?? null;
  // Root rows (no predecessor) self-anchor lineage_id = id by default; replacement rows must
  // have their lineageId supplied explicitly (typically via insertReplacementSourceDocument).
  const lineageId = overrides.lineageId ?? (supersedesId === null ? id : randomUUID());
  const sourceType = overrides.sourceType ?? "document";
  const documentFormat =
    overrides.documentFormat !== undefined
      ? overrides.documentFormat
      : sourceType === "document"
        ? "pdf"
        : null;

  await client.pool.query(
    `INSERT INTO source_document (
       id, organization_id, project_id, lineage_id, version_number, supersedes_id,
       source_type, document_format, title, content_hash, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      overrides.organizationId ?? seed.organizationId,
      overrides.projectId ?? seed.projectId,
      lineageId,
      overrides.versionNumber ?? 1,
      supersedesId,
      sourceType,
      documentFormat,
      "Guard Test Document",
      overrides.contentHash ?? CONTENT_HASH,
      overrides.createdBy ?? seed.userId,
    ],
  );

  return id;
}

async function getSourceDocument(
  client: DatabaseClient,
  id: string,
): Promise<{
  organizationId: string;
  projectId: string;
  lineageId: string;
  versionNumber: number;
}> {
  const result = await client.pool.query<{
    organization_id: string;
    project_id: string;
    lineage_id: string;
    version_number: number;
  }>(
    `SELECT organization_id, project_id, lineage_id, version_number
     FROM source_document WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`source_document ${id} not found`);
  return {
    organizationId: row.organization_id,
    projectId: row.project_id,
    lineageId: row.lineage_id,
    versionNumber: row.version_number,
  };
}

/**
 * Inserts a valid replacement source_document row that inherits organization/project/lineage from
 * `predecessorId` and advances version_number by one, unless explicitly overridden to exercise a
 * lineage/scope guard violation.
 */
async function insertReplacementSourceDocument(
  client: DatabaseClient,
  seed: Seed,
  predecessorId: string,
  overrides: Partial<{
    organizationId: string;
    projectId: string;
    lineageId: string;
    versionNumber: number;
    contentHash: string;
  }> = {},
): Promise<string> {
  const predecessor = await getSourceDocument(client, predecessorId);

  return insertSourceDocument(client, seed, {
    organizationId: overrides.organizationId ?? predecessor.organizationId,
    projectId: overrides.projectId ?? predecessor.projectId,
    lineageId: overrides.lineageId ?? predecessor.lineageId,
    versionNumber: overrides.versionNumber ?? predecessor.versionNumber + 1,
    supersedesId: predecessorId,
    contentHash: overrides.contentHash ?? OTHER_CONTENT_HASH,
  });
}

async function insertSourceDocumentFile(
  client: DatabaseClient,
  sourceDocumentId: string,
): Promise<string> {
  const id = randomUUID();

  await client.pool.query(
    `INSERT INTO source_document_file (
       id, source_document_id, ordinal, role, original_file_name, download_file_name,
       format, declared_mime_type, byte_size, sha256, object_key, object_version_id
     ) VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      sourceDocumentId,
      "primary",
      "original.pdf",
      "download.pdf",
      "pdf",
      "application/pdf",
      1024,
      SHA256,
      `guard/${sourceDocumentId}/original.pdf`,
      "v1",
    ],
  );

  return id;
}

async function insertSourceExtraction(
  client: DatabaseClient,
  sourceDocumentId: string,
  status: "pending" | "running" | "succeeded" | "failed" = "pending",
  extractionVersion = 1,
): Promise<string> {
  const id = randomUUID();

  await client.pool.query(
    `INSERT INTO source_extraction (
       id, source_document_id, extraction_version, status, chunker_version
     ) VALUES ($1, $2, $3, $4, $5)`,
    [id, sourceDocumentId, extractionVersion, status, "chunker-v1"],
  );

  return id;
}

async function insertSourceChunk(
  client: DatabaseClient,
  seed: Seed,
  sourceDocumentId: string,
  sourceExtractionId: string,
  overrides: Partial<{ organizationId: string; projectId: string }> = {},
): Promise<string> {
  const id = randomUUID();

  await client.pool.query(
    `INSERT INTO source_chunk (
       id, organization_id, project_id, source_document_id, source_extraction_id,
       sequence, content, character_count, content_hash
     ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8)`,
    [
      id,
      overrides.organizationId ?? seed.organizationId,
      overrides.projectId ?? seed.projectId,
      sourceDocumentId,
      sourceExtractionId,
      "chunk content",
      13,
      CONTENT_HASH,
    ],
  );

  return id;
}

async function insertReferenceArtifact(
  client: DatabaseClient,
  seed: Seed,
  sourceDocumentId: string,
  overrides: Partial<{ organizationId: string; projectId: string; attestedBy: string }> = {},
): Promise<string> {
  const id = randomUUID();

  await client.pool.query(
    `INSERT INTO reference_artifact (
       id, source_document_id, organization_id, project_id, reference_kind, capture_method,
       access_type, intended_use, source_url, attestation_text, attestation_version,
       attested_by, attested_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
    [
      id,
      sourceDocumentId,
      overrides.organizationId ?? seed.organizationId,
      overrides.projectId ?? seed.projectId,
      "url",
      "manual_paste",
      "public",
      "inspiration",
      "https://example.test/reference",
      "I attest that I have the right to use this reference material.",
      "v1",
      overrides.attestedBy ?? seed.userId,
    ],
  );

  return id;
}

async function expectGuardFailure(
  client: DatabaseClient,
  statement: string,
  values: unknown[],
  messagePattern: RegExp,
): Promise<void> {
  let error: (Error & { code?: string }) | undefined;

  try {
    await client.pool.query(statement, values);
  } catch (failure) {
    error = failure as Error & { code?: string };
  }

  expect(error).toBeInstanceOf(Error);
  expect(error?.code).toBe("23001");
  expect(error?.message).toMatch(messagePattern);
}

async function expectInsertGuardFailure(
  action: () => Promise<unknown>,
  messagePattern: RegExp,
): Promise<void> {
  let error: (Error & { code?: string }) | undefined;

  try {
    await action();
  } catch (failure) {
    error = failure as Error & { code?: string };
  }

  expect(error).toBeInstanceOf(Error);
  expect(error?.code).toBe("23001");
  expect(error?.message).toMatch(messagePattern);
}

describe("source document vault guards", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let client: DatabaseClient | undefined;
  let seed: Seed | undefined;

  beforeEach(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase("atlashq_db_test")
      .start();
    client = createDatabaseClient({ connectionString: container.getConnectionUri() });
    await migrateDatabase(client);
    seed = await seedOrgProjectUser(client);
  }, 120_000);

  afterEach(async () => {
    await client?.close();
    client = undefined;
    await container?.stop();
    container = undefined;
    seed = undefined;
  });

  it("rejects DELETE and TRUNCATE on all five archive-only tables", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const sourceDocumentId = await insertSourceDocument(client, seed, { sourceType: "reference" });
    const sourceDocumentFileId = await insertSourceDocumentFile(client, sourceDocumentId);
    const sourceExtractionId = await insertSourceExtraction(client, sourceDocumentId);
    await insertSourceChunk(client, seed, sourceDocumentId, sourceExtractionId);
    await insertReferenceArtifact(client, seed, sourceDocumentId);

    await expectGuardFailure(
      client,
      `DELETE FROM source_document WHERE id = $1`,
      [sourceDocumentId],
      /archive-only: DELETE is not permitted/i,
    );
    await expectGuardFailure(
      client,
      `DELETE FROM source_document_file WHERE id = $1`,
      [sourceDocumentFileId],
      /archive-only: DELETE is not permitted/i,
    );
    await expectGuardFailure(
      client,
      `DELETE FROM source_extraction WHERE id = $1`,
      [sourceExtractionId],
      /archive-only: DELETE is not permitted/i,
    );
    await expectGuardFailure(
      client,
      `DELETE FROM source_chunk`,
      [],
      /archive-only: DELETE is not permitted/i,
    );
    await expectGuardFailure(
      client,
      `DELETE FROM reference_artifact`,
      [],
      /archive-only: DELETE is not permitted/i,
    );

    await expectGuardFailure(
      client,
      `TRUNCATE TABLE source_document CASCADE`,
      [],
      /archive-only: TRUNCATE is not permitted/i,
    );
    await expectGuardFailure(
      client,
      `TRUNCATE TABLE source_document_file CASCADE`,
      [],
      /archive-only: TRUNCATE is not permitted/i,
    );
    await expectGuardFailure(
      client,
      `TRUNCATE TABLE source_extraction CASCADE`,
      [],
      /archive-only: TRUNCATE is not permitted/i,
    );
    await expectGuardFailure(
      client,
      `TRUNCATE TABLE source_chunk CASCADE`,
      [],
      /archive-only: TRUNCATE is not permitted/i,
    );
    await expectGuardFailure(
      client,
      `TRUNCATE TABLE reference_artifact CASCADE`,
      [],
      /archive-only: TRUNCATE is not permitted/i,
    );

    const counts = await client.pool.query<{ table_name: string; count: string }>(
      `SELECT 'source_document' AS table_name, count(*)::text AS count FROM source_document
       UNION ALL SELECT 'source_document_file', count(*)::text FROM source_document_file
       UNION ALL SELECT 'source_extraction', count(*)::text FROM source_extraction
       UNION ALL SELECT 'source_chunk', count(*)::text FROM source_chunk
       UNION ALL SELECT 'reference_artifact', count(*)::text FROM reference_artifact`,
    );
    for (const row of counts.rows) {
      expect(row.count, row.table_name).toBe("1");
    }
  }, 120_000);

  it("leaves source_upload_session and source_upload_file freely deletable", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const uploadSessionId = randomUUID();
    await client.pool.query(
      `INSERT INTO source_upload_session (
         id, organization_id, project_id, actor_id, intake_mode, expected_content_hash,
         expires_at, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, now() + interval '1 hour', $7)`,
      [
        uploadSessionId,
        seed.organizationId,
        seed.projectId,
        seed.userId,
        "file_upload",
        CONTENT_HASH,
        `idem-${uploadSessionId}`,
      ],
    );
    const uploadFileId = randomUUID();
    await client.pool.query(
      `INSERT INTO source_upload_file (
         id, upload_session_id, ordinal, role, original_file_name, normalized_file_name,
         declared_mime_type, extension, expected_byte_size, expected_sha256, object_key
       ) VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        uploadFileId,
        uploadSessionId,
        "primary",
        "draft.pdf",
        "draft.pdf",
        "application/pdf",
        "pdf",
        1024,
        SHA256,
        `guard/upload/${uploadFileId}/draft.pdf`,
      ],
    );

    await expect(
      client.pool.query(`DELETE FROM source_upload_file WHERE id = $1`, [uploadFileId]),
    ).resolves.toBeDefined();
    await expect(
      client.pool.query(`DELETE FROM source_upload_session WHERE id = $1`, [uploadSessionId]),
    ).resolves.toBeDefined();
  }, 120_000);

  it("permits lifecycle/processing/metadata updates but rejects identity/content mutation on source_document", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const sourceDocumentId = await insertSourceDocument(client, seed);

    await expect(
      client.pool.query(
        `UPDATE source_document
         SET title = 'Renamed', notes = 'reviewed', tags = ARRAY['a','b'],
             processing_status = 'ready', ai_processing_status = 'completed',
             archived_at = now(), version = version + 1
         WHERE id = $1`,
        [sourceDocumentId],
      ),
    ).resolves.toBeDefined();

    await expectGuardFailure(
      client,
      `UPDATE source_document SET content_hash = $2 WHERE id = $1`,
      [sourceDocumentId, OTHER_CONTENT_HASH],
      /identity\/content\/version ancestry is immutable/i,
    );
    await expectGuardFailure(
      client,
      `UPDATE source_document SET source_type = 'manual', document_format = null WHERE id = $1`,
      [sourceDocumentId],
      /identity\/content\/version ancestry is immutable/i,
    );
    await expectGuardFailure(
      client,
      `UPDATE source_document SET version_number = 2 WHERE id = $1`,
      [sourceDocumentId],
      /identity\/content\/version ancestry is immutable/i,
    );
    await expectGuardFailure(
      client,
      `UPDATE source_document SET lineage_id = gen_random_uuid() WHERE id = $1`,
      [sourceDocumentId],
      /identity\/content\/version ancestry is immutable/i,
    );
  }, 120_000);

  it("prevents supersedes_id forking via the partial unique index", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const predecessorId = await insertSourceDocument(client, seed);
    await insertReplacementSourceDocument(client, seed, predecessorId);

    let error: (Error & { code?: string }) | undefined;
    try {
      await insertReplacementSourceDocument(client, seed, predecessorId, {
        contentHash: "d".repeat(64),
      });
    } catch (failure) {
      error = failure as Error & { code?: string };
    }

    expect(error).toBeInstanceOf(Error);
    expect(error?.code).toBe("23505");
  }, 120_000);

  it("permits scan-result updates but rejects identity/hash mutation on source_document_file", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const sourceDocumentId = await insertSourceDocument(client, seed);
    const sourceDocumentFileId = await insertSourceDocumentFile(client, sourceDocumentId);

    await expect(
      client.pool.query(
        `UPDATE source_document_file
         SET scan_status = 'clean', scan_result = '{"engine":"clamav"}'::jsonb,
             scan_signature_version = '2024.1', scanned_at = now()
         WHERE id = $1`,
        [sourceDocumentFileId],
      ),
    ).resolves.toBeDefined();

    await expectGuardFailure(
      client,
      `UPDATE source_document_file SET sha256 = $2 WHERE id = $1`,
      [sourceDocumentFileId, "f".repeat(64)],
      /identity\/hash\/storage version is immutable/i,
    );
    await expectGuardFailure(
      client,
      `UPDATE source_document_file SET object_key = 'guard/tampered.pdf' WHERE id = $1`,
      [sourceDocumentFileId],
      /identity\/hash\/storage version is immutable/i,
    );
    await expectGuardFailure(
      client,
      `UPDATE source_document_file SET object_version_id = 'v2' WHERE id = $1`,
      [sourceDocumentFileId],
      /identity\/hash\/storage version is immutable/i,
    );
  }, 120_000);

  it("permits non-terminal source_extraction updates but freezes terminal runs", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const sourceDocumentId = await insertSourceDocument(client, seed);
    const sourceExtractionId = await insertSourceExtraction(client, sourceDocumentId, "pending");

    await expect(
      client.pool.query(
        `UPDATE source_extraction
         SET status = 'running', started_at = now(),
             parser_manifest = '[{"name":"pdf-parser","version":"1.0.0"}]'::jsonb
         WHERE id = $1`,
        [sourceExtractionId],
      ),
    ).resolves.toBeDefined();

    await expect(
      client.pool.query(
        `UPDATE source_extraction
         SET status = 'succeeded', completed_at = now(), extracted_text_hash = $2
         WHERE id = $1`,
        [sourceExtractionId, CONTENT_HASH],
      ),
    ).resolves.toBeDefined();

    await expectGuardFailure(
      client,
      `UPDATE source_extraction SET status = 'failed' WHERE id = $1`,
      [sourceExtractionId],
      /is terminal and immutable/i,
    );

    const failedExtractionId = await insertSourceExtraction(client, sourceDocumentId, "failed", 2);
    await expectGuardFailure(
      client,
      `UPDATE source_extraction SET failure_code = 'retry' WHERE id = $1`,
      [failedExtractionId],
      /is terminal and immutable/i,
    );
  }, 120_000);

  it("rejects any update to source_chunk", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const sourceDocumentId = await insertSourceDocument(client, seed);
    const sourceExtractionId = await insertSourceExtraction(client, sourceDocumentId);
    const chunkId = await insertSourceChunk(client, seed, sourceDocumentId, sourceExtractionId);

    await expectGuardFailure(
      client,
      `UPDATE source_chunk SET content = 'tampered' WHERE id = $1`,
      [chunkId],
      /archive-only: UPDATE is not permitted/i,
    );
  }, 120_000);

  it("permits IP review updates but rejects attestation/identity mutation on reference_artifact", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const sourceDocumentId = await insertSourceDocument(client, seed, { sourceType: "reference" });
    const referenceArtifactId = await insertReferenceArtifact(client, seed, sourceDocumentId);
    const otherUserId = randomUUID();
    await client.pool.query(
      `INSERT INTO "user" (id, organization_id, name, email) VALUES ($1, $2, $3, $4)`,
      [
        otherUserId,
        seed.organizationId,
        "Other Guard User",
        `source-vault-guard-other-${otherUserId}@atlashq.test`,
      ],
    );

    await expect(
      client.pool.query(
        `UPDATE reference_artifact
         SET ip_review_status = 'cleared', ip_review_reason = 'looks fine',
             ip_reviewed_by = $2, ip_reviewed_at = now()
         WHERE id = $1`,
        [referenceArtifactId, seed.userId],
      ),
    ).resolves.toBeDefined();

    await expectGuardFailure(
      client,
      `UPDATE reference_artifact SET attestation_text = 'tampered' WHERE id = $1`,
      [referenceArtifactId],
      /attestation\/identity is immutable/i,
    );
    await expectGuardFailure(
      client,
      `UPDATE reference_artifact SET attested_by = $2 WHERE id = $1`,
      [referenceArtifactId, otherUserId],
      /attestation\/identity is immutable/i,
    );
    await expectGuardFailure(
      client,
      `UPDATE reference_artifact SET source_url = 'https://example.test/tampered' WHERE id = $1`,
      [referenceArtifactId],
      /attestation\/identity is immutable/i,
    );
  }, 120_000);

  it("requires a non-empty attestation and defaults ip_review_status to not_reviewed", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const sourceDocumentId = await insertSourceDocument(client, seed, { sourceType: "reference" });
    const referenceArtifactId = await insertReferenceArtifact(client, seed, sourceDocumentId);

    const row = await client.pool.query<{ ip_review_status: string }>(
      `SELECT ip_review_status FROM reference_artifact WHERE id = $1`,
      [referenceArtifactId],
    );
    expect(row.rows[0]?.ip_review_status).toBe("not_reviewed");

    // Use a distinct source_document so the attestation-text check is isolated from the
    // one-to-one source_document_id unique constraint.
    const otherSourceDocumentId = await insertSourceDocument(client, seed, {
      contentHash: OTHER_CONTENT_HASH,
      sourceType: "reference",
    });

    let error: (Error & { code?: string }) | undefined;
    try {
      await client.pool.query(
        `INSERT INTO reference_artifact (
           id, source_document_id, organization_id, project_id, reference_kind, capture_method,
           access_type, intended_use, attestation_text, attestation_version, attested_by, attested_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
        [
          randomUUID(),
          otherSourceDocumentId,
          seed.organizationId,
          seed.projectId,
          "url",
          "manual_paste",
          "public",
          "inspiration",
          "   ",
          "v1",
          seed.userId,
        ],
      );
    } catch (failure) {
      error = failure as Error & { code?: string };
    }

    expect(error).toBeInstanceOf(Error);
    expect(error?.code).toBe("23514");
  }, 120_000);

  it("accepts a valid root document and a replacement that inherits organization/project/lineage", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const rootId = await insertSourceDocument(client, seed);
    const replacementId = await insertReplacementSourceDocument(client, seed, rootId);

    const rows = await client.pool.query<{
      id: string;
      lineage_id: string;
      version_number: number;
      supersedes_id: string | null;
    }>(
      `SELECT id, lineage_id, version_number, supersedes_id FROM source_document
       WHERE id IN ($1, $2) ORDER BY version_number`,
      [rootId, replacementId],
    );

    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]).toMatchObject({ id: rootId, lineage_id: rootId, version_number: 1 });
    expect(rows.rows[1]).toMatchObject({
      id: replacementId,
      lineage_id: rootId,
      version_number: 2,
      supersedes_id: rootId,
    });
  }, 120_000);

  it("rejects a root source_document with a version_number other than 1", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    await expectInsertGuardFailure(
      () => insertSourceDocument(db, currentSeed, { versionNumber: 2 }),
      /root row must start at version_number 1/i,
    );
  }, 120_000);

  it("rejects a root source_document whose lineage_id is not its own id", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    await expectInsertGuardFailure(
      () => insertSourceDocument(db, currentSeed, { lineageId: randomUUID() }),
      /root row must have lineage_id = id/i,
    );
  }, 120_000);

  it("rejects a replacement source_document referencing an unknown predecessor", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    await expectInsertGuardFailure(
      () =>
        insertSourceDocument(db, currentSeed, {
          supersedesId: randomUUID(),
          lineageId: randomUUID(),
          versionNumber: 2,
        }),
      /supersedes unknown predecessor/i,
    );
  }, 120_000);

  it("rejects a replacement source_document that skips a version number", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    const rootId = await insertSourceDocument(db, currentSeed);

    await expectInsertGuardFailure(
      () => insertReplacementSourceDocument(db, currentSeed, rootId, { versionNumber: 3 }),
      /must be exactly one version after predecessor/i,
    );
  }, 120_000);

  it("rejects a replacement source_document whose predecessor belongs to a different project", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    const rootId = await insertSourceDocument(db, currentSeed);
    const otherProjectId = await insertProject(
      db,
      currentSeed.organizationId,
      currentSeed.userId,
      "Cross Project Guard Target",
    );

    await expectInsertGuardFailure(
      () =>
        insertReplacementSourceDocument(db, currentSeed, rootId, {
          projectId: otherProjectId,
        }),
      /must share organization_id\/project_id\/lineage_id with predecessor/i,
    );
  }, 120_000);

  it("rejects a source_document whose created_by does not belong to its organization", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    const otherSeed = await seedOrgProjectUser(db, "Other Tenant");

    await expectInsertGuardFailure(
      () => insertSourceDocument(db, currentSeed, { createdBy: otherSeed.userId }),
      /created_by .* does not belong to organization/i,
    );
  }, 120_000);

  it("rejects a source_upload_session whose actor does not belong to its organization", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    const otherSeed = await seedOrgProjectUser(db, "Other Tenant");

    await expectInsertGuardFailure(
      () =>
        db.pool.query(
          `INSERT INTO source_upload_session (
             id, organization_id, project_id, actor_id, intake_mode, expected_content_hash,
             expires_at, idempotency_key
           ) VALUES ($1, $2, $3, $4, $5, $6, now() + interval '1 hour', $7)`,
          [
            randomUUID(),
            currentSeed.organizationId,
            currentSeed.projectId,
            otherSeed.userId,
            "file_upload",
            CONTENT_HASH,
            `idem-${randomUUID()}`,
          ],
        ),
      /actor .* does not belong to organization/i,
    );
  }, 120_000);

  it("rejects a reference_artifact against a source_document that is not source_type = 'reference'", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    const documentId = await insertSourceDocument(db, currentSeed);

    await expectInsertGuardFailure(
      () => insertReferenceArtifact(db, currentSeed, documentId),
      /must have source_type = 'reference'/i,
    );
  }, 120_000);

  it("rejects a reference_artifact whose organization/project does not match its source_document", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    const referenceDocumentId = await insertSourceDocument(db, currentSeed, {
      sourceType: "reference",
    });
    const otherProjectId = await insertProject(
      db,
      currentSeed.organizationId,
      currentSeed.userId,
      "Cross Project Reference Target",
    );

    await expectInsertGuardFailure(
      () =>
        insertReferenceArtifact(db, currentSeed, referenceDocumentId, {
          projectId: otherProjectId,
        }),
      /organization\/project must match source_document/i,
    );
  }, 120_000);

  it("rejects a source_chunk whose source_extraction belongs to a different source_document", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    const documentAId = await insertSourceDocument(db, currentSeed);
    const documentBId = await insertSourceDocument(db, currentSeed);
    const extractionForDocumentBId = await insertSourceExtraction(db, documentBId);

    await expectInsertGuardFailure(
      () => insertSourceChunk(db, currentSeed, documentAId, extractionForDocumentBId),
      /source_extraction .* must belong to source_document/i,
    );
  }, 120_000);

  it("rejects a source_chunk whose organization/project does not match its source_document", async () => {
    if (!client || !seed) throw new Error("test not initialized");
    const db = client;
    const currentSeed = seed;
    const documentId = await insertSourceDocument(db, currentSeed);
    const extractionId = await insertSourceExtraction(db, documentId);
    const otherProjectId = await insertProject(
      db,
      currentSeed.organizationId,
      currentSeed.userId,
      "Cross Project Chunk Target",
    );

    await expectInsertGuardFailure(
      () =>
        insertSourceChunk(db, currentSeed, documentId, extractionId, {
          projectId: otherProjectId,
        }),
      /organization\/project must match source_document/i,
    );
  }, 120_000);
});
