import { describe, expect, it } from "vitest";
import { createIdempotencyKey, parseJobPayload, queueNames } from "./index.js";

describe("job placeholders", () => {
  it("keeps worker queue names and validates payloads", () => {
    expect(queueNames).toContain("document-processing");
    expect(
      parseJobPayload("maintenance", {
        idempotencyKey: "maintenance:daily:2026-07-09",
        correlationId: "corr-1",
        submittedAt: "2026-07-09T05:30:00.000Z",
      }),
    ).toMatchObject({ correlationId: "corr-1" });
    expect(
      createIdempotencyKey({
        queueName: "maintenance",
        operation: "daily",
        resourceId: "2026-07-09",
      }),
    ).toBe("maintenance:daily:2026-07-09");
  });
});
