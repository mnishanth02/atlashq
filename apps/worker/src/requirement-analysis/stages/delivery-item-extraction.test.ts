import { AiCoreError } from "@atlashq/ai";
import { beforeEach, describe, expect, it } from "vitest";
import type { DeliveryItemExtractionOutput } from "../schemas.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createFakeStructuredExecutor,
  createRecordingAiAnalysisQueue,
  seedRequirementWithCitation,
} from "../test-support/fixtures.js";
import { handleDeliveryItemExtractionStage } from "./delivery-item-extraction.js";

async function seedRunWithStage(
  runtime: ReturnType<typeof buildTestRuntime>["runtime"],
  repository: ReturnType<typeof buildTestRuntime>["repository"],
) {
  const run = buildTestRun({ sourceSnapshotId: "snapshot-1" });
  repository.seedRun(run);
  repository.seedProviderPolicy(
    buildTestProviderPolicy({ id: run.providerPolicyId, organizationId: run.organizationId }),
  );
  const stage = await repository.createStage({
    organizationId: run.organizationId,
    projectId: run.projectId,
    runId: run.id,
    kind: "delivery_item_extraction",
    idempotencyKey: "stage:delivery_item_extraction",
  });
  await repository.updateStage(stage.id, { status: "pending" });
  return { run, stage };
}

describe("handleDeliveryItemExtractionStage", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
  });

  it("persists a cited risk item as 'confirmed' with a cloned citation traced back to the requirement's evidence", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    const { requirement, citation } = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });

    const output: DeliveryItemExtractionOutput = {
      items: [
        {
          itemType: "risk",
          title: "Password reset flow may not be rate limited",
          description: null,
          severity: "high",
          priority: "high",
          attributes: {},
          sourceRequirementId: "req-a",
          citations: [{ snapshotChunkId: citation.id, quote: citation.quoteTextOriginal }],
        },
      ],
    };
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 25, outputTokens: 10 } },
    ]);

    await handleDeliveryItemExtractionStage(
      { ...runtime, executor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "delivery-1",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "delivery_item_extraction",
        submittedAt: runtime.now().toISOString(),
      },
    );

    const deliveryItems = await repository.listDeliveryItemsByRun(run.id);
    expect(deliveryItems).toHaveLength(1);
    expect(deliveryItems[0]?.itemType).toBe("risk");
    expect(deliveryItems[0]?.epistemicStatus).toBe("confirmed");
    expect(deliveryItems[0]?.sourceRequirementId).toBe(requirement.id);

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("persists an uncited item as 'assumed' (never as a fabricated confirmed item)", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });

    const output: DeliveryItemExtractionOutput = {
      items: [
        {
          itemType: "assumption",
          title: "We assume single-tenant deployment",
          description: null,
          severity: null,
          priority: null,
          attributes: {},
          sourceRequirementId: null,
          citations: [], // no citations at all -> never confirmed
        },
      ],
    };
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 15, outputTokens: 8 } },
    ]);

    await handleDeliveryItemExtractionStage(
      { ...runtime, executor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "delivery-2",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "delivery_item_extraction",
        submittedAt: runtime.now().toISOString(),
      },
    );

    const deliveryItems = await repository.listDeliveryItemsByRun(run.id);
    expect(deliveryItems).toHaveLength(1);
    expect(deliveryItems[0]?.epistemicStatus).toBe("assumed");
  });

  it("is idempotent: replaying against an already-terminal stage never re-invokes the executor or creates duplicate items", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });
    await repository.updateStage(stage.id, { status: "completed", completedAt: runtime.now() });
    const executor = createFakeStructuredExecutor([]);

    await handleDeliveryItemExtractionStage(
      { ...runtime, executor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "delivery-3",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "delivery_item_extraction",
        submittedAt: runtime.now().toISOString(),
      },
    );

    expect(executor.calls).toBe(0);
    const deliveryItems = await repository.listDeliveryItemsByRun(run.id);
    expect(deliveryItems).toHaveLength(0);
  });

  it("resumes a retry while the stage is still running: skips an already-persisted item (same stable key) and only inserts the new one, never duplicating", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    const { requirement, citation } = await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });

    // Simulate an earlier attempt that persisted this exact item before its process died while
    // the stage row was still "running" (module-03 task: mid-stage retry safety).
    await repository.insertDeliveryItemWithCitations(
      {
        organizationId: run.organizationId,
        projectId: run.projectId,
        analysisRunId: run.id,
        itemType: "risk",
        title: "Password reset flow may not be rate limited",
        description: null,
        epistemicStatus: "assumed",
        confidenceBand: null,
        confidenceReasonCodes: [],
        severity: "high",
        priority: "high",
        status: "open",
        visibility: "internal",
        attributes: {},
        sourceRequirementId: requirement.id,
        createdByAiRunId: null,
      },
      [],
    );
    await repository.updateStage(stage.id, { status: "running" });

    const output: DeliveryItemExtractionOutput = {
      items: [
        {
          // Same itemType/title/description/sourceRequirementId as the preseeded row -- must be
          // recognized as already-persisted and skipped, not duplicated.
          itemType: "risk",
          title: "Password reset flow may not be rate limited",
          description: null,
          severity: "high",
          priority: "high",
          attributes: {},
          sourceRequirementId: "req-a",
          citations: [{ snapshotChunkId: citation.id, quote: citation.quoteTextOriginal }],
        },
        {
          itemType: "assumption",
          title: "We assume single-tenant deployment",
          description: null,
          severity: null,
          priority: null,
          attributes: {},
          sourceRequirementId: null,
          citations: [],
        },
      ],
    };
    const executor = createFakeStructuredExecutor([
      { output, usage: { inputTokens: 25, outputTokens: 10 } },
    ]);

    await handleDeliveryItemExtractionStage(
      { ...runtime, executor },
      createRecordingAiAnalysisQueue(),
      {
        kind: "run-stage",
        idempotencyKey: "delivery-retry-1",
        correlationId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId,
        runId: run.id,
        stageId: stage.id,
        stageKind: "delivery_item_extraction",
        submittedAt: runtime.now().toISOString(),
      },
    );

    const deliveryItems = await repository.listDeliveryItemsByRun(run.id);
    expect(deliveryItems).toHaveLength(2);
    const riskItems = deliveryItems.filter((item) => item.itemType === "risk");
    expect(riskItems).toHaveLength(1);
    const assumptionItems = deliveryItems.filter((item) => item.itemType === "assumption");
    expect(assumptionItems).toHaveLength(1);

    const refreshedStage = await repository.getStage(stage.id);
    expect(refreshedStage?.status).toBe("completed");
  });

  it("transitions the run to failed (never stuck running) once this module's own retry budget is exhausted", async () => {
    const { run, stage } = await seedRunWithStage(runtime, repository);
    await seedRequirementWithCitation(repository, {
      organizationId: run.organizationId,
      projectId: run.projectId,
      runId: run.id,
      stableKey: "req-a",
      title: "System shall authenticate users",
    });
    await repository.updateStage(stage.id, { status: "running", attemptNumber: 3 });

    const executor = createFakeStructuredExecutor([
      {
        throws: new AiCoreError(
          "AI_RUN_PROVIDER_TIMEOUT",
          "raw provider excerpt: never persisted",
          { retryable: true },
        ),
      },
    ]);

    await expect(
      handleDeliveryItemExtractionStage(
        { ...runtime, executor },
        createRecordingAiAnalysisQueue(),
        {
          kind: "run-stage",
          idempotencyKey: "delivery-fail-1",
          correlationId: run.id,
          organizationId: run.organizationId,
          projectId: run.projectId,
          runId: run.id,
          stageId: stage.id,
          stageKind: "delivery_item_extraction",
          submittedAt: runtime.now().toISOString(),
        },
      ),
    ).rejects.toThrow();

    const updatedStage = await repository.getStage(stage.id);
    expect(updatedStage?.status).toBe("failed");
    expect(updatedStage?.failureCode).toBe("AI_RUN_RETRIES_EXHAUSTED");
    expect(updatedStage?.failureDetail).not.toContain("never persisted");

    const updatedRun = await repository.getRun(run.id);
    expect(updatedRun?.status).toBe("failed");
    expect(updatedRun?.status).not.toBe("running");
  });
});
