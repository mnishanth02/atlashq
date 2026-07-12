import {
  parseCitationVerificationJobPayload,
  parseRequirementAnalysisJobPayload,
} from "@atlashq/jobs";
import { Queue, Worker } from "bullmq";
import { dispatchDocumentProcessingJob } from "./handlers/dispatch.js";
import { handlePlaceholderJob } from "./handlers.js";
import { withWorkerContext } from "./logger.js";
import { createQueueRegistration, queueNames } from "./queues.js";
import {
  dispatchAiAnalysisJob,
  dispatchCitationVerificationJob,
} from "./requirement-analysis/orchestrator.js";
import type {
  AiAnalysisQueue,
  CitationVerificationQueue,
} from "./requirement-analysis/queue-helpers.js";
import { createDrizzleRequirementAnalysisRepository } from "./requirement-analysis/repository/drizzle-repository.js";
import type { AnalysisRuntime } from "./requirement-analysis/runtime.js";
import { createWorkerRuntimeContext } from "./runtime/context.js";

/**
 * `ai-analysis`/`citation-verification` are registered as real, operative Queue/Worker consumers
 * here (task item 2), replacing their prior placeholder dispatch. Every other queue
 * (`export-generation`, `github-sync`, `maintenance`) keeps the pre-existing placeholder handler
 * unchanged, and `document-processing` is preserved exactly as before.
 */
async function main() {
  const runtimeContext = await createWorkerRuntimeContext();
  const connection = runtimeContext.redisConnection;

  const queues = queueNames.map((queueName) => new Queue(queueName, { connection }));
  const documentProcessingQueue = queues.find((queue) => queue.name === "document-processing");
  if (!documentProcessingQueue) {
    throw new Error("document-processing queue failed to register.");
  }
  const aiAnalysisQueue = queues.find((queue) => queue.name === "ai-analysis");
  if (!aiAnalysisQueue) {
    throw new Error("ai-analysis queue failed to register.");
  }
  const citationVerificationQueue = queues.find((queue) => queue.name === "citation-verification");
  if (!citationVerificationQueue) {
    throw new Error("citation-verification queue failed to register.");
  }
  const typedAiAnalysisQueue: AiAnalysisQueue = aiAnalysisQueue;
  const typedCitationVerificationQueue: CitationVerificationQueue = citationVerificationQueue;

  const analysisRuntime: AnalysisRuntime = {
    repository: createDrizzleRequirementAnalysisRepository(runtimeContext.db),
    providerRegistry: runtimeContext.aiProviderRegistry,
    featureFlags: runtimeContext.featureFlags,
    now: () => new Date(),
  };

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

    if (queueName === "ai-analysis") {
      return new Worker(
        queueName,
        async (job) => {
          const payload = parseRequirementAnalysisJobPayload(job.data);
          const logContext = {
            correlationId: payload.correlationId,
            queueName,
            ...(job.id ? { jobId: job.id } : {}),
          };
          await dispatchAiAnalysisJob(
            analysisRuntime,
            typedAiAnalysisQueue,
            typedCitationVerificationQueue,
            payload,
          );
          withWorkerContext(logContext).info(
            { idempotencyKey: payload.idempotencyKey, kind: payload.kind, runId: payload.runId },
            "processed ai-analysis job",
          );
          return {
            queueName,
            idempotencyKey: payload.idempotencyKey,
            status: "accepted" as const,
          };
        },
        { connection, concurrency: runtimeContext.aiAnalysisQueueConcurrency },
      );
    }

    if (queueName === "citation-verification") {
      return new Worker(
        queueName,
        async (job) => {
          const payload = parseCitationVerificationJobPayload(job.data);
          const logContext = {
            correlationId: payload.correlationId,
            queueName,
            ...(job.id ? { jobId: job.id } : {}),
          };
          await dispatchCitationVerificationJob(analysisRuntime, payload);
          withWorkerContext(logContext).info(
            { idempotencyKey: payload.idempotencyKey, runId: payload.runId },
            "processed citation-verification job",
          );
          return {
            queueName,
            idempotencyKey: payload.idempotencyKey,
            status: "accepted" as const,
          };
        },
        { connection, concurrency: runtimeContext.citationVerificationQueueConcurrency },
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
}

void main();
