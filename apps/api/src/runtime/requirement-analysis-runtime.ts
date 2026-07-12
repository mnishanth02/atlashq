import type { RequirementAnalysisJobPayload } from "@atlashq/jobs";
import { createQueueRegistration, defaultRetryPolicy } from "@atlashq/jobs";
import { Queue } from "bullmq";

type PayloadOfKind<Kind extends RequirementAnalysisJobPayload["kind"]> = Extract<
  RequirementAnalysisJobPayload,
  { kind: Kind }
>;

export type FreezeSnapshotJobPayload = PayloadOfKind<"freeze-snapshot">;
export type CancelRunJobPayload = PayloadOfKind<"cancel-run">;

/**
 * Queue surface needed by the requirement-analysis API orchestration service.
 * Keeping this narrow avoids binding feature code directly to BullMQ details.
 */
export interface RequirementAnalysisQueue {
  checkAvailability(timeoutMs?: number): Promise<{ ok: boolean; detail: string }>;
  addFreezeSnapshot(payload: FreezeSnapshotJobPayload): Promise<void>;
  addCancelRun(payload: CancelRunJobPayload): Promise<void>;
  close(): Promise<void>;
}

class BullMqRequirementAnalysisQueue implements RequirementAnalysisQueue {
  constructor(private readonly queue: Queue<RequirementAnalysisJobPayload>) {}

  async checkAvailability(timeoutMs = 2_000) {
    try {
      const client = await withTimeout(this.queue.client, timeoutMs, "queue client timed out");
      const info = await withTimeout(client.info(), timeoutMs, "queue info timed out");
      return {
        ok: typeof info === "string" && info.length > 0,
        detail: typeof info === "string" && info.length > 0 ? "ready" : "unexpected-info",
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : "queue unavailable",
      };
    }
  }

  private add(payload: RequirementAnalysisJobPayload): Promise<void> {
    return this.queue
      .add(payload.kind, payload, {
        jobId: payload.idempotencyKey,
        ...defaultRetryPolicy,
      })
      .then(() => undefined);
  }

  addFreezeSnapshot(payload: FreezeSnapshotJobPayload) {
    return this.add(payload);
  }

  addCancelRun(payload: CancelRunJobPayload) {
    return this.add(payload);
  }

  close() {
    return this.queue.close();
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/** Compose the BullMQ-backed `ai-analysis` queue from a Redis URL. */
export function createBullMqRequirementAnalysisQueue(redisUrl: string): RequirementAnalysisQueue {
  const registration = createQueueRegistration("ai-analysis");
  const queue = new Queue<RequirementAnalysisJobPayload>(registration.name, {
    connection: { url: redisUrl },
    defaultJobOptions: registration.defaultJobOptions,
  });
  return new BullMqRequirementAnalysisQueue(queue);
}
