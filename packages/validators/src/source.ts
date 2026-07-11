import {
  ipReviewStatusValues,
  referenceAccessTypeValues,
  referenceCaptureMethodValues,
  referenceIntendedUseValues,
  referenceKindValues,
  type SourceDocumentFormat,
  sourceDocumentFormatValues,
  sourceExtractionStatusValues,
  sourceFileScanStatusValues,
  sourceIntakeModeValues,
  sourceProcessingStatusValues,
  sourceTypeValues,
  uploadFileRoleValues,
  uploadSessionStatusValues,
} from "@atlashq/types";
import { z } from "zod";
import { booleanQuerySchema, optimisticVersionSchema } from "./helpers.js";
import {
  isoDateTimeSchema,
  organizationIdSchema,
  projectIdSchema,
  userIdSchema,
  uuidSchema,
} from "./ids.js";
import { createPaginatedResponseSchema, paginationQuerySchema } from "./pagination.js";

// ---------------------------------------------------------------------------
// Controlled value enums (mirroring @atlashq/types, module-02 §6, §8)
// ---------------------------------------------------------------------------

export const sourceIntakeModeSchema = z.enum(sourceIntakeModeValues);
export const sourceTypeSchema = z.enum(sourceTypeValues);
export const sourceDocumentFormatSchema = z.enum(sourceDocumentFormatValues);
export const uploadSessionStatusSchema = z.enum(uploadSessionStatusValues);
export const uploadFileRoleSchema = z.enum(uploadFileRoleValues);
export const sourceProcessingStatusSchema = z.enum(sourceProcessingStatusValues);
export const sourceFileScanStatusSchema = z.enum(sourceFileScanStatusValues);
export const sourceExtractionStatusSchema = z.enum(sourceExtractionStatusValues);
export const referenceKindSchema = z.enum(referenceKindValues);
export const referenceCaptureMethodSchema = z.enum(referenceCaptureMethodValues);
export const referenceAccessTypeSchema = z.enum(referenceAccessTypeValues);
export const referenceIntendedUseSchema = z.enum(referenceIntendedUseValues);
export const ipReviewStatusSchema = z.enum(ipReviewStatusValues);

// ---------------------------------------------------------------------------
// Shared field primitives
// ---------------------------------------------------------------------------

export const sourceTitleSchema = z.string().trim().min(1).max(200);
export const sourceNotesSchema = z.string().trim().min(1).max(4000);
export const sourceTagSchema = z.string().trim().min(1).max(64);
export const sourceTagsSchema = z.array(sourceTagSchema).max(20);

export const sha256HexSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-f0-9]{64}$/, "Content hash must be a 64-character lowercase hex SHA-256 digest.");

/**
 * The wire contract only requires a positive safe integer. The API enforces the
 * environment-configured upload ceiling from `packages/config`.
 */
export const sourceFileByteSizeSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const sourceDeclaredMimeTypeSchema = z.string().trim().min(1).max(255);

export const sourceOriginalFileNameSchema = z.string().trim().min(1).max(255);

/**
 * V1 supported-format allowlist (module-02 §3): declared extension paired with the MIME types the
 * API accepts for it. `jpg`/`jpeg` intentionally share the same MIME type.
 */
export const sourceDocumentFormatMimeTypes = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
} as const satisfies Record<SourceDocumentFormat, readonly string[]>;

function isAllowedMimeTypeForFormat(format: SourceDocumentFormat, mimeType: string): boolean {
  return (sourceDocumentFormatMimeTypes[format] as readonly string[]).includes(mimeType);
}

/**
 * Strict declared-metadata contract for a single file: extension/format, declared MIME type
 * (checked against the allowlist), byte size, and content hash. Reused everywhere a file's
 * pre-scan metadata must be validated (module-02 §6.2, §6.9).
 */
export const sourceFileDeclarationSchema = z
  .object({
    originalFileName: sourceOriginalFileNameSchema,
    format: sourceDocumentFormatSchema,
    declaredMimeType: sourceDeclaredMimeTypeSchema,
    byteSize: sourceFileByteSizeSchema,
    sha256: sha256HexSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isAllowedMimeTypeForFormat(value.format, value.declaredMimeType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["declaredMimeType"],
        message: `Declared MIME type does not match the allowlist for the "${value.format}" format.`,
      });
    }
  });

export type SourceFileDeclaration = z.infer<typeof sourceFileDeclarationSchema>;

/** Adds upload-session-only fields (ordinal/role) on top of the shared file declaration. */
const uploadSessionFileInputSchema = z
  .object({
    ordinal: z.number().int().min(0),
    role: uploadFileRoleSchema,
    originalFileName: sourceOriginalFileNameSchema,
    format: sourceDocumentFormatSchema,
    declaredMimeType: sourceDeclaredMimeTypeSchema,
    byteSize: sourceFileByteSizeSchema,
    sha256: sha256HexSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isAllowedMimeTypeForFormat(value.format, value.declaredMimeType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["declaredMimeType"],
        message: `Declared MIME type does not match the allowlist for the "${value.format}" format.`,
      });
    }
  });

export type UploadSessionFileInput = z.infer<typeof uploadSessionFileInputSchema>;

// ---------------------------------------------------------------------------
// Duplicate detection and acknowledgement (module-02 §6.3)
// ---------------------------------------------------------------------------

export const sourceDuplicateMatchSchema = z
  .object({
    sourceId: uuidSchema,
    title: sourceTitleSchema,
    versionNumber: z.number().int().positive(),
    isArchived: z.boolean(),
    isSuperseded: z.boolean(),
    contributorId: userIdSchema,
    uploadedAt: isoDateTimeSchema,
  })
  .strict();

export type SourceDuplicateMatch = z.infer<typeof sourceDuplicateMatchSchema>;

/** The user must acknowledge the exact matching source IDs before duplicate content is allowed. */
export const sourceDuplicateAcknowledgementInputSchema = z
  .object({
    acknowledgedMatchIds: z.array(uuidSchema).min(1),
  })
  .strict();

export type SourceDuplicateAcknowledgementInput = z.infer<
  typeof sourceDuplicateAcknowledgementInputSchema
>;

// ---------------------------------------------------------------------------
// Reference attestation + metadata primitives (module-02 §6.7, §6.8)
// Defined ahead of the upload session so uploaded-file reference sessions can carry the same
// immutable attestation + reference metadata that URL/manual references collect at create time.
// ---------------------------------------------------------------------------

/** The exact, immutable attestation text the checkbox must confirm (module-02 §6.7). */
export const referenceAttestationTextSchema = z.literal(
  "I confirm I have the right to provide this reference for functional inspiration only, not verbatim copying of protected design, text, or code.",
);

export const referenceAttestationInputSchema = z
  .object({
    attestationText: referenceAttestationTextSchema,
    attestationVersion: z.string().trim().min(1).max(20),
    acceptedAt: isoDateTimeSchema,
  })
  .strict();

export type ReferenceAttestationInput = z.infer<typeof referenceAttestationInputSchema>;

/** Full immutable reference metadata + attestation contract; reused for direct and upload flows. */
export const referenceMetadataInputSchema = z
  .object({
    referenceKind: referenceKindSchema,
    captureMethod: referenceCaptureMethodSchema,
    accessType: referenceAccessTypeSchema,
    intendedUse: referenceIntendedUseSchema,
    sourceUrl: z.url().optional(),
    capturedAt: isoDateTimeSchema.optional(),
    attestation: referenceAttestationInputSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.captureMethod === "on_demand_single_page_capture" && !value.sourceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceUrl"],
        message: "A source URL is required for on-demand single-page capture references.",
      });
    }
  });

export type ReferenceMetadataInput = z.infer<typeof referenceMetadataInputSchema>;

// ---------------------------------------------------------------------------
// Upload sessions (module-02 §6.2, §8.1, §8.2)
// ---------------------------------------------------------------------------

const uploadSessionDocumentCreateInputSchema = z
  .object({
    sourceType: z.literal("document"),
    documentFormat: sourceDocumentFormatSchema,
    title: sourceTitleSchema,
    tags: sourceTagsSchema.default([]),
    notes: sourceNotesSchema.optional(),
    provenanceDate: isoDateTimeSchema.optional(),
    files: z.array(uploadSessionFileInputSchema).length(1),
    duplicateAcknowledgement: sourceDuplicateAcknowledgementInputSchema.optional(),
  })
  .strict();

/**
 * Uploaded reference sources (screenshot sets and uploaded exports) carry the same immutable
 * reference metadata + attestation as direct references so the confirm step can persist a
 * reference_artifact row and attestation audit event without needing a separate write.
 */
const uploadSessionReferenceCreateInputSchema = z
  .object({
    sourceType: z.literal("reference"),
    title: sourceTitleSchema,
    tags: sourceTagsSchema.default([]),
    notes: sourceNotesSchema.optional(),
    provenanceDate: isoDateTimeSchema.optional(),
    reference: referenceMetadataInputSchema.superRefine((value, ctx) => {
      if (
        !(value.referenceKind === "screenshot_set" || value.referenceKind === "uploaded_export")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["referenceKind"],
          message:
            "Uploaded reference sessions only accept screenshot_set or uploaded_export references.",
        });
      }
      if (
        !(
          value.captureMethod === "user_uploaded_screenshot" ||
          value.captureMethod === "on_demand_single_page_capture"
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["captureMethod"],
          message:
            "Uploaded reference sessions require captureMethod user_uploaded_screenshot or on_demand_single_page_capture.",
        });
      }
    }),
    files: z.array(uploadSessionFileInputSchema).min(1).max(20),
    duplicateAcknowledgement: sourceDuplicateAcknowledgementInputSchema.optional(),
  })
  .strict();

/**
 * `POST /source-document-upload-sessions` request contract (module-02 §11). A discriminated union
 * on `sourceType` keeps a single regular document (exactly one file) separate from a
 * screenshot-set/uploaded-export reference (one or more ordered files); reference attestation
 * + metadata is carried on the reference session itself so the confirm step can persist the
 * reference_artifact and dedicated attestation audit event atomically.
 */
export const uploadSessionCreateInputSchema = z.discriminatedUnion("sourceType", [
  uploadSessionDocumentCreateInputSchema,
  uploadSessionReferenceCreateInputSchema,
]);

export type UploadSessionCreateInput = z.infer<typeof uploadSessionCreateInputSchema>;

/** Idempotent confirm; re-submitting the same acknowledgement closes duplicate race windows. */
export const uploadSessionConfirmInputSchema = z
  .object({
    duplicateAcknowledgement: sourceDuplicateAcknowledgementInputSchema.optional(),
  })
  .strict();

export type UploadSessionConfirmInput = z.infer<typeof uploadSessionConfirmInputSchema>;

export const uploadSessionCancelInputSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type UploadSessionCancelInput = z.infer<typeof uploadSessionCancelInputSchema>;

/**
 * A signed PUT URL is only ever returned inline on the upload-session response while the session
 * is active; it is never treated as, or stored alongside, persisted credentials (module-02 §9.1,
 * §11 "Signed URLs are separate operations and never embedded long-term...").
 */
export const uploadSessionFileResponseSchema = z
  .object({
    id: uuidSchema,
    ordinal: z.number().int().min(0),
    role: uploadFileRoleSchema,
    originalFileName: z.string().trim().min(1),
    format: sourceDocumentFormatSchema,
    declaredMimeType: sourceDeclaredMimeTypeSchema,
    byteSize: sourceFileByteSizeSchema,
    sha256: sha256HexSchema,
    signedUploadUrl: z.url(),
    signedUploadUrlExpiresAt: isoDateTimeSchema,
  })
  .strict();

export type UploadSessionFileResponse = z.infer<typeof uploadSessionFileResponseSchema>;

export const uploadSessionResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: organizationIdSchema,
    projectId: projectIdSchema,
    actorId: userIdSchema,
    sourceType: sourceTypeSchema.extract(["document", "reference"]),
    status: uploadSessionStatusSchema,
    title: sourceTitleSchema,
    expiresAt: isoDateTimeSchema,
    confirmedAt: isoDateTimeSchema.nullable(),
    createdSourceId: uuidSchema.nullable(),
    duplicateMatches: z.array(sourceDuplicateMatchSchema).default([]),
    files: z.array(uploadSessionFileResponseSchema),
  })
  .strict();

export type UploadSessionResponse = z.infer<typeof uploadSessionResponseSchema>;

// ---------------------------------------------------------------------------
// Manual text evidence (module-02 §6.4)
// ---------------------------------------------------------------------------

export const manualSourceBodySchema = z.string().trim().min(1).max(200_000);

export const manualSourceCreateInputSchema = z
  .object({
    title: sourceTitleSchema,
    tags: sourceTagsSchema.default([]),
    notes: sourceNotesSchema.optional(),
    provenanceDate: isoDateTimeSchema.optional(),
    body: manualSourceBodySchema,
    duplicateAcknowledgement: sourceDuplicateAcknowledgementInputSchema.optional(),
  })
  .strict();

export type ManualSourceCreateInput = z.infer<typeof manualSourceCreateInputSchema>;

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Reference artifacts, IP review (module-02 §6.7, §6.8, §8.7)
// ---------------------------------------------------------------------------

/**
 * `POST /source-documents/references` request contract (module-02 §11). Direct references are
 * URL-only or manual-paste (`captureMethod` `manual_paste` / `on_demand_single_page_capture`);
 * user-uploaded screenshots/exports MUST go through the upload-session flow so the raw bytes are
 * scanned and stored with a canonical object key. Attaching `files` here is rejected.
 */
export const referenceSourceCreateInputSchema = z
  .object({
    title: sourceTitleSchema,
    tags: sourceTagsSchema.default([]),
    notes: sourceNotesSchema.optional(),
    provenanceDate: isoDateTimeSchema.optional(),
    reference: referenceMetadataInputSchema.superRefine((value, ctx) => {
      if (value.captureMethod === "user_uploaded_screenshot") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["captureMethod"],
          message:
            "user_uploaded_screenshot references must be created through an upload session, not the direct reference endpoint.",
        });
      }
    }),
    duplicateAcknowledgement: sourceDuplicateAcknowledgementInputSchema.optional(),
  })
  .strict();

export type ReferenceSourceCreateInput = z.infer<typeof referenceSourceCreateInputSchema>;

/** `POST /source-documents/:sourceId/reference-capture` request contract (module-02 §6.8, §11). */
export const referenceCaptureRequestInputSchema = z
  .object({
    url: z.url(),
  })
  .strict();

export type ReferenceCaptureRequestInput = z.infer<typeof referenceCaptureRequestInputSchema>;

/** `POST /source-documents/:sourceId/ip-review`; requires `project:admin` (module-02 §7, §11). */
export const ipReviewChangeInputSchema = z
  .object({
    version: optimisticVersionSchema,
    ipReviewStatus: ipReviewStatusSchema.exclude(["not_reviewed"]),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export type IpReviewChangeInput = z.infer<typeof ipReviewChangeInputSchema>;

export const referenceArtifactResponseSchema = z
  .object({
    id: uuidSchema,
    sourceDocumentId: uuidSchema,
    referenceKind: referenceKindSchema,
    captureMethod: referenceCaptureMethodSchema,
    accessType: referenceAccessTypeSchema,
    intendedUse: referenceIntendedUseSchema,
    sourceUrl: z.url().nullable(),
    ipReviewStatus: ipReviewStatusSchema,
    ipReviewReason: z.string().trim().min(1).nullable(),
    ipReviewedByActorId: userIdSchema.nullable(),
    ipReviewedAt: isoDateTimeSchema.nullable(),
    attestationText: z.string().trim().min(1),
    attestationVersion: z.string().trim().min(1),
    attestedByActorId: userIdSchema,
    attestedAt: isoDateTimeSchema,
    capturedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export type ReferenceArtifactResponse = z.infer<typeof referenceArtifactResponseSchema>;

// ---------------------------------------------------------------------------
// Mutable metadata, archive/restore/retry (module-02 §6.5, §6.6, §6.9, §6.11)
// ---------------------------------------------------------------------------

/**
 * Only title/tags/notes are mutable in place (module-02 §6.11). Built from a plain shape (no
 * `.partial()` of a create schema) so create-only Zod defaults never leak into this patch — see
 * the matching convention in `project.ts`/`client.ts`.
 */
export const sourceMetadataPatchInputSchema = z
  .object({
    version: optimisticVersionSchema,
    title: sourceTitleSchema.optional(),
    tags: sourceTagsSchema.optional(),
    notes: sourceNotesSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "At least one mutable field must be provided to update a source document.",
  });

export type SourceMetadataPatchInput = z.infer<typeof sourceMetadataPatchInputSchema>;

export const sourceArchiveInputSchema = z
  .object({
    version: optimisticVersionSchema,
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export type SourceArchiveInput = z.infer<typeof sourceArchiveInputSchema>;

export const sourceRestoreInputSchema = z
  .object({
    version: optimisticVersionSchema,
  })
  .strict();

export type SourceRestoreInput = z.infer<typeof sourceRestoreInputSchema>;

export const sourceRetryProcessingInputSchema = z
  .object({
    version: optimisticVersionSchema,
  })
  .strict();

export type SourceRetryProcessingInput = z.infer<typeof sourceRetryProcessingInputSchema>;

/**
 * `POST /source-documents/:sourceId/versions/upload-session` and `.../versions/manual` reuse the
 * same create shapes as the initial intake; the path's `sourceId` supplies the lineage being
 * replaced, and the server sets `supersedesId` from it rather than trusting a client-supplied value.
 */
export const sourceVersionUploadSessionInputSchema = uploadSessionCreateInputSchema;
export const sourceVersionManualInputSchema = manualSourceCreateInputSchema;

// ---------------------------------------------------------------------------
// List/filter and response shapes (module-02 §11)
// ---------------------------------------------------------------------------

export const sourceListFilterSchema = paginationQuerySchema
  .extend({
    sourceType: sourceTypeSchema.optional(),
    documentFormat: sourceDocumentFormatSchema.optional(),
    processingStatus: sourceProcessingStatusSchema.optional(),
    ipReviewStatus: ipReviewStatusSchema.optional(),
    includeArchived: booleanQuerySchema.default(false),
    hasUnacknowledgedDuplicate: booleanQuerySchema.optional(),
    tag: sourceTagSchema.optional(),
    contributorId: userIdSchema.optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type SourceListFilter = z.infer<typeof sourceListFilterSchema>;

export const sourceDocumentFileResponseSchema = z
  .object({
    id: uuidSchema,
    ordinal: z.number().int().min(0),
    role: uploadFileRoleSchema,
    originalFileName: z.string().trim().min(1),
    downloadFileName: z.string().trim().min(1),
    format: sourceDocumentFormatSchema,
    declaredMimeType: sourceDeclaredMimeTypeSchema,
    byteSize: sourceFileByteSizeSchema,
    sha256: sha256HexSchema,
    scanStatus: sourceFileScanStatusSchema,
    scannedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export type SourceDocumentFileResponse = z.infer<typeof sourceDocumentFileResponseSchema>;

export const sourceDocumentSummaryResponseSchema = z
  .object({
    id: uuidSchema,
    lineageId: uuidSchema,
    versionNumber: z.number().int().positive(),
    supersedesId: uuidSchema.nullable(),
    sourceType: sourceTypeSchema,
    documentFormat: sourceDocumentFormatSchema.nullable(),
    title: sourceTitleSchema,
    tags: sourceTagsSchema,
    processingStatus: sourceProcessingStatusSchema,
    isArchived: z.boolean(),
    hasDuplicateAcknowledgement: z.boolean(),
    ipReviewStatus: ipReviewStatusSchema.nullable(),
    contentHash: sha256HexSchema,
    createdByActorId: userIdSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type SourceDocumentSummaryResponse = z.infer<typeof sourceDocumentSummaryResponseSchema>;

export const sourceDocumentDetailResponseSchema = sourceDocumentSummaryResponseSchema
  .extend({
    version: optimisticVersionSchema,
    notes: sourceNotesSchema.nullable(),
    provenanceDate: isoDateTimeSchema.nullable(),
    archivedByActorId: userIdSchema.nullable(),
    archivedAt: isoDateTimeSchema.nullable(),
    files: z.array(sourceDocumentFileResponseSchema),
    reference: referenceArtifactResponseSchema.optional(),
  })
  .strict();

export type SourceDocumentDetailResponse = z.infer<typeof sourceDocumentDetailResponseSchema>;

export const sourceDocumentListResponseSchema = createPaginatedResponseSchema(
  sourceDocumentSummaryResponseSchema,
);

export const sourceExtractionResponseSchema = z
  .object({
    id: uuidSchema,
    sourceDocumentId: uuidSchema,
    extractionVersion: z.number().int().positive(),
    status: sourceExtractionStatusSchema,
    parserManifest: z.array(
      z
        .object({
          name: z.string().trim().min(1),
          version: z.string().trim().min(1),
        })
        .strict(),
    ),
    chunkerVersion: z.string().trim().min(1),
    extractedTextHash: sha256HexSchema.nullable(),
    previewObjectKey: z.string().trim().min(1).nullable(),
    startedAt: isoDateTimeSchema.nullable(),
    completedAt: isoDateTimeSchema.nullable(),
    failureCode: z.string().trim().min(1).nullable(),
    failureDetail: z.string().trim().min(1).nullable(),
  })
  .strict();

export type SourceExtractionResponse = z.infer<typeof sourceExtractionResponseSchema>;

export const sourceChunkLocatorSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export const sourceChunkResponseSchema = z
  .object({
    id: uuidSchema,
    sourceExtractionId: uuidSchema,
    sequence: z.number().int().min(0),
    content: z.string(),
    characterCount: z.number().int().min(0),
    contentHash: sha256HexSchema,
    locator: sourceChunkLocatorSchema,
  })
  .strict();

export type SourceChunkResponse = z.infer<typeof sourceChunkResponseSchema>;

/**
 * Ephemeral preview/download URL contract (module-02 §11 "Signed URLs are separate operations").
 * Never persisted alongside a source/file response and never modeled as a stored credential.
 */
export const sourceFileSignedUrlResponseSchema = z
  .object({
    url: z.url(),
    expiresAt: isoDateTimeSchema,
  })
  .strict();

export type SourceFileSignedUrlResponse = z.infer<typeof sourceFileSignedUrlResponseSchema>;

// ---------------------------------------------------------------------------
// Source Vault capability contract (module-02 §5, §9) -- consumed by web to boot-safely gate
// write/capture/OCR UI affordances without duplicating server-authoritative feature-flag and
// infra-availability logic on the client. Never leaks config values or credentials: only booleans.
// ---------------------------------------------------------------------------

export const sourceVaultCapabilitiesResponseSchema = z
  .object({
    writesEnabled: z.boolean(),
    singlePageCaptureEnabled: z.boolean(),
    ocrProcessingEnabled: z.boolean(),
    storageAvailable: z.boolean(),
    queueAvailable: z.boolean(),
  })
  .strict();

export type SourceVaultCapabilitiesResponse = z.infer<typeof sourceVaultCapabilitiesResponseSchema>;

// ---------------------------------------------------------------------------
// Canonical source-manifest hashing input (module-02 §6.3)
// ---------------------------------------------------------------------------

/**
 * For reference/multi-file sources, the canonical source hash is SHA-256 over canonical JSON
 * containing *only* immutable evidence fields plus ordered child-file hashes. This schema
 * validates the *input* to that canonicalization/hashing step; the hashing itself is a
 * worker/storage concern.
 *
 * Deliberately excludes mutable metadata (`title`, `tags`, `notes`, `provenanceDate`) so that
 * duplicate identity and content hashing are independent of anything an editor could later
 * change without altering the underlying evidence (module-02 §6.3, §6.4).
 */
export const canonicalSourceManifestFileEntrySchema = z
  .object({
    ordinal: z.number().int().min(0),
    role: uploadFileRoleSchema,
    sha256: sha256HexSchema,
  })
  .strict();

export type CanonicalSourceManifestFileEntry = z.infer<
  typeof canonicalSourceManifestFileEntrySchema
>;

/**
 * Immutable reference evidence fields included in the canonical hash for URL/manual-paste and
 * uploaded (screenshot_set/uploaded_export) references. `title` is intentionally never part of
 * this shape.
 */
export const canonicalSourceManifestReferenceSchema = z
  .object({
    referenceKind: referenceKindSchema,
    captureMethod: referenceCaptureMethodSchema,
    accessType: referenceAccessTypeSchema,
    intendedUse: referenceIntendedUseSchema,
    sourceUrl: z.url().optional(),
  })
  .strict();

export type CanonicalSourceManifestReference = z.infer<
  typeof canonicalSourceManifestReferenceSchema
>;

export const canonicalSourceManifestInputSchema = z
  .object({
    sourceType: sourceTypeSchema,
    documentFormat: sourceDocumentFormatSchema.optional(),
    reference: canonicalSourceManifestReferenceSchema.optional(),
    files: z.array(canonicalSourceManifestFileEntrySchema).min(1),
  })
  .strict();

export type CanonicalSourceManifestInput = z.infer<typeof canonicalSourceManifestInputSchema>;
