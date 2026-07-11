import { createRequire } from "node:module";
import type { ExtractionSegment } from "./chunker.js";
import { type AdapterResult, CorruptContentError } from "./types.js";

const require = createRequire(import.meta.url);
const officeparserVersion = (require("officeparser/package.json") as { version: string }).version;

type OfficeParserModule = {
  parseOfficeAsync(
    file: Buffer,
    config?: { newlineDelimiter?: string; ignoreNotes?: boolean; putNotesAtLast?: boolean },
  ): Promise<string>;
};

/**
 * PPTX adapter using `officeparser` (module-02 §6.10): extracts slide text plus speaker notes.
 * `officeparser` returns one flattened string (notes interleaved right after each slide's text,
 * `putNotesAtLast: false`) rather than a slide-indexed structure, so this adapter splits on its
 * newline delimiter into ordered blocks and assigns each a stable, deterministic `slideSequence`
 * locator (the position of the text block in parse order, not necessarily the PPTX's own slide
 * number metadata -- `officeparser` does not expose that).
 */
export async function extractPptx(buffer: Buffer): Promise<AdapterResult> {
  const officeparser = (await import("officeparser")) as unknown as OfficeParserModule;
  const delimiter = "\u241F";

  let text: string;
  try {
    text = await officeparser.parseOfficeAsync(buffer, {
      newlineDelimiter: delimiter,
      ignoreNotes: false,
      putNotesAtLast: false,
    });
  } catch (error) {
    throw new CorruptContentError("PPTX content could not be parsed.", { cause: error });
  }

  const blocks = text
    .split(delimiter)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const segments: ExtractionSegment[] = blocks.map((block, index) => ({
    text: block,
    locator: { slideSequence: index },
  }));

  return {
    segments,
    parserManifest: [{ name: "officeparser", version: officeparserVersion }],
    metadataOnly: false,
  };
}
