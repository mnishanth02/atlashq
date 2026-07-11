import { describe, expect, it } from "vitest";
import {
  createManualSource,
  createProject,
  createUploadSession,
  getSourceVaultCapabilities,
  listSources,
} from "./api.js";
import {
  createAgent,
  createOrganization,
  provisionAdmin,
  setOrganizationSettings,
} from "./fixtures.js";
import { useHarness } from "./suite.js";

const getHarness = useHarness();

describe("integration: Source Vault unavailable runtime", () => {
  it("returns SOURCE_STORAGE_UNAVAILABLE for write paths when the API boots core-only", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    await setOrganizationSettings(harness.db, org.id, { source_vault_writes_enabled: true });
    const adminAgent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, adminAgent, org.id);
    const project = await createProject(adminAgent, {
      name: "Core-only source vault",
      type: "internal",
      ownerId: admin.id,
    });
    expect(project.status).toBe(201);

    const upload = await createUploadSession(adminAgent, project.body.id, {
      sourceType: "document",
      documentFormat: "pdf",
      title: "Unavailable upload",
      tags: [],
      files: [
        {
          ordinal: 0,
          role: "primary",
          originalFileName: "alpha.pdf",
          format: "pdf",
          declaredMimeType: "application/pdf",
          byteSize: 128,
          sha256: "a".repeat(64),
        },
      ],
    });
    expect(upload.status).toBe(503);
    expect(upload.body.code).toBe("SOURCE_STORAGE_UNAVAILABLE");

    const manual = await createManualSource(adminAgent, project.body.id, {
      title: "Unavailable manual",
      body: "hello",
      tags: [],
    });
    expect(manual.status).toBe(503);
    expect(manual.body.code).toBe("SOURCE_STORAGE_UNAVAILABLE");

    const list = await listSources(adminAgent, project.body.id);
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
  });

  it("reports storageAvailable/queueAvailable as false when booted core-only, without throwing", async () => {
    const harness = getHarness();
    const org = await createOrganization(harness.db);
    await setOrganizationSettings(harness.db, org.id, {
      source_vault_writes_enabled: true,
      single_page_capture_enabled: true,
      ocr_processing_enabled: true,
    });
    const adminAgent = createAgent(harness);
    const { user: admin } = await provisionAdmin(harness, adminAgent, org.id);
    const project = await createProject(adminAgent, {
      name: "Core-only capabilities",
      type: "internal",
      ownerId: admin.id,
    });
    expect(project.status).toBe(201);

    const capabilities = await getSourceVaultCapabilities(adminAgent, project.body.id);
    expect(capabilities.status).toBe(200);
    // Even with every org flag enabled, infra availability must reflect the actual (absent)
    // storage/queue wiring -- the endpoint must never throw on a core-only boot.
    expect(capabilities.body).toEqual({
      writesEnabled: true,
      singlePageCaptureEnabled: true,
      ocrProcessingEnabled: true,
      storageAvailable: false,
      queueAvailable: false,
    });
  });
});
