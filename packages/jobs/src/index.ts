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

export const documentProcessingJobPayloadSchema = baseJobPayloadSchema.extend({
  documentId: z.string().trim().min(1).optional(),
  objectKey: z.string().trim().min(1).optional(),
});

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
