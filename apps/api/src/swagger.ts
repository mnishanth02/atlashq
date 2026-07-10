import { betterAuthBasePath } from "@atlashq/auth";
import { type INestApplication, RequestMethod } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

/** Global prefix applied to every first-party REST endpoint. */
export const API_GLOBAL_PREFIX = "api/v1";

/** Path where the Swagger UI is served. */
export const SWAGGER_UI_PATH = "api/v1/docs";

const authPrefix = betterAuthBasePath.replace(/^\/+/, "");

/**
 * Apply the `api/v1` global prefix while excluding the Better Auth mount so its
 * Node handler keeps serving requests at `/api/auth/*` unprefixed.
 */
export function applyGlobalApiPrefix(app: INestApplication): void {
  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: [
      { path: authPrefix, method: RequestMethod.ALL },
      { path: `${authPrefix}/{*path}`, method: RequestMethod.ALL },
    ],
  });
}

/**
 * Build the OpenAPI document. Shared by the live server (`main.ts`) and the
 * offline generator (`openapi.ts`) so the served contract and the committed
 * artifact can never drift.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("AtlasHQ API")
    .setDescription("AtlasHQ REST API contract. Operation IDs use Controller_method.")
    .setVersion("0.0.0")
    .addServer("http://localhost:3000", "Local development")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });
  document.openapi = "3.1.0";

  return cleanupOpenApiDoc(document, { version: "3.1" });
}

/** Mount the Swagger UI for a built document. */
export function setupSwaggerUi(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup(SWAGGER_UI_PATH, app, document);
}
