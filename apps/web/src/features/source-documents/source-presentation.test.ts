import { describe, expect, it } from "vitest";
import {
  buildSourcesListQuery,
  formatByteSize,
  formatIpReviewStatus,
  formatProcessingStatus,
  formatSourceFormat,
  formatSourceType,
  getIpReviewMeta,
  getProcessingMeta,
  isReadyForPreview,
  isReferenceCaptureFile,
  isRetryEligible,
  parseSourceListSearch,
  readOnlyStateReason,
} from "./source-presentation";

describe("format helpers", () => {
  it("humanizes source types and formats", () => {
    expect(formatSourceType("document")).toBe("Document");
    expect(formatSourceType("reference")).toBe("Reference");
    expect(formatSourceType("manual")).toBe("Manual text");
    expect(formatSourceFormat("pdf")).toBe("PDF");
    expect(formatSourceFormat(null)).toBe("—");
  });

  it("humanizes processing and IP-review statuses", () => {
    expect(formatProcessingStatus("ready")).toBe("Ready");
    expect(formatProcessingStatus("quarantined")).toBe("Quarantined");
    expect(formatIpReviewStatus("cleared")).toBe("Cleared");
  });

  it("uses semantic severities (never raw colors)", () => {
    expect(getProcessingMeta("ready").severity).toBe("low");
    expect(getProcessingMeta("quarantined").severity).toBe("critical");
    expect(getProcessingMeta("failed").severity).toBe("high");
    expect(getProcessingMeta("scanning").severity).toBe("info");
    expect(getIpReviewMeta("restricted").severity).toBe("high");
    expect(getIpReviewMeta("cleared").severity).toBe("low");
  });

  it("formats byte sizes with sensible units", () => {
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(2048)).toMatch(/2(\.0)? KB/);
    expect(formatByteSize(50 * 1024 * 1024)).toMatch(/MB$/);
  });
});

describe("buildSourcesListQuery", () => {
  it("returns just a default limit when no filters are set", () => {
    const query = buildSourcesListQuery({}) as Record<string, unknown>;
    expect(query.limit).toBe(25);
    expect(Object.keys(query)).toEqual(["limit"]);
  });

  it("maps UI filters to the API query fields", () => {
    const query = buildSourcesListQuery({
      q: "foo",
      type: "reference",
      format: "pdf",
      status: "ready",
      ipReview: "restricted",
      includeArchived: true,
    }) as Record<string, unknown>;
    expect(query).toMatchObject({
      search: "foo",
      sourceType: "reference",
      documentFormat: "pdf",
      processingStatus: "ready",
      ipReviewStatus: "restricted",
      includeArchived: true,
    });
  });
});

describe("parseSourceListSearch", () => {
  it("ignores unknown values", () => {
    const parsed = parseSourceListSearch({ q: "", type: "bogus" });
    expect(parsed.q).toBeUndefined();
    expect(parsed.type).toBeUndefined();
  });
  it("preserves valid values including intake mode", () => {
    const parsed = parseSourceListSearch({
      q: "req",
      type: "reference",
      format: "pdf",
      status: "ready",
      ipReview: "cleared",
      includeArchived: "true",
      intake: "manual",
    });
    expect(parsed).toEqual({
      q: "req",
      type: "reference",
      format: "pdf",
      status: "ready",
      ipReview: "cleared",
      includeArchived: true,
      intake: "manual",
    });
  });
});

describe("readOnlyStateReason", () => {
  it("returns null for writers", () => {
    expect(
      readOnlyStateReason({
        canRead: true,
        canWrite: true,
        canManageIpReview: true,
        canRetry: true,
        canArchive: true,
        canRestore: true,
        canReplace: true,
        canEditMetadata: true,
        canRequestCapture: true,
      }),
    ).toBeNull();
  });
  it("returns copy for read-only viewers", () => {
    expect(
      readOnlyStateReason({
        canRead: true,
        canWrite: false,
        canManageIpReview: false,
        canRetry: false,
        canArchive: false,
        canRestore: false,
        canReplace: false,
        canEditMetadata: false,
        canRequestCapture: false,
      }),
    ).toMatch(/Read\/download access only/);
  });
});

describe("preview/retry gating", () => {
  const base = {
    id: "s1",
    lineageId: "l1",
    versionNumber: 1,
    supersedesId: null,
    sourceType: "document" as const,
    documentFormat: "pdf" as const,
    title: "t",
    tags: [],
    processingStatus: "ready" as const,
    isArchived: false,
    hasDuplicateAcknowledgement: false,
    ipReviewStatus: null,
    contentHash: "h",
    createdByActorId: "a",
    createdAt: "2026-07-10T00:00:00.000Z",
    version: 1,
    notes: null,
    provenanceDate: null,
    archivedByActorId: null,
    archivedAt: null,
    files: [],
  };
  it("gates preview on ready + not archived", () => {
    expect(isReadyForPreview(base)).toBe(true);
    expect(isReadyForPreview({ ...base, processingStatus: "scanning" })).toBe(false);
    expect(isReadyForPreview({ ...base, isArchived: true })).toBe(false);
  });
  it("only allows retry on failed sources", () => {
    expect(isRetryEligible({ ...base, processingStatus: "failed" })).toBe(true);
    expect(isRetryEligible({ ...base, processingStatus: "quarantined" })).toBe(false);
    expect(isRetryEligible(base)).toBe(false);
  });
  it("detects capture-source files", () => {
    expect(isReferenceCaptureFile(base)).toBe(false);
    expect(
      isReferenceCaptureFile({
        ...base,
        sourceType: "reference",
        reference: {
          id: "r",
          sourceDocumentId: base.id,
          referenceKind: "url",
          captureMethod: "on_demand_single_page_capture",
          accessType: "public",
          intendedUse: "inspiration",
          sourceUrl: "https://x",
          ipReviewStatus: "not_reviewed",
          ipReviewReason: null,
          ipReviewedByActorId: null,
          ipReviewedAt: null,
          attestationText: "irrelevant",
          attestationVersion: "v1",
          attestedByActorId: "a",
          attestedAt: base.createdAt,
          capturedAt: null,
        },
      }),
    ).toBe(true);
  });
});
