import { childLogger, createAtlasLogger } from "@atlashq/logger";

export const logger = createAtlasLogger({ name: "atlashq-worker" });

export type WorkerLogContext = {
  correlationId: string;
  queueName: string;
  jobId?: string;
};

export function withWorkerContext(context: WorkerLogContext) {
  return childLogger(logger, context);
}
