import { beforeEach, describe, expect, it } from "vitest";
import { advanceDag } from "./dag.js";
import type { AnalysisScope } from "./repository/types.js";
import {
  buildTestRun,
  buildTestRuntime,
  createRecordingAiAnalysisQueue,
} from "./test-support/fixtures.js";

/**
 * `advanceDag` resolves each stage's dependencies from `module03PipelineDescriptor`'s *static*
 * `dependsOn` edges (by stage kind), not from persisted `requirement_analysis_stage_dependency`
 * rows -- so these tests seed stage rows of the exact real-pipeline kinds that participate in each
 * edge (module-03 §11.1: `citation_verification` fans in from both extraction branches;
 * `finalize_review_package` fans in from six upstream stages) rather than fabricating dependency
 * rows the production code never reads back.
 */
describe("advanceDag", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];
  let queue: ReturnType<typeof createRecordingAiAnalysisQueue>;
  let scope: AnalysisScope;

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
    queue = createRecordingAiAnalysisQueue();
    const run = buildTestRun();
    repository.seedRun(run);
    scope = { organizationId: run.organizationId, projectId: run.projectId, runId: run.id };
  });

  async function seedStage(kind: Parameters<typeof repository.createStage>[0]["kind"]) {
    return repository.createStage({ ...scope, kind, idempotencyKey: `stage:${kind}` });
  }

  it("enqueues a run-stage job once a single-dependency stage's upstream is ready", async () => {
    const upstream = await seedStage("citation_verification");
    const downstream = await seedStage("normalization_deduplication");
    await repository.updateStage(upstream.id, { status: "completed", completedAt: runtime.now() });

    await advanceDag(runtime, queue, scope);

    const refreshedDownstream = await repository.getStage(downstream.id);
    expect(refreshedDownstream?.status).toBe("running");
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({
      kind: "run-stage",
      stageId: downstream.id,
      stageKind: "normalization_deduplication",
    });
  });

  it("does not enqueue citation_verification until BOTH extraction branches fan in", async () => {
    const confirmed = await seedStage("confirmed_extraction");
    await seedStage("reference_feature_extraction");
    const downstream = await seedStage("citation_verification");
    await repository.updateStage(confirmed.id, { status: "completed", completedAt: runtime.now() });
    // reference_feature_extraction still pending.

    await advanceDag(runtime, queue, scope);

    const refreshedDownstream = await repository.getStage(downstream.id);
    expect(refreshedDownstream?.status).toBe("pending");
    expect(queue.jobs).toHaveLength(0);
  });

  it("enqueues citation_verification once both extraction branches are ready (fan-in)", async () => {
    const confirmed = await seedStage("confirmed_extraction");
    const reference = await seedStage("reference_feature_extraction");
    const downstream = await seedStage("citation_verification");
    await repository.updateStage(confirmed.id, { status: "completed", completedAt: runtime.now() });
    await repository.updateStage(reference.id, { status: "skipped", completedAt: runtime.now() });

    await advanceDag(runtime, queue, scope);

    const refreshedDownstream = await repository.getStage(downstream.id);
    expect(refreshedDownstream?.status).toBe("running");
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({ kind: "run-stage", stageKind: "citation_verification" });
  });

  it("propagates a failed dependency as a failed dependent stage without enqueueing anything", async () => {
    const upstream = await seedStage("citation_verification");
    const downstream = await seedStage("normalization_deduplication");
    await repository.updateStage(upstream.id, {
      status: "failed",
      completedAt: runtime.now(),
      failureCode: "SOME_FAILURE",
    });

    await advanceDag(runtime, queue, scope);

    const refreshedDownstream = await repository.getStage(downstream.id);
    expect(refreshedDownstream?.status).toBe("failed");
    expect(refreshedDownstream?.failureCode).toBe("REQUIREMENT_ANALYSIS_DEPENDENCY_FAILED");
    expect(queue.jobs).toHaveLength(0);
  });

  it("propagates a canceled dependency as a canceled dependent stage without enqueueing anything", async () => {
    const upstream = await seedStage("citation_verification");
    const downstream = await seedStage("normalization_deduplication");
    await repository.updateStage(upstream.id, { status: "canceled", completedAt: runtime.now() });

    await advanceDag(runtime, queue, scope);

    const refreshedDownstream = await repository.getStage(downstream.id);
    expect(refreshedDownstream?.status).toBe("canceled");
    expect(queue.jobs).toHaveLength(0);
  });

  it("marks confirmed_extraction/reference_feature_extraction stages running without enqueueing a run-stage job", async () => {
    const upstream = await seedStage("batch_planning");
    const confirmed = await seedStage("confirmed_extraction");
    await repository.updateStage(upstream.id, { status: "completed", completedAt: runtime.now() });

    await advanceDag(runtime, queue, scope);

    const refreshedConfirmed = await repository.getStage(confirmed.id);
    expect(refreshedConfirmed?.status).toBe("running");
    expect(queue.jobs).toHaveLength(0);
  });

  it("enqueues a finalize-run job (not a run-stage job) once finalize_review_package fans in from all six upstream stages", async () => {
    const upstreamKinds = [
      "citation_verification",
      "normalization_deduplication",
      "conflict_detection",
      "coverage_analysis",
      "delivery_item_extraction",
      "question_generation",
    ] as const;
    const finalize = await seedStage("finalize_review_package");
    for (const kind of upstreamKinds) {
      const stage = await seedStage(kind);
      await repository.updateStage(stage.id, { status: "completed", completedAt: runtime.now() });
    }

    await advanceDag(runtime, queue, scope);

    const refreshedFinalize = await repository.getStage(finalize.id);
    expect(refreshedFinalize?.status).toBe("running");
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({ kind: "finalize-run" });
  });

  it("does not enqueue finalize-run if even one of its six upstream stages is not yet ready", async () => {
    const upstreamKinds = [
      "citation_verification",
      "normalization_deduplication",
      "conflict_detection",
      "coverage_analysis",
      "delivery_item_extraction",
      "question_generation",
    ] as const;
    const finalize = await seedStage("finalize_review_package");
    for (const [index, kind] of upstreamKinds.entries()) {
      const stage = await seedStage(kind);
      // Leave the last upstream stage pending.
      if (index < upstreamKinds.length - 1) {
        await repository.updateStage(stage.id, { status: "completed", completedAt: runtime.now() });
      }
    }

    await advanceDag(runtime, queue, scope);

    const refreshedFinalize = await repository.getStage(finalize.id);
    expect(refreshedFinalize?.status).toBe("pending");
    // question_generation's own dependencies happen to be satisfied too, so it is legitimately
    // enqueued on this pass; the important assertion is that finalize-run itself never fires.
    expect(queue.jobs.some((job) => job.kind === "finalize-run")).toBe(false);
  });

  it("treats completed_with_warnings and skipped dependencies as ready", async () => {
    const confirmed = await seedStage("confirmed_extraction");
    const reference = await seedStage("reference_feature_extraction");
    const downstream = await seedStage("citation_verification");
    await repository.updateStage(confirmed.id, {
      status: "completed_with_warnings",
      completedAt: runtime.now(),
    });
    await repository.updateStage(reference.id, { status: "skipped", completedAt: runtime.now() });

    await advanceDag(runtime, queue, scope);

    const refreshedDownstream = await repository.getStage(downstream.id);
    expect(refreshedDownstream?.status).toBe("running");
    expect(queue.jobs).toHaveLength(1);
  });
});
