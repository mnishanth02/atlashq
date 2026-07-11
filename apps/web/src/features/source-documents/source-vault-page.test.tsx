import { screen, waitFor } from "@testing-library/react";
import { delay, HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sourceDocumentsSearchSchema } from "@/routes/projects/source-documents-search";
import {
  makeCurrentUser,
  makeMembership,
  makeMembershipList,
  makeProject,
  makeSourceList,
  makeSourceListItem,
  makeSourceVaultCapabilities,
} from "@/test/fixtures";
import { apiError, atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { SourceVaultPage } from "./source-vault-page";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: authMocks.useSession,
}));

const server = createMswServer();
setupMswServer(server);

const EMPTY_SEARCH = sourceDocumentsSearchSchema.parse({});
const PROJECT_ID = "project-1";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";

function useVaultHandlers({
  role = "member" as "admin" | "member",
  project = makeProject(),
  vault = makeSourceList([makeSourceListItem()]),
  membership = makeMembership({
    userId: OWNER_ID,
    role: "Business Analyst / Coordinator",
  }),
  capabilities = makeSourceVaultCapabilities(),
}: {
  role?: "admin" | "member";
  project?: ReturnType<typeof makeProject>;
  vault?: ReturnType<typeof makeSourceList>;
  membership?: ReturnType<typeof makeMembership>;
  capabilities?: ReturnType<typeof makeSourceVaultCapabilities>;
} = {}) {
  server.use(
    atlasHandlers.currentUser(makeCurrentUser({ organizationRole: role, id: OWNER_ID })),
    atlasHandlers.project(project.id, project),
    atlasHandlers.memberships(project.id, makeMembershipList([membership])),
    atlasHandlers.sourceVaultCapabilities(project.id, capabilities),
    atlasHandlers.sources(project.id, vault),
  );
}

describe("SourceVaultPage", () => {
  beforeEach(() => {
    authMocks.useSession.mockReturnValue({ data: undefined });
  });

  it("renders the vault heading and an Add source CTA for writers", async () => {
    useVaultHandlers();

    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(await screen.findByRole("heading", { name: "Source documents" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Add source/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /Back to workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete/i })).not.toBeInTheDocument();
  });

  it("shows a deterministic loading state while the vault list is pending", async () => {
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member", id: OWNER_ID })),
      atlasHandlers.project(PROJECT_ID, makeProject()),
      atlasHandlers.memberships(
        PROJECT_ID,
        makeMembershipList([
          makeMembership({ userId: OWNER_ID, role: "Business Analyst / Coordinator" }),
        ]),
      ),
      atlasHandlers.sourceVaultCapabilities(PROJECT_ID, makeSourceVaultCapabilities()),
      http.get("*/api/v1/projects/project-1/source-documents", async () => {
        await delay(80);
        return HttpResponse.json(makeSourceList([]));
      }),
    );

    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(
      await screen.findByRole("status", { name: /Loading source documents/i }),
    ).toBeInTheDocument();
  });

  it("shows the empty state with an inline call to add the first source", async () => {
    useVaultHandlers({ vault: makeSourceList([]) });
    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(await screen.findByText("No sources yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add first source/i })).toBeInTheDocument();
  });

  it("differentiates the filtered-empty state and offers to clear filters", async () => {
    useVaultHandlers({ vault: makeSourceList([]) });
    const filtered = sourceDocumentsSearchSchema.parse({ status: "quarantined" });
    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={filtered} onSearchChange={vi.fn()} />,
      {
        initialEntry: `/projects/${PROJECT_ID}/source-documents?status=quarantined`,
      },
    );

    expect(await screen.findByText("No matching sources")).toBeInTheDocument();
    // Two "Clear filters" buttons exist: one in the toolbar reset, one in the empty state CTA.
    expect(screen.getAllByRole("button", { name: /Clear filters/i }).length).toBeGreaterThan(0);
  });

  it("shows the vault error with a retry action when the list fails", async () => {
    let attempts = 0;
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member", id: OWNER_ID })),
      atlasHandlers.project(PROJECT_ID, makeProject()),
      atlasHandlers.memberships(
        PROJECT_ID,
        makeMembershipList([
          makeMembership({ userId: OWNER_ID, role: "Business Analyst / Coordinator" }),
        ]),
      ),
      atlasHandlers.sourceVaultCapabilities(PROJECT_ID, makeSourceVaultCapabilities()),
      http.get("*/api/v1/projects/project-1/source-documents", () => {
        attempts += 1;
        return attempts === 1
          ? apiError(500, "Vault temporarily unavailable")
          : HttpResponse.json(makeSourceList([makeSourceListItem()]));
      }),
    );

    const view = renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(await screen.findByText("Vault temporarily unavailable")).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.getAllByText("Initial requirements pack").length).toBeGreaterThan(0),
    );
  });

  it("shows the storage-unavailable state on SOURCE_STORAGE_UNAVAILABLE", async () => {
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member", id: OWNER_ID })),
      atlasHandlers.project(PROJECT_ID, makeProject()),
      atlasHandlers.memberships(
        PROJECT_ID,
        makeMembershipList([
          makeMembership({ userId: OWNER_ID, role: "Business Analyst / Coordinator" }),
        ]),
      ),
      atlasHandlers.sourceVaultCapabilities(PROJECT_ID, makeSourceVaultCapabilities()),
      http.get("*/api/v1/projects/project-1/source-documents", () =>
        HttpResponse.json(
          {
            statusCode: 503,
            code: "SOURCE_STORAGE_UNAVAILABLE",
            message: "Storage down",
            correlationId: "corr",
          },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(await screen.findByText("Source storage is unavailable")).toBeInTheDocument();
  });

  it("hides the Add source CTA and shows a read-only badge for QA readers", async () => {
    useVaultHandlers({
      membership: makeMembership({ userId: OWNER_ID, role: "QA" }),
    });

    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(await screen.findByRole("heading", { name: "Source documents" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add source/i })).not.toBeInTheDocument();
    // The prior implementation used a disabled button; that's now a role="note"
    // to avoid suggesting an action to a read-only viewer. Wait for the
    // capabilities call to resolve — while pending, the safe-disabled fallback
    // shows a capability notice first that flips to the role note.
    expect(await screen.findByText(/Read-only role/i)).toBeInTheDocument();
  });

  it("hides Add source and shows a capability notice when the server disables writes", async () => {
    // Writes disabled server-side (regardless of role). The Add source CTA
    // must not render — a role="note" replaces it — and the top-of-page
    // Alert explains why the vault is read-only.
    useVaultHandlers({
      role: "admin",
      capabilities: makeSourceVaultCapabilities({ writesEnabled: false }),
    });

    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(await screen.findByRole("heading", { name: "Source documents" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add source/i })).not.toBeInTheDocument();
    // The capability-driven reason appears in both the top Alert and the
    // vault table's read-only banner — at least one instance is required.
    const matches = await screen.findAllByText(/write operations are disabled for this workspace/i);
    expect(matches.length).toBeGreaterThan(0);
    // The note is capability-driven, not role-driven.
    expect(screen.getByRole("note")).not.toHaveTextContent(/Read-only role/i);
  });

  it("hides Add source when required storage is unavailable, even if writes are enabled", async () => {
    useVaultHandlers({
      role: "admin",
      capabilities: makeSourceVaultCapabilities({ storageAvailable: false }),
    });

    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(await screen.findByRole("heading", { name: "Source documents" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add source/i })).not.toBeInTheDocument();
    const matches = await screen.findAllByText(/source storage is unavailable/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("renders the access-denied state when the API returns 403", async () => {
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member", id: OWNER_ID })),
      http.get("*/api/v1/projects/project-1", () => apiError(403, "Not a member of this project")),
      atlasHandlers.memberships(PROJECT_ID, makeMembershipList([])),
    );

    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    expect(await screen.findByText(/Access denied/i)).toBeInTheDocument();
  });

  it("renders the table with real source rows for desktop viewports", async () => {
    useVaultHandlers({
      vault: makeSourceList([
        makeSourceListItem({ id: "s1", title: "Vendor proposal", processingStatus: "ready" }),
        makeSourceListItem({
          id: "s2",
          title: "IP review pending upload",
          processingStatus: "verification_pending",
          sourceType: "reference",
          documentFormat: "png",
          ipReviewStatus: "not_reviewed",
        }),
      ]),
    });

    renderWithProviders(
      <SourceVaultPage projectId={PROJECT_ID} search={EMPTY_SEARCH} onSearchChange={vi.fn()} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents` },
    );

    // Titles appear in both the desktop Table and the mobile Card layers.
    expect((await screen.findAllByText("Vendor proposal")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("IP review pending upload").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    // No delete affordance anywhere in the list.
    expect(screen.queryByRole("button", { name: /Delete/i })).not.toBeInTheDocument();
  });
});
