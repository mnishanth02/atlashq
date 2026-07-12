import { FileSearchIcon } from "lucide-react";
import { ConfidenceMeter, EpistemicBadge, StatusPill } from "@/components/atlas";
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
import type { RequirementListQuery } from "./requirement-analysis-api";
import { useAnalysisRequirementsQuery } from "./requirement-analysis-hooks";
import {
  formatRequirementPriority,
  formatRequirementType,
  shouldShowConfidenceMeter,
  toLifecycleStatusPill,
} from "./requirement-analysis-presentation";

const ANY_VALUE = "any";

export type RequirementsPanelProps = {
  projectId: string;
  runId: string;
  requirementType: RequirementListQuery["requirementType"] | undefined;
  epistemicStatus: RequirementListQuery["epistemicStatus"] | undefined;
  onFilterChange: (filters: {
    requirementType?: RequirementListQuery["requirementType"] | undefined;
    epistemicStatus?: RequirementListQuery["epistemicStatus"] | undefined;
  }) => void;
  onViewEvidence: (requirementId: string, title: string) => void;
};

/**
 * Read-only requirements view (task requirement #4). No accept, edit,
 * reject, or bulk-review affordances live here — Module 4 owns that
 * workflow; this surface only presents the AI-suggested draft with
 * citations traceability.
 */
export function RequirementsPanel({
  projectId,
  runId,
  requirementType,
  epistemicStatus,
  onFilterChange,
  onViewEvidence,
}: RequirementsPanelProps) {
  const requirementsQuery = useAnalysisRequirementsQuery(projectId, runId, {
    ...(requirementType ? { requirementType } : {}),
    ...(epistemicStatus ? { epistemicStatus } : {}),
  });

  const items = requirementsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={requirementType ?? ANY_VALUE}
          onValueChange={(value) =>
            onFilterChange({
              requirementType:
                value === ANY_VALUE
                  ? undefined
                  : (value as RequirementListQuery["requirementType"]),
            })
          }
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter by requirement type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Type</SelectLabel>
              <SelectItem value={ANY_VALUE}>All types</SelectItem>
              <SelectItem value="functional">Functional</SelectItem>
              <SelectItem value="non_functional">Non-functional</SelectItem>
              <SelectItem value="business_rule">Business rule</SelectItem>
              <SelectItem value="data">Data</SelectItem>
              <SelectItem value="integration">Integration</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={epistemicStatus ?? ANY_VALUE}
          onValueChange={(value) =>
            onFilterChange({
              epistemicStatus:
                value === ANY_VALUE
                  ? undefined
                  : (value as RequirementListQuery["epistemicStatus"]),
            })
          }
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by epistemic status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Epistemic status</SelectLabel>
              <SelectItem value={ANY_VALUE}>All statuses</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="assumed">Assumed</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
              <SelectItem value="conflicting">Conflicting</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {requirementsQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileSearchIcon />
            </EmptyMedia>
            <EmptyTitle>No requirements match these filters</EmptyTitle>
            <EmptyDescription>
              Adjust the type or epistemic status filters, or check back once this run completes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requirement</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Epistemic status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead className="text-right">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((requirement) => (
                <TableRow key={requirement.id}>
                  <TableCell className="max-w-sm">
                    <p className="font-medium text-foreground">{requirement.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {requirement.description}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatRequirementType(requirement.requirementType)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatRequirementPriority(requirement.priority)}
                  </TableCell>
                  <TableCell>
                    <EpistemicBadge status={requirement.epistemicStatus} size="sm" />
                  </TableCell>
                  <TableCell>
                    {shouldShowConfidenceMeter(requirement.confidenceBand) ? (
                      <ConfidenceMeter level={requirement.confidenceBand ?? undefined} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Not applicable</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      size="sm"
                      status={toLifecycleStatusPill(requirement.lifecycleState)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewEvidence(requirement.id, requirement.title)}
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
