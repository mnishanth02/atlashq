import { createHash, randomUUID } from "node:crypto";
import type { OrganizationId, ProjectId, UserId } from "@atlashq/types";
import { StorageError } from "./storage-error.js";

export const immutableStoragePurposes = {
  sourceDocument: "source-document",
  referenceSnapshot: "reference-snapshot",
  derivedPreview: "derived-preview",
  generatedExport: "generated-export",
} as const;

export type ImmutableStoragePurpose =
  (typeof immutableStoragePurposes)[keyof typeof immutableStoragePurposes];

export type ProvisionalStoragePurpose = "upload-session";

export type StorageAuthorizationProof = {
  checked: true;
  actorId: UserId;
  reason: string;
};

export type ImmutableObjectKeyParts = {
  organizationId: OrganizationId;
  purpose: ImmutableStoragePurpose;
  contentHash: string;
  projectId?: ProjectId;
  objectId?: string;
  fileName?: string;
};

export type ProvisionalObjectKeyParts = {
  organizationId: OrganizationId;
  uploadSessionId: string;
  ordinal: number;
  projectId?: ProjectId;
  fileName?: string;
};

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const OBJECT_KEY_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function createSha256ContentHash(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export function sanitizeObjectKeySegment(value: string): string {
  return (
    value
      .normalize("NFKC")
      .toLowerCase()
      .split("")
      .filter((character) => !isControlCharacter(character))
      .join("")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "object"
  );
}

export function assertSafeObjectKey(objectKey: string): void {
  if (
    objectKey.length === 0 ||
    objectKey.length > 1_024 ||
    objectKey.startsWith("/") ||
    objectKey.endsWith("/") ||
    objectKey.includes("\\") ||
    hasControlCharacters(objectKey)
  ) {
    throw new StorageError("INVALID_OBJECT_KEY", "Object keys must be safe relative paths.");
  }

  const segments = objectKey.split("/");

  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new StorageError(
      "INVALID_OBJECT_KEY",
      "Object keys must not contain empty or dot segments.",
    );
  }
}

export function createImmutableObjectKey(parts: ImmutableObjectKeyParts): string {
  if (!SHA256_HEX_PATTERN.test(parts.contentHash)) {
    throw new StorageError("INVALID_CONTENT_HASH", "Content hashes must be lowercase SHA-256 hex.");
  }

  const segments = ["org", sanitizeObjectKeySegment(parts.organizationId)];

  if (parts.projectId) {
    segments.push("project", sanitizeObjectKeySegment(parts.projectId));
  }

  segments.push(parts.purpose, "sha256", parts.contentHash);

  const objectId = sanitizeObjectKeySegment(parts.objectId ?? randomUUID());

  if (parts.fileName) {
    segments.push(`${objectId}-${sanitizeObjectKeySegment(parts.fileName)}`);
  } else {
    segments.push(objectId);
  }

  return segments.join("/");
}

export function createProvisionalObjectKey(parts: ProvisionalObjectKeyParts): string {
  const segments = ["org", sanitizeObjectKeySegment(parts.organizationId)];

  if (parts.projectId) {
    segments.push("project", sanitizeObjectKeySegment(parts.projectId));
  }

  segments.push(
    "upload-session",
    sanitizeObjectKeySegment(parts.uploadSessionId),
    sanitizeObjectKeySegment(String(parts.ordinal).padStart(4, "0")),
  );

  const leafName = parts.fileName
    ? `${randomUUID()}-${sanitizeObjectKeySegment(parts.fileName)}`
    : randomUUID();

  segments.push(sanitizeObjectKeySegment(leafName));
  return segments.join("/");
}

export function isProvisionalUploadSessionObjectKey(objectKey: string): boolean {
  return objectKey.split("/").includes("upload-session");
}

export type ContentDispositionType = "attachment" | "inline";

export function createSafeContentDisposition(
  fileName: string,
  type: ContentDispositionType = "attachment",
): string {
  const normalizedName = fileName
    .normalize("NFKC")
    .split("")
    .filter((character) => !isControlCharacter(character))
    .join("")
    .replace(/[\\/]+/g, "-")
    .replace(/"/g, "'")
    .trim();
  const safeName =
    normalizedName.length > 0 && normalizedName !== "." && normalizedName !== ".."
      ? normalizedName
      : "download";
  const asciiFallback =
    safeName
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]+/g, "")
      .replace(/[%";]/g, "_")
      .trim() || "download";
  const encodedName = encodeURIComponent(safeName)
    .replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");

  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}

export function assertSignedUrlAuthorization(authorization: StorageAuthorizationProof): void {
  if (!authorization.checked) {
    throw new StorageError(
      "AUTHORIZATION_REQUIRED",
      "Authorization must be checked before signed URL creation.",
    );
  }
}

export function assertSafeObjectKeySegment(segment: string): void {
  if (!OBJECT_KEY_SEGMENT_PATTERN.test(segment)) {
    throw new StorageError(
      "INVALID_OBJECT_KEY",
      "Generated object-key segments must be sanitized.",
    );
  }
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => isControlCharacter(character));
}

function isControlCharacter(value: string): boolean {
  const code = value.charCodeAt(0);
  return code <= 0x1f || code === 0x7f;
}
