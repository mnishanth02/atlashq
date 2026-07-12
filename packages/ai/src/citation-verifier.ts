import { z } from "zod";
import { sha256Hex } from "./json.js";

const requiredTextSchema = z.string().trim().min(1);

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const citationVerificationStatusValues = [
  "verified_exact",
  "downgraded_fuzzy",
  "failed",
] as const;
export type CitationVerificationStatus = (typeof citationVerificationStatusValues)[number];

export const citationNormalizationMode = "nfc-whitespace-smartpunct-v1";

export const citationVerificationWarningValues = ["multiple_match_warning"] as const;
export type CitationVerificationWarning = (typeof citationVerificationWarningValues)[number];

export const citationVerificationInputSchema = z
  .object({
    organizationId: requiredTextSchema,
    projectId: requiredTextSchema,
    snapshotId: requiredTextSchema,
    snapshotHash: requiredTextSchema,
    sourceDocumentId: requiredTextSchema,
    sourceChunkId: requiredTextSchema,
    chunkContent: z.string(),
    chunkContentHash: requiredTextSchema.optional(),
    locator: z.record(z.string(), jsonValueSchema).optional(),
    proposedQuote: z.string().min(1),
    quoteHash: requiredTextSchema.optional(),
  })
  .strict();

export type CitationVerificationInput = z.infer<typeof citationVerificationInputSchema>;

export type CitationFuzzyDiagnostic = {
  bestDistance: number;
  maxDistance: number;
  matchStartOffset: number;
  matchEndOffset: number;
  normalizedCandidate: string;
};

export type CitationVerificationResult = {
  organizationId: string;
  projectId: string;
  snapshotId: string;
  snapshotHash: string;
  sourceDocumentId: string;
  sourceChunkId: string;
  locator: Readonly<Record<string, unknown>> | null;
  chunkHash: string;
  quoteTextOriginal: string;
  quoteTextNormalized: string;
  quoteHash: string;
  verificationStatus: CitationVerificationStatus;
  normalizationMode: typeof citationNormalizationMode;
  matchStartOffset: number | null;
  matchEndOffset: number | null;
  warnings: readonly CitationVerificationWarning[];
  fuzzyDiagnostic: CitationFuzzyDiagnostic | null;
};

type OffsetSpan = { start: number; end: number };

type NormalizationResult = {
  normalizedText: string;
  spans: readonly OffsetSpan[];
};

const whitespaceRegex = /\p{White_Space}/u;
const combiningMarkRegex = /\p{Mark}/u;

const smartCharacterMap: Readonly<Record<string, string>> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2015": "-",
  "\u2212": "-",
  "\u2010": "-",
  "\u2011": "-",
};

function canonicalizeCharacter(character: string): string {
  if (whitespaceRegex.test(character)) {
    return " ";
  }

  return smartCharacterMap[character] ?? character;
}

function toIndexedCodePoints(value: string): readonly (OffsetSpan & { char: string })[] {
  const indexed: Array<OffsetSpan & { char: string }> = [];
  let offset = 0;

  for (const char of value) {
    const width = char.length;
    indexed.push({
      char,
      start: offset,
      end: offset + width,
    });
    offset += width;
  }

  return indexed;
}

function normalizeNfcWithOffsets(value: string): NormalizationResult {
  const indexed = toIndexedCodePoints(value);
  const normalizedChars: string[] = [];
  const spans: OffsetSpan[] = [];

  let cluster = "";
  let clusterStart = 0;
  let clusterEnd = 0;

  const flushCluster = () => {
    if (cluster.length === 0) {
      return;
    }

    const normalizedCluster = cluster.normalize("NFC");
    for (const normalizedChar of normalizedCluster) {
      normalizedChars.push(normalizedChar);
      spans.push({ start: clusterStart, end: clusterEnd });
    }

    cluster = "";
  };

  for (const point of indexed) {
    if (cluster.length === 0) {
      cluster = point.char;
      clusterStart = point.start;
      clusterEnd = point.end;
      continue;
    }

    if (combiningMarkRegex.test(point.char)) {
      cluster += point.char;
      clusterEnd = point.end;
      continue;
    }

    flushCluster();
    cluster = point.char;
    clusterStart = point.start;
    clusterEnd = point.end;
  }

  flushCluster();

  return {
    normalizedText: normalizedChars.join(""),
    spans,
  };
}

function normalizeForCitationMatch(value: string): NormalizationResult {
  const nfc = normalizeNfcWithOffsets(value);
  const normalizedChars: string[] = [];
  const normalizedSpans: OffsetSpan[] = [];

  for (let index = 0; index < nfc.normalizedText.length; index += 1) {
    const char = nfc.normalizedText[index] ?? "";
    const span = nfc.spans[index];
    if (!span || char.length === 0) {
      continue;
    }

    const canonicalChar = canonicalizeCharacter(char);

    if (canonicalChar === " " && normalizedChars.at(-1) === " ") {
      const previousSpan = normalizedSpans.at(-1);
      if (previousSpan) {
        previousSpan.end = span.end;
      }
      continue;
    }

    normalizedChars.push(canonicalChar);
    normalizedSpans.push({ start: span.start, end: span.end });
  }

  return {
    normalizedText: normalizedChars.join(""),
    spans: normalizedSpans,
  };
}

function findAllContiguousMatches(haystack: string, needle: string): readonly number[] {
  const matches: number[] = [];
  if (needle.length === 0) {
    return matches;
  }

  let offset = 0;
  while (offset <= haystack.length - needle.length) {
    const foundAt = haystack.indexOf(needle, offset);
    if (foundAt === -1) {
      break;
    }
    matches.push(foundAt);
    offset = foundAt + 1;
  }

  return matches;
}

function boundedLevenshteinDistance(
  source: string,
  target: string,
  maxDistance: number,
): number | null {
  const sourceLength = source.length;
  const targetLength = target.length;
  if (Math.abs(sourceLength - targetLength) > maxDistance) {
    return null;
  }

  const previous = new Array<number>(targetLength + 1);
  const current = new Array<number>(targetLength + 1);

  for (let index = 0; index <= targetLength; index += 1) {
    previous[index] = index;
  }

  for (let sourceIndex = 1; sourceIndex <= sourceLength; sourceIndex += 1) {
    current[0] = sourceIndex;
    let rowMin = current[0] ?? sourceIndex;
    const sourceChar = source[sourceIndex - 1] ?? "";

    for (let targetIndex = 1; targetIndex <= targetLength; targetIndex += 1) {
      const targetChar = target[targetIndex - 1] ?? "";
      const substitutionCost = sourceChar === targetChar ? 0 : 1;
      const insertionCost = (previous[targetIndex] ?? Number.MAX_SAFE_INTEGER) + 1;
      const deletionCost = (current[targetIndex - 1] ?? Number.MAX_SAFE_INTEGER) + 1;
      const substitutionBase = previous[targetIndex - 1] ?? Number.MAX_SAFE_INTEGER;
      const value = Math.min(insertionCost, deletionCost, substitutionBase + substitutionCost);
      current[targetIndex] = value;
      rowMin = Math.min(rowMin, value);
    }

    if (rowMin > maxDistance) {
      return null;
    }

    for (let targetIndex = 0; targetIndex <= targetLength; targetIndex += 1) {
      previous[targetIndex] = current[targetIndex] ?? Number.MAX_SAFE_INTEGER;
    }
  }

  const distance = previous[targetLength] ?? Number.MAX_SAFE_INTEGER;
  return distance <= maxDistance ? distance : null;
}

function buildBoundedFuzzyDiagnostic(
  chunkNormalized: NormalizationResult,
  quoteNormalized: string,
): CitationFuzzyDiagnostic | null {
  if (quoteNormalized.length < 3 || chunkNormalized.normalizedText.length < 3) {
    return null;
  }

  const maxDistance = Math.max(1, Math.floor(quoteNormalized.length * 0.18));
  const maxWindows = 128;
  const limit = Math.max(0, chunkNormalized.normalizedText.length - quoteNormalized.length);

  let best: CitationFuzzyDiagnostic | null = null;

  for (let start = 0; start <= limit && start < maxWindows; start += 1) {
    const candidate = chunkNormalized.normalizedText.slice(start, start + quoteNormalized.length);
    const distance = boundedLevenshteinDistance(quoteNormalized, candidate, maxDistance);
    if (distance === null) {
      continue;
    }

    const startSpan = chunkNormalized.spans[start];
    const endSpanIndex = start + quoteNormalized.length - 1;
    const endSpan = chunkNormalized.spans[endSpanIndex];
    if (!startSpan || !endSpan) {
      continue;
    }

    const diagnostic: CitationFuzzyDiagnostic = {
      bestDistance: distance,
      maxDistance,
      matchStartOffset: startSpan.start,
      matchEndOffset: endSpan.end,
      normalizedCandidate: candidate,
    };

    if (!best || diagnostic.bestDistance < best.bestDistance) {
      best = diagnostic;
      if (diagnostic.bestDistance === 0) {
        break;
      }
    }
  }

  return best;
}

export function verifyCitationDeterministically(
  input: CitationVerificationInput,
): CitationVerificationResult {
  const parsed = citationVerificationInputSchema.parse(input);
  const normalizedChunk = normalizeForCitationMatch(parsed.chunkContent);
  const normalizedQuote = normalizeForCitationMatch(parsed.proposedQuote);
  const quoteTextNormalized = normalizedQuote.normalizedText;
  const quoteHash = parsed.quoteHash ?? sha256Hex(quoteTextNormalized);
  const chunkHash = parsed.chunkContentHash ?? sha256Hex(parsed.chunkContent);

  const matches = findAllContiguousMatches(normalizedChunk.normalizedText, quoteTextNormalized);
  const warnings: CitationVerificationWarning[] = [];

  if (matches.length > 0) {
    const selected = matches[0];
    if (selected === undefined) {
      throw new TypeError("Citation match indexing failed.");
    }
    const startSpan = normalizedChunk.spans[selected];
    const endSpan = normalizedChunk.spans[selected + quoteTextNormalized.length - 1];
    if (!startSpan || !endSpan) {
      throw new TypeError(
        "Failed to map normalized citation offsets back to original chunk offsets.",
      );
    }

    if (matches.length > 1) {
      warnings.push("multiple_match_warning");
    }

    return {
      organizationId: parsed.organizationId,
      projectId: parsed.projectId,
      snapshotId: parsed.snapshotId,
      snapshotHash: parsed.snapshotHash,
      sourceDocumentId: parsed.sourceDocumentId,
      sourceChunkId: parsed.sourceChunkId,
      locator: parsed.locator ?? null,
      chunkHash,
      quoteTextOriginal: parsed.proposedQuote,
      quoteTextNormalized,
      quoteHash,
      verificationStatus: "verified_exact",
      normalizationMode: citationNormalizationMode,
      matchStartOffset: startSpan.start,
      matchEndOffset: endSpan.end,
      warnings,
      fuzzyDiagnostic: null,
    };
  }

  const fuzzyDiagnostic = buildBoundedFuzzyDiagnostic(normalizedChunk, quoteTextNormalized);
  return {
    organizationId: parsed.organizationId,
    projectId: parsed.projectId,
    snapshotId: parsed.snapshotId,
    snapshotHash: parsed.snapshotHash,
    sourceDocumentId: parsed.sourceDocumentId,
    sourceChunkId: parsed.sourceChunkId,
    locator: parsed.locator ?? null,
    chunkHash,
    quoteTextOriginal: parsed.proposedQuote,
    quoteTextNormalized,
    quoteHash,
    verificationStatus: fuzzyDiagnostic ? "downgraded_fuzzy" : "failed",
    normalizationMode: citationNormalizationMode,
    matchStartOffset: null,
    matchEndOffset: null,
    warnings,
    fuzzyDiagnostic,
  };
}
