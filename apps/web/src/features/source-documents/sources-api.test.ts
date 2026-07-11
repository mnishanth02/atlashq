import { describe, expect, it } from "vitest";
import { AtlasApiError } from "@/features/api";
import {
  extractDuplicateMatches,
  getSourceDetailFamilyQueryKey,
  getSourceDetailInvalidationTargets,
  getSourceListFamilyQueryKey,
  getSourceListInvalidationTargets,
  getSourceListQueryKey,
  getSourceVaultCapabilitiesQueryKey,
  isSourceErrorCode,
  isTerminalProcessingStatus,
  SOURCE_ERROR_CODES,
} from "./sources-api";

const PROJECT_ID = "project-1";
const SOURCE_ID = "source-1";

function makeError(code: string, details?: unknown[]) {
  return new AtlasApiError({
    status: 409,
    code,
    message: "Duplicate content detected",
    ...(details ? { details: details as never } : {}),
    correlationId: "corr-x",
  });
}

describe("query key families", () => {
  it("scopes source list keys under the project", () => {
    expect(getSourceListFamilyQueryKey(PROJECT_ID)).toEqual([
      "api",
      "projects",
      "detail",
      PROJECT_ID,
      "source-documents",
      "list",
    ]);
    expect(getSourceListQueryKey(PROJECT_ID, {})).toEqual([
      "api",
      "projects",
      "detail",
      PROJECT_ID,
      "source-documents",
      "list",
      {},
    ]);
  });

  it("scopes detail keys deeper than list keys", () => {
    const detailKey = getSourceDetailFamilyQueryKey(PROJECT_ID, SOURCE_ID);
    const listKey = getSourceListFamilyQueryKey(PROJECT_ID);
    expect(detailKey).not.toEqual(listKey);
    expect(detailKey.slice(0, 5)).toEqual(listKey.slice(0, 5));
  });

  it("puts capabilities under the project scope but separate from the source-documents family", () => {
    const capKey = getSourceVaultCapabilitiesQueryKey(PROJECT_ID);
    expect(capKey).toEqual([
      "api",
      "projects",
      "detail",
      PROJECT_ID,
      "source-vault",
      "capabilities",
    ]);
    // Capabilities MUST NOT collide with list/detail families — mutation
    // invalidations for sources should never sweep the capabilities cache.
    expect(capKey).not.toEqual(getSourceListFamilyQueryKey(PROJECT_ID));
  });
});

describe("invalidation targets", () => {
  it("list invalidation covers dashboard, project list, and audit", () => {
    const targets = getSourceListInvalidationTargets(PROJECT_ID);
    expect(targets).toHaveLength(4);
    expect(targets[0]).toEqual(getSourceListFamilyQueryKey(PROJECT_ID));
    expect(targets.some((k) => (k as string[])[0] === "api")).toBe(true);
  });

  it("detail invalidation extends list invalidation with detail/versions/extractions/chunks", () => {
    const targets = getSourceDetailInvalidationTargets(PROJECT_ID, SOURCE_ID);
    expect(targets.length).toBeGreaterThan(4);
    const flat = targets.map((k) => JSON.stringify(k));
    expect(flat.some((s) => s.includes("versions"))).toBe(true);
    expect(flat.some((s) => s.includes("extractions"))).toBe(true);
    expect(flat.some((s) => s.includes("chunks"))).toBe(true);
    // Never mentions signed-url — signed URLs must not be invalidated by list mutations
    expect(flat.every((s) => !s.includes("signed-url"))).toBe(true);
  });
});

describe("terminal processing status", () => {
  it("recognizes ready/failed/quarantined as terminal", () => {
    expect(isTerminalProcessingStatus("ready")).toBe(true);
    expect(isTerminalProcessingStatus("failed")).toBe(true);
    expect(isTerminalProcessingStatus("quarantined")).toBe(true);
  });
  it("treats scanning/extraction/verification as non-terminal", () => {
    expect(isTerminalProcessingStatus("scanning")).toBe(false);
    expect(isTerminalProcessingStatus("extracting")).toBe(false);
    expect(isTerminalProcessingStatus("verification_pending")).toBe(false);
    expect(isTerminalProcessingStatus(undefined)).toBe(false);
  });
});

describe("error helpers", () => {
  it("matches Atlas API errors by code", () => {
    const err = makeError(SOURCE_ERROR_CODES.duplicateConfirmationRequired);
    expect(isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)).toBe(true);
    expect(isSourceErrorCode(err, SOURCE_ERROR_CODES.captureDisabled)).toBe(false);
    expect(
      isSourceErrorCode(new Error("nope"), SOURCE_ERROR_CODES.duplicateConfirmationRequired),
    ).toBe(false);
  });

  it("extracts duplicate matches from error detail metadata (generated shape)", () => {
    const err = makeError(SOURCE_ERROR_CODES.duplicateConfirmationRequired, [
      {
        path: ["files"],
        message: "duplicate",
        code: "duplicate",
        metadata: {
          matches: [
            {
              sourceId: "source-old",
              title: "Existing source",
              versionNumber: 3,
              isArchived: false,
              isSuperseded: false,
              contributorId: "actor-a",
              uploadedAt: "2025-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    ]);
    const matches = extractDuplicateMatches(err);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.sourceId).toBe("source-old");
  });

  it("returns an empty list when details are absent", () => {
    const err = makeError(SOURCE_ERROR_CODES.duplicateConfirmationRequired);
    expect(extractDuplicateMatches(err)).toEqual([]);
    expect(extractDuplicateMatches(new Error("x"))).toEqual([]);
  });

  it("returns an empty list when metadata is missing on details", () => {
    const err = makeError(SOURCE_ERROR_CODES.duplicateConfirmationRequired, [
      { path: ["files"], message: "duplicate", code: "duplicate" },
    ]);
    expect(extractDuplicateMatches(err)).toEqual([]);
  });

  it("ignores ad-hoc `matches` outside metadata (never trusted)", () => {
    const err = makeError(SOURCE_ERROR_CODES.duplicateConfirmationRequired, [
      {
        path: ["files"],
        message: "duplicate",
        code: "duplicate",
        // Legacy shape — must NOT be read
        matches: [{ sourceId: "leaked", title: "x", versionNumber: 1 }],
      },
    ]);
    expect(extractDuplicateMatches(err)).toEqual([]);
  });
});
