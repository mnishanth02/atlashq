import { type AtlasJobPayload, parseJobPayload, type QueueName } from "@atlashq/jobs";
import type { Job } from "bullmq";

export type IdempotentJobResult = {
  queueName: QueueName;
  idempotencyKey: string;
  status: "accepted";
};

export async function handlePlaceholderJob(
  queueName: QueueName,
  job: Pick<Job<AtlasJobPayload>, "data">,
): Promise<IdempotentJobResult> {
  const payload = parseJobPayload(queueName, job.data);

  return {
    queueName,
    idempotencyKey: payload.idempotencyKey,
    status: "accepted",
  };
}
