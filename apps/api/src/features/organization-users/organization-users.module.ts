import { Module } from "@nestjs/common";
import { AuthenticatedGuard } from "../../auth/authenticated.guard.js";
import { OrganizationUsersController } from "./organization-users.controller.js";
import { DrizzleOrganizationUsersRepository } from "./organization-users.repository.js";
import { OrganizationUsersService } from "./organization-users.service.js";
import { ORGANIZATION_USERS_REPOSITORY } from "./organization-users.tokens.js";

@Module({
  controllers: [OrganizationUsersController],
  providers: [
    AuthenticatedGuard,
    OrganizationUsersService,
    { provide: ORGANIZATION_USERS_REPOSITORY, useClass: DrizzleOrganizationUsersRepository },
  ],
  exports: [OrganizationUsersService, ORGANIZATION_USERS_REPOSITORY],
})
export class OrganizationUsersModule {}
