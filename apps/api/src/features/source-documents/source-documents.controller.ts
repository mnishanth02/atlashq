import type { IncomingHttpHeaders } from "node:http";
import { paginationQuerySchema } from "@atlashq/validators";
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
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
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
  ipReviewChangeInputSchema,
  manualSourceCreateInputSchema,
  projectPathParamsSchema,
  referenceCaptureRequestInputSchema,
  referenceSourceCreateInputSchema,
  sourceArchiveInputSchema,
  sourceChunkListResponseSchema,
  sourceDocumentDetailResponseSchema,
  sourceDocumentListResponseSchema,
  sourceExtractionListResponseSchema,
  sourceFilePathParamsSchema,
  sourceFileSignedUrlResponseSchema,
  sourceListFilterSchema,
  sourceMetadataPatchInputSchema,
  sourcePathParamsSchema,
  sourceRestoreInputSchema,
  sourceRetryProcessingInputSchema,
  sourceVaultCapabilitiesResponseSchema,
  sourceVersionListResponseSchema,
  sourceVersionManualInputSchema,
  sourceVersionUploadSessionInputSchema,
  uploadSessionCancelInputSchema,
  uploadSessionConfirmInputSchema,
  uploadSessionCreateInputSchema,
  uploadSessionPathParamsSchema,
  uploadSessionResponseSchema,
} from "./source-documents.schemas.js";
// biome-ignore lint/style/useImportType: Nest needs the runtime class for constructor injection metadata.
import { SourceDocumentsService } from "./source-documents.service.js";

const UploadSessionCreateBodyDtoBase = createZodDto(uploadSessionCreateInputSchema);
class UploadSessionCreateBodyDto extends (UploadSessionCreateBodyDtoBase as unknown as new () => object) {}
class UploadSessionConfirmBodyDto extends createZodDto(uploadSessionConfirmInputSchema) {}
class UploadSessionCancelBodyDto extends createZodDto(uploadSessionCancelInputSchema) {}
class ManualSourceCreateBodyDto extends createZodDto(manualSourceCreateInputSchema) {}
const ReferenceSourceCreateBodyDtoBase = createZodDto(referenceSourceCreateInputSchema);
class ReferenceSourceCreateBodyDto extends (ReferenceSourceCreateBodyDtoBase as unknown as new () => object) {}
class SourceMetadataPatchBodyDto extends createZodDto(sourceMetadataPatchInputSchema) {}
class SourceArchiveBodyDto extends createZodDto(sourceArchiveInputSchema) {}
class SourceRestoreBodyDto extends createZodDto(sourceRestoreInputSchema) {}
class SourceRetryBodyDto extends createZodDto(sourceRetryProcessingInputSchema) {}
const SourceVersionUploadSessionBodyDtoBase = createZodDto(sourceVersionUploadSessionInputSchema);
class SourceVersionUploadSessionBodyDto extends (SourceVersionUploadSessionBodyDtoBase as unknown as new () => object) {}
class SourceVersionManualBodyDto extends createZodDto(sourceVersionManualInputSchema) {}
class ReferenceCaptureRequestBodyDto extends createZodDto(referenceCaptureRequestInputSchema) {}
class IpReviewChangeBodyDto extends createZodDto(ipReviewChangeInputSchema) {}

class SourceListQueryDto extends createZodDto(sourceListFilterSchema) {}
class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
class ProjectPathParamsDto extends createZodDto(projectPathParamsSchema) {}
class UploadSessionPathParamsDto extends createZodDto(uploadSessionPathParamsSchema) {}
class SourcePathParamsDto extends createZodDto(sourcePathParamsSchema) {}
class SourceFilePathParamsDto extends createZodDto(sourceFilePathParamsSchema) {}

class UploadSessionResponseDto extends createZodDto(uploadSessionResponseSchema) {}
class SourceDocumentDetailResponseDto extends createZodDto(sourceDocumentDetailResponseSchema) {}
class SourceDocumentListResponseDto extends createZodDto(sourceDocumentListResponseSchema) {}
class SourceVersionListResponseDto extends createZodDto(sourceVersionListResponseSchema) {}
class SourceExtractionListResponseDto extends createZodDto(sourceExtractionListResponseSchema) {}
class SourceChunkListResponseDto extends createZodDto(sourceChunkListResponseSchema) {}
class SourceFileSignedUrlResponseDto extends createZodDto(sourceFileSignedUrlResponseSchema) {}
class SourceVaultCapabilitiesResponseDto extends createZodDto(
  sourceVaultCapabilitiesResponseSchema,
) {}

type AuditRequestCarrier = {
  id?: unknown;
  headers: IncomingHttpHeaders;
};

@ApiTags("source-documents")
@ApiInternalServerErrorResponse()
@Controller("projects/:projectId")
@UseGuards(AuthenticatedGuard, ProjectAuthorizationGuard)
export class SourceDocumentsController {
  constructor(private readonly service: SourceDocumentsService) {}

  // ---- Capabilities -------------------------------------------------------

  @Get("source-vault/capabilities")
  @RequireProjectPermission("sources:read")
  @ApiParam({ name: "projectId", format: "uuid", type: String })
  @ApiOperation({
    operationId: "SourceDocumentsController_getCapabilities",
    summary: "Get server-authoritative Source Vault capability flags for this project",
  })
  @ZodResponse({
    status: 200,
    description: "Capability flags.",
    type: SourceVaultCapabilitiesResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  async getCapabilities(
    @CurrentSession() session: RequestSessionContext,
    @Param() _params: ProjectPathParamsDto,
  ) {
    return this.service.getCapabilities(session);
  }

  // ---- Upload sessions --------------------------------------------------

  @Post("source-document-upload-sessions")
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_createUploadSession",
    summary: "Create a source document upload session",
  })
  @ZodResponse({ status: 201, description: "The upload session.", type: UploadSessionResponseDto })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async createUploadSession(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProjectPathParamsDto,
    @Body() body: UploadSessionCreateBodyDto,
  ) {
    return this.service.createUploadSession(
      session,
      params.projectId,
      UploadSessionCreateBodyDtoBase.create(body),
      resolveAuditRequestContext(session, request),
    );
  }

  @Get("source-document-upload-sessions/:sessionId")
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_getUploadSession",
    summary: "Fetch a source document upload session",
  })
  @ZodResponse({ status: 200, description: "The upload session.", type: UploadSessionResponseDto })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  async getUploadSession(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: UploadSessionPathParamsDto,
  ) {
    return this.service.getUploadSession(session, params.projectId, params.sessionId);
  }

  @Post("source-document-upload-sessions/:sessionId/confirm")
  @HttpCode(200)
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_confirmUploadSession",
    summary: "Confirm a source document upload session",
  })
  @ZodResponse({
    status: 200,
    description: "The created source document.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  @ApiValidationErrorResponse()
  async confirmUploadSession(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: UploadSessionPathParamsDto,
    @Body() body: UploadSessionConfirmBodyDto,
  ) {
    return this.service.confirmUploadSession(
      session,
      params.projectId,
      params.sessionId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("source-document-upload-sessions/:sessionId/cancel")
  @HttpCode(200)
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_cancelUploadSession",
    summary: "Cancel a source document upload session",
  })
  @ZodResponse({ status: 200, description: "The upload session.", type: UploadSessionResponseDto })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async cancelUploadSession(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: UploadSessionPathParamsDto,
    @Body() body: UploadSessionCancelBodyDto,
  ) {
    return this.service.cancelUploadSession(
      session,
      params.projectId,
      params.sessionId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  // ---- Source list / detail / intake -------------------------------------

  @Get("source-documents")
  @RequireProjectPermission("sources:read")
  @ApiOperation({
    operationId: "SourceDocumentsController_listSources",
    summary: "List source documents in a project",
  })
  @ZodResponse({
    status: 200,
    description: "Source documents.",
    type: SourceDocumentListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  async listSources(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
    @Query() query: SourceListQueryDto,
  ) {
    return this.service.listSources(session, params.projectId, query);
  }

  @Post("source-documents/manual")
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_createManualSource",
    summary: "Create a manual text source document",
  })
  @ZodResponse({
    status: 201,
    description: "The manual source document.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  @ApiValidationErrorResponse()
  async createManual(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProjectPathParamsDto,
    @Body() body: ManualSourceCreateBodyDto,
  ) {
    return this.service.createManualSource(
      session,
      params.projectId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("source-documents/references")
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_createReferenceSource",
    summary: "Create a reference source document with attestation",
  })
  @ZodResponse({
    status: 201,
    description: "The reference source document.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  @ApiValidationErrorResponse()
  async createReference(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProjectPathParamsDto,
    @Body() body: ReferenceSourceCreateBodyDto,
  ) {
    return this.service.createReferenceSource(
      session,
      params.projectId,
      ReferenceSourceCreateBodyDtoBase.create(body),
      resolveAuditRequestContext(session, request),
    );
  }

  @Get("source-documents/:sourceId")
  @RequireProjectPermission("sources:read")
  @ApiOperation({
    operationId: "SourceDocumentsController_getSource",
    summary: "Fetch a source document",
  })
  @ZodResponse({
    status: 200,
    description: "The source document.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  async getSource(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: SourcePathParamsDto,
  ) {
    return this.service.getSource(session, params.projectId, params.sourceId);
  }

  @Patch("source-documents/:sourceId/metadata")
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_updateMetadata",
    summary: "Update mutable source document metadata",
  })
  @ZodResponse({
    status: 200,
    description: "The updated source document.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  @ApiValidationErrorResponse()
  async updateMetadata(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourcePathParamsDto,
    @Body() body: SourceMetadataPatchBodyDto,
  ) {
    return this.service.updateMetadata(
      session,
      params.projectId,
      params.sourceId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("source-documents/:sourceId/archive")
  @HttpCode(200)
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_archiveSource",
    summary: "Archive a source document",
  })
  @ZodResponse({
    status: 200,
    description: "The archived source document.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async archiveSource(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourcePathParamsDto,
    @Body() body: SourceArchiveBodyDto,
  ) {
    return this.service.archiveSource(
      session,
      params.projectId,
      params.sourceId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("source-documents/:sourceId/restore")
  @HttpCode(200)
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_restoreSource",
    summary: "Restore an archived source document",
  })
  @ZodResponse({
    status: 200,
    description: "The restored source document.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async restoreSource(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourcePathParamsDto,
    @Body() body: SourceRestoreBodyDto,
  ) {
    return this.service.restoreSource(
      session,
      params.projectId,
      params.sourceId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("source-documents/:sourceId/retry-processing")
  @HttpCode(200)
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_retryProcessing",
    summary: "Retry processing of a source document",
  })
  @ZodResponse({
    status: 200,
    description: "The source document.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async retry(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourcePathParamsDto,
    @Body() body: SourceRetryBodyDto,
  ) {
    return this.service.retryProcessing(
      session,
      params.projectId,
      params.sourceId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  // ---- Versions --------------------------------------------------------

  @Post("source-documents/:sourceId/versions/upload-session")
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_createVersionUploadSession",
    summary: "Create an upload session for a new source document version",
  })
  @ZodResponse({ status: 201, description: "Upload session.", type: UploadSessionResponseDto })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async createVersionUploadSession(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourcePathParamsDto,
    @Body() body: SourceVersionUploadSessionBodyDto,
  ) {
    return this.service.createUploadSession(
      session,
      params.projectId,
      SourceVersionUploadSessionBodyDtoBase.create(body),
      resolveAuditRequestContext(session, request),
      params.sourceId,
    );
  }

  @Post("source-documents/:sourceId/versions/manual")
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_createVersionManual",
    summary: "Create a manual new version of a source document",
  })
  @ZodResponse({
    status: 201,
    description: "Manual source document version.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async createVersionManual(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourcePathParamsDto,
    @Body() body: SourceVersionManualBodyDto,
  ) {
    return this.service.createManualSource(
      session,
      params.projectId,
      body,
      resolveAuditRequestContext(session, request),
      params.sourceId,
    );
  }

  @Get("source-documents/:sourceId/versions")
  @RequireProjectPermission("sources:read")
  @ApiOperation({
    operationId: "SourceDocumentsController_listVersions",
    summary: "List versions in a source document lineage",
  })
  @ZodResponse({
    status: 200,
    description: "Version history.",
    type: SourceVersionListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  async listVersions(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: SourcePathParamsDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.listVersions(
      session,
      params.projectId,
      params.sourceId,
      query.limit,
      query.cursor,
    );
  }

  @Get("source-documents/:sourceId/extractions")
  @RequireProjectPermission("sources:read")
  @ApiOperation({
    operationId: "SourceDocumentsController_listExtractions",
    summary: "List extraction attempts for a source document",
  })
  @ZodResponse({
    status: 200,
    description: "Extractions.",
    type: SourceExtractionListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  async listExtractions(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: SourcePathParamsDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.listExtractions(
      session,
      params.projectId,
      params.sourceId,
      query.limit,
      query.cursor,
    );
  }

  @Get("source-documents/:sourceId/chunks")
  @RequireProjectPermission("sources:read")
  @ApiOperation({
    operationId: "SourceDocumentsController_listChunks",
    summary: "List chunks produced from a source document",
  })
  @ZodResponse({ status: 200, description: "Chunks.", type: SourceChunkListResponseDto })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  async listChunks(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: SourcePathParamsDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.listChunks(
      session,
      params.projectId,
      params.sourceId,
      query.limit,
      query.cursor,
    );
  }

  // ---- Signed URLs -----------------------------------------------------

  @Get("source-documents/:sourceId/files/:fileId/preview-url")
  @RequireProjectPermission("sources:read")
  @ApiOperation({
    operationId: "SourceDocumentsController_getPreviewUrl",
    summary: "Get an ephemeral inline preview URL for a source file",
  })
  @ZodResponse({
    status: 200,
    description: "Signed preview URL.",
    type: SourceFileSignedUrlResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async getPreviewUrl(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourceFilePathParamsDto,
  ) {
    return this.service.getFileSignedUrl(
      session,
      params.projectId,
      params.sourceId,
      params.fileId,
      "preview",
      resolveAuditRequestContext(session, request),
    );
  }

  @Get("source-documents/:sourceId/files/:fileId/download-url")
  @RequireProjectPermission("sources:read")
  @ApiOperation({
    operationId: "SourceDocumentsController_getDownloadUrl",
    summary: "Get an ephemeral attachment download URL for a source file",
  })
  @ZodResponse({
    status: 200,
    description: "Signed download URL.",
    type: SourceFileSignedUrlResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async getDownloadUrl(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourceFilePathParamsDto,
  ) {
    return this.service.getFileSignedUrl(
      session,
      params.projectId,
      params.sourceId,
      params.fileId,
      "download",
      resolveAuditRequestContext(session, request),
    );
  }

  // ---- Reference capture + IP review -----------------------------------

  @Post("source-documents/:sourceId/reference-capture")
  @HttpCode(202)
  @RequireProjectPermission("sources:write")
  @ApiOperation({
    operationId: "SourceDocumentsController_requestReferenceCapture",
    summary: "Request on-demand single-page capture of a reference source",
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  async requestReferenceCapture(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourcePathParamsDto,
    @Body() body: ReferenceCaptureRequestBodyDto,
  ) {
    return this.service.requestReferenceCapture(
      session,
      params.projectId,
      params.sourceId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("source-documents/:sourceId/ip-review")
  @HttpCode(200)
  @RequireProjectPermission("project:admin")
  @ApiOperation({
    operationId: "SourceDocumentsController_changeIpReview",
    summary: "Change the IP review status of a reference source",
  })
  @ZodResponse({
    status: 200,
    description: "The updated reference source.",
    type: SourceDocumentDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiConflictErrorResponse()
  async changeIpReview(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: SourcePathParamsDto,
    @Body() body: IpReviewChangeBodyDto,
  ) {
    return this.service.changeIpReview(
      session,
      params.projectId,
      params.sourceId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }
}
