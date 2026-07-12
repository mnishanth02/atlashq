import { describe, expect, it } from "vitest";
import {
  loadDefaultFixtureSet,
  promptAssetRegistry,
  renderPrompt,
  runPromptInjectionStructuralChecks,
} from "./index.js";

describe("prompt asset registry", () => {
  it("registers all required module-3 prompt asset kinds with stable bundle hash", () => {
    const kinds = promptAssetRegistry.assets.map((asset) => asset.kind);
    expect(kinds).toEqual([
      "confirmed_extraction",
      "reference_feature_extraction",
      "normalization_proposals",
      "conflict_detection",
      "coverage_analysis",
      "delivery_item_extraction",
      "question_generation",
    ]);
    expect(promptAssetRegistry.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("renders prompts with untrusted evidence tags and keeps evidence out of system/developer text", () => {
    const asset = promptAssetRegistry.getByKind("confirmed_extraction");
    const evidenceText = "Source says: release by Q4.";
    const rendered = renderPrompt({
      promptAsset: asset,
      organizationId: "org_1",
      projectId: "project_1",
      runId: "run_1",
      batchId: "batch_1",
      snapshotId: "snapshot_1",
      evidenceBlocks: [
        {
          blockId: "block_1",
          organizationId: "org_1",
          projectId: "project_1",
          snapshotId: "snapshot_1",
          sourceDocumentId: "source_1",
          sourceChunkId: "chunk_1",
          chunkContentHash: "chunk_hash",
          origin: "source",
          text: evidenceText,
        },
      ],
    });

    expect(rendered.prompt).toContain('trust="untrusted"');
    expect(rendered.prompt).toContain(evidenceText);
    expect(rendered.system).not.toContain(evidenceText);
    expect(rendered.developer).not.toContain(evidenceText);
  });

  it("flags adversarial prompt-injection fixture content", () => {
    const fixture = loadDefaultFixtureSet().find(
      (entry) => entry.id === "adv-prompt-injection-direct-v1",
    );
    expect(fixture).toBeDefined();
    const block = fixture?.input.evidenceBlocks[0];
    expect(block?.text).toBeTruthy();

    const check = runPromptInjectionStructuralChecks({
      expectedOrganizationId: fixture?.input.context.organizationId ?? "missing-org",
      expectedProjectId: fixture?.input.context.projectId ?? "missing-project",
      expectedSnapshotId: fixture?.input.context.snapshotId ?? "missing-snapshot",
      blocks: fixture?.input.evidenceBlocks ?? [],
    });

    expect(check.safe).toBe(false);
    expect(check.findings.map((finding) => finding.code)).toContain("forbidden_xml_role_tag");
  });
});
