"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { mergeProjectPages, useCurrentUserQuery, useInfiniteProjectsQuery } from "@/features/api";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "../forms";
import { CreateProjectAction } from "./create-project-dialog";
import {
  buildProjectsListQuery,
  DEFAULT_PORTFOLIO_FILTERS,
  hasActivePortfolioFilters,
  type PortfolioFilters,
} from "./portfolio-filter-model";
import {
  ProjectsEmpty,
  ProjectsError,
  ProjectsLoading,
  ProjectsLoadMoreError,
} from "./portfolio-states";
import { PortfolioToolbar } from "./portfolio-toolbar";
import { ProjectCards } from "./project-cards";
import { isOrganizationAdmin, resolveProjectCreatePermission } from "./project-permissions";
import { ProjectsTable } from "./projects-table";

/**
 * Projects portfolio route content: cursor-paginated list with
 * search, filters, archived toggle, deterministic loading/error/empty states,
 * and a permission-aware create action. Search flows through `useDeferredValue`
 * so typing stays responsive and the rest of the filter state isn't duplicated.
 */
export function ProjectsPortfolio() {
  const [filters, setFilters] = useState<PortfolioFilters>(DEFAULT_PORTFOLIO_FILTERS);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const query = useMemo(
    () => buildProjectsListQuery(filters, deferredSearch),
    [filters, deferredSearch],
  );
  const projectsQuery = useInfiniteProjectsQuery(query);
  const userQuery = useCurrentUserQuery();

  const user = userQuery.data?.user;
  const permission = resolveProjectCreatePermission(user);
  const currentUser = user ? { id: user.id, name: user.name } : undefined;
  const canManageClients = isOrganizationAdmin(user);

  const projects = useMemo(() => mergeProjectPages(projectsQuery.data), [projectsQuery.data]);
  const totalProjects = projectsQuery.data?.pages[0]?.pageInfo.total;
  const projectCountForLabel = totalProjects ?? projects.length;
  const now = new Date();
  const isStale = search !== deferredSearch || projectsQuery.isPlaceholderData;
  const activeFilters = hasActivePortfolioFilters(filters, deferredSearch);

  function handleFilterChange<K extends keyof PortfolioFilters>(
    key: K,
    value: PortfolioFilters[K],
  ) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function handleReset() {
    setFilters(DEFAULT_PORTFOLIO_FILTERS);
    setSearch("");
  }

  let content: React.ReactNode;
  if (projectsQuery.isPending) {
    content = <ProjectsLoading />;
  } else if (projectsQuery.isError && projects.length === 0) {
    content = (
      <ProjectsError
        message={getApiErrorMessage(projectsQuery.error)}
        onRetry={() => {
          void projectsQuery.refetch();
        }}
      />
    );
  } else if (projects.length === 0) {
    content = (
      <ProjectsEmpty
        hasFilters={activeFilters}
        onResetFilters={handleReset}
        action={
          permission.canCreate ? (
            <CreateProjectAction
              permission={permission}
              currentUser={currentUser}
              canManageClients={canManageClients}
            />
          ) : null
        }
      />
    );
  } else {
    content = (
      <div
        className={cn("flex flex-col gap-4 transition-opacity", isStale && "opacity-60")}
        aria-busy={isStale || projectsQuery.isFetchingNextPage}
      >
        <p className="text-sm text-muted-foreground">
          Showing {projects.length}
          {totalProjects === undefined ? "" : ` of ${totalProjects}`}{" "}
          {projectCountForLabel === 1 ? "project" : "projects"}
        </p>
        {projectsQuery.isFetchNextPageError ? (
          <ProjectsLoadMoreError
            message={getApiErrorMessage(projectsQuery.error)}
            onRetry={() => {
              void projectsQuery.fetchNextPage();
            }}
          />
        ) : null}
        <div className="hidden md:block">
          <ProjectsTable projects={projects} now={now} />
        </div>
        <div className="md:hidden">
          <ProjectCards projects={projects} now={now} />
        </div>
        {projectsQuery.hasNextPage && !projectsQuery.isPlaceholderData ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={projectsQuery.isFetchingNextPage}
              onClick={() => {
                void projectsQuery.fetchNextPage();
              }}
            >
              {projectsQuery.isFetchingNextPage ? <Spinner data-icon="inline-start" /> : null}
              {projectsQuery.isFetchingNextPage ? "Loading more…" : "Load more projects"}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            The delivery portfolio across your organization.
          </p>
        </div>
        <CreateProjectAction
          permission={permission}
          currentUser={currentUser}
          canManageClients={canManageClients}
        />
      </header>

      <PortfolioToolbar
        filters={filters}
        search={search}
        hasActiveFilters={activeFilters}
        onSearchChange={setSearch}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {content}
    </div>
  );
}
