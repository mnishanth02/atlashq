import { describe, expect, it } from "vitest";
import {
  createImmutableObjectKey,
  createSha256ContentHash,
  createSignedUrlContract,
} from "./index.js";

describe("storage placeholders", () => {
  it("uses content hashes and requires authorization before signed URLs", () => {
    const hash = createSha256ContentHash("atlas");
    expect(hash).toHaveLength(64);
    expect(
      createImmutableObjectKey({
        organizationId: "org_1",
        projectId: "project_1",
        purpose: "source-document",
        contentHash: hash,
      }),
    ).toContain("sha256");
    expect(
      createSignedUrlContract({
        objectKey: "org/org_1/source-document/sha256/hash",
        operation: "read",
        expiresInSeconds: 300,
        authorization: { checked: true, actorId: "user_1", reason: "project membership verified" },
      }).publicBucket,
    ).toBe(false);
  });
});
