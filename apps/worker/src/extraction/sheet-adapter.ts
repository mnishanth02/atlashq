import * as XLSX from "xlsx";
import type { ExtractionSegment } from "./chunker.js";
import { type AdapterResult, CorruptContentError } from "./types.js";

const xlsxVersion = (XLSX as unknown as { version?: string }).version ?? "unknown";

const ROWS_PER_CHUNK = 50;

/**
 * XLSX/CSV adapter using `xlsx` (SheetJS) (module-02 §6.10). Reads every sheet as a row matrix and
 * groups rows into bounded, deterministic row-range segments with a `{ sheet, rowStart, rowEnd }`
 * (1-based, inclusive) locator -- never the full sheet as a single unbounded segment.
 */
export function extractSpreadsheet(buffer: Buffer, kind: "xlsx" | "csv"): AdapterResult {
  let workbook: XLSX.WorkBook;

  try {
    workbook =
      kind === "csv"
        ? XLSX.read(decodeCsv(buffer), { type: "string" })
        : XLSX.read(buffer, { type: "buffer" });
  } catch (error) {
    throw new CorruptContentError(`${kind.toUpperCase()} content could not be parsed.`, {
      cause: error,
    });
  }

  const segments: ExtractionSegment[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });

    for (let start = 0; start < rows.length; start += ROWS_PER_CHUNK) {
      const rowChunk = rows.slice(start, start + ROWS_PER_CHUNK);
      const text = rowChunk
        .map((row) => row.map((cell) => String(cell ?? "")).join(" | "))
        .join("\n")
        .trim();

      if (text.length === 0) {
        continue;
      }

      segments.push({
        text,
        locator: {
          sheet: sheetName,
          rowStart: start + 1,
          rowEnd: start + rowChunk.length,
        },
      });
    }
  }

  return {
    segments,
    parserManifest: [{ name: "xlsx", version: xlsxVersion }],
    metadataOnly: false,
  };
}

function decodeCsv(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    throw new CorruptContentError("CSV content is not valid UTF-8.", { cause: error });
  }
}
