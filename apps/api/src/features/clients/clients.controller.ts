import type { IncomingHttpHeaders } from "node:http";
import {
  Body,
  Controller,
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
  type ClientListResponse,
  type ClientResponse,
  clientCreateInputSchema,
  clientListFilterSchema,
  clientListResponseSchema,
  clientPathParamsSchema,
  clientResponseSchema,
  clientUpdateInputSchema,
} from "./clients.schemas.js";
// biome-ignore lint/style/useImportType: Nest needs the runtime class for constructor injection metadata.
import { ClientsService } from "./clients.service.js";

class ClientCreateBodyDto extends createZodDto(clientCreateInputSchema) {}
class ClientUpdateBodyDto extends createZodDto(clientUpdateInputSchema) {}
class ClientListQueryDto extends createZodDto(clientListFilterSchema) {}
class ClientPathParamsDto extends createZodDto(clientPathParamsSchema) {}
class ClientResponseDto extends createZodDto(clientResponseSchema) {}
class ClientListResponseDto extends createZodDto(clientListResponseSchema) {}

type AuditRequestCarrier = {
  id?: unknown;
  headers: IncomingHttpHeaders;
};

@ApiTags("clients")
@ApiInternalServerErrorResponse()
@Controller("clients")
@UseGuards(AuthenticatedGuard)
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get()
  @ApiOperation({
    operationId: "ClientsController_listClients",
    summary: "Search clients in the current organization",
  })
  @ZodResponse({
    description: "A filtered, cursor-paginated client list.",
    status: 200,
    type: ClientListResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is inactive or cannot read clients.",
  })
  @ApiValidationErrorResponse()
  async listClients(
    @CurrentSession() session: RequestSessionContext,
    @Query() query: ClientListQueryDto,
  ): Promise<ClientListResponse> {
    return this.service.listClients(session, query);
  }

  @Get(":clientId")
  @ApiOperation({
    operationId: "ClientsController_getClient",
    summary: "Return a client in the current organization",
  })
  @ZodResponse({
    description: "A client from the caller's organization.",
    status: 200,
    type: ClientResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is inactive or cannot read clients.",
  })
  @ApiNotFoundErrorResponse({ description: "Client not found.", message: "Client not found." })
  @ApiValidationErrorResponse()
  async getClient(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ClientPathParamsDto,
  ): Promise<ClientResponse> {
    return this.service.getClient(session, params.clientId);
  }

  @Post()
  @ApiOperation({
    operationId: "ClientsController_createClient",
    summary: "Create a client in the current organization",
  })
  @ZodResponse({
    description: "The created client.",
    status: 201,
    type: ClientResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is inactive or lacks organization-admin privileges.",
  })
  @ApiValidationErrorResponse()
  async createClient(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Body() body: ClientCreateBodyDto,
  ): Promise<ClientResponse> {
    return this.service.createClient(session, body, resolveAuditRequestContext(session, request));
  }

  @Patch(":clientId")
  @ApiOperation({
    operationId: "ClientsController_updateClient",
    summary: "Update a client in the current organization",
  })
  @ZodResponse({
    description: "The updated client.",
    status: 200,
    type: ClientResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is inactive or lacks organization-admin privileges.",
  })
  @ApiNotFoundErrorResponse({ description: "Client not found.", message: "Client not found." })
  @ApiConflictErrorResponse({
    description: "The supplied client version is stale.",
    message: "Client was modified by another request. Reload it and try again.",
  })
  @ApiValidationErrorResponse()
  async updateClient(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ClientPathParamsDto,
    @Body() body: ClientUpdateBodyDto,
  ): Promise<ClientResponse> {
    return this.service.updateClient(
      session,
      params.clientId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post(":clientId/archive")
  @HttpCode(200)
  @ApiOperation({
    operationId: "ClientsController_archiveClient",
    summary: "Archive a client in the current organization",
  })
  @ZodResponse({
    description: "The archived client.",
    status: 200,
    type: ClientResponseDto,
  })
  @ApiAuthenticationErrorResponse({ description: "No valid, active session was supplied." })
  @ApiForbiddenErrorResponse({
    description: "The authenticated account is inactive or lacks organization-admin privileges.",
  })
  @ApiNotFoundErrorResponse({ description: "Client not found.", message: "Client not found." })
  @ApiValidationErrorResponse()
  async archiveClient(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ClientPathParamsDto,
  ): Promise<ClientResponse> {
    return this.service.archiveClient(
      session,
      params.clientId,
      resolveAuditRequestContext(session, request),
    );
  }
}
