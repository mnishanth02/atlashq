import { describe, expect, it } from "vitest";
import {
  buildCorruptPdfFixture,
  buildCsvFixture,
  buildDocxFixture,
  buildPdfFixture,
  buildPngFixture,
  buildPptxFixture,
  buildTextFixture,
  buildXlsxFixture,
} from "./__fixtures__/build-fixtures.js";
import { extractDocx } from "./docx-adapter.js";
import { extractImageMetadata } from "./image-adapter.js";
import { extractPdf } from "./pdf-adapter.js";
import { extractPptx } from "./pptx-adapter.js";
import { extractSpreadsheet } from "./sheet-adapter.js";
import { extractPlainText } from "./text-adapter.js";
import { CorruptContentError } from "./types.js";

describe("extractPdf", () => {
  it("extracts text per page with a page locator", async () => {
    const buffer = await buildPdfFixture();
    const result = await extractPdf(buffer);

    expect(result.metadataOnly).toBe(false);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]?.text).toContain("Atlas fixture page one.");
    expect(result.segments[0]?.locator).toEqual({ page: 1 });
    expect(result.segments[1]?.locator).toEqual({ page: 2 });
    expect(result.parserManifest[0]?.name).toBe("pdfjs-dist");
  });

  it("throws CorruptContentError for a corrupt PDF", async () => {
    await expect(extractPdf(buildCorruptPdfFixture())).rejects.toBeInstanceOf(CorruptContentError);
  });
});

describe("extractDocx", () => {
  it("extracts paragraph/heading text in document order", async () => {
    const buffer = await buildDocxFixture();
    const result = await extractDocx(buffer);

    expect(result.metadataOnly).toBe(false);
    expect(result.segments.length).toBeGreaterThanOrEqual(3);
    expect(result.segments.some((segment) => segment.locator.heading === true)).toBe(true);
    expect(result.segments.map((segment) => segment.text)).toContain(
      "Atlas fixture paragraph one.",
    );
    expect(result.parserManifest[0]?.name).toBe("mammoth");
  });

  it("throws CorruptContentError for a non-ZIP buffer", async () => {
    await expect(extractDocx(Buffer.from("not a zip"))).rejects.toBeInstanceOf(CorruptContentError);
  });
});

describe("extractSpreadsheet (xlsx)", () => {
  it("extracts bounded row-range segments per sheet", () => {
    const buffer = buildXlsxFixture();
    const result = extractSpreadsheet(buffer, "xlsx");

    expect(result.metadataOnly).toBe(false);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]?.locator).toEqual({ sheet: "Sheet1", rowStart: 1, rowEnd: 3 });
    expect(result.segments[0]?.text).toContain("alpha");
    expect(result.segments[1]?.locator).toEqual({ sheet: "Sheet2", rowStart: 1, rowEnd: 1 });
  });
});

describe("extractSpreadsheet (csv)", () => {
  it("extracts a single bounded row-range segment", () => {
    const buffer = buildCsvFixture();
    const result = extractSpreadsheet(buffer, "csv");

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toContain("alpha | 1");
  });
});

describe("extractPptx", () => {
  it("extracts slide text and speaker notes as ordered blocks", async () => {
    const buffer = await buildPptxFixture();
    const result = await extractPptx(buffer);

    expect(result.metadataOnly).toBe(false);
    expect(result.segments.length).toBeGreaterThanOrEqual(1);
    const combinedText = result.segments.map((segment) => segment.text).join(" ");
    expect(combinedText).toContain("Atlas fixture slide text.");
    expect(combinedText).toContain("Atlas fixture speaker notes.");
    expect(result.parserManifest[0]?.name).toBe("officeparser");
  });
});

describe("extractPlainText", () => {
  it("splits UTF-8 text on paragraph boundaries", () => {
    const result = extractPlainText(buildTextFixture());

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]?.locator).toEqual({ paragraphIndex: 0 });
    expect(result.segments[1]?.locator).toEqual({ paragraphIndex: 1 });
  });

  it("throws CorruptContentError for invalid UTF-8", () => {
    const invalidUtf8 = Buffer.from([0xff, 0xfe, 0xfd]);
    expect(() => extractPlainText(invalidUtf8)).toThrow(CorruptContentError);
  });
});

describe("extractImageMetadata", () => {
  it("returns zero segments and metadataOnly=true", async () => {
    const buffer = await buildPngFixture();
    const result = await extractImageMetadata(buffer);

    expect(result.metadataOnly).toBe(true);
    expect(result.segments).toHaveLength(0);
    expect(result.parserManifest.some((entry) => entry.name === "sharp")).toBe(true);
  });

  it("throws CorruptContentError for non-image bytes", async () => {
    await expect(extractImageMetadata(Buffer.from("not an image"))).rejects.toBeInstanceOf(
      CorruptContentError,
    );
  });
});
