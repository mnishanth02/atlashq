import type { ProjectRole, ProjectType, ProjectVisibility } from "@atlashq/types";
import {
  canProjectRole,
  type OrganizationRole,
  type ProjectPhase,
  type ProjectPriority,
  projectRoles,
} from "@atlashq/types";
import type { ProjectDashboardResponse, ProjectResponse } from "../../api";
import { AtlasApiError } from "../../api";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type DashboardCardKey = keyof ProjectDashboardResponse["cards"];

export type WorkspaceTabKey =
  | "overview"
  | "source-documents"
  | "requirements"
  | "questions-risks"
  | "architecture"
  | "baseline-handoff"
  | "members"
  | "activity";

type WorkspaceTabDefinition = {
  key: WorkspaceTabKey;
  label: string;
  kind: "live" | "placeholder";
};

export type WorkspacePlaceholderDefinition = WorkspaceTabDefinition & {
  kind: "placeholder";
  heading: string;
  description: string;
  upcomingModule: string;
  dashboardCardKeys: DashboardCardKey[];
};

type DashboardCardMeta = {
  tabKey: WorkspaceTabKey;
  ctaLabel: string;
  guidance: string;
  badgeVariant: "outline" | "secondary";
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  client: "Client project",
  internal: "Internal project",
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
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
  critical: "Critical priority",
};

export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  private: "Private workspace",
  organization: "Organization workspace",
};

const DASHBOARD_CARD_ORDER: DashboardCardKey[] = [
  "sourceDocuments",
  "requirements",
  "openQuestions",
  "risksAndDeliveryItems",
  "architectureReview",
  "baselineAndHandoff",
];

const DASHBOARD_STATE_LABELS = {
  zero: "Zero recorded",
  not_started: "Not started",
  setup_required: "Setup required",
  ready: "Ready",
} as const satisfies Record<ProjectDashboardResponse["cards"][DashboardCardKey]["state"], string>;

const DASHBOARD_CARD_META: Record<DashboardCardKey, DashboardCardMeta> = {
  sourceDocuments: {
    tabKey: "source-documents",
    ctaLabel: "Open source documents",
    guidance: "Collect the first source materials for this workspace.",
    badgeVariant: "secondary",
  },
  requirements: {
    tabKey: "requirements",
    ctaLabel: "Open requirement analysis",
    guidance: "Start capturing requirements against source evidence.",
    badgeVariant: "secondary",
  },
  openQuestions: {
    tabKey: "questions-risks",
    ctaLabel: "Open questions & risks",
    guidance: "Track questions before scope and delivery drift.",
    badgeVariant: "secondary",
  },
  risksAndDeliveryItems: {
    tabKey: "questions-risks",
    ctaLabel: "Review questions & risks",
    guidance: "Record the first risk or delivery item when it appears.",
    badgeVariant: "outline",
  },
  architectureReview: {
    tabKey: "architecture",
    ctaLabel: "Open architecture",
    guidance: "Prepare the architecture review space for later V1 work.",
    badgeVariant: "secondary",
  },
  baselineAndHandoff: {
    tabKey: "baseline-handoff",
    ctaLabel: "Open baseline & handoff",
    guidance: "Keep the baseline and handoff surface ready for approvals.",
    badgeVariant: "secondary",
  },
};

export const PROJECT_WORKSPACE_TABS: WorkspaceTabDefinition[] = [
  { key: "overview", label: "Overview", kind: "live" },
  { key: "source-documents", label: "Source Documents", kind: "live" },
  { key: "requirements", label: "Requirements", kind: "live" },
  { key: "questions-risks", label: "Questions & Risks", kind: "placeholder" },
  { key: "architecture", label: "Architecture", kind: "placeholder" },
  { key: "baseline-handoff", label: "Baseline & Handoff", kind: "placeholder" },
  { key: "members", label: "Members", kind: "live" },
  { key: "activity", label: "Activity", kind: "live" },
];

export const PROJECT_PLACEHOLDER_TABS: WorkspacePlaceholderDefinition[] = [
  {
    key: "questions-risks",
    label: "Questions & Risks",
    kind: "placeholder",
    heading: "Questions and risks tracking is planned for V1",
    description:
      "This route is prepared for the future question log and risk register without implying any of that analysis already exists.",
    upcomingModule:
      "Upcoming V1 module: open questions, risks, and delivery-item tracking with explicit follow-up ownership.",
    dashboardCardKeys: ["openQuestions", "risksAndDeliveryItems"],
  },
  {
    key: "architecture",
    label: "Architecture",
    kind: "placeholder",
    heading: "Architecture review is planned for V1",
    description:
      "Architecture review, decision records, and technical trade-off capture will appear here in a later V1 module.",
    upcomingModule:
      "Upcoming V1 module: architecture review checkpoints, decisions, and delivery guardrails.",
    dashboardCardKeys: ["architectureReview"],
  },
  {
    key: "baseline-handoff",
    label: "Baseline & Handoff",
    kind: "placeholder",
    heading: "Baseline and handoff are planned for V1",
    description:
      "Baseline approval, handoff packaging, and manual approval trace will live here once those workflows are delivered.",
    upcomingModule:
      "Upcoming V1 module: baseline packaging, approval history, and handoff-ready exports.",
    dashboardCardKeys: ["baselineAndHandoff"],
  },
];

export type DashboardCardViewModel = {
  key: DashboardCardKey;
  label: string;
  count: number;
  countLabel: string;
  state: ProjectDashboardResponse["cards"][DashboardCardKey]["state"];
  stateLabel: string;
  badgeVariant: "outline" | "secondary";
  ctaLabel: string;
  guidance: string;
  tabKey: WorkspaceTabKey;
};

type ViewerIdentity = {
  id: string;
  organizationRole: OrganizationRole | (string & {});
  status: string | null | undefined;
};

type ViewerMembership = {
  userId: string;
  role: ProjectRole;
  status: string;
  softDeletedAt: string | null;
};

export type ProjectPermissionState = {
  currentMembershipRole: ProjectRole | null;
  isOrganizationAdmin: boolean;
  isProjectOwner: boolean;
  isArchived: boolean;
  canManageProject: boolean;
  canEditProject: boolean;
  canTransferOwner: boolean;
  canArchiveProject: boolean;
  canRestoreProject: boolean;
  canManageMembers: boolean;
  isReadOnly: boolean;
};

export function findCurrentActiveMembership(
  memberships: readonly ViewerMembership[],
  viewerId: string | undefined,
): ViewerMembership | null {
  if (!viewerId) {
    return null;
  }

  return (
    memberships.find(
      (membership) =>
        membership.userId === viewerId &&
        membership.status === "active" &&
        membership.softDeletedAt === null,
    ) ?? null
  );
}

export function buildDashboardCardViewModels(
  cards: ProjectDashboardResponse["cards"],
): DashboardCardViewModel[] {
  return DASHBOARD_CARD_ORDER.map((key) => {
    const card = cards[key];
    const meta = DASHBOARD_CARD_META[key];

    return {
      key,
      label: card.label,
      count: card.count,
      countLabel: `${card.count} recorded`,
      state: card.state,
      stateLabel: DASHBOARD_STATE_LABELS[card.state],
      badgeVariant: meta.badgeVariant,
      ctaLabel: meta.ctaLabel,
      guidance: meta.guidance,
      tabKey: meta.tabKey,
    };
  });
}

export function getPlaceholderTabDefinition(
  tabKey: WorkspaceTabKey,
): WorkspacePlaceholderDefinition | undefined {
  return PROJECT_PLACEHOLDER_TABS.find((tab) => tab.key === tabKey);
}

export function deriveProjectPermissionState(input: {
  project: Pick<ProjectResponse, "status">;
  viewer: ViewerIdentity | null;
  viewerMembership: ViewerMembership | null;
}): ProjectPermissionState {
  const { project, viewer, viewerMembership } = input;
  const viewerIsActive =
    viewer !== null && (viewer.status === undefined || viewer.status === "active");
  const activeMembership =
    viewerIsActive &&
    viewerMembership !== null &&
    viewerMembership.userId === viewer?.id &&
    viewerMembership.status === "active" &&
    viewerMembership.softDeletedAt === null
      ? viewerMembership
      : null;
  const isOrganizationAdmin =
    viewerIsActive && viewer?.organizationRole === ("admin" as OrganizationRole);
  const isProjectOwner = activeMembership?.role === projectRoles.projectOwner;
  const isArchived = project.status === "archived";
  const canWriteProject =
    isOrganizationAdmin ||
    (activeMembership !== null && canProjectRole(activeMembership.role, "project:write"));
  const canManageProject =
    isOrganizationAdmin ||
    (activeMembership !== null && canProjectRole(activeMembership.role, "project:admin"));
  const canRestoreProject = canManageProject && isArchived;
  const canEditProject = canWriteProject && !isArchived;
  const canTransferOwner = canManageProject && !isArchived;
  const canArchiveProject = canManageProject && !isArchived;
  const canManageMembers = canManageProject && !isArchived;

  return {
    currentMembershipRole: activeMembership?.role ?? null,
    isOrganizationAdmin,
    isProjectOwner,
    isArchived,
    canManageProject,
    canEditProject,
    canTransferOwner,
    canArchiveProject,
    canRestoreProject,
    canManageMembers,
    isReadOnly: isArchived || !canWriteProject,
  };
}

export function formatProjectTypeLabel(type: ProjectType) {
  return PROJECT_TYPE_LABELS[type];
}

export function formatProjectPhaseLabel(phase: ProjectPhase) {
  return PROJECT_PHASE_LABELS[phase];
}

export function formatProjectPriorityLabel(priority: ProjectPriority) {
  return PROJECT_PRIORITY_LABELS[priority];
}

export function formatProjectVisibilityLabel(visibility: ProjectVisibility) {
  return PROJECT_VISIBILITY_LABELS[visibility];
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function padNumber(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatProjectDate(value: string | null | undefined) {
  if (!value) {
    return "No date set";
  }

  const date = new Date(value);

  if (!isValidDate(date)) {
    return "Unknown date";
  }

  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatDateTimeUtc(value: string | null | undefined) {
  if (!value) {
    return "No timestamp recorded";
  }

  const date = new Date(value);

  if (!isValidDate(date)) {
    return "Unknown timestamp";
  }

  return `${formatProjectDate(value)}, ${padNumber(date.getUTCHours())}:${padNumber(
    date.getUTCMinutes(),
  )} UTC`;
}

export function formatAtlasErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AtlasApiError) {
    return error.correlationId ? `${error.message} (ref ${error.correlationId})` : error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export function getAtlasErrorStatus(error: unknown) {
  return error instanceof AtlasApiError ? error.status : undefined;
}
