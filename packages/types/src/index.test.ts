import { describe, expect, it } from "vitest";
import {
  type AuditMetadata,
  analysisRunModeValues,
  analysisRunStatusValues,
  analysisStageKindValues,
  analysisStageStatusValues,
  canProjectRole,
  confidenceReasonCodeValues,
  coverageCategoryDescriptors,
  coverageCategoryKeyValues,
  coverageStatusValues,
  deliveryItemTypeValues,
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
  isRequirementEpistemicStatus,
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
  providerDataRetentionModeValues,
  providerPolicyStatusValues,
  referenceAccessTypeValues,
  referenceCaptureMethodValues,
  referenceIntendedUseValues,
  referenceKindValues,
  requirementEpistemicStatusValues,
  requirementLifecycleStateValues,
  requirementPriorityValues,
  requirementTypeValues,
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
      "requirements:read",
      "sources:read",
    ]);
    expect(canProjectRole(projectRoles.developer, "project:write")).toBe(true);
    expect(canProjectRole(projectRoles.developer, "project:admin")).toBe(false);
    expect(projectRolesForPermission("project:read")).not.toContain(
      projectRoles.clientViewerApprover,
    );
    expect(isMutationPermission("project:read")).toBe(false);
    expect(isMutationPermission("requirements:read")).toBe(false);
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

describe("module 3 requirements permissions (module-03 §12.2)", () => {
  it("grants requirements:read to Admin, Project Owner, Architect, BA, Developer, and QA only", () => {
    expect(projectRolesForPermission("requirements:read")).toEqual([
      projectRoles.admin,
      projectRoles.projectOwner,
      projectRoles.architectTechLead,
      projectRoles.businessAnalystCoordinator,
      projectRoles.developer,
      projectRoles.qa,
    ]);
    expect(canProjectRole(projectRoles.clientViewerApprover, "requirements:read")).toBe(false);
  });

  it("grants requirements:analyze only to Admin, Project Owner, Architect, and BA", () => {
    expect(projectRolesForPermission("requirements:analyze")).toEqual([
      projectRoles.admin,
      projectRoles.projectOwner,
      projectRoles.architectTechLead,
      projectRoles.businessAnalystCoordinator,
    ]);
    expect(canProjectRole(projectRoles.developer, "requirements:analyze")).toBe(false);
    expect(canProjectRole(projectRoles.qa, "requirements:analyze")).toBe(false);
    expect(canProjectRole(projectRoles.clientViewerApprover, "requirements:analyze")).toBe(false);
  });

  it("keeps requirements:review unchanged for Module 4 handoff", () => {
    expect(projectRolesForPermission("requirements:review")).toEqual([
      projectRoles.admin,
      projectRoles.projectOwner,
      projectRoles.businessAnalystCoordinator,
      projectRoles.qa,
    ]);
  });

  it("treats requirements:read as non-mutation and requirements:analyze as mutation", () => {
    expect(isMutationPermission("requirements:read")).toBe(false);
    expect(isMutationPermission("requirements:analyze")).toBe(true);
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

describe("module 3 controlled values", () => {
  it("keeps epistemic statuses lowercase and rejects unknown values", () => {
    expect(requirementEpistemicStatusValues).toEqual([
      "confirmed",
      "assumed",
      "unknown",
      "conflicting",
    ]);
    expect(isRequirementEpistemicStatus("confirmed")).toBe(true);
    expect(isRequirementEpistemicStatus("Confirmed")).toBe(false);
  });

  it("keeps run and stage state machines stable", () => {
    expect(analysisRunModeValues).toEqual(["fresh", "replay", "reprocess", "retry"]);
    expect(analysisRunStatusValues).toEqual([
      "requested",
      "snapshotting",
      "queued",
      "running",
      "waiting_retry",
      "completed",
      "completed_with_warnings",
      "failed",
      "canceled",
    ]);
    expect(analysisStageStatusValues).toEqual([
      "pending",
      "running",
      "waiting_retry",
      "completed",
      "completed_with_warnings",
      "failed",
      "canceled",
      "skipped",
    ]);
    expect(analysisStageKindValues).toContain("finalize_review_package");
  });

  it("keeps the fixed coverage rubric and statuses stable", () => {
    expect(coverageStatusValues).toEqual(["addressed", "partial", "absent"]);
    expect(coverageCategoryKeyValues).toHaveLength(18);
    expect(coverageCategoryDescriptors).toHaveLength(18);
    expect(coverageCategoryDescriptors[0]).toEqual({
      key: "auth_identity",
      label: "Auth/identity",
      order: 1,
    });
    expect(coverageCategoryDescriptors[17]).toEqual({
      key: "support_model",
      label: "Support model",
      order: 18,
    });
  });

  it("keeps requirement/delivery/provider controlled values stable", () => {
    expect(requirementTypeValues).toEqual([
      "functional",
      "non_functional",
      "business_rule",
      "data",
      "integration",
      "security",
      "compliance",
      "operational",
    ]);
    expect(requirementPriorityValues).toEqual(["must_have", "should_have", "could_have", "later"]);
    expect(requirementLifecycleStateValues).toContain("ai_suggested");
    expect(deliveryItemTypeValues).toEqual([
      "question",
      "risk",
      "assumption",
      "dependency",
      "blocker",
      "scope_change_candidate",
    ]);
    expect(providerPolicyStatusValues).toEqual(["draft", "approved", "inactive"]);
    expect(providerDataRetentionModeValues).toEqual([
      "provider_default",
      "no_training",
      "zero_retention",
    ]);
    expect(confidenceReasonCodeValues).toContain("verified_exact_citation");
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
