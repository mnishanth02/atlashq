import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeOrganization } from "@/test/fixtures";
import { atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { AppShell } from "./app-shell";

const authMocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: authMocks.signOut,
  useSession: authMocks.useSession,
}));

const server = createMswServer();
setupMswServer(server);

describe("authenticated shell", () => {
  beforeEach(() => {
    authMocks.signOut.mockReset();
    authMocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          name: "Morgan Admin",
          email: "morgan@example.com",
          image: null,
          organizationId: "org-1",
          organizationRole: "admin",
          status: "active",
        },
        session: {
          id: "session-1",
          expiresAt: new Date("2026-07-11T00:00:00.000Z"),
        },
      },
    });
  });

  it("shows real organization context, role, sign-out, and theme controls", async () => {
    server.use(atlasHandlers.currentOrganization(makeOrganization()));
    const view = renderWithProviders(<AppShell />, { initialEntry: "/projects" });

    expect(
      await screen.findByText("Northstar Consulting", undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();

    await view.user.click(screen.getByRole("button", { name: /Morgan Admin/ }));
    expect(await screen.findByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
    await view.user.keyboard("{Escape}");

    await view.user.click(screen.getByRole("button", { name: "Change theme" }));
    await view.user.click(await screen.findByRole("menuitem", { name: "Dark" }));

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(window.localStorage.getItem("atlashq-theme")).toBe("dark");
  }, 15_000);
});
