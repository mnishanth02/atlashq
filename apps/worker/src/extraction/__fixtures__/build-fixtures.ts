import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import * as XLSX from "xlsx";

/** Builds a tiny, legally self-authored multi-page PDF with real extractable text. */
export async function buildPdfFixture(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const page1 = doc.addPage([200, 200]);
  page1.drawText("Atlas fixture page one.", { x: 10, y: 150, size: 12, font });

  const page2 = doc.addPage([200, 200]);
  page2.drawText("Atlas fixture page two.", { x: 10, y: 150, size: 12, font });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** Builds a corrupt (non-PDF-structured) buffer with a valid `%PDF-` magic header. */
export function buildCorruptPdfFixture(): Buffer {
  return Buffer.from("%PDF-1.7\nnot a real pdf body at all, deliberately truncated/corrupt");
}

const DOCUMENT_XML_TEMPLATE = (bodyXml: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** Builds a tiny, legally self-authored DOCX (hand-built OOXML container) with one heading and two paragraphs. */
export async function buildDocxFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.folder("_rels")?.file(".rels", RELS_XML);
  zip
    .folder("word")
    ?.file(
      "document.xml",
      DOCUMENT_XML_TEMPLATE(
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Atlas Fixture Heading</w:t></w:r></w:p>' +
          "<w:p><w:r><w:t>Atlas fixture paragraph one.</w:t></w:r></w:p>" +
          "<w:p><w:r><w:t>Atlas fixture paragraph two.</w:t></w:r></w:p>",
      ),
    );

  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  return bytes;
}

/** Builds a tiny XLSX workbook with two sheets using the `xlsx` package's own writer. */
export function buildXlsxFixture(): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet1 = XLSX.utils.aoa_to_sheet([
    ["name", "value"],
    ["alpha", 1],
    ["beta", 2],
  ]);
  const sheet2 = XLSX.utils.aoa_to_sheet([["only", "row"]]);
  XLSX.utils.book_append_sheet(workbook, sheet1, "Sheet1");
  XLSX.utils.book_append_sheet(workbook, sheet2, "Sheet2");

  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return bytes;
}

/** Builds a tiny, legally self-authored CSV buffer. */
export function buildCsvFixture(): Buffer {
  return Buffer.from("name,value\nalpha,1\nbeta,2\n", "utf8");
}

/** Builds a tiny, legally self-authored PPTX (hand-built OOXML container) with one slide + notes. */
export async function buildPptxFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  );
  zip.folder("ppt")?.file(
    "presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
  );
  zip
    .folder("ppt")
    ?.folder("slides")
    ?.file(
      "slide1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Atlas fixture slide text.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
    );
  zip
    .folder("ppt")
    ?.folder("notesSlides")
    ?.file(
      "notesSlide1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Atlas fixture speaker notes.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:notes>`,
    );

  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  return bytes;
}

/** Builds a tiny, legally self-authored plain-text fixture with two paragraphs. */
export function buildTextFixture(): Buffer {
  return Buffer.from("Atlas fixture paragraph one.\n\nAtlas fixture paragraph two.\n", "utf8");
}

/** Builds a tiny 2x2 red PNG using `sharp` (already a worker dependency; avoids hand-rolled PNG bytes). */
export async function buildPngFixture(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 220, g: 20, b: 60 },
    },
  })
    .png()
    .toBuffer();
}
