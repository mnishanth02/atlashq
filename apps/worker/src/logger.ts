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

export function logWorkerEvent(
  context: WorkerLogContext,
  event: string,
  details: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info",
) {
  withWorkerContext(context)[level]({ event, ...details }, event);
}
