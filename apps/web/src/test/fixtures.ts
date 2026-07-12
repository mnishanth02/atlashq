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

/* --------------------- Requirement Analysis fixtures --------------------- */

import type {
  AnalysisBatchListResponse,
  AnalysisBatchSummary,
  AnalysisRunDetailResponse,
  AnalysisRunListResponse,
  AnalysisRunSummary,
  AnalysisStageListResponse,
  AnalysisStageSummary,
  CitationEvidenceResponse,
  CitationListItem,
  CitationListResponse,
  CoverageEntry,
  CoverageListResponse,
  DeliveryItemDetailResponse,
  DeliveryItemListItem,
  DeliveryItemListResponse,
  EligibleSourcePreviewItem,
  EligibleSourcePreviewResponse,
  ProviderPolicyListResponse,
  ProviderPolicySummary,
  RequirementAnalysisCapabilitiesResponse,
  RequirementDetailResponse,
  RequirementListItem,
  RequirementListResponse,
  TraceabilityLink,
  TraceabilityListResponse,
} from "@/features/requirement-analysis/requirement-analysis-api";

export function makeRequirementAnalysisCapabilities(
  overrides: Partial<RequirementAnalysisCapabilitiesResponse> = {},
): RequirementAnalysisCapabilitiesResponse {
  return {
    readsEnabled: true,
    analysisEnabled: true,
    queueAvailable: true,
    approvedProviderPolicyAvailable: true,
    referenceFeatureExtractionEnabled: true,
    safeDisabled: false,
    safeDisabledReason: null,
    ...overrides,
  };
}

export function makeProviderPolicySummary(
  overrides: Partial<ProviderPolicySummary> = {},
): ProviderPolicySummary {
  return {
    id: "policy-1",
    organizationId: "org-1",
    version: 1,
    policyName: "OpenAI production policy",
    provider: "openai",
    modelAlias: "gpt-5-analysis",
    resolvedModelId: "gpt-5-analysis-2026-01",
    dataRetentionMode: "zero_retention",
    status: "approved",
    approvedForRequirementAnalysis: true,
    approvedBy: "11111111-1111-4111-8111-111111111111",
    approvedAt: NOW,
    approvalNote: "Approved for production requirement analysis.",
    providerTermsSnapshotHash: "sha256:terms",
    maxUsdPerRun: 5,
    maxInputTokensPerRun: 200_000,
    maxOutputTokensPerRun: 20_000,
    maxWallClockSeconds: 900,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeProviderPolicyListResponse(
  items: ProviderPolicyListResponse["items"] = [makeProviderPolicySummary()],
): ProviderPolicyListResponse {
  return {
    items,
    pageInfo: { limit: 25, nextCursor: null, hasMore: false, total: items.length },
  };
}

export function makeEligibleSourcePreviewItem(
  overrides: Partial<EligibleSourcePreviewItem> = {},
): EligibleSourcePreviewItem {
  return {
    sourceDocumentId: "source-1",
    sourceLineageId: "lineage-1",
    sourceVersionNumber: 1,
    sourceType: "document",
    documentFormat: "pdf",
    title: "Initial requirements pack",
    contentHash: "sha256:abcdef1234567890",
    sourceExtractionId: "extraction-1",
    sourceExtractionVersion: 1,
    chunkerVersion: "v1",
    chunkCount: 42,
    totalCharacterCount: 128_000,
    referenceIpReviewStatus: null,
    included: true,
    exclusionReason: null,
    ...overrides,
  };
}

export function makeEligibleSourcePreviewResponse(
  sources: EligibleSourcePreviewItem[] = [makeEligibleSourcePreviewItem()],
): EligibleSourcePreviewResponse {
  const includedCount = sources.filter((source) => source.included).length;
  return {
    sources,
    includedCount,
    excludedCount: sources.length - includedCount,
    generatedAt: NOW,
  };
}

export function makeAnalysisRunSummary(
  overrides: Partial<AnalysisRunSummary> = {},
): AnalysisRunSummary {
  return {
    id: "run-1",
    organizationId: "org-1",
    projectId: "project-1",
    requestedBy: "11111111-1111-4111-8111-111111111111",
    mode: "fresh",
    status: "completed",
    sourceSnapshotId: "snapshot-1",
    replayOfRunId: null,
    reprocessOfRunId: null,
    retryOfRunId: null,
    warningCodes: [],
    failureCode: null,
    failureDetail: null,
    failureRetryable: false,
    failedStageId: null,
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    cancelReason: null,
    startedAt: NOW,
    completedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    correlationId: "corr-run-1",
    providerPolicy: {
      providerPolicyId: "policy-1",
      provider: "openai",
      modelAlias: "gpt-5-analysis",
      resolvedModelId: "gpt-5-analysis-2026-01",
      dataRetentionMode: "zero_retention",
    },
    provenance: {
      promptBundleVersion: "2026.07.1",
      promptBundleHash: "sha256:prompt",
      schemaBundleVersion: "2026.07.1",
      schemaBundleHash: "sha256:schema",
      pipelineVersion: "2026.07.1",
      pipelineHash: "sha256:pipeline",
      modelPolicyHash: "sha256:policy",
    },
    budgets: {
      maxUsd: 5,
      maxInputTokens: 200_000,
      maxOutputTokens: 20_000,
      maxWallClockSeconds: 900,
    },
    usage: {
      inputTokensUsed: 42_000,
      outputTokensUsed: 6_500,
      costUsd: 1.24,
    },
    artifactCounts: {
      requirements: 12,
      citations: 30,
      coverageEntries: 18,
      deliveryItems: 6,
    },
    ...overrides,
  };
}

export function makeAnalysisRunListResponse(
  items: AnalysisRunSummary[] = [makeAnalysisRunSummary()],
): AnalysisRunListResponse {
  return {
    items,
    pageInfo: { limit: 25, nextCursor: null, hasMore: false, total: items.length },
  };
}

export function makeAnalysisRunDetailResponse(
  overrides: Partial<AnalysisRunDetailResponse> = {},
): AnalysisRunDetailResponse {
  const summary = makeAnalysisRunSummary();
  return {
    ...summary,
    snapshot: {
      id: "snapshot-1",
      snapshotHash: "sha256:snapshot",
      sourceCount: 3,
      chunkCount: 126,
      totalCharacterCount: 384_000,
      eligibilityRulesVersion: "2026.07.1",
      createdAt: NOW,
    },
    readNotices: [],
    ...overrides,
  };
}

export function makeAnalysisStageSummary(
  overrides: Partial<AnalysisStageSummary> = {},
): AnalysisStageSummary {
  return {
    id: "stage-1",
    runId: "run-1",
    organizationId: "org-1",
    projectId: "project-1",
    kind: "freeze_snapshot",
    status: "completed",
    attemptNumber: 1,
    idempotencyKey: "idem-1",
    inputHash: "sha256:input",
    outputHash: "sha256:output",
    startedAt: NOW,
    completedAt: NOW,
    retryAfter: null,
    failureCode: null,
    failureDetail: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeAnalysisStageListResponse(
  items: AnalysisStageSummary[] = [makeAnalysisStageSummary()],
): AnalysisStageListResponse {
  return {
    items,
    pageInfo: { limit: 25, nextCursor: null, hasMore: false, total: items.length },
  };
}

export function makeAnalysisBatchSummary(
  overrides: Partial<AnalysisBatchSummary> = {},
): AnalysisBatchSummary {
  return {
    id: "batch-1",
    stageId: "stage-1",
    runId: "run-1",
    organizationId: "org-1",
    projectId: "project-1",
    batchOrder: 1,
    sourceChunkStartSequence: 0,
    sourceChunkEndSequence: 20,
    inputTokenEstimate: 8_000,
    maxOutputTokens: 4_000,
    status: "completed",
    attemptNumber: 1,
    aiRunId: "ai-run-1",
    repairOfBatchId: null,
    shapeOnlyRepairUsed: false,
    cacheKey: null,
    cacheHitOfBatchId: null,
    failureCode: null,
    failureDetail: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeAnalysisBatchListResponse(
  items: AnalysisBatchSummary[] = [makeAnalysisBatchSummary()],
): AnalysisBatchListResponse {
  return {
    items,
    pageInfo: { limit: 25, nextCursor: null, hasMore: false, total: items.length },
  };
}

export function makeRequirementListItem(
  overrides: Partial<RequirementListItem> = {},
): RequirementListItem {
  return {
    id: "requirement-1",
    organizationId: "org-1",
    projectId: "project-1",
    analysisRunId: "run-1",
    stableKey: "req-stable-1",
    title: "Users can reset their password",
    description: "The system must allow users to reset a forgotten password via email.",
    requirementType: "functional",
    priority: "must_have",
    epistemicStatus: "confirmed",
    confidenceBand: "high",
    confidenceReasonCodes: ["verified_exact_citation"],
    inferenceBasis: null,
    origin: "source",
    lifecycleState: "ai_suggested",
    dedupeGroupKey: null,
    parentRequirementId: null,
    sourceSummary: "Requirements pack, section 3.2",
    createdByAiRunId: "run-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeRequirementListResponse(
  items: RequirementListItem[] = [makeRequirementListItem()],
): RequirementListResponse {
  return {
    items,
    pageInfo: { limit: 25, nextCursor: null, hasMore: false, total: items.length },
  };
}

export function makeRequirementDetailResponse(
  overrides: Partial<RequirementDetailResponse> = {},
): RequirementDetailResponse {
  return { ...makeRequirementListItem(), ...overrides };
}

type DeliveryItemOfType<Type extends DeliveryItemListItem["itemType"]> = Extract<
  DeliveryItemListItem,
  { itemType: Type }
>;

function deliveryItemBase(): Pick<
  DeliveryItemListItem,
  | "id"
  | "organizationId"
  | "projectId"
  | "analysisRunId"
  | "epistemicStatus"
  | "confidenceBand"
  | "confidenceReasonCodes"
  | "severity"
  | "priority"
  | "status"
  | "visibility"
  | "sourceRequirementId"
  | "createdByAiRunId"
  | "createdAt"
  | "updatedAt"
> {
  return {
    id: "delivery-item-1",
    organizationId: "org-1",
    projectId: "project-1",
    analysisRunId: "run-1",
    epistemicStatus: "unknown",
    confidenceBand: null,
    confidenceReasonCodes: [],
    severity: "medium",
    priority: "medium",
    status: "open",
    visibility: "internal",
    sourceRequirementId: null,
    createdByAiRunId: "run-1",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export function makeQuestionDeliveryItem(
  overrides: Partial<DeliveryItemOfType<"question">> = {},
): DeliveryItemOfType<"question"> {
  return {
    ...deliveryItemBase(),
    title: "What SSO provider should be used?",
    description: "The source material references SSO without naming a provider.",
    itemType: "question",
    attributes: {
      questionText: "Which SSO provider (Okta, Azure AD, etc.) should be integrated?",
      whyItMatters: "Determines the identity integration effort and timeline.",
      suggestedResponseFormat: "Short answer",
      impactIfUnanswered: "Integration work cannot be scoped.",
      linkedCoverageEntryIds: [],
      linkedRequirementIds: [],
      linkedConflictDeliveryItemIds: [],
    },
    ...overrides,
  };
}

export function makeRiskDeliveryItem(
  overrides: Partial<DeliveryItemOfType<"risk">> = {},
): DeliveryItemOfType<"risk"> {
  return {
    ...deliveryItemBase(),
    id: "delivery-item-2",
    title: "Vendor SLA may not cover peak load",
    description: "No source evidence describes SLA coverage during seasonal peaks.",
    itemType: "risk",
    attributes: {
      category: "vendor_reliability",
      probabilityBand: "medium",
      impactBand: "high",
      mitigationPrompt: "Confirm SLA terms with the vendor before go-live.",
      trigger: "Seasonal peak traffic exceeding contracted capacity.",
    },
    ...overrides,
  };
}

export function makeAssumptionDeliveryItem(
  overrides: Partial<DeliveryItemOfType<"assumption">> = {},
): DeliveryItemOfType<"assumption"> {
  return {
    ...deliveryItemBase(),
    id: "delivery-item-3",
    title: "Assumed single-region deployment",
    description: "The source material implies a single-region deployment without confirming it.",
    itemType: "assumption",
    attributes: {
      inferenceBasis: "No multi-region requirements were mentioned in the source material.",
      validationNeeded: true,
      validationMethod: "Confirm with the infrastructure owner.",
    },
    ...overrides,
  };
}

export function makeDependencyDeliveryItem(
  overrides: Partial<DeliveryItemOfType<"dependency">> = {},
): DeliveryItemOfType<"dependency"> {
  return {
    ...deliveryItemBase(),
    id: "delivery-item-4",
    title: "Depends on identity platform migration",
    description: "Requirement delivery depends on an in-flight identity platform migration.",
    itemType: "dependency",
    attributes: {
      dependencyName: "Identity platform migration",
      dependencyDirection: "internal",
      blockedArea: "Authentication & identity",
      riskIfDelayed: "Login features cannot be delivered on schedule.",
    },
    ...overrides,
  };
}

export function makeBlockerDeliveryItem(
  overrides: Partial<DeliveryItemOfType<"blocker">> = {},
): DeliveryItemOfType<"blocker"> {
  return {
    ...deliveryItemBase(),
    id: "delivery-item-5",
    title: "Conflicting statements about password policy",
    description: "Two source documents disagree on the minimum password length.",
    itemType: "blocker",
    attributes: {
      subtype: "conflict",
      contradictionSummary: "Section 3.2 requires 12 characters; appendix A requires 8.",
      conflictingCitationIds: ["citation-1", "citation-2"],
      suggestedResolutionQuestion: "Which password length policy should be authoritative?",
    },
    ...overrides,
  };
}

export function makeScopeChangeCandidateDeliveryItem(
  overrides: Partial<DeliveryItemOfType<"scope_change_candidate">> = {},
): DeliveryItemOfType<"scope_change_candidate"> {
  return {
    ...deliveryItemBase(),
    id: "delivery-item-6",
    title: "New reporting export format requested",
    description: "The source material references a CSV export not in the original scope.",
    itemType: "scope_change_candidate",
    attributes: {
      classification: "scope_creep",
      changeSource: "Requirements pack, appendix C",
      baselineImpactHypothesis: "Adds a new export pipeline not covered by the current baseline.",
      approvalNeeded: true,
    },
    ...overrides,
  };
}

export function makeDeliveryItemListResponse(
  items: DeliveryItemListItem[] = [makeQuestionDeliveryItem()],
): DeliveryItemListResponse {
  return {
    items,
    pageInfo: { limit: 25, nextCursor: null, hasMore: false, total: items.length },
  };
}

export function makeDeliveryItemDetailResponse(
  overrides: Partial<DeliveryItemOfType<"question">> = {},
): DeliveryItemDetailResponse {
  return { ...makeQuestionDeliveryItem(), ...overrides };
}

export function makeCoverageEntry(overrides: Partial<CoverageEntry> = {}): CoverageEntry {
  return {
    id: "coverage-1",
    organizationId: "org-1",
    projectId: "project-1",
    analysisRunId: "run-1",
    categoryKey: "auth_identity",
    categoryLabel: "Authentication & identity",
    categoryOrder: 1,
    status: "addressed",
    rationale: "Login and password reset are described in section 3.",
    evidenceState: "verified_citation",
    questionDeliveryItemId: null,
    createdByAiRunId: "run-1",
    createdAt: NOW,
    ...overrides,
  };
}

export function makeCoverageListResponse(
  items: CoverageEntry[] = [makeCoverageEntry()],
): CoverageListResponse {
  return { items };
}

export function makeCitationListItem(overrides: Partial<CitationListItem> = {}): CitationListItem {
  return {
    id: "citation-1",
    organizationId: "org-1",
    projectId: "project-1",
    analysisRunId: "run-1",
    requirementId: "requirement-1",
    coverageMatrixEntryId: null,
    deliveryItemId: null,
    sourceDocumentId: "source-1",
    sourceVersionNumber: 1,
    sourceContentHash: "sha256:content",
    sourceExtractionId: "extraction-1",
    sourceExtractionVersion: 1,
    sourceChunkId: "chunk-1",
    sourceChunkSequence: 4,
    chunkContentHash: "sha256:chunk",
    locator: { page: 3 },
    quoteTextOriginal: "Users must be able to reset a forgotten password via email.",
    quoteTextNormalized: "users must be able to reset a forgotten password via email",
    quoteHash: "sha256:quote",
    matchStartOffset: 120,
    matchEndOffset: 178,
    normalizationMode: "whitespace_lowercase",
    verificationStatus: "verified_exact",
    createdByAiRunId: "run-1",
    createdAt: NOW,
    ...overrides,
  };
}

export function makeCitationListResponse(
  items: CitationListItem[] = [makeCitationListItem()],
): CitationListResponse {
  return {
    items,
    pageInfo: { limit: 25, nextCursor: null, hasMore: false, total: items.length },
  };
}

export function makeCitationEvidenceResponse(
  overrides: Partial<CitationEvidenceResponse> = {},
): CitationEvidenceResponse {
  return {
    ...makeCitationListItem(),
    sourceTitle: "Initial requirements pack",
    sourceVersionLabel: "v1",
    ...overrides,
  };
}

export function makeTraceabilityLink(overrides: Partial<TraceabilityLink> = {}): TraceabilityLink {
  return {
    id: "trace-1",
    organizationId: "org-1",
    fromType: "requirement",
    fromId: "requirement-1",
    toType: "citation",
    toId: "citation-1",
    relation: "supported_by",
    createdBy: null,
    createdAt: NOW,
    ...overrides,
  };
}

export function makeTraceabilityListResponse(
  items: TraceabilityLink[] = [makeTraceabilityLink()],
): TraceabilityListResponse {
  return {
    items,
    pageInfo: { limit: 25, nextCursor: null, hasMore: false, total: items.length },
  };
}
