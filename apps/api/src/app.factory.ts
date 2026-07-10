import { type Auth, betterAuthExpressWildcardPath, createAuthNodeHandler } from "@atlashq/auth";
import type { Database } from "@atlashq/db";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express, { type Express } from "express";
import { AppModule } from "./modules/app.module.js";
import { createPinoRequestLogger } from "./observability/request-logger.js";
import { applyGlobalApiPrefix, buildOpenApiDocument, setupSwaggerUi } from "./swagger.js";

/**
 * Options for {@link createApiApp}. `auth` and `db` are the lazily-created, real
 * Better Auth instance and Drizzle database supplied by `main.ts` (or an
 * integration test harness). `webOrigin` drives the CORS allow-list.
 */
export type CreateApiAppOptions = {
  auth: Auth;
  db: Database;
  webOrigin: string;
  /** Build and mount the Swagger UI. Defaults to `true` to match production. */
  setupSwagger?: boolean;
};

/**
 * Build the fully-configured Nest application with the exact middleware ordering
 * the production server relies on. This is the single source of truth for how
 * CORS, request logging, the Better Auth raw handler, the body parsers, the
 * global API prefix, and the OpenAPI/Swagger surface are wired together, so the
 * live server (`main.ts`) and the Supertest-driven integration tests always
 * exercise an identical stack.
 *
 * The returned app is **not** initialized or listening: `main.ts` calls
 * `app.listen()` and the integration harness calls `app.init()`.
 */
export async function createApiApp(options: CreateApiAppOptions): Promise<NestExpressApplication> {
  const { auth, db, webOrigin, setupSwagger = true } = options;

  // Disable Nest's body parser so Better Auth receives the raw request body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot({ auth, db }), {
    bodyParser: false,
    bufferLogs: true,
  });

  // CORS and request logging must run *before* the auth handler so auth
  // responses are logged and carry CORS headers.
  app.enableCors({ origin: webOrigin, credentials: true });
  app.use(createPinoRequestLogger());

  // Mount Better Auth at /api/auth/* on the raw Express instance *before* the
  // JSON/urlencoded body parsers — Better Auth consumes the raw body itself.
  const expressApp: Express = app.getHttpAdapter().getInstance();
  expressApp.all(betterAuthExpressWildcardPath, createAuthNodeHandler(auth));

  // Restore body parsing for the Nest endpoints that follow.
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  applyGlobalApiPrefix(app);

  if (setupSwagger) {
    const document = buildOpenApiDocument(app);
    setupSwaggerUi(app, document);
  }

  return app;
}
