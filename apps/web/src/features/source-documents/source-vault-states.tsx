import { FileTextIcon, SearchXIcon, ShieldAlertIcon } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"] as const;
const SKELETON_COLUMNS = [
  "Source",
  "Kind",
  "Version",
  "Processing",
  "IP review",
  "Duplicate",
  "Contributor",
  "Uploaded",
] as const;

export function SourceVaultLoading() {
  return (
    <output aria-label="Loading source documents" className="block">
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {SKELETON_COLUMNS.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SKELETON_ROWS.map((row) => (
              <TableRow key={row}>
                {SKELETON_COLUMNS.map((c) => (
                  <TableCell key={c}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 md:hidden">
        {SKELETON_ROWS.map((row) => (
          <div key={row} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </output>
  );
}

export function SourceVaultError({
  onRetry,
  message,
}: {
  onRetry: () => void;
  message?: string | undefined;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Couldn't load source documents</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{message ?? "The source vault failed to load. Check your connection and retry."}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function SourceVaultForbidden({ projectId }: { projectId: string }) {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Access denied</EmptyTitle>
        <EmptyDescription>
          Your role can’t open this project's source vault.{" "}
          <span className="font-mono text-xs">{projectId}</span>
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function SourceVaultEmpty({
  hasFilters,
  onResetFilters,
  action,
}: {
  hasFilters: boolean;
  onResetFilters: () => void;
  action?: ReactNode;
}) {
  if (hasFilters) {
    return (
      <Empty className="border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No matching sources</EmptyTitle>
          <EmptyDescription>
            No sources match your current search and filters. Adjust or clear them to see more.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" onClick={onResetFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon />
        </EmptyMedia>
        <EmptyTitle>No sources yet</EmptyTitle>
        <EmptyDescription>
          Every uploaded file, manual entry, and reference artifact will appear here once confirmed
          as immutable evidence.
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function SourceVaultStorageUnavailable() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Source storage is unavailable</AlertTitle>
      <AlertDescription>
        We can't reach the source vault storage right now. Previously uploaded evidence remains
        safe; new uploads and downloads will resume once storage is restored.
      </AlertDescription>
    </Alert>
  );
}
