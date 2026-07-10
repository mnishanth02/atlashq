import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { apiErrorSchema } from "@atlashq/validators";
import {
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Module,
  NotFoundException,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { APP_FILTER, APP_PIPE, NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiExceptionFilter } from "./api-exception.filter.js";
import { createStrictZodValidationPipe, createZodDto } from "./dto-conventions.js";

class ValidationQueryDto extends createZodDto(
  z.object({ limit: z.coerce.number().int().min(1) }).strict(),
) {}

@Controller("error-contracts")
class ErrorContractsController {
  @Get("validation")
  validation(@Query() query: ValidationQueryDto) {
    return query;
  }

  @Get("unauthorized")
  unauthorized(): never {
    throw new UnauthorizedException("Authentication required.");
  }

  @Get("forbidden")
  forbidden(): never {
    throw new ForbiddenException("Access denied.");
  }

  @Get("not-found")
  notFound(): never {
    throw new NotFoundException("Widget not found.");
  }

  @Get("conflict")
  conflict(): never {
    throw new ConflictException("Widget already exists.");
  }

  @Get("explicit")
  explicit(): never {
    throw new HttpException({ code: "TEAPOT", message: "Short and stout." }, 418);
  }

  @Get("service-validation")
  serviceValidation(): never {
    throw z.object({ clientId: z.string().uuid() }).parse({ clientId: null });
  }

  @Get("failure")
  failure(): never {
    throw new Error("database password leaked");
  }
}

@Module({
  controllers: [ErrorContractsController],
  providers: [
    { provide: APP_PIPE, useClass: createStrictZodValidationPipe() },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
class ErrorContractsModule {}

describe("ApiExceptionFilter", () => {
  let baseUrl = "";
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    app = await NestFactory.create(ErrorContractsModule, { logger: false });
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/error-contracts`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("maps Zod validation failures to the stable envelope with details", async () => {
    const response = await fetch(`${baseUrl}/validation?limit=0`, {
      headers: { "x-correlation-id": "corr-validation" },
    });
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      correlationId: "corr-validation",
    });
    expect(body.details).toEqual([expect.objectContaining({ path: ["limit"], code: "too_small" })]);
  });

  it("maps service-layer Zod errors to the stable validation envelope", async () => {
    const response = await fetch(`${baseUrl}/service-validation`, {
      headers: { "x-correlation-id": "corr-service-validation" },
    });
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      correlationId: "corr-service-validation",
    });
    expect(body.details).toEqual([
      expect.objectContaining({ path: ["clientId"], code: "invalid_type" }),
    ]);
  });

  it.each([
    ["unauthorized", 401, "AUTHENTICATION_REQUIRED"],
    ["forbidden", 403, "ACCESS_DENIED"],
    ["not-found", 404, "RESOURCE_NOT_FOUND"],
    ["conflict", 409, "CONFLICT"],
  ])("maps %s to a stable generic status code", async (route, status, code) => {
    const response = await fetch(`${baseUrl}/${route}`);
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(status);
    expect(body).toMatchObject({ statusCode: status, code });
  });

  it("preserves an explicit HttpException status and canonical code", async () => {
    const response = await fetch(`${baseUrl}/explicit`);

    expect(response.status).toBe(418);
    expect(apiErrorSchema.parse(await response.json())).toMatchObject({
      statusCode: 418,
      code: "TEAPOT",
      message: "Short and stout.",
    });
  });

  it("does not leak internal exception messages", async () => {
    const response = await fetch(`${baseUrl}/failure`, {
      headers: { "x-correlation-id": "corr-failure" },
    });
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error.",
      correlationId: "corr-failure",
    });
    expect(JSON.stringify(body)).not.toContain("password");
  });
});
