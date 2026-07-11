import { describe, expect, it } from "vitest";
import {
  aggregateFileScanStates,
  hasCompleteExtractionMetadata,
  isCaptureSuccessorComplete,
} from "./source-vault-repository.js";

/**
 * `aggregateFileScanStates` is the pure cross-file decision rule `advanceSourceAfterFileScan`
 * relies on (module-02 §6.9): every uploaded file of a source must independently reach `clean` or
 * `not_required` before the source may enter extraction, malware always quarantines the whole
 * source regardless of any other file's state, and a plain validation failure (without malware)
 * fails the source -- but only once no sibling file is still infected. Tested standalone (no DB)
 * so the coordination rule itself is exhaustively covered independent of the transactional
 * plumbing around it.
 */
describe("aggregateFileScanStates", () => {
  it("is ready when every file is clean", () => {
    expect(aggregateFileScanStates([{ scanStatus: "clean" }, { scanStatus: "clean" }])).toEqual({
      kind: "ready",
    });
  });

  it("is ready when every file is not_required", () => {
    expect(
      aggregateFileScanStates([{ scanStatus: "not_required" }, { scanStatus: "not_required" }]),
    ).toEqual({ kind: "ready" });
  });

  it("is ready with a mix of clean and not_required files", () => {
    expect(
      aggregateFileScanStates([{ scanStatus: "clean" }, { scanStatus: "not_required" }]),
    ).toEqual({ kind: "ready" });
  });

  it("waits while any sibling file is still pending, even if others are already clean", () => {
    expect(aggregateFileScanStates([{ scanStatus: "clean" }, { scanStatus: "pending" }])).toEqual({
      kind: "waiting",
    });
  });

  it("quarantines the whole source when any file is infected", () => {
    expect(aggregateFileScanStates([{ scanStatus: "clean" }, { scanStatus: "infected" }])).toEqual({
      kind: "quarantine",
    });
  });

  it("fails the source when any file failed validation and none is infected", () => {
    expect(aggregateFileScanStates([{ scanStatus: "clean" }, { scanStatus: "failed" }])).toEqual({
      kind: "fail",
    });
  });

  it("prefers quarantine over fail when both infected and failed files are present", () => {
    expect(
      aggregateFileScanStates([
        { scanStatus: "infected" },
        { scanStatus: "failed" },
        { scanStatus: "clean" },
      ]),
    ).toEqual({ kind: "quarantine" });
  });

  it("waits for a single-file source whose only file is still pending", () => {
    expect(aggregateFileScanStates([{ scanStatus: "pending" }])).toEqual({ kind: "waiting" });
  });

  it("is ready for a single-file source whose only file is already clean", () => {
    expect(aggregateFileScanStates([{ scanStatus: "clean" }])).toEqual({ kind: "ready" });
  });
});

const SUCCESSOR_ROW = { id: "successor-1" } as never;

/**
 * `isCaptureSuccessorComplete` is the pure completeness rule `createReferenceCaptureSuccessor` and
 * the `capture-reference` handler's replay path both rely on: a successor is only ever safe to
 * treat as an idempotent replay once every one of its required companion rows -- reference_artifact,
 * source_document_file, and source_extraction -- committed together. Any single row missing means
 * an older, pre-atomic-transaction attempt crashed partway through and must never be silently
 * treated as complete.
 */
describe("isCaptureSuccessorComplete", () => {
  it("is complete when every required companion row is present", () => {
    expect(
      isCaptureSuccessorComplete({
        successor: SUCCESSOR_ROW,
        hasReferenceArtifact: true,
        hasSourceDocumentFile: true,
        extraction: { id: "extraction-1" } as never,
      }),
    ).toBe(true);
  });

  it("is incomplete when reference_artifact is missing", () => {
    expect(
      isCaptureSuccessorComplete({
        successor: SUCCESSOR_ROW,
        hasReferenceArtifact: false,
        hasSourceDocumentFile: true,
        extraction: { id: "extraction-1" } as never,
      }),
    ).toBe(false);
  });

  it("is incomplete when source_document_file is missing", () => {
    expect(
      isCaptureSuccessorComplete({
        successor: SUCCESSOR_ROW,
        hasReferenceArtifact: true,
        hasSourceDocumentFile: false,
        extraction: { id: "extraction-1" } as never,
      }),
    ).toBe(false);
  });

  it("is incomplete when source_extraction is missing", () => {
    expect(
      isCaptureSuccessorComplete({
        successor: SUCCESSOR_ROW,
        hasReferenceArtifact: true,
        hasSourceDocumentFile: true,
        extraction: null,
      }),
    ).toBe(false);
  });

  it("is incomplete when every companion row is missing", () => {
    expect(
      isCaptureSuccessorComplete({
        successor: SUCCESSOR_ROW,
        hasReferenceArtifact: false,
        hasSourceDocumentFile: false,
        extraction: null,
      }),
    ).toBe(false);
  });
});

/**
 * `hasCompleteExtractionMetadata` is the pure replay/backfill decision rule the `extract` handler
 * relies on: a non-empty `parser_manifest` (every adapter, including the metadata-only image
 * adapter, always returns at least one entry) signals the extraction was actually parsed, and
 * whenever chunks exist an `extracted_text_hash` must also be present -- otherwise the metadata is
 * incomplete (only possible from an older, pre-atomic-transaction run that crashed between
 * inserting chunks and writing this metadata) and must be recomputed/backfilled before preview is
 * ever enqueued.
 */
describe("hasCompleteExtractionMetadata", () => {
  it("is complete with a non-empty manifest and hash when chunks exist", () => {
    expect(
      hasCompleteExtractionMetadata(
        { parserManifest: [{ name: "text-adapter", version: "1.0.0" }], extractedTextHash: "a" },
        5,
      ),
    ).toBe(true);
  });

  it("is complete with a non-empty manifest and no hash when there are zero chunks (metadata-only extraction)", () => {
    expect(
      hasCompleteExtractionMetadata(
        { parserManifest: [{ name: "image-adapter", version: "1.0.0" }], extractedTextHash: null },
        0,
      ),
    ).toBe(true);
  });

  it("is incomplete when the parser manifest is empty", () => {
    expect(hasCompleteExtractionMetadata({ parserManifest: [], extractedTextHash: "a" }, 5)).toBe(
      false,
    );
  });

  it("is incomplete when parserManifest is null/not an array", () => {
    expect(
      hasCompleteExtractionMetadata({ parserManifest: null as never, extractedTextHash: "a" }, 5),
    ).toBe(false);
  });

  it("is incomplete when chunks exist but the extracted text hash is missing (crash-recovery case)", () => {
    expect(
      hasCompleteExtractionMetadata(
        { parserManifest: [{ name: "text-adapter", version: "1.0.0" }], extractedTextHash: null },
        3,
      ),
    ).toBe(false);
  });
});
