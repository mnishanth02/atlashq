import type { DocumentProcessingJobPayload } from "@atlashq/jobs";
import { createIdempotencyKey, defaultRetryPolicy } from "@atlashq/jobs";
import type { Queue } from "bullmq";

/**
 * Enqueues the next stage of the document-processing pipeline (module-02 §10). The API enqueues
 * only the first job (`verify-and-scan`, or the entry job for manual/reference/capture flows);
 * every following stage is chained by the worker itself as each stage completes successfully. Uses
 * `jobId: idempotencyKey` so BullMQ de-duplicates a stage that gets enqueued more than once (e.g. a
 * handler retried after a crash right before/after enqueueing its follow-up job).
 */
export async function enqueueDocumentProcessingJob(
  queue: Pick<Queue<DocumentProcessingJobPayload>, "add">,
  payload: DocumentProcessingJobPayload,
): Promise<void> {
  const resourceId =
    "sourceExtractionId" in payload
      ? payload.sourceExtractionId
      : "sourceDocumentFileId" in payload
        ? payload.sourceDocumentFileId
        : "uploadSessionId" in payload
          ? payload.uploadSessionId
          : payload.sourceDocumentId;

  const jobId = createIdempotencyKey({
    queueName: "document-processing",
    resourceId,
    operation: payload.kind,
  });

  await queue.add(payload.kind, payload, { ...defaultRetryPolicy, jobId });
}
