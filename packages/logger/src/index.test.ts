import { describe, expect, it } from "vitest";
import { createCorrelationId, sensitiveRedactionPaths } from "./index.js";

describe("logger helpers", () => {
  it("keeps incoming correlation IDs and redacts secrets, prompts, source chunks, and model outputs", () => {
    expect(createCorrelationId("request-1")).toBe("request-1");
    expect(sensitiveRedactionPaths).toContain("DATABASE_URL");
    expect(sensitiveRedactionPaths).toContain("req.headers.cookie");
    expect(sensitiveRedactionPaths).toContain("prompt");
    expect(sensitiveRedactionPaths).toContain("sourceChunks");
    expect(sensitiveRedactionPaths).toContain("modelOutput");
    expect(sensitiveRedactionPaths).toContain("req.body.fullModelOutput");
    expect(sensitiveRedactionPaths).toContain("request.body.quoteTextOriginal");
  });

  it("redacts common PII and credential-like keys", () => {
    expect(sensitiveRedactionPaths).toContain("email");
    expect(sensitiveRedactionPaths).toContain("phoneNumber");
    expect(sensitiveRedactionPaths).toContain("ssn");
    expect(sensitiveRedactionPaths).toContain("apiKey");
    expect(sensitiveRedactionPaths).toContain("clientSecret");
    expect(sensitiveRedactionPaths).toContain("privateKey");
    expect(sensitiveRedactionPaths).toContain("signedUploadUrl");
  });
});
