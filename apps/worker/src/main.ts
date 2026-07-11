import { Queue, Worker } from "bullmq";
import { dispatchDocumentProcessingJob } from "./handlers/dispatch.js";
import { handlePlaceholderJob } from "./handlers.js";
import { withWorkerContext } from "./logger.js";
import { createQueueRegistration, queueNames } from "./queues.js";
import { createWorkerRuntimeContext } from "./runtime/context.js";

const runtimeContext = createWorkerRuntimeContext();
const connection = runtimeContext.redisConnection;

const queues = queueNames.map((queueName) => new Queue(queueName, { connection }));
const documentProcessingQueue = queues.find((queue) => queue.name === "document-processing");
if (!documentProcessingQueue) {
  throw new Error("document-processing queue failed to register.");
}

const workers = queueNames.map((queueName) => {
  if (queueName === "document-processing") {
    return new Worker(
      queueName,
      async (job) => {
        const logContext = {
          correlationId: job.data.correlationId,
          queueName,
          ...(job.id ? { jobId: job.id } : {}),
        };
        const result = await dispatchDocumentProcessingJob(
          runtimeContext,
          documentProcessingQueue,
          job.data,
        );
        withWorkerContext(logContext).info(
          { idempotencyKey: result.idempotencyKey, kind: result.kind },
          "processed document-processing job",
        );
        return result;
      },
      { connection, concurrency: runtimeContext.env.WORKER_CONCURRENCY },
    );
  }

  return new Worker(
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
  );
});

for (const queueName of queueNames) {
  withWorkerContext({ correlationId: "boot", queueName }).info(
    createQueueRegistration(queueName),
    "registered queue placeholder",
  );
}

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((queue) => queue.close()));
  await runtimeContext.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
