import "reflect-metadata";
import { loadApiEnv } from "@atlashq/config";
import { RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./modules/app.module.js";
import { createPinoRequestLogger } from "./observability/request-logger.js";

async function bootstrap() {
  const env = loadApiEnv(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "api/auth", method: RequestMethod.ALL },
      { path: "api/auth/{*path}", method: RequestMethod.ALL },
    ],
  });
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.use(createPinoRequestLogger());

  const openApiConfig = new DocumentBuilder()
    .setTitle("AtlasHQ API")
    .setDescription("Phase 2 placeholder REST API contract. Operation IDs use Controller_method.")
    .setVersion("0.0.0")
    .addServer("http://localhost:3000", "Local development")
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });
  document.openapi = "3.1.0";
  SwaggerModule.setup("api/v1/docs", app, document);

  await app.listen(env.PORT);
}

void bootstrap();
