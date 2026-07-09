import { describe, expect, it } from "vitest";
import { queryClient } from "./query-client";

describe("queryClient", () => {
  it("uses placeholder defaults suitable for the SPA shell", () => {
    const defaults = queryClient.getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(60_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });
});
