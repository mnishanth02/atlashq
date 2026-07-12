import type { CitationVerificationJobPayload, RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { defaultRetryPolicy } from "@atlashq/jobs";
import type { Queue } from "bullmq";

export type AiAnalysisQueue = Pick<Queue<RequirementAnalysisJobPayload>, "add">;
export type CitationVerificationQueue = Pick<Queue<CitationVerificationJobPayload>, "add">;

/**
 * Enqueues the next `ai-analysis` job in the Module 3 DAG. Mirrors
 * `runtime/job-queue.ts#enqueueDocumentProcessingJob`'s convention of using the payload's own
 * `idempotencyKey` as the BullMQ `jobId` so a handler that is retried after crashing right before
 * or after enqueueing its follow-up job can never enqueue a duplicate (module-03 §11.1, §16.1).
 */
export async function enqueueAiAnalysisJob(
  queue: AiAnalysisQueue,
  payload: RequirementAnalysisJobPayload,
): Promise<void> {
  await queue.add(payload.kind, payload, {
    ...defaultRetryPolicy,
    jobId: payload.idempotencyKey,
  });
}

/** Enqueues one `citation-verification` job for a single completed extraction batch (task item 2:
 * a genuinely operative consumer, not a placeholder -- see `citation-consumer.ts`). */
export async function enqueueCitationVerificationJob(
  queue: CitationVerificationQueue,
  payload: CitationVerificationJobPayload,
): Promise<void> {
  await queue.add("verify-batch", payload, {
    ...defaultRetryPolicy,
    jobId: payload.idempotencyKey,
  });
}
