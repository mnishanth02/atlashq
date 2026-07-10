import type { IncomingHttpHeaders } from "node:http";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { resolveAuditRequestContext } from "../../audit/audit-request-context.js";
import { AuthenticatedGuard } from "../../auth/authenticated.guard.js";
import { CurrentSession } from "../../auth/current-user.decorator.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import { ProjectAuthorizationGuard } from "../../security/project-authorization.guard.js";
import { RequireProjectPermission } from "../../security/require-project-permission.decorator.js";
import {
  ApiAuthenticationErrorResponse,
  ApiConflictErrorResponse,
  ApiForbiddenErrorResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundErrorResponse,
  ApiValidationErrorResponse,
  createZodDto,
  ZodResponse,
} from "../../validation/dto-conventions.js";
import {
  type AuditEventListResponse,
  auditEventListFilterSchema,
  auditEventListResponseSchema,
  type MembershipListResponse,
  type MembershipResponse,
  membershipListResponseSchema,
  membershipPathParamsSchema,
  membershipResponseSchema,
  type ProjectDashboardResponse,
  type ProjectListResponse,
  type ProjectResponse,
  projectCreateInputSchema,
  projectDashboardResponseSchema,
  projectListFilterSchema,
  projectListResponseSchema,
  projectMembershipCreateInputSchema,
  projectMembershipListFilterSchema,
  projectMembershipUpdateInputSchema,
  projectPathParamsSchema,
  projectResponseSchema,
  projectUpdateInputSchema,
} from "./projects.schemas.js";
// biome-ignore lint/style/useImportType: Nest needs the runtime class for constructor injection metadata.
import { ProjectsService } from "./projects.service.js";

const ProjectCreateBodyDtoBase = createZodDto(projectCreateInputSchema);
class ProjectCreateBodyDto extends (ProjectCreateBodyDtoBase as unknown as new () => object) {}
class ProjectUpdateBodyDto extends createZodDto(projectUpdateInputSchema) {}
class ProjectListQueryDto extends createZodDto(projectListFilterSchema) {}
class ProjectPathParamsDto extends createZodDto(projectPathParamsSchema) {}
class MembershipCreateBodyDto extends createZodDto(projectMembershipCreateInputSchema) {}
class MembershipUpdateBodyDto extends createZodDto(projectMembershipUpdateInputSchema) {}
class MembershipListQueryDto extends createZodDto(projectMembershipListFilterSchema) {}
class MembershipPathParamsDto extends createZodDto(membershipPathParamsSchema) {}
class AuditEventListQueryDto extends createZodDto(auditEventListFilterSchema) {}
class ProjectResponseDto extends createZodDto(projectResponseSchema) {}
class ProjectListResponseDto extends createZodDto(projectListResponseSchema) {}
class MembershipResponseDto extends createZodDto(membershipResponseSchema) {}
class MembershipListResponseDto extends createZodDto(membershipListResponseSchema) {}
class ProjectDashboardResponseDto extends createZodDto(projectDashboardResponseSchema) {}
class AuditEventListResponseDto extends createZodDto(auditEventListResponseSchema) {}

type AuditRequestCarrier = {
  id?: unknown;
  headers: IncomingHttpHeaders;
};

@ApiTags("projects")
@ApiInternalServerErrorResponse()
@Controller("projects")
@UseGuards(AuthenticatedGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @ApiOperation({
    operationId: "ProjectsController_listProjects",
    summary: "Search projects visible to the caller in the current organization",
  })
  @ZodResponse({
    description: "A filtered, cursor-paginated project list.",
    status: 200,
    type: ProjectListResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({ description: "The authenticated account is inactive." })
  @ApiValidationErrorResponse()
  async listProjects(
    @CurrentSession() session: RequestSessionContext,
    @Query() query: ProjectListQueryDto,
  ): Promise<ProjectListResponse> {
    return this.service.listProjects(session, query);
  }

  @Post()
  @ApiOperation({
    operationId: "ProjectsController_createProject",
    summary: "Create a project in the current organization",
  })
  @ZodResponse({
    description: "The created project.",
    status: 201,
    type: ProjectResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is inactive or lacks organization-admin privileges.",
  })
  @ApiValidationErrorResponse()
  async createProject(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Body() body: ProjectCreateBodyDto,
  ): Promise<ProjectResponse> {
    return this.service.createProject(
      session,
      ProjectCreateBodyDtoBase.create(body),
      resolveAuditRequestContext(session, request),
    );
  }

  @Get(":projectId")
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:read")
  @ApiOperation({
    operationId: "ProjectsController_getProject",
    summary: "Return a project in the current organization",
  })
  @ZodResponse({
    description: "A project the caller may read.",
    status: 200,
    type: ProjectResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({ description: "The caller cannot read this project." })
  @ApiNotFoundErrorResponse({ description: "Project not found.", message: "Project not found." })
  @ApiValidationErrorResponse()
  async getProject(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
  ): Promise<ProjectResponse> {
    return this.service.getProject(session, params.projectId);
  }

  @Patch(":projectId")
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:write")
  @ApiOperation({
    operationId: "ProjectsController_updateProject",
    summary: "Update a project in the current organization",
  })
  @ZodResponse({
    description: "The updated project.",
    status: 200,
    type: ProjectResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The caller cannot update this project, or the project is archived.",
  })
  @ApiNotFoundErrorResponse({ description: "Project not found.", message: "Project not found." })
  @ApiConflictErrorResponse({
    description: "The supplied project version is stale.",
    message: "Project was modified by another request. Reload it and try again.",
  })
  @ApiValidationErrorResponse()
  async updateProject(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProjectPathParamsDto,
    @Body() body: ProjectUpdateBodyDto,
  ): Promise<ProjectResponse> {
    return this.service.updateProject(
      session,
      params.projectId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post(":projectId/archive")
  @HttpCode(200)
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:admin")
  @ApiOperation({
    operationId: "ProjectsController_archiveProject",
    summary: "Archive a project in the current organization",
  })
  @ZodResponse({
    description: "The archived project.",
    status: 200,
    type: ProjectResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({ description: "The caller cannot archive this project." })
  @ApiNotFoundErrorResponse({ description: "Project not found.", message: "Project not found." })
  @ApiValidationErrorResponse()
  async archiveProject(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProjectPathParamsDto,
  ): Promise<ProjectResponse> {
    return this.service.archiveProject(
      session,
      params.projectId,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post(":projectId/restore")
  @HttpCode(200)
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:admin")
  @ApiOperation({
    operationId: "ProjectsController_restoreProject",
    summary: "Restore an archived project to active",
  })
  @ZodResponse({
    description: "The restored project.",
    status: 200,
    type: ProjectResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({ description: "The caller cannot restore this project." })
  @ApiNotFoundErrorResponse({ description: "Project not found.", message: "Project not found." })
  @ApiValidationErrorResponse()
  async restoreProject(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProjectPathParamsDto,
  ): Promise<ProjectResponse> {
    return this.service.restoreProject(
      session,
      params.projectId,
      resolveAuditRequestContext(session, request),
    );
  }

  @Get(":projectId/memberships")
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:read")
  @ApiOperation({
    operationId: "ProjectsController_listMemberships",
    summary: "List memberships for a project",
  })
  @ZodResponse({
    description: "A cursor-paginated membership list.",
    status: 200,
    type: MembershipListResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({ description: "The caller cannot read this project." })
  @ApiNotFoundErrorResponse({ description: "Project not found.", message: "Project not found." })
  @ApiValidationErrorResponse()
  async listMemberships(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
    @Query() query: MembershipListQueryDto,
  ): Promise<MembershipListResponse> {
    return this.service.listMemberships(session, params.projectId, query);
  }

  @Post(":projectId/memberships")
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:admin")
  @ApiOperation({
    operationId: "ProjectsController_addMembership",
    summary: "Add a membership to a project",
  })
  @ZodResponse({
    description: "The created membership.",
    status: 201,
    type: MembershipResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The caller cannot manage memberships, or the project is archived.",
  })
  @ApiNotFoundErrorResponse({ description: "Project not found.", message: "Project not found." })
  @ApiConflictErrorResponse({
    description: "The user already has an active membership on this project.",
  })
  @ApiValidationErrorResponse()
  async addMembership(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProjectPathParamsDto,
    @Body() body: MembershipCreateBodyDto,
  ): Promise<MembershipResponse> {
    return this.service.addMembership(
      session,
      params.projectId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Patch(":projectId/memberships/:membershipId")
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:admin")
  @ApiOperation({
    operationId: "ProjectsController_updateMembership",
    summary: "Update a project membership",
  })
  @ZodResponse({
    description: "The updated membership.",
    status: 200,
    type: MembershipResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description:
      "The caller cannot manage memberships, the project is archived, or the change would demote the current owner.",
  })
  @ApiNotFoundErrorResponse({
    description: "Project membership not found.",
    message: "Project membership not found.",
  })
  @ApiValidationErrorResponse()
  async updateMembership(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: MembershipPathParamsDto,
    @Body() body: MembershipUpdateBodyDto,
  ): Promise<MembershipResponse> {
    return this.service.updateMembership(
      session,
      params.projectId,
      params.membershipId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Delete(":projectId/memberships/:membershipId")
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:admin")
  @ApiOperation({
    operationId: "ProjectsController_removeMembership",
    summary: "Deactivate (soft-delete) a project membership",
  })
  @ZodResponse({
    description: "The deactivated membership.",
    status: 200,
    type: MembershipResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description:
      "The caller cannot manage memberships, the project is archived, or the target is the current owner.",
  })
  @ApiNotFoundErrorResponse({
    description: "Project membership not found.",
    message: "Project membership not found.",
  })
  @ApiValidationErrorResponse()
  async removeMembership(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: MembershipPathParamsDto,
  ): Promise<MembershipResponse> {
    return this.service.removeMembership(
      session,
      params.projectId,
      params.membershipId,
      resolveAuditRequestContext(session, request),
    );
  }

  @Get(":projectId/dashboard")
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:read")
  @ApiOperation({
    operationId: "ProjectsController_getDashboard",
    summary: "Return the Module 1 project dashboard",
  })
  @ZodResponse({
    description: "The project summary plus honest zero-state Module 1 cards.",
    status: 200,
    type: ProjectDashboardResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({ description: "The caller cannot read this project." })
  @ApiNotFoundErrorResponse({ description: "Project not found.", message: "Project not found." })
  @ApiValidationErrorResponse()
  async getDashboard(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
  ): Promise<ProjectDashboardResponse> {
    return this.service.getDashboard(session, params.projectId);
  }

  @Get(":projectId/audit-events")
  @UseGuards(ProjectAuthorizationGuard)
  @RequireProjectPermission("project:read")
  @ApiOperation({
    operationId: "ProjectsController_listAuditEvents",
    summary: "List audit events for a project, newest first",
  })
  @ZodResponse({
    description: "A cursor-paginated, newest-first audit-event list.",
    status: 200,
    type: AuditEventListResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({ description: "The caller cannot read this project." })
  @ApiNotFoundErrorResponse({ description: "Project not found.", message: "Project not found." })
  @ApiValidationErrorResponse()
  async listAuditEvents(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
    @Query() query: AuditEventListQueryDto,
  ): Promise<AuditEventListResponse> {
    return this.service.listAuditEvents(session, params.projectId, query);
  }
}
