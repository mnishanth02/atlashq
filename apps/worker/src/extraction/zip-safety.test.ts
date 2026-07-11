import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  assertSafeZipContainer,
  DEFAULT_ZIP_CONTAINER_LIMITS,
  UnsafeZipContainerError,
} from "./zip-safety.js";

async function buildZip(entries: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("assertSafeZipContainer", () => {
  it("accepts a small, well-formed ZIP container", async () => {
    const buffer = await buildZip({ "document.xml": "<xml>hello</xml>" });
    const entries = assertSafeZipContainer(buffer);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.fileName).toBe("document.xml");
  });

  it("rejects a buffer with no valid End Of Central Directory record", () => {
    expect(() => assertSafeZipContainer(Buffer.from("not a zip at all"))).toThrow(
      UnsafeZipContainerError,
    );
  });

  it("rejects a ZIP declaring more entries than the configured limit", async () => {
    const entries: Record<string, string> = {};
    for (let i = 0; i < 5; i += 1) {
      entries[`file-${i}.txt`] = "x";
    }
    const buffer = await buildZip(entries);

    expect(() =>
      assertSafeZipContainer(buffer, { ...DEFAULT_ZIP_CONTAINER_LIMITS, maxEntryCount: 3 }),
    ).toThrow(UnsafeZipContainerError);
  });

  it("rejects an entry name using an absolute path", async () => {
    const buffer = await buildZip({ "/etc/passwd": "x" });

    expect(() => assertSafeZipContainer(buffer)).toThrow(UnsafeZipContainerError);
  });

  it("rejects an entry name attempting path traversal", async () => {
    const buffer = await buildZip({ "../../etc/passwd": "x" });

    expect(() => assertSafeZipContainer(buffer)).toThrow(UnsafeZipContainerError);
  });

  it("rejects entry names with empty path segments", async () => {
    const buffer = await buildZip({ "folder//file.txt": "x" });

    expect(() => assertSafeZipContainer(buffer)).toThrow(UnsafeZipContainerError);
  });

  it("rejects entry names with current-directory segments", async () => {
    const buffer = await buildZip({ "folder/./file.txt": "x" });

    expect(() => assertSafeZipContainer(buffer)).toThrow(UnsafeZipContainerError);
  });

  it("rejects a single entry exceeding the per-entry uncompressed size limit", async () => {
    const buffer = await buildZip({ "big.txt": "a".repeat(10_000) });

    expect(() =>
      assertSafeZipContainer(buffer, {
        ...DEFAULT_ZIP_CONTAINER_LIMITS,
        maxSingleEntryUncompressedBytes: 1_000,
      }),
    ).toThrow(UnsafeZipContainerError);
  });

  it("rejects when the total uncompressed size across entries exceeds the limit", async () => {
    const buffer = await buildZip({
      "a.txt": "a".repeat(2_000),
      "b.txt": "b".repeat(2_000),
    });

    expect(() =>
      assertSafeZipContainer(buffer, {
        ...DEFAULT_ZIP_CONTAINER_LIMITS,
        maxSingleEntryUncompressedBytes: 10_000,
        maxTotalUncompressedBytes: 3_000,
      }),
    ).toThrow(UnsafeZipContainerError);
  });

  it("rejects an entry whose compression ratio is implausibly high (zip-bomb guard)", async () => {
    // Highly repetitive content compresses extremely well; a tiny ratio limit flags it as unsafe.
    const buffer = await buildZip({ "bomb.txt": "a".repeat(100_000) });

    expect(() =>
      assertSafeZipContainer(buffer, { ...DEFAULT_ZIP_CONTAINER_LIMITS, maxCompressionRatio: 2 }),
    ).toThrow(UnsafeZipContainerError);
  });
});
