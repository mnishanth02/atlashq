import {
  type CurrentOrganizationResponse,
  currentOrganizationResponseSchema,
} from "@atlashq/validators";
import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthDirectory } from "../auth/auth-directory.js";
import { AuthenticatedGuard } from "../auth/authenticated.guard.js";
import { CurrentSession } from "../auth/current-user.decorator.js";
import type { RequestSessionContext } from "../auth/session-context.js";
import { AUTH_DIRECTORY } from "../runtime/runtime.js";
import {
  ApiAuthenticationErrorResponse,
  ApiForbiddenErrorResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundErrorResponse,
  createZodDto,
  ZodResponse,
} from "../validation/dto-conventions.js";

class CurrentOrganizationDto extends createZodDto(currentOrganizationResponseSchema) {}

@ApiTags("organizations")
@ApiInternalServerErrorResponse()
@Controller("organizations")
export class OrganizationController {
  constructor(@Inject(AUTH_DIRECTORY) private readonly directory: AuthDirectory) {}

  @Get("current")
  @UseGuards(AuthenticatedGuard)
  @ApiOperation({
    operationId: "OrganizationController_getCurrentOrganization",
    summary: "Return the authenticated user's primary organization",
  })
  @ZodResponse({
    description: "The authenticated user's organization context.",
    status: 200,
    type: CurrentOrganizationDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is not active.",
  })
  @ApiNotFoundErrorResponse({
    description: "The organization no longer exists.",
    message: "Organization not found.",
  })
  async getCurrentOrganization(
    @CurrentSession() session: RequestSessionContext,
  ): Promise<CurrentOrganizationResponse> {
    const organization = await this.directory.findOrganization(session.user.organizationId);

    if (!organization) {
      throw new NotFoundException("Organization not found.");
    }

    const user = await this.directory.findUser(session.user.organizationId, session.user.id);

    if (!user) {
      throw new UnauthorizedException("Authentication required.");
    }

    return {
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      role: currentOrganizationResponseSchema.shape.role.parse(user.organizationRole),
    };
  }
}
