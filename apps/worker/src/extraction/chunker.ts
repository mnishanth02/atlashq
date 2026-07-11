import { createHash } from "node:crypto";
import type { JsonObject } from "@atlashq/types";

/**
 * One naturally-bounded unit of extracted text from a format adapter (a PDF page, a DOCX
 * paragraph/heading, a bounded spreadsheet row range, a PPTX slide's text+notes, or a plain-text
 * paragraph). `locator` is format-specific and merged as-is onto every chunk derived from this
 * segment (module-02 §6.10, §8.6).
 */
export type ExtractionSegment = {
  text: string;
  locator: JsonObject;
};

export type ChunkerOptions = {
  /** Hard cap on characters per chunk. Never exceeded, even mid-sentence. */
  maxChunkChars?: number;
  /** Characters of trailing context repeated at the start of the next split chunk. */
  overlapChars?: number;
};

export type Chunk = {
  sequence: number;
  content: string;
  characterCount: number;
  contentHash: string;
  locator: JsonObject;
};

/** Stable identifier for the deterministic chunking algorithm, recorded on every extraction row. */
export const CHUNKER_VERSION = "atlashq-chunker-v1";

const DEFAULT_MAX_CHUNK_CHARS = 1_800;
const DEFAULT_OVERLAP_CHARS = 200;

/**
 * Splits a sequence of extraction segments into deterministic, bounded chunks. Never AI/semantic:
 * pure string-length bookkeeping with paragraph/sentence-boundary preference (module-02 §6.10).
 *
 * - A segment that already fits under `maxChunkChars` becomes exactly one chunk (locator preserved
 *   as-is, no `part`).
 * - A longer segment is split preferring paragraph breaks (`\n\n`), then sentence breaks (`. `),
 *   then a hard character cut as a last resort, with `overlapChars` of trailing context repeated at
 *   the start of the next part so downstream retrieval never loses a sentence at a chunk boundary.
 *   Locators for split segments carry `part` (1-based) so they remain stable and orderable.
 * - Output `sequence` is the zero-based position across the whole extraction, matching the
 *   `source_chunk` unique `(source_extraction_id, sequence)` constraint.
 */
export function chunkSegments(
  segments: readonly ExtractionSegment[],
  options: ChunkerOptions = {},
): Chunk[] {
  const maxChunkChars = options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  if (maxChunkChars <= 0) {
    throw new RangeError("maxChunkChars must be positive.");
  }
  if (overlapChars < 0 || overlapChars >= maxChunkChars) {
    throw new RangeError("overlapChars must be non-negative and smaller than maxChunkChars.");
  }

  const chunks: Chunk[] = [];
  let sequence = 0;

  for (const segment of segments) {
    const normalized = segment.text.trim();
    if (normalized.length === 0) {
      continue;
    }

    if (normalized.length <= maxChunkChars) {
      chunks.push(buildChunk(sequence, normalized, segment.locator));
      sequence += 1;
      continue;
    }

    const parts = splitLongText(normalized, maxChunkChars, overlapChars);
    for (const [index, part] of parts.entries()) {
      chunks.push(buildChunk(sequence, part, { ...segment.locator, part: index + 1 }));
      sequence += 1;
    }
  }

  return chunks;
}

function buildChunk(sequence: number, content: string, locator: JsonObject): Chunk {
  return {
    sequence,
    content,
    characterCount: content.length,
    contentHash: createHash("sha256").update(content, "utf8").digest("hex"),
    locator,
  };
}

/**
 * Greedy bounded splitter: repeatedly takes the largest prefix (<= maxChunkChars) that ends on a
 * paragraph boundary, then a sentence boundary, then falls back to a hard cut. The next part
 * restarts `overlapChars` before the previous cut point (clamped to a boundary-safe minimum) so
 * consecutive parts always share trailing/leading context.
 */
function splitLongText(text: string, maxChunkChars: number, overlapChars: number): string[] {
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const remaining = text.length - cursor;
    if (remaining <= maxChunkChars) {
      parts.push(text.slice(cursor).trim());
      break;
    }

    const window = text.slice(cursor, cursor + maxChunkChars);
    const cutLength = findBestCut(window);
    const rawPart = text.slice(cursor, cursor + cutLength);
    parts.push(rawPart.trim());

    const nextStart = cursor + cutLength - overlapChars;
    cursor = nextStart > cursor ? nextStart : cursor + cutLength;
  }

  return parts.filter((part) => part.length > 0);
}

/** Finds the best boundary to cut on within `window`: paragraph > sentence > hard cap. */
function findBestCut(window: string): number {
  const paragraphBreak = window.lastIndexOf("\n\n");
  if (paragraphBreak > window.length * 0.4) {
    return paragraphBreak + 2;
  }

  const sentenceBreak = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf(".\n"),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (sentenceBreak > window.length * 0.4) {
    return sentenceBreak + 2;
  }

  const wordBreak = window.lastIndexOf(" ");
  if (wordBreak > window.length * 0.6) {
    return wordBreak + 1;
  }

  return window.length;
}
