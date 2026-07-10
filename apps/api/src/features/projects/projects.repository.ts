import { auditEvent, client, project, projectMembership, user } from "@atlashq/db";
import { projectRolesForPermission } from "@atlashq/types";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  AuditListQuery,
  AuditRow,
  ClientRow,
  ListPage,
  MembershipDetailRow,
  MembershipInsertValues,
  MembershipListQuery,
  MembershipRow,
  MembershipUpdateValues,
  ProjectDetailRow,
  ProjectInsertValues,
  ProjectListQuery,
  ProjectQueryHandle,
  ProjectRow,
  ProjectStatusUpdateValues,
  ProjectsRepository,
  ProjectUpdateValues,
  UserRow,
} from "./projects.types.js";
import {
  auditRowToCursor,
  membershipRowToCursor,
  paginate,
  projectRowToCursor,
} from "./projects.utils.js";

const ownerUser = alias(user, "owner_user");
const techLeadUser = alias(user, "tech_lead_user");
const businessOwnerUser = alias(user, "business_owner_user");
const memberUser = alias(user, "member_user");
const readableProjectRoles = projectRolesForPermission("project:read");
const projectSortName = sql<string>`lower(${project.name})`;

const projectRowProjection = {
  id: project.id,
  organizationId: project.organizationId,
  clientId: project.clientId,
  name: project.name,
  type: project.type,
  status: project.status,
  ownerId: project.ownerId,
  techLeadId: project.techLeadId,
  businessOwnerId: project.businessOwnerId,
  startDate: project.startDate,
  targetDate: project.targetDate,
  currentPhase: project.currentPhase,
  tags: project.tags,
  priority: project.priority,
  visibility: project.visibility,
  description: project.description,
  createdAt: project.createdAt,
  createdBy: project.createdBy,
  updatedAt: project.updatedAt,
  updatedBy: project.updatedBy,
  softDeletedAt: project.softDeletedAt,
  version: project.version,
} as const;

const projectDetailProjection = {
  ...projectRowProjection,
  clientName: client.name,
  ownerName: ownerUser.name,
  techLeadName: techLeadUser.name,
  businessOwnerName: businessOwnerUser.name,
} as const;

const membershipRowProjection = {
  id: projectMembership.id,
  organizationId: projectMembership.organizationId,
  projectId: projectMembership.projectId,
  userId: projectMembership.userId,
  role: projectMembership.role,
  status: projectMembership.status,
  invitedAt: projectMembership.invitedAt,
  invitedBy: projectMembership.invitedBy,
  addedAt: projectMembership.addedAt,
  addedBy: projectMembership.addedBy,
  deactivatedAt: projectMembership.deactivatedAt,
  createdAt: projectMembership.createdAt,
  createdBy: projectMembership.createdBy,
  updatedAt: projectMembership.updatedAt,
  updatedBy: projectMembership.updatedBy,
  softDeletedAt: projectMembership.softDeletedAt,
  version: projectMembership.version,
} as const;

const membershipDetailProjection = {
  ...membershipRowProjection,
  userName: memberUser.name,
  userEmail: memberUser.email,
} as const;

const userRowProjection = {
  id: user.id,
  organizationId: user.organizationId,
  name: user.name,
  email: user.email,
  status: user.status,
} as const;

const clientRowProjection = {
  id: client.id,
  organizationId: client.organizationId,
  name: client.name,
  status: client.status,
  softDeletedAt: client.softDeletedAt,
} as const;

const auditRowProjection = {
  id: auditEvent.id,
  organizationId: auditEvent.organizationId,
  actorId: auditEvent.actorId,
  action: auditEvent.action,
  entityType: auditEvent.entityType,
  entityId: auditEvent.entityId,
  projectId: auditEvent.projectId,
  before: auditEvent.before,
  after: auditEvent.after,
  correlationId: auditEvent.correlationId,
  at: auditEvent.at,
} as const;

export class DrizzleProjectsRepository implements ProjectsRepository {
  async listProjects(
    handle: ProjectQueryHandle,
    query: ProjectListQuery,
  ): Promise<ListPage<ProjectDetailRow>> {
    const membershipFilter = query.isOrganizationAdmin
      ? undefined
      : exists(
          handle
            .select({ present: sql`1` })
            .from(projectMembership)
            .where(
              and(
                eq(projectMembership.projectId, project.id),
                eq(projectMembership.userId, query.viewerId),
                eq(projectMembership.organizationId, query.organizationId),
                eq(projectMembership.status, "active"),
                isNull(projectMembership.softDeletedAt),
                inArray(projectMembership.role, readableProjectRoles),
              ),
            ),
        );

    const searchFilter = query.search
      ? or(
          sql`to_tsvector('english', ${project.name} || ' ' || coalesce(${project.description}, '')) @@ plainto_tsquery('english', ${query.search})`,
          ilike(project.name, `%${query.search}%`),
        )
      : undefined;

    let cursorFilter: SQL<unknown> | undefined;
    if (query.cursor) {
      switch (query.sort) {
        case "updated_desc": {
          const value = new Date(query.cursor.value);
          cursorFilter = or(
            lt(project.updatedAt, value),
            and(eq(project.updatedAt, value), lt(project.id, query.cursor.id)),
          );
          break;
        }
        case "updated_asc": {
          const value = new Date(query.cursor.value);
          cursorFilter = or(
            gt(project.updatedAt, value),
            and(eq(project.updatedAt, value), gt(project.id, query.cursor.id)),
          );
          break;
        }
        case "name_asc":
          cursorFilter = or(
            gt(projectSortName, query.cursor.value),
            and(eq(projectSortName, query.cursor.value), gt(project.id, query.cursor.id)),
          );
          break;
        case "name_desc":
          cursorFilter = or(
            lt(projectSortName, query.cursor.value),
            and(eq(projectSortName, query.cursor.value), lt(project.id, query.cursor.id)),
          );
          break;
      }
    }

    const order =
      query.sort === "updated_desc"
        ? [desc(project.updatedAt), desc(project.id)]
        : query.sort === "updated_asc"
          ? [asc(project.updatedAt), asc(project.id)]
          : query.sort === "name_asc"
            ? [asc(projectSortName), asc(project.id)]
            : [desc(projectSortName), desc(project.id)];

    const rows = await handle
      .select(projectDetailProjection)
      .from(project)
      .leftJoin(
        client,
        and(eq(project.clientId, client.id), eq(client.organizationId, query.organizationId)),
      )
      .leftJoin(
        ownerUser,
        and(eq(project.ownerId, ownerUser.id), eq(ownerUser.organizationId, query.organizationId)),
      )
      .leftJoin(
        techLeadUser,
        and(
          eq(project.techLeadId, techLeadUser.id),
          eq(techLeadUser.organizationId, query.organizationId),
        ),
      )
      .leftJoin(
        businessOwnerUser,
        and(
          eq(project.businessOwnerId, businessOwnerUser.id),
          eq(businessOwnerUser.organizationId, query.organizationId),
        ),
      )
      .where(
        and(
          eq(project.organizationId, query.organizationId),
          isNull(project.softDeletedAt),
          query.includeArchived || query.status === "archived"
            ? undefined
            : ne(project.status, "archived"),
          query.type ? eq(project.type, query.type) : undefined,
          query.status ? eq(project.status, query.status) : undefined,
          query.phase ? eq(project.currentPhase, query.phase) : undefined,
          query.priority ? eq(project.priority, query.priority) : undefined,
          query.visibility ? eq(project.visibility, query.visibility) : undefined,
          query.clientId ? eq(project.clientId, query.clientId) : undefined,
          query.ownerId ? eq(project.ownerId, query.ownerId) : undefined,
          searchFilter,
          membershipFilter,
          cursorFilter,
        ),
      )
      .orderBy(...order)
      .limit(query.limit + 1);

    return paginate(rows as ProjectDetailRow[], query.limit, (row) =>
      projectRowToCursor(row, query.sort),
    );
  }

  async findProjectDetail(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
  ): Promise<ProjectDetailRow | null> {
    const rows = await handle
      .select(projectDetailProjection)
      .from(project)
      .leftJoin(
        client,
        and(eq(project.clientId, client.id), eq(client.organizationId, organizationId)),
      )
      .leftJoin(
        ownerUser,
        and(eq(project.ownerId, ownerUser.id), eq(ownerUser.organizationId, organizationId)),
      )
      .leftJoin(
        techLeadUser,
        and(
          eq(project.techLeadId, techLeadUser.id),
          eq(techLeadUser.organizationId, organizationId),
        ),
      )
      .leftJoin(
        businessOwnerUser,
        and(
          eq(project.businessOwnerId, businessOwnerUser.id),
          eq(businessOwnerUser.organizationId, organizationId),
        ),
      )
      .where(
        and(
          eq(project.organizationId, organizationId),
          eq(project.id, projectId),
          isNull(project.softDeletedAt),
        ),
      )
      .limit(1);

    return (rows[0] as ProjectDetailRow | undefined) ?? null;
  }

  async insertProject(
    handle: ProjectQueryHandle,
    values: ProjectInsertValues,
  ): Promise<ProjectRow> {
    const rows = await handle.insert(project).values(values).returning(projectRowProjection);
    const row = rows[0] as ProjectRow | undefined;

    if (!row) {
      throw new Error("Project insert did not return the inserted row.");
    }

    return row;
  }

  async updateProject(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    expectedVersion: number,
    values: ProjectUpdateValues,
  ): Promise<ProjectRow | null> {
    const rows = await handle
      .update(project)
      .set({ ...values, version: sql`${project.version} + 1` })
      .where(
        and(
          eq(project.organizationId, organizationId),
          eq(project.id, projectId),
          eq(project.version, expectedVersion),
          isNull(project.softDeletedAt),
        ),
      )
      .returning(projectRowProjection);

    return (rows[0] as ProjectRow | undefined) ?? null;
  }

  async setProjectStatus(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    values: ProjectStatusUpdateValues,
  ): Promise<ProjectRow | null> {
    const rows = await handle
      .update(project)
      .set(values)
      .where(
        and(
          eq(project.organizationId, organizationId),
          eq(project.id, projectId),
          isNull(project.softDeletedAt),
        ),
      )
      .returning(projectRowProjection);

    return (rows[0] as ProjectRow | undefined) ?? null;
  }

  async findUser(
    handle: ProjectQueryHandle,
    organizationId: string,
    userId: string,
  ): Promise<UserRow | null> {
    const rows = await handle
      .select(userRowProjection)
      .from(user)
      .where(
        and(
          eq(user.organizationId, organizationId),
          eq(user.id, userId),
          isNull(user.softDeletedAt),
        ),
      )
      .limit(1);

    return (rows[0] as UserRow | undefined) ?? null;
  }

  async findClient(
    handle: ProjectQueryHandle,
    organizationId: string,
    clientId: string,
  ): Promise<ClientRow | null> {
    const rows = await handle
      .select(clientRowProjection)
      .from(client)
      .where(
        and(
          eq(client.organizationId, organizationId),
          eq(client.id, clientId),
          isNull(client.softDeletedAt),
        ),
      )
      .limit(1);

    return (rows[0] as ClientRow | undefined) ?? null;
  }

  async findActiveMembership(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    userId: string,
  ): Promise<MembershipRow | null> {
    const rows = await handle
      .select(membershipRowProjection)
      .from(projectMembership)
      .where(
        and(
          eq(projectMembership.organizationId, organizationId),
          eq(projectMembership.projectId, projectId),
          eq(projectMembership.userId, userId),
          eq(projectMembership.status, "active"),
          isNull(projectMembership.softDeletedAt),
        ),
      )
      .limit(1);

    return (rows[0] as MembershipRow | undefined) ?? null;
  }

  async findMembershipById(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    membershipId: string,
  ): Promise<MembershipRow | null> {
    const rows = await handle
      .select(membershipRowProjection)
      .from(projectMembership)
      .where(
        and(
          eq(projectMembership.organizationId, organizationId),
          eq(projectMembership.projectId, projectId),
          eq(projectMembership.id, membershipId),
          isNull(projectMembership.softDeletedAt),
        ),
      )
      .limit(1);

    return (rows[0] as MembershipRow | undefined) ?? null;
  }

  async insertMembership(
    handle: ProjectQueryHandle,
    values: MembershipInsertValues,
  ): Promise<MembershipRow> {
    const rows = await handle
      .insert(projectMembership)
      .values(values)
      .returning(membershipRowProjection);
    const row = rows[0] as MembershipRow | undefined;

    if (!row) {
      throw new Error("Project membership insert did not return the inserted row.");
    }

    return row;
  }

  async updateMembership(
    handle: ProjectQueryHandle,
    organizationId: string,
    projectId: string,
    membershipId: string,
    values: MembershipUpdateValues,
  ): Promise<MembershipRow | null> {
    const rows = await handle
      .update(projectMembership)
      .set({
        ...(values.role !== undefined ? { role: values.role } : {}),
        ...(values.status !== undefined ? { status: values.status } : {}),
        ...(values.deactivatedAt !== undefined ? { deactivatedAt: values.deactivatedAt } : {}),
        ...(values.softDeletedAt !== undefined ? { softDeletedAt: values.softDeletedAt } : {}),
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
        version: values.version,
      })
      .where(
        and(
          eq(projectMembership.organizationId, organizationId),
          eq(projectMembership.projectId, projectId),
          eq(projectMembership.id, membershipId),
          isNull(projectMembership.softDeletedAt),
        ),
      )
      .returning(membershipRowProjection);

    return (rows[0] as MembershipRow | undefined) ?? null;
  }

  async listMemberships(
    handle: ProjectQueryHandle,
    query: MembershipListQuery,
  ): Promise<ListPage<MembershipDetailRow>> {
    const cursorFilter = query.cursor
      ? or(
          lt(projectMembership.createdAt, new Date(query.cursor.createdAt)),
          and(
            eq(projectMembership.createdAt, new Date(query.cursor.createdAt)),
            lt(projectMembership.id, query.cursor.id),
          ),
        )
      : undefined;

    const rows = await handle
      .select(membershipDetailProjection)
      .from(projectMembership)
      .leftJoin(
        memberUser,
        and(
          eq(projectMembership.userId, memberUser.id),
          eq(memberUser.organizationId, query.organizationId),
        ),
      )
      .where(
        and(
          eq(projectMembership.organizationId, query.organizationId),
          eq(projectMembership.projectId, query.projectId),
          isNull(projectMembership.softDeletedAt),
          query.userId ? eq(projectMembership.userId, query.userId) : undefined,
          query.role ? eq(projectMembership.role, query.role) : undefined,
          query.status ? eq(projectMembership.status, query.status) : undefined,
          cursorFilter,
        ),
      )
      .orderBy(desc(projectMembership.createdAt), desc(projectMembership.id))
      .limit(query.limit + 1);

    return paginate(rows as MembershipDetailRow[], query.limit, membershipRowToCursor);
  }

  async listAuditEvents(
    handle: ProjectQueryHandle,
    query: AuditListQuery,
  ): Promise<ListPage<AuditRow>> {
    const cursorFilter = query.cursor
      ? or(
          lt(auditEvent.at, new Date(query.cursor.at)),
          and(eq(auditEvent.at, new Date(query.cursor.at)), lt(auditEvent.id, query.cursor.id)),
        )
      : undefined;

    const rows = await handle
      .select(auditRowProjection)
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.organizationId, query.organizationId),
          eq(auditEvent.projectId, query.projectId),
          query.entityType ? eq(auditEvent.entityType, query.entityType) : undefined,
          query.entityId ? eq(auditEvent.entityId, query.entityId) : undefined,
          query.actorId ? eq(auditEvent.actorId, query.actorId) : undefined,
          cursorFilter,
        ),
      )
      .orderBy(desc(auditEvent.at), desc(auditEvent.id))
      .limit(query.limit + 1);

    return paginate(rows as AuditRow[], query.limit, auditRowToCursor);
  }
}
