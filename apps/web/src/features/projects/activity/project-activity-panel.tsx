"use client";

import type { ProjectAuditEventsQuery } from "@atlashq/api-client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ActivityIcon, PencilLineIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo } from "react";
import { ProvenanceTag } from "@/components/atlas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchProjectAuditEvents,
  getProjectAuditEventsFamilyQueryKey,
  type ProjectAuditEventListResponse,
} from "@/features/api";
import { formatAtlasErrorMessage, formatDateTimeUtc } from "../detail/project-detail-model";
import {
  formatAuditActionLabel,
  formatAuditActorLabel,
  formatAuditEntityLabel,
  summarizeAuditChange,
} from "./project-activity-model";

const ACTIVITY_PAGE_SIZE = 20;
const MISSING_PROJECT_ID = "__missing__";
const ACTIVITY_SKELETON_KEYS = ["activity-1", "activity-2", "activity-3", "activity-4"] as const;

type AuditEvent = ProjectAuditEventListResponse["items"][number];

type ProjectActivityPanelProps = {
  projectId: string;
  viewerId: string | undefined;
};

function useProjectActivityPages(projectId: string) {
  return useInfiniteQuery({
    queryKey: [
      ...getProjectAuditEventsFamilyQueryKey(projectId || MISSING_PROJECT_ID),
      "infinite",
      ACTIVITY_PAGE_SIZE,
    ],
    enabled: projectId.length > 0,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const filters: ProjectAuditEventsQuery = {
        limit: ACTIVITY_PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam } : {}),
      };

      return fetchProjectAuditEvents(projectId, filters, { signal });
    },
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
  });
}

function ActivityTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-full" />
      {ACTIVITY_SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-16 w-full" />
      ))}
    </div>
  );
}

function ActivityEventRow({
  event,
  viewerId,
}: {
  event: AuditEvent;
  viewerId: string | undefined;
}) {
  return (
    <TableRow>
      <TableCell className="align-top whitespace-normal">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{formatAuditActionLabel(event.action)}</span>
            <ProvenanceTag kind="manual" variant="outline" label="Manual provenance" />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{formatAuditEntityLabel(event.entityType)}</span>
            <span className="font-mono text-xs">{event.entityId}</span>
            <span>{summarizeAuditChange(event.before, event.after)}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{formatAuditActorLabel(event.actorId, viewerId)}</span>
          <span className="font-mono text-xs text-muted-foreground">{event.actorId}</span>
        </div>
      </TableCell>
      <TableCell className="align-top whitespace-normal text-muted-foreground">
        <time dateTime={event.at} title={event.at}>
          {formatDateTimeUtc(event.at)}
        </time>
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        <span className="font-mono text-xs text-muted-foreground">{event.correlationId}</span>
      </TableCell>
    </TableRow>
  );
}

export function ProjectActivityPanel({ projectId, viewerId }: ProjectActivityPanelProps) {
  const activityPagesQuery = useProjectActivityPages(projectId);
  const events = useMemo(
    () => activityPagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activityPagesQuery.data],
  );
  const totalEvents = activityPagesQuery.data?.pages[0]?.pageInfo.total ?? events.length;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ActivityIcon />
          Activity
        </CardTitle>
        <CardDescription>Manual audit events for this workspace, newest first.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activityPagesQuery.isError && events.length === 0 ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Couldn't load activity</AlertTitle>
            <AlertDescription className="gap-3">
              <p>
                {formatAtlasErrorMessage(
                  activityPagesQuery.error,
                  "Audit events could not be loaded for this project.",
                )}
              </p>
              <div>
                <Button
                  variant="outline"
                  onClick={() => {
                    void activityPagesQuery.refetch();
                  }}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : activityPagesQuery.isPending && events.length === 0 ? (
          <ActivityTableSkeleton />
        ) : events.length === 0 ? (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PencilLineIcon />
              </EmptyMedia>
              <EmptyTitle>No activity recorded</EmptyTitle>
              <EmptyDescription>
                This project does not have project-scoped audit events yet.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {activityPagesQuery.isError ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Activity refresh failed</AlertTitle>
                <AlertDescription>
                  {formatAtlasErrorMessage(
                    activityPagesQuery.error,
                    "Loaded events are shown below, but the latest refresh failed.",
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Correlation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <ActivityEventRow key={event.id} event={event} viewerId={viewerId} />
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
        <p className="text-sm text-muted-foreground">
          Showing {events.length} of {totalEvents} recorded audit events.
        </p>
        {activityPagesQuery.hasNextPage ? (
          <Button
            disabled={activityPagesQuery.isFetchingNextPage}
            variant="outline"
            onClick={() => {
              void activityPagesQuery.fetchNextPage();
            }}
          >
            {activityPagesQuery.isFetchingNextPage ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ActivityIcon data-icon="inline-start" />
            )}
            Load more
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
