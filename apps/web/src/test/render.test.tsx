import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient, renderWithProviders } from "./render";

function QueryClientProbe() {
  const queryClient = useQueryClient();
  return (
    <output aria-label="query client">{String(queryClient.getQueryData(["probe"]) ?? "")}</output>
  );
}

describe("component render harness", () => {
  it("creates a fresh retry-free QueryClient for each render", async () => {
    const firstClient = createTestQueryClient();
    firstClient.setQueryData(["probe"], "first");
    const first = renderWithProviders(<QueryClientProbe />, { queryClient: firstClient });
    expect(await screen.findByRole("status", { name: "query client" })).toHaveTextContent("first");
    first.unmount();

    const second = renderWithProviders(<QueryClientProbe />);
    expect(second.queryClient).not.toBe(first.queryClient);
    expect(second.queryClient.getDefaultOptions().queries?.retry).toBe(false);
    expect(await screen.findByRole("status", { name: "query client" })).toHaveTextContent("");
  });

  it("provides memory history and real TanStack Router navigation", async () => {
    const view = renderWithProviders(<Link to="/projects">Open projects</Link>);

    await view.user.click(await screen.findByRole("link", { name: "Open projects" }));

    expect(view.router.state.location.pathname).toBe("/projects");
  });
});
