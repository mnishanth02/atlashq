import {
  type AuthenticatedMeResponse,
  authenticatedMeResponseSchema,
  authenticatedUserResponseSchema,
} from "@atlashq/validators";
import { Controller, Get, Inject, UnauthorizedException, UseGuards } from "@nestjs/common";
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
  createZodDto,
  ZodResponse,
} from "../validation/dto-conventions.js";

class MeResponseDto extends createZodDto(authenticatedMeResponseSchema) {}

@ApiTags("me")
@ApiInternalServerErrorResponse()
@Controller("me")
export class MeController {
  constructor(@Inject(AUTH_DIRECTORY) private readonly directory: AuthDirectory) {}

  @Get()
  @UseGuards(AuthenticatedGuard)
  @ApiOperation({
    operationId: "MeController_getCurrentUser",
    summary: "Return the authenticated user and session context",
  })
  @ZodResponse({
    description: "The current authenticated user and session.",
    status: 200,
    type: MeResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is not active.",
  })
  async getCurrentUser(
    @CurrentSession() session: RequestSessionContext,
  ): Promise<AuthenticatedMeResponse> {
    const user = await this.directory.findUser(session.user.organizationId, session.user.id);

    if (!user) {
      throw new UnauthorizedException("Authentication required.");
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        organizationRole: authenticatedUserResponseSchema.shape.organizationRole.parse(
          user.organizationRole,
        ),
        status: authenticatedUserResponseSchema.shape.status.parse(user.status),
      },
      session: {
        id: session.session.id,
        expiresAt: session.session.expiresAt.toISOString(),
      },
    };
  }
}
