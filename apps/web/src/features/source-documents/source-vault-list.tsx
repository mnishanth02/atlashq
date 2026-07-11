import { Link } from "@tanstack/react-router";
import { ArchiveIcon, ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ProvenanceTag, SeverityIndicator } from "@/components/atlas";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatIpReviewStatus,
  formatProcessingStatus,
  formatSourceFormat,
  formatSourceType,
  getIpReviewMeta,
  getProcessingMeta,
} from "./source-presentation";
import type { SourceListItem } from "./sources-api";

const TABLE_COLUMNS = [
  "Source",
  "Kind",
  "Version",
  "Processing",
  "IP review",
  "Duplicate",
  "Contributor",
  "Uploaded",
] as const;

function ProcessingCell({ status }: { status: SourceListItem["processingStatus"] }) {
  const meta = getProcessingMeta(status);
  return (
    <div className="flex items-center gap-2">
      <SeverityIndicator
        severity={meta.severity}
        label={formatProcessingStatus(status)}
        size="sm"
      />
    </div>
  );
}

function IpReviewCell({
  sourceType,
  status,
}: {
  sourceType: SourceListItem["sourceType"];
  status: SourceListItem["ipReviewStatus"];
}) {
  if (sourceType !== "reference" || !status) {
    return <span className="text-muted-foreground">—</span>;
  }
  const meta = getIpReviewMeta(status);
  return (
    <SeverityIndicator severity={meta.severity} label={formatIpReviewStatus(status)} size="sm" />
  );
}

export function SourceVaultTable({
  projectId,
  items,
  readOnlyMessage,
}: {
  projectId: string;
  items: SourceListItem[];
  readOnlyMessage?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {readOnlyMessage ? (
        <div className="border-b bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
          {readOnlyMessage}
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            {TABLE_COLUMNS.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="relative">
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Link
                    to="/projects/$projectId/source-documents/$sourceId"
                    params={{ projectId, sourceId: item.id }}
                    className="font-medium text-foreground underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {item.title}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.lineageId.slice(0, 8)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <ProvenanceTag
                    kind={
                      item.sourceType === "reference"
                        ? "reference"
                        : item.sourceType === "manual"
                          ? "manual"
                          : "source"
                    }
                    label={formatSourceType(item.sourceType)}
                  />
                  {item.documentFormat ? (
                    <span className="text-xs text-muted-foreground">
                      {formatSourceFormat(item.documentFormat)}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">v{item.versionNumber}</Badge>
              </TableCell>
              <TableCell>
                <ProcessingCell status={item.processingStatus} />
              </TableCell>
              <TableCell>
                <IpReviewCell sourceType={item.sourceType} status={item.ipReviewStatus} />
              </TableCell>
              <TableCell>
                {item.hasDuplicateAcknowledgement ? (
                  <Badge variant="outline">Duplicate ack</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {item.createdByActorId.slice(0, 8)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(item.createdAt).toISOString().slice(0, 10)}
                {item.isArchived ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs">
                    <ArchiveIcon className="size-3" />
                    Archived
                  </span>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SourceVaultCards({
  projectId,
  items,
}: {
  projectId: string;
  items: SourceListItem[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const meta = getProcessingMeta(item.processingStatus);
        return (
          <li
            key={item.id}
            className="relative flex flex-col gap-3 rounded-lg border border-border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Link
                  to="/projects/$projectId/source-documents/$sourceId"
                  params={{ projectId, sourceId: item.id }}
                  className="min-w-0 truncate text-sm font-medium underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:underline"
                >
                  {item.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <ProvenanceTag
                    kind={
                      item.sourceType === "reference"
                        ? "reference"
                        : item.sourceType === "manual"
                          ? "manual"
                          : "source"
                    }
                    label={formatSourceType(item.sourceType)}
                  />
                  <Badge variant="outline">v{item.versionNumber}</Badge>
                  {item.documentFormat ? (
                    <span>{formatSourceFormat(item.documentFormat)}</span>
                  ) : null}
                </div>
              </div>
              <SeverityIndicator
                severity={meta.severity}
                label={formatProcessingStatus(item.processingStatus)}
                size="sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {item.isArchived ? (
                <Badge variant="outline">
                  <ArchiveIcon className="mr-1 size-3" /> Archived
                </Badge>
              ) : null}
              {item.hasDuplicateAcknowledgement ? (
                <Badge variant="outline">Duplicate ack</Badge>
              ) : null}
              {item.ipReviewStatus && item.sourceType === "reference" ? (
                <IpReviewCell sourceType={item.sourceType} status={item.ipReviewStatus} />
              ) : null}
              <span className="inline-flex items-center gap-1">
                <ExternalLinkIcon className="size-3" aria-hidden="true" />
                Open
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
