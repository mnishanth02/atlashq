import { describe, expect, it } from "vitest";
import type { FrozenSnapshotChunkRef } from "../repository/types.js";
import type { RequirementCandidate } from "../schemas.js";
import { buildTestRuntime } from "../test-support/fixtures.js";
import { persistExtractionCandidate } from "./persist-requirement.js";

function buildChunk(overrides: Partial<FrozenSnapshotChunkRef> = {}): FrozenSnapshotChunkRef {
  return {
    snapshotChunkId: "chunk-1",
    sourceDocumentId: "source-1",
    sourceExtractionId: "extraction-1",
    sourceVersionNumber: 1,
    sourceContentHash: "a".repeat(64),
    chunkerVersion: "chunker-v1",
    sourceChunkId: "source-chunk-1",
    sourceOrder: 0,
    sourceExtractionVersion: "1",
    chunkSequence: 0,
    chunkOrder: 0,
    chunkContentHash: "b".repeat(64),
    content: "The system shall authenticate every user before granting access.",
    locator: {},
    origin: "source",
    ...overrides,
  };
}

describe("persistExtractionCandidate", () => {
  it("persists a confirmed candidate with a verified citation as confirmed", async () => {
    const { repository } = buildTestRuntime();
    const chunk = buildChunk();
    const candidate: RequirementCandidate = {
      stableKey: "req-auth-1",
      title: "System shall authenticate users",
      description: null,
      requirementType: "functional",
      priority: null,
      epistemicStatus: "confirmed",
      inferenceBasis: null,
      citations: [
        {
          snapshotChunkId: chunk.snapshotChunkId,
          quote: "The system shall authenticate every user",
        },
      ],
    };

    const result = await persistExtractionCandidate(repository, {
      organizationId: "org-1",
      projectId: "project-1",
      runId: "run-1",
      verificationAiRunId: "ai-run-1",
      snapshotId: "snapshot-1",
      snapshotHash: "c".repeat(64),
      origin: "source",
      candidate,
      chunksById: new Map([[chunk.snapshotChunkId, chunk]]),
    });

    expect(result.requirement.epistemicStatus).toBe("confirmed");
    expect(result.downgradedToUnknown).toBe(false);
    expect(result.verifiedExactCount).toBe(1);
    expect(result.droppedCitationCount).toBe(0);

    const citations = await repository.listCitationsByRequirement(result.requirement.id);
    expect(citations).toHaveLength(1);
    expect(citations[0]?.verificationStatus).toBe("verified_exact");
  });

  it("downgrades a confirmed candidate with zero verified citations to unknown and never persists a confirmed row with zero citations", async () => {
    const { repository } = buildTestRuntime();
    const chunk = buildChunk();
    const candidate: RequirementCandidate = {
      stableKey: "req-unverifiable-1",
      title: "System shall do something unverifiable",
      description: null,
      requirementType: "functional",
      priority: null,
      epistemicStatus: "confirmed",
      inferenceBasis: null,
      citations: [
        { snapshotChunkId: chunk.snapshotChunkId, quote: "Text that never appears in the chunk." },
      ],
    };

    const result = await persistExtractionCandidate(repository, {
      organizationId: "org-1",
      projectId: "project-1",
      runId: "run-1",
      verificationAiRunId: "ai-run-1",
      snapshotId: "snapshot-1",
      snapshotHash: "c".repeat(64),
      origin: "source",
      candidate,
      chunksById: new Map([[chunk.snapshotChunkId, chunk]]),
    });

    expect(result.downgradedToUnknown).toBe(true);
    expect(result.requirement.epistemicStatus).toBe("unknown");
    const citations = await repository.listCitationsByRequirement(result.requirement.id);
    expect(citations).toHaveLength(0);
  });

  it("drops non-verified_exact citations (fuzzy/failed) rather than persisting them as lesser-status rows", async () => {
    const { repository } = buildTestRuntime();
    const chunk = buildChunk();
    const candidate: RequirementCandidate = {
      stableKey: "req-mixed-1",
      title: "System shall authenticate users",
      description: null,
      requirementType: "functional",
      priority: null,
      epistemicStatus: "confirmed",
      inferenceBasis: null,
      citations: [
        {
          snapshotChunkId: chunk.snapshotChunkId,
          quote: "The system shall authenticate every user",
        },
        { snapshotChunkId: chunk.snapshotChunkId, quote: "Completely unrelated text not in chunk" },
      ],
    };

    const result = await persistExtractionCandidate(repository, {
      organizationId: "org-1",
      projectId: "project-1",
      runId: "run-1",
      verificationAiRunId: "ai-run-1",
      snapshotId: "snapshot-1",
      snapshotHash: "c".repeat(64),
      origin: "source",
      candidate,
      chunksById: new Map([[chunk.snapshotChunkId, chunk]]),
    });

    expect(result.verifiedExactCount).toBe(1);
    expect(result.droppedCitationCount).toBe(1);
    const citations = await repository.listCitationsByRequirement(result.requirement.id);
    expect(citations).toHaveLength(1);
    expect(citations.every((citation) => citation.verificationStatus === "verified_exact")).toBe(
      true,
    );
  });
});
