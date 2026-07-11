import { describe, expect, it } from "vitest";
import {
  buildCsvFixture,
  buildDocxFixture,
  buildPdfFixture,
  buildPngFixture,
  buildTextFixture,
  buildXlsxFixture,
} from "../extraction/__fixtures__/build-fixtures.js";
import { verifyDeclaredFormat } from "./file-signature.js";

describe("verifyDeclaredFormat", () => {
  it("matches a real PDF against declared format pdf", async () => {
    const result = await verifyDeclaredFormat(await buildPdfFixture(), "pdf");
    expect(result.outcome).toBe("match");
  });

  it("matches a real DOCX against declared format docx", async () => {
    const result = await verifyDeclaredFormat(await buildDocxFixture(), "docx");
    expect(result.outcome).toBe("match");
  });

  it("matches a real XLSX against declared format xlsx", async () => {
    const result = await verifyDeclaredFormat(buildXlsxFixture(), "xlsx");
    expect(result.outcome).toBe("match");
  });

  it("matches a real PNG against declared format png", async () => {
    const result = await verifyDeclaredFormat(await buildPngFixture(), "png");
    expect(result.outcome).toBe("match");
  });

  it("flags a mismatch when a PNG is declared as pdf", async () => {
    const result = await verifyDeclaredFormat(await buildPngFixture(), "pdf");
    expect(result.outcome).toBe("mismatch");
  });

  it("flags a mismatch when a PDF is declared as docx", async () => {
    const result = await verifyDeclaredFormat(await buildPdfFixture(), "docx");
    expect(result.outcome).toBe("mismatch");
  });

  it("accepts valid UTF-8 text for text-like formats (txt/md/csv)", async () => {
    expect((await verifyDeclaredFormat(buildTextFixture(), "txt")).outcome).toBe("text-ok");
    expect((await verifyDeclaredFormat(buildTextFixture(), "md")).outcome).toBe("text-ok");
    expect((await verifyDeclaredFormat(buildCsvFixture(), "csv")).outcome).toBe("text-ok");
  });

  it("flags invalid UTF-8 bytes for text-like formats as text-invalid", async () => {
    const invalidUtf8 = Buffer.from([0xff, 0xfe, 0xfd]);
    const result = await verifyDeclaredFormat(invalidUtf8, "txt");
    expect(result.outcome).toBe("text-invalid");
  });

  it("flags embedded NUL bytes in a declared text file as text-invalid", async () => {
    const withNul = Buffer.from("hello\0world", "utf8");
    const result = await verifyDeclaredFormat(withNul, "txt");
    expect(result.outcome).toBe("text-invalid");
  });

  it("flags non-whitespace control characters in declared text as text-invalid", async () => {
    const withControlCharacters = Buffer.from([0x48, 0x01, 0x49]);
    const result = await verifyDeclaredFormat(withControlCharacters, "txt");
    expect(result.outcome).toBe("text-invalid");
  });
});
