import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  makeChunkList,
  makeCurrentUser,
  makeExtractionList,
  makeMembership,
  makeMembershipList,
  makeProject,
  makeSourceDetail,
  makeSourceVaultCapabilities,
  makeSourceVersionList,
} from "@/test/fixtures";
import { atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { SourceDetailPage } from "./source-detail-page";

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner");
  return {
    ...actual,
    toast: Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      dismiss: vi.fn(),
    }),
  };
});

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: authMocks.useSession,
}));

vi.mock("./pdf-preview", () => ({
  default: ({ title }: { title: string }) => (
    <div role="img" aria-label={title}>
      PDF preview
    </div>
  ),
}));

const server = createMswServer();
setupMswServer(server);

const PROJECT_ID = "project-1";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "source-1";

function useDetailHandlers({
  source = makeSourceDetail(),
  role = "Business Analyst / Coordinator",
  orgRole = "member" as "admin" | "member",
  versions = makeSourceVersionList([source]),
  capabilities = makeSourceVaultCapabilities(),
}: {
  source?: ReturnType<typeof makeSourceDetail>;
  role?: string;
  orgRole?: "admin" | "member";
  versions?: ReturnType<typeof makeSourceVersionList>;
  capabilities?: ReturnType<typeof makeSourceVaultCapabilities>;
} = {}) {
  server.use(
    atlasHandlers.currentUser(makeCurrentUser({ organizationRole: orgRole, id: OWNER_ID })),
    atlasHandlers.project(PROJECT_ID, makeProject()),
    atlasHandlers.memberships(
      PROJECT_ID,
      makeMembershipList([
        makeMembership({
          userId: OWNER_ID,
          role: role as ReturnType<typeof makeMembership>["role"],
        }),
      ]),
    ),
    atlasHandlers.sourceVaultCapabilities(PROJECT_ID, capabilities),
    atlasHandlers.source(PROJECT_ID, SOURCE_ID, source),
    atlasHandlers.sourceVersions(PROJECT_ID, SOURCE_ID, versions),
    atlasHandlers.sourceExtractions(PROJECT_ID, SOURCE_ID, makeExtractionList()),
    atlasHandlers.sourceChunks(PROJECT_ID, SOURCE_ID, makeChunkList()),
    http.get(
      "*/api/v1/projects/:projectId/source-documents/:sourceId/files/:fileId/preview-url",
      () =>
        HttpResponse.json({
          url: "https://storage.example.test/preview",
          expiresAt: "2026-07-10T00:10:00.000Z",
        }),
    ),
  );
}

describe("SourceDetailPage", () => {
  it("renders the source title, metadata, and files section without a delete affordance", async () => {
    useDetailHandlers();
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(
      await screen.findByRole("heading", { name: "Initial requirements pack" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
    // The vault never surfaces a Delete action, even for admins.
    expect(screen.queryByRole("button", { name: /^Delete/i })).not.toBeInTheDocument();
    // Ready sources show a preview affordance rather than the retry action.
    expect(screen.queryByRole("button", { name: /Retry processing/i })).not.toBeInTheDocument();
  });

  it("shows the retry action only when the source failed", async () => {
    useDetailHandlers({
      source: makeSourceDetail({ processingStatus: "failed" }),
    });
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(await screen.findByRole("button", { name: /Retry processing/i })).toBeEnabled();
  });

  it("does not show retry for quarantined sources and warns instead", async () => {
    useDetailHandlers({
      source: makeSourceDetail({ processingStatus: "quarantined" }),
    });
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(await screen.findByText(/Content quarantined/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry processing/i })).not.toBeInTheDocument();
  });

  it("archives a ready source through the real mutation", async () => {
    useDetailHandlers();
    let archived = false;
    server.use(
      http.post("*/api/v1/projects/project-1/source-documents/source-1/archive", () => {
        archived = true;
        return HttpResponse.json(makeSourceDetail({ isArchived: true }));
      }),
    );

    const view = renderWithProviders(
      <SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}` },
    );

    await view.user.click(await screen.findByRole("button", { name: /Archive source/i }));
    // Dialog opens; confirm.
    await view.user.click(screen.getByRole("button", { name: /^Archive$/i }));
    await waitFor(() => expect(archived).toBe(true));
  });

  it("hides the IP-review controls for non-admin viewers on a reference source", async () => {
    useDetailHandlers({
      source: makeSourceDetail({
        sourceType: "reference",
        reference: {
          id: "ref-1",
          sourceDocumentId: SOURCE_ID,
          referenceKind: "url",
          captureMethod: "manual_paste",
          accessType: "public",
          intendedUse: "inspiration",
          sourceUrl: "https://example.com/x",
          ipReviewStatus: "not_reviewed",
          ipReviewReason: null,
          ipReviewedByActorId: null,
          ipReviewedAt: null,
          attestationText: "attestation",
          attestationVersion: "v1",
          attestedByActorId: OWNER_ID,
          attestedAt: "2026-07-10T00:00:00.000Z",
          capturedAt: null,
        },
      }),
    });

    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(await screen.findByText(/Reference & IP review/i)).toBeInTheDocument();
    // Business Analyst / Coordinator does not have project:admin, so the mutating controls are hidden.
    expect(screen.queryByRole("button", { name: /Clear IP/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restrict IP/i })).not.toBeInTheDocument();
  });

  it("shows the source-not-found alert when the API returns 404", async () => {
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
      http.get("*/api/v1/projects/project-1/source-documents/source-1", () =>
        HttpResponse.json(
          {
            statusCode: 404,
            code: "NOT_FOUND",
            message: "Source missing",
            correlationId: "corr",
          },
          { status: 404 },
        ),
      ),
    );

    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(await screen.findByText(/Source not found/i)).toBeInTheDocument();
  });

  it("does not fetch a signed URL until the Download button is clicked", async () => {
    let signedUrlCalls = 0;
    useDetailHandlers();
    server.use(
      http.get(
        "*/api/v1/projects/project-1/source-documents/source-1/files/file-1/download-url",
        () => {
          signedUrlCalls += 1;
          return HttpResponse.json({
            url: "https://example.com/download/x",
            expiresAt: "2099-01-01T00:00:00.000Z",
          });
        },
      ),
    );
    const originalOpen = window.open;
    const openMock = vi.fn(() => ({}) as Window);
    window.open = openMock as unknown as typeof window.open;

    try {
      const view = renderWithProviders(
        <SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />,
        { initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}` },
      );

      const downloadBtn = await screen.findByRole("button", { name: /Download/i });
      // The signed URL must NOT be fetched during render.
      expect(signedUrlCalls).toBe(0);
      expect(openMock).not.toHaveBeenCalled();

      await view.user.click(downloadBtn);
      await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
      expect(signedUrlCalls).toBe(1);
      expect(openMock).toHaveBeenCalledWith(
        "https://example.com/download/x",
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      window.open = originalOpen;
    }
  });

  it("hides Edit metadata and New version affordances for archived sources", async () => {
    useDetailHandlers({
      source: makeSourceDetail({ isArchived: true, processingStatus: "ready" }),
      orgRole: "admin",
      role: "Business Analyst / Coordinator",
    });
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(
      await screen.findByRole("heading", { name: "Initial requirements pack" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit metadata/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New version/i })).not.toBeInTheDocument();
  });

  it("hides New version affordance on a superseded (non-head) version", async () => {
    const older = makeSourceDetail({ id: "source-1", versionNumber: 1 });
    const newer = makeSourceDetail({
      id: "source-2",
      versionNumber: 2,
      title: "Newer",
    });
    useDetailHandlers({
      source: older,
      versions: makeSourceVersionList([older, newer]),
      role: "Business Analyst / Coordinator",
    });
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(
      await screen.findByRole("heading", { name: /Initial requirements pack/i }),
    ).toBeInTheDocument();
    // Version 1 is not the head; the version-creation CTA must be hidden.
    expect(screen.queryByRole("button", { name: /New version/i })).not.toBeInTheDocument();
  });

  it("renders version rows as navigable links to the version's own detail route", async () => {
    const v1 = makeSourceDetail({ id: "source-1", versionNumber: 1, title: "V1 pack" });
    const v2 = makeSourceDetail({ id: "source-2", versionNumber: 2, title: "V2 pack" });
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
      atlasHandlers.source(PROJECT_ID, "source-2", v2),
      atlasHandlers.sourceVersions(PROJECT_ID, "source-2", makeSourceVersionList([v1, v2])),
      atlasHandlers.sourceExtractions(PROJECT_ID, "source-2", makeExtractionList()),
      atlasHandlers.sourceChunks(PROJECT_ID, "source-2", makeChunkList()),
      http.get(
        "*/api/v1/projects/:projectId/source-documents/:sourceId/files/:fileId/preview-url",
        () =>
          HttpResponse.json({
            url: "https://storage.example.test/preview",
            expiresAt: "2026-07-10T00:10:00.000Z",
          }),
      ),
    );
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId="source-2" />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/source-2`,
    });

    // The current version's title is bold text; older versions render as links
    // to their own detail routes.
    expect(await screen.findByRole("heading", { name: /V2 pack/i })).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: /V1 pack/i });
    expect(link).toHaveAttribute("href", "/projects/project-1/source-documents/source-1");
  });

  // Server-authoritative capabilities gating on the detail page. We assert
  // that a) the capability Alert renders when writes are disabled, and
  // b) every mutating affordance is hidden — even for an org admin.
  it("hides all write affordances and shows a capability notice when writes are disabled", async () => {
    useDetailHandlers({
      orgRole: "admin",
      role: "Business Analyst / Coordinator",
      source: makeSourceDetail({ processingStatus: "failed" }),
      capabilities: makeSourceVaultCapabilities({ writesEnabled: false }),
    });
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "admin", id: OWNER_ID })),
    );

    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(
      await screen.findByRole("heading", { name: "Initial requirements pack" }),
    ).toBeInTheDocument();
    // The capability-notice Alert renders.
    expect(
      await screen.findByText(/write operations are disabled for this workspace/i),
    ).toBeInTheDocument();
    // Every mutating affordance is hidden regardless of role/state.
    expect(screen.queryByRole("button", { name: /Edit metadata/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New version/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Archive source/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry processing/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Request fresh capture/i }),
    ).not.toBeInTheDocument();
    // Reads remain: the Download affordance is unaffected.
    expect(screen.getByRole("button", { name: /Download/i })).toBeEnabled();
  });

  it("hides Request fresh capture on a reference when single-page capture is disabled", async () => {
    const reference = makeSourceDetail({
      sourceType: "reference",
      documentFormat: null,
      files: [],
    });
    useDetailHandlers({
      source: reference,
      versions: makeSourceVersionList([reference]),
      role: "Business Analyst / Coordinator",
      capabilities: makeSourceVaultCapabilities({ singlePageCaptureEnabled: false }),
    });

    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(
      await screen.findByRole("heading", { name: "Initial requirements pack" }),
    ).toBeInTheDocument();
    // Capture flag off → the CTA must not exist at all.
    expect(
      screen.queryByRole("button", { name: /Request fresh capture/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New version/i })).not.toBeInTheDocument();
  });

  it("opens the Edit metadata dialog and submits the update mutation", async () => {
    let patched: Record<string, unknown> | null = null;
    useDetailHandlers({
      role: "Business Analyst / Coordinator",
    });
    server.use(
      http.patch(
        "*/api/v1/projects/project-1/source-documents/source-1/metadata",
        async ({ request }) => {
          patched = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(makeSourceDetail({ title: "Updated title" }));
        },
      ),
    );

    const view = renderWithProviders(
      <SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />,
      { initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}` },
    );

    await view.user.click(await screen.findByRole("button", { name: /Edit metadata/i }));
    const titleInput = await screen.findByLabelText("Title");
    await view.user.clear(titleInput);
    await view.user.type(titleInput, "Updated title");
    await view.user.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched).toMatchObject({ title: "Updated title", version: 1 });
  });

  // Regression coverage for the FilesCard download-gating bug: files whose
  // scanStatus is "not_required" (manual text sources, URL/manual reference
  // snapshots, reference captures) are downloadable even though they were
  // never queued for a virus scan, just like "clean" files. Only "infected"
  // and "failed" should be blocked, and "pending"/"scanning" should show the
  // scan-in-progress copy.
  it("shows a working Download affordance for a file with scanStatus not_required", async () => {
    useDetailHandlers({
      source: makeSourceDetail({
        files: [
          {
            id: "file-1",
            ordinal: 0,
            role: "primary",
            originalFileName: "manual-note.txt",
            downloadFileName: "manual-note.txt",
            format: "txt",
            declaredMimeType: "text/plain",
            byteSize: 42,
            sha256: "abcdef1234567890",
            scanStatus: "not_required",
            scannedAt: null,
          },
        ],
      }),
    });
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(await screen.findByRole("button", { name: /Download/i })).toBeEnabled();
    expect(screen.queryByText(/Download available after scan/i)).not.toBeInTheDocument();
  });

  it("still shows a working Download affordance for a file with scanStatus clean", async () => {
    useDetailHandlers({
      source: makeSourceDetail({
        files: [
          {
            id: "file-1",
            ordinal: 0,
            role: "primary",
            originalFileName: "requirements.pdf",
            downloadFileName: "requirements.pdf",
            format: "pdf",
            declaredMimeType: "application/pdf",
            byteSize: 12345,
            sha256: "abcdef1234567890",
            scanStatus: "clean",
            scannedAt: "2026-07-10T00:00:00.000Z",
          },
        ],
      }),
    });
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(await screen.findByRole("button", { name: /Download/i })).toBeEnabled();
    expect(screen.queryByText(/Download available after scan/i)).not.toBeInTheDocument();
  });

  it("shows scan-pending copy and no Download button for a file with scanStatus pending", async () => {
    useDetailHandlers({
      source: makeSourceDetail({
        files: [
          {
            id: "file-1",
            ordinal: 0,
            role: "primary",
            originalFileName: "requirements.pdf",
            downloadFileName: "requirements.pdf",
            format: "pdf",
            declaredMimeType: "application/pdf",
            byteSize: 12345,
            sha256: "abcdef1234567890",
            scanStatus: "pending",
            scannedAt: null,
          },
        ],
      }),
    });
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(await screen.findByText(/Download available after scan/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/i })).not.toBeInTheDocument();
  });

  it("shows Unavailable and no Download button for a file with scanStatus infected", async () => {
    useDetailHandlers({
      source: makeSourceDetail({
        files: [
          {
            id: "file-1",
            ordinal: 0,
            role: "primary",
            originalFileName: "requirements.pdf",
            downloadFileName: "requirements.pdf",
            format: "pdf",
            declaredMimeType: "application/pdf",
            byteSize: 12345,
            sha256: "abcdef1234567890",
            scanStatus: "infected",
            scannedAt: "2026-07-10T00:00:00.000Z",
          },
        ],
      }),
    });
    renderWithProviders(<SourceDetailPage projectId={PROJECT_ID} sourceId={SOURCE_ID} />, {
      initialEntry: `/projects/${PROJECT_ID}/source-documents/${SOURCE_ID}`,
    });

    expect(await screen.findByText(/^Unavailable$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/i })).not.toBeInTheDocument();
  });
});
