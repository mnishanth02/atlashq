import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { LoginRoute } from "./login-route";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInEmail: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  getSession: authMocks.getSession,
  signIn: { email: authMocks.signInEmail },
}));

async function completeCredentials(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.type(await screen.findByLabelText("Email"), "morgan@example.com");
  await user.type(screen.getByLabelText("Password"), "correct horse");
}

describe("LoginRoute", () => {
  beforeEach(() => {
    authMocks.getSession.mockReset();
    authMocks.signInEmail.mockReset();
    authMocks.signInEmail.mockResolvedValue({ data: {}, error: null });
  });

  it("renders the provisioned-account form with accessible labels", async () => {
    renderWithProviders(<LoginRoute />, { initialEntry: "/login" });

    expect(await screen.findByRole("heading", { name: "Sign in to AtlasHQ" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(
      screen.getByText("Accounts are provisioned by your organization administrator."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();
  });

  it("shows client validation for an invalid email and missing password", async () => {
    const view = renderWithProviders(<LoginRoute />, { initialEntry: "/login" });
    await view.user.type(await screen.findByLabelText("Email"), "not-an-email");
    await view.user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(authMocks.signInEmail).not.toHaveBeenCalled();
  });

  it("disables the form and exposes pending submission state", async () => {
    let resolveSignIn: ((value: { data: object; error: null }) => void) | undefined;
    authMocks.signInEmail.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    const view = renderWithProviders(<LoginRoute />, { initialEntry: "/login" });
    await completeCredentials(view.user);
    await view.user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(authMocks.signInEmail).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();

    resolveSignIn?.({ data: {}, error: null });
  });

  it("shows a generic invalid-credentials error returned by the server", async () => {
    authMocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "User not found" },
    });
    const view = renderWithProviders(<LoginRoute />, { initialEntry: "/login" });
    await completeCredentials(view.user);
    await view.user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password. Please try again.",
    );
    expect(screen.queryByText("User not found")).not.toBeInTheDocument();
  });

  it("redirects a successful sign-in to a sanitized internal target", async () => {
    const view = renderWithProviders(<LoginRoute />, {
      initialEntry: "/login?redirect=%2Fprojects%2Fproject-1",
    });
    await completeCredentials(view.user);
    await view.user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(view.router.state.location.pathname).toBe("/projects/project-1"));
  });

  it("rejects an external redirect target and falls back to the portfolio", async () => {
    const view = renderWithProviders(<LoginRoute />, {
      initialEntry: "/login?redirect=https%3A%2F%2Fevil.example%2Fsteal",
    });
    await completeCredentials(view.user);
    await view.user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(view.router.state.location.pathname).toBe("/projects"));
  });
});
