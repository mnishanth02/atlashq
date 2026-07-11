import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import {
  E2E_MEMBER_NAME,
  E2E_ORGANIZATION_NAME,
  E2E_PROJECT_NAME,
  E2E_USER_EMAIL,
  E2E_USER_NAME,
  E2E_USER_PASSWORD,
} from "../support/test-data";

async function selectOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.describe.configure({ mode: "serial" });

test("organization admin completes the project lifecycle through the UI", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/projects");

  await expect(page).toHaveURL(/\/login\?redirect=%2Fprojects$/);
  await expect(page.getByRole("heading", { name: "Sign in to AtlasHQ" })).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill(E2E_USER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByText(E2E_ORGANIZATION_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  await expect(page.getByText("No projects yet", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New project", exact: true }).first().click();
  const createDialog = page.getByRole("dialog", { name: "Create project" });
  await expect(createDialog).toBeVisible();

  await expect(createDialog.getByRole("combobox", { name: "Owner", exact: true })).toContainText(
    `${E2E_USER_NAME} · You`,
  );
  await selectOption(page, "Engagement type", "Internal");
  await createDialog.getByLabel("Project name", { exact: true }).fill(E2E_PROJECT_NAME);
  await createDialog
    .getByLabel("Description", { exact: true })
    .fill("Exercise the real browser lifecycle for an internal delivery readiness workspace.");
  await selectOption(page, "Status", "Active");
  await selectOption(page, "Phase", "Requirements");
  await selectOption(page, "Priority", "High");
  await selectOption(page, "Visibility", "Private");
  await createDialog.getByLabel("Start date", { exact: true }).fill("2026-08-01");
  await createDialog.getByLabel("Target date", { exact: true }).fill("2026-10-31");
  await createDialog.getByLabel("Tags", { exact: true }).fill("lifecycle, e2e, internal");
  await createDialog.getByRole("button", { name: "Create project", exact: true }).click();

  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByText(E2E_PROJECT_NAME, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Internal project", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(
      "Exercise the real browser lifecycle for an internal delivery readiness workspace.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("High priority", { exact: true })).toBeVisible();
  await expect(page.getByText("Private workspace", { exact: true })).toBeVisible();
  await expect(page.getByText("Requirements", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Project owner", { exact: true }).locator("..")).toContainText(
    E2E_USER_NAME,
  );

  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit project" });
  await editDialog
    .getByLabel("Description", { exact: true })
    .fill("Updated through an optimistic-concurrency project edit.");
  await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Updated through an optimistic-concurrency project edit.", { exact: true }),
  ).toBeVisible();

  // The Source Vault feature flag is enabled for the E2E organization (module-02 coverage), so
  // the "Source documents" readiness card reports "Zero recorded" (an actionable, feature-enabled
  // empty state) rather than "Not started" (the feature-disabled placeholder) -- one fewer "Not
  // started" card and one more "Zero recorded" card than when the flag is off.
  await expect(page.getByText("Not started", { exact: true })).toHaveCount(4);
  await expect(page.getByText("Zero recorded", { exact: true })).toHaveCount(2);
  await expect(page.getByText("0 recorded", { exact: true })).toHaveCount(6);
  await expect(page.getByText("Readiness cards stay honest.", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/AI analysis/i);

  await page.getByRole("tab", { name: "Members", exact: true }).click();
  const ownerMembership = page.getByRole("row").filter({ hasText: E2E_USER_NAME });
  await expect(ownerMembership).toContainText("Project Owner");
  await expect(ownerMembership).toContainText("Active");

  // The membership picker is directory-backed (not a raw UUID input): the E2E organization also
  // provisions a second (non-admin) user for Source Vault permission-boundary coverage, so that
  // user -- not yet a member of this project -- should surface as a selectable option here.
  await page.getByRole("combobox", { name: "Member", exact: true }).click();
  await expect(page.getByRole("option", { name: E2E_MEMBER_NAME, exact: false })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  const projectCreatedEvent = page.getByRole("row").filter({ hasText: "Project create" });
  await expect(projectCreatedEvent).toContainText("You");
  await expect(page.getByRole("row").filter({ hasText: "Project membership add" })).toContainText(
    "You",
  );

  await page.getByRole("button", { name: "Archive", exact: true }).click();
  const archiveDialog = page.getByRole("alertdialog", { name: "Archive this project?" });
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole("button", { name: "Archive project", exact: true }).click();

  await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit project", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Restore project", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Members", exact: true }).click();
  await expect(
    page.getByText("Memberships are frozen while the project is archived.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add member", exact: true })).toHaveCount(0);
  await expect(ownerMembership).toContainText("No inline actions");

  await page.getByRole("button", { name: "Restore project", exact: true }).click();
  const restoreDialog = page.getByRole("alertdialog", { name: "Restore this project?" });
  await expect(restoreDialog).toBeVisible();
  await restoreDialog.getByRole("button", { name: "Restore project", exact: true }).click();

  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit project", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("link", { name: E2E_PROJECT_NAME, exact: true })).toBeVisible();

  await page.getByRole("button", { name: new RegExp(E2E_USER_NAME) }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprojects$/);
  await expect(page.getByRole("heading", { name: "Sign in to AtlasHQ" })).toBeVisible();
});
