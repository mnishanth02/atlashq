import { describe, expect, it } from "vitest";
import {
  buildProjectsListQuery,
  DEFAULT_PORTFOLIO_FILTERS,
  hasActivePortfolioFilters,
  type PortfolioFilters,
} from "./portfolio-filter-model";

function filters(overrides: Partial<PortfolioFilters> = {}): PortfolioFilters {
  return { ...DEFAULT_PORTFOLIO_FILTERS, ...overrides };
}

describe("buildProjectsListQuery", () => {
  it("produces the default sort query for defaults and blank search", () => {
    expect(buildProjectsListQuery(filters(), "   ")).toEqual({ sort: "updated_desc" });
  });

  it("drops sentinel filters and keeps concrete ones", () => {
    expect(
      buildProjectsListQuery(
        filters({ type: "client", status: "active", priority: "high" }),
        "atlas",
      ),
    ).toEqual({
      search: "atlas",
      type: "client",
      status: "active",
      priority: "high",
      sort: "updated_desc",
    });
  });

  it("only includes archived when enabled and trims search", () => {
    expect(buildProjectsListQuery(filters({ includeArchived: true }), "  north ")).toEqual({
      search: "north",
      includeArchived: true,
      sort: "updated_desc",
    });
    expect("includeArchived" in buildProjectsListQuery(filters(), "")).toBe(false);
  });

  it("sends archived status without requiring the include-archived toggle", () => {
    expect(buildProjectsListQuery(filters({ status: "archived" }), "")).toEqual({
      status: "archived",
      sort: "updated_desc",
    });
  });

  it("preserves the selected sort in the typed query", () => {
    expect(buildProjectsListQuery(filters({ sort: "name_asc" }), "")).toEqual({
      sort: "name_asc",
    });
  });
});

describe("hasActivePortfolioFilters", () => {
  it("is false for defaults and blank search", () => {
    expect(hasActivePortfolioFilters(filters(), "  ")).toBe(false);
  });

  it("is true when any filter or search narrows the list", () => {
    expect(hasActivePortfolioFilters(filters(), "atlas")).toBe(true);
    expect(hasActivePortfolioFilters(filters({ type: "internal" }), "")).toBe(true);
    expect(hasActivePortfolioFilters(filters({ includeArchived: true }), "")).toBe(true);
    expect(hasActivePortfolioFilters(filters({ sort: "name_desc" }), "")).toBe(true);
  });
});
