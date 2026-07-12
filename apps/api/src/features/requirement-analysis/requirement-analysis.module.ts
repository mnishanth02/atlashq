import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { AuthenticatedGuard } from "../../auth/authenticated.guard.js";
import { ProjectAuthorizationGuard } from "../../security/project-authorization.guard.js";
import {
  RequirementAnalysisController,
  RequirementAnalysisOrganizationController,
} from "./requirement-analysis.controller.js";
import { DrizzleRequirementAnalysisRepository } from "./requirement-analysis.repository.js";
import { RequirementAnalysisService } from "./requirement-analysis.service.js";
import { REQUIREMENT_ANALYSIS_REPOSITORY } from "./requirement-analysis.tokens.js";

@Module({
  imports: [AuditModule],
  controllers: [RequirementAnalysisOrganizationController, RequirementAnalysisController],
  providers: [
    AuthenticatedGuard,
    ProjectAuthorizationGuard,
    RequirementAnalysisService,
    { provide: REQUIREMENT_ANALYSIS_REPOSITORY, useClass: DrizzleRequirementAnalysisRepository },
  ],
  exports: [RequirementAnalysisService, REQUIREMENT_ANALYSIS_REPOSITORY],
})
export class RequirementAnalysisModule {}
