import { describe, expect, it } from "vitest";
import {
  providerPolicyApproveActionInputSchema,
  requirementAnalysisCapabilitiesResponseSchema,
  runPathParamsSchema,
  traceabilityListFilterSchema,
} from "./requirement-analysis.schemas.js";

describe("requirement-analysis.schemas", () => {
  it("requires optimistic version for provider-policy approve action", () => {
    expect(() =>
      providerPolicyApproveActionInputSchema.parse({
        approvalNote: "approved",
      }),
    ).toThrow();
  });

  it("accepts capabilities payload with null safeDisabledReason", () => {
    const parsed = requirementAnalysisCapabilitiesResponseSchema.parse({
      analysisEnabled: true,
      readsEnabled: true,
      referenceFeatureExtractionEnabled: false,
      queueAvailable: true,
      approvedProviderPolicyAvailable: true,
      safeDisabled: false,
      safeDisabledReason: null,
    });
    expect(parsed.safeDisabled).toBe(false);
    expect(parsed.safeDisabledReason).toBeNull();
  });

  it("rejects non-uuid run path params", () => {
    expect(() =>
      runPathParamsSchema.parse({
        projectId: "bad",
        runId: "bad",
      }),
    ).toThrow();
  });

  it("enforces strict traceability query shape", () => {
    expect(() =>
      traceabilityListFilterSchema.parse({
        limit: 10,
        relation: "retry_of",
        extra: "nope",
      }),
    ).toThrow();
  });
});
