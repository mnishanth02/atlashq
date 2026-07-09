import { createHash, randomUUID } from "node:crypto";
import type { OrganizationId, ProjectId, UserId } from "@atlashq/types";

export type StoragePurpose = "source-document" | "reference-artifact" | "generated-export";
export type SignedUrlOperation = "read" | "write";

export type ImmutableObjectKeyParts = {
  organizationId: OrganizationId;
  purpose: StoragePurpose;
  contentHash: string;
  projectId?: ProjectId;
  fileName?: string;
};

export type StorageAuthorizationProof = {
  checked: true;
  actorId: UserId;
  reason: string;
};

export type SignedUrlRequest = {
  objectKey: string;
  operation: SignedUrlOperation;
  expiresInSeconds: number;
  authorization: StorageAuthorizationProof;
};

export type SignedUrlContract = SignedUrlRequest & {
  provider: "minio-s3-compatible";
  publicBucket: false;
  status: "placeholder";
};

export function createSha256ContentHash(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function safeSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "object"
  );
}

export function createImmutableObjectKey(parts: ImmutableObjectKeyParts): string {
  const segments = ["org", safeSegment(parts.organizationId)];

  if (parts.projectId) {
    segments.push("project", safeSegment(parts.projectId));
  }

  segments.push(parts.purpose, "sha256", parts.contentHash);

  if (parts.fileName) {
    segments.push(`${randomUUID()}-${safeSegment(parts.fileName)}`);
  }

  return segments.join("/");
}

export function createSignedUrlContract(request: SignedUrlRequest): SignedUrlContract {
  if (!request.authorization.checked) {
    throw new Error("Authorization must be checked before signed URL creation.");
  }

  if (request.expiresInSeconds <= 0 || request.expiresInSeconds > 3_600) {
    throw new Error("Signed URL expiry must be between 1 and 3600 seconds.");
  }

  return {
    ...request,
    provider: "minio-s3-compatible",
    publicBucket: false,
    status: "placeholder",
  };
}
