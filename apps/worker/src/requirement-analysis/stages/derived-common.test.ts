import { AiCoreError } from "@atlashq/ai";
import { beforeEach, describe, expect, it } from "vitest";
import { conflictDetectionOutputSchema } from "../schemas.js";
import {
  buildTestProviderPolicy,
  buildTestRun,
  buildTestRuntime,
  createFakeStructuredExecutor,
  seedRequirementWithCitation,
} from "../test-support/fixtures.js";
import {
  buildDeliveryItemStableKey,
  buildEvidenceBlocksFromRequirements,
  ensureSyntheticBatch,
  indexDeliveryItemsByStableKey,
  loadRequirementContext,
  resolveCitationClones,
  resolveRequirementIds,
  runDerivedModelStage,
} from "./derived-common.js";

describe("derived-common helpers", () => {
  let runtime: ReturnType<typeof buildTestRuntime>["runtime"];
  let repository: ReturnType<typeof buildTestRuntime>["repository"];

  beforeEach(() => {
    const built = buildTestRuntime();
    runtime = built.runtime;
    repository = built.repository;
  });

  describe("loadRequirementContext", () => {
    it("loads every requirement plus citations and indexes both by stableKey and citation id", async () => {
      const { requirement, citation } = await seedRequirementWithCitation(repository, {
        organizationId: "org-1",
        projectId: "project-1",
        runId: "run-1",
        stableKey: "req-a",
        title: "System shall authenticate users",
      });

      const context = await loadRequirementContext(runtime, "run-1");

      expect(context.requirements).toHaveLength(1);
      expect(context.requirementIdByStableKey.get("req-a")).toBe(requirement.id);
      expect(context.citationsByRequirementId.get(requirement.id)).toHaveLength(1);
      expect(context.citationById.get(citation.id)).toEqual(citation);
    });
  });

  describe("resolveRequirementIds", () => {
    it("resolves known stableKeys to DB ids and silently drops unknown ones", async () => {
      await seedRequirementWithCitation(repository, {
        organizationId: "org-1",
        projectId: "project-1",
        runId: "run-1",
        stableKey: "req-a",
      });
      const context = await loadRequirementContext(runtime, "run-1");

      const ids = resolveRequirementIds(context, ["req-a", "req-nonexistent"]);

      expect(ids).toHaveLength(1);
      expect(ids[0]).toBe(context.requirementIdByStableKey.get("req-a"));
    });
  });

  describe("buildEvidenceBlocksFromRequirements", () => {
    it("builds one evidence block per citation, keyed by citation id, prefixed with the requirement's stableKey", async () => {
      const { citation } = await seedRequirementWithCitation(repository, {
        organizationId: "org-1",
        projectId: "project-1",
        runId: "run-1",
        stableKey: "req-a",
        quote: "The system shall authenticate every user",
      });
      const context = await loadRequirementContext(runtime, "run-1");

      const blocks = buildEvidenceBlocksFromRequirements({
        organizationId: "org-1",
        projectId: "project-1",
        snapshotId: "snapshot-1",
        context,
      });

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.blockId).toBe(citation.id);
      expect(blocks[0]?.text).toContain("[requirement:req-a]");
      expect(blocks[0]?.text).toContain("The system shall authenticate every user");
    });
  });

  describe("resolveCitationClones", () => {
    it("clones an existing citation for a new target when the candidate's snapshotChunkId resolves to a real citation id", async () => {
      const { citation } = await seedRequirementWithCitation(repository, {
        organizationId: "org-1",
        projectId: "project-1",
        runId: "run-1",
        stableKey: "req-a",
      });
      const context = await loadRequirementContext(runtime, "run-1");

      const clones = resolveCitationClones(
        context,
        [{ snapshotChunkId: citation.id, quote: citation.quoteTextOriginal }],
        "ai-run-1",
      );

      expect(clones).toHaveLength(1);
      expect(clones[0]?.sourceChunkId).toBe(citation.sourceChunkId);
      expect(clones[0]?.createdByAiRunId).toBe("ai-run-1");
    });

    it("drops a candidate whose snapshotChunkId does not resolve to any known citation id", async () => {
      await seedRequirementWithCitation(repository, {
        organizationId: "org-1",
        projectId: "project-1",
        runId: "run-1",
        stableKey: "req-a",
      });
      const context = await loadRequirementContext(runtime, "run-1");

      const clones = resolveCitationClones(
        context,
        [{ snapshotChunkId: "nonexistent-citation-id", quote: "irrelevant" }],
        "ai-run-1",
      );

      expect(clones).toHaveLength(0);
    });

    it("de-duplicates repeated candidates that resolve to the same citation id", async () => {
      const { citation } = await seedRequirementWithCitation(repository, {
        organizationId: "org-1",
        projectId: "project-1",
        runId: "run-1",
        stableKey: "req-a",
      });
      const context = await loadRequirementContext(runtime, "run-1");

      const clones = resolveCitationClones(
        context,
        [
          { snapshotChunkId: citation.id, quote: citation.quoteTextOriginal },
          { snapshotChunkId: citation.id, quote: citation.quoteTextOriginal },
        ],
        "ai-run-1",
      );

      expect(clones).toHaveLength(1);
    });
  });

  describe("ensureSyntheticBatch", () => {
    it("creates exactly one synthetic batch per stage and reuses it on subsequent calls", async () => {
      const scope = { organizationId: "org-1", projectId: "project-1", runId: "run-1" };
      const stage = await repository.createStage({
        ...scope,
        kind: "conflict_detection",
        idempotencyKey: "stage:conflict_detection",
      });

      const first = await ensureSyntheticBatch(runtime, scope, stage.id);
      const second = await ensureSyntheticBatch(runtime, scope, stage.id);

      expect(second.id).toBe(first.id);
      const batches = await repository.listBatchesByStage(stage.id);
      expect(batches).toHaveLength(1);
    });
  });

  describe("buildDeliveryItemStableKey / indexDeliveryItemsByStableKey", () => {
    it("normalizes whitespace/case in title and description so equivalent content maps to the same key", () => {
      const a = buildDeliveryItemStableKey({
        itemType: "risk",
        title: "  Password Reset Is Not Rate Limited  ",
        description: "Detail Text",
        sourceRequirementId: "req-1",
      });
      const b = buildDeliveryItemStableKey({
        itemType: "risk",
        title: "password reset is not rate limited",
        description: "detail text",
        sourceRequirementId: "req-1",
      });
      expect(a).toBe(b);
    });

    it("produces a different key when itemType, sourceRequirementId, or content differs", () => {
      const base = {
        itemType: "risk" as const,
        title: "Password reset is not rate limited",
        description: null,
        sourceRequirementId: "req-1",
      };
      const key = buildDeliveryItemStableKey(base);
      expect(buildDeliveryItemStableKey({ ...base, itemType: "assumption" })).not.toBe(key);
      expect(buildDeliveryItemStableKey({ ...base, sourceRequirementId: "req-2" })).not.toBe(key);
      expect(buildDeliveryItemStableKey({ ...base, title: "Something else entirely" })).not.toBe(
        key,
      );
    });

    it("indexDeliveryItemsByStableKey maps each persisted item by its own computed stable key", async () => {
      const { requirement } = await seedRequirementWithCitation(repository, {
        organizationId: "org-1",
        projectId: "project-1",
        runId: "run-1",
        stableKey: "req-a",
      });
      const item = await repository.insertDeliveryItemWithCitations(
        {
          organizationId: "org-1",
          projectId: "project-1",
          analysisRunId: "run-1",
          itemType: "question",
          title: "What is the rate limit?",
          description: null,
          epistemicStatus: "assumed",
          confidenceBand: null,
          confidenceReasonCodes: [],
          severity: null,
          priority: null,
          status: "open",
          visibility: "internal",
          attributes: {},
          sourceRequirementId: requirement.id,
          createdByAiRunId: null,
        },
        [],
      );

      const map = indexDeliveryItemsByStableKey([item]);

      const key = buildDeliveryItemStableKey({
        itemType: "question",
        title: "What is the rate limit?",
        description: null,
        sourceRequirementId: requirement.id,
      });
      expect(map.get(key)?.id).toBe(item.id);
    });
  });

  describe("runDerivedModelStage", () => {
    async function seedRunStageBatch(attemptNumber: number) {
      const scope = { organizationId: "org-1", projectId: "project-1", runId: "run-1" };
      const run = buildTestRun({
        id: scope.runId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        sourceSnapshotId: "snapshot-1",
      });
      repository.seedRun(run);
      repository.seedProviderPolicy(
        buildTestProviderPolicy({ id: run.providerPolicyId, organizationId: run.organizationId }),
      );
      let stage = await repository.createStage({
        ...scope,
        kind: "conflict_detection",
        idempotencyKey: "stage:conflict_detection",
      });
      stage = await repository.updateStage(stage.id, { status: "running", attemptNumber });
      const batch = await ensureSyntheticBatch(runtime, scope, stage.id);
      return { scope, run, stage, batch };
    }

    it("parks the stage in waiting_retry and bumps attemptNumber on a retryable failure that has not exhausted this module's attempt budget, without failing the run/batch", async () => {
      const { scope, run, stage, batch } = await seedRunStageBatch(1);
      const executor = createFakeStructuredExecutor([
        {
          throws: new AiCoreError("AI_RUN_PROVIDER_TIMEOUT", "raw provider excerpt: secret text", {
            retryable: true,
          }),
        },
      ]);

      await expect(
        runDerivedModelStage({
          runtime: { ...runtime, executor },
          run,
          scope,
          stage,
          batchId: batch.id,
          stageKind: "conflict_detection",
          promptAssetKind: "conflict_detection",
          schema: conflictDetectionOutputSchema,
          evidenceBlocks: [],
          idempotencyKey: "idem-retry-1",
        }),
      ).rejects.toThrow();

      const updatedStage = await repository.getStage(stage.id);
      expect(updatedStage?.status).toBe("waiting_retry");
      expect(updatedStage?.attemptNumber).toBe(2);
      expect(updatedStage?.failureDetail).toBe("AI provider request failed.");
      expect(updatedStage?.failureDetail).not.toContain("secret text");

      const updatedRun = await repository.getRun(run.id);
      expect(updatedRun?.status).not.toBe("failed");
      const updatedBatch = await repository.getBatch(batch.id);
      expect(updatedBatch?.status).not.toBe("failed");
    });

    it("fails the stage/batch/run with a stable AI_RUN_RETRIES_EXHAUSTED code once this module's own attempt budget is exceeded, never leaving the run stuck running", async () => {
      const { scope, run, stage, batch } = await seedRunStageBatch(3);
      const executor = createFakeStructuredExecutor([
        {
          throws: new AiCoreError("AI_RUN_PROVIDER_TIMEOUT", "raw provider excerpt: secret text", {
            retryable: true,
          }),
        },
      ]);

      await expect(
        runDerivedModelStage({
          runtime: { ...runtime, executor },
          run,
          scope,
          stage,
          batchId: batch.id,
          stageKind: "conflict_detection",
          promptAssetKind: "conflict_detection",
          schema: conflictDetectionOutputSchema,
          evidenceBlocks: [],
          idempotencyKey: "idem-retry-2",
        }),
      ).rejects.toThrow();

      const updatedStage = await repository.getStage(stage.id);
      expect(updatedStage?.status).toBe("failed");
      expect(updatedStage?.failureCode).toBe("AI_RUN_RETRIES_EXHAUSTED");
      expect(updatedStage?.failureDetail).not.toContain("secret text");

      const updatedRun = await repository.getRun(run.id);
      expect(updatedRun?.status).toBe("failed");
      expect(updatedRun?.failureRetryable).toBe(true);
      expect(updatedRun?.failedStageId).toBe(stage.id);
      const updatedBatch = await repository.getBatch(batch.id);
      expect(updatedBatch?.status).toBe("failed");
    });

    it("fails the stage/batch/run immediately on a non-retryable failure, never parking in waiting_retry", async () => {
      const { scope, run, stage, batch } = await seedRunStageBatch(1);
      const executor = createFakeStructuredExecutor([
        {
          throws: new AiCoreError(
            "AI_RUN_SCHEMA_VALIDATION_FAILED",
            "raw provider excerpt: secret text",
            {
              retryable: false,
            },
          ),
        },
      ]);

      await expect(
        runDerivedModelStage({
          runtime: { ...runtime, executor },
          run,
          scope,
          stage,
          batchId: batch.id,
          stageKind: "conflict_detection",
          promptAssetKind: "conflict_detection",
          schema: conflictDetectionOutputSchema,
          evidenceBlocks: [],
          idempotencyKey: "idem-terminal-1",
        }),
      ).rejects.toThrow();

      const updatedStage = await repository.getStage(stage.id);
      expect(updatedStage?.status).toBe("failed");
      expect(updatedStage?.failureCode).toBe("AI_RUN_SCHEMA_VALIDATION_FAILED");
      const updatedRun = await repository.getRun(run.id);
      expect(updatedRun?.status).toBe("failed");
      expect(updatedRun?.failureRetryable).toBe(false);
    });
  });
});
