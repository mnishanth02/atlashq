import { createHash, randomUUID } from "node:crypto";
import { sourceExtraction } from "@atlashq/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditRequestContext } from "../audit/audit-request-context.js";
import type { RequestSessionContext } from "../auth/session-context.js";
import { SourceDocumentsService } from "../features/source-documents/source-documents.service.js";
import {
  archiveSource,
  cancelUploadSession,
  confirmUploadSession,
  createManualSource,
  createProject,
  createReferenceSource,
  createUploadSession,
  createVersionUploadSession,
  findAuditEvents,
  getProjectDashboard,
  getSource,
  getSourceDownloadUrl,
  getSourcePreviewUrl,
  getSourceVaultCapabilities,
  getUploadSession,
  listExtractions,
  listSources,
  requestReferenceCapture,
  restoreSource,
  retrySourceProcessing,
  updateReferenceIpReview,
} from "./api.js";
import {
  createAgent,
  createOrganization,
  provisionAdmin,
  setOrganizationSettings,
  signUp,
} from "./fixtures.js";
import {
  InMemoryQueueDouble,
  InMemoryStorageDouble,
  TEST_SOURCE_VAULT_ENV,
} from "./source-vault-doubles.js";
import { useHarness } from "./suite.js";

const storage = new InMemoryStorageDouble();
const queue = new InMemoryQueueDouble();
const getHarness = useHarness({
  storage,
  documentQueue: queue,
  sourceVault: TEST_SOURCE_VAULT_ENV,
});

/** Deterministic 64-hex lowercase SHA-256 that also decides the fake file bytes. */
function sha256Hex(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

const REFERENCE_ATTESTATION_TEXT =
  "I confirm I have the right to provide this reference for functional inspiration only, not verbatim copying of protected design, text, or code.";

type Provisioned = {
  orgId: string;
  projectId: string;
  adminAgent: ReturnType<typeof createAgent>;
  adminId: string;
};

async function provisionOrgProject(
  harness: ReturnType<ReturnType<typeof useHarness>>,
  settings: Record<string, unknown> = { source_vault_writes_enabled: true },
): Promise<Provisioned> {
  const org = await createOrganization(harness.db);
  await setOrganizationSettings(harness.db, org.id, settings);
  const adminAgent = createAgent(harness);
  const { user: admin } = await provisionAdmin(harness, adminAgent, org.id);
  const project = await createProject(adminAgent, {
    name: `Vault ${randomUUID()}`,
    type: "internal",
    ownerId: admin.id,
  });
  expect(project.status).toBe(201);
  return { orgId: org.id, projectId: project.body.id, adminAgent, adminId: admin.id };
}

async function withForcedAuditFailure(
  harness: ReturnType<ReturnType<typeof useHarness>>,
  correlationId: string,
  run: () => Promise<void>,
) {
  await harness.client.pool.query(`
    CREATE OR REPLACE FUNCTION test_force_source_vault_audit_failure() RETURNS trigger AS $$
    BEGIN
      IF NEW.correlation_id = '${correlationId}' THEN
        RAISE EXCEPTION 'forced audit failure for rollback test';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  await harness.client.pool.query(`
    CREATE TRIGGER test_force_source_vault_audit_failure_trigger
    BEFORE INSERT ON audit_event
    FOR EACH ROW EXECUTE FUNCTION test_force_source_vault_audit_failure();
  `);

  try {
    await run();
  } finally {
    await harness.client.pool.query(
      "DROP TRIGGER IF EXISTS test_force_source_vault_audit_failure_trigger ON audit_event",
    );
    await harness.client.pool.query(
      "DROP FUNCTION IF EXISTS test_force_source_vault_audit_failure()",
    );
  }
}

function toRequestSessionContext(setup: Provisioned): RequestSessionContext {
  return {
    user: {
      id: setup.adminId,
      email: "admin@atlashq.test",
      name: "Admin User",
      organizationId: setup.orgId,
      organizationRole: "admin",
      status: "active",
    },
    session: {
      id: `session-${setup.adminId}`,
      expiresAt: new Date("2026-07-11T00:00:00.000Z"),
    },
  };
}

function toAuditContext(
  session: RequestSessionContext,
  correlationId: string,
): AuditRequestContext {
  return {
    actor: {
      organizationId: session.user.organizationId,
      actorId: session.user.id,
    },
    correlationId,
  };
}

function documentUploadPayload(overrides?: { title?: string; sha256?: string; byteSize?: number }) {
  return {
    sourceType: "document",
    documentFormat: "pdf",
    title: overrides?.title ?? "Alpha spec",
    tags: ["intake"],
    files: [
      {
        ordinal: 0,
        role: "primary",
        originalFileName: "alpha.pdf",
        format: "pdf",
        declaredMimeType: "application/pdf",
        byteSize: overrides?.byteSize ?? 1024,
        sha256: overrides?.sha256 ?? sha256Hex("alpha-primary"),
      },
    ],
  };
}

describe("integration: Source Vault", () => {
  beforeEach(() => {
    storage.reset();
    queue.jobs.length = 0;
  });

  it("rejects writes when the source_vault_writes_enabled flag is false and preserves reads", async () => {
    const harness = getHarness();
    // Feature flag OFF.
    const setup = await provisionOrgProject(harness, {});
    const objectCountBefore = storage.getObjectCount();

    const attempt = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload(),
    );
    expect(attempt.status).toBe(403);
    expect(attempt.body.code).toBe("SOURCE_STORAGE_UNAVAILABLE");

    const manual = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "Blocked manual",
      body: "this should not leak storage objects",
      tags: [],
    });
    expect(manual.status).toBe(403);

    const reference = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Blocked reference",
      reference: {
        referenceKind: "article",
        captureMethod: "manual_paste",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.test/blocked",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(reference.status).toBe(403);
    expect(storage.getObjectCount()).toBe(objectCountBefore);

    // Reads remain available even with writes disabled.
    const list = await listSources(setup.adminAgent, setup.projectId);
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
  });

  it("enforces sources:read/write RBAC across membership roles", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const outsiderAgent = createAgent(harness);
    await signUp(harness, outsiderAgent, { organizationId: setup.orgId });

    // Non-member should be forbidden from both read and write.
    const outsiderList = await listSources(outsiderAgent, setup.projectId);
    expect(outsiderList.status).toBe(403);
    const outsiderCreate = await createUploadSession(
      outsiderAgent,
      setup.projectId,
      documentUploadPayload(),
    );
    expect(outsiderCreate.status).toBe(403);

    // Admin (org admin bypasses membership) can perform both.
    const adminList = await listSources(setup.adminAgent, setup.projectId);
    expect(adminList.status).toBe(200);
  });

  it("creates an upload session with signed URLs and audits the create event", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const create = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: "Beta spec" }),
    );
    expect(create.status).toBe(201);
    expect(create.body.status).toBe("created");
    expect(create.body.files).toHaveLength(1);
    expect(create.body.files[0].signedUploadUrl).toMatch(/^http/);

    const audits = await findAuditEvents(harness.db, {
      entityType: "source_upload_session",
      entityId: create.body.id,
      action: "source.upload_session.create",
    });
    expect(audits).toHaveLength(1);
  });

  it("confirms an upload session idempotently and enqueues verify-and-scan", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    queue.jobs.length = 0;

    const create = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: "Confirm-me spec" }),
    );
    expect(create.status).toBe(201);
    const sessionId = create.body.id;
    const [file] = create.body.files;

    // Simulate the client PUT completing successfully.
    const uploadedKey = storage.signedUploadUrls.find(
      (u) => u.url === file.signedUploadUrl,
    )?.objectKey;
    expect(uploadedKey).toBeDefined();
    storage.seedUploadedObject(uploadedKey ?? "", file.byteSize, file.declaredMimeType);

    const confirm = await confirmUploadSession(setup.adminAgent, setup.projectId, sessionId);
    expect(confirm.status).toBe(200);
    expect(confirm.body.processingStatus).toBe("verification_pending");
    const sourceId = confirm.body.id;

    const jobKinds = queue.jobs.map((j) => j.kind);
    expect(jobKinds).toContain("verify-and-scan");
    const [job] = queue.jobs.filter((j) => j.kind === "verify-and-scan");
    expect(job?.payload.idempotencyKey).toMatch(/^[\w:.-]+$/i);

    // Second confirm is idempotent — returns the same source without re-enqueuing.
    const before = queue.jobs.length;
    const confirmAgain = await confirmUploadSession(setup.adminAgent, setup.projectId, sessionId);
    expect(confirmAgain.status).toBe(200);
    expect(confirmAgain.body.id).toBe(sourceId);
    expect(queue.jobs.length).toBe(before);
  });

  it("sets a single regular-file source's content_hash to exactly the file's own SHA-256", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    const fileSha256 = sha256Hex(`exact-hash-${randomUUID()}`);

    const create = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: "Exact hash spec", sha256: fileSha256 }),
    );
    expect(create.status).toBe(201);
    const [file] = create.body.files;
    expect(file.sha256).toBe(fileSha256);
    const uploadedKey = storage.signedUploadUrls.find(
      (u) => u.url === file.signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(uploadedKey ?? "", file.byteSize, file.declaredMimeType);

    const confirm = await confirmUploadSession(setup.adminAgent, setup.projectId, create.body.id);
    expect(confirm.status).toBe(200);
    // The canonical content_hash for a single regular-file source is that file's own SHA-256
    // exactly -- no manifest wrapping, no title/sourceType/format mixed in.
    expect(confirm.body.contentHash).toBe(fileSha256);

    // A different title with the byte-identical file content is still detected as a duplicate,
    // proving the identity is the file hash, not a title-tainted manifest hash.
    const differentTitleSameFile = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: "A totally different title", sha256: fileSha256 }),
    );
    expect(differentTitleSameFile.status).toBe(409);
    expect(differentTitleSameFile.body.code).toBe("SOURCE_DUPLICATE_CONFIRMATION_REQUIRED");
  });

  it("requires exact duplicate acknowledgement (409 without, success with match)", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    const dupSeed = sha256Hex(`dup-${randomUUID()}`);
    const dupTitle = "Duplicate manifest";

    // Create + confirm first source so a duplicate exists in the DB.
    const first = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: dupTitle, sha256: dupSeed }),
    );
    expect(first.status).toBe(201);
    const firstKey = storage.signedUploadUrls.find(
      (u) => u.url === first.body.files[0].signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(
      firstKey ?? "",
      first.body.files[0].byteSize,
      first.body.files[0].declaredMimeType,
    );
    const confirmed = await confirmUploadSession(setup.adminAgent, setup.projectId, first.body.id);
    expect(confirmed.status).toBe(200);
    const originalSourceId = confirmed.body.id;

    // Second attempt without acknowledgement — expect 409 with the stable code and structured
    // metadata carrying the current duplicate matches so the UI can render the confirmation.
    const without = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: dupTitle, sha256: dupSeed }),
    );
    expect(without.status).toBe(409);
    expect(without.body.code).toBe("SOURCE_DUPLICATE_CONFIRMATION_REQUIRED");
    expect(without.body.details).toHaveLength(1);
    expect(without.body.details[0]).toMatchObject({
      path: ["body", "duplicateAcknowledgement"],
      code: "duplicate_confirmation_required",
    });
    const matches = without.body.details[0].metadata?.matches as Array<{
      sourceId: string;
      title: string;
      versionNumber: number;
      isArchived: boolean;
      isSuperseded: boolean;
      contributorId: string;
      uploadedAt: string;
    }>;
    expect(Array.isArray(matches)).toBe(true);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      sourceId: originalSourceId,
      title: dupTitle,
      versionNumber: 1,
      isArchived: false,
      isSuperseded: false,
    });
    // Metadata must not carry sensitive material (signed URLs, session/object keys).
    const detailJson = JSON.stringify(without.body.details);
    expect(detailJson).not.toContain("X-Amz");
    expect(detailJson).not.toContain("signedUploadUrl");
    expect(detailJson).not.toContain(String(firstKey ?? ""));

    // Third attempt with the exact acknowledgement succeeds.
    const withAck = await createUploadSession(setup.adminAgent, setup.projectId, {
      ...documentUploadPayload({ title: dupTitle, sha256: dupSeed }),
      duplicateAcknowledgement: { acknowledgedMatchIds: [originalSourceId] },
    });
    expect(withAck.status).toBe(201);

    // Fourth attempt with a wrong acknowledgement — 409.
    const wrongAck = await createUploadSession(setup.adminAgent, setup.projectId, {
      ...documentUploadPayload({ title: dupTitle, sha256: dupSeed }),
      duplicateAcknowledgement: { acknowledgedMatchIds: [randomUUID()] },
    });
    expect(wrongAck.status).toBe(409);
  });

  it("cancels an upload session then refuses to confirm the canceled one", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const created = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: "To cancel" }),
    );
    expect(created.status).toBe(201);
    const sessionId = created.body.id;

    const cancel = await cancelUploadSession(setup.adminAgent, setup.projectId, sessionId, {
      reason: "user cancelled",
    });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe("canceled");

    const confirm = await confirmUploadSession(setup.adminAgent, setup.projectId, sessionId);
    expect(confirm.status).toBe(400);
    expect(confirm.body.code).toBe("SOURCE_UPLOAD_SESSION_EXPIRED");
  });

  it("creates a manual text source with deterministic hash and enqueues extract", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    queue.jobs.length = 0;

    const manual = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "Manual note",
      body: "hello vault",
      tags: [],
    });
    expect(manual.status).toBe(201);
    expect(manual.body.sourceType).toBe("manual");
    expect(manual.body.processingStatus).toBe("extraction_pending");
    // Manual sources must be enqueued with a real source_extraction row id so the worker can
    // attach chunk output. Grab the enqueued extract job's `sourceExtractionId` and verify a
    // matching row exists.
    const extractJob = queue.jobs.find(
      (j): j is Extract<(typeof queue.jobs)[number], { kind: "extract" }> =>
        j.kind === "extract" && j.payload.sourceDocumentId === manual.body.id,
    );
    expect(extractJob).toBeDefined();
    const extractionId = extractJob?.payload.sourceExtractionId ?? "";
    expect(extractionId).toMatch(/^[0-9a-f-]{36}$/);
    const rows = await harness.db
      .select({ id: sourceExtraction.id })
      .from(sourceExtraction)
      .where(eq(sourceExtraction.id, extractionId));
    expect(rows).toHaveLength(1);

    // Same title + body -> duplicate detection triggers requiring ack.
    const duplicate = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "Manual note",
      body: "hello vault",
      tags: [],
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("SOURCE_DUPLICATE_CONFIRMATION_REQUIRED");
  });

  it("identifies manual source duplicates by canonical body hash, independent of title", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const original = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "Original manual title",
      body: "identical manual body for title-independence check",
      tags: [],
    });
    expect(original.status).toBe(201);

    // Same body, a completely different title -> still a duplicate (module-02 §6.4): manual
    // source identity is the canonical body hash, never the mutable title.
    const differentTitleSameBody = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "A totally different title",
      body: "identical manual body for title-independence check",
      tags: [],
    });
    expect(differentTitleSameBody.status).toBe(409);
    expect(differentTitleSameBody.body.code).toBe("SOURCE_DUPLICATE_CONFIRMATION_REQUIRED");

    // Sanity: a genuinely different body is not treated as a duplicate.
    const differentBody = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "Original manual title",
      body: "an entirely unrelated manual body",
      tags: [],
    });
    expect(differentBody.status).toBe(201);
    expect(differentBody.body.contentHash).not.toBe(original.body.contentHash);
  });

  it("rolls back a manual object write when the transaction fails", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    const correlationId = `manual-rollback-${randomUUID()}`;
    const objectCountBefore = storage.getObjectCount();

    await withForcedAuditFailure(harness, correlationId, async () => {
      const response = await createManualSource(
        setup.adminAgent,
        setup.projectId,
        {
          title: "Manual rollback",
          body: `rollback body ${randomUUID()}`,
          tags: [],
        },
        correlationId,
      );

      expect(response.status).toBe(500);
      expect(response.body.code).toBe("INTERNAL_SERVER_ERROR");
    });

    expect(storage.rollbackCalls).toHaveLength(1);
    expect(storage.rollbackCalls[0]?.versionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(storage.getObjectCount()).toBe(objectCountBefore);

    const rows = await harness.client.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM source_document WHERE title = $1",
      ["Manual rollback"],
    );
    expect(rows.rows[0]?.count).toBe("0");
  });

  it("creates a URL-only reference source and stores a canonical snapshot", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const ref = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Reference URL",
      reference: {
        referenceKind: "article",
        captureMethod: "manual_paste",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.test/reference",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(ref.status).toBe(201);
    expect(ref.body.sourceType).toBe("reference");
    expect(ref.body.reference).toBeDefined();
    expect(ref.body.reference.ipReviewStatus).toBe("not_reviewed");
    expect(ref.body.files).toHaveLength(1);
    expect(ref.body.files[0].role).toBe("snapshot");
  });

  it("identifies URL/manual reference duplicates by immutable evidence, independent of title", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    const referenceEvidence = {
      referenceKind: "article" as const,
      captureMethod: "manual_paste" as const,
      accessType: "public" as const,
      intendedUse: "inspiration" as const,
      sourceUrl: "https://example.test/title-independent-reference",
    };

    const original = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Original reference title",
      reference: {
        ...referenceEvidence,
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(original.status).toBe(201);

    // Same kind/capture/access/intended-use/source URL, a different title -> still a duplicate
    // (module-02 §6.7): reference identity never includes the mutable title.
    const differentTitle = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "A completely different reference title",
      reference: {
        ...referenceEvidence,
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(differentTitle.status).toBe(409);
    expect(differentTitle.body.code).toBe("SOURCE_DUPLICATE_CONFIRMATION_REQUIRED");

    // Sanity: a genuinely different source URL is not treated as a duplicate.
    const differentUrl = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Original reference title",
      reference: {
        ...referenceEvidence,
        sourceUrl: "https://example.test/a-different-url",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(differentUrl.status).toBe(201);
    expect(differentUrl.body.contentHash).not.toBe(original.body.contentHash);
  });

  it("rolls back a reference snapshot write when the transaction fails", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    const correlationId = `reference-rollback-${randomUUID()}`;
    const objectCountBefore = storage.getObjectCount();

    await withForcedAuditFailure(harness, correlationId, async () => {
      const response = await createReferenceSource(
        setup.adminAgent,
        setup.projectId,
        {
          title: "Reference rollback",
          reference: {
            referenceKind: "article",
            captureMethod: "manual_paste",
            accessType: "public",
            intendedUse: "inspiration",
            sourceUrl: "https://example.test/reference-rollback",
            attestation: {
              attestationText: REFERENCE_ATTESTATION_TEXT,
              attestationVersion: "v1",
              acceptedAt: new Date().toISOString(),
            },
          },
        },
        correlationId,
      );

      expect(response.status).toBe(500);
      expect(response.body.code).toBe("INTERNAL_SERVER_ERROR");
    });

    expect(storage.rollbackCalls).toHaveLength(1);
    expect(storage.rollbackCalls[0]?.versionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(storage.getObjectCount()).toBe(objectCountBefore);

    const rows = await harness.client.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM source_document WHERE title = $1",
      ["Reference rollback"],
    );
    expect(rows.rows[0]?.count).toBe("0");
  });

  it("does not compensate manual or reference writes after a successful commit", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const manual = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "Manual success",
      body: `success body ${randomUUID()}`,
      tags: [],
    });
    expect(manual.status).toBe(201);
    expect(storage.rollbackCalls).toHaveLength(0);

    const reference = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Reference success",
      reference: {
        referenceKind: "article",
        captureMethod: "manual_paste",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.test/reference-success",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(reference.status).toBe(201);
    expect(storage.rollbackCalls).toHaveLength(0);
  });

  it("logs rollback compensation failure while preserving the original transaction error", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    const correlationId = `rollback-log-${randomUUID()}`;
    const service = harness.app.get(SourceDocumentsService);
    const warnSpy = vi.spyOn(
      service as object as { logWarn: (...args: unknown[]) => void },
      "logWarn",
    );
    storage.rollbackFailure = new Error("rollback failed");
    const session = toRequestSessionContext(setup);
    const auditContext = toAuditContext(session, correlationId);

    await withForcedAuditFailure(harness, correlationId, async () => {
      let thrown: unknown;
      try {
        await service.createManualSource(
          session,
          setup.projectId,
          {
            title: "Manual rollback warning",
            body: `warning body ${randomUUID()}`,
            tags: [],
          },
          auditContext,
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain('Failed query: insert into "audit_event"');
      expect((thrown as Error).message).not.toContain("rollback failed");
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "source.storage.rollback_failed",
      expect.objectContaining({ correlationId }),
      expect.objectContaining({
        organizationId: setup.orgId,
        projectId: setup.projectId,
        intake: "manual",
        bucket: storage.bucket,
        versioned: true,
        error: "rollback failed",
      }),
    );
  });

  it("blocks non-admin IP review and updates status for admin", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const ref = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Reference for IP review",
      reference: {
        referenceKind: "article",
        captureMethod: "manual_paste",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.test/ip",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(ref.status).toBe(201);
    const sourceId = ref.body.id;
    const version = ref.body.version;

    // Member without project:admin should be forbidden.
    const memberAgent = createAgent(harness);
    await signUp(harness, memberAgent, { organizationId: setup.orgId });
    const memberReview = await updateReferenceIpReview(memberAgent, setup.projectId, sourceId, {
      version,
      ipReviewStatus: "cleared",
      reason: "ok",
    });
    expect(memberReview.status).toBe(403);

    // Admin (org admin bypasses membership) succeeds.
    const adminReview = await updateReferenceIpReview(setup.adminAgent, setup.projectId, sourceId, {
      version,
      ipReviewStatus: "cleared",
      reason: "cleared",
    });
    expect(adminReview.status).toBe(200);
    expect(adminReview.body.reference.ipReviewStatus).toBe("cleared");

    // Optimistic concurrency: stale version should conflict.
    const stale = await updateReferenceIpReview(setup.adminAgent, setup.projectId, sourceId, {
      version,
      ipReviewStatus: "cleared",
      reason: "duplicate",
    });
    expect(stale.status).toBe(409);
  });

  it("gates the reference-capture endpoint on the single_page_capture_enabled flag", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness); // writes enabled, capture NOT enabled

    const ref = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Reference to capture",
      reference: {
        referenceKind: "article",
        captureMethod: "on_demand_single_page_capture",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.test/capture",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(ref.status).toBe(201);

    const blocked = await requestReferenceCapture(setup.adminAgent, setup.projectId, ref.body.id, {
      url: "https://example.test/capture",
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("SOURCE_CAPTURE_DISABLED");
  });

  it("archives and restores a source with optimistic concurrency", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const manual = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "Archive me",
      body: `archive body ${randomUUID()}`,
      tags: [],
    });
    expect(manual.status).toBe(201);
    const sourceId = manual.body.id;
    let version = manual.body.version;

    const archive = await archiveSource(setup.adminAgent, setup.projectId, sourceId, { version });
    expect(archive.status).toBe(200);
    expect(archive.body.archivedAt).not.toBeNull();
    version = archive.body.version;

    // List with default includeArchived=false hides the archived source.
    const listActive = await listSources(setup.adminAgent, setup.projectId);
    expect(listActive.body.items.map((it: { id: string }) => it.id)).not.toContain(sourceId);

    const restore = await restoreSource(setup.adminAgent, setup.projectId, sourceId, { version });
    expect(restore.status).toBe(200);
    expect(restore.body.archivedAt).toBeNull();
  });

  it("returns 409 SOURCE_NOT_READY for signed URLs until a source is ready", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const create = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: "Not-yet-ready" }),
    );
    expect(create.status).toBe(201);
    const key = storage.signedUploadUrls.find(
      (u) => u.url === create.body.files[0].signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(
      key ?? "",
      create.body.files[0].byteSize,
      create.body.files[0].declaredMimeType,
    );
    const confirmed = await confirmUploadSession(setup.adminAgent, setup.projectId, create.body.id);
    expect(confirmed.status).toBe(200);
    const sourceId = confirmed.body.id;
    const fileId = confirmed.body.files[0].id;

    const preview = await getSourcePreviewUrl(setup.adminAgent, setup.projectId, sourceId, fileId);
    expect(preview.status).toBe(409);
    expect(preview.body.code).toBe("SOURCE_NOT_READY");
  });

  it("issues preview/download URLs without auditing the URL value itself", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const reference = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Reference download audit",
      reference: {
        referenceKind: "article",
        captureMethod: "manual_paste",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.test/download-audit",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    expect(reference.status).toBe(201);
    const fileId = reference.body.files[0]?.id ?? "";

    const preview = await getSourcePreviewUrl(
      setup.adminAgent,
      setup.projectId,
      reference.body.id,
      fileId,
    );
    expect(preview.status).toBe(200);

    const download = await getSourceDownloadUrl(
      setup.adminAgent,
      setup.projectId,
      reference.body.id,
      fileId,
    );
    expect(download.status).toBe(200);

    const audits = await findAuditEvents(harness.db, {
      entityType: "source_document_file",
      entityId: fileId,
      action: "source.download_url.issued",
    });
    expect(audits).toHaveLength(1);
    const auditJson = JSON.stringify(audits[0]);
    expect(auditJson).not.toContain(download.body.url);
    expect(auditJson).not.toContain(preview.body.url);
  });

  it("isolates sources across organizations (cross-tenant)", async () => {
    const harness = getHarness();
    const orgA = await provisionOrgProject(harness);
    const orgB = await provisionOrgProject(harness);

    const manual = await createManualSource(orgA.adminAgent, orgA.projectId, {
      title: "Tenant A note",
      body: `tenant-a-${randomUUID()}`,
      tags: [],
    });
    expect(manual.status).toBe(201);
    const sourceId = manual.body.id;

    // Org B admin cannot see or read the source.
    const bList = await listSources(orgB.adminAgent, orgA.projectId);
    expect(bList.status).toBe(403);
    const bGet = await getSource(orgB.adminAgent, orgA.projectId, sourceId);
    expect(bGet.status).toBe(403);
  });

  it("never leaks cross-tenant extraction rows via a source id from another org/project", async () => {
    const harness = getHarness();
    const orgA = await provisionOrgProject(harness);
    const orgB = await provisionOrgProject(harness);

    const manual = await createManualSource(orgA.adminAgent, orgA.projectId, {
      title: "Tenant A note",
      body: `tenant-a-${randomUUID()}`,
      tags: [],
    });
    expect(manual.status).toBe(201);
    const sourceId = manual.body.id;

    // Sanity: the owning org can list its own extraction.
    const aExtractions = await listExtractions(orgA.adminAgent, orgA.projectId, sourceId);
    expect(aExtractions.status).toBe(200);
    expect(aExtractions.body.items.length).toBeGreaterThan(0);

    // Org B admin passes RBAC (their own project), but the source id belongs to org A.
    // The endpoint must treat this as not found and must never return org A's extraction
    // rows or leak any of org A's source metadata.
    const bExtractions = await listExtractions(orgB.adminAgent, orgB.projectId, sourceId);
    expect(bExtractions.status).toBe(404);
    const responseJson = JSON.stringify(bExtractions.body);
    expect(responseJson).not.toContain("Tenant A note");
    expect(responseJson).not.toContain(sourceId);

    // Also verify org B cannot reach the extractions by pairing the source id with org A's own
    // project id from an org B session (should be blocked by project RBAC, not by the endpoint).
    const bExtractionsWrongProject = await listExtractions(
      orgB.adminAgent,
      orgA.projectId,
      sourceId,
    );
    expect(bExtractionsWrongProject.status).toBe(403);
  });

  it("reports server-authoritative capability flags for a default (unflagged) organization", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness, {});

    const capabilities = await getSourceVaultCapabilities(setup.adminAgent, setup.projectId);
    expect(capabilities.status).toBe(200);
    expect(capabilities.body).toEqual({
      writesEnabled: false,
      singlePageCaptureEnabled: false,
      ocrProcessingEnabled: false,
      storageAvailable: true,
      queueAvailable: true,
    });
    // Never leak configuration/credentials -- only the five documented booleans.
    expect(Object.keys(capabilities.body).sort()).toEqual([
      "ocrProcessingEnabled",
      "queueAvailable",
      "singlePageCaptureEnabled",
      "storageAvailable",
      "writesEnabled",
    ]);
  });

  it("reports capability flags as true once the organization enables them", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness, {
      source_vault_writes_enabled: true,
      single_page_capture_enabled: true,
      ocr_processing_enabled: true,
    });

    const capabilities = await getSourceVaultCapabilities(setup.adminAgent, setup.projectId);
    expect(capabilities.status).toBe(200);
    expect(capabilities.body).toEqual({
      writesEnabled: true,
      singlePageCaptureEnabled: true,
      ocrProcessingEnabled: true,
      storageAvailable: true,
      queueAvailable: true,
    });
  });

  it("enforces sources:read permission and tenant scope on the capabilities endpoint", async () => {
    const harness = getHarness();
    const orgA = await provisionOrgProject(harness);
    const orgB = await provisionOrgProject(harness);

    // Unauthenticated caller.
    const anon = createAgent(harness);
    const unauthenticated = await getSourceVaultCapabilities(anon, orgA.projectId);
    expect(unauthenticated.status).toBe(401);

    // Org B admin has no membership on org A's project.
    const crossTenant = await getSourceVaultCapabilities(orgB.adminAgent, orgA.projectId);
    expect(crossTenant.status).toBe(403);
  });

  it("prevents forking the version chain when a newer version already exists", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const original = await createManualSource(setup.adminAgent, setup.projectId, {
      title: "Original doc",
      body: `original-${randomUUID()}`,
      tags: [],
    });
    expect(original.status).toBe(201);

    // Create a new version off the original — this becomes the new head after confirm.
    const v2Payload = documentUploadPayload({
      title: "Version 2",
      sha256: sha256Hex(`v2-${randomUUID()}`),
    });
    const v2 = await createVersionUploadSession(
      setup.adminAgent,
      setup.projectId,
      original.body.id,
      v2Payload,
    );
    expect(v2.status).toBe(201);
    const v2Key = storage.signedUploadUrls.find(
      (u) => u.url === v2.body.files[0].signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(
      v2Key ?? "",
      v2.body.files[0].byteSize,
      v2.body.files[0].declaredMimeType,
    );
    const v2Confirmed = await confirmUploadSession(setup.adminAgent, setup.projectId, v2.body.id);
    expect(v2Confirmed.status).toBe(200);

    // Try to create ANOTHER version off the original — should conflict, original is no longer head.
    const v3Attempt = await createVersionUploadSession(
      setup.adminAgent,
      setup.projectId,
      original.body.id,
      documentUploadPayload({
        title: "Fork attempt",
        sha256: sha256Hex(`fork-${randomUUID()}`),
      }),
    );
    expect(v3Attempt.status).toBe(409);
    expect(v3Attempt.body.code).toBe("SOURCE_SUPERSEDED");
  });

  // -------------------------------------------------------------------------
  // Follow-up correctness coverage
  // -------------------------------------------------------------------------

  it("rejects direct POST /references that includes files", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const attempt = await createReferenceSource(setup.adminAgent, setup.projectId, {
      title: "Bad direct reference",
      reference: {
        referenceKind: "screenshot_set",
        captureMethod: "user_uploaded_screenshot",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.test/x",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
      files: [
        {
          ordinal: 0,
          role: "primary",
          originalFileName: "shot.png",
          format: "png",
          declaredMimeType: "image/png",
          byteSize: 512,
          sha256: sha256Hex("shot"),
        },
      ],
    });
    expect(attempt.status).toBe(400);
  });

  it("requires a fresh duplicate ack when the duplicate set changes between session-create and confirm", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    queue.jobs.length = 0;

    const dupSeed = sha256Hex(`dupset-${randomUUID()}`);
    const dupTitle = "Dup set race";

    // Seed an initial confirmed source so a duplicate exists.
    const first = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: dupTitle, sha256: dupSeed }),
    );
    expect(first.status).toBe(201);
    const firstKey = storage.signedUploadUrls.find(
      (u) => u.url === first.body.files[0].signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(
      firstKey ?? "",
      first.body.files[0].byteSize,
      first.body.files[0].declaredMimeType,
    );
    const originalConfirm = await confirmUploadSession(
      setup.adminAgent,
      setup.projectId,
      first.body.id,
    );
    expect(originalConfirm.status).toBe(200);
    const originalId = originalConfirm.body.id;

    // Create a second session WITH ack for the original source.
    const second = await createUploadSession(setup.adminAgent, setup.projectId, {
      ...documentUploadPayload({ title: dupTitle, sha256: dupSeed }),
      duplicateAcknowledgement: { acknowledgedMatchIds: [originalId] },
    });
    expect(second.status).toBe(201);

    // Introduce a NEW matching source before confirm — the duplicate set now contains BOTH.
    const third = await createUploadSession(setup.adminAgent, setup.projectId, {
      ...documentUploadPayload({ title: dupTitle, sha256: dupSeed }),
      duplicateAcknowledgement: { acknowledgedMatchIds: [originalId] },
    });
    expect(third.status).toBe(201);
    const thirdKey = storage.signedUploadUrls.find(
      (u) => u.url === third.body.files[0].signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(
      thirdKey ?? "",
      third.body.files[0].byteSize,
      third.body.files[0].declaredMimeType,
    );
    const thirdConfirmed = await confirmUploadSession(
      setup.adminAgent,
      setup.projectId,
      third.body.id,
    );
    expect(thirdConfirmed.status).toBe(200);
    const newDupId = thirdConfirmed.body.id;

    // Now confirming the SECOND session (whose stored ack only covers `originalId`) must fail
    // because the current duplicate set is {originalId, newDupId} and the stored ack no longer
    // matches exactly.
    const secondKey = storage.signedUploadUrls.find(
      (u) => u.url === second.body.files[0].signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(
      secondKey ?? "",
      second.body.files[0].byteSize,
      second.body.files[0].declaredMimeType,
    );
    const staleConfirm = await confirmUploadSession(
      setup.adminAgent,
      setup.projectId,
      second.body.id,
    );
    expect(staleConfirm.status).toBe(409);
    expect(staleConfirm.body.code).toBe("SOURCE_DUPLICATE_CONFIRMATION_REQUIRED");
    // The confirm response must expose the current duplicate set via metadata so the client can
    // resubmit an exact acknowledgement without a probe round-trip.
    const staleMatches = staleConfirm.body.details?.[0]?.metadata?.matches as
      | Array<{ sourceId: string; title: string }>
      | undefined;
    expect(Array.isArray(staleMatches)).toBe(true);
    const staleIds = new Set((staleMatches ?? []).map((m) => m.sourceId));
    expect(staleIds.has(originalId)).toBe(true);
    expect(staleIds.has(newDupId)).toBe(true);

    // Retrying with the FULL current duplicate set as the acknowledgement succeeds.
    const freshAck = await confirmUploadSession(setup.adminAgent, setup.projectId, second.body.id, {
      duplicateAcknowledgement: { acknowledgedMatchIds: [originalId, newDupId] },
    });
    expect(freshAck.status).toBe(200);
  });

  it("reissues fresh signed URLs on active-session GET", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const create = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: "Reissue me" }),
    );
    expect(create.status).toBe(201);
    const originalUrl = create.body.files[0].signedUploadUrl;

    const fetched = await getUploadSession(setup.adminAgent, setup.projectId, create.body.id);
    expect(fetched.status).toBe(200);
    const reissuedUrl = fetched.body.files[0].signedUploadUrl;
    expect(reissuedUrl).toMatch(/^http/);
    expect(reissuedUrl).not.toEqual(originalUrl);
  });

  it("uploaded reference confirm writes an attestation audit event and links reference_artifact.audit_event_id", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    queue.jobs.length = 0;

    const create = await createUploadSession(setup.adminAgent, setup.projectId, {
      sourceType: "reference",
      title: "Uploaded screenshot ref",
      tags: [],
      reference: {
        referenceKind: "screenshot_set",
        captureMethod: "user_uploaded_screenshot",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.test/upload-ref",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
      files: [
        {
          ordinal: 0,
          role: "primary",
          originalFileName: "shot.png",
          format: "png",
          declaredMimeType: "image/png",
          byteSize: 256,
          sha256: sha256Hex(`upload-ref-${randomUUID()}`),
        },
      ],
    });
    expect(create.status).toBe(201);

    const file = create.body.files[0];
    const key = storage.signedUploadUrls.find((u) => u.url === file.signedUploadUrl)?.objectKey;
    storage.seedUploadedObject(key ?? "", file.byteSize, file.declaredMimeType);
    const confirmed = await confirmUploadSession(setup.adminAgent, setup.projectId, create.body.id);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.sourceType).toBe("reference");
    expect(confirmed.body.reference?.ipReviewStatus).toBe("not_reviewed");

    const attestationAudits = await findAuditEvents(harness.db, {
      entityType: "reference_artifact",
      entityId: confirmed.body.id,
      action: "source.reference.attestation",
    });
    expect(attestationAudits).toHaveLength(1);
    const attestationEvent = attestationAudits[0];
    if (!attestationEvent) throw new Error("attestation audit not written");
    const attestationBefore = attestationEvent.after as {
      attestationText: string;
      attestationVersion: string;
      attestedByActorId: string;
    };
    expect(attestationBefore.attestationText).toBe(REFERENCE_ATTESTATION_TEXT);
    expect(attestationBefore.attestationVersion).toBe("v1");

    // reference_artifact.audit_event_id must be non-null and point to the attestation event.
    const refRows = await harness.db.execute<{ audit_event_id: string | null }>(
      "select audit_event_id from reference_artifact where source_document_id = '" +
        confirmed.body.id +
        "'",
    );
    // pg driver returns { rows, rowCount }; drizzle passes it through as-is for `execute`.
    const rowsList = ((refRows as unknown as { rows?: unknown[] }).rows ??
      (refRows as unknown as unknown[])) as { audit_event_id: string | null }[];
    expect(rowsList).toHaveLength(1);
    const first = rowsList[0];
    if (!first) throw new Error("reference_artifact row not found");
    expect(first.audit_event_id).toBe(attestationEvent.id);
  });

  it("identifies uploaded (multi-file) reference duplicates by immutable evidence + ordered file hashes, independent of title", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);
    const sharedFileSha = sha256Hex(`shared-upload-ref-${randomUUID()}`);
    const uploadedReferencePayload = (title: string) => ({
      sourceType: "reference" as const,
      title,
      tags: [],
      reference: {
        referenceKind: "screenshot_set" as const,
        captureMethod: "user_uploaded_screenshot" as const,
        accessType: "public" as const,
        intendedUse: "inspiration" as const,
        sourceUrl: "https://example.test/title-independent-upload-ref",
        attestation: {
          attestationText: REFERENCE_ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: new Date().toISOString(),
        },
      },
      files: [
        {
          ordinal: 0,
          role: "primary" as const,
          originalFileName: "shot.png",
          format: "png" as const,
          declaredMimeType: "image/png",
          byteSize: 256,
          sha256: sharedFileSha,
        },
      ],
    });

    const first = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      uploadedReferencePayload("First upload-ref title"),
    );
    expect(first.status).toBe(201);
    const firstFile = first.body.files[0];
    const firstKey = storage.signedUploadUrls.find(
      (u) => u.url === firstFile.signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(firstKey ?? "", firstFile.byteSize, firstFile.declaredMimeType);
    const firstConfirmed = await confirmUploadSession(
      setup.adminAgent,
      setup.projectId,
      first.body.id,
    );
    expect(firstConfirmed.status).toBe(200);

    // Same reference evidence + same ordered file hash, a different title -> still a duplicate
    // (module-02 §6.3): the multi-file/reference manifest hash never includes title.
    const differentTitle = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      uploadedReferencePayload("A completely different upload-ref title"),
    );
    expect(differentTitle.status).toBe(409);
    expect(differentTitle.body.code).toBe("SOURCE_DUPLICATE_CONFIRMATION_REQUIRED");
  });

  it("wires live source counts into the project dashboard", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    const empty = await getProjectDashboard(setup.adminAgent, setup.projectId);
    expect(empty.status).toBe(200);
    expect(empty.body.cards.sourceDocuments.state).toBe("zero");
    expect(empty.body.cards.sourceDocuments.count).toBe(0);

    const manual = await createManualSource(setup.adminAgent, setup.projectId, {
      title: `Dash count ${randomUUID()}`,
      body: `dash body ${randomUUID()}`,
      tags: [],
    });
    expect(manual.status).toBe(201);

    const filled = await getProjectDashboard(setup.adminAgent, setup.projectId);
    expect(filled.status).toBe(200);
    expect(filled.body.cards.sourceDocuments.state).toBe("ready");
    expect(filled.body.cards.sourceDocuments.count).toBeGreaterThanOrEqual(1);
  });

  it("refuses retry on quarantined sources but allows retry on failed sources", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    // Create + confirm a document so we have a real source row to mutate.
    const create = await createUploadSession(
      setup.adminAgent,
      setup.projectId,
      documentUploadPayload({ title: "Retry policy" }),
    );
    expect(create.status).toBe(201);
    const key = storage.signedUploadUrls.find(
      (u) => u.url === create.body.files[0].signedUploadUrl,
    )?.objectKey;
    storage.seedUploadedObject(
      key ?? "",
      create.body.files[0].byteSize,
      create.body.files[0].declaredMimeType,
    );
    const confirmed = await confirmUploadSession(setup.adminAgent, setup.projectId, create.body.id);
    expect(confirmed.status).toBe(200);
    const sourceId = confirmed.body.id;

    // Force quarantined status via direct DB update to simulate worker outcome.
    await harness.db.execute(
      "update source_document set processing_status = 'quarantined', version = version + 1 where id = '" +
        sourceId +
        "'",
    );
    const refreshed = await getSource(setup.adminAgent, setup.projectId, sourceId);
    expect(refreshed.status).toBe(200);
    const version = refreshed.body.version;

    const badRetry = await retrySourceProcessing(setup.adminAgent, setup.projectId, sourceId, {
      version,
    });
    expect(badRetry.status).toBe(409);
    expect(badRetry.body.code).toBe("SOURCE_PROCESSING_NOT_RETRYABLE");

    // Now flip status to `failed`, which IS retry-eligible.
    await harness.db.execute(
      "update source_document set processing_status = 'failed', version = version + 1 where id = '" +
        sourceId +
        "'",
    );
    const refetched = await getSource(setup.adminAgent, setup.projectId, sourceId);
    const goodRetry = await retrySourceProcessing(setup.adminAgent, setup.projectId, sourceId, {
      version: refetched.body.version,
    });
    expect(goodRetry.status).toBe(200);
    expect(goodRetry.body.processingStatus).toBe("verification_pending");
  });

  it("returns 503 when confirm succeeds but post-commit enqueue fails, marking source failed for retry", async () => {
    const harness = getHarness();
    const setup = await provisionOrgProject(harness);

    // Save and monkey-patch the shared queue double so the very next addVerifyAndScan throws.
    const original = queue.addVerifyAndScan.bind(queue);
    let didThrow = false;
    queue.addVerifyAndScan = async (payload) => {
      if (!didThrow) {
        didThrow = true;
        throw new Error("simulated queue outage");
      }
      queue.jobs.push({ kind: "verify-and-scan", payload });
    };

    try {
      const create = await createUploadSession(
        setup.adminAgent,
        setup.projectId,
        documentUploadPayload({ title: "Queue outage recovery" }),
      );
      expect(create.status).toBe(201);
      const key = storage.signedUploadUrls.find(
        (u) => u.url === create.body.files[0].signedUploadUrl,
      )?.objectKey;
      storage.seedUploadedObject(
        key ?? "",
        create.body.files[0].byteSize,
        create.body.files[0].declaredMimeType,
      );
      const confirm = await confirmUploadSession(setup.adminAgent, setup.projectId, create.body.id);
      expect(confirm.status).toBe(503);
      expect(confirm.body.code).toBe("SOURCE_STORAGE_UNAVAILABLE");

      // The source row was still persisted and its state was flipped to `failed` (retryable).
      const list = await listSources(setup.adminAgent, setup.projectId);
      expect(list.status).toBe(200);
      const created = list.body.items.find(
        (it: { title: string }) => it.title === "Queue outage recovery",
      );
      expect(created).toBeDefined();
      expect(created.processingStatus).toBe("failed");

      const detail = await getSource(setup.adminAgent, setup.projectId, created.id);
      expect(detail.status).toBe(200);
      const retryOk = await retrySourceProcessing(setup.adminAgent, setup.projectId, created.id, {
        version: detail.body.version,
      });
      expect(retryOk.status).toBe(200);
    } finally {
      queue.addVerifyAndScan = original;
    }
  });
});
