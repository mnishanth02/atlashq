import { Queue, Worker } from "bullmq";
import { handlePlaceholderJob } from "./handlers.js";
import { withWorkerContext } from "./logger.js";
import { createQueueRegistration, queueNames } from "./queues.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = { url: redisUrl, maxRetriesPerRequest: null };

const queues = queueNames.map((queueName) => new Queue(queueName, { connection }));
const workers = queueNames.map(
  (queueName) =>
    new Worker(
      queueName,
      async (job) => {
        const result = await handlePlaceholderJob(queueName, job);
        const logContext = {
          correlationId: job.data.correlationId,
          queueName,
          ...(job.id ? { jobId: job.id } : {}),
        };
        withWorkerContext(logContext).info(
          { idempotencyKey: result.idempotencyKey },
          "processed placeholder job",
        );
        return result;
      },
      { connection },
    ),
);

for (const queueName of queueNames) {
  withWorkerContext({ correlationId: "boot", queueName }).info(
    createQueueRegistration(queueName),
    "registered queue placeholder",
  );
}

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((queue) => queue.close()));
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
