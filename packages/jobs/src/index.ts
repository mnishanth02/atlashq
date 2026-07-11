import type { ProjectId, UserId } from "@atlashq/types";
import { z } from "zod";

export const queueNames = [
  "document-processing",
  "ai-analysis",
  "citation-verification",
  "export-generation",
  "github-sync",
  "maintenance",
] as const;

export type QueueName = (typeof queueNames)[number];

export const baseJobPayloadSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  correlationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
  actorId: z.string().trim().min(1).optional(),
  submittedAt: z.string().datetime({ offset: true }),
});

// ---------------------------------------------------------------------------
// Module 2: Source Document Vault document-processing job kinds (module-02 §10)
// ---------------------------------------------------------------------------

const requiredIdSchema = z.string().trim().min(1);
const sha256HexSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/i, "must be a lowercase hex SHA-256 hash");

/**
 * Fields every Module 2 document-processing job carries in addition to the generic base payload:
 * organization/project scoping is mandatory (unlike the optional base `projectId`) so the worker
 * can re-derive authorization/audit context without a DB round trip before the state check.
 */
const sourceJobBaseSchema = baseJobPayloadSchema.extend({
  organizationId: requiredIdSchema,
  projectId: requiredIdSchema,
});

/** Verifies declared size/hash and streams the object through ClamAV before scan-gated states unlock. */
export const verifyAndScanJobPayloadSchema = sourceJobBaseSchema.extend({
  kind: z.literal("verify-and-scan"),
  sourceDocumentId: requiredIdSchema,
  sourceDocumentFileId: requiredIdSchema,
  objectKey: requiredIdSchema,
  expectedSha256: sha256HexSchema,
});

/** Runs the deterministic parser/chunker against a pre-created (queued) extraction version row. */
export const extractJobPayloadSchema = sourceJobBaseSchema.extend({
  kind: z.literal("extract"),
  sourceDocumentId: requiredIdSchema,
  sourceExtractionId: requiredIdSchema,
});

/** Renders a safe preview object for a completed extraction version. */
export const generatePreviewJobPayloadSchema = sourceJobBaseSchema.extend({
  kind: z.literal("generate-preview"),
  sourceDocumentId: requiredIdSchema,
  sourceExtractionId: requiredIdSchema,
});

/** Captures a one-page reference artifact (screenshot/export) for a `reference` source document. */
export const captureReferenceJobPayloadSchema = sourceJobBaseSchema.extend({
  kind: z.literal("capture-reference"),
  sourceDocumentId: requiredIdSchema,
  actorId: requiredIdSchema,
  captureUrl: z.url(),
});

/** Expires an unconfirmed upload session and releases its provisional objects/rows. */
export const expireUploadSessionJobPayloadSchema = sourceJobBaseSchema.extend({
  kind: z.literal("expire-upload-session"),
  uploadSessionId: requiredIdSchema,
});

export const documentProcessingJobPayloadSchema = z.discriminatedUnion("kind", [
  verifyAndScanJobPayloadSchema,
  extractJobPayloadSchema,
  generatePreviewJobPayloadSchema,
  captureReferenceJobPayloadSchema,
  expireUploadSessionJobPayloadSchema,
]);

export type DocumentProcessingJobKind = z.infer<typeof documentProcessingJobPayloadSchema>["kind"];
export type DocumentProcessingJobPayload = z.infer<typeof documentProcessingJobPayloadSchema>;

export function parseDocumentProcessingJobPayload(payload: unknown): DocumentProcessingJobPayload {
  return documentProcessingJobPayloadSchema.parse(payload);
}

export const aiAnalysisJobPayloadSchema = baseJobPayloadSchema.extend({
  aiRunId: z.string().trim().min(1).optional(),
});

export const jobPayloadSchemas = {
  "document-processing": documentProcessingJobPayloadSchema,
  "ai-analysis": aiAnalysisJobPayloadSchema,
  "citation-verification": baseJobPayloadSchema,
  "export-generation": baseJobPayloadSchema,
  "github-sync": baseJobPayloadSchema,
  maintenance: baseJobPayloadSchema,
} as const satisfies Record<QueueName, z.ZodType>;

export type AtlasJobPayload = z.infer<typeof baseJobPayloadSchema> & {
  projectId?: ProjectId;
  actorId?: UserId;
};

export const defaultRetryPolicy = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
} as const;

export const queueDashboardPlaceholder = {
  tool: "Bull Board",
  exposure: "internal-only",
  note: "Mount only after authentication and project/operator authorization are in place.",
} as const;

export function createQueueRegistration(queueName: QueueName) {
  return {
    name: queueName,
    defaultJobOptions: defaultRetryPolicy,
  };
}

export function parseJobPayload(queueName: QueueName, payload: unknown): AtlasJobPayload {
  return jobPayloadSchemas[queueName].parse(payload) as AtlasJobPayload;
}

export function createIdempotencyKey(parts: {
  queueName: QueueName;
  resourceId: string;
  operation: string;
}) {
  return `${parts.queueName}:${parts.operation}:${parts.resourceId}`;
}
