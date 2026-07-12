import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { SeverityIndicator } from "@/components/atlas";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalysisRunStatus, AnalysisStageSummary } from "./requirement-analysis-api";
import { useAnalysisBatchesQuery, useAnalysisStagesQuery } from "./requirement-analysis-hooks";
import {
  formatStageKind,
  formatStageStatus,
  getStageStatusMeta,
} from "./requirement-analysis-presentation";

export type StageTimelineProps = {
  projectId: string;
  runId: string;
  runStatus: AnalysisRunStatus;
};

/**
 * Stage progress/timeline (task requirement #4): every stage row can expand
 * to show its batches, surfacing warning/failure detail inline instead of
 * hiding it behind a separate page. `runStatus` drives bounded 3-second
 * polling (module-03 §6.4, §14.3): both stages and any expanded batch list
 * keep refetching only while the run is non-terminal, and stop exactly at
 * a terminal status — no separate interval is created here.
 */
export function StageTimeline({ projectId, runId, runStatus }: StageTimelineProps) {
  const stagesQuery = useAnalysisStagesQuery(projectId, runId, {}, undefined, runStatus);

  if (stagesQuery.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  const stages = stagesQuery.data?.items ?? [];
  if (stages.length === 0) {
    return (
      <Empty className="border border-dashed border-border">
        <EmptyHeader>
          <EmptyTitle>No stages recorded yet</EmptyTitle>
          <EmptyDescription>
            Stages appear here once the run has started processing.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {stages.map((stage) => (
        <StageRow
          key={stage.id}
          projectId={projectId}
          runId={runId}
          runStatus={runStatus}
          stage={stage}
        />
      ))}
    </ol>
  );
}

function StageRow({
  projectId,
  runId,
  runStatus,
  stage,
}: {
  projectId: string;
  runId: string;
  runStatus: AnalysisRunStatus;
  stage: AnalysisStageSummary;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = getStageStatusMeta(stage.status);
  const batchesQuery = useAnalysisBatchesQuery(
    expanded ? projectId : undefined,
    expanded ? runId : undefined,
    { stageId: stage.id },
    undefined,
    runStatus,
  );

  return (
    <li className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          {expanded ? (
            <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-foreground">{formatStageKind(stage.kind)}</span>
        </span>
        <span className="flex items-center gap-2">
          {stage.attemptNumber > 1 ? (
            <Badge variant="outline">Attempt {stage.attemptNumber}</Badge>
          ) : null}
          <SeverityIndicator
            size="sm"
            severity={statusMeta.severity}
            label={formatStageStatus(stage.status)}
          />
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
          {stage.failureCode ? (
            <p className="text-xs text-sev-critical-strong">
              {stage.failureCode}: {stage.failureDetail}
            </p>
          ) : null}
          {batchesQuery.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : (batchesQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No batches recorded for this stage.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {batchesQuery.data?.items.map((batch) => (
                <li
                  key={batch.id}
                  className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5 text-xs"
                >
                  <span className="font-mono text-muted-foreground">
                    Batch {batch.batchOrder} · chunks {batch.sourceChunkStartSequence}-
                    {batch.sourceChunkEndSequence}
                  </span>
                  <span className="flex items-center gap-2">
                    {batch.shapeOnlyRepairUsed ? <Badge variant="outline">Repaired</Badge> : null}
                    {batch.cacheHitOfBatchId ? <Badge variant="outline">Cache hit</Badge> : null}
                    <SeverityIndicator
                      size="sm"
                      severity={getStageStatusMeta(batch.status).severity}
                      label={formatStageStatus(batch.status)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}
