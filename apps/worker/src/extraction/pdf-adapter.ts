import { createRequire } from "node:module";
import type { ExtractionSegment } from "./chunker.js";
import { type AdapterResult, CorruptContentError } from "./types.js";

const require = createRequire(import.meta.url);
// pdfjs-dist ships as ESM but ambient types are unavailable for the deep `legacy/build` entry
// point, so we resolve the package version via `require` (works for both ESM/CJS consumers) and
// import the module dynamically below.
const pdfjsPackageVersion = (require("pdfjs-dist/package.json") as { version: string }).version;

type PdfjsTextItem = { str?: string; hasEOL?: boolean };
type PdfjsTextContent = { items: PdfjsTextItem[] };
type PdfjsPage = { getTextContent(): Promise<PdfjsTextContent> };
type PdfjsDocument = { numPages: number; getPage(pageNumber: number): Promise<PdfjsPage> };
type PdfjsModule = {
  getDocument(options: Record<string, unknown>): { promise: Promise<PdfjsDocument> };
};

let pdfjsModulePromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs") as Promise<PdfjsModule>;
  return pdfjsModulePromise;
}

/**
 * PDF adapter using `pdfjs-dist` (module-02 §6.10): extracts text per page with a `{ page }`
 * locator. Runs with the worker disabled (`pdfjs-dist` supports synchronous-in-process parsing
 * when no `workerSrc` is configured) since the worker process has no browser/worker-thread pool.
 */
export async function extractPdf(buffer: Buffer): Promise<AdapterResult> {
  const pdfjs = await loadPdfjs();

  let document: PdfjsDocument;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    });
    document = await loadingTask.promise;
  } catch (error) {
    throw new CorruptContentError("PDF content could not be parsed.", { cause: error });
  }

  const segments: ExtractionSegment[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = joinTextItems(textContent.items);

    if (pageText.trim().length > 0) {
      segments.push({ text: pageText, locator: { page: pageNumber } });
    }
  }

  return {
    segments,
    parserManifest: [{ name: "pdfjs-dist", version: pdfjsPackageVersion }],
    metadataOnly: false,
  };
}

function joinTextItems(items: PdfjsTextItem[]): string {
  let text = "";
  for (const item of items) {
    text += item.str ?? "";
    if (item.hasEOL) {
      text += "\n";
    } else {
      text += " ";
    }
  }
  return text;
}
