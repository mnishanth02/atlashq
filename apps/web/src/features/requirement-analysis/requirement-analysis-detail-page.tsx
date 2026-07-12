"use client";

import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, InfoIcon, ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { lazy, Suspense, useState } from "react";
import { SeverityIndicator, TraceabilityChain } from "@/components/atlas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AtlasApiError } from "@/features/api";
import type { RequirementAnalysisDetailSearch } from "@/routes/projects/requirement-analysis-search";
import {
  useAnalysisCitationsQuery,
  useAnalysisRunDetailQuery,
  useAnalysisTraceabilityQuery,
} from "./requirement-analysis-hooks";
import {
  formatCitationVerificationStatus,
  formatRunMode,
  formatRunStatus,
  formatTokenCount,
  formatUsd,
  getRunStatusMeta,
} from "./requirement-analysis-presentation";
import {
  RequirementAnalysisError,
  RequirementAnalysisForbidden,
  RequirementAnalysisLoading,
} from "./requirement-analysis-states";
import { useAnalysisViewerContext } from "./use-analysis-viewer-context";

const StageTimeline = lazy(() =>
  import("./stage-timeline").then((m) => ({ default: m.StageTimeline })),
);
const RequirementsPanel = lazy(() =>
  import("./requirements-panel").then((m) => ({ default: m.RequirementsPanel })),
);
const DeliveryItemsPanel = lazy(() =>
  import("./delivery-items-panel").then((m) => ({ default: m.DeliveryItemsPanel })),
);
const CoverageMatrix = lazy(() =>
  import("./coverage-matrix").then((m) => ({ default: m.CoverageMatrix })),
);
const EvidenceDrawer = lazy(() =>
  import("./evidence-drawer").then((m) => ({ default: m.EvidenceDrawer })),
);

export type RequirementAnalysisDetailPageProps = {
  projectId: string;
  runId: string;
  search: RequirementAnalysisDetailSearch;
  onSearchChange: (partial: Partial<RequirementAnalysisDetailSearch>) => void;
};

const PANEL_FALLBACK = <Skeleton className="h-64 w-full" />;

export function RequirementAnalysisDetailPage({
  projectId,
  runId,
  search,
  onSearchChange,
}: RequirementAnalysisDetailPageProps) {
  const viewer = useAnalysisViewerContext(projectId);
  const runQuery = useAnalysisRunDetailQuery(
    viewer.permissions.canRead ? projectId : undefined,
    runId,
  );
  const [evidenceTarget, setEvidenceTarget] = useState<
    { title: string; filter: { requirementId?: string; deliveryItemId?: string } } | undefined
  >(undefined);

  const activeTab = search.tab ?? "requirements";

  if (viewer.isLoading || runQuery.isPending) {
    return <RequirementAnalysisLoading />;
  }
  if (viewer.isForbidden || !viewer.permissions.canRead) {
    return <RequirementAnalysisForbidden projectId={projectId} />;
  }
  if (runQuery.isError) {
    return (
      <RequirementAnalysisError
        onRetry={() => void runQuery.refetch()}
        message={runQuery.error instanceof AtlasApiError ? runQuery.error.message : undefined}
      />
    );
  }

  const run = runQuery.data;
  const statusMeta = getRunStatusMeta(run.status);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          to="/projects/$projectId/requirement-analysis"
          params={{ projectId }}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          Back to requirement analysis
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-mono text-lg font-semibold tracking-tight">{run.id}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatRunMode(run.mode)}</Badge>
              <SeverityIndicator
                size="sm"
                severity={statusMeta.severity}
                label={formatRunStatus(run.status)}
              />
              {run.warningCodes.length > 0 ? (
                <Badge variant="outline" className="gap-1">
                  <TriangleAlertIcon className="size-3" aria-hidden="true" />
                  {run.warningCodes.length} warning{run.warningCodes.length === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <Alert>
        <ShieldAlertIcon />
        <AlertTitle>This is a read-only AI draft</AlertTitle>
        <AlertDescription>
          Requirements, delivery items, and coverage below are AI suggestions from this run. Module
          4 owns accept, edit, reject, and bulk review — no such actions are available here.
        </AlertDescription>
      </Alert>

      {run.failureCode ? (
        <Alert variant="destructive">
          <AlertTitle>{run.failureCode}</AlertTitle>
          <AlertDescription>{run.failureDetail}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetadataCard title="Provider policy">
          <dl className="flex flex-col gap-1 text-xs">
            <Row label="Provider" value={run.providerPolicy.provider} />
            <Row label="Model" value={run.providerPolicy.modelAlias} />
            <Row label="Data retention" value={run.providerPolicy.dataRetentionMode} />
          </dl>
        </MetadataCard>
        <MetadataCard title="Provenance">
          <dl className="flex flex-col gap-1 text-xs">
            <Row label="Prompt bundle" value={run.provenance.promptBundleVersion} />
            <Row label="Schema bundle" value={run.provenance.schemaBundleVersion} />
            <Row label="Pipeline" value={run.provenance.pipelineVersion} />
          </dl>
        </MetadataCard>
        <MetadataCard title="Cost & usage">
          <dl className="flex flex-col gap-1 text-xs">
            <Row label="Cost" value={formatUsd(run.usage.costUsd)} />
            <Row label="Input tokens" value={formatTokenCount(run.usage.inputTokensUsed)} />
            <Row label="Output tokens" value={formatTokenCount(run.usage.outputTokensUsed)} />
            <Row label="Budget cap" value={formatUsd(run.budgets.maxUsd)} />
          </dl>
        </MetadataCard>
      </div>

      {run.snapshot ? (
        <MetadataCard title="Source snapshot">
          <dl className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
            <Row label="Sources" value={String(run.snapshot.sourceCount)} />
            <Row label="Chunks" value={String(run.snapshot.chunkCount)} />
            <Row label="Characters" value={formatTokenCount(run.snapshot.totalCharacterCount)} />
            <Row label="Rules version" value={run.snapshot.eligibilityRulesVersion} />
          </dl>
        </MetadataCard>
      ) : null}

      {run.readNotices.length > 0 ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Read notices</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {run.readNotices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Artifact counts</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Row label="Requirements" value={String(run.artifactCounts.requirements)} />
          <Row label="Delivery items" value={String(run.artifactCounts.deliveryItems)} />
          <Row label="Citations" value={String(run.artifactCounts.citations)} />
          <Row label="Coverage entries" value={String(run.artifactCounts.coverageEntries)} />
        </dl>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => onSearchChange({ tab: value as never })}>
        <TabsList>
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="delivery-items">Delivery items</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="citations">Citations</TabsTrigger>
          <TabsTrigger value="traceability">Traceability</TabsTrigger>
        </TabsList>

        <TabsContent value="stages">
          <Suspense fallback={PANEL_FALLBACK}>
            <StageTimeline projectId={projectId} runId={runId} runStatus={run.status} />
          </Suspense>
        </TabsContent>

        <TabsContent value="requirements">
          <Suspense fallback={PANEL_FALLBACK}>
            <RequirementsPanel
              projectId={projectId}
              runId={runId}
              requirementType={search.requirementType}
              epistemicStatus={search.epistemicStatus}
              onFilterChange={(filters) => onSearchChange(filters)}
              onViewEvidence={(requirementId, title) =>
                setEvidenceTarget({ title, filter: { requirementId } })
              }
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="delivery-items">
          <Suspense fallback={PANEL_FALLBACK}>
            <DeliveryItemsPanel
              projectId={projectId}
              runId={runId}
              itemType={search.deliveryItemType}
              onFilterChange={(filters) => onSearchChange({ deliveryItemType: filters.itemType })}
              onViewEvidence={(deliveryItemId, title) =>
                setEvidenceTarget({ title, filter: { deliveryItemId } })
              }
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="coverage">
          <Suspense fallback={PANEL_FALLBACK}>
            <CoverageMatrix projectId={projectId} runId={runId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="citations">
          <CitationsTab projectId={projectId} runId={runId} />
        </TabsContent>

        <TabsContent value="traceability">
          <TraceabilityTab projectId={projectId} runId={runId} />
        </TabsContent>
      </Tabs>

      {evidenceTarget ? (
        <Suspense fallback={null}>
          <EvidenceDrawer
            projectId={projectId}
            runId={runId}
            title={evidenceTarget.title}
            open
            onOpenChange={(open) => {
              if (!open) setEvidenceTarget(undefined);
            }}
            filter={evidenceTarget.filter}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function MetadataCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="mb-2 text-sm font-medium text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  );
}

function CitationsTab({ projectId, runId }: { projectId: string; runId: string }) {
  const citationsQuery = useAnalysisCitationsQuery(projectId, runId);
  const items = citationsQuery.data?.items ?? [];

  if (citationsQuery.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Citation</TableHead>
            <TableHead>Source chunk</TableHead>
            <TableHead>Verification</TableHead>
            <TableHead>Linked artifact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((citation) => (
            <TableRow key={citation.id}>
              <TableCell
                className="max-w-sm truncate font-mono text-xs"
                title={citation.quoteTextOriginal}
              >
                {citation.quoteTextOriginal}
              </TableCell>
              <TableCell className="font-mono text-xs">#{citation.sourceChunkSequence}</TableCell>
              <TableCell className="text-xs">
                {formatCitationVerificationStatus(citation.verificationStatus)}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {citation.requirementId ??
                  citation.deliveryItemId ??
                  citation.coverageMatrixEntryId ??
                  "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TraceabilityTab({ projectId, runId }: { projectId: string; runId: string }) {
  const traceabilityQuery = useAnalysisTraceabilityQuery(projectId, runId);
  const items = traceabilityQuery.data?.items ?? [];

  if (traceabilityQuery.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((link) => (
        <div key={link.id} className="rounded-md border border-border p-2">
          <TraceabilityChain
            nodes={[
              { id: link.fromId, label: link.fromId, kind: link.fromType },
              { id: link.toId, label: link.toId, kind: `${link.relation} → ${link.toType}` },
            ]}
          />
        </div>
      ))}
    </div>
  );
}
