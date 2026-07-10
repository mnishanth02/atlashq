import type { ProjectPhase, ProjectPriority, ProjectType, ProjectVisibility } from "@atlashq/types";
import type { Severity } from "@/components/atlas";
import type { ProjectListResponse } from "@/features/api";

/** A single row from the projects list endpoint. */
export type ProjectListItem = ProjectListResponse["items"][number];

const EM_DASH = "—";

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  client: "Client",
  internal: "Internal",
};

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  intake: "Intake",
  requirements: "Requirements",
  clarification: "Clarification",
  baseline: "Baseline",
  architecture: "Architecture",
  delivery: "Delivery",
  handoff: "Handoff",
  closed: "Closed",
};

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  private: "Private",
  organization: "Organization",
};

/**
 * Project priority maps onto the shared severity vocabulary (`low`…`critical`),
 * letting portfolio rows reuse the audited severity tokens instead of inventing
 * a colour scale. Teal stays reserved for actions/focus.
 */
export function projectPriorityToSeverity(priority: ProjectPriority): Severity {
  return priority;
}

export function formatProjectType(type: ProjectType): string {
  return PROJECT_TYPE_LABELS[type];
}

export function formatProjectPhase(phase: ProjectPhase): string {
  return PROJECT_PHASE_LABELS[phase];
}

export function formatProjectPriority(priority: ProjectPriority): string {
  return PROJECT_PRIORITY_LABELS[priority];
}

export function formatProjectVisibility(visibility: ProjectVisibility): string {
  return PROJECT_VISIBILITY_LABELS[visibility];
}

/**
 * The "client / type" cell: an internal project reads as "Internal"; a client
 * project shows its client's name, or a clear placeholder when the link is
 * missing.
 */
export function formatProjectClient(project: Pick<ProjectListItem, "type" | "client">): string {
  if (project.type === "internal") {
    return "Internal";
  }
  return project.client?.name ?? "Unassigned client";
}

export function formatPersonName(
  person: { name: string } | null | undefined,
  fallback = EM_DASH,
): string {
  return person?.name ?? fallback;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Format an ISO datetime as a short UTC calendar date (`Jun 1, 2024`). */
export function formatProjectDate(iso: string | null | undefined, fallback = EM_DASH): string {
  if (!iso) {
    return fallback;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return dateFormatter.format(date);
}

const relativeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const RELATIVE_UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

/**
 * Relative "updated" label (`2 days ago`, `just now`). `now` is injectable so
 * the output is deterministic under test.
 */
export function formatRelativeUpdated(
  iso: string | null | undefined,
  now: Date = new Date(),
  fallback = EM_DASH,
): string {
  if (!iso) {
    return fallback;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const diffMs = date.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);

  for (const { unit, ms } of RELATIVE_UNITS) {
    if (absMs >= ms) {
      return relativeFormatter.format(Math.round(diffMs / ms), unit);
    }
  }
  return "just now";
}

/**
 * Split a tag list into the first `max` tags plus an overflow count, for a
 * compact "+N" affordance.
 */
export function summarizeTags(
  tags: readonly string[],
  max = 3,
): { visible: string[]; overflow: number } {
  const visible = tags.slice(0, max);
  return { visible, overflow: Math.max(0, tags.length - visible.length) };
}
