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
}
