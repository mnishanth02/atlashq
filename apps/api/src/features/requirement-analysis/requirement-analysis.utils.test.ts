import { describe, expect, it } from "vitest";
import {
  decodeTimeCursor,
  encodeTimeCursor,
  sanitizeFailureDetail,
  toProviderPolicyResponse,
  toTraceabilityLinkResponse,
} from "./requirement-analysis.utils.js";

describe("requirement-analysis.utils", () => {
  it("round-trips time cursors", () => {
    const encoded = encodeTimeCursor({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    });
    expect(decodeTimeCursor(encoded)).toEqual({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    });
  });

  it("truncates long failure details to a safe length", () => {
    const detail = sanitizeFailureDetail("x".repeat(400));
    expect(detail.length).toBe(220);
    expect(detail.endsWith("...")).toBe(true);
  });

  it("maps provider policy versions to API payloads", () => {
    const mapped = toProviderPolicyResponse({
      id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      organizationId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
      version: 3,
      provider: "openai",
      policyName: "Primary policy",
      modelAlias: "gpt-4o-mini",
      resolvedModelId: "gpt-4o-mini",
      dataRetentionMode: "provider_default",
      status: "approved",
      approvedForRequirementAnalysis: true,
      approvedBy: "6ba7b812-9dad-41d1-80b4-00c04fd430c8",
      approvedAt: new Date("2026-01-01T00:00:00.000Z"),
      approvalNote: "approved",
      providerTermsSnapshotHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      maxUsdPerRun: 3,
      maxInputTokensPerRun: 300_000,
      maxOutputTokensPerRun: 30_000,
      maxWallClockSeconds: 1_800,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(mapped.version).toBe(3);
  });

  it("maps traceability rows to API payloads", () => {
    const mapped = toTraceabilityLinkResponse({
      id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      organizationId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
      fromType: "requirement_analysis_run",
      fromId: "6ba7b812-9dad-41d1-80b4-00c04fd430c8",
      toType: "source_document",
      toId: "6ba7b813-9dad-41d1-80b4-00c04fd430c8",
      relation: "selected_source_document",
      createdBy: "6ba7b814-9dad-41d1-80b4-00c04fd430c8",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(mapped).toEqual({
      id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      organizationId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
      fromType: "requirement_analysis_run",
      fromId: "6ba7b812-9dad-41d1-80b4-00c04fd430c8",
      toType: "source_document",
      toId: "6ba7b813-9dad-41d1-80b4-00c04fd430c8",
      relation: "selected_source_document",
      createdBy: "6ba7b814-9dad-41d1-80b4-00c04fd430c8",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
