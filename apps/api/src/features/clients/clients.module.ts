import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { AuthenticatedGuard } from "../../auth/authenticated.guard.js";
import { ClientsController } from "./clients.controller.js";
import { DrizzleClientsRepository } from "./clients.repository.js";
import { ClientsService } from "./clients.service.js";
import { CLIENTS_REPOSITORY } from "./clients.tokens.js";

@Module({
  imports: [AuditModule],
  controllers: [ClientsController],
  providers: [
    AuthenticatedGuard,
    ClientsService,
    { provide: CLIENTS_REPOSITORY, useClass: DrizzleClientsRepository },
  ],
  exports: [ClientsService, CLIENTS_REPOSITORY],
})
export class ClientsModule {}
