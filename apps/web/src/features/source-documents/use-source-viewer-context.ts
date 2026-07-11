import type { ProjectMembershipListResponse, ProjectResponse } from "@/features/api";
import {
  AtlasApiError,
  useCurrentUserQuery,
  useProjectMembershipsQuery,
  useProjectQuery,
} from "@/features/api";
import { useSession } from "@/lib/auth-client";
import { deriveSourceViewerPermissions } from "./source-permissions";
import type { SourceViewerPermissions } from "./source-presentation";

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

export type SourceViewerContext = {
  isLoading: boolean;
  isForbidden: boolean;
  isNotFound: boolean;
  error: unknown;
  project: ProjectResponse | undefined;
  permissions: SourceViewerPermissions;
  viewerId: string | undefined;
  membershipRole: ViewerMembership["role"] | null;
};

/**
 * Resolves the current viewer, project, and source-vault permissions for a
 * project detail scope. Encapsulates the currentUser/session + memberships +
 * project fetch so both the vault list and detail pages read a stable shape.
 */
export function useSourceViewerContext(projectId: string): SourceViewerContext {
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

  const permissions = deriveSourceViewerPermissions({
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
