import type { DocumentProcessingJobPayload } from "@atlashq/jobs";

// `@atlashq/jobs` only exports the discriminated union type (and its Zod schema), not a per-kind
// type alias for each `kind`. These are worker-local convenience aliases derived from that union.
export type VerifyAndScanJobPayload = Extract<
  DocumentProcessingJobPayload,
  { kind: "verify-and-scan" }
>;
export type ExtractJobPayload = Extract<DocumentProcessingJobPayload, { kind: "extract" }>;
export type GeneratePreviewJobPayload = Extract<
  DocumentProcessingJobPayload,
  { kind: "generate-preview" }
>;
export type CaptureReferenceJobPayload = Extract<
  DocumentProcessingJobPayload,
  { kind: "capture-reference" }
>;
export type ExpireUploadSessionJobPayload = Extract<
  DocumentProcessingJobPayload,
  { kind: "expire-upload-session" }
>;
