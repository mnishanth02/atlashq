import type { ProjectsListQuery } from "@atlashq/api-client";
import type { ProjectPriority, ProjectSort, ProjectStatus, ProjectType } from "@atlashq/types";

/** The "any value" sentinel used by the toolbar selects (Radix rejects ""). */
export const ALL_FILTER_VALUE = "all";

/**
 * Local, preserved portfolio filter state. `search` is deliberately kept
 * separate (see the route component) so it can flow through `useDeferredValue`
 * without duplicating the rest of the filter state.
 */
export type PortfolioFilters = {
  type: ProjectType | typeof ALL_FILTER_VALUE;
  status: ProjectStatus | typeof ALL_FILTER_VALUE;
  priority: ProjectPriority | typeof ALL_FILTER_VALUE;
  includeArchived: boolean;
  sort: ProjectSort;
};

export const DEFAULT_PORTFOLIO_FILTERS: PortfolioFilters = {
  type: ALL_FILTER_VALUE,
  status: ALL_FILTER_VALUE,
  priority: ALL_FILTER_VALUE,
  includeArchived: false,
  sort: "updated_desc",
};

type FilterOption<T extends string> = { value: T; label: string };

export const PROJECT_TYPE_FILTER_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "All types" },
  { value: "client", label: "Client" },
  { value: "internal", label: "Internal" },
] as const satisfies ReadonlyArray<FilterOption<PortfolioFilters["type"]>>;

export const PROJECT_STATUS_FILTER_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
] as const satisfies ReadonlyArray<FilterOption<PortfolioFilters["status"]>>;

export const PROJECT_PRIORITY_FILTER_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const satisfies ReadonlyArray<FilterOption<PortfolioFilters["priority"]>>;

export const PROJECT_SORT_OPTIONS = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "updated_asc", label: "Least recently updated" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
] as const satisfies ReadonlyArray<FilterOption<PortfolioFilters["sort"]>>;

/**
 * Build the typed `ProjectsListQuery` sent to `useInfiniteProjectsQuery`. Sentinel
 * (`all`) filters are dropped, blank search is dropped, and `includeArchived`
 * is only sent when enabled — so the query key stays stable and minimal.
 */
export function buildProjectsListQuery(
  filters: PortfolioFilters,
  searchTerm: string,
): ProjectsListQuery {
  const query: ProjectsListQuery = { sort: filters.sort };

  const trimmedSearch = searchTerm.trim();
  if (trimmedSearch !== "") {
    query.search = trimmedSearch;
  }
  if (filters.type !== ALL_FILTER_VALUE) {
    query.type = filters.type;
  }
  if (filters.status !== ALL_FILTER_VALUE) {
    query.status = filters.status;
  }
  if (filters.priority !== ALL_FILTER_VALUE) {
    query.priority = filters.priority;
  }
  if (filters.includeArchived) {
    query.includeArchived = true;
  }

  return query;
}

/** Whether any filter or search term is narrowing the list (drives empty vs. no-results). */
export function hasActivePortfolioFilters(filters: PortfolioFilters, searchTerm: string): boolean {
  return (
    searchTerm.trim() !== "" ||
    filters.type !== ALL_FILTER_VALUE ||
    filters.status !== ALL_FILTER_VALUE ||
    filters.priority !== ALL_FILTER_VALUE ||
    filters.includeArchived ||
    filters.sort !== DEFAULT_PORTFOLIO_FILTERS.sort
  );
}
