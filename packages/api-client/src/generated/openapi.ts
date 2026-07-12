/* Generated from apps/api/openapi/openapi.json. Do not edit by hand. */

export interface paths {
  "/api/v1/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["HealthController_getHealth"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/me": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["MeController_getCurrentUser"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/organizations/current": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["OrganizationController_getCurrentOrganization"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/clients": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["ClientsController_listClients"];
    put?: never;
    post: operations["ClientsController_createClient"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/clients/{clientId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["ClientsController_getClient"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations["ClientsController_updateClient"];
    trace?: never;
  };
  "/api/v1/clients/{clientId}/archive": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["ClientsController_archiveClient"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["ProjectsController_listProjects"];
    put?: never;
    post: operations["ProjectsController_createProject"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["ProjectsController_getProject"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations["ProjectsController_updateProject"];
    trace?: never;
  };
  "/api/v1/projects/{projectId}/archive": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["ProjectsController_archiveProject"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/restore": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["ProjectsController_restoreProject"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/memberships": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["ProjectsController_listMemberships"];
    put?: never;
    post: operations["ProjectsController_addMembership"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/memberships/{membershipId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: operations["ProjectsController_removeMembership"];
    options?: never;
    head?: never;
    patch: operations["ProjectsController_updateMembership"];
    trace?: never;
  };
  "/api/v1/projects/{projectId}/dashboard": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["ProjectsController_getDashboard"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/audit-events": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["ProjectsController_listAuditEvents"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/organizations/current/users": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["OrganizationUsersController_listOrganizationUsers"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-vault/capabilities": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_getCapabilities"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-document-upload-sessions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_createUploadSession"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-document-upload-sessions/{sessionId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_getUploadSession"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-document-upload-sessions/{sessionId}/confirm": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_confirmUploadSession"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-document-upload-sessions/{sessionId}/cancel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_cancelUploadSession"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_listSources"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/manual": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_createManualSource"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/references": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_createReferenceSource"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_getSource"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/metadata": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations["SourceDocumentsController_updateMetadata"];
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/archive": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_archiveSource"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/restore": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_restoreSource"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/retry-processing": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_retryProcessing"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/versions/upload-session": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_createVersionUploadSession"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/versions/manual": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_createVersionManual"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/versions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_listVersions"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/extractions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_listExtractions"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/chunks": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_listChunks"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/files/{fileId}/preview-url": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_getPreviewUrl"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/files/{fileId}/download-url": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["SourceDocumentsController_getDownloadUrl"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/reference-capture": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_requestReferenceCapture"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/source-documents/{sourceId}/ip-review": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["SourceDocumentsController_changeIpReview"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/organizations/current/ai-provider-policies": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisOrganizationController_listProviderPolicies"];
    put?: never;
    post: operations["RequirementAnalysisOrganizationController_createProviderPolicy"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/organizations/current/ai-provider-policies/{policyId}/approve": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["RequirementAnalysisOrganizationController_approveProviderPolicy"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/organizations/current/ai-provider-policies/{policyId}/deactivate": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["RequirementAnalysisOrganizationController_deactivateProviderPolicy"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/capabilities": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_getCapabilities"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/provider-policies": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listProjectProviderPolicies"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/eligible-sources": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_previewEligibleSources"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listRuns"];
    put?: never;
    post: operations["RequirementAnalysisController_createFreshRun"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_getRunDetail"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/cancel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["RequirementAnalysisController_cancelRun"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/retry": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["RequirementAnalysisController_retryRun"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/replay": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["RequirementAnalysisController_replayRun"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/reprocess": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["RequirementAnalysisController_reprocessRun"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/stages": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listStages"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/batches": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listBatches"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/requirements": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listRequirements"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/requirements/{requirementId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_getRequirement"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/delivery-items": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listDeliveryItems"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/delivery-items/{itemId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_getDeliveryItem"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/coverage": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listCoverage"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/citations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listCitations"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/evidence/{citationId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_getCitationEvidence"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/requirement-analysis/runs/{runId}/traceability": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["RequirementAnalysisController_listTraceability"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    HealthCheckDto: {
      name: "storage" | "queue";
      ok: boolean;
      required: boolean;
      detail: string;
    };
    HealthResponseDto: {
      status: "ok" | "degraded";
      service: "api";
      version: string;
      mode: "core-only" | "source-vault" | "partial-source-vault";
      checks: Array<components["schemas"]["HealthCheckDto"]>;
    };
    ApiErrorDto: {
      statusCode: number;
      code: string;
      message: string;
      details?: Array<{
        path: Array<string | number>;
        message: string;
        code: string;
        metadata?: {
          [key: string]: unknown;
        };
      }>;
      correlationId?: string;
    };
    MeResponseDto_Output: {
      user: {
        id: string;
        email: string;
        name: string;
        organizationId: string;
        organizationRole: "admin" | "member";
        status: "active" | "suspended" | "archived";
      };
      session: {
        id: string;
        expiresAt: string;
      };
    };
    CurrentOrganizationDto_Output: {
      id: string;
      name: string;
      plan: string;
      role: "admin" | "member";
    };
    ClientListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        name: string;
        contactPerson: string | null;
        email: string | null;
        notes: string | null;
        status: string;
        createdAt: string;
        createdBy: string | null;
        updatedAt: string;
        updatedBy: string | null;
        softDeletedAt: string | null;
        version: number;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    ClientResponseDto_Output: {
      id: string;
      organizationId: string;
      name: string;
      contactPerson: string | null;
      email: string | null;
      notes: string | null;
      status: string;
      createdAt: string;
      createdBy: string | null;
      updatedAt: string;
      updatedBy: string | null;
      softDeletedAt: string | null;
      version: number;
    };
    ClientCreateBodyDto: {
      name: string;
      contactPerson?: string;
      email?: string;
      notes?: string;
      status?: string;
    };
    ClientUpdateBodyDto: {
      version: number;
      name?: string;
      contactPerson?: string | null;
      email?: string | null;
      notes?: string | null;
      status?: string;
    };
    ProjectListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        name: string;
        type: "client" | "internal";
        status: "draft" | "active" | "on_hold" | "completed" | "archived";
        clientId: string | null;
        client: {
          id: string;
          name: string;
        } | null;
        ownerId: string;
        owner: {
          id: string;
          name: string;
        } | null;
        techLeadId: string | null;
        techLead: {
          id: string;
          name: string;
        } | null;
        businessOwnerId: string | null;
        businessOwner: {
          id: string;
          name: string;
        } | null;
        startDate: string | null;
        targetDate: string | null;
        phase: "intake" | "requirements" | "clarification" | "baseline" | "architecture" | "delivery" | "handoff" | "closed";
        tags: Array<string>;
        priority: "low" | "medium" | "high" | "critical";
        visibility: "private" | "organization";
        description: string | null;
        createdAt: string;
        createdBy: string | null;
        updatedAt: string;
        updatedBy: string | null;
        softDeletedAt: string | null;
        version: number;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    ProjectCreateBodyDto: {
      name: string;
      ownerId: string;
      techLeadId?: string;
      businessOwnerId?: string;
      startDate?: string;
      targetDate?: string;
      status?: "draft" | "active" | "on_hold" | "completed";
      phase?: "intake" | "requirements" | "clarification" | "baseline" | "architecture" | "delivery" | "handoff" | "closed";
      priority?: "low" | "medium" | "high" | "critical";
      visibility?: "private" | "organization";
      tags?: Array<string>;
      description?: string;
      type: "client";
      clientId: string;
    } | {
      name: string;
      ownerId: string;
      techLeadId?: string;
      businessOwnerId?: string;
      startDate?: string;
      targetDate?: string;
      status?: "draft" | "active" | "on_hold" | "completed";
      phase?: "intake" | "requirements" | "clarification" | "baseline" | "architecture" | "delivery" | "handoff" | "closed";
      priority?: "low" | "medium" | "high" | "critical";
      visibility?: "private" | "organization";
      tags?: Array<string>;
      description?: string;
      type: "internal";
    };
    ProjectResponseDto_Output: {
      id: string;
      organizationId: string;
      name: string;
      type: "client" | "internal";
      status: "draft" | "active" | "on_hold" | "completed" | "archived";
      clientId: string | null;
      client: {
        id: string;
        name: string;
      } | null;
      ownerId: string;
      owner: {
        id: string;
        name: string;
      } | null;
      techLeadId: string | null;
      techLead: {
        id: string;
        name: string;
      } | null;
      businessOwnerId: string | null;
      businessOwner: {
        id: string;
        name: string;
      } | null;
      startDate: string | null;
      targetDate: string | null;
      phase: "intake" | "requirements" | "clarification" | "baseline" | "architecture" | "delivery" | "handoff" | "closed";
      tags: Array<string>;
      priority: "low" | "medium" | "high" | "critical";
      visibility: "private" | "organization";
      description: string | null;
      createdAt: string;
      createdBy: string | null;
      updatedAt: string;
      updatedBy: string | null;
      softDeletedAt: string | null;
      version: number;
    };
    ProjectUpdateBodyDto: {
      version: number;
      name?: string;
      type?: "client" | "internal";
      clientId?: string | null;
      ownerId?: string;
      techLeadId?: string | null;
      businessOwnerId?: string | null;
      startDate?: string | null;
      targetDate?: string | null;
      status?: "draft" | "active" | "on_hold" | "completed";
      phase?: "intake" | "requirements" | "clarification" | "baseline" | "architecture" | "delivery" | "handoff" | "closed";
      priority?: "low" | "medium" | "high" | "critical";
      visibility?: "private" | "organization";
      tags?: Array<string>;
      description?: string | null;
    };
    MembershipListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        projectId: string;
        userId: string;
        user: {
          id: string;
          name: string;
          email: string;
        } | null;
        role: "Admin" | "Project Owner" | "Architect / Tech Lead" | "Business Analyst / Coordinator" | "Developer" | "QA" | "Client Viewer / Approver";
        status: "invited" | "active" | "removed";
        invitedAt: string | null;
        invitedBy: string | null;
        addedAt: string | null;
        addedBy: string | null;
        deactivatedAt: string | null;
        createdAt: string;
        createdBy: string | null;
        updatedAt: string;
        updatedBy: string | null;
        softDeletedAt: string | null;
        version: number;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    MembershipCreateBodyDto: {
      userId: string;
      role: "Admin" | "Project Owner" | "Architect / Tech Lead" | "Business Analyst / Coordinator" | "Developer" | "QA" | "Client Viewer / Approver";
    };
    MembershipResponseDto_Output: {
      id: string;
      organizationId: string;
      projectId: string;
      userId: string;
      user: {
        id: string;
        name: string;
        email: string;
      } | null;
      role: "Admin" | "Project Owner" | "Architect / Tech Lead" | "Business Analyst / Coordinator" | "Developer" | "QA" | "Client Viewer / Approver";
      status: "invited" | "active" | "removed";
      invitedAt: string | null;
      invitedBy: string | null;
      addedAt: string | null;
      addedBy: string | null;
      deactivatedAt: string | null;
      createdAt: string;
      createdBy: string | null;
      updatedAt: string;
      updatedBy: string | null;
      softDeletedAt: string | null;
      version: number;
    };
    MembershipUpdateBodyDto: {
      role?: "Admin" | "Project Owner" | "Architect / Tech Lead" | "Business Analyst / Coordinator" | "Developer" | "QA" | "Client Viewer / Approver";
      status?: "invited" | "active" | "removed";
    };
    ProjectDashboardResponseDto_Output: {
      project: {
        id: string;
        organizationId: string;
        name: string;
        type: "client" | "internal";
        status: "draft" | "active" | "on_hold" | "completed" | "archived";
        clientId: string | null;
        client: {
          id: string;
          name: string;
        } | null;
        ownerId: string;
        owner: {
          id: string;
          name: string;
        } | null;
        techLeadId: string | null;
        techLead: {
          id: string;
          name: string;
        } | null;
        businessOwnerId: string | null;
        businessOwner: {
          id: string;
          name: string;
        } | null;
        startDate: string | null;
        targetDate: string | null;
        phase: "intake" | "requirements" | "clarification" | "baseline" | "architecture" | "delivery" | "handoff" | "closed";
        tags: Array<string>;
        priority: "low" | "medium" | "high" | "critical";
        visibility: "private" | "organization";
        description: string | null;
        createdAt: string;
        createdBy: string | null;
        updatedAt: string;
        updatedBy: string | null;
        softDeletedAt: string | null;
        version: number;
      };
      cards: {
        sourceDocuments: {
          state: "zero" | "not_started" | "setup_required" | "ready";
          count: number;
          label: string;
        };
        requirements: {
          state: "zero" | "not_started" | "setup_required" | "ready";
          count: number;
          label: string;
        };
        openQuestions: {
          state: "zero" | "not_started" | "setup_required" | "ready";
          count: number;
          label: string;
        };
        risksAndDeliveryItems: {
          state: "zero" | "not_started" | "setup_required" | "ready";
          count: number;
          label: string;
        };
        architectureReview: {
          state: "zero" | "not_started" | "setup_required" | "ready";
          count: number;
          label: string;
        };
        baselineAndHandoff: {
          state: "zero" | "not_started" | "setup_required" | "ready";
          count: number;
          label: string;
        };
      };
      nextActions: Array<string>;
    };
    AuditEventListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        actorId: string;
        action: string;
        entityType: string;
        entityId: string;
        projectId?: string;
        before: {
          [key: string]: string | number | boolean | null | Array<unknown> | {
            [key: string]: unknown;
          };
        } | null;
        after: {
          [key: string]: string | number | boolean | null | Array<unknown> | {
            [key: string]: unknown;
          };
        } | null;
        correlationId: string;
        at: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    OrganizationUserListResponseDto_Output: {
      items: Array<{
        id: string;
        name: string;
        email: string;
        status: "active" | "suspended" | "archived";
        organizationRole: "admin" | "member";
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    SourceVaultCapabilitiesResponseDto_Output: {
      writesEnabled: boolean;
      singlePageCaptureEnabled: boolean;
      ocrProcessingEnabled: boolean;
      storageAvailable: boolean;
      queueAvailable: boolean;
    };
    UploadSessionCreateBodyDto: {
      sourceType: "document";
      documentFormat: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
      title: string;
      tags?: Array<string>;
      notes?: string;
      provenanceDate?: string;
      files: Array<{
        ordinal: number;
        role: "primary" | "attachment" | "snapshot";
        originalFileName: string;
        format: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
        declaredMimeType: string;
        byteSize: number;
        sha256: string;
      }>;
      duplicateAcknowledgement?: {
        acknowledgedMatchIds: Array<string>;
      };
    } | {
      sourceType: "reference";
      title: string;
      tags?: Array<string>;
      notes?: string;
      provenanceDate?: string;
      reference: {
        referenceKind: "url" | "screenshot_set" | "uploaded_export" | "article" | "app_store_listing";
        captureMethod: "manual_paste" | "user_uploaded_screenshot" | "on_demand_single_page_capture";
        accessType: "public" | "client_owned" | "permissioned";
        intendedUse: "inspiration" | "feature_parity" | "differentiation_baseline";
        sourceUrl?: string;
        capturedAt?: string;
        attestation: {
          attestationText: "I confirm I have the right to provide this reference for functional inspiration only, not verbatim copying of protected design, text, or code.";
          attestationVersion: string;
          acceptedAt: string;
        };
      };
      files: Array<{
        ordinal: number;
        role: "primary" | "attachment" | "snapshot";
        originalFileName: string;
        format: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
        declaredMimeType: string;
        byteSize: number;
        sha256: string;
      }>;
      duplicateAcknowledgement?: {
        acknowledgedMatchIds: Array<string>;
      };
    };
    UploadSessionResponseDto_Output: {
      id: string;
      organizationId: string;
      projectId: string;
      actorId: string;
      sourceType: "document" | "reference";
      status: "created" | "uploading" | "uploaded" | "confirmed" | "canceled" | "expired";
      title: string;
      expiresAt: string;
      confirmedAt: string | null;
      createdSourceId: string | null;
      duplicateMatches: Array<{
        sourceId: string;
        title: string;
        versionNumber: number;
        isArchived: boolean;
        isSuperseded: boolean;
        contributorId: string;
        uploadedAt: string;
      }>;
      files: Array<{
        id: string;
        ordinal: number;
        role: "primary" | "attachment" | "snapshot";
        originalFileName: string;
        format: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
        declaredMimeType: string;
        byteSize: number;
        sha256: string;
        signedUploadUrl: string;
        signedUploadUrlExpiresAt: string;
      }>;
    };
    UploadSessionConfirmBodyDto: {
      duplicateAcknowledgement?: {
        acknowledgedMatchIds: Array<string>;
      };
    };
    SourceDocumentDetailResponseDto_Output: {
      id: string;
      lineageId: string;
      versionNumber: number;
      supersedesId: string | null;
      sourceType: "document" | "reference" | "manual";
      documentFormat: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp" | null;
      title: string;
      tags: Array<string>;
      processingStatus: "verification_pending" | "scan_pending" | "scanning" | "extraction_pending" | "extracting" | "ready" | "quarantined" | "failed";
      isArchived: boolean;
      hasDuplicateAcknowledgement: boolean;
      ipReviewStatus: "not_reviewed" | "cleared" | "restricted" | null;
      contentHash: string;
      createdByActorId: string;
      createdAt: string;
      version: number;
      notes: string | null;
      provenanceDate: string | null;
      archivedByActorId: string | null;
      archivedAt: string | null;
      files: Array<{
        id: string;
        ordinal: number;
        role: "primary" | "attachment" | "snapshot";
        originalFileName: string;
        downloadFileName: string;
        format: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
        declaredMimeType: string;
        byteSize: number;
        sha256: string;
        scanStatus: "not_required" | "pending" | "clean" | "infected" | "failed";
        scannedAt: string | null;
      }>;
      reference?: {
        id: string;
        sourceDocumentId: string;
        referenceKind: "url" | "screenshot_set" | "uploaded_export" | "article" | "app_store_listing";
        captureMethod: "manual_paste" | "user_uploaded_screenshot" | "on_demand_single_page_capture";
        accessType: "public" | "client_owned" | "permissioned";
        intendedUse: "inspiration" | "feature_parity" | "differentiation_baseline";
        sourceUrl: string | null;
        ipReviewStatus: "not_reviewed" | "cleared" | "restricted";
        ipReviewReason: string | null;
        ipReviewedByActorId: string | null;
        ipReviewedAt: string | null;
        attestationText: string;
        attestationVersion: string;
        attestedByActorId: string;
        attestedAt: string;
        capturedAt: string | null;
      };
    };
    UploadSessionCancelBodyDto: {
      reason?: string;
    };
    SourceDocumentListResponseDto_Output: {
      items: Array<{
        id: string;
        lineageId: string;
        versionNumber: number;
        supersedesId: string | null;
        sourceType: "document" | "reference" | "manual";
        documentFormat: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp" | null;
        title: string;
        tags: Array<string>;
        processingStatus: "verification_pending" | "scan_pending" | "scanning" | "extraction_pending" | "extracting" | "ready" | "quarantined" | "failed";
        isArchived: boolean;
        hasDuplicateAcknowledgement: boolean;
        ipReviewStatus: "not_reviewed" | "cleared" | "restricted" | null;
        contentHash: string;
        createdByActorId: string;
        createdAt: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    ManualSourceCreateBodyDto: {
      title: string;
      tags?: Array<string>;
      notes?: string;
      provenanceDate?: string;
      body: string;
      duplicateAcknowledgement?: {
        acknowledgedMatchIds: Array<string>;
      };
    };
    ReferenceSourceCreateBodyDto: {
      title: string;
      tags?: Array<string>;
      notes?: string;
      provenanceDate?: string;
      reference: {
        referenceKind: "url" | "screenshot_set" | "uploaded_export" | "article" | "app_store_listing";
        captureMethod: "manual_paste" | "user_uploaded_screenshot" | "on_demand_single_page_capture";
        accessType: "public" | "client_owned" | "permissioned";
        intendedUse: "inspiration" | "feature_parity" | "differentiation_baseline";
        sourceUrl?: string;
        capturedAt?: string;
        attestation: {
          attestationText: "I confirm I have the right to provide this reference for functional inspiration only, not verbatim copying of protected design, text, or code.";
          attestationVersion: string;
          acceptedAt: string;
        };
      };
      duplicateAcknowledgement?: {
        acknowledgedMatchIds: Array<string>;
      };
    };
    SourceMetadataPatchBodyDto: {
      version: number;
      title?: string;
      tags?: Array<string>;
      notes?: string | null;
    };
    SourceArchiveBodyDto: {
      version: number;
      reason?: string;
    };
    SourceRestoreBodyDto: {
      version: number;
    };
    SourceRetryBodyDto: {
      version: number;
    };
    SourceVersionUploadSessionBodyDto: {
      sourceType: "document";
      documentFormat: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
      title: string;
      tags?: Array<string>;
      notes?: string;
      provenanceDate?: string;
      files: Array<{
        ordinal: number;
        role: "primary" | "attachment" | "snapshot";
        originalFileName: string;
        format: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
        declaredMimeType: string;
        byteSize: number;
        sha256: string;
      }>;
      duplicateAcknowledgement?: {
        acknowledgedMatchIds: Array<string>;
      };
    } | {
      sourceType: "reference";
      title: string;
      tags?: Array<string>;
      notes?: string;
      provenanceDate?: string;
      reference: {
        referenceKind: "url" | "screenshot_set" | "uploaded_export" | "article" | "app_store_listing";
        captureMethod: "manual_paste" | "user_uploaded_screenshot" | "on_demand_single_page_capture";
        accessType: "public" | "client_owned" | "permissioned";
        intendedUse: "inspiration" | "feature_parity" | "differentiation_baseline";
        sourceUrl?: string;
        capturedAt?: string;
        attestation: {
          attestationText: "I confirm I have the right to provide this reference for functional inspiration only, not verbatim copying of protected design, text, or code.";
          attestationVersion: string;
          acceptedAt: string;
        };
      };
      files: Array<{
        ordinal: number;
        role: "primary" | "attachment" | "snapshot";
        originalFileName: string;
        format: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
        declaredMimeType: string;
        byteSize: number;
        sha256: string;
      }>;
      duplicateAcknowledgement?: {
        acknowledgedMatchIds: Array<string>;
      };
    };
    SourceVersionManualBodyDto: {
      title: string;
      tags?: Array<string>;
      notes?: string;
      provenanceDate?: string;
      body: string;
      duplicateAcknowledgement?: {
        acknowledgedMatchIds: Array<string>;
      };
    };
    SourceVersionListResponseDto_Output: {
      items: Array<{
        id: string;
        lineageId: string;
        versionNumber: number;
        supersedesId: string | null;
        sourceType: "document" | "reference" | "manual";
        documentFormat: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp" | null;
        title: string;
        tags: Array<string>;
        processingStatus: "verification_pending" | "scan_pending" | "scanning" | "extraction_pending" | "extracting" | "ready" | "quarantined" | "failed";
        isArchived: boolean;
        hasDuplicateAcknowledgement: boolean;
        ipReviewStatus: "not_reviewed" | "cleared" | "restricted" | null;
        contentHash: string;
        createdByActorId: string;
        createdAt: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    SourceExtractionListResponseDto_Output: {
      items: Array<{
        id: string;
        sourceDocumentId: string;
        extractionVersion: number;
        status: "pending" | "running" | "succeeded" | "failed";
        parserManifest: Array<{
          name: string;
          version: string;
        }>;
        chunkerVersion: string;
        extractedTextHash: string | null;
        previewObjectKey: string | null;
        startedAt: string | null;
        completedAt: string | null;
        failureCode: string | null;
        failureDetail: string | null;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    SourceChunkListResponseDto_Output: {
      items: Array<{
        id: string;
        sourceExtractionId: string;
        sequence: number;
        content: string;
        characterCount: number;
        contentHash: string;
        locator: {
          [key: string]: string | number;
        };
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    SourceFileSignedUrlResponseDto_Output: {
      url: string;
      expiresAt: string;
    };
    ReferenceCaptureRequestBodyDto: {
      url: string;
    };
    IpReviewChangeBodyDto: {
      version: number;
      ipReviewStatus: "cleared" | "restricted";
      reason: string;
    };
    ProviderPolicyListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        version: number;
        provider: "openai" | "anthropic" | "openai-compatible" | "local";
        policyName: string;
        modelAlias: string;
        resolvedModelId: string;
        dataRetentionMode: "provider_default" | "no_training" | "zero_retention";
        status: "draft" | "approved" | "inactive";
        approvedForRequirementAnalysis: boolean;
        approvedBy: string | null;
        approvedAt: string | null;
        approvalNote: string | null;
        providerTermsSnapshotHash: string | null;
        maxUsdPerRun: number;
        maxInputTokensPerRun: number;
        maxOutputTokensPerRun: number;
        maxWallClockSeconds: number;
        createdAt: string;
        updatedAt: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    ProviderPolicyCreateBodyDto: {
      provider: "openai" | "anthropic" | "openai-compatible" | "local";
      policyName: string;
      modelAlias: string;
      resolvedModelId: string;
      dataRetentionMode: "provider_default" | "no_training" | "zero_retention";
      providerTermsSnapshotHash?: string;
      approvalNote?: string;
      maxUsdPerRun?: number;
      maxInputTokensPerRun?: number;
      maxOutputTokensPerRun?: number;
      maxWallClockSeconds?: number;
    };
    ProviderPolicyResponseDto_Output: {
      id: string;
      organizationId: string;
      version: number;
      provider: "openai" | "anthropic" | "openai-compatible" | "local";
      policyName: string;
      modelAlias: string;
      resolvedModelId: string;
      dataRetentionMode: "provider_default" | "no_training" | "zero_retention";
      status: "draft" | "approved" | "inactive";
      approvedForRequirementAnalysis: boolean;
      approvedBy: string | null;
      approvedAt: string | null;
      approvalNote: string | null;
      providerTermsSnapshotHash: string | null;
      maxUsdPerRun: number;
      maxInputTokensPerRun: number;
      maxOutputTokensPerRun: number;
      maxWallClockSeconds: number;
      createdAt: string;
      updatedAt: string;
    };
    ProviderPolicyApproveBodyDto: {
      approvalNote?: string;
      providerTermsSnapshotHash?: string;
      version: number;
    };
    ProviderPolicyDeactivateBodyDto: {
      reason: string;
      version: number;
    };
    RequirementAnalysisCapabilitiesResponseDto_Output: {
      analysisEnabled: boolean;
      readsEnabled: boolean;
      referenceFeatureExtractionEnabled: boolean;
      queueAvailable: boolean;
      approvedProviderPolicyAvailable: boolean;
      safeDisabled: boolean;
      safeDisabledReason: "analysis_feature_disabled" | "provider_not_approved" | "queue_unavailable" | "reads_disabled" | null;
    };
    EligibleSourcePreviewResponseDto_Output: {
      sources: Array<{
        sourceDocumentId: string;
        sourceLineageId: string;
        sourceVersionNumber: number;
        sourceType: "document" | "reference" | "manual";
        documentFormat: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp" | null;
        title: string;
        contentHash: string;
        sourceExtractionId: string | null;
        sourceExtractionVersion: number | null;
        chunkerVersion: string | null;
        chunkCount: number;
        totalCharacterCount: number;
        referenceIpReviewStatus: "not_reviewed" | "cleared" | "restricted" | null;
        included: boolean;
        exclusionReason: "not_ready" | "archived" | "non_head_version" | "missing_successful_extraction" | "reference_not_cleared" | "reference_feature_extraction_disabled" | null;
      }>;
      includedCount: number;
      excludedCount: number;
      generatedAt: string;
    };
    AnalysisRunFreshBodyDto: {
      providerPolicyId: string;
      sourceDocumentIds?: Array<string>;
    };
    AnalysisRunDetailResponseDto_Output: {
      id: string;
      organizationId: string;
      projectId: string;
      requestedBy: string;
      mode: "fresh" | "replay" | "reprocess" | "retry";
      status: "requested" | "snapshotting" | "queued" | "running" | "waiting_retry" | "completed" | "completed_with_warnings" | "failed" | "canceled";
      sourceSnapshotId: string | null;
      replayOfRunId: string | null;
      reprocessOfRunId: string | null;
      retryOfRunId: string | null;
      warningCodes: Array<string>;
      failureCode: string | null;
      failureDetail: string | null;
      failureRetryable: boolean;
      failedStageId: string | null;
      cancelRequestedAt: string | null;
      cancelRequestedBy: string | null;
      cancelReason: string | null;
      startedAt: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
      correlationId: string;
      providerPolicy: {
        providerPolicyId: string;
        provider: "openai" | "anthropic" | "openai-compatible" | "local";
        modelAlias: string;
        resolvedModelId: string;
        dataRetentionMode: "provider_default" | "no_training" | "zero_retention";
      };
      provenance: {
        promptBundleVersion: string;
        promptBundleHash: string;
        schemaBundleVersion: string;
        schemaBundleHash: string;
        pipelineVersion: string;
        pipelineHash: string;
        modelPolicyHash: string;
      };
      budgets: {
        maxUsd: number;
        maxInputTokens: number;
        maxOutputTokens: number;
        maxWallClockSeconds: number;
      };
      usage: {
        inputTokensUsed: number;
        outputTokensUsed: number;
        costUsd: number;
      };
      artifactCounts: {
        requirements: number;
        citations: number;
        coverageEntries: number;
        deliveryItems: number;
      };
      snapshot: {
        id: string;
        snapshotHash: string;
        sourceCount: number;
        chunkCount: number;
        totalCharacterCount: number;
        eligibilityRulesVersion: string;
        createdAt: string;
      } | null;
      readNotices: Array<string>;
    };
    AnalysisRunListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        projectId: string;
        requestedBy: string;
        mode: "fresh" | "replay" | "reprocess" | "retry";
        status: "requested" | "snapshotting" | "queued" | "running" | "waiting_retry" | "completed" | "completed_with_warnings" | "failed" | "canceled";
        sourceSnapshotId: string | null;
        replayOfRunId: string | null;
        reprocessOfRunId: string | null;
        retryOfRunId: string | null;
        warningCodes: Array<string>;
        failureCode: string | null;
        failureDetail: string | null;
        failureRetryable: boolean;
        failedStageId: string | null;
        cancelRequestedAt: string | null;
        cancelRequestedBy: string | null;
        cancelReason: string | null;
        startedAt: string | null;
        completedAt: string | null;
        createdAt: string;
        updatedAt: string;
        correlationId: string;
        providerPolicy: {
          providerPolicyId: string;
          provider: "openai" | "anthropic" | "openai-compatible" | "local";
          modelAlias: string;
          resolvedModelId: string;
          dataRetentionMode: "provider_default" | "no_training" | "zero_retention";
        };
        provenance: {
          promptBundleVersion: string;
          promptBundleHash: string;
          schemaBundleVersion: string;
          schemaBundleHash: string;
          pipelineVersion: string;
          pipelineHash: string;
          modelPolicyHash: string;
        };
        budgets: {
          maxUsd: number;
          maxInputTokens: number;
          maxOutputTokens: number;
          maxWallClockSeconds: number;
        };
        usage: {
          inputTokensUsed: number;
          outputTokensUsed: number;
          costUsd: number;
        };
        artifactCounts: {
          requirements: number;
          citations: number;
          coverageEntries: number;
          deliveryItems: number;
        };
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    AnalysisRunCancelBodyDto: {
      reason?: string;
    };
    AnalysisRunRetryBodyDto: {
      reason?: string;
    };
    AnalysisRunReplayBodyDto: {
      reason?: string;
    };
    AnalysisRunReprocessBodyDto: {
      providerPolicyId: string;
      promptBundleVersion: string;
      schemaBundleVersion: string;
      pipelineVersion: string;
      reason?: string;
    };
    AnalysisStageListResponseDto_Output: {
      items: Array<{
        id: string;
        runId: string;
        organizationId: string;
        projectId: string;
        kind: "freeze_snapshot" | "batch_planning" | "confirmed_extraction" | "citation_verification" | "reference_feature_extraction" | "normalization_deduplication" | "conflict_detection" | "coverage_analysis" | "delivery_item_extraction" | "question_generation" | "finalize_review_package";
        status: "pending" | "running" | "waiting_retry" | "completed" | "completed_with_warnings" | "failed" | "canceled" | "skipped";
        attemptNumber: number;
        idempotencyKey: string;
        inputHash: string | null;
        outputHash: string | null;
        startedAt: string | null;
        completedAt: string | null;
        retryAfter: string | null;
        failureCode: string | null;
        failureDetail: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    AnalysisBatchListResponseDto_Output: {
      items: Array<{
        id: string;
        stageId: string;
        runId: string;
        organizationId: string;
        projectId: string;
        batchOrder: number;
        sourceChunkStartSequence: number;
        sourceChunkEndSequence: number;
        inputTokenEstimate: number;
        maxOutputTokens: number;
        status: "pending" | "running" | "waiting_retry" | "completed" | "completed_with_warnings" | "failed" | "canceled" | "skipped";
        attemptNumber: number;
        aiRunId: string | null;
        repairOfBatchId: string | null;
        shapeOnlyRepairUsed: boolean;
        cacheKey: string | null;
        cacheHitOfBatchId: string | null;
        failureCode: string | null;
        failureDetail: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    RequirementListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        stableKey: string;
        title: string;
        description: string;
        requirementType: "functional" | "non_functional" | "business_rule" | "data" | "integration" | "security" | "compliance" | "operational";
        priority: "must_have" | "should_have" | "could_have" | "later" | null;
        epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
        confidenceBand: "low" | "medium" | "high" | null;
        confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
        inferenceBasis: string | null;
        origin: "source" | "reference" | "manual";
        lifecycleState: "ai_suggested" | "under_review" | "accepted" | "needs_clarification" | "rejected" | "approved" | "changed" | "deprecated";
        dedupeGroupKey: string | null;
        parentRequirementId: string | null;
        sourceSummary: string | null;
        createdByAiRunId: string;
        createdAt: string;
        updatedAt: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    RequirementResponseDto_Output: {
      id: string;
      organizationId: string;
      projectId: string;
      analysisRunId: string;
      stableKey: string;
      title: string;
      description: string;
      requirementType: "functional" | "non_functional" | "business_rule" | "data" | "integration" | "security" | "compliance" | "operational";
      priority: "must_have" | "should_have" | "could_have" | "later" | null;
      epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
      confidenceBand: "low" | "medium" | "high" | null;
      confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
      inferenceBasis: string | null;
      origin: "source" | "reference" | "manual";
      lifecycleState: "ai_suggested" | "under_review" | "accepted" | "needs_clarification" | "rejected" | "approved" | "changed" | "deprecated";
      dedupeGroupKey: string | null;
      parentRequirementId: string | null;
      sourceSummary: string | null;
      createdByAiRunId: string;
      createdAt: string;
      updatedAt: string;
    };
    DeliveryItemListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        title: string;
        description: string;
        epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
        confidenceBand: "low" | "medium" | "high" | null;
        confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
        severity: "low" | "medium" | "high" | null;
        priority: "low" | "medium" | "high" | null;
        status: "open";
        visibility: "internal";
        sourceRequirementId: string | null;
        createdByAiRunId: string;
        createdAt: string;
        updatedAt: string;
        itemType: "question";
        attributes: {
          questionText: string;
          whyItMatters: string;
          suggestedResponseFormat: string;
          impactIfUnanswered: string;
          linkedCoverageEntryIds: Array<string>;
          linkedRequirementIds: Array<string>;
          linkedConflictDeliveryItemIds: Array<string>;
        };
      } | {
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        title: string;
        description: string;
        epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
        confidenceBand: "low" | "medium" | "high" | null;
        confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
        severity: "low" | "medium" | "high" | null;
        priority: "low" | "medium" | "high" | null;
        status: "open";
        visibility: "internal";
        sourceRequirementId: string | null;
        createdByAiRunId: string;
        createdAt: string;
        updatedAt: string;
        itemType: "risk";
        attributes: {
          category: string;
          probabilityBand: "low" | "medium" | "high";
          impactBand: "low" | "medium" | "high";
          mitigationPrompt: string;
          trigger: string;
        };
      } | {
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        title: string;
        description: string;
        epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
        confidenceBand: "low" | "medium" | "high" | null;
        confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
        severity: "low" | "medium" | "high" | null;
        priority: "low" | "medium" | "high" | null;
        status: "open";
        visibility: "internal";
        sourceRequirementId: string | null;
        createdByAiRunId: string;
        createdAt: string;
        updatedAt: string;
        itemType: "assumption";
        attributes: {
          inferenceBasis: string;
          validationNeeded: boolean;
          validationMethod: string;
        };
      } | {
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        title: string;
        description: string;
        epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
        confidenceBand: "low" | "medium" | "high" | null;
        confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
        severity: "low" | "medium" | "high" | null;
        priority: "low" | "medium" | "high" | null;
        status: "open";
        visibility: "internal";
        sourceRequirementId: string | null;
        createdByAiRunId: string;
        createdAt: string;
        updatedAt: string;
        itemType: "dependency";
        attributes: {
          dependencyName: string;
          dependencyDirection: "internal" | "external";
          blockedArea: string;
          riskIfDelayed: string;
        };
      } | {
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        title: string;
        description: string;
        epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
        confidenceBand: "low" | "medium" | "high" | null;
        confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
        severity: "low" | "medium" | "high" | null;
        priority: "low" | "medium" | "high" | null;
        status: "open";
        visibility: "internal";
        sourceRequirementId: string | null;
        createdByAiRunId: string;
        createdAt: string;
        updatedAt: string;
        itemType: "blocker";
        attributes: {
          subtype: "conflict";
          contradictionSummary: string;
          conflictingCitationIds: Array<string>;
          suggestedResolutionQuestion: string;
        };
      } | {
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        title: string;
        description: string;
        epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
        confidenceBand: "low" | "medium" | "high" | null;
        confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
        severity: "low" | "medium" | "high" | null;
        priority: "low" | "medium" | "high" | null;
        status: "open";
        visibility: "internal";
        sourceRequirementId: string | null;
        createdByAiRunId: string;
        createdAt: string;
        updatedAt: string;
        itemType: "scope_change_candidate";
        attributes: {
          classification: "scope_creep";
          changeSource: string;
          baselineImpactHypothesis: string;
          approvalNeeded: boolean;
        } | {
          classification: "out_of_scope";
          exclusionBasis: string;
          supportingRationale: string;
        };
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    AugmentedZodDto_Output: {
      id: string;
      organizationId: string;
      projectId: string;
      analysisRunId: string;
      title: string;
      description: string;
      epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
      confidenceBand: "low" | "medium" | "high" | null;
      confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
      severity: "low" | "medium" | "high" | null;
      priority: "low" | "medium" | "high" | null;
      status: "open";
      visibility: "internal";
      sourceRequirementId: string | null;
      createdByAiRunId: string;
      createdAt: string;
      updatedAt: string;
      itemType: "question";
      attributes: {
        questionText: string;
        whyItMatters: string;
        suggestedResponseFormat: string;
        impactIfUnanswered: string;
        linkedCoverageEntryIds: Array<string>;
        linkedRequirementIds: Array<string>;
        linkedConflictDeliveryItemIds: Array<string>;
      };
    } | {
      id: string;
      organizationId: string;
      projectId: string;
      analysisRunId: string;
      title: string;
      description: string;
      epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
      confidenceBand: "low" | "medium" | "high" | null;
      confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
      severity: "low" | "medium" | "high" | null;
      priority: "low" | "medium" | "high" | null;
      status: "open";
      visibility: "internal";
      sourceRequirementId: string | null;
      createdByAiRunId: string;
      createdAt: string;
      updatedAt: string;
      itemType: "risk";
      attributes: {
        category: string;
        probabilityBand: "low" | "medium" | "high";
        impactBand: "low" | "medium" | "high";
        mitigationPrompt: string;
        trigger: string;
      };
    } | {
      id: string;
      organizationId: string;
      projectId: string;
      analysisRunId: string;
      title: string;
      description: string;
      epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
      confidenceBand: "low" | "medium" | "high" | null;
      confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
      severity: "low" | "medium" | "high" | null;
      priority: "low" | "medium" | "high" | null;
      status: "open";
      visibility: "internal";
      sourceRequirementId: string | null;
      createdByAiRunId: string;
      createdAt: string;
      updatedAt: string;
      itemType: "assumption";
      attributes: {
        inferenceBasis: string;
        validationNeeded: boolean;
        validationMethod: string;
      };
    } | {
      id: string;
      organizationId: string;
      projectId: string;
      analysisRunId: string;
      title: string;
      description: string;
      epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
      confidenceBand: "low" | "medium" | "high" | null;
      confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
      severity: "low" | "medium" | "high" | null;
      priority: "low" | "medium" | "high" | null;
      status: "open";
      visibility: "internal";
      sourceRequirementId: string | null;
      createdByAiRunId: string;
      createdAt: string;
      updatedAt: string;
      itemType: "dependency";
      attributes: {
        dependencyName: string;
        dependencyDirection: "internal" | "external";
        blockedArea: string;
        riskIfDelayed: string;
      };
    } | {
      id: string;
      organizationId: string;
      projectId: string;
      analysisRunId: string;
      title: string;
      description: string;
      epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
      confidenceBand: "low" | "medium" | "high" | null;
      confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
      severity: "low" | "medium" | "high" | null;
      priority: "low" | "medium" | "high" | null;
      status: "open";
      visibility: "internal";
      sourceRequirementId: string | null;
      createdByAiRunId: string;
      createdAt: string;
      updatedAt: string;
      itemType: "blocker";
      attributes: {
        subtype: "conflict";
        contradictionSummary: string;
        conflictingCitationIds: Array<string>;
        suggestedResolutionQuestion: string;
      };
    } | {
      id: string;
      organizationId: string;
      projectId: string;
      analysisRunId: string;
      title: string;
      description: string;
      epistemicStatus: "confirmed" | "assumed" | "unknown" | "conflicting";
      confidenceBand: "low" | "medium" | "high" | null;
      confidenceReasonCodes: Array<"verified_exact_citation" | "multiple_source_corroboration" | "evidence_span_complete" | "evidence_span_ambiguous" | "stage_agreement" | "stage_disagreement" | "coverage_addressed" | "inference_basis_present" | "supporting_context_citation_verified" | "supporting_context_citation_missing">;
      severity: "low" | "medium" | "high" | null;
      priority: "low" | "medium" | "high" | null;
      status: "open";
      visibility: "internal";
      sourceRequirementId: string | null;
      createdByAiRunId: string;
      createdAt: string;
      updatedAt: string;
      itemType: "scope_change_candidate";
      attributes: {
        classification: "scope_creep";
        changeSource: string;
        baselineImpactHypothesis: string;
        approvalNeeded: boolean;
      } | {
        classification: "out_of_scope";
        exclusionBasis: string;
        supportingRationale: string;
      };
    };
    CoverageListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        categoryKey: "auth_identity" | "roles_permissions" | "data_model_entities" | "integrations" | "notifications" | "reporting_analytics" | "admin" | "error_handling" | "audit_logging" | "nfr_performance_scale_availability" | "security_compliance" | "deployment_environments" | "data_migration" | "i18n_localization" | "accessibility" | "backup_disaster_recovery" | "slas" | "support_model";
        categoryLabel: string;
        categoryOrder: number;
        status: "addressed" | "partial" | "absent";
        rationale: string;
        evidenceState: "verified_citation" | "none_found" | "downgraded";
        questionDeliveryItemId: string | null;
        createdByAiRunId: string;
        createdAt: string;
      }>;
    };
    CitationListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        projectId: string;
        analysisRunId: string;
        requirementId: string | null;
        coverageMatrixEntryId: string | null;
        deliveryItemId: string | null;
        sourceDocumentId: string;
        sourceVersionNumber: number;
        sourceContentHash: string;
        sourceExtractionId: string;
        sourceExtractionVersion: number;
        sourceChunkId: string;
        sourceChunkSequence: number;
        chunkContentHash: string;
        locator: {
          [key: string]: string | number | boolean | null;
        };
        quoteTextOriginal: string;
        quoteTextNormalized: string;
        quoteHash: string;
        matchStartOffset: number;
        matchEndOffset: number;
        normalizationMode: string;
        verificationStatus: "verified_exact" | "downgraded_fuzzy" | "failed";
        createdByAiRunId: string;
        createdAt: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
    CitationEvidenceResponseDto_Output: {
      id: string;
      organizationId: string;
      projectId: string;
      analysisRunId: string;
      requirementId: string | null;
      coverageMatrixEntryId: string | null;
      deliveryItemId: string | null;
      sourceDocumentId: string;
      sourceVersionNumber: number;
      sourceContentHash: string;
      sourceExtractionId: string;
      sourceExtractionVersion: number;
      sourceChunkId: string;
      sourceChunkSequence: number;
      chunkContentHash: string;
      locator: {
        [key: string]: string | number | boolean | null;
      };
      quoteTextOriginal: string;
      quoteTextNormalized: string;
      quoteHash: string;
      matchStartOffset: number;
      matchEndOffset: number;
      normalizationMode: string;
      verificationStatus: "verified_exact" | "downgraded_fuzzy" | "failed";
      createdByAiRunId: string;
      createdAt: string;
      sourceTitle: string;
      sourceVersionLabel: string;
    };
    TraceabilityListResponseDto_Output: {
      items: Array<{
        id: string;
        organizationId: string;
        fromType: string;
        fromId: string;
        toType: string;
        toId: string;
        relation: string;
        createdBy: string | null;
        createdAt: string;
      }>;
      pageInfo: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
        total?: number;
      };
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export interface operations {
  HealthController_getHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["HealthResponseDto"];
        };
      };
    };
  };
  MeController_getCurrentUser: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["MeResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  OrganizationController_getCurrentOrganization: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CurrentOrganizationDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ClientsController_listClients: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        status?: string;
        search?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ClientListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ClientsController_createClient: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ClientCreateBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ClientResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ClientsController_getClient: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        clientId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ClientResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ClientsController_updateClient: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        clientId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ClientUpdateBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ClientResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ClientsController_archiveClient: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        clientId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ClientResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_listProjects: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        type?: "client" | "internal";
        status?: "draft" | "active" | "on_hold" | "completed" | "archived";
        phase?: "intake" | "requirements" | "clarification" | "baseline" | "architecture" | "delivery" | "handoff" | "closed";
        priority?: "low" | "medium" | "high" | "critical";
        visibility?: "private" | "organization";
        clientId?: string;
        ownerId?: string;
        search?: string;
        includeArchived?: boolean | "true" | "false" | "1" | "0";
        sort?: "updated_desc" | "updated_asc" | "name_asc" | "name_desc";
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProjectListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_createProject: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ProjectCreateBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProjectResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_getProject: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProjectResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_updateProject: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ProjectUpdateBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProjectResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_archiveProject: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProjectResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_restoreProject: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProjectResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_listMemberships: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        userId?: string;
        role?: "Admin" | "Project Owner" | "Architect / Tech Lead" | "Business Analyst / Coordinator" | "Developer" | "QA" | "Client Viewer / Approver";
        status?: "invited" | "active" | "removed";
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["MembershipListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_addMembership: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MembershipCreateBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["MembershipResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_removeMembership: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        membershipId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["MembershipResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_updateMembership: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        membershipId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MembershipUpdateBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["MembershipResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_getDashboard: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProjectDashboardResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  ProjectsController_listAuditEvents: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        entityType?: string;
        entityId?: string;
        actorId?: string;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AuditEventListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  OrganizationUsersController_listOrganizationUsers: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        search?: string;
        status?: "active" | "suspended" | "archived";
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["OrganizationUserListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_getCapabilities: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceVaultCapabilitiesResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_createUploadSession: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["UploadSessionCreateBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["UploadSessionResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_getUploadSession: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["UploadSessionResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_confirmUploadSession: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["UploadSessionConfirmBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_cancelUploadSession: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["UploadSessionCancelBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["UploadSessionResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_listSources: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        sourceType?: "document" | "reference" | "manual";
        documentFormat?: "pdf" | "docx" | "txt" | "md" | "xlsx" | "csv" | "pptx" | "png" | "jpg" | "jpeg" | "webp";
        processingStatus?: "verification_pending" | "scan_pending" | "scanning" | "extraction_pending" | "extracting" | "ready" | "quarantined" | "failed";
        ipReviewStatus?: "not_reviewed" | "cleared" | "restricted";
        includeArchived?: boolean | "true" | "false" | "1" | "0";
        hasUnacknowledgedDuplicate?: boolean | "true" | "false" | "1" | "0";
        tag?: string;
        contributorId?: string;
        search?: string;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_createManualSource: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ManualSourceCreateBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_createReferenceSource: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ReferenceSourceCreateBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_getSource: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_updateMetadata: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SourceMetadataPatchBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_archiveSource: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SourceArchiveBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_restoreSource: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SourceRestoreBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_retryProcessing: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SourceRetryBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_createVersionUploadSession: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SourceVersionUploadSessionBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["UploadSessionResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_createVersionManual: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SourceVersionManualBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_listVersions: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
      };
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceVersionListResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_listExtractions: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
      };
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceExtractionListResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_listChunks: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
      };
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceChunkListResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_getPreviewUrl: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
        fileId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceFileSignedUrlResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_getDownloadUrl: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
        fileId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceFileSignedUrlResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_requestReferenceCapture: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ReferenceCaptureRequestBodyDto"];
      };
    };
    responses: {
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  SourceDocumentsController_changeIpReview: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        sourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["IpReviewChangeBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SourceDocumentDetailResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisOrganizationController_listProviderPolicies: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        status?: "draft" | "approved" | "inactive";
        provider?: "openai" | "anthropic" | "openai-compatible" | "local";
        includeInactive?: boolean | "true" | "false" | "1" | "0";
        search?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProviderPolicyListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisOrganizationController_createProviderPolicy: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ProviderPolicyCreateBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProviderPolicyResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisOrganizationController_approveProviderPolicy: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        policyId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ProviderPolicyApproveBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProviderPolicyResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisOrganizationController_deactivateProviderPolicy: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        policyId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ProviderPolicyDeactivateBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProviderPolicyResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_getCapabilities: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RequirementAnalysisCapabilitiesResponseDto_Output"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listProjectProviderPolicies: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        status?: "draft" | "approved" | "inactive";
        provider?: "openai" | "anthropic" | "openai-compatible" | "local";
        includeInactive?: boolean | "true" | "false" | "1" | "0";
        search?: string;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ProviderPolicyListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_previewEligibleSources: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["EligibleSourcePreviewResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listRuns: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        status?: "requested" | "snapshotting" | "queued" | "running" | "waiting_retry" | "completed" | "completed_with_warnings" | "failed" | "canceled";
        mode?: "fresh" | "replay" | "reprocess" | "retry";
        requestedBy?: string;
        providerPolicyId?: string;
        createdAfter?: string;
        createdBefore?: string;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisRunListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_createFreshRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["AnalysisRunFreshBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisRunDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_getRunDetail: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisRunDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_cancelRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["AnalysisRunCancelBodyDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisRunDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_retryRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["AnalysisRunRetryBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisRunDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_replayRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["AnalysisRunReplayBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisRunDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_reprocessRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["AnalysisRunReprocessBodyDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisRunDetailResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listStages: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        status?: "pending" | "running" | "waiting_retry" | "completed" | "completed_with_warnings" | "failed" | "canceled" | "skipped";
        kind?: "freeze_snapshot" | "batch_planning" | "confirmed_extraction" | "citation_verification" | "reference_feature_extraction" | "normalization_deduplication" | "conflict_detection" | "coverage_analysis" | "delivery_item_extraction" | "question_generation" | "finalize_review_package";
      };
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisStageListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listBatches: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        stageId?: string;
        status?: "pending" | "running" | "waiting_retry" | "completed" | "completed_with_warnings" | "failed" | "canceled" | "skipped";
      };
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AnalysisBatchListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listRequirements: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        requirementType?: "functional" | "non_functional" | "business_rule" | "data" | "integration" | "security" | "compliance" | "operational";
        priority?: "must_have" | "should_have" | "could_have" | "later";
        epistemicStatus?: "confirmed" | "assumed" | "unknown" | "conflicting";
        lifecycleState?: "ai_suggested" | "under_review" | "accepted" | "needs_clarification" | "rejected" | "approved" | "changed" | "deprecated";
        search?: string;
      };
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RequirementListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_getRequirement: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        runId: string;
        requirementId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RequirementResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listDeliveryItems: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        itemType?: "question" | "risk" | "assumption" | "dependency" | "blocker" | "scope_change_candidate";
        status?: "open";
        severity?: "low" | "medium" | "high";
        priority?: "low" | "medium" | "high";
        sourceRequirementId?: string;
        search?: string;
      };
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["DeliveryItemListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_getDeliveryItem: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        runId: string;
        itemId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AugmentedZodDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listCoverage: {
    parameters: {
      query?: {
        status?: "addressed" | "partial" | "absent";
        categoryKey?: "auth_identity" | "roles_permissions" | "data_model_entities" | "integrations" | "notifications" | "reporting_analytics" | "admin" | "error_handling" | "audit_logging" | "nfr_performance_scale_availability" | "security_compliance" | "deployment_environments" | "data_migration" | "i18n_localization" | "accessibility" | "backup_disaster_recovery" | "slas" | "support_model";
      };
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CoverageListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listCitations: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        verificationStatus?: "verified_exact" | "downgraded_fuzzy" | "failed";
        requirementId?: string;
        coverageMatrixEntryId?: string;
        deliveryItemId?: string;
        sourceDocumentId?: string;
      };
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CitationListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_getCitationEvidence: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        runId: string;
        citationId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CitationEvidenceResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
  RequirementAnalysisController_listTraceability: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        relation?: string;
      };
      header?: never;
      path: {
        projectId: string;
        runId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["TraceabilityListResponseDto_Output"];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorDto"];
        };
      };
    };
  };
}
