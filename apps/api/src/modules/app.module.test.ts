import "reflect-metadata";
import { type MiddlewareConsumer, RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditWriter } from "../audit/audit-writer.js";
import { AuthenticatedGuard } from "../auth/authenticated.guard.js";
import { SessionResolutionMiddleware } from "../auth/session.middleware.js";
import { ClientsController } from "../features/clients/clients.controller.js";
import { ClientsService } from "../features/clients/clients.service.js";
import { OrganizationUsersController } from "../features/organization-users/organization-users.controller.js";
import { OrganizationUsersService } from "../features/organization-users/organization-users.service.js";
import { ProjectsController } from "../features/projects/projects.controller.js";
import { ProjectsService } from "../features/projects/projects.service.js";
import {
  AUTH_DIRECTORY,
  AUTH_INSTANCE,
  DATABASE_CLIENT,
  PROJECT_ACCESS_QUERIES,
} from "../runtime/runtime.js";
import { ProjectAuthorizationGuard } from "../security/project-authorization.guard.js";
import { AppModule } from "./app.module.js";

const GUARDS_METADATA = "__guards__";

describe("AppModule", () => {
  it("applies session resolution middleware to every first-party Nest route", () => {
    const forRoutes = vi.fn();
    const apply = vi.fn(() => ({ forRoutes }));
    const consumer = { apply } as unknown as MiddlewareConsumer;

    new AppModule().configure(consumer);

    expect(apply).toHaveBeenCalledWith(SessionResolutionMiddleware);
    expect(forRoutes).toHaveBeenCalledWith({ path: "*", method: RequestMethod.ALL });
  });

  describe("forRoot()", () => {
    let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;

    afterEach(async () => {
      await app?.close();
      app = undefined;
    });

    it("defaults to the null runtime and resolves every runtime token through the global RuntimeModule", async () => {
      app = await NestFactory.createApplicationContext(AppModule.forRoot(), { logger: false });

      expect(app.get(AUTH_INSTANCE)).toBeNull();
      expect(app.get(DATABASE_CLIENT)).toBeNull();
      expect(app.get(PROJECT_ACCESS_QUERIES)).toBeDefined();
      expect(app.get(AUTH_DIRECTORY)).toBeDefined();
    });

    it("compiles the client and project feature graphs with the null runtime", async () => {
      app = await NestFactory.createApplicationContext(AppModule.forRoot(), { logger: false });

      expect(app.get(ClientsController)).toBeInstanceOf(ClientsController);
      expect(app.get(ClientsService)).toBeInstanceOf(ClientsService);
      expect(app.get(ProjectsController)).toBeInstanceOf(ProjectsController);
      expect(app.get(ProjectsService)).toBeInstanceOf(ProjectsService);
    });

    it("compiles the organization-users feature graph with the null runtime", async () => {
      app = await NestFactory.createApplicationContext(AppModule.forRoot(), { logger: false });

      expect(app.get(OrganizationUsersController)).toBeInstanceOf(OrganizationUsersController);
      expect(app.get(OrganizationUsersService)).toBeInstanceOf(OrganizationUsersService);
    });

    it("makes AuditModule's AuditWriter available without a feature module re-declaring it", async () => {
      app = await NestFactory.createApplicationContext(AppModule.forRoot(), { logger: false });

      expect(app.get(AuditWriter)).toBeInstanceOf(AuditWriter);
    });
  });

  it("orders authentication before project authorization on protected project routes", () => {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, ProjectsController) as unknown[];
    const methodGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      ProjectsController.prototype.restoreProject,
    ) as unknown[];

    expect(classGuards).toEqual([AuthenticatedGuard]);
    expect(methodGuards).toEqual([ProjectAuthorizationGuard]);
  });
});
