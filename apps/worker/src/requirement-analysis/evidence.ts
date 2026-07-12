import type { StructuredEvidenceBlock } from "@atlashq/ai";
import type { FrozenSnapshotChunkRef } from "./repository/types.js";

/**
 * Converts frozen snapshot chunks into the `@atlashq/ai` prompt-injection-guarded evidence block
 * shape (module-03 §11.3). `blockId` is deterministic (`snapshotChunkId`) so re-running the same
 * batch (idempotent replay, cache hit re-render) always produces byte-identical evidence blocks.
 */
export function buildEvidenceBlocks(input: {
  organizationId: string;
  projectId: string;
  snapshotId: string;
  chunks: readonly FrozenSnapshotChunkRef[];
}): StructuredEvidenceBlock[] {
  return input.chunks.map((chunk) => ({
    blockId: chunk.snapshotChunkId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    sourceDocumentId: chunk.sourceDocumentId,
    sourceChunkId: chunk.sourceChunkId,
    chunkContentHash: chunk.chunkContentHash,
    origin: chunk.origin,
    text: chunk.content,
    locator: chunk.locator,
  }));
}
