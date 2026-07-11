import { extractDocx } from "./docx-adapter.js";
import { extractImageMetadata } from "./image-adapter.js";
import { extractPdf } from "./pdf-adapter.js";
import { extractPptx } from "./pptx-adapter.js";
import { extractSpreadsheet } from "./sheet-adapter.js";
import { extractPlainText } from "./text-adapter.js";
import { type AdapterResult, UnsupportedFormatError } from "./types.js";
import { assertSafeZipContainer } from "./zip-safety.js";

/** `source_document_file.format` values backed by a ZIP/OOXML container needing archive-bomb checks. */
const ZIP_CONTAINER_FORMATS = new Set(["docx", "xlsx", "pptx"]);

/**
 * Runs the deterministic parser adapter for `format` against `buffer`. Office ZIP containers are
 * validated with {@link assertSafeZipContainer} immediately before their parser runs (defense in
 * depth alongside the verify-and-scan pre-check), so a hostile archive can never reach
 * `mammoth`/`xlsx`/`officeparser`'s own unzip logic (module-02 §6.10, §9).
 */
export async function runExtractionAdapter(buffer: Buffer, format: string): Promise<AdapterResult> {
  if (ZIP_CONTAINER_FORMATS.has(format)) {
    assertSafeZipContainer(buffer);
  }

  switch (format) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "xlsx":
      return extractSpreadsheet(buffer, "xlsx");
    case "csv":
      return extractSpreadsheet(buffer, "csv");
    case "pptx":
      return extractPptx(buffer);
    case "txt":
    case "md":
      return extractPlainText(buffer);
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return extractImageMetadata(buffer);
    default:
      throw new UnsupportedFormatError(format);
  }
}

export { CHUNKER_VERSION, type Chunk, chunkSegments, type ExtractionSegment } from "./chunker.js";
export { type AdapterResult, CorruptContentError, UnsupportedFormatError } from "./types.js";
export { assertSafeZipContainer, UnsafeZipContainerError } from "./zip-safety.js";
