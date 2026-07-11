import {
  auditEvent,
  type Database,
  type NewSourceChunk,
  type ParserManifestEntry,
  referenceArtifact,
  type SourceDocument,
  type SourceDocumentFile,
  type SourceExtraction,
  type SourceUploadFile,
  type SourceUploadSession,
  sourceChunk,
  sourceDocument,
  sourceDocumentFile,
  sourceExtraction,
  sourceUploadFile,
  sourceUploadSession,
} from "@atlashq/db";
import type { JsonObject } from "@atlashq/types";
import { and, asc, eq, sql } from "drizzle-orm";
import { IncompleteCaptureSuccessorError, InvalidJobDataError } from "../errors.js";
import { recordWorkerAuditEvent, type WorkerAuditInput } from "../runtime/audit.js";

export type ScopedSourceDocument = SourceDocument;

/** Loads a `source_document` scoped to org/project; throws `InvalidJobDataError` if out of scope. */
export async function requireSourceDocument(
  db: Database,
  input: { organizationId: string; projectId: string; sourceDocumentId: string },
): Promise<ScopedSourceDocument> {
  const rows = await db
    .select()
    .from(sourceDocument)
    .where(
      and(
        eq(sourceDocument.id, input.sourceDocumentId),
        eq(sourceDocument.organizationId, input.organizationId),
        eq(sourceDocument.projectId, input.projectId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new InvalidJobDataError(
      `source_document ${input.sourceDocumentId} was not found in organization/project scope.`,
    );
  }

  return row;
}

/**
 * Looks up the (at most one, enforced by `source_document_supersedes_id_uidx`) successor version
 * that already supersedes a given predecessor `source_document`. Used to detect a replayed
 * `capture-reference` job idempotently: once a successor exists for this predecessor, the job must
 * never attempt to fork a second one.
 */
export async function findSourceDocumentBySupersedesId(
  db: Database,
  supersedesId: string,
): Promise<SourceDocument | null> {
  const rows = await db
    .select()
    .from(sourceDocument)
    .where(eq(sourceDocument.supersedesId, supersedesId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * A `capture-reference` successor is only "complete" once every required companion row committed
 * together: its `reference_artifact`, its `source_document_file` screenshot, and its first
 * `source_extraction` row. `createReferenceCaptureSuccessor` writes all of them (plus the audit
 * event) in a single transaction, so under the new code path a successor is always either fully
 * present or entirely absent -- `extraction` is only ever `null` here for a successor left behind
 * by an older, pre-atomic-transaction run that crashed mid-write.
 */
export type CaptureSuccessorState = {
  successor: SourceDocument;
  hasReferenceArtifact: boolean;
  hasSourceDocumentFile: boolean;
  extraction: SourceExtraction | null;
};

/**
 * Loads the full state of an existing `capture-reference` successor (if any) for a predecessor, so
 * the handler can decide -- before ever invoking the capture adapter again -- whether a replay is
 * dealing with a fully committed successor (safe to just re-derive/re-enqueue `extract`) or an
 * incomplete one left by an older crashed attempt (must fail loudly, never silently treated as
 * complete). This is a plain (non-locking) read used for the fast path; `createReferenceCaptureSuccessor`
 * performs the authoritative, row-locked check under a transaction to close the race between this
 * read and a concurrent capture attempt for the same predecessor.
 */
export async function findCaptureSuccessorState(
  db: Database,
  predecessorId: string,
): Promise<CaptureSuccessorState | null> {
  const successor = await findSourceDocumentBySupersedesId(db, predecessorId);
  if (!successor) {
    return null;
  }

  const [artifact, files, extraction] = await Promise.all([
    findReferenceArtifact(db, successor.id),
    listSourceDocumentFiles(db, successor.id),
    findLatestSourceExtraction(db, successor.id),
  ]);

  return {
    successor,
    hasReferenceArtifact: artifact !== null,
    hasSourceDocumentFile: files.length > 0,
    extraction,
  };
}

/** Returns whether every required `capture-reference` successor companion row is present. */
export function isCaptureSuccessorComplete(state: CaptureSuccessorState): boolean {
  return state.hasReferenceArtifact && state.hasSourceDocumentFile && state.extraction !== null;
}

export type CaptureSuccessorOutcome =
  | { kind: "created"; successor: SourceDocument; extraction: SourceExtraction }
  | { kind: "already_exists"; successor: SourceDocument; extraction: SourceExtraction };

/**
 * Atomically creates a `capture-reference` successor `source_document` version together with its
 * `reference_artifact` companion, its `source_document_file` screenshot, its first
 * `source_extraction` row, and the `source.capture.succeeded` audit event, all in one database
 * transaction (module-02 §6.8, §8.3) -- either every row commits together or none of them do, so a
 * worker crash mid-write can never leave a successor with some but not all of its required rows.
 *
 * The predecessor row is locked `FOR UPDATE` first so two concurrent `capture-reference` attempts
 * for the same predecessor serialize on this lock instead of racing the
 * `source_document_supersedes_id_uidx` unique constraint at commit time: whichever attempt loses
 * the race re-reads (within its own transaction) whatever the winner committed and returns it as
 * `already_exists` instead of attempting a second fork. If that pre-existing successor is missing
 * any of its required companion rows (an older, pre-atomic-transaction run crashed partway
 * through), this throws {@link IncompleteCaptureSuccessorError} rather than ever treating it as
 * complete.
 */
export async function createReferenceCaptureSuccessor(
  db: Database,
  input: {
    predecessorId: string;
    successor: {
      organizationId: string;
      projectId: string;
      lineageId: string;
      versionNumber: number;
      sourceType: string;
      documentFormat: string | null;
      title: string;
      notes: string | null;
      tags: string[];
      provenanceDate: Date | null;
      contentHash: string;
      processingStatus: string;
      createdBy: string;
    };
    referenceArtifact: {
      referenceKind: string;
      captureMethod: string;
      accessType: string;
      intendedUse: string;
      sourceUrl: string | null;
      attestationText: string;
      attestationVersion: string;
      attestedBy: string;
      attestedAt: Date;
      capturedAt: Date;
    };
    file: {
      ordinal: number;
      role: string;
      originalFileName: string;
      downloadFileName: string;
      format: string;
      declaredMimeType: string;
      byteSize: number;
      sha256: string;
      objectKey: string;
      objectVersionId: string;
      scanStatus: string;
    };
    chunkerVersion: string;
    audit: {
      organizationId: string;
      actorId: string;
      correlationId: string;
      projectId?: string;
      action: string;
      after?: JsonObject | null;
    };
  },
): Promise<CaptureSuccessorOutcome> {
  return db.transaction(async (tx) => {
    // Row lock: serializes concurrent capture attempts for the same predecessor.
    await tx
      .select({ id: sourceDocument.id })
      .from(sourceDocument)
      .where(eq(sourceDocument.id, input.predecessorId))
      .for("update");

    const existingRows = await tx
      .select()
      .from(sourceDocument)
      .where(eq(sourceDocument.supersedesId, input.predecessorId))
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      const [artifactRow] = await tx
        .select({ id: referenceArtifact.id })
        .from(referenceArtifact)
        .where(eq(referenceArtifact.sourceDocumentId, existing.id))
        .limit(1);
      const fileRows = await tx
        .select({ id: sourceDocumentFile.id })
        .from(sourceDocumentFile)
        .where(eq(sourceDocumentFile.sourceDocumentId, existing.id))
        .limit(1);
      const extractionRows = await tx
        .select()
        .from(sourceExtraction)
        .where(eq(sourceExtraction.sourceDocumentId, existing.id))
        .orderBy(sql`${sourceExtraction.extractionVersion} desc`)
        .limit(1);

      if (!artifactRow || fileRows.length === 0 || !extractionRows[0]) {
        const missing = [
          artifactRow ? null : "reference_artifact",
          fileRows.length > 0 ? null : "source_document_file",
          extractionRows[0] ? null : "source_extraction",
        ].filter((value): value is string => value !== null);
        throw new IncompleteCaptureSuccessorError(
          `source_document ${existing.id} (successor of ${input.predecessorId}) is missing required companion row(s) [${missing.join(", ")}] from an incomplete prior capture attempt; manual repair is required before this job can be replayed.`,
        );
      }

      return { kind: "already_exists", successor: existing, extraction: extractionRows[0] };
    }

    const [successor] = await tx
      .insert(sourceDocument)
      .values({ ...input.successor, supersedesId: input.predecessorId })
      .returning();
    if (!successor) {
      throw new Error("source_document successor insert did not return the inserted row.");
    }

    const [artifact] = await tx
      .insert(referenceArtifact)
      .values({
        sourceDocumentId: successor.id,
        organizationId: input.successor.organizationId,
        projectId: input.successor.projectId,
        ipReviewStatus: "not_reviewed",
        ...input.referenceArtifact,
      })
      .returning();
    if (!artifact) {
      throw new Error("reference_artifact insert did not return the inserted row.");
    }

    const [file] = await tx
      .insert(sourceDocumentFile)
      .values({ sourceDocumentId: successor.id, ...input.file })
      .returning();
    if (!file) {
      throw new Error("source_document_file insert did not return the inserted row.");
    }

    const [extraction] = await tx
      .insert(sourceExtraction)
      .values({
        sourceDocumentId: successor.id,
        extractionVersion: 1,
        status: "pending",
        chunkerVersion: input.chunkerVersion,
      })
      .returning();
    if (!extraction) {
      throw new Error("source_extraction insert did not return the inserted row.");
    }

    await recordWorkerAuditEvent(tx, {
      organizationId: input.audit.organizationId,
      actorId: input.audit.actorId,
      action: input.audit.action,
      entityType: "source_document",
      entityId: successor.id,
      ...(input.audit.projectId !== undefined ? { projectId: input.audit.projectId } : {}),
      correlationId: input.audit.correlationId,
      after: input.audit.after ?? null,
    });

    return { kind: "created", successor, extraction };
  });
}

/** Loads a `source_document_file` scoped to its parent source document. */
export async function requireSourceDocumentFile(
  db: Database,
  input: { sourceDocumentId: string; sourceDocumentFileId: string },
): Promise<SourceDocumentFile> {
  const rows = await db
    .select()
    .from(sourceDocumentFile)
    .where(
      and(
        eq(sourceDocumentFile.id, input.sourceDocumentFileId),
        eq(sourceDocumentFile.sourceDocumentId, input.sourceDocumentId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new InvalidJobDataError(
      `source_document_file ${input.sourceDocumentFileId} was not found for source_document ${input.sourceDocumentId}.`,
    );
  }

  return row;
}

/** Loads the ordered original evidence files for a source document (primary first). */
export async function listSourceDocumentFiles(
  db: Database,
  sourceDocumentId: string,
): Promise<SourceDocumentFile[]> {
  return db
    .select()
    .from(sourceDocumentFile)
    .where(eq(sourceDocumentFile.sourceDocumentId, sourceDocumentId))
    .orderBy(sourceDocumentFile.ordinal);
}

/** Loads a `source_extraction` version row scoped to its parent source document. */
export async function requireSourceExtraction(
  db: Database,
  input: { sourceDocumentId: string; sourceExtractionId: string },
): Promise<SourceExtraction> {
  const rows = await db
    .select()
    .from(sourceExtraction)
    .where(
      and(
        eq(sourceExtraction.id, input.sourceExtractionId),
        eq(sourceExtraction.sourceDocumentId, input.sourceDocumentId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new InvalidJobDataError(
      `source_extraction ${input.sourceExtractionId} was not found for source_document ${input.sourceDocumentId}.`,
    );
  }

  return row;
}

/**
 * Loads the highest-version `source_extraction` row for a source document, or `null` if none
 * exists yet. Used for idempotent replay: both `capture-reference` (to re-derive the successor's
 * extraction id without recreating it) and the multi-file `verify-and-scan` coordinator (to detect
 * that an earlier "last file" run already created the one extraction version) rely on this instead
 * of blindly inserting again.
 */
export async function findLatestSourceExtraction(
  db: Database,
  sourceDocumentId: string,
): Promise<SourceExtraction | null> {
  const rows = await db
    .select()
    .from(sourceExtraction)
    .where(eq(sourceExtraction.sourceDocumentId, sourceDocumentId))
    .orderBy(sql`${sourceExtraction.extractionVersion} desc`)
    .limit(1);

  return rows[0] ?? null;
}

/** Loads an upload session scoped to org/project. */
export async function requireUploadSession(
  db: Database,
  input: { organizationId: string; projectId: string; uploadSessionId: string },
): Promise<SourceUploadSession> {
  const rows = await db
    .select()
    .from(sourceUploadSession)
    .where(
      and(
        eq(sourceUploadSession.id, input.uploadSessionId),
        eq(sourceUploadSession.organizationId, input.organizationId),
        eq(sourceUploadSession.projectId, input.projectId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new InvalidJobDataError(
      `source_upload_session ${input.uploadSessionId} was not found in organization/project scope.`,
    );
  }

  return row;
}

export async function listUploadSessionFiles(
  db: Database,
  uploadSessionId: string,
): Promise<SourceUploadFile[]> {
  return db
    .select()
    .from(sourceUploadFile)
    .where(eq(sourceUploadFile.uploadSessionId, uploadSessionId))
    .orderBy(sourceUploadFile.ordinal);
}

/** Fetches the one-to-one reference-artifact companion row for a `source_type = 'reference'` document. */
export async function findReferenceArtifact(db: Database, sourceDocumentId: string) {
  const rows = await db
    .select()
    .from(referenceArtifact)
    .where(eq(referenceArtifact.sourceDocumentId, sourceDocumentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateSourceDocumentProcessingStatus(
  db: Database,
  sourceDocumentId: string,
  status: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await db
    .update(sourceDocument)
    .set({ processingStatus: status, version: sql`${sourceDocument.version} + 1`, ...extra })
    .where(eq(sourceDocument.id, sourceDocumentId));
}

export type FileScanStatusRow = { scanStatus: string };

export type ScanAggregateOutcome =
  | { kind: "waiting" }
  | { kind: "quarantine" }
  | { kind: "fail" }
  | { kind: "ready" };

/**
 * Pure decision function over every `source_document_file.scan_status` sibling of one source
 * document (module-02 §6.9 multi-file screenshot sets: every uploaded file scans independently,
 * and the source may only enter extraction once every file is `clean` or `not_required`).
 * Malware always wins over a plain validation failure (both are terminal for the whole source),
 * and any file still `pending` keeps the source in the scan stage regardless of how many siblings
 * already finished. Exported standalone (no DB access) so the coordination rule itself is directly
 * unit-testable without a database.
 */
export function aggregateFileScanStates(files: FileScanStatusRow[]): ScanAggregateOutcome {
  if (files.some((file) => file.scanStatus === "infected")) {
    return { kind: "quarantine" };
  }
  if (files.some((file) => file.scanStatus === "failed")) {
    return { kind: "fail" };
  }
  if (files.every((file) => file.scanStatus === "clean" || file.scanStatus === "not_required")) {
    return { kind: "ready" };
  }
  return { kind: "waiting" };
}

export type FileScanUpdateInput = {
  sourceDocumentFileId: string;
  scanStatus: "clean" | "infected" | "failed";
  scanResult: JsonObject;
  scanSignatureVersion?: string | null;
};

export type SourceScanAdvanceResult =
  | { outcome: "waiting" }
  | { outcome: "quarantined" }
  | { outcome: "failed" }
  | { outcome: "extraction_ready"; extraction: SourceExtraction; alreadyExisted: boolean };

/**
 * Records one file's terminal scan outcome (when `fileUpdate` is supplied) and, in the same
 * row-locked transaction, evaluates every sibling `source_document_file` for the source to decide
 * whether the whole `source_document` may advance past the scan stage. This is the single
 * synchronization point multi-file sources (e.g. screenshot sets) rely on: whichever file's job
 * happens to finish scanning last is the one that observes every sibling as clean/not_required and
 * creates the (exactly one) `source_extraction` row -- no matter the arrival order or timing of
 * the individual per-file scans.
 *
 * `SELECT ... FOR UPDATE` on the parent `source_document` row serializes concurrent calls for
 * sibling files of the same source, so two "last file" jobs racing to finish at nearly the same
 * time can never both observe "every file clean" and both try to create the extraction row -- the
 * second transaction blocks until the first commits, then finds the extraction already created and
 * returns it (`alreadyExisted: true`) instead of forking a second version.
 *
 * A replayed call (omit `fileUpdate`, e.g. because the file already reached a terminal
 * `scan_status` on a prior attempt) still runs this same aggregate check, so a source that got
 * stuck because the worker crashed between recording a file's outcome and advancing the source can
 * always catch up idempotently on the next replay.
 */
export async function advanceSourceAfterFileScan(
  db: Database,
  input: {
    sourceDocumentId: string;
    chunkerVersion: string;
    fileUpdate?: FileScanUpdateInput;
  },
): Promise<SourceScanAdvanceResult> {
  return db.transaction(async (tx) => {
    // Row lock: serializes concurrent finalize attempts for sibling files of this one source.
    await tx
      .select({ id: sourceDocument.id })
      .from(sourceDocument)
      .where(eq(sourceDocument.id, input.sourceDocumentId))
      .for("update");

    if (input.fileUpdate) {
      await tx
        .update(sourceDocumentFile)
        .set({
          scanStatus: input.fileUpdate.scanStatus,
          scanResult: input.fileUpdate.scanResult,
          scanSignatureVersion: input.fileUpdate.scanSignatureVersion ?? null,
          scannedAt: new Date(),
        })
        .where(eq(sourceDocumentFile.id, input.fileUpdate.sourceDocumentFileId));
    }

    const files = await tx
      .select({ scanStatus: sourceDocumentFile.scanStatus })
      .from(sourceDocumentFile)
      .where(eq(sourceDocumentFile.sourceDocumentId, input.sourceDocumentId));

    const aggregate = aggregateFileScanStates(files);

    if (aggregate.kind === "quarantine") {
      await tx
        .update(sourceDocument)
        .set({ processingStatus: "quarantined", version: sql`${sourceDocument.version} + 1` })
        .where(eq(sourceDocument.id, input.sourceDocumentId));
      return { outcome: "quarantined" };
    }

    if (aggregate.kind === "fail") {
      await tx
        .update(sourceDocument)
        .set({ processingStatus: "failed", version: sql`${sourceDocument.version} + 1` })
        .where(eq(sourceDocument.id, input.sourceDocumentId));
      return { outcome: "failed" };
    }

    if (aggregate.kind === "waiting") {
      return { outcome: "waiting" };
    }

    // aggregate.kind === "ready": every sibling file is clean or not_required.
    const existingExtraction = await tx
      .select()
      .from(sourceExtraction)
      .where(eq(sourceExtraction.sourceDocumentId, input.sourceDocumentId))
      .orderBy(sql`${sourceExtraction.extractionVersion} desc`)
      .limit(1);

    if (existingExtraction[0]) {
      // A previous ("last file") run already advanced this source -- idempotent replay.
      return {
        outcome: "extraction_ready",
        extraction: existingExtraction[0],
        alreadyExisted: true,
      };
    }

    await tx
      .update(sourceDocument)
      .set({ processingStatus: "extraction_pending", version: sql`${sourceDocument.version} + 1` })
      .where(eq(sourceDocument.id, input.sourceDocumentId));

    const [extraction] = await tx
      .insert(sourceExtraction)
      .values({
        sourceDocumentId: input.sourceDocumentId,
        extractionVersion: 1,
        status: "pending",
        chunkerVersion: input.chunkerVersion,
      })
      .returning();

    if (!extraction) {
      throw new Error("source_extraction insert did not return the inserted row.");
    }

    return { outcome: "extraction_ready", extraction, alreadyExisted: false };
  });
}

export async function updateSourceExtraction(
  db: Database,
  sourceExtractionId: string,
  values: Partial<
    Pick<
      SourceExtraction,
      | "status"
      | "parserManifest"
      | "extractedTextHash"
      | "previewObjectKey"
      | "previewObjectVersionId"
      | "startedAt"
      | "completedAt"
      | "failureCode"
      | "failureDetail"
    >
  >,
): Promise<void> {
  await db.update(sourceExtraction).set(values).where(eq(sourceExtraction.id, sourceExtractionId));
}

/**
 * Pure decision function: an extraction's parser metadata is only "complete" once
 * `parser_manifest` has at least one entry (every adapter always returns a non-empty manifest,
 * even the metadata-only image adapter) and, whenever chunks exist, `extracted_text_hash` is also
 * set. Exported standalone (no DB access) so the `extract` handler's replay/backfill decision is
 * directly unit-testable, mirroring `aggregateFileScanStates` above.
 */
export function hasCompleteExtractionMetadata(
  extraction: Pick<SourceExtraction, "parserManifest" | "extractedTextHash">,
  chunkCount: number,
): boolean {
  const hasParserManifest =
    Array.isArray(extraction.parserManifest) && extraction.parserManifest.length > 0;
  if (!hasParserManifest) {
    return false;
  }
  if (chunkCount > 0 && !extraction.extractedTextHash) {
    return false;
  }
  return true;
}

export async function countSourceChunks(db: Database, sourceExtractionId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sourceChunk)
    .where(eq(sourceChunk.sourceExtractionId, sourceExtractionId));

  return rows[0]?.count ?? 0;
}

/** Loads every persisted `source_chunk.content` for one extraction, in sequence order. */
export async function listSourceChunkContentsInOrder(
  db: Database,
  sourceExtractionId: string,
): Promise<string[]> {
  const rows = await db
    .select({ content: sourceChunk.content })
    .from(sourceChunk)
    .where(eq(sourceChunk.sourceExtractionId, sourceExtractionId))
    .orderBy(asc(sourceChunk.sequence));

  return rows.map((row) => row.content);
}

/**
 * Atomically inserts every `source_chunk` row for an extraction and writes its
 * `parser_manifest`/`extracted_text_hash` metadata in a single transaction (module-02 §6.10, §8.5,
 * §8.6) -- either every chunk and the metadata commit together or neither does, so a worker crash
 * mid-write can never leave an extraction with some but not all of its chunks, or with chunks but
 * no parser metadata.
 *
 * The `source_extraction` row is locked `FOR UPDATE` first and the chunk count is re-checked
 * inside the transaction, so a replay racing (or recovering from) an earlier committed attempt
 * never re-inserts chunks -- doing so would violate `source_chunk_extraction_sequence_uidx` -- and
 * instead only (re-)writes the metadata columns. This same function backs both the first-time
 * parse (chunks + metadata written together) and the crash-recovery backfill path (chunks already
 * committed by an older, pre-atomic-transaction run; only the metadata still needs writing).
 */
export async function insertExtractionChunksAndMetadata(
  db: Database,
  input: {
    sourceExtractionId: string;
    chunks: NewSourceChunk[];
    parserManifest: ParserManifestEntry[];
    extractedTextHash: string | null;
  },
): Promise<{ chunkCount: number }> {
  return db.transaction(async (tx) => {
    // Row lock: serializes concurrent parse/backfill attempts for the same extraction version.
    await tx
      .select({ id: sourceExtraction.id })
      .from(sourceExtraction)
      .where(eq(sourceExtraction.id, input.sourceExtractionId))
      .for("update");

    const existingRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(sourceChunk)
      .where(eq(sourceChunk.sourceExtractionId, input.sourceExtractionId));
    const existingCount = existingRows[0]?.count ?? 0;

    if (existingCount === 0 && input.chunks.length > 0) {
      await tx.insert(sourceChunk).values(input.chunks);
    }

    await tx
      .update(sourceExtraction)
      .set({
        parserManifest: input.parserManifest,
        ...(input.extractedTextHash ? { extractedTextHash: input.extractedTextHash } : {}),
      })
      .where(eq(sourceExtraction.id, input.sourceExtractionId));

    return { chunkCount: existingCount > 0 ? existingCount : input.chunks.length };
  });
}

export type FinalizeExtractionPreviewInput = {
  sourceDocumentId: string;
  sourceExtractionId: string;
  /** Preview object already written to storage (outside this transaction), or `null` when no
   * server-rendered preview applies to this source (module-02 §6.10). Ignored on a `succeeded`
   * replay -- `source_extraction` is frozen once terminal, so the already-persisted preview
   * columns from the original commit are reused as-is. */
  preview: { previewObjectKey: string; previewObjectVersionId: string } | null;
  audit: Pick<WorkerAuditInput, "organizationId" | "actorId" | "projectId" | "correlationId">;
};

export type FinalizeExtractionPreviewOutcome =
  | { kind: "finalized"; extraction: SourceExtraction; sourceDocument: SourceDocument }
  | { kind: "already_finalized"; extraction: SourceExtraction; sourceDocument: SourceDocument }
  | { kind: "repaired"; extraction: SourceExtraction; sourceDocument: SourceDocument };

/**
 * Atomically applies the *final* terminal transition of a `source_extraction` -- optional preview
 * fields + `status = "succeeded"` + `completedAt` -- together with the `source_document` `ready`
 * transition and the `source.extraction.succeeded` audit event, all in one transaction (module-02
 * §6.10). Before this function existed, `generate-preview` issued these as three independent
 * writes; a crash between them could leave `source_extraction` permanently terminal (frozen by
 * `source_extraction_guard_update`) while `source_document` stayed stuck off `ready` forever and
 * the audit event was silently lost. Routing every caller through this one transaction makes that
 * particular partial state impossible to produce going forward.
 *
 * Both rows are locked `FOR UPDATE` first, then re-checked inside the transaction:
 *
 * - `extraction.status === "failed"` is left completely untouched (terminal failures are immutable
 *   and out of scope for preview finalization) and reported as `already_finalized`.
 * - `extraction.status === "succeeded"` is a replay. `source_extraction` can never be updated again
 *   (the guard trigger rejects any UPDATE once terminal), so this branch never touches it. If
 *   `source_document` is already `ready` *and* the audit event already exists, this is a true
 *   idempotent no-op (`already_finalized`). Otherwise it must be state left behind by an older,
 *   pre-transaction crash between the three former writes -- this is repaired in place (`ready` +
 *   audit insert, whichever is still missing) and reported as `repaired`.
 * - Any other (non-terminal) status is the normal first-time finalize: all three writes commit
 *   together and the result is reported as `finalized`.
 */
export async function finalizeExtractionPreview(
  db: Database,
  input: FinalizeExtractionPreviewInput,
): Promise<FinalizeExtractionPreviewOutcome> {
  return db.transaction(async (tx) => {
    const [extraction] = await tx
      .select()
      .from(sourceExtraction)
      .where(eq(sourceExtraction.id, input.sourceExtractionId))
      .for("update");
    if (!extraction) {
      throw new Error(
        `source_extraction ${input.sourceExtractionId} not found while finalizing preview.`,
      );
    }

    const [sourceDocumentRow] = await tx
      .select()
      .from(sourceDocument)
      .where(eq(sourceDocument.id, input.sourceDocumentId))
      .for("update");
    if (!sourceDocumentRow) {
      throw new Error(
        `source_document ${input.sourceDocumentId} not found while finalizing preview.`,
      );
    }

    if (extraction.status === "failed") {
      return { kind: "already_finalized", extraction, sourceDocument: sourceDocumentRow };
    }

    if (extraction.status === "succeeded") {
      const isDocumentReady = sourceDocumentRow.processingStatus === "ready";
      const existingAudit = await tx
        .select({ id: auditEvent.id })
        .from(auditEvent)
        .where(
          and(
            eq(auditEvent.entityType, "source_extraction"),
            eq(auditEvent.entityId, extraction.id),
            eq(auditEvent.action, "source.extraction.succeeded"),
          ),
        )
        .limit(1);
      const hasAudit = existingAudit.length > 0;

      if (isDocumentReady && hasAudit) {
        return { kind: "already_finalized", extraction, sourceDocument: sourceDocumentRow };
      }

      let repairedDocument = sourceDocumentRow;
      if (!isDocumentReady) {
        const [updated] = await tx
          .update(sourceDocument)
          .set({ processingStatus: "ready", version: sql`${sourceDocument.version} + 1` })
          .where(eq(sourceDocument.id, sourceDocumentRow.id))
          .returning();
        if (!updated) {
          throw new Error(`source_document ${sourceDocumentRow.id} update did not return a row.`);
        }
        repairedDocument = updated;
      }

      if (!hasAudit) {
        await recordWorkerAuditEvent(tx, {
          ...input.audit,
          action: "source.extraction.succeeded",
          entityType: "source_extraction",
          entityId: extraction.id,
          after: { previewObjectKey: extraction.previewObjectKey, repaired: true },
        });
      }

      return { kind: "repaired", extraction, sourceDocument: repairedDocument };
    }

    const [updatedExtraction] = await tx
      .update(sourceExtraction)
      .set({
        ...(input.preview
          ? {
              previewObjectKey: input.preview.previewObjectKey,
              previewObjectVersionId: input.preview.previewObjectVersionId,
            }
          : {}),
        status: "succeeded",
        completedAt: new Date(),
      })
      .where(eq(sourceExtraction.id, extraction.id))
      .returning();
    if (!updatedExtraction) {
      throw new Error(`source_extraction ${extraction.id} update did not return a row.`);
    }

    const [updatedDocument] = await tx
      .update(sourceDocument)
      .set({ processingStatus: "ready", version: sql`${sourceDocument.version} + 1` })
      .where(eq(sourceDocument.id, sourceDocumentRow.id))
      .returning();
    if (!updatedDocument) {
      throw new Error(`source_document ${sourceDocumentRow.id} update did not return a row.`);
    }

    await recordWorkerAuditEvent(tx, {
      ...input.audit,
      action: "source.extraction.succeeded",
      entityType: "source_extraction",
      entityId: updatedExtraction.id,
      after: { previewObjectKey: input.preview?.previewObjectKey ?? null },
    });

    return { kind: "finalized", extraction: updatedExtraction, sourceDocument: updatedDocument };
  });
}

export async function deleteUploadSessionFile(db: Database, id: string): Promise<void> {
  await db.delete(sourceUploadFile).where(eq(sourceUploadFile.id, id));
}

export async function deleteUploadSession(db: Database, id: string): Promise<void> {
  await db.delete(sourceUploadSession).where(eq(sourceUploadSession.id, id));
}

export async function updateUploadSessionStatus(
  db: Database,
  id: string,
  status: string,
): Promise<void> {
  await db.update(sourceUploadSession).set({ status }).where(eq(sourceUploadSession.id, id));
}
