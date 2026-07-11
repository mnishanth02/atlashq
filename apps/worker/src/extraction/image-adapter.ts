import { createRequire } from "node:module";
import sharp from "sharp";
import { type AdapterResult, CorruptContentError } from "./types.js";

const require = createRequire(import.meta.url);
const sharpVersion = (require("sharp/package.json") as { version: string }).version;

/**
 * Image adapter (png/jpg/jpeg/webp) using `sharp` (module-02 §6.10). OCR is out of scope for V1
 * (`ocr_processing_enabled` stays off), so this adapter records safe metadata only and produces
 * zero text segments/chunks -- `metadataOnly: true` tells the extract handler that zero chunks is
 * success, not a failure to investigate.
 */
export async function extractImageMetadata(buffer: Buffer): Promise<AdapterResult> {
  try {
    const metadata = await sharp(buffer).metadata();

    return {
      segments: [],
      parserManifest: [
        { name: "sharp", version: sharpVersion },
        {
          name: "image-metadata",
          version: `${metadata.format ?? "unknown"}:${metadata.width ?? 0}x${metadata.height ?? 0}`,
        },
      ],
      metadataOnly: true,
    };
  } catch (error) {
    throw new CorruptContentError("Image content could not be read.", { cause: error });
  }
}
