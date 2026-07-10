import { FolderKanbanIcon, SearchXIcon } from "lucide-react";
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
const SKELETON_TABLE_COLUMNS = [
  "Project",
  "Status",
  "Owner",
  "Phase",
  "Priority",
  "Updated",
] as const;

/**
 * Deterministic loading placeholder — a stable set of skeleton rows (desktop
 * table) / cards (mobile) so the layout doesn't shift when data arrives.
 */
export function ProjectsLoading() {
  return (
    <output aria-label="Loading projects" className="block">
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {SKELETON_TABLE_COLUMNS.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SKELETON_ROWS.map((row) => (
              <TableRow key={row}>
                {SKELETON_TABLE_COLUMNS.map((column) => (
                  <TableCell key={column}>
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

export function ProjectsError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Couldn't load projects</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{message ?? "The project portfolio failed to load. Check your connection and retry."}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function ProjectsLoadMoreError({
  onRetry,
  message,
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Couldn't load more projects</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{message ?? "The projects already shown are still available. Retry the next page."}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry load more
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Empty state that distinguishes "no projects exist yet" (offer the create
 * action) from "no projects match the current filters" (offer to clear them).
 */
export function ProjectsEmpty({
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
          <EmptyTitle>No matching projects</EmptyTitle>
          <EmptyDescription>
            No projects match your current search and filters. Adjust or clear them to see more.
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
          <FolderKanbanIcon />
        </EmptyMedia>
        <EmptyTitle>No projects yet</EmptyTitle>
        <EmptyDescription>
          Projects you create appear here with their status, phase, and delivery timeline.
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
