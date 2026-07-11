import { fileTypeFromBuffer } from "file-type";

/**
 * Actual-format verdicts the worker can reach after inspecting real bytes (module-02 §6.9, §9).
 * `text-like` covers formats `file-type` cannot reliably sniff (txt/md/csv) -- those are instead
 * validated as decodable UTF-8 without embedded NUL bytes.
 */
export type FormatVerificationResult =
  | { outcome: "match"; detectedExtension: string | null; detectedMimeType: string | null }
  | { outcome: "mismatch"; detectedExtension: string | null; detectedMimeType: string | null }
  | { outcome: "text-ok" }
  | { outcome: "text-invalid"; reason: string };

/** `source_document_file.format` values that are validated as text rather than sniffed by magic bytes. */
const TEXT_LIKE_FORMATS = new Set(["txt", "md", "csv"]);

/** Declared format -> the `file-type` extensions considered an authentic match. */
const FORMAT_EXTENSION_ALIASES: Record<string, readonly string[]> = {
  pdf: ["pdf"],
  docx: ["docx"],
  xlsx: ["xlsx"],
  pptx: ["pptx"],
  png: ["png"],
  jpg: ["jpg", "jpeg"],
  jpeg: ["jpg", "jpeg"],
  webp: ["webp"],
};

/**
 * Verifies that a file's real bytes match its declared `source_document_file.format`. Text-like
 * formats are validated by attempting a fatal UTF-8 decode (rejecting embedded NUL bytes, which
 * defeats naive text sniffing); every other format is verified via `file-type`'s magic-byte/
 * container sniffing (this also detects OOXML docx/xlsx/pptx by inspecting the ZIP entry names).
 */
export async function verifyDeclaredFormat(
  buffer: Buffer,
  declaredFormat: string,
): Promise<FormatVerificationResult> {
  if (TEXT_LIKE_FORMATS.has(declaredFormat)) {
    return verifyTextLike(buffer);
  }

  const detected = await fileTypeFromBuffer(buffer);
  const acceptableExtensions = FORMAT_EXTENSION_ALIASES[declaredFormat] ?? [declaredFormat];

  if (detected && acceptableExtensions.includes(detected.ext)) {
    return { outcome: "match", detectedExtension: detected.ext, detectedMimeType: detected.mime };
  }

  return {
    outcome: "mismatch",
    detectedExtension: detected?.ext ?? null,
    detectedMimeType: detected?.mime ?? null,
  };
}

function verifyTextLike(buffer: Buffer): FormatVerificationResult {
  if (buffer.includes(0x00)) {
    return { outcome: "text-invalid", reason: "File contains embedded NUL bytes." };
  }
  if (containsDisallowedControlCharacters(buffer)) {
    return { outcome: "text-invalid", reason: "File contains disallowed control characters." };
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return { outcome: "text-ok" };
  } catch {
    return { outcome: "text-invalid", reason: "File is not valid UTF-8 text." };
  }
}

function containsDisallowedControlCharacters(buffer: Buffer): boolean {
  for (const byte of buffer.values()) {
    if (byte <= 0x1f && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      return true;
    }
  }
  return false;
}
