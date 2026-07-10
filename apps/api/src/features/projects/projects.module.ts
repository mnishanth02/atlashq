import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { AuthenticatedGuard } from "../../auth/authenticated.guard.js";
import { ProjectAuthorizationGuard } from "../../security/project-authorization.guard.js";
import { ProjectsController } from "./projects.controller.js";
import { DrizzleProjectsRepository } from "./projects.repository.js";
import { ProjectsService } from "./projects.service.js";
import { PROJECTS_REPOSITORY } from "./projects.tokens.js";

@Module({
  imports: [AuditModule],
  controllers: [ProjectsController],
  providers: [
    AuthenticatedGuard,
    ProjectAuthorizationGuard,
    ProjectsService,
    { provide: PROJECTS_REPOSITORY, useClass: DrizzleProjectsRepository },
  ],
  exports: [ProjectsService, PROJECTS_REPOSITORY],
})
export class ProjectsModule {}
