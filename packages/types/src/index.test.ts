import { describe, expect, it } from "vitest";
import {
  type AuditMetadata,
  canProjectRole,
  ipReviewStatusValues,
  isAiReviewStatus,
  isAiRunStatus,
  isIpReviewStatus,
  isMutationPermission,
  isOrganizationRole,
  isProjectPhase,
  isProjectPriority,
  isProjectRole,
  isProjectStatus,
  isProjectType,
  isProjectVisibility,
  isProjectWritableStatus,
  isReferenceAccessType,
  isReferenceCaptureMethod,
  isReferenceIntendedUse,
  isReferenceKind,
  isSourceDocumentFormat,
  isSourceExtractionStatus,
  isSourceFileScanStatus,
  isSourceIntakeMode,
  isSourceProcessingStatus,
  isSourceType,
  isUploadFileRole,
  isUploadSessionStatus,
  organizationRoles,
  organizationRoleValues,
  type ProjectPermission,
  type ProjectRole,
  projectPhaseValues,
  projectPriorityValues,
  projectRoles,
  projectRolesForPermission,
  projectRoleValues,
  projectStatusValues,
  projectTypeValues,
  projectVisibilityValues,
  projectWritableStatusValues,
  referenceAccessTypeValues,
  referenceCaptureMethodValues,
  referenceIntendedUseValues,
  referenceKindValues,
  rolePermissions,
  sourceDocumentFormatValues,
  sourceExtractionStatusValues,
  sourceFileScanStatusValues,
  sourceIntakeModeValues,
  sourceProcessingStatusValues,
  sourceTypeValues,
  uploadFileRoleValues,
  uploadSessionStatusValues,
} from "./index.js";

describe("project roles", () => {
  it("exposes exactly the seven V1 role constants including the client approver placeholder", () => {
    expect(projectRoleValues).toHaveLength(7);
    expect(isProjectRole(projectRoles.clientViewerApprover)).toBe(true);
    expect(projectRoles.clientViewerApprover).toBe("Client Viewer / Approver");
  });

  it("exposes the browser-safe permission matrix", () => {
    expect(rolePermissions[projectRoles.developer]).toEqual([
      "project:read",
      "project:write",
      "sources:read",
    ]);
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

describe("module 2 source permission matrix (module-02 §7, M2-DEC-006)", () => {
  const readWriteRoles: readonly [string, ProjectPermission][] = [
    [projectRoles.admin, "sources:write"],
    [projectRoles.projectOwner, "sources:write"],
    [projectRoles.architectTechLead, "sources:write"],
    [projectRoles.businessAnalystCoordinator, "sources:write"],
  ];

  it.each(readWriteRoles)("grants %s both sources:read and sources:write", (role) => {
    expect(canProjectRole(role as ProjectRole, "sources:read")).toBe(true);
    expect(canProjectRole(role as ProjectRole, "sources:write")).toBe(true);
  });

  it.each([
    projectRoles.developer,
    projectRoles.qa,
  ])("grants %s sources:read only, never sources:write", (role) => {
    expect(canProjectRole(role, "sources:read")).toBe(true);
    expect(canProjectRole(role, "sources:write")).toBe(false);
  });

  it("grants the client viewer / approver no source permissions", () => {
    expect(canProjectRole(projectRoles.clientViewerApprover, "sources:read")).toBe(false);
    expect(canProjectRole(projectRoles.clientViewerApprover, "sources:write")).toBe(false);
  });

  it("treats sources:read as a non-mutation and sources:write as a mutation", () => {
    expect(isMutationPermission("sources:read")).toBe(false);
    expect(isMutationPermission("sources:write")).toBe(true);
  });

  it("reuses project:admin for IP-review clearance grantees (Admin, Project Owner only)", () => {
    expect(projectRolesForPermission("project:admin")).toEqual([
      projectRoles.admin,
      projectRoles.projectOwner,
    ]);
  });
});

describe("module 2 controlled value guards", () => {
  it("keeps the source intake mode values stable", () => {
    expect(sourceIntakeModeValues).toEqual(["file_upload", "manual_text", "reference_artifact"]);
    expect(isSourceIntakeMode("manual_text")).toBe(true);
    expect(isSourceIntakeMode("edit_in_place")).toBe(false);
  });

  it("keeps the source type values stable", () => {
    expect(sourceTypeValues).toEqual(["document", "reference", "manual"]);
    expect(isSourceType("reference")).toBe(true);
    expect(isSourceType("attachment")).toBe(false);
  });

  it("keeps the V1 supported document format allowlist stable and excludes deferred legacy formats", () => {
    expect(sourceDocumentFormatValues).toEqual([
      "pdf",
      "docx",
      "txt",
      "md",
      "xlsx",
      "csv",
      "pptx",
      "png",
      "jpg",
      "jpeg",
      "webp",
    ]);
    expect(isSourceDocumentFormat("docx")).toBe(true);
    expect(isSourceDocumentFormat("doc")).toBe(false);
    expect(isSourceDocumentFormat("xls")).toBe(false);
    expect(isSourceDocumentFormat("ppt")).toBe(false);
  });

  it("keeps the upload-session status values stable", () => {
    expect(uploadSessionStatusValues).toEqual([
      "created",
      "uploading",
      "uploaded",
      "confirmed",
      "canceled",
      "expired",
    ]);
    expect(isUploadSessionStatus("confirmed")).toBe(true);
    expect(isUploadSessionStatus("deleted")).toBe(false);
  });

  it("keeps the upload/source file role values stable", () => {
    expect(uploadFileRoleValues).toEqual(["primary", "attachment", "snapshot"]);
    expect(isUploadFileRole("snapshot")).toBe(true);
    expect(isUploadFileRole("thumbnail")).toBe(false);
  });

  it("keeps the source processing status state machine stable", () => {
    expect(sourceProcessingStatusValues).toEqual([
      "verification_pending",
      "scan_pending",
      "scanning",
      "extraction_pending",
      "extracting",
      "ready",
      "quarantined",
      "failed",
    ]);
    expect(isSourceProcessingStatus("quarantined")).toBe(true);
    expect(isSourceProcessingStatus("deleted")).toBe(false);
  });

  it("keeps the source file scan status values stable", () => {
    expect(sourceFileScanStatusValues).toEqual([
      "not_required",
      "pending",
      "clean",
      "infected",
      "failed",
    ]);
    expect(isSourceFileScanStatus("not_required")).toBe(true);
    expect(isSourceFileScanStatus("quarantined")).toBe(false);
  });

  it("keeps the source extraction status values stable", () => {
    expect(sourceExtractionStatusValues).toEqual(["pending", "running", "succeeded", "failed"]);
    expect(isSourceExtractionStatus("succeeded")).toBe(true);
    expect(isSourceExtractionStatus("ready")).toBe(false);
  });

  it("keeps the reference artifact controlled values stable", () => {
    expect(referenceKindValues).toEqual([
      "url",
      "screenshot_set",
      "uploaded_export",
      "article",
      "app_store_listing",
    ]);
    expect(isReferenceKind("app_store_listing")).toBe(true);
    expect(isReferenceKind("video")).toBe(false);

    expect(referenceCaptureMethodValues).toEqual([
      "manual_paste",
      "user_uploaded_screenshot",
      "on_demand_single_page_capture",
    ]);
    expect(isReferenceCaptureMethod("on_demand_single_page_capture")).toBe(true);
    expect(isReferenceCaptureMethod("automated_crawl")).toBe(false);

    expect(referenceAccessTypeValues).toEqual(["public", "client_owned", "permissioned"]);
    expect(isReferenceAccessType("client_owned")).toBe(true);
    expect(isReferenceAccessType("private")).toBe(false);

    expect(referenceIntendedUseValues).toEqual([
      "inspiration",
      "feature_parity",
      "differentiation_baseline",
    ]);
    expect(isReferenceIntendedUse("feature_parity")).toBe(true);
    expect(isReferenceIntendedUse("verbatim_copy")).toBe(false);

    expect(ipReviewStatusValues).toEqual(["not_reviewed", "cleared", "restricted"]);
    expect(isIpReviewStatus("restricted")).toBe(true);
    expect(isIpReviewStatus("approved")).toBe(false);
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
