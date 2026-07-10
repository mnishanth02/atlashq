import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../../auth/authenticated.guard.js";
import { CurrentSession } from "../../auth/current-user.decorator.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import {
  ApiAuthenticationErrorResponse,
  ApiForbiddenErrorResponse,
  ApiInternalServerErrorResponse,
  ApiValidationErrorResponse,
  createZodDto,
  ZodResponse,
} from "../../validation/dto-conventions.js";
import {
  type OrganizationUserListFilter,
  type OrganizationUserListResponse,
  organizationUserListFilterSchema,
  organizationUserListResponseSchema,
} from "./organization-users.schemas.js";
// biome-ignore lint/style/useImportType: Nest needs the runtime class for constructor injection metadata.
import { OrganizationUsersService } from "./organization-users.service.js";

class OrganizationUserListQueryDto extends createZodDto(organizationUserListFilterSchema) {}
class OrganizationUserListResponseDto extends createZodDto(organizationUserListResponseSchema) {}

@ApiTags("organizations")
@ApiInternalServerErrorResponse()
@Controller("organizations/current/users")
@UseGuards(AuthenticatedGuard)
export class OrganizationUsersController {
  constructor(private readonly service: OrganizationUsersService) {}

  @Get()
  @ApiOperation({
    operationId: "OrganizationUsersController_listOrganizationUsers",
    summary: "Search the authenticated user's organization directory",
  })
  @ZodResponse({
    description:
      "A filtered, cursor-paginated list of users in the caller's own organization, ordered by name then id.",
    status: 200,
    type: OrganizationUserListResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is not active.",
  })
  @ApiValidationErrorResponse()
  async listOrganizationUsers(
    @CurrentSession() session: RequestSessionContext,
    @Query() query: OrganizationUserListQueryDto,
  ): Promise<OrganizationUserListResponse> {
    return this.service.listOrganizationUsers(session, query as OrganizationUserListFilter);
  }
}
