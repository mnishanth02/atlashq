import { analysisStageKindValues } from "@atlashq/types";
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

// ---------------------------------------------------------------------------
// Module 3: AI Requirement Analyzer queue contracts (module-03 §13)
// ---------------------------------------------------------------------------

const analysisJobBaseSchema = baseJobPayloadSchema.extend({
  organizationId: requiredIdSchema,
  projectId: requiredIdSchema,
  runId: requiredIdSchema,
});

export const freezeSnapshotJobPayloadSchema = analysisJobBaseSchema.extend({
  kind: z.literal("freeze-snapshot"),
  actorId: requiredIdSchema,
  sourceDocumentIds: z.array(requiredIdSchema).min(1).optional(),
});

export const planBatchesJobPayloadSchema = analysisJobBaseSchema.extend({
  kind: z.literal("plan-batches"),
  snapshotId: requiredIdSchema,
});

export const runStageJobPayloadSchema = analysisJobBaseSchema.extend({
  kind: z.literal("run-stage"),
  stageId: requiredIdSchema,
  stageKind: z.enum(analysisStageKindValues),
});

export const runBatchJobPayloadSchema = analysisJobBaseSchema.extend({
  kind: z.literal("run-batch"),
  stageId: requiredIdSchema,
  batchId: requiredIdSchema,
});

export const finalizeRunJobPayloadSchema = analysisJobBaseSchema.extend({
  kind: z.literal("finalize-run"),
});

export const cancelRunJobPayloadSchema = analysisJobBaseSchema.extend({
  kind: z.literal("cancel-run"),
  actorId: requiredIdSchema,
});

export const requirementAnalysisJobPayloadSchema = z.discriminatedUnion("kind", [
  freezeSnapshotJobPayloadSchema,
  planBatchesJobPayloadSchema,
  runStageJobPayloadSchema,
  runBatchJobPayloadSchema,
  finalizeRunJobPayloadSchema,
  cancelRunJobPayloadSchema,
]);

/** Backward-compatible export name used by existing ai-analysis queue consumers. */
export const aiAnalysisJobPayloadSchema = requirementAnalysisJobPayloadSchema;

export type RequirementAnalysisJobKind = z.infer<
  typeof requirementAnalysisJobPayloadSchema
>["kind"];
export type RequirementAnalysisJobPayload = z.infer<typeof requirementAnalysisJobPayloadSchema>;

export function parseRequirementAnalysisJobPayload(
  payload: unknown,
): RequirementAnalysisJobPayload {
  return requirementAnalysisJobPayloadSchema.parse(payload);
}

export const citationVerificationJobPayloadSchema = baseJobPayloadSchema.extend({
  organizationId: requiredIdSchema,
  projectId: requiredIdSchema,
  runId: requiredIdSchema,
  stageId: requiredIdSchema,
  batchId: requiredIdSchema,
});

export type CitationVerificationJobPayload = z.infer<typeof citationVerificationJobPayloadSchema>;

export function parseCitationVerificationJobPayload(
  payload: unknown,
): CitationVerificationJobPayload {
  return citationVerificationJobPayloadSchema.parse(payload);
}

export const jobPayloadSchemas = {
  "document-processing": documentProcessingJobPayloadSchema,
  "ai-analysis": requirementAnalysisJobPayloadSchema,
  "citation-verification": citationVerificationJobPayloadSchema,
  "export-generation": baseJobPayloadSchema,
  "github-sync": baseJobPayloadSchema,
  maintenance: baseJobPayloadSchema,
} as const satisfies Record<QueueName, z.ZodType>;

type JobPayloadSchemas = typeof jobPayloadSchemas;
export type QueuePayload<Queue extends QueueName> = z.infer<JobPayloadSchemas[Queue]>;
export type AtlasJobPayload = QueuePayload<QueueName>;

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

export function parseJobPayload<Queue extends QueueName>(
  queueName: Queue,
  payload: unknown,
): QueuePayload<Queue> {
  return jobPayloadSchemas[queueName].parse(payload) as QueuePayload<Queue>;
}

export function createIdempotencyKey(parts: {
  queueName: QueueName;
  resourceId: string;
  operation: string;
}) {
  return `${parts.queueName}:${parts.operation}:${parts.resourceId}`;
}

export function createRequirementAnalysisIdempotencyKey(parts: {
  kind: RequirementAnalysisJobKind;
  runId: string;
  snapshotId?: string;
  stageId?: string;
  batchId?: string;
}) {
  const segments = ["ai-analysis", parts.kind, parts.runId];
  if (parts.snapshotId) {
    segments.push(parts.snapshotId);
  }
  if (parts.stageId) {
    segments.push(parts.stageId);
  }
  if (parts.batchId) {
    segments.push(parts.batchId);
  }

  return segments.join("_");
}

export function createCitationVerificationIdempotencyKey(parts: {
  runId: string;
  stageId: string;
  batchId: string;
}) {
  return ["citation-verification", "verify-batch", parts.runId, parts.stageId, parts.batchId].join(
    "_",
  );
}
