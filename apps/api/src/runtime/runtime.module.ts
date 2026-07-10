import { type DynamicModule, Global, Module } from "@nestjs/common";
import { DrizzleAuthDirectory } from "../auth/auth-directory.js";
import { DrizzleProjectAccessQueries } from "../security/project-access.queries.js";
import {
  type ApiRuntime,
  AUTH_DIRECTORY,
  AUTH_INSTANCE,
  DATABASE_CLIENT,
  NULL_RUNTIME,
  PROJECT_ACCESS_QUERIES,
} from "./runtime.js";

/**
 * Global runtime module composed once (from `main.ts`'s real runtime, or the
 * default {@link NULL_RUNTIME} for offline OpenAPI generation) and imported by
 * `AppModule.forRoot`. Marked `@Global()` so every independently authored
 * feature module can inject `AUTH_INSTANCE`, `DATABASE_CLIENT`,
 * `PROJECT_ACCESS_QUERIES`, or `AUTH_DIRECTORY` directly, without adding this
 * module to its own `imports` and without touching `AppModule` internals.
 */
@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module convention requires a class for the @Module decorator.
export class RuntimeModule {
  static forRoot(runtime: ApiRuntime = NULL_RUNTIME): DynamicModule {
    return {
      module: RuntimeModule,
      providers: [
        { provide: AUTH_INSTANCE, useValue: runtime.auth },
        { provide: DATABASE_CLIENT, useValue: runtime.db },
        {
          provide: PROJECT_ACCESS_QUERIES,
          useFactory: () => new DrizzleProjectAccessQueries(runtime.db),
        },
        {
          provide: AUTH_DIRECTORY,
          useFactory: () => new DrizzleAuthDirectory(runtime.db),
        },
      ],
      exports: [AUTH_INSTANCE, DATABASE_CLIENT, PROJECT_ACCESS_QUERIES, AUTH_DIRECTORY],
    };
  }
}
