import type {
  CurrentOrganizationResponse,
  CurrentUserResponse,
  OrganizationUserListResponse,
  ProjectAuditEventListResponse,
  ProjectDashboardResponse,
  ProjectListResponse,
  ProjectMembershipListResponse,
  ProjectResponse,
} from "@/features/api";

const NOW = "2026-07-10T00:00:00.000Z";

export function makeCurrentUser(
  overrides: Partial<CurrentUserResponse["user"]> = {},
): CurrentUserResponse {
  return {
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "morgan@example.com",
      name: "Morgan Admin",
      organizationId: "org-1",
      organizationRole: "admin",
      status: "active",
      ...overrides,
    },
    session: {
      id: "session-1",
      expiresAt: "2026-07-11T00:00:00.000Z",
    },
  };
}

export function makeOrganization(
  overrides: Partial<CurrentOrganizationResponse> = {},
): CurrentOrganizationResponse {
  return {
    id: "org-1",
    name: "Northstar Consulting",
    plan: "enterprise",
    role: "admin",
    ...overrides,
  };
}

export function makeProject(overrides: Partial<ProjectResponse> = {}): ProjectResponse {
  return {
    id: "project-1",
    organizationId: "org-1",
    name: "Atlas rollout",
    type: "client",
    status: "active",
    clientId: "client-1",
    client: { id: "client-1", name: "Northwind" },
    ownerId: "11111111-1111-4111-8111-111111111111",
    owner: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Morgan Admin",
    },
    techLeadId: "22222222-2222-4222-8222-222222222222",
    techLead: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Taylor Lead",
    },
    businessOwnerId: null,
    businessOwner: null,
    startDate: "2026-07-01T00:00:00.000Z",
    targetDate: "2026-09-30T00:00:00.000Z",
    phase: "delivery",
    tags: ["platform", "migration"],
    priority: "high",
    visibility: "organization",
    description: "Migrate the customer platform.",
    createdAt: NOW,
    createdBy: "11111111-1111-4111-8111-111111111111",
    updatedAt: NOW,
    updatedBy: "11111111-1111-4111-8111-111111111111",
    softDeletedAt: null,
    version: 3,
    ...overrides,
  };
}

export function makeProjectListResponse(
  items: ProjectListResponse["items"] = [makeProject()],
  overrides: Partial<ProjectListResponse["pageInfo"]> = {},
): ProjectListResponse {
  return {
    items,
    pageInfo: {
      limit: 25,
      nextCursor: null,
      hasMore: false,
      total: items.length,
      ...overrides,
    },
  };
}

export function makeDashboard(
  project: ProjectResponse = makeProject(),
  overrides: Partial<ProjectDashboardResponse> = {},
): ProjectDashboardResponse {
  return {
    project,
    cards: {
      sourceDocuments: { state: "not_started", count: 0, label: "Source documents" },
      requirements: { state: "not_started", count: 0, label: "Requirements" },
      openQuestions: { state: "not_started", count: 0, label: "Open questions" },
      risksAndDeliveryItems: { state: "zero", count: 0, label: "Risks & delivery items" },
      architectureReview: { state: "setup_required", count: 0, label: "Architecture review" },
      baselineAndHandoff: { state: "not_started", count: 0, label: "Baseline & handoff" },
    },
    nextActions: [],
    ...overrides,
  };
}

export function makeMembership(
  overrides: Partial<ProjectMembershipListResponse["items"][number]> = {},
): ProjectMembershipListResponse["items"][number] {
  return {
    id: "membership-1",
    organizationId: "org-1",
    projectId: "project-1",
    userId: "22222222-2222-4222-8222-222222222222",
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Taylor Lead",
      email: "taylor@example.com",
    },
    role: "Developer",
    status: "active",
    invitedAt: null,
    invitedBy: null,
    addedAt: NOW,
    addedBy: "11111111-1111-4111-8111-111111111111",
    deactivatedAt: null,
    createdAt: NOW,
    createdBy: "11111111-1111-4111-8111-111111111111",
    updatedAt: NOW,
    updatedBy: "11111111-1111-4111-8111-111111111111",
    softDeletedAt: null,
    version: 1,
    ...overrides,
  };
}

export function makeMembershipList(
  items: ProjectMembershipListResponse["items"] = [],
): ProjectMembershipListResponse {
  return {
    items,
    pageInfo: {
      limit: 25,
      nextCursor: null,
      hasMore: false,
      total: items.length,
    },
  };
}

export function makeOrganizationUser(
  overrides: Partial<OrganizationUserListResponse["items"][number]> = {},
): OrganizationUserListResponse["items"][number] {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Morgan Admin",
    email: "morgan@example.com",
    status: "active",
    organizationRole: "admin",
    ...overrides,
  };
}

export function makeOrganizationUserListResponse(
  items: OrganizationUserListResponse["items"] = [makeOrganizationUser()],
  overrides: Partial<OrganizationUserListResponse["pageInfo"]> = {},
): OrganizationUserListResponse {
  return {
    items,
    pageInfo: {
      limit: 100,
      nextCursor: null,
      hasMore: false,
      total: items.length,
      ...overrides,
    },
  };
}

export function makeAuditList(
  items: ProjectAuditEventListResponse["items"] = [],
): ProjectAuditEventListResponse {
  return {
    items,
    pageInfo: {
      limit: 20,
      nextCursor: null,
      hasMore: false,
      total: items.length,
    },
  };
}

/* --------------------- Source Documents fixtures --------------------- */

import type {
  SourceChunkListResponse,
  SourceDetailResponse,
  SourceExtractionListResponse,
  SourceListItem,
  SourceListResponse,
  SourceVaultCapabilitiesResponse,
  SourceVersionListResponse,
  UploadSessionResponse,
} from "@/features/source-documents";

export function makeSourceListItem(overrides: Partial<SourceListItem> = {}): SourceListItem {
  return {
    id: "source-1",
    lineageId: "lineage-1",
    versionNumber: 1,
    supersedesId: null,
    sourceType: "document",
    documentFormat: "pdf",
    title: "Initial requirements pack",
    tags: ["requirements"],
    processingStatus: "ready",
    isArchived: false,
    hasDuplicateAcknowledgement: false,
    ipReviewStatus: null,
    contentHash: "sha256:abcdef1234567890",
    createdByActorId: "11111111-1111-4111-8111-111111111111",
    createdAt: NOW,
    ...overrides,
  };
}

export function makeSourceList(
  items: SourceListItem[] = [makeSourceListItem()],
): SourceListResponse {
  return {
    items,
    pageInfo: {
      limit: 25,
      nextCursor: null,
      hasMore: false,
      total: items.length,
    },
  };
}

export function makeSourceDetail(
  overrides: Partial<SourceDetailResponse> = {},
): SourceDetailResponse {
  return {
    id: "source-1",
    lineageId: "lineage-1",
    versionNumber: 1,
    supersedesId: null,
    sourceType: "document",
    documentFormat: "pdf",
    title: "Initial requirements pack",
    tags: ["requirements"],
    processingStatus: "ready",
    isArchived: false,
    hasDuplicateAcknowledgement: false,
    ipReviewStatus: null,
    contentHash: "sha256:abcdef1234567890",
    createdByActorId: "11111111-1111-4111-8111-111111111111",
    createdAt: NOW,
    version: 1,
    notes: null,
    provenanceDate: null,
    archivedByActorId: null,
    archivedAt: null,
    files: [
      {
        id: "file-1",
        ordinal: 0,
        role: "primary",
        originalFileName: "requirements.pdf",
        downloadFileName: "requirements.pdf",
        format: "pdf",
        declaredMimeType: "application/pdf",
        byteSize: 12345,
        sha256: "abcdef1234567890",
        scanStatus: "clean",
        scannedAt: NOW,
      },
    ],
    ...overrides,
  };
}

export function makeSourceVersionList(
  items: SourceVersionListResponse["items"] = [],
): SourceVersionListResponse {
  return {
    items,
    pageInfo: {
      limit: 25,
      nextCursor: null,
      hasMore: false,
      total: items.length,
    },
  };
}

export function makeExtractionList(
  items: SourceExtractionListResponse["items"] = [],
): SourceExtractionListResponse {
  return {
    items,
    pageInfo: {
      limit: 25,
      nextCursor: null,
      hasMore: false,
      total: items.length,
    },
  };
}

export function makeChunkList(
  items: SourceChunkListResponse["items"] = [],
): SourceChunkListResponse {
  return {
    items,
    pageInfo: {
      limit: 25,
      nextCursor: null,
      hasMore: false,
      total: items.length,
    },
  };
}

export function makeUploadSession(
  overrides: Partial<UploadSessionResponse> = {},
): UploadSessionResponse {
  return {
    id: "upload-session-1",
    organizationId: "org-1",
    projectId: "project-1",
    actorId: "11111111-1111-4111-8111-111111111111",
    sourceType: "document",
    status: "created",
    title: "Initial requirements pack",
    expiresAt: "2026-07-11T00:00:00.000Z",
    confirmedAt: null,
    createdSourceId: null,
    duplicateMatches: [],
    files: [
      {
        id: "session-file-1",
        ordinal: 0,
        role: "primary",
        originalFileName: "requirements.pdf",
        format: "pdf",
        declaredMimeType: "application/pdf",
        byteSize: 12345,
        sha256: "abcdef1234567890",
        signedUploadUrl: "https://storage.example/upload/requirements.pdf?sig=abc",
        signedUploadUrlExpiresAt: "2026-07-10T00:15:00.000Z",
      },
    ],
    ...overrides,
  };
}

export function makeSourceVaultCapabilities(
  overrides: Partial<SourceVaultCapabilitiesResponse> = {},
): SourceVaultCapabilitiesResponse {
  return {
    writesEnabled: true,
    singlePageCaptureEnabled: true,
    ocrProcessingEnabled: false,
    storageAvailable: true,
    queueAvailable: true,
    ...overrides,
  };
}
