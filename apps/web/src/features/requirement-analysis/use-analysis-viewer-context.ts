import type { ProjectMembershipListResponse, ProjectResponse } from "@/features/api";
import {
  AtlasApiError,
  useCurrentUserQuery,
  useProjectMembershipsQuery,
  useProjectQuery,
} from "@/features/api";
import { useSession } from "@/lib/auth-client";
import type { AnalysisViewerPermissions } from "./requirement-analysis-permissions";
import { deriveAnalysisViewerPermissions } from "./requirement-analysis-permissions";

type ViewerMembership = ProjectMembershipListResponse["items"][number];

function findViewerMembership(
  memberships: readonly ViewerMembership[] | undefined,
  viewerId: string | undefined,
): ViewerMembership | null {
  if (!viewerId || !memberships) return null;
  return (
    memberships.find(
      (membership) =>
        membership.userId === viewerId &&
        membership.status === "active" &&
        membership.softDeletedAt === null,
    ) ?? null
  );
}

export type AnalysisViewerContext = {
  isLoading: boolean;
  isForbidden: boolean;
  isNotFound: boolean;
  error: unknown;
  project: ProjectResponse | undefined;
  permissions: AnalysisViewerPermissions;
  viewerId: string | undefined;
  membershipRole: ViewerMembership["role"] | null;
};

/**
 * Resolves the current viewer, project, and requirement-analysis permissions
 * for a project detail scope. Mirrors `useSourceViewerContext` so both
 * Module 2 and Module 3 surfaces share the same viewer/membership resolution
 * shape.
 */
export function useAnalysisViewerContext(projectId: string): AnalysisViewerContext {
  const projectQuery = useProjectQuery(projectId);
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
          status: session.user.status ?? "active",
        }
      : null;

  const membershipsQuery = useProjectMembershipsQuery(
    projectId && viewer?.id ? projectId : undefined,
    viewer?.id ? { userId: viewer.id, status: "active", limit: 1 } : {},
  );

  const membership = findViewerMembership(membershipsQuery.data?.items, viewer?.id);
  const project = projectQuery.data;

  const status =
    projectQuery.error instanceof AtlasApiError ? projectQuery.error.status : undefined;

  const isForbidden = status === 403;
  const isNotFound = status === 404;

  const permissions = deriveAnalysisViewerPermissions({
    organizationRole: viewer?.organizationRole ?? null,
    status: viewer?.status ?? null,
    membershipRole: membership?.role ?? null,
    membershipStatus: membership?.status ?? null,
    membershipSoftDeletedAt: membership?.softDeletedAt ?? null,
    isProjectArchived: project?.status === "archived",
  });

  return {
    isLoading: projectQuery.isPending || currentUserQuery.isPending || membershipsQuery.isPending,
    isForbidden,
    isNotFound,
    error: projectQuery.error,
    project,
    permissions,
    viewerId: viewer?.id,
    membershipRole: membership?.role ?? null,
  };
}
