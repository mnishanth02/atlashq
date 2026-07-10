import type { Database } from "@atlashq/db";
import type {
  JsonObject,
  ProjectPhase,
  ProjectPriority,
  ProjectSort,
  ProjectStatus,
  ProjectType,
  ProjectVisibility,
} from "@atlashq/types";
import type { PaginationMeta } from "@atlashq/validators";

/**
 * The narrow database surface the repository needs. Both the live `Database` and a Drizzle
 * transaction structurally satisfy this, so the service can run every repository call either
 * directly or inside `db.transaction()` without the repository knowing which it received.
 */
export type ProjectQueryHandle = Pick<Database, "select" | "insert" | "update">;

/** Persisted project columns (no joins). */
export type ProjectRow = {
  id: string;
  organizationId: string;
  clientId: string | null;
  name: string;
  type: string;
  status: string;
  ownerId: string;
  techLeadId: string | null;
  businessOwnerId: string | null;
  startDate: Date | null;
  targetDate: Date | null;
  currentPhase: string;
  tags: string[];
  priority: string;
  visibility: string;
  description: string | null;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  softDeletedAt: Date | null;
  version: number;
};

/** Project row with organization-scoped joined display names for owner, client, and leads. */
export type ProjectDetailRow = ProjectRow & {
  clientName: string | null;
  ownerName: string | null;
  techLeadName: string | null;
  businessOwnerName: string | null;
};

/** Minimal user projection used for owner/lead/member validation. */
export type UserRow = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  status: string;
};

/** Minimal client projection used for client/internal validation. */
export type ClientRow = {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  softDeletedAt: Date | null;
};

/** Persisted membership columns (no joins). */
export type MembershipRow = {
  id: string;
  organizationId: string;
  projectId: string;
  userId: string;
  role: string;
  status: string;
  invitedAt: Date | null;
  invitedBy: string | null;
  addedAt: Date | null;
  addedBy: string | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  softDeletedAt: Date | null;
  version: number;
};

/** Membership row with the joined member's display name and email. */
export type MembershipDetailRow = MembershipRow & {
  userName: string | null;
  userEmail: string | null;
};

/** Persisted audit event columns. */
export type AuditRow = {
  id: string;
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  before: JsonObject | null;
  after: JsonObject | null;
  correlationId: string;
  at: Date;
};

export type ProjectCursor = {
  sort: ProjectSort;
  value: string;
  id: string;
};

export type MembershipCursor = {
  createdAt: string;
  id: string;
};

export type AuditCursor = {
  at: string;
  id: string;
};

export type ProjectListQuery = {
  organizationId: string;
  viewerId: string;
  isOrganizationAdmin: boolean;
  includeArchived: boolean;
  sort: ProjectSort;
  limit: number;
  type?: ProjectType;
  status?: ProjectStatus;
  phase?: ProjectPhase;
  priority?: ProjectPriority;
  visibility?: ProjectVisibility;
  clientId?: string;
  ownerId?: string;
  search?: string;
  cursor?: ProjectCursor;
};

export type MembershipListQuery = {
  organizationId: string;
  projectId: string;
  limit: number;
  userId?: string;
  role?: string;
  status?: string;
  cursor?: MembershipCursor;
};

export type AuditListQuery = {
  organizationId: string;
  projectId: string;
  limit: number;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  cursor?: AuditCursor;
};

export type ProjectInsertValues = {
  organizationId: string;
  clientId: string | null;
  name: string;
  type: string;
  status: string;
  ownerId: string;
  techLeadId: string | null;
  businessOwnerId: string | null;
  startDate: Date | null;
  targetDate: Date | null;
  currentPhase: string;
  tags: string[];
  priority: string;
  visibility: string;
  description: string | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
};

export type ProjectUpdateValues = {
  clientId: string | null;
  name: string;
  type: string;
  status: string;
  ownerId: string;
  techLeadId: string | null;
  businessOwnerId: string | null;
  startDate: Date | null;
  targetDate: Date | null;
  currentPhase: string;
  tags: string[];
  priority: string;
  visibility: string;
  description: string | null;
  updatedAt: Date;
  updatedBy: string;
};

export type ProjectStatusUpdateValues = {
  status: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
};

export type MembershipInsertValues = {
  organizationId: string;
  projectId: string;
  userId: string;
  role: string;
  status: string;
  invitedAt: Date | null;
  invitedBy: string | null;
  addedAt: Date | null;
  addedBy: string | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
};

export type MembershipUpdateValues = {
  role?: string;
  status?: string;
  deactivatedAt?: Date | null;
  softDeletedAt?: Date | null;
  updatedAt: Date;
  updatedBy: string;
  version: number;
};

export type ListPage<Item> = {
  items: Item[];
  pageInfo: PaginationMeta;
};

export interface ProjectsRepository {
  listProjects(
    handle: ProjectQueryHandle,
    query: ProjectListQuery,
  ): Promise<ListPage<ProjectDetailRow>>;
  findProjectDetail(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<ProjectDetailRow | null>;
  insertProject(handle: ProjectQueryHandle, values: ProjectInsertValues): Promise<ProjectRow>;
  updateProject(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    expectedVersion: number,
    values: ProjectUpdateValues,
  ): Promise<ProjectRow | null>;
  setProjectStatus(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    values: ProjectStatusUpdateValues,
  ): Promise<ProjectRow | null>;
  findUser(
    handle: ProjectQueryHandle,
    organizationId: string,
    userId: string,
  ): Promise<UserRow | null>;
  findClient(
    handle: ProjectQueryHandle,
    organizationId: string,
    clientId: string,
  ): Promise<ClientRow | null>;
  findActiveMembership(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    userId: string,
  ): Promise<MembershipRow | null>;
  findMembershipById(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    membershipId: string,
  ): Promise<MembershipRow | null>;
  insertMembership(
    handle: ProjectQueryHandle,
    values: MembershipInsertValues,
  ): Promise<MembershipRow>;
  updateMembership(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    membershipId: string,
    values: MembershipUpdateValues,
  ): Promise<MembershipRow | null>;
  listMemberships(
    handle: ProjectQueryHandle,
    query: MembershipListQuery,
  ): Promise<ListPage<MembershipDetailRow>>;
  listAuditEvents(handle: ProjectQueryHandle, query: AuditListQuery): Promise<ListPage<AuditRow>>;
}
