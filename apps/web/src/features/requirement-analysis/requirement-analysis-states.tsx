import { FileSearchIcon, ShieldAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function RequirementAnalysisLoading() {
  return (
    <output aria-label="Loading requirement analysis" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </output>
  );
}

export function RequirementAnalysisError({
  onRetry,
  message,
}: {
  onRetry: () => void;
  message?: string | undefined;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Couldn't load requirement analysis</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>
          {message ?? "The requirement analyzer failed to load. Check your connection and retry."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function RequirementAnalysisForbidden({ projectId }: { projectId: string }) {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Access denied</EmptyTitle>
        <EmptyDescription>
          Your role can't open this project's requirement analyzer.{" "}
          <span className="font-mono text-xs">{projectId}</span>
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function RequirementAnalysisNoRuns({ action }: { action?: ReactNode }) {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileSearchIcon />
        </EmptyMedia>
        <EmptyTitle>No analysis runs yet</EmptyTitle>
        <EmptyDescription>
          Start a run once eligible source evidence has been recorded, to generate draft
          requirements, coverage, and delivery items for Module 4 review.
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function RequirementAnalysisNoEligibleSources() {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileSearchIcon />
        </EmptyMedia>
        <EmptyTitle>No eligible sources</EmptyTitle>
        <EmptyDescription>
          No source evidence currently qualifies for analysis. Add ready, head-version source
          documents or clear reference material through IP review, then check back here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
