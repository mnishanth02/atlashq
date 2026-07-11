"use client";

import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, FilePlusIcon, InfoIcon, LockIcon } from "lucide-react";
import { lazy, Suspense, useDeferredValue, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AtlasApiError } from "@/features/api";
import type { SourceDocumentsSearch } from "@/routes/projects/source-documents-search";
import {
  applyCapabilityGates,
  buildSourcesListQuery,
  capabilityDisabledReason,
  readOnlyStateReason,
} from "./source-presentation";
import { SourceVaultCards, SourceVaultTable } from "./source-vault-list";
import {
  SourceVaultEmpty,
  SourceVaultError,
  SourceVaultForbidden,
  SourceVaultLoading,
  SourceVaultStorageUnavailable,
} from "./source-vault-states";
import { hasActiveVaultFilters, SourceVaultToolbar } from "./source-vault-toolbar";
import { SOURCE_ERROR_CODES } from "./sources-api";
import { useSourcesQuery, useSourceVaultCapabilities } from "./sources-hooks";
import { useSourceViewerContext } from "./use-source-viewer-context";

const IntakeSheet = lazy(() =>
  import("./intake/intake-sheet").then((m) => ({ default: m.IntakeSheet })),
);

export type SourceVaultPageProps = {
  projectId: string;
  search: SourceDocumentsSearch;
  onSearchChange: (partial: Partial<SourceDocumentsSearch>) => void;
};

function toApiFilters(search: SourceDocumentsSearch) {
  return buildSourcesListQuery({
    q: search.q,
    type: search.type,
    format: search.format,
    status: search.status,
    ipReview: search.ipReview,
    includeArchived: search.includeArchived,
  });
}

export function SourceVaultPage({ projectId, search, onSearchChange }: SourceVaultPageProps) {
  const viewer = useSourceViewerContext(projectId);
  const deferredSearch = useDeferredValue(search);
  const filters = useMemo(() => toApiFilters(deferredSearch), [deferredSearch]);
  const sourcesQuery = useSourcesQuery(viewer.permissions.canRead ? projectId : undefined, filters);
  const capabilities = useSourceVaultCapabilities(
    viewer.permissions.canRead ? projectId : undefined,
  );

  // The route search (`?intake=…`) is the single source of truth for whether
  // the intake sheet is open and which mode is active. No local state, no
  // useEffect sync — every mutation goes through `onSearchChange`.
  const intakeOpen = search.intake ?? null;

  const openIntake = (mode: "file" | "manual" | "reference") => {
    onSearchChange({ intake: mode });
  };
  const closeIntake = () => {
    onSearchChange({ intake: undefined });
  };
  const changeIntakeMode = (mode: "file" | "manual" | "reference") => {
    onSearchChange({ intake: mode });
  };

  if (viewer.isLoading) {
    return <SourceVaultLoading />;
  }
  if (viewer.isForbidden || !viewer.permissions.canRead) {
    return <SourceVaultForbidden projectId={projectId} />;
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
      <SourceVaultError
        onRetry={() => window.location.reload()}
        message={viewer.error instanceof AtlasApiError ? viewer.error.message : undefined}
      />
    );
  }

  const project = viewer.project;
  const activeFilters = hasActiveVaultFilters(deferredSearch);

  const isStorageUnavailable =
    sourcesQuery.error instanceof AtlasApiError &&
    sourcesQuery.error.code === SOURCE_ERROR_CODES.storageUnavailable;

  const effectivePermissions = applyCapabilityGates(viewer.permissions, capabilities.data);
  const readOnlyReason =
    capabilityDisabledReason(capabilities.data) ?? readOnlyStateReason(effectivePermissions);
  const capabilityNotice = capabilityDisabledReason(capabilities.data);

  const listContent = (() => {
    if (isStorageUnavailable) {
      return <SourceVaultStorageUnavailable />;
    }
    if (sourcesQuery.isPending) {
      return <SourceVaultLoading />;
    }
    if (sourcesQuery.isError) {
      return (
        <SourceVaultError
          onRetry={() => void sourcesQuery.refetch()}
          message={
            sourcesQuery.error instanceof AtlasApiError ? sourcesQuery.error.message : undefined
          }
        />
      );
    }
    const items = sourcesQuery.data.items;
    if (items.length === 0) {
      return (
        <SourceVaultEmpty
          hasFilters={activeFilters}
          onResetFilters={() =>
            onSearchChange({
              q: undefined,
              type: undefined,
              format: undefined,
              status: undefined,
              ipReview: undefined,
              includeArchived: undefined,
            })
          }
          action={
            effectivePermissions.canWrite ? (
              <Button type="button" onClick={() => openIntake("file")}>
                <FilePlusIcon data-icon="inline-start" />
                Add first source
              </Button>
            ) : null
          }
        />
      );
    }
    return (
      <>
        <p className="text-sm text-muted-foreground">
          Showing {items.length}
          {sourcesQuery.data.pageInfo.total === undefined
            ? ""
            : ` of ${sourcesQuery.data.pageInfo.total}`}{" "}
          {items.length === 1 ? "source" : "sources"}
        </p>
        <div className="hidden md:block">
          <SourceVaultTable projectId={projectId} items={items} readOnlyMessage={readOnlyReason} />
        </div>
        <div className="md:hidden">
          <SourceVaultCards projectId={projectId} items={items} />
        </div>
      </>
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
            <h1 className="text-xl font-semibold tracking-tight">Source documents</h1>
            <p className="text-sm text-muted-foreground">
              Immutable evidence for{" "}
              <span className="font-medium text-foreground">{project?.name ?? "this project"}</span>
              . Upload files, manual text, or reference artifacts. Confirmed source content cannot
              be edited in place — corrections create a new version.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {effectivePermissions.canWrite ? (
            <Button type="button" onClick={() => openIntake("file")}>
              <FilePlusIcon data-icon="inline-start" />
              Add source
            </Button>
          ) : (
            /*
             * Read-only viewers do not see an add CTA. A compact inline
             * message explains why, so the surface stays honest without
             * offering a disabled action that implies an unlock.
             */
            <p
              role="note"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
            >
              <LockIcon className="size-3.5" aria-hidden="true" />
              {capabilityNotice
                ? "Source vault is read-only for this workspace."
                : viewer.permissions.canWrite
                  ? "Source vault is temporarily read-only."
                  : "Read-only role — sources are managed by contributors."}
            </p>
          )}
        </div>
      </header>

      {capabilityNotice ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Source vault is read-only</AlertTitle>
          <AlertDescription>{capabilityNotice}</AlertDescription>
        </Alert>
      ) : null}

      <SourceVaultToolbar
        search={search}
        hasActiveFilters={hasActiveVaultFilters(search)}
        onChange={onSearchChange}
        onReset={() =>
          onSearchChange({
            q: undefined,
            type: undefined,
            format: undefined,
            status: undefined,
            ipReview: undefined,
            includeArchived: undefined,
          })
        }
      />

      {listContent}

      {intakeOpen !== null && effectivePermissions.canWrite ? (
        <Suspense
          fallback={
            <div className="fixed right-4 bottom-4 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <Spinner /> Loading intake…
            </div>
          }
        >
          <IntakeSheet
            projectId={projectId}
            open
            initialMode={intakeOpen}
            onModeChange={changeIntakeMode}
            onOpenChange={(open) => {
              if (!open) closeIntake();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
