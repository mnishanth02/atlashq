import type { SourceFormat } from "./sources-api";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MiB default per module-02 §5

const FORMAT_BY_EXTENSION: Record<string, SourceFormat> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
  xlsx: "xlsx",
  csv: "csv",
  pptx: "pptx",
  png: "png",
  jpg: "jpg",
  jpeg: "jpeg",
  webp: "webp",
};

const MIME_BY_FORMAT: Record<SourceFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const ACCEPTED_MIME_TYPES: readonly string[] = Array.from(new Set(Object.values(MIME_BY_FORMAT)));

const ACCEPTED_EXTENSIONS: readonly string[] = Object.keys(FORMAT_BY_EXTENSION).map(
  (ext) => `.${ext}`,
);

/**
 * Formats accepted for a screenshot-set reference. Screenshots are always
 * bitmap images; PDFs/DOCX/PPTX are excluded.
 */
const SCREENSHOT_FORMATS: readonly SourceFormat[] = ["png", "jpg", "jpeg", "webp"];
const SCREENSHOT_EXTENSIONS = SCREENSHOT_FORMATS.map((format) => `.${format}`);
const SCREENSHOT_MIME_TYPES = SCREENSHOT_FORMATS.map((format) => MIME_BY_FORMAT[format]);

export function acceptedMimeTypes(kind: "any" | "screenshot" = "any"): readonly string[] {
  return kind === "screenshot" ? SCREENSHOT_MIME_TYPES : ACCEPTED_MIME_TYPES;
}

export function acceptedExtensions(kind: "any" | "screenshot" = "any"): readonly string[] {
  return kind === "screenshot" ? SCREENSHOT_EXTENSIONS : ACCEPTED_EXTENSIONS;
}

export function maxUploadBytes(): number {
  return MAX_UPLOAD_BYTES;
}

export function formatFromFileName(fileName: string): SourceFormat | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = fileName.slice(dot + 1).toLowerCase();
  return FORMAT_BY_EXTENSION[ext] ?? null;
}

export function declaredMimeForFormat(format: SourceFormat): string {
  return MIME_BY_FORMAT[format];
}

export type FileValidation = { ok: true; format: SourceFormat } | { ok: false; reason: string };

export function validateUploadFile(
  file: { name: string; type: string; size: number },
  kind: "any" | "screenshot" = "any",
): FileValidation {
  const format = formatFromFileName(file.name);
  if (!format) {
    return {
      ok: false,
      reason: `Unsupported file type. Accepted extensions: ${acceptedExtensions(kind).join(", ")}.`,
    };
  }
  if (kind === "screenshot" && !SCREENSHOT_FORMATS.includes(format)) {
    return {
      ok: false,
      reason: `Screenshots must be PNG, JPEG, or WebP.`,
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `File exceeds the 100 MiB limit (${(file.size / (1024 * 1024)).toFixed(1)} MiB).`,
    };
  }
  return { ok: true, format };
}
