import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import {
  E2E_MEMBER_EMAIL,
  E2E_MEMBER_NAME,
  E2E_MEMBER_PASSWORD,
  E2E_SOURCE_VAULT_PROJECT_NAME,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
} from "../support/test-data";

test.describe.configure({ mode: "serial" });

// The intake sheet's footer buttons sit inside a Radix ScrollArea; the default 720px-tall
// Playwright viewport pushes them past the fold and Playwright's auto-scroll can thrash against
// the ScrollArea's custom scroll viewport instead of settling. A taller viewport fits the whole
// sheet without scrolling, matching how a real desktop browser window is actually sized.
test.use({ viewport: { width: 1440, height: 1440 } });

async function selectOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

/** Creates a project through the real UI and returns its id, parsed from the resulting URL. */
async function createProject(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "New project", exact: true }).first().click();
  const createDialog = page.getByRole("dialog", { name: "Create project" });
  await expect(createDialog).toBeVisible();

  await selectOption(page, "Engagement type", "Internal");
  await createDialog.getByLabel("Project name", { exact: true }).fill(name);
  await createDialog
    .getByLabel("Description", { exact: true })
    .fill("Exercise the Source Document Vault lifecycle end-to-end against the real stack.");
  await selectOption(page, "Status", "Active");
  await selectOption(page, "Phase", "Requirements");
  await selectOption(page, "Priority", "High");
  await selectOption(page, "Visibility", "Private");
  await createDialog.getByLabel("Start date", { exact: true }).fill("2026-08-01");
  await createDialog.getByLabel("Target date", { exact: true }).fill("2026-10-31");
  await createDialog.getByLabel("Tags", { exact: true }).fill("source-vault, e2e");
  await createDialog.getByRole("button", { name: "Create project", exact: true }).click();

  await expect(page).toHaveURL(/\/projects\/([0-9a-f-]{36})$/);
  const match = /\/projects\/([0-9a-f-]{36})$/u.exec(page.url());
  const projectId = match?.[1];
  if (!projectId) {
    throw new Error(`Failed to parse project id from URL: ${page.url()}`);
  }
  return projectId;
}

async function openSourceVault(page: Page, projectId: string): Promise<void> {
  await page.goto(`/projects/${projectId}/source-documents`);
  await expect(page.getByRole("heading", { name: "Source documents" })).toBeVisible();
}

async function openAddSource(page: Page): Promise<void> {
  const addFirst = page.getByRole("button", { name: "Add first source", exact: true });
  const add = page.getByRole("button", { name: "Add source", exact: true });
  if (await addFirst.isVisible().catch(() => false)) {
    await addFirst.click();
  } else {
    await add.click();
  }
  await expect(page.getByRole("dialog", { name: "Add source document" })).toBeVisible();
}

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

test("organization admin and contributor exercise the Source Document Vault lifecycle", async ({
  page,
  browser,
  allowApiResponse,
}) => {
  test.setTimeout(300_000);

  await login(page, E2E_USER_EMAIL, E2E_USER_PASSWORD);
  const projectId = await createProject(page, E2E_SOURCE_VAULT_PROJECT_NAME);

  // -------------------------------------------------------------------
  // 1. Upload -> processing -> preview/download availability
  // -------------------------------------------------------------------
  await openSourceVault(page, projectId);

  const alphaTitle = "E2E Alpha Source";
  const alphaContent = Buffer.from(
    "Alpha source content for the Source Document Vault E2E run.",
    "utf8",
  );

  await openAddSource(page);
  await page.getByLabel("Title", { exact: true }).fill(alphaTitle);
  await page.setInputFiles("#intake-file", {
    name: "alpha-source.txt",
    mimeType: "text/plain",
    buffer: alphaContent,
  });
  await expect(page.getByText(`sha256:${sha256Hex(alphaContent)}`)).toBeVisible();
  await page.getByRole("button", { name: "Start upload", exact: true }).click();
  await expect(page.getByText("Source uploaded")).toBeVisible();

  await page.getByRole("link", { name: alphaTitle, exact: true }).click();
  await expect(page.getByRole("heading", { name: alphaTitle })).toBeVisible();
  const alphaUrl = page.url();

  const downloadButton = page.getByRole("button", { name: "Download", exact: true });
  await expect(downloadButton).toBeVisible({ timeout: 90_000 });
  // The file-level scan status (which gates the Download button's visibility) can flip to
  // "clean" slightly before the source's overall processing pipeline finishes extraction and
  // reaches "ready" -- and the download-url endpoint requires the *source* to be "ready", not
  // just the file to be scanned clean. Wait for that source-level status explicitly so the
  // download click below doesn't race a real (if narrow) backend 409.
  await expect(page.getByText("Ready", { exact: true }).first()).toBeVisible({ timeout: 90_000 });

  // Prove the presigned MinIO download URL actually works end-to-end (real CORS +
  // signed-URL wiring), not just that the button rendered. `DownloadFileButton` opens the signed
  // URL via `window.open`, and the API sets `Content-Disposition: attachment` on it, so Chromium
  // intercepts it as a native download rather than a page navigation.
  const downloadPromise = page.context().waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) {
    throw new Error("Downloaded file was not saved to disk.");
  }
  const downloadedContent = await readFile(downloadedPath);
  expect(downloadedContent).toEqual(alphaContent);

  // -------------------------------------------------------------------
  // 2. Duplicate create: cancel, then acknowledge
  //
  // A single regular-file source's canonical content_hash (module-02 §6.3) equals that file's
  // own SHA-256 exactly -- it is never combined with title/sourceType/format, and duplicate
  // identity is independent of title. Re-using the same title below is incidental to this test,
  // not required for the 409: byte-identical file content alone is sufficient to trigger it, even
  // under a different title.
  // -------------------------------------------------------------------
  await openSourceVault(page, projectId);
  await openAddSource(page);
  await page.getByLabel("Title", { exact: true }).fill(alphaTitle);
  await page.setInputFiles("#intake-file", {
    name: "alpha-source-resubmit.txt",
    mimeType: "text/plain",
    buffer: alphaContent,
  });
  await expect(page.getByText(`sha256:${sha256Hex(alphaContent)}`)).toBeVisible();

  allowApiResponse({
    status: 409,
    method: "POST",
    pathIncludes: "source-document-upload-sessions",
  });

  await page.getByRole("button", { name: "Start upload", exact: true }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Duplicate source detected" });
  await expect(duplicateDialog).toBeVisible();
  await duplicateDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(duplicateDialog).toBeHidden();

  await page.getByRole("button", { name: "Start upload", exact: true }).click();
  await expect(duplicateDialog).toBeVisible();
  await duplicateDialog.getByRole("button", { name: "Add as new source", exact: true }).click();
  await expect(page.getByText("Source uploaded")).toBeVisible();

  const alphaTitleRows = page.getByRole("row").filter({ hasText: alphaTitle });
  await expect(alphaTitleRows).toHaveCount(2);
  await expect(alphaTitleRows.filter({ hasText: "Duplicate ack" })).toHaveCount(1);

  // -------------------------------------------------------------------
  // 3. Archive / restore
  // -------------------------------------------------------------------
  await page.goto(alphaUrl);
  await page.getByRole("button", { name: "Archive source", exact: true }).click();
  const archiveDialog = page.getByRole("dialog", { name: "Archive this source?" });
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByLabel("Reason (optional)", { exact: true }).fill("E2E archive check.");
  await archiveDialog.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByText("Source archived")).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore source", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Restore source", exact: true }).click();
  await expect(page.getByText("Source restored")).toBeVisible();
  await expect(page.getByRole("button", { name: "Archive source", exact: true })).toBeVisible();

  // -------------------------------------------------------------------
  // 4. Manual source + new version + version navigation
  // -------------------------------------------------------------------
  await openSourceVault(page, projectId);
  const manualTitle = "E2E Manual Source";
  await openAddSource(page);
  await page.getByRole("tab", { name: "Manual text", exact: true }).click();
  // "Title" is a shared field label across the file/manual/reference sub-forms (they share the
  // `intake-title` id). Wait for the manual form's own marker to mount before filling it, so we
  // don't race the file form's Title input during the tab-switch remount and fill the wrong one.
  await expect(page.getByText("Manual text is immutable once saved")).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill(manualTitle);
  await page.getByLabel("Body", { exact: true }).fill("Manual source body for the E2E vault run.");
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(page.getByText("Manual source created")).toBeVisible();

  await page.getByRole("link", { name: manualTitle, exact: true }).click();
  await expect(page.getByRole("heading", { name: manualTitle })).toBeVisible();
  await expect(page.getByText("v1", { exact: true }).first()).toBeVisible();
  const manualV1Url = page.url();

  await page.getByRole("button", { name: "Create new version", exact: true }).click();
  const versionDialog = page.getByRole("dialog", { name: "Create new version" });
  await expect(versionDialog).toBeVisible();
  await versionDialog
    .getByLabel("New body", { exact: true })
    .fill("Manual source body, replaced by the E2E new-version step.");
  await versionDialog.getByRole("button", { name: "Create new version", exact: true }).click();
  await expect(page.getByText("New manual version created")).toBeVisible();

  await expect(page).not.toHaveURL(manualV1Url);
  await expect(page.getByRole("heading", { name: manualTitle })).toBeVisible();
  await expect(page.getByText("v2", { exact: true }).first()).toBeVisible();

  // Version history table links back to the older version.
  await page.getByRole("table").getByRole("link", { name: manualTitle, exact: true }).click();
  await expect(page).toHaveURL(manualV1Url);
  await expect(page.getByRole("heading", { name: manualTitle })).toBeVisible();

  // -------------------------------------------------------------------
  // 5. Reference attestation + capture-disabled behavior + IP review
  //
  // The server exposes `GET /source-vault/capabilities` so the client no
  // longer discovers "capture disabled" by clicking through to a 403. When
  // `singlePageCaptureEnabled` is false (the case in the E2E stack), the
  // "On-demand capture" option must be absent from the capture-method Select
  // altogether, and the contributor view must not render the "Request fresh
  // capture" button. We therefore submit the reference via "Manual paste"
  // (the safe, always-available capture method), then assert absence of the
  // disabled affordances on both admin and contributor sessions.
  // -------------------------------------------------------------------
  await openSourceVault(page, projectId);
  const referenceTitle = "E2E Reference Source";
  await openAddSource(page);
  await page.getByRole("tab", { name: "Reference", exact: true }).click();
  // Same shared-label race as the manual tab: wait for a reference-only field before touching
  // the shared "Title" input.
  await expect(page.getByRole("combobox", { name: "Reference kind", exact: true })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill(referenceTitle);

  // Server-authoritative capabilities gate the capture-method Select: with
  // `singlePageCaptureEnabled=false` in the E2E stack, "On-demand capture"
  // must not appear as an option. Open the Select and assert absence.
  await page.getByRole("combobox", { name: "Capture method", exact: true }).click();
  await expect(page.getByRole("option", { name: "On-demand capture", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Manual paste", exact: true }).click();

  await page
    .getByLabel("Source URL", { exact: true })
    .fill("https://example.test/atlashq-e2e-reference");
  await page.getByRole("checkbox", { name: "Attestation" }).check();
  await page.getByRole("button", { name: "Save reference", exact: true }).click();
  await expect(page.getByText("Reference recorded", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: referenceTitle, exact: true }).click();
  await expect(page.getByRole("heading", { name: referenceTitle })).toBeVisible();
  const referenceUrl = page.url();
  await expect(page.getByText("Not reviewed", { exact: true })).toBeVisible();
  // With single-page capture disabled server-side, the fresh-capture CTA
  // must not render at all on the admin session — no failed click required.
  await expect(
    page.getByRole("button", { name: "Request fresh capture", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Mark cleared", exact: true }).click();
  const clearDialog = page.getByRole("dialog", { name: "Clear IP review" });
  await expect(clearDialog).toBeVisible();
  await clearDialog.getByLabel("Reason", { exact: true }).fill("Reviewed and approved for E2E.");
  await clearDialog.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("IP review updated")).toBeVisible();
  await expect(page.getByText("Cleared", { exact: true })).toBeVisible();

  // -------------------------------------------------------------------
  // 6. Permission boundary: add a non-admin contributor and verify gating
  // -------------------------------------------------------------------
  await page.goto(`/projects/${projectId}`);
  await page.getByRole("tab", { name: "Members", exact: true }).click();
  await page.getByRole("combobox", { name: "Member", exact: true }).click();
  await page.getByRole("option", { name: new RegExp(E2E_MEMBER_NAME) }).click();
  await selectOption(page, "Role", "Architect / Tech Lead");
  await page.getByRole("button", { name: "Add member", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: E2E_MEMBER_NAME })).toContainText(
    "Architect / Tech Lead",
  );

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  try {
    await login(memberPage, E2E_MEMBER_EMAIL, E2E_MEMBER_PASSWORD);
    await memberPage.goto(referenceUrl);
    await expect(memberPage.getByRole("heading", { name: referenceTitle })).toBeVisible();

    // A contributor without `project:admin` can read/write sources but must never see
    // admin-only IP-review actions.
    await expect(memberPage.getByRole("button", { name: "Mark cleared", exact: true })).toHaveCount(
      0,
    );
    await expect(
      memberPage.getByRole("button", { name: "Mark restricted", exact: true }),
    ).toHaveCount(0);

    // Capture disabled server-side → the Request-fresh-capture button must
    // be absent for the contributor as well. Asserting absence (rather than
    // clicking and inspecting a toast) exercises the true contract:
    // capabilities gate the affordance, they don't just gate its outcome.
    await expect(
      memberPage.getByRole("button", { name: "Request fresh capture", exact: true }),
    ).toHaveCount(0);
  } finally {
    await memberContext.close();
  }
});
