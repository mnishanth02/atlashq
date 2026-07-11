import type { ExtractionSegment } from "./chunker.js";

/** One parser/library used to produce a given extraction, recorded in `source_extraction.parser_manifest`. */
export type ParserManifestEntry = {
  name: string;
  version: string;
};

/**
 * Output of a format-specific adapter. `segments` feed the shared deterministic chunker.
 * `metadataOnly` is set for formats that intentionally produce zero chunks (images while OCR is
 * off) so the handler can skip chunk insertion without treating it as a failure.
 */
export type AdapterResult = {
  segments: ExtractionSegment[];
  parserManifest: ParserManifestEntry[];
  metadataOnly: boolean;
};

export class UnsupportedFormatError extends Error {
  constructor(format: string) {
    super(`No deterministic extraction adapter is registered for format "${format}".`);
    this.name = "UnsupportedFormatError";
  }
}

export class CorruptContentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CorruptContentError";
  }
}
