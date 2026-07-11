import { describe, expect, it } from "vitest";
import {
  canonicalSourceManifestInputSchema,
  ipReviewChangeInputSchema,
  manualSourceCreateInputSchema,
  referenceAttestationTextSchema,
  referenceCaptureRequestInputSchema,
  referenceMetadataInputSchema,
  referenceSourceCreateInputSchema,
  sha256HexSchema,
  sourceArchiveInputSchema,
  sourceDocumentDetailResponseSchema,
  sourceDocumentFileResponseSchema,
  sourceDocumentFormatMimeTypes,
  sourceDocumentSummaryResponseSchema,
  sourceDuplicateAcknowledgementInputSchema,
  sourceFileDeclarationSchema,
  sourceListFilterSchema,
  sourceMetadataPatchInputSchema,
  uploadSessionCancelInputSchema,
  uploadSessionConfirmInputSchema,
  uploadSessionCreateInputSchema,
  uploadSessionResponseSchema,
} from "./source.js";

const ORG = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const SOURCE = "44444444-4444-4444-8444-444444444444";
const OTHER_SOURCE = "55555555-5555-4555-8555-555555555555";

const SHA256_A = "a".repeat(64);
const SHA256_B = "b".repeat(64);

const ATTESTATION_TEXT =
  "I confirm I have the right to provide this reference for functional inspiration only, not verbatim copying of protected design, text, or code.";

function pdfFile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ordinal: 0,
    role: "primary" as const,
    originalFileName: "requirements.pdf",
    format: "pdf" as const,
    declaredMimeType: "application/pdf",
    byteSize: 1024,
    sha256: SHA256_A,
    ...overrides,
  };
}

describe("sha256HexSchema", () => {
  it("accepts a 64-character lowercase hex digest and normalizes case", () => {
    expect(sha256HexSchema.parse(SHA256_A.toUpperCase())).toBe(SHA256_A);
  });

  it.each([
    "",
    "a".repeat(63),
    "a".repeat(65),
    `${"a".repeat(63)}g`,
  ])("rejects invalid hash %j", (value) => {
    expect(sha256HexSchema.safeParse(value).success).toBe(false);
  });
});

describe("sourceFileDeclarationSchema (format allowlist)", () => {
  it("accepts every V1 format with an allowlisted MIME type", () => {
    for (const [format, mimeTypes] of Object.entries(sourceDocumentFormatMimeTypes)) {
      const result = sourceFileDeclarationSchema.safeParse({
        originalFileName: `evidence.${format}`,
        format,
        declaredMimeType: mimeTypes[0],
        byteSize: 100,
        sha256: SHA256_A,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects a MIME type that does not match the declared format", () => {
    const result = sourceFileDeclarationSchema.safeParse({
      originalFileName: "sneaky.pdf",
      format: "pdf",
      declaredMimeType: "image/png",
      byteSize: 100,
      sha256: SHA256_A,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported (deferred legacy) format", () => {
    const result = sourceFileDeclarationSchema.safeParse({
      originalFileName: "legacy.doc",
      format: "doc",
      declaredMimeType: "application/msword",
      byteSize: 100,
      sha256: SHA256_A,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a size above the default because the API enforces the configured ceiling", () => {
    const result = sourceFileDeclarationSchema.safeParse({
      originalFileName: "huge.pdf",
      format: "pdf",
      declaredMimeType: "application/pdf",
      byteSize: 100 * 1024 * 1024 + 1,
      sha256: SHA256_A,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive byte size", () => {
    expect(
      sourceFileDeclarationSchema.safeParse({
        originalFileName: "empty.pdf",
        format: "pdf",
        declaredMimeType: "application/pdf",
        byteSize: 0,
        sha256: SHA256_A,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown extra keys (strict object)", () => {
    const result = sourceFileDeclarationSchema.safeParse({
      originalFileName: "requirements.pdf",
      format: "pdf",
      declaredMimeType: "application/pdf",
      byteSize: 100,
      sha256: SHA256_A,
      unexpected: "nope",
    });
    expect(result.success).toBe(false);
  });
});

describe("uploadSessionCreateInputSchema", () => {
  it("accepts a single-file document upload session", () => {
    const result = uploadSessionCreateInputSchema.safeParse({
      sourceType: "document",
      documentFormat: "pdf",
      title: "Kickoff notes",
      files: [pdfFile()],
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.sourceType === "document") {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("rejects a document session with more than one file", () => {
    const result = uploadSessionCreateInputSchema.safeParse({
      sourceType: "document",
      documentFormat: "pdf",
      title: "Kickoff notes",
      files: [pdfFile(), pdfFile({ ordinal: 1, sha256: SHA256_B })],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a multi-file screenshot-set reference upload session", () => {
    const result = uploadSessionCreateInputSchema.safeParse({
      sourceType: "reference",
      title: "Competitor onboarding flow",
      reference: {
        referenceKind: "screenshot_set",
        captureMethod: "user_uploaded_screenshot",
        accessType: "public",
        intendedUse: "inspiration",
        attestation: {
          attestationText: ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: "2026-07-10T00:00:00Z",
        },
      },
      files: [
        pdfFile({ ordinal: 0, role: "primary", format: "png", declaredMimeType: "image/png" }),
        pdfFile({
          ordinal: 1,
          role: "snapshot",
          format: "png",
          declaredMimeType: "image/png",
          sha256: SHA256_B,
        }),
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a client-supplied supersedes ID because the version route owns it", () => {
    const result = uploadSessionCreateInputSchema.safeParse({
      sourceType: "document",
      documentFormat: "pdf",
      title: "Kickoff notes",
      supersedesId: SOURCE,
      files: [pdfFile()],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a reference session with a reference kind outside the upload-eligible set", () => {
    const result = uploadSessionCreateInputSchema.safeParse({
      sourceType: "reference",
      title: "Competitor site",
      reference: {
        referenceKind: "url",
        captureMethod: "manual_paste",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.com/app",
        attestation: {
          attestationText: ATTESTATION_TEXT,
          attestationVersion: "v1",
          acceptedAt: "2026-07-10T00:00:00Z",
        },
      },
      files: [pdfFile({ format: "png", declaredMimeType: "image/png" })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a reference upload session missing the reference metadata block", () => {
    const result = uploadSessionCreateInputSchema.safeParse({
      sourceType: "reference",
      title: "Competitor screenshots",
      files: [pdfFile({ format: "png", declaredMimeType: "image/png" })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown sourceType discriminator", () => {
    const result = uploadSessionCreateInputSchema.safeParse({
      sourceType: "manual",
      title: "Kickoff notes",
      files: [pdfFile()],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra keys (strict object)", () => {
    const result = uploadSessionCreateInputSchema.safeParse({
      sourceType: "document",
      documentFormat: "pdf",
      title: "Kickoff notes",
      files: [pdfFile()],
      extra: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("uploadSessionConfirmInputSchema / uploadSessionCancelInputSchema", () => {
  it("accepts an empty confirm body and an optional duplicate re-acknowledgement", () => {
    expect(uploadSessionConfirmInputSchema.safeParse({}).success).toBe(true);
    expect(
      uploadSessionConfirmInputSchema.safeParse({
        duplicateAcknowledgement: { acknowledgedMatchIds: [SOURCE] },
      }).success,
    ).toBe(true);
  });

  it("accepts an empty cancel body and an optional reason", () => {
    expect(uploadSessionCancelInputSchema.safeParse({}).success).toBe(true);
    expect(
      uploadSessionCancelInputSchema.safeParse({ reason: "Selected the wrong file." }).success,
    ).toBe(true);
  });
});

describe("sourceDuplicateAcknowledgementInputSchema", () => {
  it("requires at least one acknowledged match id", () => {
    expect(
      sourceDuplicateAcknowledgementInputSchema.safeParse({ acknowledgedMatchIds: [] }).success,
    ).toBe(false);
    expect(
      sourceDuplicateAcknowledgementInputSchema.safeParse({ acknowledgedMatchIds: [SOURCE] })
        .success,
    ).toBe(true);
  });
});

describe("manualSourceCreateInputSchema", () => {
  it("accepts a manual text source", () => {
    const result = manualSourceCreateInputSchema.safeParse({
      title: "Stakeholder interview transcript",
      body: "Q: ... A: ...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty body", () => {
    expect(manualSourceCreateInputSchema.safeParse({ title: "Empty", body: "   " }).success).toBe(
      false,
    );
  });
});

describe("referenceMetadataInputSchema / referenceSourceCreateInputSchema", () => {
  const baseReference = {
    referenceKind: "url" as const,
    captureMethod: "manual_paste" as const,
    accessType: "public" as const,
    intendedUse: "inspiration" as const,
    sourceUrl: "https://example.com/app",
    attestation: {
      attestationText: ATTESTATION_TEXT,
      attestationVersion: "v1",
      acceptedAt: "2026-07-10T00:00:00Z",
    },
  };

  it("accepts a valid reference with correct attestation text", () => {
    expect(referenceMetadataInputSchema.safeParse(baseReference).success).toBe(true);
  });

  it("rejects an attestation with any deviation from the exact required text", () => {
    const result = referenceMetadataInputSchema.safeParse({
      ...baseReference,
      attestation: { ...baseReference.attestation, attestationText: `${ATTESTATION_TEXT} extra` },
    });
    expect(result.success).toBe(false);
  });

  it("requires a source URL when the capture method is on-demand single-page capture", () => {
    const result = referenceMetadataInputSchema.safeParse({
      ...baseReference,
      captureMethod: "on_demand_single_page_capture",
      sourceUrl: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("accepts on-demand capture when a source URL is present", () => {
    const result = referenceMetadataInputSchema.safeParse({
      ...baseReference,
      captureMethod: "on_demand_single_page_capture",
    });
    expect(result.success).toBe(true);
  });

  it("builds a full reference source create input", () => {
    const result = referenceSourceCreateInputSchema.safeParse({
      title: "Competitor pricing page",
      reference: baseReference,
    });
    expect(result.success).toBe(true);
  });

  it("rejects direct reference creation that includes uploaded files (screenshots must go via upload session)", () => {
    const result = referenceSourceCreateInputSchema.safeParse({
      title: "Competitor screenshots",
      reference: baseReference,
      files: [
        {
          ordinal: 0,
          role: "primary",
          originalFileName: "shot.png",
          format: "png",
          declaredMimeType: "image/png",
          byteSize: 100,
          sha256: SHA256_A,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a direct reference with user_uploaded_screenshot capture method", () => {
    const result = referenceSourceCreateInputSchema.safeParse({
      title: "Screenshot ref",
      reference: {
        ...baseReference,
        captureMethod: "user_uploaded_screenshot",
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("referenceCaptureRequestInputSchema", () => {
  it("rejects a non-URL capture request", () => {
    expect(referenceCaptureRequestInputSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });

  it("accepts a well-formed HTTPS URL", () => {
    expect(
      referenceCaptureRequestInputSchema.safeParse({ url: "https://example.com/page" }).success,
    ).toBe(true);
  });
});

describe("ipReviewChangeInputSchema", () => {
  it("requires a reason and rejects reverting to not_reviewed", () => {
    expect(
      ipReviewChangeInputSchema.safeParse({ version: 1, ipReviewStatus: "cleared", reason: "" })
        .success,
    ).toBe(false);
    expect(
      ipReviewChangeInputSchema.safeParse({
        version: 1,
        ipReviewStatus: "not_reviewed",
        reason: "Reset",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid clearance change", () => {
    expect(
      ipReviewChangeInputSchema.safeParse({
        version: 1,
        ipReviewStatus: "cleared",
        reason: "Legal confirmed rights.",
      }).success,
    ).toBe(true);
  });
});

describe("sourceMetadataPatchInputSchema", () => {
  it("rejects a patch with only the optimistic version", () => {
    expect(sourceMetadataPatchInputSchema.safeParse({ version: 1 }).success).toBe(false);
  });

  it("accepts a patch that changes only the title", () => {
    expect(sourceMetadataPatchInputSchema.safeParse({ version: 1, title: "Renamed" }).success).toBe(
      true,
    );
  });

  it("does not let create-schema tag defaults leak into the patch shape", () => {
    const result = sourceMetadataPatchInputSchema.safeParse({ version: 1, notes: "Context" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("tags");
      expect(result.data).not.toHaveProperty("title");
    }
  });
});

describe("sourceArchiveInputSchema", () => {
  it("requires the optimistic version and accepts an optional reason", () => {
    expect(sourceArchiveInputSchema.safeParse({}).success).toBe(false);
    expect(sourceArchiveInputSchema.safeParse({ version: 1 }).success).toBe(true);
    expect(sourceArchiveInputSchema.safeParse({ version: 1, reason: "Superseded" }).success).toBe(
      true,
    );
  });
});

describe("sourceListFilterSchema", () => {
  it("defaults includeArchived to false and paginates", () => {
    const result = sourceListFilterSchema.parse({});
    expect(result.includeArchived).toBe(false);
    expect(result.limit).toBe(25);
  });

  it("rejects an unknown source type filter value", () => {
    expect(sourceListFilterSchema.safeParse({ sourceType: "attachment" }).success).toBe(false);
  });
});

describe("response shapes", () => {
  const fileResponse = {
    id: SOURCE,
    ordinal: 0,
    role: "primary" as const,
    originalFileName: "requirements.pdf",
    downloadFileName: "requirements.pdf",
    format: "pdf" as const,
    declaredMimeType: "application/pdf",
    byteSize: 1024,
    sha256: SHA256_A,
    scanStatus: "clean" as const,
    scannedAt: "2026-07-10T00:00:00Z",
  };

  it("validates a source document file response", () => {
    expect(sourceDocumentFileResponseSchema.safeParse(fileResponse).success).toBe(true);
  });

  it("rejects an invalid scan status", () => {
    expect(
      sourceDocumentFileResponseSchema.safeParse({ ...fileResponse, scanStatus: "unknown" })
        .success,
    ).toBe(false);
  });

  const summary = {
    id: SOURCE,
    lineageId: SOURCE,
    versionNumber: 1,
    supersedesId: null,
    sourceType: "document" as const,
    documentFormat: "pdf" as const,
    title: "Requirements doc",
    tags: [],
    processingStatus: "ready" as const,
    isArchived: false,
    hasDuplicateAcknowledgement: false,
    ipReviewStatus: null,
    contentHash: SHA256_A,
    createdByActorId: USER,
    createdAt: "2026-07-10T00:00:00Z",
  };

  it("validates a source document summary response", () => {
    expect(sourceDocumentSummaryResponseSchema.safeParse(summary).success).toBe(true);
  });

  it("validates a source document detail response including files", () => {
    const detail = {
      ...summary,
      version: 1,
      notes: null,
      provenanceDate: null,
      archivedByActorId: null,
      archivedAt: null,
      files: [fileResponse],
    };
    expect(sourceDocumentDetailResponseSchema.safeParse(detail).success).toBe(true);
  });

  it("validates an upload session response with an ephemeral signed URL", () => {
    const result = uploadSessionResponseSchema.safeParse({
      id: SOURCE,
      organizationId: ORG,
      projectId: PROJECT,
      actorId: USER,
      sourceType: "document",
      status: "created",
      title: "Requirements doc",
      expiresAt: "2026-07-11T00:00:00Z",
      confirmedAt: null,
      createdSourceId: null,
      duplicateMatches: [],
      files: [
        {
          id: OTHER_SOURCE,
          ordinal: 0,
          role: "primary",
          originalFileName: "requirements.pdf",
          format: "pdf",
          declaredMimeType: "application/pdf",
          byteSize: 1024,
          sha256: SHA256_A,
          signedUploadUrl: "https://storage.example.com/put/abc",
          signedUploadUrlExpiresAt: "2026-07-10T00:15:00Z",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("canonicalSourceManifestInputSchema", () => {
  it("accepts an ordered multi-file manifest input", () => {
    const result = canonicalSourceManifestInputSchema.safeParse({
      sourceType: "reference",
      files: [
        { ordinal: 0, role: "primary", sha256: SHA256_A },
        { ordinal: 1, role: "snapshot", sha256: SHA256_B },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts immutable reference evidence fields but rejects mutable title", () => {
    const withReference = canonicalSourceManifestInputSchema.safeParse({
      sourceType: "reference",
      reference: {
        referenceKind: "url",
        captureMethod: "manual_paste",
        accessType: "public",
        intendedUse: "inspiration",
        sourceUrl: "https://example.com/page",
      },
      files: [{ ordinal: 0, role: "snapshot", sha256: SHA256_A }],
    });
    expect(withReference.success).toBe(true);

    const withTitle = canonicalSourceManifestInputSchema.safeParse({
      sourceType: "reference",
      title: "Should not be accepted",
      files: [{ ordinal: 0, role: "snapshot", sha256: SHA256_A }],
    });
    expect(withTitle.success).toBe(false);
  });

  it("rejects an empty file list", () => {
    expect(
      canonicalSourceManifestInputSchema.safeParse({
        sourceType: "manual",
        files: [],
      }).success,
    ).toBe(false);
  });
});

describe("referenceAttestationTextSchema", () => {
  it("only accepts the exact canonical attestation string", () => {
    expect(referenceAttestationTextSchema.safeParse(ATTESTATION_TEXT).success).toBe(true);
    expect(referenceAttestationTextSchema.safeParse(`${ATTESTATION_TEXT}.`).success).toBe(false);
  });
});
