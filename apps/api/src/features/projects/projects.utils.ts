import type { ProjectSort, ProjectType } from "@atlashq/types";
import {
  type AuditEventResponse,
  isoDateTimeSchema,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  projectCreateInputSchema,
  uuidSchema,
} from "@atlashq/validators";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { z } from "zod";
import type { RequestSessionContext } from "../../auth/session-context.js";
import {
  type AuditEventListResponse,
  auditEventResponseSchema,
  type MembershipResponse,
  membershipResponseSchema,
  type ProjectDashboardResponse,
  type ProjectResponse,
  projectDashboardResponseSchema,
  projectResponseSchema,
} from "./projects.schemas.js";
import type {
  AuditCursor,
  AuditRow,
  ListPage,
  MembershipCursor,
  MembershipDetailRow,
  MembershipRow,
  ProjectCursor,
  ProjectDetailRow,
} from "./projects.types.js";

const ORGANIZATION_ADMIN_ROLE = "admin";
const ARCHIVED_STATUS = "archived";
const ACTIVE_USER_STATUS = "active";

const projectCursorSchema = z.discriminatedUnion("sort", [
  z
    .object({
      sort: z.enum(["updated_desc", "updated_asc"]),
      value: isoDateTimeSchema,
      id: uuidSchema,
    })
    .strict(),
  z
    .object({
      sort: z.enum(["name_asc", "name_desc"]),
      value: z.string().min(1),
      id: uuidSchema,
    })
    .strict(),
]);
const membershipCursorSchema = z.object({ createdAt: isoDateTimeSchema, id: uuidSchema }).strict();
const auditCursorSchema = z.object({ at: isoDateTimeSchema, id: uuidSchema }).strict();

function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCursor<Schema extends z.ZodType>(
  schema: Schema,
  cursor: string,
  message: string,
): z.infer<Schema> {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return schema.parse(parsed);
  } catch {
    throw new BadRequestException(message);
  }
}

export function encodeProjectCursor(cursor: ProjectCursor): string {
  return encodeCursor(cursor);
}

export function decodeProjectCursor(cursor: string, expectedSort: ProjectSort): ProjectCursor {
  const decoded = decodeCursor(projectCursorSchema, cursor, "Invalid project cursor.");
  if (decoded.sort !== expectedSort) {
    throw new BadRequestException("Project cursor does not match the requested sort.");
  }
  return decoded;
}

export function encodeMembershipCursor(cursor: MembershipCursor): string {
  return encodeCursor(cursor);
}

export function decodeMembershipCursor(cursor: string): MembershipCursor {
  return decodeCursor(membershipCursorSchema, cursor, "Invalid membership cursor.");
}

export function encodeAuditCursor(cursor: AuditCursor): string {
  return encodeCursor(cursor);
}

export function decodeAuditCursor(cursor: string): AuditCursor {
  return decodeCursor(auditCursorSchema, cursor, "Invalid audit-event cursor.");
}

export function assertOrganizationAdmin(session: RequestSessionContext): void {
  if (session.user.organizationRole !== ORGANIZATION_ADMIN_ROLE) {
    throw new ForbiddenException("Organization-admin privileges are required.");
  }
}

export function isArchived(status: string): boolean {
  return status === ARCHIVED_STATUS;
}

export function isActiveUser(user: { status: string }): boolean {
  return user.status === ACTIVE_USER_STATUS;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toIsoOrUndefined(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** Generic limit+1 pagination: slice to `limit`, flag `hasMore`, derive the next opaque cursor. */
export function paginate<Item>(
  rows: Item[],
  limit: number,
  toCursor: (item: Item) => string,
): ListPage<Item> {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = items[items.length - 1];

  return {
    items,
    pageInfo: {
      limit,
      hasMore,
      nextCursor: hasMore && last ? toCursor(last) : null,
    },
  };
}

export function projectRowToCursor(row: ProjectDetailRow, sort: ProjectSort): string {
  return encodeProjectCursor({
    sort,
    value: sort.startsWith("updated_") ? row.updatedAt.toISOString() : row.name.toLowerCase(),
    id: row.id,
  });
}

export function membershipRowToCursor(row: MembershipDetailRow): string {
  return encodeMembershipCursor({ createdAt: row.createdAt.toISOString(), id: row.id });
}

export function auditRowToCursor(row: AuditRow): string {
  return encodeAuditCursor({ at: row.at.toISOString(), id: row.id });
}

export function toProjectResponse(row: ProjectDetailRow): ProjectResponse {
  return projectResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    type: row.type,
    status: row.status,
    clientId: row.clientId,
    client: row.clientId && row.clientName ? { id: row.clientId, name: row.clientName } : null,
    ownerId: row.ownerId,
    owner: row.ownerName ? { id: row.ownerId, name: row.ownerName } : null,
    techLeadId: row.techLeadId,
    techLead:
      row.techLeadId && row.techLeadName ? { id: row.techLeadId, name: row.techLeadName } : null,
    businessOwnerId: row.businessOwnerId,
    businessOwner:
      row.businessOwnerId && row.businessOwnerName
        ? { id: row.businessOwnerId, name: row.businessOwnerName }
        : null,
    startDate: toIso(row.startDate),
    targetDate: toIso(row.targetDate),
    phase: row.currentPhase,
    tags: row.tags,
    priority: row.priority,
    visibility: row.visibility,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    softDeletedAt: toIso(row.softDeletedAt),
    version: row.version,
  });
}

export type MembershipUserRef = {
  id: string;
  name: string;
  email: string;
};

export function toMembershipResponse(
  row: MembershipRow,
  user: MembershipUserRef | null,
): MembershipResponse {
  return membershipResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    userId: row.userId,
    user,
    role: row.role,
    status: row.status,
    invitedAt: toIso(row.invitedAt),
    invitedBy: row.invitedBy,
    addedAt: toIso(row.addedAt),
    addedBy: row.addedBy,
    deactivatedAt: toIso(row.deactivatedAt),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    softDeletedAt: toIso(row.softDeletedAt),
    version: row.version,
  });
}

export function membershipDetailToResponse(row: MembershipDetailRow): MembershipResponse {
  const user =
    row.userName && row.userEmail
      ? { id: row.userId, name: row.userName, email: row.userEmail }
      : null;
  return toMembershipResponse(row, user);
}

export function toAuditEventResponse(row: AuditRow): AuditEventResponse {
  return auditEventResponseSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    actorId: row.actorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    ...(row.projectId ? { projectId: row.projectId } : {}),
    before: row.before,
    after: row.after,
    correlationId: row.correlationId,
    at: row.at.toISOString(),
  });
}

export function toProjectListResponse(page: ListPage<ProjectDetailRow>) {
  return {
    items: page.items.map((row) => toProjectResponse(row)),
    pageInfo: page.pageInfo,
  };
}

export function toMembershipListResponse(page: ListPage<MembershipDetailRow>) {
  return {
    items: page.items.map((row) => membershipDetailToResponse(row)),
    pageInfo: page.pageInfo,
  };
}

export function toAuditListResponse(page: ListPage<AuditRow>): AuditEventListResponse {
  return {
    items: page.items.map((row) => toAuditEventResponse(row)),
    pageInfo: page.pageInfo,
  };
}

function notStartedSection(label: string) {
  return { state: "not_started" as const, count: 0, label };
}

function zeroSection(label: string) {
  return { state: "zero" as const, count: 0, label };
}

/**
 * Build the Module 1 dashboard: a real project summary plus honest zero-state cards. Every card
 * reports zero / not-started so nothing implies later-module analysis has already run.
 */
export function buildProjectDashboard(project: ProjectResponse): ProjectDashboardResponse {
  return projectDashboardResponseSchema.parse({
    project,
    cards: {
      sourceDocuments: notStartedSection("Source documents"),
      requirements: notStartedSection("Requirements"),
      openQuestions: notStartedSection("Open questions"),
      risksAndDeliveryItems: zeroSection("Risks & delivery items"),
      architectureReview: notStartedSection("Architecture review"),
      baselineAndHandoff: notStartedSection("Baseline & handoff"),
    },
    nextActions: ["Prepare for source document intake."],
  });
}

/**
 * Merge the current persisted project with a partial update and re-run the full create-input
 * validation (module-01 §5.1/§5.2). This guarantees that flipping `type` and `clientId` in
 * separate fields can never bypass the client/internal cross-field rule.
 */
export type MergedProjectUpdate = {
  name: ProjectCreateInput["name"];
  type: ProjectCreateInput["type"];
  clientId: string | null;
  ownerId: ProjectCreateInput["ownerId"];
  techLeadId: string | null;
  businessOwnerId: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: ProjectCreateInput["status"];
  phase: ProjectCreateInput["phase"];
  priority: ProjectCreateInput["priority"];
  visibility: ProjectCreateInput["visibility"];
  tags: ProjectCreateInput["tags"];
  description: string | null;
};

function hasOwn<Key extends PropertyKey>(value: object, key: Key): boolean {
  return Object.hasOwn(value, key);
}

export function mergeProjectUpdate(
  current: ProjectDetailRow,
  patch: ProjectUpdateInput,
): MergedProjectUpdate {
  const type = (patch.type ?? current.type) as ProjectType;
  const clientId =
    type === "internal"
      ? null
      : hasOwn(patch, "clientId")
        ? (patch.clientId ?? null)
        : current.clientId;
  const techLeadId = hasOwn(patch, "techLeadId") ? (patch.techLeadId ?? null) : current.techLeadId;
  const businessOwnerId = hasOwn(patch, "businessOwnerId")
    ? (patch.businessOwnerId ?? null)
    : current.businessOwnerId;
  const startDate = hasOwn(patch, "startDate")
    ? (patch.startDate ?? null)
    : (toIsoOrUndefined(current.startDate) ?? null);
  const targetDate = hasOwn(patch, "targetDate")
    ? (patch.targetDate ?? null)
    : (toIsoOrUndefined(current.targetDate) ?? null);
  const description = hasOwn(patch, "description")
    ? (patch.description ?? null)
    : current.description;

  const validated = projectCreateInputSchema.parse({
    name: patch.name ?? current.name,
    type,
    ...(clientId !== null ? { clientId } : {}),
    ownerId: patch.ownerId ?? current.ownerId,
    ...(techLeadId !== null ? { techLeadId } : {}),
    ...(businessOwnerId !== null ? { businessOwnerId } : {}),
    ...(startDate !== null ? { startDate } : {}),
    ...(targetDate !== null ? { targetDate } : {}),
    status: patch.status ?? current.status,
    phase: patch.phase ?? current.currentPhase,
    priority: patch.priority ?? current.priority,
    visibility: patch.visibility ?? current.visibility,
    tags: patch.tags ?? current.tags,
    ...(description !== null ? { description } : {}),
  });

  return {
    name: validated.name,
    type: validated.type,
    clientId,
    ownerId: validated.ownerId,
    techLeadId,
    businessOwnerId,
    startDate,
    targetDate,
    status: validated.status,
    phase: validated.phase,
    priority: validated.priority,
    visibility: validated.visibility,
    tags: validated.tags,
    description,
  };
}

export function assertActiveReference<T extends { status: string }>(
  value: T | null,
  message: string,
): asserts value is T {
  if (!value || !isActiveUser(value)) {
    throw new BadRequestException(message);
  }
}
