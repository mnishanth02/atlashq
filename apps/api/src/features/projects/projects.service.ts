import type { Database } from "@atlashq/db";
import { canProjectRole, isProjectRole } from "@atlashq/types";
import type {
  AuditEventListFilter,
  ProjectCreateInput,
  ProjectListFilter,
  ProjectMembershipCreateInput,
  ProjectMembershipListFilter,
  ProjectMembershipUpdateInput,
  ProjectUpdateInput,
} from "@atlashq/validators";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { AuditRecordInput } from "../../audit/audit-input.js";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { AuditTransaction } from "../../audit/audit-transaction.js";
// biome-ignore lint/style/useImportType: Nest needs the runtime class for constructor injection metadata.
import { AuditWriter } from "../../audit/audit-writer.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { DATABASE_CLIENT } from "../../runtime/runtime.js";
// biome-ignore lint/style/useImportType: Nest needs the runtime class for constructor injection metadata.
import { SourceDocumentsService } from "../source-documents/source-documents.service.js";
import type {
  AuditEventListResponse,
  MembershipListResponse,
  MembershipResponse,
  ProjectDashboardResponse,
  ProjectListResponse,
  ProjectResponse,
} from "./projects.schemas.js";
import { PROJECTS_REPOSITORY } from "./projects.tokens.js";
import type {
  MembershipRow,
  ProjectQueryHandle,
  ProjectsRepository,
  UserRow,
} from "./projects.types.js";
import {
  assertActiveReference,
  assertOrganizationAdmin,
  buildProjectDashboard,
  decodeAuditCursor,
  decodeMembershipCursor,
  decodeProjectCursor,
  isArchived,
  type MembershipUserRef,
  mergeProjectUpdate,
  toAuditListResponse,
  toDateOrNull,
  toMembershipListResponse,
  toMembershipResponse,
  toProjectListResponse,
  toProjectResponse,
} from "./projects.utils.js";

const ORGANIZATION_ADMIN_ROLE = "admin";
const PROJECT_OWNER_ROLE = "Project Owner";
const ACTIVE_MEMBERSHIP_STATUS = "active";
const REMOVED_MEMBERSHIP_STATUS = "removed";

const PROJECT_ENTITY = "project";
const MEMBERSHIP_ENTITY = "project_membership";

const ACTION_PROJECT_CREATE = "project.create";
const ACTION_PROJECT_UPDATE = "project.update";
const ACTION_PROJECT_ARCHIVE = "project.archive";
const ACTION_PROJECT_RESTORE = "project.restore";
const ACTION_MEMBERSHIP_ADD = "project.membership.add";
const ACTION_MEMBERSHIP_UPDATE = "project.membership.update";
const ACTION_MEMBERSHIP_REMOVE = "project.membership.remove";

function userRef(user: UserRow): MembershipUserRef {
  return { id: user.id, name: user.name, email: user.email };
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database | null,
    @Inject(PROJECTS_REPOSITORY) private readonly repository: ProjectsRepository,
    private readonly auditWriter: AuditWriter,
    @Optional() private readonly sourceDocuments?: SourceDocumentsService,
  ) {}

  private requireDb(): Database {
    if (!this.db) {
      throw new Error("Database client is not available for projects feature operations.");
    }

    return this.db;
  }

  private auditInput(
    auditContext: AuditRequestContext,
    action: string,
    entityType: string,
    entityId: string,
    projectId: string,
    before: unknown,
    after: unknown,
  ): AuditRecordInput {
    return {
      organizationId: auditContext.actor.organizationId,
      actorId: auditContext.actor.actorId,
      action,
      entityType,
      entityId,
      projectId,
      before,
      after,
      correlationId: auditContext.correlationId,
    };
  }

  async listProjects(
    session: RequestSessionContext,
    query: ProjectListFilter,
  ): Promise<ProjectListResponse> {
    const db = this.requireDb();
    const cursor = query.cursor ? decodeProjectCursor(query.cursor, query.sort) : undefined;

    const page = await this.repository.listProjects(db as ProjectQueryHandle, {
      organizationId: session.user.organizationId,
      viewerId: session.user.id,
      isOrganizationAdmin: session.user.organizationRole === ORGANIZATION_ADMIN_ROLE,
      includeArchived: query.includeArchived,
      sort: query.sort,
      limit: query.limit,
      ...(query.type !== undefined ? { type: query.type } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.phase !== undefined ? { phase: query.phase } : {}),
      ...(query.priority !== undefined ? { priority: query.priority } : {}),
      ...(query.visibility !== undefined ? { visibility: query.visibility } : {}),
      ...(query.clientId !== undefined ? { clientId: query.clientId } : {}),
      ...(query.ownerId !== undefined ? { ownerId: query.ownerId } : {}),
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    });

    return toProjectListResponse(page);
  }

  async getProject(session: RequestSessionContext, projectId: string): Promise<ProjectResponse> {
    const detail = await this.repository.findProjectDetail(
      this.requireDb() as ProjectQueryHandle,
      session.user.organizationId,
      projectId,
    );

    if (!detail) {
      throw new NotFoundException("Project not found.");
    }

    return toProjectResponse(detail);
  }

  async createProject(
    session: RequestSessionContext,
    input: ProjectCreateInput,
    auditContext: AuditRequestContext,
  ): Promise<ProjectResponse> {
    assertOrganizationAdmin(session);

    const organizationId = session.user.organizationId;
    const actorId = auditContext.actor.actorId;
    const now = new Date();

    return this.requireDb().transaction(async (tx: AuditTransaction) => {
      const handle = tx as ProjectQueryHandle;

      const owner = await this.repository.findUser(handle, organizationId, input.ownerId);
      assertActiveReference(owner, "Project owner must be an active user in your organization.");

      if (input.techLeadId) {
        const techLead = await this.repository.findUser(handle, organizationId, input.techLeadId);
        assertActiveReference(
          techLead,
          "Technical lead must be an active user in your organization.",
        );
      }

      if (input.businessOwnerId) {
        const businessOwner = await this.repository.findUser(
          handle,
          organizationId,
          input.businessOwnerId,
        );
        assertActiveReference(
          businessOwner,
          "Business owner must be an active user in your organization.",
        );
      }

      let clientId: string | null = null;
      if (input.type === "client") {
        if (!input.clientId) {
          throw new BadRequestException("clientId is required for client projects.");
        }

        const clientRecord = await this.repository.findClient(
          handle,
          organizationId,
          input.clientId,
        );
        if (!clientRecord || isArchived(clientRecord.status)) {
          throw new BadRequestException(
            "Client projects require an active client in your organization.",
          );
        }

        clientId = clientRecord.id;
      }

      const created = await this.repository.insertProject(handle, {
        organizationId,
        clientId,
        name: input.name,
        type: input.type,
        status: input.status,
        ownerId: input.ownerId,
        techLeadId: input.techLeadId ?? null,
        businessOwnerId: input.businessOwnerId ?? null,
        startDate: toDateOrNull(input.startDate),
        targetDate: toDateOrNull(input.targetDate),
        currentPhase: input.phase,
        tags: input.tags,
        priority: input.priority,
        visibility: input.visibility,
        description: input.description ?? null,
        createdAt: now,
        createdBy: actorId,
        updatedAt: now,
        updatedBy: actorId,
        version: 1,
      });

      const membership = await this.repository.insertMembership(handle, {
        organizationId,
        projectId: created.id,
        userId: input.ownerId,
        role: PROJECT_OWNER_ROLE,
        status: ACTIVE_MEMBERSHIP_STATUS,
        invitedAt: null,
        invitedBy: null,
        addedAt: now,
        addedBy: actorId,
        deactivatedAt: null,
        createdAt: now,
        createdBy: actorId,
        updatedAt: now,
        updatedBy: actorId,
        version: 1,
      });

      const detail = await this.repository.findProjectDetail(handle, organizationId, created.id);
      if (!detail) {
        throw new Error("Created project could not be reloaded.");
      }

      const response = toProjectResponse(detail);
      const membershipResponse = toMembershipResponse(membership, userRef(owner));

      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_PROJECT_CREATE,
          PROJECT_ENTITY,
          created.id,
          created.id,
          null,
          response,
        ),
      );
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_MEMBERSHIP_ADD,
          MEMBERSHIP_ENTITY,
          membership.id,
          created.id,
          null,
          membershipResponse,
        ),
      );

      return response;
    });
  }

  async updateProject(
    session: RequestSessionContext,
    projectId: string,
    patch: ProjectUpdateInput,
    auditContext: AuditRequestContext,
  ): Promise<ProjectResponse> {
    const organizationId = session.user.organizationId;
    const actorId = auditContext.actor.actorId;
    const now = new Date();

    return this.requireDb().transaction(async (tx: AuditTransaction) => {
      const handle = tx as ProjectQueryHandle;

      const current = await this.repository.findProjectDetail(handle, organizationId, projectId);
      if (!current) {
        throw new NotFoundException("Project not found.");
      }

      if (isArchived(current.status)) {
        throw new ForbiddenException(
          "Archived projects must be restored before they can be updated.",
        );
      }

      const merged = mergeProjectUpdate(current, patch);

      const owner = await this.repository.findUser(handle, organizationId, merged.ownerId);
      assertActiveReference(owner, "Project owner must be an active user in your organization.");

      if (merged.techLeadId) {
        const techLead = await this.repository.findUser(handle, organizationId, merged.techLeadId);
        assertActiveReference(
          techLead,
          "Technical lead must be an active user in your organization.",
        );
      }

      if (merged.businessOwnerId) {
        const businessOwner = await this.repository.findUser(
          handle,
          organizationId,
          merged.businessOwnerId,
        );
        assertActiveReference(
          businessOwner,
          "Business owner must be an active user in your organization.",
        );
      }

      let clientId: string | null = null;
      if (merged.type === "client") {
        if (!merged.clientId) {
          throw new BadRequestException("clientId is required for client projects.");
        }

        const clientRecord = await this.repository.findClient(
          handle,
          organizationId,
          merged.clientId,
        );
        if (!clientRecord || isArchived(clientRecord.status)) {
          throw new BadRequestException(
            "Client projects require an active client in your organization.",
          );
        }

        clientId = clientRecord.id;
      }

      if (merged.ownerId !== current.ownerId) {
        await this.assertCanTransferOwner(handle, session, projectId);
        await this.ensureOwnerMembership(
          tx,
          organizationId,
          projectId,
          owner,
          actorId,
          auditContext,
          now,
        );
      }

      const updated = await this.repository.updateProject(
        handle,
        organizationId,
        projectId,
        patch.version,
        {
          clientId,
          name: merged.name,
          type: merged.type,
          status: merged.status,
          ownerId: merged.ownerId,
          techLeadId: merged.techLeadId,
          businessOwnerId: merged.businessOwnerId,
          startDate: toDateOrNull(merged.startDate),
          targetDate: toDateOrNull(merged.targetDate),
          currentPhase: merged.phase,
          tags: merged.tags,
          priority: merged.priority,
          visibility: merged.visibility,
          description: merged.description,
          updatedAt: now,
          updatedBy: actorId,
        },
      );

      if (!updated) {
        throw new ConflictException(
          "Project was modified by another request. Reload it and try again.",
        );
      }

      const detail = await this.repository.findProjectDetail(handle, organizationId, projectId);
      if (!detail) {
        throw new Error("Updated project could not be reloaded.");
      }

      const before = toProjectResponse(current);
      const after = toProjectResponse(detail);

      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_PROJECT_UPDATE,
          PROJECT_ENTITY,
          projectId,
          projectId,
          before,
          after,
        ),
      );

      return after;
    });
  }

  private async assertCanTransferOwner(
    handle: ProjectQueryHandle,
    session: RequestSessionContext,
    projectId: string,
  ): Promise<void> {
    if (session.user.organizationRole === ORGANIZATION_ADMIN_ROLE) {
      return;
    }

    const membership = await this.repository.findActiveMembership(
      handle,
      session.user.organizationId,
      projectId,
      session.user.id,
    );

    if (
      !membership ||
      !isProjectRole(membership.role) ||
      !canProjectRole(membership.role, "project:admin")
    ) {
      throw new ForbiddenException("Changing the project owner requires project-admin permission.");
    }
  }

  private async ensureOwnerMembership(
    tx: AuditTransaction,
    organizationId: string,
    projectId: string,
    owner: UserRow,
    actorId: string,
    auditContext: AuditRequestContext,
    now: Date,
  ): Promise<void> {
    const handle = tx as ProjectQueryHandle;
    const existing = await this.repository.findActiveMembership(
      handle,
      organizationId,
      projectId,
      owner.id,
    );

    if (existing) {
      if (existing.role === PROJECT_OWNER_ROLE && existing.status === ACTIVE_MEMBERSHIP_STATUS) {
        return;
      }

      const before = toMembershipResponse(existing, userRef(owner));
      const updated = await this.repository.updateMembership(
        handle,
        organizationId,
        projectId,
        existing.id,
        {
          role: PROJECT_OWNER_ROLE,
          status: ACTIVE_MEMBERSHIP_STATUS,
          updatedAt: now,
          updatedBy: actorId,
          version: existing.version + 1,
        },
      );

      if (!updated) {
        throw new Error("Owner membership could not be updated.");
      }

      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_MEMBERSHIP_UPDATE,
          MEMBERSHIP_ENTITY,
          updated.id,
          projectId,
          before,
          toMembershipResponse(updated, userRef(owner)),
        ),
      );
      return;
    }

    const inserted = await this.repository.insertMembership(handle, {
      organizationId,
      projectId,
      userId: owner.id,
      role: PROJECT_OWNER_ROLE,
      status: ACTIVE_MEMBERSHIP_STATUS,
      invitedAt: null,
      invitedBy: null,
      addedAt: now,
      addedBy: actorId,
      deactivatedAt: null,
      createdAt: now,
      createdBy: actorId,
      updatedAt: now,
      updatedBy: actorId,
      version: 1,
    });

    await this.auditWriter.record(
      tx,
      this.auditInput(
        auditContext,
        ACTION_MEMBERSHIP_ADD,
        MEMBERSHIP_ENTITY,
        inserted.id,
        projectId,
        null,
        toMembershipResponse(inserted, userRef(owner)),
      ),
    );
  }

  async archiveProject(
    session: RequestSessionContext,
    projectId: string,
    auditContext: AuditRequestContext,
  ): Promise<ProjectResponse> {
    return this.transitionStatus(
      session,
      projectId,
      auditContext,
      "archived",
      (status) => !isArchived(status),
      ACTION_PROJECT_ARCHIVE,
    );
  }

  async restoreProject(
    session: RequestSessionContext,
    projectId: string,
    auditContext: AuditRequestContext,
  ): Promise<ProjectResponse> {
    return this.transitionStatus(
      session,
      projectId,
      auditContext,
      "active",
      (status) => isArchived(status),
      ACTION_PROJECT_RESTORE,
    );
  }

  private async transitionStatus(
    session: RequestSessionContext,
    projectId: string,
    auditContext: AuditRequestContext,
    nextStatus: string,
    shouldTransition: (currentStatus: string) => boolean,
    action: string,
  ): Promise<ProjectResponse> {
    const organizationId = session.user.organizationId;
    const actorId = auditContext.actor.actorId;
    const now = new Date();

    return this.requireDb().transaction(async (tx: AuditTransaction) => {
      const handle = tx as ProjectQueryHandle;

      const current = await this.repository.findProjectDetail(handle, organizationId, projectId);
      if (!current) {
        throw new NotFoundException("Project not found.");
      }

      const before = toProjectResponse(current);

      if (!shouldTransition(current.status)) {
        await this.auditWriter.record(
          tx,
          this.auditInput(
            auditContext,
            action,
            PROJECT_ENTITY,
            projectId,
            projectId,
            before,
            before,
          ),
        );
        return before;
      }

      const updated = await this.repository.setProjectStatus(handle, organizationId, projectId, {
        status: nextStatus,
        updatedAt: now,
        updatedBy: actorId,
        version: current.version + 1,
      });

      if (!updated) {
        throw new NotFoundException("Project not found.");
      }

      const detail = await this.repository.findProjectDetail(handle, organizationId, projectId);
      if (!detail) {
        throw new Error("Project could not be reloaded after status change.");
      }

      const after = toProjectResponse(detail);
      await this.auditWriter.record(
        tx,
        this.auditInput(auditContext, action, PROJECT_ENTITY, projectId, projectId, before, after),
      );

      return after;
    });
  }

  async listMemberships(
    session: RequestSessionContext,
    projectId: string,
    query: ProjectMembershipListFilter,
  ): Promise<MembershipListResponse> {
    const db = this.requireDb();
    const cursor = query.cursor ? decodeMembershipCursor(query.cursor) : undefined;

    const page = await this.repository.listMemberships(db as ProjectQueryHandle, {
      organizationId: session.user.organizationId,
      projectId,
      limit: query.limit,
      ...(query.userId !== undefined ? { userId: query.userId } : {}),
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    });

    return toMembershipListResponse(page);
  }

  async addMembership(
    session: RequestSessionContext,
    projectId: string,
    input: ProjectMembershipCreateInput,
    auditContext: AuditRequestContext,
  ): Promise<MembershipResponse> {
    const organizationId = session.user.organizationId;
    const actorId = auditContext.actor.actorId;
    const now = new Date();

    return this.requireDb().transaction(async (tx: AuditTransaction) => {
      const handle = tx as ProjectQueryHandle;

      const project = await this.repository.findProjectDetail(handle, organizationId, projectId);
      if (!project) {
        throw new NotFoundException("Project not found.");
      }

      if (isArchived(project.status)) {
        throw new ForbiddenException(
          "Archived projects must be restored before membership changes.",
        );
      }

      const target = await this.repository.findUser(handle, organizationId, input.userId);
      assertActiveReference(
        target,
        "Membership target must be an active user in your organization.",
      );

      const existing = await this.repository.findActiveMembership(
        handle,
        organizationId,
        projectId,
        input.userId,
      );
      if (existing) {
        throw new ConflictException("User already has an active membership on this project.");
      }

      const inserted = await this.repository.insertMembership(handle, {
        organizationId,
        projectId,
        userId: input.userId,
        role: input.role,
        status: ACTIVE_MEMBERSHIP_STATUS,
        invitedAt: null,
        invitedBy: null,
        addedAt: now,
        addedBy: actorId,
        deactivatedAt: null,
        createdAt: now,
        createdBy: actorId,
        updatedAt: now,
        updatedBy: actorId,
        version: 1,
      });

      const response = toMembershipResponse(inserted, userRef(target));
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_MEMBERSHIP_ADD,
          MEMBERSHIP_ENTITY,
          inserted.id,
          projectId,
          null,
          response,
        ),
      );

      return response;
    });
  }

  async updateMembership(
    session: RequestSessionContext,
    projectId: string,
    membershipId: string,
    patch: ProjectMembershipUpdateInput,
    auditContext: AuditRequestContext,
  ): Promise<MembershipResponse> {
    const organizationId = session.user.organizationId;
    const actorId = auditContext.actor.actorId;
    const now = new Date();

    return this.requireDb().transaction(async (tx: AuditTransaction) => {
      const handle = tx as ProjectQueryHandle;

      const project = await this.repository.findProjectDetail(handle, organizationId, projectId);
      if (!project) {
        throw new NotFoundException("Project not found.");
      }

      if (isArchived(project.status)) {
        throw new ForbiddenException(
          "Archived projects must be restored before membership changes.",
        );
      }

      const membership = await this.repository.findMembershipById(
        handle,
        organizationId,
        projectId,
        membershipId,
      );
      if (!membership) {
        throw new NotFoundException("Project membership not found.");
      }

      this.assertOwnerMembershipNotDemoted(project.ownerId, membership, patch);

      const target = await this.repository.findUser(handle, organizationId, membership.userId);
      assertActiveReference(
        target,
        "Membership target must be an active user in your organization.",
      );

      const before = toMembershipResponse(membership, userRef(target));

      const updated = await this.repository.updateMembership(
        handle,
        organizationId,
        projectId,
        membershipId,
        {
          ...(patch.role !== undefined ? { role: patch.role } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.status === REMOVED_MEMBERSHIP_STATUS ? { deactivatedAt: now } : {}),
          updatedAt: now,
          updatedBy: actorId,
          version: membership.version + 1,
        },
      );

      if (!updated) {
        throw new NotFoundException("Project membership not found.");
      }

      const after = toMembershipResponse(updated, userRef(target));
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_MEMBERSHIP_UPDATE,
          MEMBERSHIP_ENTITY,
          membershipId,
          projectId,
          before,
          after,
        ),
      );

      return after;
    });
  }

  private assertOwnerMembershipNotDemoted(
    projectOwnerId: string,
    membership: MembershipRow,
    patch: ProjectMembershipUpdateInput,
  ): void {
    const isCurrentOwnerMembership =
      membership.userId === projectOwnerId && membership.role === PROJECT_OWNER_ROLE;

    if (!isCurrentOwnerMembership) {
      return;
    }

    if (patch.role !== undefined && patch.role !== PROJECT_OWNER_ROLE) {
      throw new ForbiddenException(
        "Change the project owner before demoting the current owner's role.",
      );
    }

    if (patch.status !== undefined && patch.status !== ACTIVE_MEMBERSHIP_STATUS) {
      throw new ForbiddenException(
        "Change the project owner before deactivating the current owner's membership.",
      );
    }
  }

  async removeMembership(
    session: RequestSessionContext,
    projectId: string,
    membershipId: string,
    auditContext: AuditRequestContext,
  ): Promise<MembershipResponse> {
    const organizationId = session.user.organizationId;
    const actorId = auditContext.actor.actorId;
    const now = new Date();

    return this.requireDb().transaction(async (tx: AuditTransaction) => {
      const handle = tx as ProjectQueryHandle;

      const project = await this.repository.findProjectDetail(handle, organizationId, projectId);
      if (!project) {
        throw new NotFoundException("Project not found.");
      }

      if (isArchived(project.status)) {
        throw new ForbiddenException(
          "Archived projects must be restored before membership changes.",
        );
      }

      const membership = await this.repository.findMembershipById(
        handle,
        organizationId,
        projectId,
        membershipId,
      );
      if (!membership) {
        throw new NotFoundException("Project membership not found.");
      }

      if (membership.userId === project.ownerId) {
        throw new ForbiddenException(
          "Change the project owner before removing the current owner's membership.",
        );
      }

      const target = await this.repository.findUser(handle, organizationId, membership.userId);
      const ref: MembershipUserRef | null = target ? userRef(target) : null;
      const before = toMembershipResponse(membership, ref);

      const updated = await this.repository.updateMembership(
        handle,
        organizationId,
        projectId,
        membershipId,
        {
          status: REMOVED_MEMBERSHIP_STATUS,
          deactivatedAt: now,
          softDeletedAt: now,
          updatedAt: now,
          updatedBy: actorId,
          version: membership.version + 1,
        },
      );

      if (!updated) {
        throw new NotFoundException("Project membership not found.");
      }

      const after = toMembershipResponse(updated, ref);
      await this.auditWriter.record(
        tx,
        this.auditInput(
          auditContext,
          ACTION_MEMBERSHIP_REMOVE,
          MEMBERSHIP_ENTITY,
          membershipId,
          projectId,
          before,
          after,
        ),
      );

      return after;
    });
  }

  async getDashboard(
    session: RequestSessionContext,
    projectId: string,
  ): Promise<ProjectDashboardResponse> {
    const detail = await this.repository.findProjectDetail(
      this.requireDb() as ProjectQueryHandle,
      session.user.organizationId,
      projectId,
    );

    if (!detail) {
      throw new NotFoundException("Project not found.");
    }

    // Wire the live source-document counts into the dashboard card. When the source-documents
    // service isn't provided (e.g., tests that construct ProjectsService directly), the card
    // falls back to the module-01 not-started placeholder.
    const sourceCounts = this.sourceDocuments
      ? await this.sourceDocuments.getSourceCounts(session, projectId)
      : undefined;

    return buildProjectDashboard(toProjectResponse(detail), sourceCounts);
  }

  async listAuditEvents(
    session: RequestSessionContext,
    projectId: string,
    query: AuditEventListFilter,
  ): Promise<AuditEventListResponse> {
    const db = this.requireDb();
    const cursor = query.cursor ? decodeAuditCursor(query.cursor) : undefined;

    const page = await this.repository.listAuditEvents(db as ProjectQueryHandle, {
      organizationId: session.user.organizationId,
      projectId,
      limit: query.limit,
      ...(query.entityType !== undefined ? { entityType: query.entityType } : {}),
      ...(query.entityId !== undefined ? { entityId: query.entityId } : {}),
      ...(query.actorId !== undefined ? { actorId: query.actorId } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    });

    return toAuditListResponse(page);
  }
}
