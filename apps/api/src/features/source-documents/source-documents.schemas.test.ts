import { describe, expect, it } from "vitest";
import {
  sourceFilePathParamsSchema,
  sourcePathParamsSchema,
  uploadSessionPathParamsSchema,
} from "./source-documents.schemas.js";

describe("source-documents.schemas path params", () => {
  it("accepts a valid uploadSession path params object", () => {
    const parsed = uploadSessionPathParamsSchema.parse({
      projectId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      sessionId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
    });
    expect(parsed.projectId).toBeDefined();
    expect(parsed.sessionId).toBeDefined();
  });

  it("rejects unknown keys on source path params (strict)", () => {
    expect(() =>
      sourcePathParamsSchema.parse({
        projectId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        sourceId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
        extra: "nope",
      }),
    ).toThrow();
  });

  it("requires uuid for fileId in file path params", () => {
    expect(() =>
      sourceFilePathParamsSchema.parse({
        projectId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        sourceId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
        fileId: "not-a-uuid",
      }),
    ).toThrow();
  });
});
