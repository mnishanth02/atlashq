import type { IncomingHttpHeaders } from "node:http";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
  analysisBatchListFilterSchema,
  analysisBatchListResponseSchema,
  analysisRunCancelRequestSchema,
  analysisRunDetailResponseSchema,
  analysisRunFreshRequestSchema,
  analysisRunListFilterSchema,
  analysisRunListResponseSchema,
  analysisRunReplayRequestSchema,
  analysisRunReprocessRequestSchema,
  analysisRunRetryRequestSchema,
  analysisStageListFilterSchema,
  analysisStageListResponseSchema,
  citationEvidenceResponseSchema,
  citationListFilterSchema,
  citationListResponseSchema,
  coverageListFilterSchema,
  coverageListResponseSchema,
  deliveryItemListFilterSchema,
  deliveryItemListResponseSchema,
  deliveryItemResponseSchema,
  eligibleSourcePreviewResponseSchema,
  projectPathParamsSchema,
  providerPolicyApproveActionInputSchema,
  providerPolicyCreateInputSchema,
  providerPolicyDeactivateActionInputSchema,
  providerPolicyListFilterSchema,
  providerPolicyListResponseSchema,
  providerPolicyPathParamsSchema,
  providerPolicyResponseSchema,
  requirementAnalysisCapabilitiesResponseSchema,
  requirementListFilterSchema,
  requirementListResponseSchema,
  requirementResponseSchema,
  runCitationPathParamsSchema,
  runDeliveryItemPathParamsSchema,
  runPathParamsSchema,
  runRequirementPathParamsSchema,
  traceabilityListFilterSchema,
  traceabilityListResponseSchema,
} from "./requirement-analysis.schemas.js";
// biome-ignore lint/style/useImportType: Nest needs runtime constructor metadata for injection.
import { RequirementAnalysisService } from "./requirement-analysis.service.js";

class ProviderPolicyCreateBodyDto extends createZodDto(providerPolicyCreateInputSchema) {}
class ProviderPolicyApproveBodyDto extends createZodDto(providerPolicyApproveActionInputSchema) {}
class ProviderPolicyDeactivateBodyDto extends createZodDto(
  providerPolicyDeactivateActionInputSchema,
) {}
class ProviderPolicyListQueryDto extends createZodDto(providerPolicyListFilterSchema) {}
class ProviderPolicyPathParamsDto extends createZodDto(providerPolicyPathParamsSchema) {}

class ProjectPathParamsDto extends createZodDto(projectPathParamsSchema) {}
class RunPathParamsDto extends createZodDto(runPathParamsSchema) {}
class RunRequirementPathParamsDto extends createZodDto(runRequirementPathParamsSchema) {}
class RunDeliveryItemPathParamsDto extends createZodDto(runDeliveryItemPathParamsSchema) {}
class RunCitationPathParamsDto extends createZodDto(runCitationPathParamsSchema) {}

class AnalysisRunFreshBodyDto extends createZodDto(analysisRunFreshRequestSchema) {}
class AnalysisRunCancelBodyDto extends createZodDto(analysisRunCancelRequestSchema) {}
class AnalysisRunRetryBodyDto extends createZodDto(analysisRunRetryRequestSchema) {}
class AnalysisRunReplayBodyDto extends createZodDto(analysisRunReplayRequestSchema) {}
class AnalysisRunReprocessBodyDto extends createZodDto(analysisRunReprocessRequestSchema) {}

class AnalysisRunListQueryDto extends createZodDto(analysisRunListFilterSchema) {}
class AnalysisStageListQueryDto extends createZodDto(analysisStageListFilterSchema) {}
class AnalysisBatchListQueryDto extends createZodDto(analysisBatchListFilterSchema) {}
class RequirementListQueryDto extends createZodDto(requirementListFilterSchema) {}
class DeliveryItemListQueryDto extends createZodDto(deliveryItemListFilterSchema) {}
class CoverageListQueryDto extends createZodDto(coverageListFilterSchema) {}
class CitationListQueryDto extends createZodDto(citationListFilterSchema) {}
class TraceabilityListQueryDto extends createZodDto(traceabilityListFilterSchema) {}

class RequirementAnalysisCapabilitiesResponseDto extends createZodDto(
  requirementAnalysisCapabilitiesResponseSchema,
) {}
class ProviderPolicyResponseDto extends createZodDto(providerPolicyResponseSchema) {}
class ProviderPolicyListResponseDto extends createZodDto(providerPolicyListResponseSchema) {}
class EligibleSourcePreviewResponseDto extends createZodDto(eligibleSourcePreviewResponseSchema) {}
class AnalysisRunDetailResponseDto extends createZodDto(analysisRunDetailResponseSchema) {}
class AnalysisRunListResponseDto extends createZodDto(analysisRunListResponseSchema) {}
class AnalysisStageListResponseDto extends createZodDto(analysisStageListResponseSchema) {}
class AnalysisBatchListResponseDto extends createZodDto(analysisBatchListResponseSchema) {}
class RequirementListResponseDto extends createZodDto(requirementListResponseSchema) {}
class RequirementResponseDto extends createZodDto(requirementResponseSchema) {}
class DeliveryItemListResponseDto extends createZodDto(deliveryItemListResponseSchema) {}
const DeliveryItemResponseDto = createZodDto(deliveryItemResponseSchema);
class CoverageListResponseDto extends createZodDto(coverageListResponseSchema) {}
class CitationListResponseDto extends createZodDto(citationListResponseSchema) {}
class CitationEvidenceResponseDto extends createZodDto(citationEvidenceResponseSchema) {}
class TraceabilityListResponseDto extends createZodDto(traceabilityListResponseSchema) {}

type AuditRequestCarrier = {
  id?: unknown;
  headers: IncomingHttpHeaders;
};

@ApiTags("requirement-analysis")
@ApiInternalServerErrorResponse()
@Controller("organizations/current/ai-provider-policies")
@UseGuards(AuthenticatedGuard)
export class RequirementAnalysisOrganizationController {
  constructor(private readonly service: RequirementAnalysisService) {}

  @Get()
  @ApiOperation({
    operationId: "RequirementAnalysisOrganizationController_listProviderPolicies",
    summary: "List organization AI provider policies",
  })
  @ZodResponse({
    status: 200,
    description: "Organization provider policies.",
    type: ProviderPolicyListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  async listProviderPolicies(
    @CurrentSession() session: RequestSessionContext,
    @Query() query: ProviderPolicyListQueryDto,
  ) {
    return this.service.listOrganizationProviderPolicies(session, query);
  }

  @Post()
  @ApiOperation({
    operationId: "RequirementAnalysisOrganizationController_createProviderPolicy",
    summary: "Create an organization provider policy draft",
  })
  @ZodResponse({
    status: 201,
    description: "Created provider policy draft.",
    type: ProviderPolicyResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async createProviderPolicy(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Body() body: ProviderPolicyCreateBodyDto,
  ) {
    return this.service.createOrganizationProviderPolicy(
      session,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post(":policyId/approve")
  @HttpCode(200)
  @ApiOperation({
    operationId: "RequirementAnalysisOrganizationController_approveProviderPolicy",
    summary: "Approve a provider policy for requirement-analysis",
  })
  @ZodResponse({
    status: 200,
    description: "Approved provider policy.",
    type: ProviderPolicyResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async approveProviderPolicy(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProviderPolicyPathParamsDto,
    @Body() body: ProviderPolicyApproveBodyDto,
  ) {
    return this.service.approveOrganizationProviderPolicy(
      session,
      params.policyId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post(":policyId/deactivate")
  @HttpCode(200)
  @ApiOperation({
    operationId: "RequirementAnalysisOrganizationController_deactivateProviderPolicy",
    summary: "Deactivate an approved provider policy",
  })
  @ZodResponse({
    status: 200,
    description: "Deactivated provider policy.",
    type: ProviderPolicyResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async deactivateProviderPolicy(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProviderPolicyPathParamsDto,
    @Body() body: ProviderPolicyDeactivateBodyDto,
  ) {
    return this.service.deactivateOrganizationProviderPolicy(
      session,
      params.policyId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }
}

@ApiTags("requirement-analysis")
@ApiInternalServerErrorResponse()
@Controller("projects/:projectId/requirement-analysis")
@UseGuards(AuthenticatedGuard, ProjectAuthorizationGuard)
export class RequirementAnalysisController {
  constructor(private readonly service: RequirementAnalysisService) {}

  @Get("capabilities")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_getCapabilities",
    summary: "Get requirement-analysis capabilities and safe-disabled state",
  })
  @ZodResponse({
    status: 200,
    description: "Requirement-analysis capability flags.",
    type: RequirementAnalysisCapabilitiesResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  async getCapabilities(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
  ) {
    return this.service.getCapabilities(session, params.projectId);
  }

  @Get("provider-policies")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listProjectProviderPolicies",
    summary: "List approved provider policies available for this project",
  })
  @ZodResponse({
    status: 200,
    description: "Provider policies.",
    type: ProviderPolicyListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  async listProjectProviderPolicies(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
    @Query() query: ProviderPolicyListQueryDto,
  ) {
    return this.service.listProjectProviderPolicies(session, params.projectId, query);
  }

  @Get("eligible-sources")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_previewEligibleSources",
    summary: "Preview currently eligible sources for requirement-analysis",
  })
  @ZodResponse({
    status: 200,
    description: "Eligible source preview.",
    type: EligibleSourcePreviewResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async previewEligibleSources(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
  ) {
    return this.service.previewEligibleSources(session, params.projectId);
  }

  @Post("runs")
  @RequireProjectPermission("requirements:analyze")
  @ApiOperation({
    operationId: "RequirementAnalysisController_createFreshRun",
    summary: "Create a new fresh requirement-analysis run",
  })
  @ZodResponse({
    status: 201,
    description: "Created requirement-analysis run.",
    type: AnalysisRunDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async createFreshRun(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: ProjectPathParamsDto,
    @Body() body: AnalysisRunFreshBodyDto,
  ) {
    return this.service.createFreshRun(
      session,
      params.projectId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Get("runs")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listRuns",
    summary: "List requirement-analysis runs",
  })
  @ZodResponse({
    status: 200,
    description: "Requirement-analysis runs.",
    type: AnalysisRunListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  async listRuns(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: ProjectPathParamsDto,
    @Query() query: AnalysisRunListQueryDto,
  ) {
    return this.service.listRuns(session, params.projectId, query);
  }

  @Get("runs/:runId")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_getRunDetail",
    summary: "Get requirement-analysis run detail",
  })
  @ZodResponse({
    status: 200,
    description: "Requirement-analysis run detail.",
    type: AnalysisRunDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  async getRunDetail(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunPathParamsDto,
  ) {
    return this.service.getRunDetail(session, params.projectId, params.runId);
  }

  @Post("runs/:runId/cancel")
  @HttpCode(200)
  @RequireProjectPermission("requirements:analyze")
  @ApiOperation({
    operationId: "RequirementAnalysisController_cancelRun",
    summary: "Request cooperative cancellation for a run",
  })
  @ZodResponse({
    status: 200,
    description: "Updated requirement-analysis run.",
    type: AnalysisRunDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async cancelRun(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: RunPathParamsDto,
    @Body() body: AnalysisRunCancelBodyDto,
  ) {
    return this.service.cancelRun(
      session,
      params.projectId,
      params.runId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("runs/:runId/retry")
  @RequireProjectPermission("requirements:analyze")
  @ApiOperation({
    operationId: "RequirementAnalysisController_retryRun",
    summary: "Create a retry run from a terminal retryable failed run",
  })
  @ZodResponse({
    status: 201,
    description: "Created retry run.",
    type: AnalysisRunDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async retryRun(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: RunPathParamsDto,
    @Body() body: AnalysisRunRetryBodyDto,
  ) {
    return this.service.retryRun(
      session,
      params.projectId,
      params.runId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("runs/:runId/replay")
  @RequireProjectPermission("requirements:analyze")
  @ApiOperation({
    operationId: "RequirementAnalysisController_replayRun",
    summary: "Create a replay run from a terminal source run",
  })
  @ZodResponse({
    status: 201,
    description: "Created replay run.",
    type: AnalysisRunDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async replayRun(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: RunPathParamsDto,
    @Body() body: AnalysisRunReplayBodyDto,
  ) {
    return this.service.replayRun(
      session,
      params.projectId,
      params.runId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Post("runs/:runId/reprocess")
  @RequireProjectPermission("requirements:analyze")
  @ApiOperation({
    operationId: "RequirementAnalysisController_reprocessRun",
    summary: "Create a reprocess run with explicit replacement policy/version inputs",
  })
  @ZodResponse({
    status: 201,
    description: "Created reprocess run.",
    type: AnalysisRunDetailResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  @ApiConflictErrorResponse()
  async reprocessRun(
    @CurrentSession() session: RequestSessionContext,
    @Req() request: AuditRequestCarrier,
    @Param() params: RunPathParamsDto,
    @Body() body: AnalysisRunReprocessBodyDto,
  ) {
    return this.service.reprocessRun(
      session,
      params.projectId,
      params.runId,
      body,
      resolveAuditRequestContext(session, request),
    );
  }

  @Get("runs/:runId/stages")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listStages",
    summary: "List analysis stages for a run",
  })
  @ZodResponse({ status: 200, description: "Run stages.", type: AnalysisStageListResponseDto })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiNotFoundErrorResponse()
  async listStages(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunPathParamsDto,
    @Query() query: AnalysisStageListQueryDto,
  ) {
    return this.service.listStages(session, params.projectId, params.runId, query);
  }

  @Get("runs/:runId/batches")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listBatches",
    summary: "List analysis batches for a run",
  })
  @ZodResponse({ status: 200, description: "Run batches.", type: AnalysisBatchListResponseDto })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiNotFoundErrorResponse()
  async listBatches(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunPathParamsDto,
    @Query() query: AnalysisBatchListQueryDto,
  ) {
    return this.service.listBatches(session, params.projectId, params.runId, query);
  }

  @Get("runs/:runId/requirements")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listRequirements",
    summary: "List requirement artifacts for a run",
  })
  @ZodResponse({
    status: 200,
    description: "Run requirement artifacts.",
    type: RequirementListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiNotFoundErrorResponse()
  async listRequirements(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunPathParamsDto,
    @Query() query: RequirementListQueryDto,
  ) {
    return this.service.listRequirements(session, params.projectId, params.runId, query);
  }

  @Get("runs/:runId/requirements/:requirementId")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_getRequirement",
    summary: "Get one requirement artifact by id",
  })
  @ZodResponse({
    status: 200,
    description: "Requirement artifact detail.",
    type: RequirementResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  async getRequirement(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunRequirementPathParamsDto,
  ) {
    return this.service.getRequirement(
      session,
      params.projectId,
      params.runId,
      params.requirementId,
    );
  }

  @Get("runs/:runId/delivery-items")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listDeliveryItems",
    summary: "List delivery-item artifacts for a run",
  })
  @ZodResponse({
    status: 200,
    description: "Run delivery-item artifacts.",
    type: DeliveryItemListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiNotFoundErrorResponse()
  async listDeliveryItems(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunPathParamsDto,
    @Query() query: DeliveryItemListQueryDto,
  ) {
    return this.service.listDeliveryItems(session, params.projectId, params.runId, query);
  }

  @Get("runs/:runId/delivery-items/:itemId")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_getDeliveryItem",
    summary: "Get one delivery-item artifact by id",
  })
  @ZodResponse({
    status: 200,
    description: "Delivery-item artifact detail.",
    type: DeliveryItemResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  async getDeliveryItem(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunDeliveryItemPathParamsDto,
  ) {
    return this.service.getDeliveryItem(session, params.projectId, params.runId, params.itemId);
  }

  @Get("runs/:runId/coverage")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listCoverage",
    summary: "List coverage matrix entries for a run",
  })
  @ZodResponse({
    status: 200,
    description: "Coverage matrix entries.",
    type: CoverageListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiNotFoundErrorResponse()
  async listCoverage(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunPathParamsDto,
    @Query() query: CoverageListQueryDto,
  ) {
    return this.service.listCoverage(session, params.projectId, params.runId, query);
  }

  @Get("runs/:runId/citations")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listCitations",
    summary: "List citations for a run",
  })
  @ZodResponse({ status: 200, description: "Run citations.", type: CitationListResponseDto })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiNotFoundErrorResponse()
  async listCitations(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunPathParamsDto,
    @Query() query: CitationListQueryDto,
  ) {
    return this.service.listCitations(session, params.projectId, params.runId, query);
  }

  @Get("runs/:runId/evidence/:citationId")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_getCitationEvidence",
    summary: "Get citation evidence details for a run citation",
  })
  @ZodResponse({
    status: 200,
    description: "Citation evidence detail.",
    type: CitationEvidenceResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiNotFoundErrorResponse()
  @ApiValidationErrorResponse()
  async getCitationEvidence(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunCitationPathParamsDto,
  ) {
    return this.service.getCitationEvidence(
      session,
      params.projectId,
      params.runId,
      params.citationId,
    );
  }

  @Get("runs/:runId/traceability")
  @RequireProjectPermission("requirements:read")
  @ApiOperation({
    operationId: "RequirementAnalysisController_listTraceability",
    summary: "List traceability links associated with a run",
  })
  @ZodResponse({
    status: 200,
    description: "Traceability links.",
    type: TraceabilityListResponseDto,
  })
  @ApiAuthenticationErrorResponse()
  @ApiForbiddenErrorResponse()
  @ApiValidationErrorResponse()
  @ApiNotFoundErrorResponse()
  async listTraceability(
    @CurrentSession() session: RequestSessionContext,
    @Param() params: RunPathParamsDto,
    @Query() query: TraceabilityListQueryDto,
  ) {
    return this.service.listTraceability(session, params.projectId, params.runId, query);
  }
}
