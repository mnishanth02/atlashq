import { screen } from "@testing-library/react";
import { delay, HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeCurrentUser,
  makeDashboard,
  makeMembership,
  makeMembershipList,
  makeProject,
} from "@/test/fixtures";
import { apiError, atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { ProjectDetailPage } from "./project-detail-page";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: authMocks.useSession,
}));

const server = createMswServer();
setupMswServer(server);

function useDetailHandlers({
  project = makeProject(),
  user = makeCurrentUser({ organizationRole: "member" }),
  membership = makeMembership(),
}: {
  project?: ReturnType<typeof makeProject>;
  user?: ReturnType<typeof makeCurrentUser>;
  membership?: ReturnType<typeof makeMembership>;
} = {}) {
  server.use(
    atlasHandlers.currentUser(user),
    atlasHandlers.project(project.id, project),
    atlasHandlers.dashboard(project.id, makeDashboard(project)),
    atlasHandlers.memberships(project.id, makeMembershipList([membership])),
    atlasHandlers.clients(),
    atlasHandlers.organizationUsers(),
  );
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    authMocks.useSession.mockReturnValue({ data: undefined });
  });

  it("shows an accessible project loading state independently of dashboard data", async () => {
    const project = makeProject();
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      http.get("*/api/v1/projects/project-1", async () => {
        await delay(100);
        return HttpResponse.json(project);
      }),
      atlasHandlers.dashboard(project.id, makeDashboard(project)),
      atlasHandlers.memberships(project.id, makeMembershipList([makeMembership()])),
    );

    renderWithProviders(<ProjectDetailPage projectId="project-1" />, {
      initialEntry: "/projects/project-1",
    });

    expect(
      await screen.findByRole("status", { name: "Loading project workspace" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Atlas rollout")).toBeInTheDocument();
  });

  it("keeps the loaded project visible while dashboard readiness loads and errors", async () => {
    const project = makeProject();
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      atlasHandlers.project(project.id, project),
      http.get("*/api/v1/projects/project-1/dashboard", async () => {
        await delay(80);
        return apiError(500, "Dashboard service unavailable");
      }),
      atlasHandlers.memberships(project.id, makeMembershipList([makeMembership()])),
    );

    renderWithProviders(<ProjectDetailPage projectId="project-1" />, {
      initialEntry: "/projects/project-1",
    });

    expect(await screen.findByText("Atlas rollout")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading dashboard readiness" })).toBeInTheDocument();
    expect(await screen.findByText(/Dashboard service unavailable/)).toBeInTheDocument();
    expect(screen.getByText("Atlas rollout")).toBeInTheDocument();
  });

  it("presents zero and not-started readiness honestly without fake analysis", async () => {
    useDetailHandlers();
    renderWithProviders(<ProjectDetailPage projectId="project-1" />, {
      initialEntry: "/projects/project-1",
    });

    expect(await screen.findByText("Readiness cards stay honest.")).toBeInTheDocument();
    expect(screen.getByText(/Counts and states remain zero or not started/)).toBeInTheDocument();
    expect(screen.getByText("Zero recorded")).toBeInTheDocument();
    expect(screen.getAllByText("Not started").length).toBeGreaterThan(0);
    expect(screen.getByText("Setup required")).toBeInTheDocument();
    expect(screen.queryByText(/analysis complete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI-generated/i)).not.toBeInTheDocument();
  });

  it("lets an archived Project Owner restore but not edit or archive", async () => {
    const viewerId = "11111111-1111-4111-8111-111111111111";
    const project = makeProject({ status: "archived" });
    useDetailHandlers({
      project,
      user: makeCurrentUser({ id: viewerId, organizationRole: "member" }),
      membership: makeMembership({
        userId: viewerId,
        role: "Project Owner",
        user: { id: viewerId, name: "Morgan Owner", email: "morgan@example.com" },
      }),
    });
    renderWithProviders(<ProjectDetailPage projectId="project-1" />, {
      initialEntry: "/projects/project-1",
    });

    expect(
      await screen.findByRole("button", { name: "Restore project" }, { timeout: 10_000 }),
    ).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Edit project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  }, 15_000);

  it("lets a Developer edit metadata but hides project-admin controls", async () => {
    const viewerId = "11111111-1111-4111-8111-111111111111";
    useDetailHandlers({
      membership: makeMembership({
        userId: viewerId,
        role: "Developer",
        user: { id: viewerId, name: "Morgan Developer", email: "morgan@example.com" },
      }),
    });
    const view = renderWithProviders(<ProjectDetailPage projectId="project-1" />, {
      initialEntry: "/projects/project-1",
    });

    expect(
      await screen.findByText(/Developer · project metadata editing is enabled/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit project" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore project" })).not.toBeInTheDocument();

    await view.user.click(screen.getByRole("tab", { name: "Members" }));
    expect(await screen.findByText("Memberships are read-only.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add member" })).not.toBeInTheDocument();
  });

  it.each([
    [403, "Access denied", "Your account can’t open this project workspace."],
    [404, "Project not found", "The requested project could not be found."],
  ])("renders the %i route state", async (status, title, description) => {
    const project = makeProject();
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      http.get("*/api/v1/projects/project-1", () => apiError(status, title)),
      atlasHandlers.dashboard(project.id, makeDashboard(project)),
      atlasHandlers.memberships(project.id, makeMembershipList([makeMembership()])),
    );
    renderWithProviders(<ProjectDetailPage projectId="project-1" />, {
      initialEntry: "/projects/project-1",
    });

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(description))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to projects" })).toBeInTheDocument();
  });
});
