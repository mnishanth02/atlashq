import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth-client";
import { queryClient } from "@/state/query-client";
import { renderWithProviders } from "@/test/render";
import { UserMenu } from "./user-menu";

const authMocks = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("@/lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-client")>("@/lib/auth-client");
  return {
    ...actual,
    signOut: authMocks.signOut,
  };
});

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner");
  return {
    ...actual,
    toast: Object.assign(() => "", actual.toast, { error: toastMocks.error }),
  };
});

const USER: AuthUser = {
  id: "user-1",
  createdAt: new Date("2026-07-10T00:00:00.000Z"),
  updatedAt: new Date("2026-07-10T00:00:00.000Z"),
  name: "Morgan Admin",
  email: "morgan@example.com",
  emailVerified: true,
  image: null,
  organizationId: "org-1",
  organizationRole: "admin",
  status: "active",
};

describe("UserMenu sign-out", () => {
  beforeEach(() => {
    authMocks.signOut.mockReset();
    toastMocks.error.mockReset();
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it("navigates to login and clears cached queries after a confirmed sign-out", async () => {
    authMocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
    const clearSpy = vi.spyOn(queryClient, "clear");

    const view = renderWithProviders(<UserMenu user={USER} />, { initialEntry: "/projects" });

    await view.user.click(await screen.findByRole("button", { name: /Morgan Admin/i }));
    await view.user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(view.history.location.pathname).toBe("/login"));
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("keeps the authenticated shell mounted when Better Auth returns an error payload", async () => {
    authMocks.signOut.mockResolvedValue({
      data: null,
      error: { message: "boom", status: 500, statusText: "Internal Server Error" },
    });
    const clearSpy = vi.spyOn(queryClient, "clear");

    const view = renderWithProviders(<UserMenu user={USER} />, { initialEntry: "/projects" });

    await view.user.click(await screen.findByRole("button", { name: /Morgan Admin/i }));
    await view.user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledTimes(1));
    expect(view.history.location.pathname).toBe("/projects");
    expect(clearSpy).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith("Couldn't sign out. Please try again.");
  });

  it("keeps the authenticated shell mounted when sign-out throws", async () => {
    authMocks.signOut.mockRejectedValue(new Error("network"));
    const clearSpy = vi.spyOn(queryClient, "clear");

    const view = renderWithProviders(<UserMenu user={USER} />, { initialEntry: "/projects" });

    await view.user.click(await screen.findByRole("button", { name: /Morgan Admin/i }));
    await view.user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledTimes(1));
    expect(view.history.location.pathname).toBe("/projects");
    expect(clearSpy).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith("Couldn't sign out. Please try again.");
  });
});
