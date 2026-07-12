"use client";

import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, InfoIcon, LockIcon, PlayIcon } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AtlasApiError } from "@/features/api";
import type { RequirementAnalysisSearch } from "@/routes/projects/requirement-analysis-search";
import { ANALYSIS_ERROR_CODES } from "./requirement-analysis-api";
import {
  useAnalysisRunListInfiniteQuery,
  useRequirementAnalysisCapabilities,
  useRequirementAnalysisEligibleSources,
  useRequirementAnalysisProviderPolicies,
} from "./requirement-analysis-hooks";
import {
  canLaunchRun,
  capabilityDisabledReason,
  countIncludedSources,
  formatExclusionReason,
} from "./requirement-analysis-presentation";
import {
  RequirementAnalysisError,
  RequirementAnalysisForbidden,
  RequirementAnalysisLoading,
  RequirementAnalysisNoEligibleSources,
  RequirementAnalysisNoRuns,
} from "./requirement-analysis-states";
import { RunHistoryTable } from "./run-history-table";
import { useAnalysisViewerContext } from "./use-analysis-viewer-context";

const LaunchRunDialog = lazy(() =>
  import("./launch-run-dialog").then((m) => ({ default: m.LaunchRunDialog })),
);

export type RequirementAnalysisListPageProps = {
  projectId: string;
  search: RequirementAnalysisSearch;
  onSearchChange: (partial: Partial<RequirementAnalysisSearch>) => void;
  onRunLaunched: (runId: string) => void;
};

const ANY_VALUE = "any";

export function RequirementAnalysisListPage({
  projectId,
  search,
  onSearchChange,
  onRunLaunched,
}: RequirementAnalysisListPageProps) {
  const viewer = useAnalysisViewerContext(projectId);
  const capabilities = useRequirementAnalysisCapabilities(
    viewer.permissions.canRead ? projectId : undefined,
  );
  const filters = useMemo(
    () => ({
      ...(search.status ? { status: search.status } : {}),
      ...(search.mode ? { mode: search.mode } : {}),
    }),
    [search.status, search.mode],
  );
  const runListQuery = useAnalysisRunListInfiniteQuery(
    viewer.permissions.canRead ? projectId : undefined,
    filters,
  );
  const eligibleSourcesQuery = useRequirementAnalysisEligibleSources(
    projectId,
    viewer.permissions.canAnalyze,
  );
  const providerPoliciesQuery = useRequirementAnalysisProviderPolicies(
    viewer.permissions.canRead ? projectId : undefined,
    {},
    undefined,
  );

  const launchOpen = search.launch === true;
  const openLaunch = () => onSearchChange({ launch: true });
  const closeLaunch = () => onSearchChange({ launch: undefined });

  if (viewer.isLoading) {
    return <RequirementAnalysisLoading />;
  }
  if (viewer.isForbidden || !viewer.permissions.canRead) {
    return <RequirementAnalysisForbidden projectId={projectId} />;
  }
  if (viewer.isNotFound) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Project not found</AlertTitle>
        <AlertDescription>
          The requested project could not be found. <Link to="/projects">Back to projects</Link>
        </AlertDescription>
      </Alert>
    );
  }
  if (viewer.error) {
    return (
      <RequirementAnalysisError
        onRetry={() => window.location.reload()}
        message={viewer.error instanceof AtlasApiError ? viewer.error.message : undefined}
      />
    );
  }

  const project = viewer.project;
  const capabilityNotice = capabilityDisabledReason(capabilities.data);
  const eligibleSources = eligibleSourcesQuery.data?.sources ?? [];
  const isProjectInactiveEligibleSourcesError =
    eligibleSourcesQuery.error instanceof AtlasApiError &&
    eligibleSourcesQuery.error.status === 409 &&
    eligibleSourcesQuery.error.code === ANALYSIS_ERROR_CODES.analysisDisabled;
  const includedCount = countIncludedSources(eligibleSources);
  const canLaunch =
    canLaunchRun(capabilities.data, viewer.permissions.canAnalyze) && includedCount > 0;

  const runsContent = (() => {
    if (runListQuery.isPending) {
      return <RequirementAnalysisLoading />;
    }
    if (runListQuery.isError) {
      return (
        <RequirementAnalysisError
          onRetry={() => void runListQuery.refetch()}
          message={
            runListQuery.error instanceof AtlasApiError ? runListQuery.error.message : undefined
          }
        />
      );
    }
    const items = runListQuery.data.pages.flatMap((page) => page.items);
    if (items.length === 0) {
      return (
        <RequirementAnalysisNoRuns
          action={
            canLaunch ? (
              <Button type="button" onClick={openLaunch}>
                <PlayIcon data-icon="inline-start" />
                Start first run
              </Button>
            ) : null
          }
        />
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <RunHistoryTable
          projectId={projectId}
          runs={items}
          canAnalyze={viewer.permissions.canAnalyze}
          providerPolicies={providerPoliciesQuery.data?.items ?? []}
        />
        {runListQuery.hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-center"
            onClick={() => void runListQuery.fetchNextPage()}
            disabled={runListQuery.isFetchingNextPage}
          >
            {runListQuery.isFetchingNextPage ? <Spinner data-icon="inline-start" /> : null}
            Load more runs
          </Button>
        ) : null}
      </div>
    );
  })();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/projects/$projectId"
            params={{ projectId }}
            className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
            Back to workspace
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Requirement analysis</h1>
            <p className="text-sm text-muted-foreground">
              AI-suggested requirements, coverage, and delivery items for{" "}
              <span className="font-medium text-foreground">{project?.name ?? "this project"}</span>
              . Everything here is a draft — Module 4 owns accept, edit, reject, and bulk review.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canLaunch ? (
            <Button type="button" onClick={openLaunch}>
              <PlayIcon data-icon="inline-start" />
              Start fresh run
            </Button>
          ) : (
            <p
              role="note"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
            >
              <LockIcon className="size-3.5" aria-hidden="true" />
              {viewer.permissions.canAnalyze
                ? "Starting a run is temporarily unavailable."
                : "Read-only role — analysis runs are started by Admins, Owners, Architects, or BAs."}
            </p>
          )}
        </div>
      </header>

      {capabilityNotice ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Requirement analyzer is read-only</AlertTitle>
          <AlertDescription>{capabilityNotice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Eligible source preview</h2>
          {eligibleSourcesQuery.isPending && viewer.permissions.canAnalyze ? (
            <Skeleton className="mt-2 h-16 w-full" />
          ) : !viewer.permissions.canAnalyze ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Only Admins, Owners, Architects, and BAs can preview eligible sources.
            </p>
          ) : eligibleSourcesQuery.isError ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {isProjectInactiveEligibleSourcesError
                ? "This project must be Active before sources can be analyzed."
                : "Eligible sources couldn't be loaded. Please try again."}
            </p>
          ) : eligibleSources.length === 0 ? (
            <div className="mt-2">
              <RequirementAnalysisNoEligibleSources />
            </div>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              <li className="text-muted-foreground">
                {includedCount} of {eligibleSources.length} sources qualify
              </li>
              {eligibleSources
                .filter((source) => !source.included)
                .slice(0, 3)
                .map((source) => (
                  <li key={source.sourceDocumentId} className="text-xs text-muted-foreground">
                    {source.title}: {formatExclusionReason(source.exclusionReason)}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Capabilities & policy</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>
              Analysis:{" "}
              <Badge variant="outline">
                {capabilities.data.analysisEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </li>
            <li>
              Queue:{" "}
              <Badge variant="outline">
                {capabilities.data.queueAvailable ? "Available" : "Unavailable"}
              </Badge>
            </li>
            <li>
              Approved provider policy:{" "}
              <Badge variant="outline">
                {capabilities.data.approvedProviderPolicyAvailable ? "Available" : "Missing"}
              </Badge>
            </li>
            <li>
              Reference feature extraction:{" "}
              <Badge variant="outline">
                {capabilities.data.referenceFeatureExtractionEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={search.status ?? ANY_VALUE}
          onValueChange={(value) =>
            onSearchChange({
              status:
                value === ANY_VALUE
                  ? undefined
                  : (value as NonNullable<RequirementAnalysisSearch["status"]>),
            })
          }
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by run status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value={ANY_VALUE}>All statuses</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="snapshotting">Snapshotting</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="waiting_retry">Waiting to retry</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="completed_with_warnings">Completed with warnings</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={search.mode ?? ANY_VALUE}
          onValueChange={(value) =>
            onSearchChange({
              mode:
                value === ANY_VALUE
                  ? undefined
                  : (value as NonNullable<RequirementAnalysisSearch["mode"]>),
            })
          }
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by run mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Mode</SelectLabel>
              <SelectItem value={ANY_VALUE}>All modes</SelectItem>
              <SelectItem value="fresh">Fresh</SelectItem>
              <SelectItem value="replay">Replay</SelectItem>
              <SelectItem value="reprocess">Reprocess</SelectItem>
              <SelectItem value="retry">Retry</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {runsContent}

      {launchOpen && canLaunch ? (
        <Suspense
          fallback={
            <div className="fixed right-4 bottom-4 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <Spinner /> Loading launch dialog…
            </div>
          }
        >
          <LaunchRunDialog
            projectId={projectId}
            open
            onOpenChange={(open) => {
              if (!open) closeLaunch();
            }}
            onLaunched={onRunLaunched}
            providerPolicies={providerPoliciesQuery.data?.items ?? []}
            providerPoliciesLoading={providerPoliciesQuery.isPending}
            eligibleSources={eligibleSources}
            eligibleSourcesLoading={eligibleSourcesQuery.isPending}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
