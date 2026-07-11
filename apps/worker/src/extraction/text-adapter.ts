import type { ExtractionSegment } from "./chunker.js";
import { type AdapterResult, CorruptContentError } from "./types.js";

/**
 * TXT/MD/transcript/email/manual-text adapter (module-02 §6.10). Decodes UTF-8 (fatal, so mojibake
 * or the wrong encoding surfaces as a corrupt-content failure rather than silently mangled text),
 * then splits on blank-line paragraph boundaries. Each paragraph is one segment with a stable
 * zero-based `paragraphIndex` locator.
 */
export function extractPlainText(buffer: Buffer): AdapterResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    throw new CorruptContentError("Text content is not valid UTF-8.", { cause: error });
  }

  const paragraphs = text
    .split(/\r?\n\s*\r?\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const segments: ExtractionSegment[] = paragraphs.map((paragraph, index) => ({
    text: paragraph,
    locator: { paragraphIndex: index },
  }));

  return {
    segments,
    parserManifest: [{ name: "atlashq-text-decoder", version: "1.0.0" }],
    metadataOnly: false,
  };
}
