import { screen, waitFor } from "@testing-library/react";
import { delay, HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { makeCurrentUser, makeProject, makeProjectListResponse } from "@/test/fixtures";
import { apiError, atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { ProjectsPortfolio } from "./projects-portfolio";

const server = createMswServer();
setupMswServer(server);

function usePortfolioHandlers({
  role = "member",
  projects = makeProjectListResponse(),
}: {
  role?: "admin" | "member";
  projects?: ReturnType<typeof makeProjectListResponse>;
} = {}) {
  server.use(
    atlasHandlers.currentUser(makeCurrentUser({ organizationRole: role })),
    atlasHandlers.projects(projects),
    ...(role === "admin" ? [atlasHandlers.clients(), atlasHandlers.organizationUsers()] : []),
  );
}

describe("ProjectsPortfolio", () => {
  it("shows a deterministic loading skeleton while the portfolio request is pending", async () => {
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      http.get("*/api/v1/projects", async () => {
        await delay(100);
        return HttpResponse.json(makeProjectListResponse());
      }),
    );

    renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });

    expect(await screen.findByRole("status", { name: "Loading projects" })).toBeInTheDocument();
    expect(await screen.findAllByRole("link", { name: "Atlas rollout" })).toHaveLength(1);
  }, 15_000);

  it("renders real project rows, cards, status, and the admin create action", async () => {
    usePortfolioHandlers({ role: "admin" });
    renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });

    expect(await screen.findAllByRole("link", { name: "Atlas rollout" })).toHaveLength(1);
    expect(screen.getByRole("row", { name: /Atlas rollout.*Active.*Morgan Admin/i })).toBeVisible();
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "New project" })).toBeEnabled();
  });

  it("shows explicit read-only copy to non-admin organization members", async () => {
    usePortfolioHandlers();
    renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });

    expect(
      await screen.findByText(
        "Only organization admins can create projects. Ask an admin to add one.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
  });

  it("shows an API error and retries the real query", async () => {
    let attempts = 0;
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      http.get("*/api/v1/projects", () => {
        attempts += 1;
        return attempts === 1
          ? apiError(500, "Portfolio unavailable")
          : HttpResponse.json(makeProjectListResponse());
      }),
    );
    const view = renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });

    expect(await screen.findByText("Portfolio unavailable")).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findAllByRole("link", { name: "Atlas rollout" })).toHaveLength(1);
    expect(attempts).toBe(2);
  });

  it("distinguishes a genuinely empty portfolio from filtered-empty results", async () => {
    usePortfolioHandlers({ projects: makeProjectListResponse([]) });
    const empty = renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    empty.unmount();

    server.resetHandlers();
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      http.get("*/api/v1/projects", ({ request }) => {
        const search = new URL(request.url).searchParams.get("search");
        return HttpResponse.json(
          search ? makeProjectListResponse([]) : makeProjectListResponse([makeProject()]),
        );
      }),
    );
    const filtered = renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });
    await screen.findAllByRole("link", { name: "Atlas rollout" });
    await filtered.user.type(screen.getByLabelText("Search projects"), "missing");

    expect(await screen.findByText("No matching projects")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear filters" })).toHaveLength(2);
  });

  it("sends search and filter state through the projects query", async () => {
    const requests: URL[] = [];
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      http.get("*/api/v1/projects", ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(makeProjectListResponse());
      }),
    );
    const view = renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });
    await screen.findAllByRole("link", { name: "Atlas rollout" });

    await view.user.type(screen.getByLabelText("Search projects"), "Northwind");
    await view.user.click(screen.getByRole("switch", { name: "Include archived" }));

    await waitFor(() => {
      expect(
        requests.some(
          (url) =>
            url.searchParams.get("search") === "Northwind" &&
            url.searchParams.get("includeArchived") === "true",
        ),
      ).toBe(true);
    });
  });

  it("requests explicit archived status and preserves accessible sort selection", async () => {
    const requests: URL[] = [];
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      http.get("*/api/v1/projects", ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(makeProjectListResponse());
      }),
    );
    const view = renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });
    await screen.findAllByRole("link", { name: "Atlas rollout" });

    await view.user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await view.user.click(await screen.findByRole("option", { name: "Archived" }));
    await view.user.click(screen.getByRole("combobox", { name: "Sort projects" }));
    await view.user.click(await screen.findByRole("option", { name: "Name A–Z" }));

    await waitFor(() => {
      expect(
        requests.some(
          (url) =>
            url.searchParams.get("status") === "archived" &&
            url.searchParams.get("sort") === "name_asc" &&
            !url.searchParams.has("includeArchived"),
        ),
      ).toBe(true);
    });
  });

  it("appends the next cursor page when Load more is activated", async () => {
    const cursors: Array<string | null> = [];
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member" })),
      http.get("*/api/v1/projects", ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        if (cursor === "next-2") {
          return HttpResponse.json(
            makeProjectListResponse([makeProject({ id: "project-2", name: "Second engagement" })], {
              total: 2,
            }),
          );
        }
        return HttpResponse.json(
          makeProjectListResponse([makeProject()], {
            nextCursor: "next-2",
            hasMore: true,
            total: 2,
          }),
        );
      }),
    );
    const view = renderWithProviders(<ProjectsPortfolio />, { initialEntry: "/projects" });
    await screen.findAllByRole("link", { name: "Atlas rollout" });

    await view.user.click(screen.getByRole("button", { name: "Load more projects" }));

    expect(await screen.findAllByRole("link", { name: "Second engagement" })).toHaveLength(1);
    expect(cursors.filter((cursor) => cursor === "next-2")).toHaveLength(1);
  });
});
