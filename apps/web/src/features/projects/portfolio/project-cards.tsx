import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ProjectStatusBadge, SeverityIndicator } from "@/components/atlas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

/** Mobile / narrow-viewport treatment; the whole card links to project detail. */
export function ProjectCards({ projects, now }: { projects: ProjectListItem[]; now: Date }) {
  return (
    <div className="grid gap-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Card className="gap-4 py-4 transition-colors hover:border-ring/40">
            <CardHeader className="gap-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <CardTitle className="min-w-0 break-words text-base">{project.name}</CardTitle>
                <div className="shrink-0">
                  <ProjectStatusBadge status={project.status} />
                </div>
              </div>
              <CardDescription>{formatProjectClient(project)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Meta label="Owner" value={formatPersonName(project.owner)} />
                <Meta label="Phase" value={formatProjectPhase(project.phase)} />
                <Meta
                  label="Priority"
                  value={
                    <SeverityIndicator
                      severity={projectPriorityToSeverity(project.priority)}
                      label={formatProjectPriority(project.priority)}
                      size="sm"
                    />
                  }
                />
                <Meta label="Target" value={formatProjectDate(project.targetDate)} />
              </dl>
              <TagRow tags={project.tags} />
              <p className="text-xs text-muted-foreground">
                Updated {formatRelativeUpdated(project.updatedAt, now)}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function TagRow({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) {
    return null;
  }
  const { visible, overflow } = summarizeTags(tags, 4);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <Badge key={tag} variant="outline" className="font-normal">
          {tag}
        </Badge>
      ))}
      {overflow > 0 ? <span className="text-xs text-muted-foreground">+{overflow}</span> : null}
    </div>
  );
}
