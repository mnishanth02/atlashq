import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { AuthenticatedGuard } from "../../auth/authenticated.guard.js";
import { ProjectAuthorizationGuard } from "../../security/project-authorization.guard.js";
import { SourceDocumentsController } from "./source-documents.controller.js";
import { DrizzleSourceDocumentsRepository } from "./source-documents.repository.js";
import { SourceDocumentsService } from "./source-documents.service.js";
import { SOURCE_DOCUMENTS_REPOSITORY } from "./source-documents.tokens.js";

@Module({
  imports: [AuditModule],
  controllers: [SourceDocumentsController],
  providers: [
    AuthenticatedGuard,
    ProjectAuthorizationGuard,
    SourceDocumentsService,
    { provide: SOURCE_DOCUMENTS_REPOSITORY, useClass: DrizzleSourceDocumentsRepository },
  ],
  exports: [SourceDocumentsService, SOURCE_DOCUMENTS_REPOSITORY],
})
export class SourceDocumentsModule {}
