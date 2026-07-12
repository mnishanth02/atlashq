import { projectRoles } from "@atlashq/types";
import { describe, expect, it } from "vitest";
import type { ProjectDashboardResponse } from "@/features/api";
import {
  buildDashboardCardViewModels,
  deriveProjectPermissionState,
  findCurrentActiveMembership,
  formatDateTimeUtc,
  formatProjectDate,
  getPlaceholderTabDefinition,
  PROJECT_PLACEHOLDER_TABS,
} from "./project-detail-model";

function dashboardCards(): ProjectDashboardResponse["cards"] {
  return {
    sourceDocuments: { state: "not_started", count: 0, label: "Source documents" },
    requirements: { state: "not_started", count: 0, label: "Requirements" },
    openQuestions: { state: "not_started", count: 0, label: "Open questions" },
    risksAndDeliveryItems: { state: "zero", count: 0, label: "Risks & delivery items" },
    architectureReview: { state: "setup_required", count: 0, label: "Architecture review" },
    baselineAndHandoff: { state: "not_started", count: 0, label: "Baseline & handoff" },
  };
}

describe("deriveProjectPermissionState", () => {
  it("grants management controls to organization admins", () => {
    expect(
      deriveProjectPermissionState({
        project: { status: "active" },
        viewer: { id: "user-1", organizationRole: "admin", status: "active" },
        viewerMembership: null,
      }),
    ).toMatchObject({
      isOrganizationAdmin: true,
      canEditProject: true,
      canTransferOwner: true,
      canArchiveProject: true,
      canManageMembers: true,
      canRestoreProject: false,
      isReadOnly: false,
    });
  });

  it("grants management controls to an active Project Owner", () => {
    expect(
      deriveProjectPermissionState({
        project: { status: "active" },
        viewer: { id: "user-2", organizationRole: "member", status: "active" },
        viewerMembership: {
          userId: "user-2",
          role: projectRoles.projectOwner,
          status: "active",
          softDeletedAt: null,
        },
      }),
    ).toMatchObject({
      isProjectOwner: true,
      canEditProject: true,
      canTransferOwner: true,
      canArchiveProject: true,
      canManageMembers: true,
      isReadOnly: false,
    });
  });

  it.each([
    projectRoles.developer,
    projectRoles.architectTechLead,
    projectRoles.businessAnalystCoordinator,
  ])("allows %s to edit metadata without project-admin controls", (role) => {
    expect(
      deriveProjectPermissionState({
        project: { status: "active" },
        viewer: { id: "editor", organizationRole: "member", status: "active" },
        viewerMembership: {
          userId: "editor",
          role,
          status: "active",
          softDeletedAt: null,
        },
      }),
    ).toMatchObject({
      canEditProject: true,
      canTransferOwner: false,
      canArchiveProject: false,
      canManageMembers: false,
      isReadOnly: false,
    });
  });

  it("keeps roles without project:write read-only", () => {
    expect(
      deriveProjectPermissionState({
        project: { status: "active" },
        viewer: { id: "viewer", organizationRole: "member", status: "active" },
        viewerMembership: {
          userId: "viewer",
          role: projectRoles.clientViewerApprover,
          status: "active",
          softDeletedAt: null,
        },
      }),
    ).toMatchObject({
      canEditProject: false,
      canTransferOwner: false,
      canManageMembers: false,
      isReadOnly: true,
    });
  });

  it("freezes archived workspaces except restore for project admins", () => {
    expect(
      deriveProjectPermissionState({
        project: { status: "archived" },
        viewer: { id: "user-2", organizationRole: "member", status: "active" },
        viewerMembership: {
          userId: "user-2",
          role: projectRoles.projectOwner,
          status: "active",
          softDeletedAt: null,
        },
      }),
    ).toMatchObject({
      canEditProject: false,
      canArchiveProject: false,
      canManageMembers: false,
      canRestoreProject: true,
      isReadOnly: true,
    });
  });

  it("does not grant ownership from another user's membership", () => {
    expect(
      deriveProjectPermissionState({
        project: { status: "active" },
        viewer: { id: "viewer", organizationRole: "member", status: "active" },
        viewerMembership: {
          userId: "another-user",
          role: projectRoles.projectOwner,
          status: "active",
          softDeletedAt: null,
        },
      }),
    ).toMatchObject({
      isProjectOwner: false,
      canEditProject: false,
      canManageMembers: false,
      isReadOnly: true,
    });
  });
});

describe("findCurrentActiveMembership", () => {
  it("selects only the viewer's active, non-deleted membership", () => {
    expect(
      findCurrentActiveMembership(
        [
          {
            userId: "other-user",
            role: projectRoles.projectOwner,
            status: "active",
            softDeletedAt: null,
          },
          {
            userId: "viewer",
            role: projectRoles.developer,
            status: "active",
            softDeletedAt: null,
          },
        ],
        "viewer",
      ),
    ).toMatchObject({ userId: "viewer", role: projectRoles.developer });
  });

  it("returns null for missing, removed, or soft-deleted membership", () => {
    expect(findCurrentActiveMembership([], undefined)).toBeNull();
    expect(
      findCurrentActiveMembership(
        [
          {
            userId: "viewer",
            role: projectRoles.projectOwner,
            status: "removed",
            softDeletedAt: "2026-07-10T00:00:00.000Z",
          },
        ],
        "viewer",
      ),
    ).toBeNull();
  });
});

describe("buildDashboardCardViewModels", () => {
  it("maps real dashboard cards to workspace tabs and CTA labels", () => {
    expect(buildDashboardCardViewModels(dashboardCards())).toEqual([
      expect.objectContaining({
        key: "sourceDocuments",
        tabKey: "source-documents",
        stateLabel: "Not started",
        ctaLabel: "Open source documents",
      }),
      expect.objectContaining({
        key: "requirements",
        tabKey: "requirements",
      }),
      expect.objectContaining({
        key: "openQuestions",
        tabKey: "questions-risks",
      }),
      expect.objectContaining({
        key: "risksAndDeliveryItems",
        tabKey: "questions-risks",
        stateLabel: "Zero recorded",
      }),
      expect.objectContaining({
        key: "architectureReview",
        stateLabel: "Setup required",
      }),
      expect.objectContaining({
        key: "baselineAndHandoff",
        tabKey: "baseline-handoff",
      }),
    ]);
  });
});

describe("workspace placeholder metadata", () => {
  it("defines placeholders only for later-module tabs", () => {
    expect(PROJECT_PLACEHOLDER_TABS).toHaveLength(3);
    expect(getPlaceholderTabDefinition("questions-risks")).toEqual(
      expect.objectContaining({
        heading: "Questions and risks tracking is planned for V1",
        dashboardCardKeys: ["openQuestions", "risksAndDeliveryItems"],
      }),
    );
    expect(getPlaceholderTabDefinition("overview")).toBeUndefined();
    expect(getPlaceholderTabDefinition("source-documents")).toBeUndefined();
    expect(getPlaceholderTabDefinition("requirements")).toBeUndefined();
  });
});

describe("date formatting helpers", () => {
  it("formats project dates in a stable UTC presentation", () => {
    expect(formatProjectDate("2026-07-10T05:11:35.805Z")).toBe("10 Jul 2026");
    expect(formatDateTimeUtc("2026-07-10T05:11:35.805Z")).toBe("10 Jul 2026, 05:11 UTC");
  });

  it("returns clear fallback labels for missing dates", () => {
    expect(formatProjectDate(null)).toBe("No date set");
    expect(formatDateTimeUtc(undefined)).toBe("No timestamp recorded");
  });
});
