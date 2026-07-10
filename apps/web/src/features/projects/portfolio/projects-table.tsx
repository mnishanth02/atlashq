import { Link } from "@tanstack/react-router";
import { ProjectStatusBadge, SeverityIndicator } from "@/components/atlas";
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
  formatPersonName,
  formatProjectClient,
  formatProjectDate,
  formatProjectPhase,
  formatProjectPriority,
  formatRelativeUpdated,
  type ProjectListItem,
  projectPriorityToSeverity,
  summarizeTags,
} from "./portfolio-presentation";

const TABLE_COLUMNS = [
  "Project",
  "Status",
  "Owner",
  "Tech lead",
  "Phase",
  "Priority",
  "Target",
  "Tags",
  "Updated",
] as const;

/** Desktop table treatment; each row links to the project detail via a name overlay. */
export function ProjectsTable({ projects, now }: { projects: ProjectListItem[]; now: Date }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {TABLE_COLUMNS.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id} className="relative">
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="font-medium text-foreground underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {project.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {formatProjectClient(project)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <ProjectStatusBadge status={project.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatPersonName(project.owner)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatPersonName(project.techLead)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatProjectPhase(project.phase)}
              </TableCell>
              <TableCell>
                <SeverityIndicator
                  severity={projectPriorityToSeverity(project.priority)}
                  label={formatProjectPriority(project.priority)}
                  size="sm"
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatProjectDate(project.targetDate)}
              </TableCell>
              <TableCell>
                <TagRow tags={project.tags} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatRelativeUpdated(project.updatedAt, now)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TagRow({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const { visible, overflow } = summarizeTags(tags, 2);
  return (
    <div className="relative z-10 flex w-fit flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <Badge key={tag} variant="outline" className="font-normal">
          {tag}
        </Badge>
      ))}
      {overflow > 0 ? <span className="text-xs text-muted-foreground">+{overflow}</span> : null}
    </div>
  );
}
