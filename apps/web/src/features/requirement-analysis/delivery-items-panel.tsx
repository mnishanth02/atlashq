import { MessageCircleQuestionIcon } from "lucide-react";
import { EpistemicBadge, SeverityIndicator } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DeliveryItemListItem, DeliveryItemListQuery } from "./requirement-analysis-api";
import { useAnalysisDeliveryItemsQuery } from "./requirement-analysis-hooks";
import { formatDeliveryItemType, toSeverityOrInfo } from "./requirement-analysis-presentation";

const ANY_VALUE = "any";

export type DeliveryItemsPanelProps = {
  projectId: string;
  runId: string;
  itemType: DeliveryItemListQuery["itemType"] | undefined;
  onFilterChange: (filters: { itemType?: DeliveryItemListQuery["itemType"] | undefined }) => void;
  onViewEvidence: (deliveryItemId: string, title: string) => void;
};

function describeAttributes(item: DeliveryItemListItem): string {
  switch (item.itemType) {
    case "question":
      return item.attributes.questionText;
    case "risk":
      return `${item.attributes.category} · ${item.attributes.trigger}`;
    case "assumption":
      return item.attributes.inferenceBasis;
    case "dependency":
      return `${item.attributes.dependencyName} (${item.attributes.dependencyDirection})`;
    case "blocker":
      return item.attributes.contradictionSummary;
    case "scope_change_candidate":
      return item.attributes.classification === "scope_creep"
        ? item.attributes.changeSource
        : item.attributes.exclusionBasis;
    default:
      return "";
  }
}

/**
 * Read-only delivery items view (task requirement #4): renders the
 * discriminated union (question/risk/assumption/dependency/blocker/
 * scope_change_candidate) type-narrowed per `itemType`, without any bulk
 * review affordances — Module 4 owns accept/edit/reject.
 */
export function DeliveryItemsPanel({
  projectId,
  runId,
  itemType,
  onFilterChange,
  onViewEvidence,
}: DeliveryItemsPanelProps) {
  const deliveryItemsQuery = useAnalysisDeliveryItemsQuery(projectId, runId, {
    ...(itemType ? { itemType } : {}),
  });

  const items = deliveryItemsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Select
        value={itemType ?? ANY_VALUE}
        onValueChange={(value) =>
          onFilterChange({
            itemType:
              value === ANY_VALUE ? undefined : (value as DeliveryItemListQuery["itemType"]),
          })
        }
      >
        <SelectTrigger className="w-full sm:w-56" aria-label="Filter by delivery item type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Type</SelectLabel>
            <SelectItem value={ANY_VALUE}>All types</SelectItem>
            <SelectItem value="question">Question</SelectItem>
            <SelectItem value="risk">Risk</SelectItem>
            <SelectItem value="assumption">Assumption</SelectItem>
            <SelectItem value="dependency">Dependency</SelectItem>
            <SelectItem value="blocker">Blocker</SelectItem>
            <SelectItem value="scope_change_candidate">Scope change candidate</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {deliveryItemsQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircleQuestionIcon />
            </EmptyMedia>
            <EmptyTitle>No delivery items match these filters</EmptyTitle>
            <EmptyDescription>
              Adjust the type filter, or check back once this run completes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Epistemic status</TableHead>
                <TableHead className="text-right">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-md">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {describeAttributes(item)}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">{formatDeliveryItemType(item.itemType)}</TableCell>
                  <TableCell>
                    <SeverityIndicator size="sm" severity={toSeverityOrInfo(item.severity)} />
                  </TableCell>
                  <TableCell>
                    <EpistemicBadge status={item.epistemicStatus} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewEvidence(item.id, item.title)}
                    >
                      View evidence
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
