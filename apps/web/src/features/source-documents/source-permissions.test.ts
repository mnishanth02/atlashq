import { describe, expect, it } from "vitest";
import { deriveSourceViewerPermissions } from "./source-permissions";

describe("deriveSourceViewerPermissions", () => {
  it("grants full access to organization admins even without membership", () => {
    const permissions = deriveSourceViewerPermissions({
      organizationRole: "admin",
      status: "active",
      membershipRole: null,
      membershipStatus: null,
      membershipSoftDeletedAt: null,
      isProjectArchived: false,
    });
    expect(permissions.canRead).toBe(true);
    expect(permissions.canWrite).toBe(true);
    expect(permissions.canManageIpReview).toBe(true);
  });

  it("denies write access when the project is archived", () => {
    const permissions = deriveSourceViewerPermissions({
      organizationRole: "member",
      status: "active",
      membershipRole: "Business Analyst / Coordinator",
      membershipStatus: "active",
      membershipSoftDeletedAt: null,
      isProjectArchived: true,
    });
    expect(permissions.canRead).toBe(true);
    expect(permissions.canWrite).toBe(false);
    expect(permissions.canArchive).toBe(false);
    expect(permissions.canRetry).toBe(false);
    expect(permissions.canManageIpReview).toBe(false);
  });

  it("grants read-only access to Developer/QA", () => {
    const permissions = deriveSourceViewerPermissions({
      organizationRole: "member",
      status: "active",
      membershipRole: "Developer",
      membershipStatus: "active",
      membershipSoftDeletedAt: null,
      isProjectArchived: false,
    });
    expect(permissions.canRead).toBe(true);
    expect(permissions.canWrite).toBe(false);
    expect(permissions.canReplace).toBe(false);
  });

  it("denies all access to the Client Viewer/Approver role", () => {
    const permissions = deriveSourceViewerPermissions({
      organizationRole: "member",
      status: "active",
      membershipRole: "Client Viewer / Approver",
      membershipStatus: "active",
      membershipSoftDeletedAt: null,
      isProjectArchived: false,
    });
    expect(permissions.canRead).toBe(false);
    expect(permissions.canWrite).toBe(false);
    expect(permissions.canManageIpReview).toBe(false);
  });

  it("denies access when the membership has been soft-deleted", () => {
    const permissions = deriveSourceViewerPermissions({
      organizationRole: "member",
      status: "active",
      membershipRole: "Business Analyst / Coordinator",
      membershipStatus: "active",
      membershipSoftDeletedAt: "2025-01-01T00:00:00.000Z",
      isProjectArchived: false,
    });
    expect(permissions.canRead).toBe(false);
    expect(permissions.canWrite).toBe(false);
  });
});
