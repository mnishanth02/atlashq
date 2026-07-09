import { describe, expect, it } from "vitest";
import { createCorrelationId, sensitiveRedactionPaths } from "./index.js";

describe("logger helpers", () => {
  it("keeps incoming correlation IDs and redacts server secrets", () => {
    expect(createCorrelationId("request-1")).toBe("request-1");
    expect(sensitiveRedactionPaths).toContain("DATABASE_URL");
    expect(sensitiveRedactionPaths).toContain("req.headers.cookie");
  });
});
