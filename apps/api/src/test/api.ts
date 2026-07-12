import { type AuditEvent, auditEvent, type Database } from "@atlashq/db";
import { correlationIdHeader } from "@atlashq/logger";
import { and, desc, eq } from "drizzle-orm";
import { API_PREFIX, type TestAgent } from "./fixtures.js";

/**
 * Thin, cookie-preserving wrappers over the versioned `/api/v1` REST surface used by the
 * integration specs. Each helper optionally attaches an `x-correlation-id` header so a test can
 * assert correlation propagation into the error envelope and the persisted audit row. These
 * endpoints are session-authenticated (no CSRF/Origin requirement — that only applies to Better
 * Auth's own `/api/auth/*` routes), so no Origin header is set here.
 */

const CLIENTS = `${API_PREFIX}/clients`;
const PROJECTS = `${API_PREFIX}/projects`;
const ORGANIZATION_USERS = `${API_PREFIX}/organizations/current/users`;
const ORGANIZATION_AI_PROVIDER_POLICIES = `${API_PREFIX}/organizations/current/ai-provider-policies`;

function project(projectId: string): string {
  return `${PROJECTS}/${projectId}`;
}

function requirementAnalysis(projectId: string): string {
  return `${project(projectId)}/requirement-analysis`;
}

type JsonBody = Record<string, unknown>;

function send(
  agent: TestAgent,
  method: "post" | "patch",
  path: string,
  body: JsonBody,
  correlationId?: string,
) {
  const req = agent[method](path);
  if (correlationId) {
    req.set(correlationIdHeader, correlationId);
  }
  return req.send(body);
}

function get(agent: TestAgent, path: string, correlationId?: string) {
  const req = agent.get(path);
  if (correlationId) {
    req.set(correlationIdHeader, correlationId);
  }
  return req;
}

function del(agent: TestAgent, path: string, correlationId?: string) {
  const req = agent.delete(path);
  if (correlationId) {
    req.set(correlationIdHeader, correlationId);
  }
  return req.send();
}

// --- Clients ---

export function listClients(agent: TestAgent, query = "") {
  return get(agent, `${CLIENTS}${query}`);
}

export function getClient(agent: TestAgent, clientId: string) {
  return get(agent, `${CLIENTS}/${clientId}`);
}

export function createClient(agent: TestAgent, body: JsonBody, correlationId?: string) {
  return send(agent, "post", CLIENTS, body, correlationId);
}

export function updateClient(
  agent: TestAgent,
  clientId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(agent, "patch", `${CLIENTS}/${clientId}`, body, correlationId);
}

export function archiveClient(agent: TestAgent, clientId: string, correlationId?: string) {
  return send(agent, "post", `${CLIENTS}/${clientId}/archive`, {}, correlationId);
}

// --- Projects ---

export function listProjects(agent: TestAgent, query = "") {
  return get(agent, `${PROJECTS}${query}`);
}

export function getProject(agent: TestAgent, projectId: string) {
  return get(agent, `${PROJECTS}/${projectId}`);
}

export function createProject(agent: TestAgent, body: JsonBody, correlationId?: string) {
  return send(agent, "post", PROJECTS, body, correlationId);
}

export function updateProject(
  agent: TestAgent,
  projectId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(agent, "patch", `${PROJECTS}/${projectId}`, body, correlationId);
}

export function archiveProject(agent: TestAgent, projectId: string, correlationId?: string) {
  return send(agent, "post", `${PROJECTS}/${projectId}/archive`, {}, correlationId);
}

export function restoreProject(agent: TestAgent, projectId: string, correlationId?: string) {
  return send(agent, "post", `${PROJECTS}/${projectId}/restore`, {}, correlationId);
}

// --- Memberships ---

export function listMemberships(agent: TestAgent, projectId: string, query = "") {
  return get(agent, `${PROJECTS}/${projectId}/memberships${query}`);
}

export function addMembership(
  agent: TestAgent,
  projectId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(agent, "post", `${PROJECTS}/${projectId}/memberships`, body, correlationId);
}

export function updateMembership(
  agent: TestAgent,
  projectId: string,
  membershipId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(
    agent,
    "patch",
    `${PROJECTS}/${projectId}/memberships/${membershipId}`,
    body,
    correlationId,
  );
}

export function removeMembership(
  agent: TestAgent,
  projectId: string,
  membershipId: string,
  correlationId?: string,
) {
  return del(agent, `${PROJECTS}/${projectId}/memberships/${membershipId}`, correlationId);
}

// --- Organization directory ---

export function listOrganizationUsers(agent: TestAgent, query = "") {
  return get(agent, `${ORGANIZATION_USERS}${query}`);
}

// --- Organization AI provider policies (Module 3) ---

export function listAiProviderPolicies(agent: TestAgent, query = "") {
  return get(agent, `${ORGANIZATION_AI_PROVIDER_POLICIES}${query}`);
}

export function createAiProviderPolicy(agent: TestAgent, body: JsonBody, correlationId?: string) {
  return send(agent, "post", ORGANIZATION_AI_PROVIDER_POLICIES, body, correlationId);
}

export function approveAiProviderPolicy(
  agent: TestAgent,
  policyId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${ORGANIZATION_AI_PROVIDER_POLICIES}/${policyId}/approve`,
    body,
    correlationId,
  );
}

export function deactivateAiProviderPolicy(
  agent: TestAgent,
  policyId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${ORGANIZATION_AI_PROVIDER_POLICIES}/${policyId}/deactivate`,
    body,
    correlationId,
  );
}

// --- Audit ---

export function listProjectAuditEvents(agent: TestAgent, projectId: string, query = "") {
  return get(agent, `${PROJECTS}/${projectId}/audit-events${query}`);
}

export type AuditFilter = {
  correlationId?: string;
  projectId?: string;
  entityId?: string;
  entityType?: string;
  action?: string;
};

/** Read persisted audit rows directly (newest first) to assert transactional side effects. */
export async function findAuditEvents(db: Database, filter: AuditFilter): Promise<AuditEvent[]> {
  const conditions = [];
  if (filter.correlationId) {
    conditions.push(eq(auditEvent.correlationId, filter.correlationId));
  }
  if (filter.projectId) {
    conditions.push(eq(auditEvent.projectId, filter.projectId));
  }
  if (filter.entityId) {
    conditions.push(eq(auditEvent.entityId, filter.entityId));
  }
  if (filter.entityType) {
    conditions.push(eq(auditEvent.entityType, filter.entityType));
  }
  if (filter.action) {
    conditions.push(eq(auditEvent.action, filter.action));
  }

  const where =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  return db.select().from(auditEvent).where(where).orderBy(desc(auditEvent.at));
}

/** Convenience: the distinct audit actions recorded for a project, newest first. */
export async function auditActionsForProject(db: Database, projectId: string): Promise<string[]> {
  const rows = await findAuditEvents(db, { projectId });
  return rows.map((row) => row.action);
}

// --- Source Documents (Module 2) ---

export function createUploadSession(
  agent: TestAgent,
  projectId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${project(projectId)}/source-document-upload-sessions`,
    body,
    correlationId,
  );
}

export function getUploadSession(agent: TestAgent, projectId: string, sessionId: string) {
  return get(agent, `${project(projectId)}/source-document-upload-sessions/${sessionId}`);
}

export function confirmUploadSession(
  agent: TestAgent,
  projectId: string,
  sessionId: string,
  body: JsonBody = {},
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${project(projectId)}/source-document-upload-sessions/${sessionId}/confirm`,
    body,
    correlationId,
  );
}

export function cancelUploadSession(
  agent: TestAgent,
  projectId: string,
  sessionId: string,
  body: JsonBody = {},
) {
  return send(
    agent,
    "post",
    `${project(projectId)}/source-document-upload-sessions/${sessionId}/cancel`,
    body,
  );
}

export function listSources(agent: TestAgent, projectId: string, query = "") {
  return get(agent, `${project(projectId)}/source-documents${query}`);
}

export function getSourceVaultCapabilities(agent: TestAgent, projectId: string) {
  return get(agent, `${project(projectId)}/source-vault/capabilities`);
}

export function getSource(agent: TestAgent, projectId: string, sourceId: string) {
  return get(agent, `${project(projectId)}/source-documents/${sourceId}`);
}

export function listExtractions(agent: TestAgent, projectId: string, sourceId: string) {
  return get(agent, `${project(projectId)}/source-documents/${sourceId}/extractions`);
}

export function createManualSource(
  agent: TestAgent,
  projectId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(agent, "post", `${project(projectId)}/source-documents/manual`, body, correlationId);
}

export function createReferenceSource(
  agent: TestAgent,
  projectId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${project(projectId)}/source-documents/references`,
    body,
    correlationId,
  );
}

export function patchSourceMetadata(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  body: JsonBody,
) {
  return send(agent, "patch", `${project(projectId)}/source-documents/${sourceId}/metadata`, body);
}

export function archiveSource(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  body: JsonBody = {},
) {
  return send(agent, "post", `${project(projectId)}/source-documents/${sourceId}/archive`, body);
}

export function restoreSource(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  body: JsonBody = {},
) {
  return send(agent, "post", `${project(projectId)}/source-documents/${sourceId}/restore`, body);
}

export function createVersionUploadSession(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  body: JsonBody,
) {
  return send(
    agent,
    "post",
    `${project(projectId)}/source-documents/${sourceId}/versions/upload-session`,
    body,
  );
}

export function createVersionManualSource(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  body: JsonBody,
) {
  return send(
    agent,
    "post",
    `${project(projectId)}/source-documents/${sourceId}/versions/manual`,
    body,
  );
}

export function getSourceDownloadUrl(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  fileId: string,
) {
  return get(
    agent,
    `${project(projectId)}/source-documents/${sourceId}/files/${fileId}/download-url`,
  );
}

export function getSourcePreviewUrl(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  fileId: string,
) {
  return get(
    agent,
    `${project(projectId)}/source-documents/${sourceId}/files/${fileId}/preview-url`,
  );
}

export function requestReferenceCapture(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  body: JsonBody,
) {
  return send(
    agent,
    "post",
    `${project(projectId)}/source-documents/${sourceId}/reference-capture`,
    body,
  );
}

export function updateReferenceIpReview(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  body: JsonBody,
) {
  return send(agent, "post", `${project(projectId)}/source-documents/${sourceId}/ip-review`, body);
}

export function retrySourceProcessing(
  agent: TestAgent,
  projectId: string,
  sourceId: string,
  body: JsonBody,
) {
  return send(
    agent,
    "post",
    `${project(projectId)}/source-documents/${sourceId}/retry-processing`,
    body,
  );
}

export function getProjectDashboard(agent: TestAgent, projectId: string) {
  return get(agent, `${project(projectId)}/dashboard`);
}

// --- Requirement analysis (Module 3) ---

export function getRequirementAnalysisCapabilities(agent: TestAgent, projectId: string) {
  return get(agent, `${requirementAnalysis(projectId)}/capabilities`);
}

export function listRequirementAnalysisProviderPolicies(
  agent: TestAgent,
  projectId: string,
  query = "",
) {
  return get(agent, `${requirementAnalysis(projectId)}/provider-policies${query}`);
}

export function previewRequirementAnalysisEligibleSources(agent: TestAgent, projectId: string) {
  return get(agent, `${requirementAnalysis(projectId)}/eligible-sources`);
}

export function createRequirementAnalysisRun(
  agent: TestAgent,
  projectId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(agent, "post", `${requirementAnalysis(projectId)}/runs`, body, correlationId);
}

export function listRequirementAnalysisRuns(agent: TestAgent, projectId: string, query = "") {
  return get(agent, `${requirementAnalysis(projectId)}/runs${query}`);
}

export function getRequirementAnalysisRun(agent: TestAgent, projectId: string, runId: string) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}`);
}

export function cancelRequirementAnalysisRun(
  agent: TestAgent,
  projectId: string,
  runId: string,
  body: JsonBody = {},
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${requirementAnalysis(projectId)}/runs/${runId}/cancel`,
    body,
    correlationId,
  );
}

export function retryRequirementAnalysisRun(
  agent: TestAgent,
  projectId: string,
  runId: string,
  body: JsonBody = {},
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${requirementAnalysis(projectId)}/runs/${runId}/retry`,
    body,
    correlationId,
  );
}

export function replayRequirementAnalysisRun(
  agent: TestAgent,
  projectId: string,
  runId: string,
  body: JsonBody = {},
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${requirementAnalysis(projectId)}/runs/${runId}/replay`,
    body,
    correlationId,
  );
}

export function reprocessRequirementAnalysisRun(
  agent: TestAgent,
  projectId: string,
  runId: string,
  body: JsonBody,
  correlationId?: string,
) {
  return send(
    agent,
    "post",
    `${requirementAnalysis(projectId)}/runs/${runId}/reprocess`,
    body,
    correlationId,
  );
}

export function listRequirementAnalysisStages(
  agent: TestAgent,
  projectId: string,
  runId: string,
  query = "",
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/stages${query}`);
}

export function listRequirementAnalysisBatches(
  agent: TestAgent,
  projectId: string,
  runId: string,
  query = "",
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/batches${query}`);
}

export function listRequirementAnalysisRequirements(
  agent: TestAgent,
  projectId: string,
  runId: string,
  query = "",
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/requirements${query}`);
}

export function getRequirementAnalysisRequirement(
  agent: TestAgent,
  projectId: string,
  runId: string,
  requirementId: string,
) {
  return get(
    agent,
    `${requirementAnalysis(projectId)}/runs/${runId}/requirements/${requirementId}`,
  );
}

export function listRequirementAnalysisDeliveryItems(
  agent: TestAgent,
  projectId: string,
  runId: string,
  query = "",
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/delivery-items${query}`);
}

export function getRequirementAnalysisDeliveryItem(
  agent: TestAgent,
  projectId: string,
  runId: string,
  itemId: string,
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/delivery-items/${itemId}`);
}

export function listRequirementAnalysisCoverage(
  agent: TestAgent,
  projectId: string,
  runId: string,
  query = "",
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/coverage${query}`);
}

export function listRequirementAnalysisCitations(
  agent: TestAgent,
  projectId: string,
  runId: string,
  query = "",
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/citations${query}`);
}

export function getRequirementAnalysisEvidence(
  agent: TestAgent,
  projectId: string,
  runId: string,
  citationId: string,
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/evidence/${citationId}`);
}

export function listRequirementAnalysisTraceability(
  agent: TestAgent,
  projectId: string,
  runId: string,
  query = "",
) {
  return get(agent, `${requirementAnalysis(projectId)}/runs/${runId}/traceability${query}`);
}
