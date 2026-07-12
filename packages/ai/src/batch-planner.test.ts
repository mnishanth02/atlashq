import { describe, expect, it } from "vitest";
import {
  buildExtractionCacheKey,
  estimateTokensFromText,
  hashCanonicalJson,
  planDeterministicBatches,
  stableStringifyJson,
} from "./index.js";

describe("stable hashing utilities", () => {
  it("stringifies JSON in canonical key order", () => {
    const first = stableStringifyJson({ b: 2, a: 1 });
    const second = stableStringifyJson({ a: 1, b: 2 });
    expect(first).toBe(second);
    expect(hashCanonicalJson({ b: 2, a: 1 })).toBe(hashCanonicalJson({ a: 1, b: 2 }));
  });
});

describe("deterministic batch planner", () => {
  it("orders chunks deterministically and plans bounded batches", () => {
    const result = planDeterministicBatches({
      chunks: [
        {
          snapshotChunkId: "chunk_c",
          sourceDocumentId: "doc_1",
          sourceOrder: 1,
          sourceExtractionVersion: "2",
          chunkSequence: 2,
          chunkContentHash: "hash_c",
          text: "C".repeat(80),
        },
        {
          snapshotChunkId: "chunk_a",
          sourceDocumentId: "doc_1",
          sourceOrder: 1,
          sourceExtractionVersion: "2",
          chunkSequence: 0,
          chunkContentHash: "hash_a",
          text: "A".repeat(80),
        },
        {
          snapshotChunkId: "chunk_b",
          sourceDocumentId: "doc_1",
          sourceOrder: 1,
          sourceExtractionVersion: "2",
          chunkSequence: 1,
          chunkContentHash: "hash_b",
          text: "B".repeat(80),
        },
      ],
      maxInputTokensPerRun: 1_000,
      maxInputTokensPerBatch: 320,
      maxOutputTokensPerRun: 300,
      maxOutputTokensPerBatch: 150,
      inputTokensUsed: 0,
      outputTokensUsed: 0,
    });

    expect(result.batches[0]?.snapshotChunkIds).toEqual(["chunk_a", "chunk_b", "chunk_c"]);
    expect(result.excludedChunkIds).toEqual([]);
  });

  it("stops adding chunks when input budget is exceeded", () => {
    const result = planDeterministicBatches({
      chunks: [
        {
          snapshotChunkId: "chunk_1",
          sourceDocumentId: "doc_1",
          sourceOrder: 0,
          sourceExtractionVersion: "1",
          chunkSequence: 0,
          chunkContentHash: "hash_1",
          text: "x".repeat(400),
        },
        {
          snapshotChunkId: "chunk_2",
          sourceDocumentId: "doc_1",
          sourceOrder: 0,
          sourceExtractionVersion: "1",
          chunkSequence: 1,
          chunkContentHash: "hash_2",
          text: "y".repeat(400),
        },
      ],
      maxInputTokensPerRun: estimateTokensFromText("x".repeat(400)) + 120,
      maxInputTokensPerBatch: 600,
      maxOutputTokensPerRun: 300,
      maxOutputTokensPerBatch: 150,
      inputTokensUsed: 0,
      outputTokensUsed: 0,
    });

    expect(result.excludedChunkIds).toEqual(["chunk_2"]);
    expect(result.warningCodes).toContain("budget_input_tokens_exceeded");
  });
});

describe("extraction cache key builder", () => {
  it("creates stable keys and scopes by organization", () => {
    const baseInput = {
      organizationId: "org_1",
      stageKind: "confirmed_extraction" as const,
      sourceDocumentId: "doc_1",
      sourceContentHash: "hash_source",
      sourceExtractionVersion: "2",
      chunkerVersion: "chunker@1",
      chunkContentHashes: ["a", "b", "c"] as const,
      promptHash: "prompt_hash",
      schemaHash: "schema_hash",
      pipelineHash: "pipeline_hash",
      modelPolicyHash: "policy_hash",
      temperature: 0 as const,
      seed: 123,
    };

    const keyA = buildExtractionCacheKey(baseInput);
    const keyB = buildExtractionCacheKey({ ...baseInput });
    const keyC = buildExtractionCacheKey({ ...baseInput, organizationId: "org_2" });

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });
});
