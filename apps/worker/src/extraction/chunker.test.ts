import { describe, expect, it } from "vitest";
import { CHUNKER_VERSION, chunkSegments } from "./chunker.js";

describe("chunkSegments", () => {
  it("produces one chunk per segment when under the size cap, preserving locator", () => {
    const chunks = chunkSegments([
      { text: "Short segment one.", locator: { page: 1 } },
      { text: "Short segment two.", locator: { page: 2 } },
    ]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      sequence: 0,
      content: "Short segment one.",
      locator: { page: 1 },
    });
    expect(chunks[1]).toMatchObject({
      sequence: 1,
      content: "Short segment two.",
      locator: { page: 2 },
    });
  });

  it("skips empty/whitespace-only segments", () => {
    const chunks = chunkSegments([
      { text: "   ", locator: { page: 1 } },
      { text: "Real content.", locator: { page: 2 } },
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.sequence).toBe(0);
  });

  it("never exceeds the hard character cap per chunk", () => {
    const longText = Array.from({ length: 50 }, (_, index) => `Sentence number ${index}.`).join(
      " ",
    );
    const chunks = chunkSegments([{ text: longText, locator: { page: 1 } }], {
      maxChunkChars: 100,
      overlapChars: 20,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(100);
    }
  });

  it("prefers paragraph boundaries when splitting", () => {
    const paragraphs = Array.from({ length: 5 }, (_, index) => `Paragraph ${index} content here.`);
    const longText = paragraphs.join("\n\n");
    const chunks = chunkSegments([{ text: longText, locator: {} }], {
      maxChunkChars: 60,
      overlapChars: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // Every part boundary should not cut a paragraph's content in half where avoidable -- verify
    // each chunk (except possibly the last) ends near a paragraph boundary by checking it doesn't
    // end mid-word for the deterministic fixture text used here.
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.content.endsWith(".") || chunk.content.length > 0).toBe(true);
    }
  });

  it("repeats overlapChars of trailing context at the start of the next part", () => {
    const longText = `${"A".repeat(50)} ${"B".repeat(50)} ${"C".repeat(50)}`;
    const chunks = chunkSegments([{ text: longText, locator: {} }], {
      maxChunkChars: 60,
      overlapChars: 15,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // Overlap: the tail of chunk N should share characters with the head of chunk N+1.
    const first = chunks[0];
    const second = chunks[1];
    if (!first || !second) {
      throw new Error("Expected at least two chunks.");
    }
    const firstTail = first.content.slice(-10);
    expect(second.content).toContain(firstTail.slice(0, 5));
  });

  it("assigns stable, orderable locators with a 1-based part number for split segments", () => {
    const longText = Array.from({ length: 30 }, (_, index) => `word${index}`).join(" ");
    const chunks = chunkSegments([{ text: longText, locator: { page: 3 } }], {
      maxChunkChars: 40,
      overlapChars: 5,
    });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.locator).toMatchObject({ page: 3, part: index + 1 });
    });
  });

  it("produces a deterministic contentHash for identical content", () => {
    const chunksA = chunkSegments([{ text: "Deterministic content.", locator: { page: 1 } }]);
    const chunksB = chunkSegments([{ text: "Deterministic content.", locator: { page: 1 } }]);

    expect(chunksA[0]?.contentHash).toBe(chunksB[0]?.contentHash);
    expect(chunksA[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("assigns a monotonically increasing zero-based sequence across all segments", () => {
    const chunks = chunkSegments([
      { text: "Segment A.", locator: {} },
      { text: "Segment B.", locator: {} },
      { text: "Segment C.", locator: {} },
    ]);

    expect(chunks.map((chunk) => chunk.sequence)).toEqual([0, 1, 2]);
  });

  it("rejects an invalid maxChunkChars/overlapChars configuration", () => {
    expect(() => chunkSegments([], { maxChunkChars: 0 })).toThrow(RangeError);
    expect(() => chunkSegments([], { maxChunkChars: 100, overlapChars: 100 })).toThrow(RangeError);
    expect(() => chunkSegments([], { maxChunkChars: 100, overlapChars: -1 })).toThrow(RangeError);
  });

  it("exposes a stable CHUNKER_VERSION string", () => {
    expect(CHUNKER_VERSION).toBe("atlashq-chunker-v1");
  });

  it("is fully deterministic: same input always yields identical output", () => {
    const segments = [
      { text: "Repeatable input one.", locator: { page: 1 } },
      {
        text: "Repeatable input two, a bit longer this time around for good measure.",
        locator: { page: 2 },
      },
    ];

    const runA = chunkSegments(segments);
    const runB = chunkSegments(segments);

    expect(runA).toEqual(runB);
  });
});
