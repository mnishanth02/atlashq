import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { createUuidPathParamsSchema, paginationQuerySchema } from "@atlashq/validators";
import {
  Controller,
  createParamDecorator,
  type ExecutionContext,
  Get,
  Module,
  Param,
  Query,
} from "@nestjs/common";
import { APP_INTERCEPTOR, APP_PIPE, NestFactory } from "@nestjs/core";
import { ZodSerializerInterceptor } from "nestjs-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { applyGlobalApiPrefix } from "../swagger.js";
import {
  apiErrorCodes,
  createStrictZodValidationPipe,
  createZodDto,
  ZodResponse,
} from "./dto-conventions.js";

const responseSchema = z
  .object({
    cursor: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(100),
  })
  .strict();

const uuidEchoSchema = z.object({ id: z.uuid() }).strict();

class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
class PaginationResponseDto extends createZodDto(responseSchema) {}
class UuidPathParamsDto extends createZodDto(createUuidPathParamsSchema("id")) {}
class UuidEchoDto extends createZodDto(uuidEchoSchema) {}

/** Stand-in for `@CurrentSession()`: a custom decorator whose value erases to `Object`. */
const CustomContext = createParamDecorator((_data: unknown, _ctx: ExecutionContext) => ({
  ok: true,
}));

@Controller("validation-contracts")
class ValidationContractsController {
  @Get("pagination")
  @ZodResponse({
    description: "Echo parsed pagination query values.",
    status: 200,
    type: PaginationResponseDto,
  })
  getPagination(@Query() query: PaginationQueryDto) {
    return query;
  }

  @Get("custom-context")
  getCustomContext(@CustomContext() context: { ok: boolean }) {
    return context;
  }

  @Get(":id")
  @ZodResponse({
    description: "Echo validated UUID params.",
    status: 200,
    type: UuidEchoDto,
  })
  getById(@Param() params: UuidPathParamsDto) {
    return params;
  }
}

@Module({
  controllers: [ValidationContractsController],
  providers: [
    { provide: APP_PIPE, useClass: createStrictZodValidationPipe() },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
class ValidationContractsModule {}

describe("nestjs-zod DTO conventions", () => {
  let baseUrl = "";
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    app = await NestFactory.create(ValidationContractsModule, { logger: false });
    applyGlobalApiPrefix(app);
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("coerces query strings and serializes a Zod response", async () => {
    const response = await fetch(`${baseUrl}/api/v1/validation-contracts/pagination?limit=7`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ limit: 7 });
  });

  it("rejects unknown query keys on strict schemas", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/validation-contracts/pagination?limit=7&unexpected=value`,
    );

    expect(response.status).toBe(400);
  });

  it("passes custom-decorator params through the strict pipe instead of 500ing", async () => {
    // Regression guard: with strictSchemaDeclaration, an unwrapped nestjs-zod pipe throws
    // ZodSchemaDeclarationException for any param whose reflected metatype is not a Zod DTO
    // (custom decorators / @Req erase to Object), turning every authenticated endpoint into a 500.
    const response = await fetch(`${baseUrl}/api/v1/validation-contracts/custom-context`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("validates reusable UUID path params", async () => {
    const validId = "24c42e4d-aa54-4b9c-9e2d-4ec72c90a1fe";

    const okResponse = await fetch(`${baseUrl}/api/v1/validation-contracts/${validId}`);
    expect(okResponse.status).toBe(200);
    expect(await okResponse.json()).toEqual({ id: validId });

    const invalidResponse = await fetch(`${baseUrl}/api/v1/validation-contracts/not-a-uuid`);
    expect(invalidResponse.status).toBe(400);
  });
});

describe("module 2 source vault API error codes", () => {
  it("registers all stable SOURCE_* codes from the plan without altering existing codes", () => {
    expect(apiErrorCodes.sourceDuplicateConfirmationRequired).toBe(
      "SOURCE_DUPLICATE_CONFIRMATION_REQUIRED",
    );
    expect(apiErrorCodes.sourceUploadSessionExpired).toBe("SOURCE_UPLOAD_SESSION_EXPIRED");
    expect(apiErrorCodes.sourceUploadSessionAlreadyConfirmed).toBe(
      "SOURCE_UPLOAD_SESSION_ALREADY_CONFIRMED",
    );
    expect(apiErrorCodes.sourceFileTooLarge).toBe("SOURCE_FILE_TOO_LARGE");
    expect(apiErrorCodes.sourceUploadSizeMismatch).toBe("SOURCE_UPLOAD_SIZE_MISMATCH");
    expect(apiErrorCodes.sourceMimeMismatch).toBe("SOURCE_MIME_MISMATCH");
    expect(apiErrorCodes.sourceHashMismatch).toBe("SOURCE_HASH_MISMATCH");
    expect(apiErrorCodes.sourceInfected).toBe("SOURCE_INFECTED");
    expect(apiErrorCodes.sourceNotReady).toBe("SOURCE_NOT_READY");
    expect(apiErrorCodes.sourceSuperseded).toBe("SOURCE_SUPERSEDED");
    expect(apiErrorCodes.sourceArchived).toBe("SOURCE_ARCHIVED");
    expect(apiErrorCodes.sourceReferenceAttestationRequired).toBe(
      "SOURCE_REFERENCE_ATTESTATION_REQUIRED",
    );
    expect(apiErrorCodes.sourceReferenceRestricted).toBe("SOURCE_REFERENCE_RESTRICTED");
    expect(apiErrorCodes.sourceCaptureDisabled).toBe("SOURCE_CAPTURE_DISABLED");
    expect(apiErrorCodes.sourceCaptureUrlBlocked).toBe("SOURCE_CAPTURE_URL_BLOCKED");
    expect(apiErrorCodes.sourceProcessingNotRetryable).toBe("SOURCE_PROCESSING_NOT_RETRYABLE");
    expect(apiErrorCodes.sourceStorageUnavailable).toBe("SOURCE_STORAGE_UNAVAILABLE");
    expect(apiErrorCodes.validationFailed).toBe("VALIDATION_ERROR");
  });

  it("keeps every error code value unique", () => {
    const values = Object.values(apiErrorCodes);
    expect(new Set(values).size).toBe(values.length);
  });
});
