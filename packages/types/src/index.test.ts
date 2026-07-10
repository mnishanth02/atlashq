import { describe, expect, it } from "vitest";
import {
  type AuditMetadata,
  canProjectRole,
  isAiReviewStatus,
  isAiRunStatus,
  isMutationPermission,
  isOrganizationRole,
  isProjectPhase,
  isProjectPriority,
  isProjectRole,
  isProjectStatus,
  isProjectType,
  isProjectVisibility,
  isProjectWritableStatus,
  organizationRoles,
  organizationRoleValues,
  projectPhaseValues,
  projectPriorityValues,
  projectRoles,
  projectRolesForPermission,
  projectRoleValues,
  projectStatusValues,
  projectTypeValues,
  projectVisibilityValues,
  projectWritableStatusValues,
  rolePermissions,
} from "./index.js";

describe("project roles", () => {
  it("exposes exactly the seven V1 role constants including the client approver placeholder", () => {
    expect(projectRoleValues).toHaveLength(7);
    expect(isProjectRole(projectRoles.clientViewerApprover)).toBe(true);
    expect(projectRoles.clientViewerApprover).toBe("Client Viewer / Approver");
  });

  it("exposes the browser-safe permission matrix", () => {
    expect(rolePermissions[projectRoles.developer]).toEqual(["project:read", "project:write"]);
    expect(canProjectRole(projectRoles.developer, "project:write")).toBe(true);
    expect(canProjectRole(projectRoles.developer, "project:admin")).toBe(false);
    expect(projectRolesForPermission("project:read")).not.toContain(
      projectRoles.clientViewerApprover,
    );
    expect(isMutationPermission("project:read")).toBe(false);
  });

  it("rejects values outside the codified role set", () => {
    expect(isProjectRole("Owner")).toBe(false);
    expect(isProjectRole("")).toBe(false);
  });
});

describe("organization roles", () => {
  it("models organization membership as admin | member, separate from project roles", () => {
    expect(organizationRoleValues).toEqual(["admin", "member"]);
    expect(isOrganizationRole(organizationRoles.admin)).toBe(true);
    expect(isOrganizationRole(organizationRoles.member)).toBe(true);
    expect(isOrganizationRole("Admin")).toBe(false);
  });
});

describe("project controlled values", () => {
  it("keeps the canonical project type values stable", () => {
    expect(projectTypeValues).toEqual(["client", "internal"]);
    expect(isProjectType("client")).toBe(true);
    expect(isProjectType("prospect")).toBe(false);
  });

  it("keeps the canonical project status values stable", () => {
    expect(projectStatusValues).toEqual(["draft", "active", "on_hold", "completed", "archived"]);
    expect(isProjectStatus("on_hold")).toBe(true);
    expect(isProjectStatus("paused")).toBe(false);
  });

  it("keeps archived out of normal writable project statuses", () => {
    expect(projectWritableStatusValues).toEqual(["draft", "active", "on_hold", "completed"]);
    expect(isProjectWritableStatus("active")).toBe(true);
    expect(isProjectWritableStatus("archived")).toBe(false);
  });

  it("keeps the canonical project phase values stable", () => {
    expect(projectPhaseValues).toEqual([
      "intake",
      "requirements",
      "clarification",
      "baseline",
      "architecture",
      "delivery",
      "handoff",
      "closed",
    ]);
    expect(isProjectPhase("clarification")).toBe(true);
    expect(isProjectPhase("kickoff")).toBe(false);
  });

  it("keeps the canonical project priority values stable", () => {
    expect(projectPriorityValues).toEqual(["low", "medium", "high", "critical"]);
    expect(isProjectPriority("critical")).toBe(true);
    expect(isProjectPriority("urgent")).toBe(false);
  });

  it("keeps the canonical project visibility values stable", () => {
    expect(projectVisibilityValues).toEqual(["private", "organization"]);
    expect(isProjectVisibility("organization")).toBe(true);
    expect(isProjectVisibility("public")).toBe(false);
  });
});

describe("ai run provenance enums", () => {
  it("keeps run status distinct from review status", () => {
    expect(isAiRunStatus("planned")).toBe(true);
    expect(isAiRunStatus("succeeded")).toBe(true);
    expect(isAiRunStatus("accepted")).toBe(false);
    expect(isAiReviewStatus("pending")).toBe(true);
    expect(isAiReviewStatus("planned")).toBe(false);
  });
});

describe("canonical audit metadata", () => {
  it("uses `at` rather than the previous divergent `occurredAt` field", () => {
    const event: AuditMetadata = {
      organizationId: "org_1",
      actorId: "user_1",
      action: "project.create",
      entityType: "project",
      entityId: "project_1",
      before: null,
      after: { name: "Atlas" },
      correlationId: "corr_1",
      at: "2024-01-01T00:00:00Z",
    };

    expect(event).not.toHaveProperty("occurredAt");
    expect(event.at).toBe("2024-01-01T00:00:00Z");
  });
});
