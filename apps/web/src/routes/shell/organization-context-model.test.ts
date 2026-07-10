import { describe, expect, it } from "vitest";
import { getOrganizationContextPresentation } from "./organization-context-model";

describe("getOrganizationContextPresentation", () => {
  it("presents the current organization name, plan, and role", () => {
    expect(
      getOrganizationContextPresentation({
        organization: { id: "org-1", name: "Atlas Labs", plan: "team", role: "admin" },
        isPending: false,
        isError: false,
      }),
    ).toEqual({
      name: "Atlas Labs",
      plan: "Team",
      role: "Admin",
      state: "ready",
    });
  });

  it("returns compact loading and error fallbacks", () => {
    expect(
      getOrganizationContextPresentation({
        organization: undefined,
        isPending: true,
        isError: false,
      }),
    ).toMatchObject({ name: "Loading organization…", state: "loading" });

    expect(
      getOrganizationContextPresentation({
        organization: undefined,
        isPending: false,
        isError: true,
      }),
    ).toEqual({
      name: "Organization unavailable",
      plan: "Couldn’t load context",
      role: null,
      state: "error",
    });
  });
});
