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
