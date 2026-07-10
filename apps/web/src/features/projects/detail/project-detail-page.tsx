"use client";

import { Link } from "@tanstack/react-router";
import {
  ArchiveIcon,
  CircleAlertIcon,
  CircleHelpIcon,
  CompassIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HandshakeIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ProjectStatusBadge } from "@/components/atlas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectResponse } from "@/features/api";
import {
  useArchiveProjectMutation,
  useCurrentUserQuery,
  useProjectDashboardQuery,
  useProjectMembershipsQuery,
  useProjectQuery,
  useRestoreProjectMutation,
} from "@/features/api";
import { useSession } from "@/lib/auth-client";
import { ProjectActivityPanel } from "../activity/project-activity-panel";
import { ProjectMembershipPanel } from "../membership/project-membership-panel";
import { EditProjectDialog } from "./edit-project-dialog";
import {
  buildDashboardCardViewModels,
  deriveProjectPermissionState,
  findCurrentActiveMembership,
  formatAtlasErrorMessage,
  formatDateTimeUtc,
  formatProjectDate,
  formatProjectPhaseLabel,
  formatProjectPriorityLabel,
  formatProjectTypeLabel,
  formatProjectVisibilityLabel,
  getAtlasErrorStatus,
  getPlaceholderTabDefinition,
  PROJECT_WORKSPACE_TABS,
  type ProjectPermissionState,
  type WorkspacePlaceholderDefinition,
  type WorkspaceTabKey,
} from "./project-detail-model";

const META_SKELETON_KEYS = [
  "meta-1",
  "meta-2",
  "meta-3",
  "meta-4",
  "meta-5",
  "meta-6",
  "meta-7",
  "meta-8",
] as const;

const READINESS_SKELETON_KEYS = [
  "readiness-1",
  "readiness-2",
  "readiness-3",
  "readiness-4",
  "readiness-5",
  "readiness-6",
] as const;

const READINESS_ICON_MAP = {
  sourceDocuments: FileTextIcon,
  requirements: ListTodoIcon,
  openQuestions: CircleHelpIcon,
  risksAndDeliveryItems: ShieldAlertIcon,
  architectureReview: CompassIcon,
  baselineAndHandoff: HandshakeIcon,
} as const;

type ProjectDetailPageProps = {
  projectId: string;
};

function ProjectMetaItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm font-medium">{value}</div>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <output aria-label="Loading project workspace" className="flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-4 border-b">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {META_SKELETON_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-48" />
        </CardFooter>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {READINESS_SKELETON_KEYS.map((key) => (
          <Card key={key}>
            <CardHeader className="border-b">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
            <CardFooter className="border-t">
              <Skeleton className="h-5 w-28" />
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b">
          <Skeleton className="h-9 w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </output>
  );
}

function ProjectRouteState({
  kind,
  projectId,
  description,
  onRetry,
}: {
  kind: "forbidden" | "not-found" | "error";
  projectId: string;
  description: string;
  onRetry: () => void;
}) {
  const icon =
    kind === "forbidden"
      ? ShieldAlertIcon
      : kind === "not-found"
        ? FolderKanbanIcon
        : TriangleAlertIcon;
  const title =
    kind === "forbidden"
      ? "Access denied"
      : kind === "not-found"
        ? "Project not found"
        : "Couldn't load project workspace";

  const Icon = icon;

  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          {description} <span className="font-mono text-xs text-muted-foreground">{projectId}</span>
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            Retry
          </Button>
          <Button asChild>
            <Link to="/projects">Back to projects</Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}

function describeProjectType(project: ProjectResponse) {
  if (project.type === "client") {
    return project.client
      ? `${formatProjectTypeLabel(project.type)} · ${project.client.name}`
      : "Client project";
  }

  return formatProjectTypeLabel(project.type);
}

function describeViewerAccess(permissions: ProjectPermissionState) {
  if (permissions.isArchived && permissions.canRestoreProject) {
    return "Archived workspace · restore is available and other edits stay frozen.";
  }

  if (permissions.isOrganizationAdmin) {
    return "Organization admin · project administration is enabled.";
  }

  if (permissions.isProjectOwner) {
    return "Project Owner · project administration is enabled.";
  }

  if (permissions.currentMembershipRole) {
    return permissions.canEditProject
      ? `${permissions.currentMembershipRole} · project metadata editing is enabled.`
      : `${permissions.currentMembershipRole} · this route stays read-only for management controls.`;
  }

  return "Read-only workspace view · no project-admin capability was derived in the browser.";
}

function ProjectReadinessSection({
  isPending,
  error,
  cards,
  onRetry,
  onSelectTab,
}: {
  isPending: boolean;
  error: unknown;
  cards: ReturnType<typeof buildDashboardCardViewModels>;
  onRetry: () => void;
  onSelectTab: (tabKey: WorkspaceTabKey) => void;
}) {
  if (isPending) {
    return (
      <output
        aria-label="Loading dashboard readiness"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {READINESS_SKELETON_KEYS.map((key) => (
          <Card key={`project-${key}`}>
            <CardHeader className="border-b">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
            <CardFooter className="border-t">
              <Skeleton className="h-5 w-28" />
            </CardFooter>
          </Card>
        ))}
      </output>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Dashboard readiness couldn't be loaded</AlertTitle>
        <AlertDescription className="gap-3">
          <p>{formatAtlasErrorMessage(error, "The readiness summary is unavailable right now.")}</p>
          <div>
            <Button variant="outline" onClick={onRetry}>
              <RotateCcwIcon data-icon="inline-start" />
              Retry dashboard
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = READINESS_ICON_MAP[card.key];

        return (
          <Card key={card.key}>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon />
                  {card.label}
                </CardTitle>
                <Badge variant={card.badgeVariant}>{card.stateLabel}</Badge>
              </div>
              <CardDescription>{card.countLabel}</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-24 flex-col justify-between gap-3">
              <p className="text-sm text-muted-foreground">{card.guidance}</p>
            </CardContent>
            <CardFooter className="border-t">
              <Button
                className="px-0"
                size="sm"
                variant="link"
                onClick={() => {
                  onSelectTab(card.tabKey);
                }}
              >
                {card.ctaLabel}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

function ProjectOverviewTab({
  project,
  permissions,
  dashboardNextActions,
}: {
  project: ProjectResponse;
  permissions: ProjectPermissionState;
  dashboardNextActions: string[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboardIcon />
            Overview
          </CardTitle>
          <CardDescription>
            Current workspace posture, next actions, and traceable governance state.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Next actions
            </span>
            {dashboardNextActions.length > 0 ? (
              <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-foreground">
                {dashboardNextActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No route-level next actions are recorded yet.
              </p>
            )}
          </div>
          <Alert>
            <LayoutDashboardIcon />
            <AlertTitle>Readiness cards stay honest.</AlertTitle>
            <AlertDescription>
              Counts and states remain zero or not started until later V1 modules record real source
              documents, requirements, questions, risks, architecture, or baseline work.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Governance posture</CardTitle>
          <CardDescription>Dense, calm, and traceable project administration.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ProjectMetaItem label="Viewer access" value={describeViewerAccess(permissions)} />
          <ProjectMetaItem
            label="Visibility"
            value={formatProjectVisibilityLabel(project.visibility)}
          />
          <ProjectMetaItem label="Created" value={formatDateTimeUtc(project.createdAt)} />
          <ProjectMetaItem label="Last updated" value={formatDateTimeUtc(project.updatedAt)} />
          <ProjectMetaItem label="Version" value={`v${project.version}`} />
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectPlaceholderTab({
  placeholder,
  cards,
  onBackToOverview,
}: {
  placeholder: WorkspacePlaceholderDefinition;
  cards: ReturnType<typeof buildDashboardCardViewModels>;
  onBackToOverview: () => void;
}) {
  const currentCards = cards.filter((card) => placeholder.dashboardCardKeys.includes(card.key));

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Upcoming V1 module</Badge>
          {currentCards.map((card) => (
            <Badge key={`${placeholder.key}-${card.key}`} variant={card.badgeVariant}>
              {card.label}: {card.stateLabel}
            </Badge>
          ))}
        </div>
        <CardTitle>{placeholder.heading}</CardTitle>
        <CardDescription>{placeholder.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {currentCards.map((card) => (
          <div
            key={`${placeholder.key}-status-${card.key}`}
            className="rounded-lg border bg-muted/20 p-4"
          >
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{card.label}</span>
              <p className="text-sm text-muted-foreground">
                {card.stateLabel} · {card.countLabel}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
        <p className="text-sm text-muted-foreground">{placeholder.upcomingModule}</p>
        <Button variant="link" onClick={onBackToOverview}>
          Back to overview
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProjectHeaderActions({
  project,
  permissions,
  currentUser,
}: {
  project: ProjectResponse;
  permissions: ProjectPermissionState;
  currentUser: { id: string; name: string } | undefined;
}) {
  const archiveProjectMutation = useArchiveProjectMutation();
  const restoreProjectMutation = useRestoreProjectMutation();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const editAction =
    permissions.canEditProject && project.status !== "archived" ? (
      <EditProjectDialog
        canTransferOwner={permissions.canTransferOwner}
        currentUser={currentUser}
        project={project}
      />
    ) : null;

  const isArchived = project.status === "archived";

  if (!editAction && !permissions.canArchiveProject && !permissions.canRestoreProject) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {editAction}

      {permissions.canArchiveProject && !isArchived ? (
        <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline">
              <ArchiveIcon data-icon="inline-start" />
              Archive
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <ArchiveIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Archive this project?</AlertDialogTitle>
              <AlertDialogDescription>
                Archived projects stay readable, but edits and membership changes are frozen until
                the workspace is restored.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={archiveProjectMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={archiveProjectMutation.isPending}
                variant="destructive"
                onClick={async (event) => {
                  event.preventDefault();
                  try {
                    await archiveProjectMutation.mutateAsync(project.id);
                    toast.success("Project archived.", {
                      description: `${project.name} remains readable and can be restored later.`,
                    });
                    setArchiveOpen(false);
                  } catch (error) {
                    toast.error("Couldn't archive project.", {
                      description: formatAtlasErrorMessage(
                        error,
                        "The project archive request did not complete.",
                      ),
                    });
                  }
                }}
              >
                {archiveProjectMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                Archive project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {permissions.canRestoreProject ? (
        <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
          <AlertDialogTrigger asChild>
            <Button>
              <RotateCcwIcon data-icon="inline-start" />
              Restore project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <RotateCcwIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Restore this project?</AlertDialogTitle>
              <AlertDialogDescription>
                Restoring the workspace re-enables project administration, membership changes, and
                future module workflows.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={restoreProjectMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={restoreProjectMutation.isPending}
                onClick={async (event) => {
                  event.preventDefault();
                  try {
                    await restoreProjectMutation.mutateAsync(project.id);
                    toast.success("Project restored.", {
                      description: `${project.name} is active for workspace administration again.`,
                    });
                    setRestoreOpen(false);
                  } catch (error) {
                    toast.error("Couldn't restore project.", {
                      description: formatAtlasErrorMessage(
                        error,
                        "The project restore request did not complete.",
                      ),
                    });
                  }
                }}
              >
                {restoreProjectMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                Restore project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>("overview");
  const projectQuery = useProjectQuery(projectId);
  const dashboardQuery = useProjectDashboardQuery(projectId);
  const currentUserQuery = useCurrentUserQuery();
  const { data: session } = useSession();

  const viewer = currentUserQuery.data?.user
    ? {
        id: currentUserQuery.data.user.id,
        organizationRole: currentUserQuery.data.user.organizationRole,
        status: currentUserQuery.data.user.status,
      }
    : session?.user
      ? {
          id: session.user.id,
          organizationRole: session.user.organizationRole ?? "member",
          status: session.user.status,
        }
      : null;

  const viewerMembershipQuery = useProjectMembershipsQuery(
    projectId && viewer?.id ? projectId : undefined,
    viewer?.id
      ? {
          userId: viewer.id,
          status: "active",
          limit: 1,
        }
      : {},
  );

  const onRetryAll = () => {
    void Promise.all([
      projectQuery.refetch(),
      dashboardQuery.refetch(),
      currentUserQuery.refetch(),
      viewerMembershipQuery.refetch(),
    ]);
  };

  if (projectQuery.isPending) {
    return <ProjectDetailSkeleton />;
  }

  if (projectQuery.isError) {
    const status = getAtlasErrorStatus(projectQuery.error);

    if (status === 403) {
      return (
        <ProjectRouteState
          kind="forbidden"
          description="Your account can’t open this project workspace."
          onRetry={onRetryAll}
          projectId={projectId}
        />
      );
    }

    if (status === 404) {
      return (
        <ProjectRouteState
          kind="not-found"
          description="The requested project could not be found."
          onRetry={onRetryAll}
          projectId={projectId}
        />
      );
    }

    return (
      <ProjectRouteState
        kind="error"
        description={formatAtlasErrorMessage(
          projectQuery.error,
          "The project workspace could not be loaded.",
        )}
        onRetry={onRetryAll}
        projectId={projectId}
      />
    );
  }

  const project = projectQuery.data;
  const currentUser = currentUserQuery.data?.user
    ? { id: currentUserQuery.data.user.id, name: currentUserQuery.data.user.name }
    : session?.user
      ? { id: session.user.id, name: session.user.name }
      : undefined;
  const viewerMembership = findCurrentActiveMembership(
    viewerMembershipQuery.data?.items ?? [],
    viewer?.id,
  );
  const permissions = deriveProjectPermissionState({
    project,
    viewer,
    viewerMembership: viewerMembership
      ? {
          userId: viewerMembership.userId,
          role: viewerMembership.role,
          status: viewerMembership.status,
          softDeletedAt: viewerMembership.softDeletedAt,
        }
      : null,
  });
  const dashboardCards = dashboardQuery.data
    ? buildDashboardCardViewModels(dashboardQuery.data.cards)
    : [];
  const selectedPlaceholder = getPlaceholderTabDefinition(activeTab);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-4 border-b">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Project workspace</Badge>
            <ProjectStatusBadge status={project.status} />
            <Badge variant="outline">{describeProjectType(project)}</Badge>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                <CardDescription>{describeProjectType(project)}</CardDescription>
              </div>
              <p className="max-w-4xl text-sm/relaxed text-foreground">
                {project.description ?? "No project description has been recorded yet."}
              </p>
            </div>

            <ProjectHeaderActions
              currentUser={currentUser}
              permissions={permissions}
              project={project}
            />
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ProjectMetaItem label="Project type" value={formatProjectTypeLabel(project.type)} />
          <ProjectMetaItem
            label="Client"
            value={
              project.client?.name ?? (project.type === "client" ? "Client not assigned" : "N/A")
            }
          />
          <ProjectMetaItem
            label="Priority"
            value={<Badge variant="outline">{formatProjectPriorityLabel(project.priority)}</Badge>}
          />
          <ProjectMetaItem
            label="Phase"
            value={<Badge variant="outline">{formatProjectPhaseLabel(project.phase)}</Badge>}
          />
          <ProjectMetaItem
            label="Project owner"
            value={project.owner?.name ?? project.ownerId}
            hint={project.owner?.id ?? project.ownerId}
          />
          <ProjectMetaItem
            label="Tech lead"
            value={project.techLead?.name ?? project.techLeadId ?? "Unassigned"}
            hint={project.techLead?.id ?? undefined}
          />
          <ProjectMetaItem
            label="Business owner"
            value={project.businessOwner?.name ?? project.businessOwnerId ?? "Unassigned"}
            hint={project.businessOwner?.id ?? undefined}
          />
          <ProjectMetaItem label="Start date" value={formatProjectDate(project.startDate)} />
          <ProjectMetaItem label="Target date" value={formatProjectDate(project.targetDate)} />
          <ProjectMetaItem
            label="Tags"
            value={
              project.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                "No tags"
              )
            }
          />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
          <span className="text-sm text-muted-foreground">
            Visibility: {formatProjectVisibilityLabel(project.visibility)}
          </span>
          <span className="min-w-0 break-words text-sm text-muted-foreground">
            Project ID <span className="font-mono text-xs">{project.id}</span> · Updated{" "}
            {formatDateTimeUtc(project.updatedAt)}
          </span>
        </CardFooter>
      </Card>

      {project.status === "archived" ? (
        <Alert>
          <ArchiveIcon />
          <AlertTitle>Archived projects remain readable.</AlertTitle>
          <AlertDescription>
            The workspace stays visible for traceability. Restore is the only project mutation
            available, and only to organization admins or the Project Owner.
          </AlertDescription>
        </Alert>
      ) : null}

      <ProjectReadinessSection
        cards={dashboardCards}
        error={dashboardQuery.error}
        isPending={dashboardQuery.isPending}
        onRetry={() => {
          void dashboardQuery.refetch();
        }}
        onSelectTab={setActiveTab}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTabKey)}>
        <div className="overflow-x-auto pb-1">
          <TabsList variant="line" className="min-w-max">
            {PROJECT_WORKSPACE_TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <ProjectOverviewTab
            dashboardNextActions={dashboardQuery.data?.nextActions ?? []}
            permissions={permissions}
            project={project}
          />
        </TabsContent>

        {selectedPlaceholder ? (
          <TabsContent value={selectedPlaceholder.key}>
            <ProjectPlaceholderTab
              cards={dashboardCards}
              onBackToOverview={() => setActiveTab("overview")}
              placeholder={selectedPlaceholder}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="members">
          <ProjectMembershipPanel
            canManageMembers={permissions.canManageMembers}
            isArchived={project.status === "archived"}
            projectId={project.id}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ProjectActivityPanel projectId={project.id} viewerId={viewer?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
