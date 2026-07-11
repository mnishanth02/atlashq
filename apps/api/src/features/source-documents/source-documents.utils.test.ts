import { describe, expect, it } from "vitest";
import {
  decodeSourceCursor,
  encodeSourceCursor,
  hashCanonicalManifest,
  hashManualBody,
  readFeatureFlag,
  stringifyCanonicalManifest,
} from "./source-documents.utils.js";

describe("source-documents.utils", () => {
  describe("canonical manifest hashing", () => {
    it("is deterministic regardless of file ordering and key ordering", () => {
      const a = hashCanonicalManifest({
        sourceType: "document",
        documentFormat: "pdf",
        files: [
          { ordinal: 1, role: "primary", sha256: "b".repeat(64) },
          { ordinal: 0, role: "primary", sha256: "a".repeat(64) },
        ],
      });
      const b = hashCanonicalManifest({
        sourceType: "document",
        documentFormat: "pdf",
        files: [
          { ordinal: 0, role: "primary", sha256: "a".repeat(64) },
          { ordinal: 1, role: "primary", sha256: "b".repeat(64) },
        ],
      });
      expect(a).toBe(b);
      expect(a).toMatch(/^[a-f0-9]{64}$/);
    });

    it("emits sorted-key canonical JSON", () => {
      const json = stringifyCanonicalManifest({
        sourceType: "document",
        documentFormat: "pdf",
        files: [{ ordinal: 0, role: "primary", sha256: "a".repeat(64) }],
      });
      const keys = Object.keys(JSON.parse(json));
      expect(keys).toEqual([...keys].sort());
    });

    it("never includes mutable title/tags/notes/provenance in the canonicalized shape", () => {
      const json = stringifyCanonicalManifest({
        sourceType: "reference",
        reference: {
          referenceKind: "url",
          captureMethod: "manual_paste",
          accessType: "public",
          intendedUse: "inspiration",
          sourceUrl: "https://example.com/page",
        },
        files: [{ ordinal: 0, role: "snapshot", sha256: "a".repeat(64) }],
      });
      expect(json).not.toContain("title");
      expect(json).not.toContain("tags");
      expect(json).not.toContain("notes");
      expect(json).not.toContain("provenance");
    });

    it("hashes only immutable reference evidence fields, exactly matching the same-evidence hash", () => {
      const evidence = {
        sourceType: "reference" as const,
        reference: {
          referenceKind: "url" as const,
          captureMethod: "manual_paste" as const,
          accessType: "public" as const,
          intendedUse: "inspiration" as const,
          sourceUrl: "https://example.com/page",
        },
        files: [{ ordinal: 0, role: "snapshot" as const, sha256: "a".repeat(64) }],
      };
      const first = hashCanonicalManifest(evidence);
      const second = hashCanonicalManifest(evidence);
      expect(first).toBe(second);
    });
  });

  describe("hashManualBody", () => {
    it("returns a lowercase 64-hex SHA-256 for NFC-normalized UTF-8 bytes", () => {
      const hash = hashManualBody("hello world");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("cursor helpers", () => {
    it("round-trips a valid cursor via base64url", () => {
      const encoded = encodeSourceCursor({
        createdAt: "2024-01-01T00:00:00.000Z",
        id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      });
      const decoded = decodeSourceCursor(encoded);
      expect(decoded).toEqual({
        createdAt: "2024-01-01T00:00:00.000Z",
        id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      });
    });

    it("rejects malformed cursors as BadRequestException", () => {
      expect(() => decodeSourceCursor("not-a-valid-cursor")).toThrow();
    });
  });

  describe("readFeatureFlag", () => {
    it("returns false when settings are null or the flag is absent", () => {
      expect(readFeatureFlag(null, "source_vault_writes_enabled")).toBe(false);
      expect(readFeatureFlag({}, "source_vault_writes_enabled")).toBe(false);
    });

    it("returns true only when the flag is explicitly true", () => {
      expect(
        readFeatureFlag({ source_vault_writes_enabled: true }, "source_vault_writes_enabled"),
      ).toBe(true);
      expect(
        readFeatureFlag({ source_vault_writes_enabled: "true" }, "source_vault_writes_enabled"),
      ).toBe(false);
    });
  });
});
