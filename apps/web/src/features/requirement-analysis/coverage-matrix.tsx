import { SeverityIndicator } from "@/components/atlas";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAnalysisCoverageQuery } from "./requirement-analysis-hooks";
import {
  buildCoverageMatrix,
  formatCoverageEvidenceState,
  getCoverageStatusMeta,
} from "./requirement-analysis-presentation";

export type CoverageMatrixProps = {
  projectId: string;
  runId: string;
};

/**
 * Fixed 18-category coverage matrix (module-03 §8.5, task requirement #4).
 * Always renders every rubric category regardless of how many coverage
 * entries the run has produced so far — a category never silently
 * disappears while a run is in progress.
 */
export function CoverageMatrix({ projectId, runId }: CoverageMatrixProps) {
  const coverageQuery = useAnalysisCoverageQuery(projectId, runId);

  if (coverageQuery.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }

  const rows = buildCoverageMatrix(coverageQuery.data?.items ?? []);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>Rationale</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="text-xs text-muted-foreground">{row.order}</TableCell>
              <TableCell className="font-medium text-foreground">{row.label}</TableCell>
              <TableCell>
                {row.entry ? (
                  <SeverityIndicator
                    size="sm"
                    severity={getCoverageStatusMeta(row.entry.status).severity}
                    label={getCoverageStatusMeta(row.entry.status).label}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Not yet analyzed</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.entry ? formatCoverageEvidenceState(row.entry.evidenceState) : "—"}
              </TableCell>
              <TableCell
                className="max-w-xs truncate text-xs text-muted-foreground"
                title={row.entry?.rationale}
              >
                {row.entry?.rationale ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
