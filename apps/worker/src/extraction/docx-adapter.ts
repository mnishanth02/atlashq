import { createRequire } from "node:module";
import mammoth from "mammoth";
import type { ExtractionSegment } from "./chunker.js";
import { type AdapterResult, CorruptContentError } from "./types.js";

const require = createRequire(import.meta.url);
const mammothVersion = (require("mammoth/package.json") as { version: string }).version;

const BLOCK_TAG_PATTERN = /<(h[1-6]|p)>([\s\S]*?)<\/\1>/giu;
const TAG_PATTERN = /<[^>]+>/gu;

/**
 * DOCX adapter using `mammoth` (module-02 §6.10): converts to a small sanitized HTML subset
 * (`mammoth` already strips scripts/styles/macros) and groups deterministic text by
 * heading/paragraph block, in document order, with an `{ paragraphIndex, heading }` locator. Raw
 * HTML is never stored or rendered -- only the plain-text content of each block is kept.
 */
export async function extractDocx(buffer: Buffer): Promise<AdapterResult> {
  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;
  } catch (error) {
    throw new CorruptContentError("DOCX content could not be parsed.", { cause: error });
  }

  const segments: ExtractionSegment[] = [];
  let paragraphIndex = 0;
  let match: RegExpExecArray | null = BLOCK_TAG_PATTERN.exec(html);

  while (match !== null) {
    const tagName = match[1] ?? "p";
    const innerHtml = match[2] ?? "";
    const text = decodeHtmlEntities(innerHtml.replace(TAG_PATTERN, " "))
      .replace(/\s+/gu, " ")
      .trim();

    if (text.length > 0) {
      segments.push({
        text,
        locator: { paragraphIndex, heading: tagName !== "p" },
      });
      paragraphIndex += 1;
    }

    match = BLOCK_TAG_PATTERN.exec(html);
  }

  return {
    segments,
    parserManifest: [{ name: "mammoth", version: mammothVersion }],
    metadataOnly: false,
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}
