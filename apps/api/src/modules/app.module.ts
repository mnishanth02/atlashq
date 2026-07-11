import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ZodSerializerInterceptor } from "nestjs-zod";
import { AuditModule } from "../audit/audit.module.js";
import { AuthenticatedGuard } from "../auth/authenticated.guard.js";
import { SessionResolutionMiddleware } from "../auth/session.middleware.js";
import { ClientsModule } from "../features/clients/clients.module.js";
import { OrganizationUsersModule } from "../features/organization-users/organization-users.module.js";
import { ProjectsModule } from "../features/projects/projects.module.js";
import { SourceDocumentsModule } from "../features/source-documents/source-documents.module.js";
import { type ApiRuntime, NULL_RUNTIME } from "../runtime/runtime.js";
import { RuntimeModule } from "../runtime/runtime.module.js";
import { ProjectAuthorizationGuard } from "../security/project-authorization.guard.js";
import { ApiExceptionFilter } from "../validation/api-exception.filter.js";
import { createStrictZodValidationPipe } from "../validation/dto-conventions.js";
import { HealthController } from "./health.controller.js";
import { MeController } from "./me.controller.js";
import { OrganizationController } from "./organization.controller.js";

@Module({})
export class AppModule implements NestModule {
  /**
   * Compose the application module from an already-built runtime. Passing
   * {@link NULL_RUNTIME} (the default) keeps the module free of live database or
   * auth connections, which is what the OpenAPI generator relies on. `main.ts`
   * supplies the real, lazily-created auth instance and database client.
   *
   * `RuntimeModule` is `@Global()`, so every independently authored feature
   * module can inject `AUTH_INSTANCE`, `DATABASE_CLIENT`, `PROJECT_ACCESS_QUERIES`,
   * and `AUTH_DIRECTORY` without importing `AppModule` internals. `AuditModule` is
   * imported here so it, and the `AuditWriter` it exports, is available to any
   * feature module composed under this application without each one re-declaring
   * the provider.
   */
  static forRoot(runtime: ApiRuntime = NULL_RUNTIME): DynamicModule {
    return {
      module: AppModule,
      imports: [
        RuntimeModule.forRoot(runtime),
        AuditModule,
        ClientsModule,
        ProjectsModule,
        OrganizationUsersModule,
        SourceDocumentsModule,
      ],
      controllers: [HealthController, MeController, OrganizationController],
      providers: [
        { provide: APP_PIPE, useClass: createStrictZodValidationPipe() },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        AuthenticatedGuard,
        ProjectAuthorizationGuard,
        SessionResolutionMiddleware,
      ],
      exports: [RuntimeModule, AuditModule],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionResolutionMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
