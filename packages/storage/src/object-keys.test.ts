import { describe, expect, it } from "vitest";
import {
  createImmutableObjectKey,
  createProvisionalObjectKey,
  createSafeContentDisposition,
  createSha256ContentHash,
  immutableStoragePurposes,
  isProvisionalUploadSessionObjectKey,
} from "./index.js";

describe("object-key helpers", () => {
  it("creates immutable keys partitioned by org, project, purpose, and hash", () => {
    const hash = createSha256ContentHash("atlas");
    const objectKey = createImmutableObjectKey({
      organizationId: "org_1",
      projectId: "project_1",
      purpose: immutableStoragePurposes.sourceDocument,
      contentHash: hash,
      objectId: "source_1",
      fileName: "Product Brief.PDF",
    });

    expect(hash).toHaveLength(64);
    expect(objectKey).toContain("org/org_1/project/project_1/source-document/sha256");
    expect(objectKey).toContain(hash);
    expect(objectKey).toContain("source_1-product-brief.pdf");
  });

  it("creates provisional upload-session keys that are recognizable for cleanup", () => {
    const objectKey = createProvisionalObjectKey({
      organizationId: "org_1",
      projectId: "project_1",
      uploadSessionId: "upload_1",
      ordinal: 7,
      fileName: "Architecture.png",
    });

    expect(objectKey).toContain("/upload-session/");
    expect(isProvisionalUploadSessionObjectKey(objectKey)).toBe(true);
  });

  it("produces safe content-disposition headers", () => {
    expect(createSafeContentDisposition('..\\Quarterly "Plan"\r\n报告.pdf')).toBe(
      "attachment; filename=\"..-Quarterly 'Plan'.pdf\"; filename*=UTF-8''..-Quarterly%20%27Plan%27%E6%8A%A5%E5%91%8A.pdf",
    );
  });
});
