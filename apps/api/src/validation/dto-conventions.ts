import { apiErrorSchema } from "@atlashq/validators";
import { type ArgumentMetadata, applyDecorators, Injectable, type Type } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";
import { createZodDto, createZodValidationPipe, ZodResponse, ZodSerializerDto } from "nestjs-zod";
import type { z } from "zod";

export { createZodDto, ZodResponse, ZodSerializerDto };

/**
 * Built-in JavaScript constructors that never carry a Zod DTO schema. Route
 * parameters resolved by custom decorators (`@CurrentSession`, `@Req`, ...) erase
 * to one of these (an interface becomes `Object`, an id string becomes `String`),
 * so they must pass through untouched instead of tripping the strict pipe.
 */
const NATIVE_METATYPES = new Set<unknown>([String, Boolean, Number, Array, Object]);

function isNonValidatableMetatype(metatype: ArgumentMetadata["metatype"]): boolean {
  return metatype === undefined || NATIVE_METATYPES.has(metatype);
}

/**
 * Strict Zod validation pipe. `strictSchemaDeclaration` makes nestjs-zod throw when
 * a *validated* input (a `@Body`/`@Query`/`@Param` argument) is not a Zod DTO, which
 * keeps DTO usage honest. On its own, though, that strict mode also throws for every
 * non-DTO argument — including values produced by custom param decorators and `@Req`,
 * whose reflected metatype is a native type like `Object` — turning otherwise valid
 * authenticated requests into 500s. Mirroring Nest's built-in `ValidationPipe`, this
 * wrapper passes those native/custom arguments through and only delegates real
 * DTO-bound inputs to the strict pipe.
 */
export function createStrictZodValidationPipe(): Type {
  const StrictZodValidationPipe = createZodValidationPipe({ strictSchemaDeclaration: true });

  @Injectable()
  class ApiZodValidationPipe extends StrictZodValidationPipe {
    override transform(value: unknown, metadata: ArgumentMetadata): unknown {
      if (metadata.type === "custom" || isNonValidatableMetatype(metadata.metatype)) {
        return value;
      }

      return super.transform(value, metadata);
    }
  }

  return ApiZodValidationPipe;
}

export class ApiErrorDto extends createZodDto(apiErrorSchema) {}

export type ApiErrorResponseBody = z.infer<typeof apiErrorSchema>;

export const apiErrorCodes = {
  validationFailed: "VALIDATION_ERROR",
  badRequest: "BAD_REQUEST",
  authenticationRequired: "AUTHENTICATION_REQUIRED",
  accessDenied: "ACCESS_DENIED",
  resourceNotFound: "RESOURCE_NOT_FOUND",
  conflict: "CONFLICT",
  httpError: "HTTP_ERROR",
  internalServerError: "INTERNAL_SERVER_ERROR",
  // Module 2: Source Document Vault stable error codes (module-02 §11).
  sourceDuplicateConfirmationRequired: "SOURCE_DUPLICATE_CONFIRMATION_REQUIRED",
  sourceUploadSessionExpired: "SOURCE_UPLOAD_SESSION_EXPIRED",
  sourceUploadSessionAlreadyConfirmed: "SOURCE_UPLOAD_SESSION_ALREADY_CONFIRMED",
  sourceFileTooLarge: "SOURCE_FILE_TOO_LARGE",
  sourceUploadSizeMismatch: "SOURCE_UPLOAD_SIZE_MISMATCH",
  sourceMimeMismatch: "SOURCE_MIME_MISMATCH",
  sourceHashMismatch: "SOURCE_HASH_MISMATCH",
  sourceInfected: "SOURCE_INFECTED",
  sourceNotReady: "SOURCE_NOT_READY",
  sourceSuperseded: "SOURCE_SUPERSEDED",
  sourceArchived: "SOURCE_ARCHIVED",
  sourceReferenceAttestationRequired: "SOURCE_REFERENCE_ATTESTATION_REQUIRED",
  sourceReferenceRestricted: "SOURCE_REFERENCE_RESTRICTED",
  sourceCaptureDisabled: "SOURCE_CAPTURE_DISABLED",
  sourceCaptureUrlBlocked: "SOURCE_CAPTURE_URL_BLOCKED",
  sourceProcessingNotRetryable: "SOURCE_PROCESSING_NOT_RETRYABLE",
  sourceStorageUnavailable: "SOURCE_STORAGE_UNAVAILABLE",
  // Module 3: AI Requirement Analyzer stable error codes (module-03 §12.3).
  aiAnalysisDisabled: "AI_ANALYSIS_DISABLED",
  aiProviderNotApproved: "AI_PROVIDER_NOT_APPROVED",
  aiProviderPolicyInactive: "AI_PROVIDER_POLICY_INACTIVE",
  aiProviderPolicyMismatch: "AI_PROVIDER_POLICY_MISMATCH",
  aiRunBudgetExceeded: "AI_RUN_BUDGET_EXCEEDED",
  aiRunConcurrencyExceeded: "AI_RUN_CONCURRENCY_EXCEEDED",
  aiRunNotCancelable: "AI_RUN_NOT_CANCELABLE",
  aiRunNotRetryable: "AI_RUN_NOT_RETRYABLE",
  aiRunSnapshotEmpty: "AI_RUN_SNAPSHOT_EMPTY",
  aiRunSourceNotEligible: "AI_RUN_SOURCE_NOT_ELIGIBLE",
  aiRunSourceSnapshotStale: "AI_RUN_SOURCE_SNAPSHOT_STALE",
  aiRunSchemaValidationFailed: "AI_RUN_SCHEMA_VALIDATION_FAILED",
  aiRunSemanticValidationFailed: "AI_RUN_SEMANTIC_VALIDATION_FAILED",
  aiRunCitationVerificationFailed: "AI_RUN_CITATION_VERIFICATION_FAILED",
  aiRunPromptInjectionGuardTriggered: "AI_RUN_PROMPT_INJECTION_GUARD_TRIGGERED",
  aiRunTransientProviderFailure: "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
  aiRunProviderTimeout: "AI_RUN_PROVIDER_TIMEOUT",
  aiRunProviderRateLimited: "AI_RUN_PROVIDER_RATE_LIMITED",
  aiRunReferenceFeatureExtractionDisabled: "AI_RUN_REFERENCE_FEATURE_EXTRACTION_DISABLED",
  aiArtifactNotFound: "AI_ARTIFACT_NOT_FOUND",
  aiEvidenceAccessDenied: "AI_EVIDENCE_ACCESS_DENIED",
} as const;

export type ApiErrorCode = (typeof apiErrorCodes)[keyof typeof apiErrorCodes];

type ApiErrorDecoratorOptions = {
  status: number;
  code: ApiErrorCode;
  description: string;
  message?: string;
};

type StatusSpecificApiErrorDecoratorOptions = {
  code?: ApiErrorCode;
  description: string;
  message?: string;
};

function buildApiErrorExample({
  status,
  code,
  description,
  message,
}: ApiErrorDecoratorOptions): ApiErrorResponseBody {
  return {
    statusCode: status,
    code,
    message: message ?? description,
  };
}

export function ApiErrorResponse({ status, code, description, message }: ApiErrorDecoratorOptions) {
  return applyDecorators(
    ApiExtraModels(ApiErrorDto),
    ApiResponse({
      status,
      description: `${description} Error code: ${code}.`,
      content: {
        "application/json": {
          schema: { $ref: getSchemaPath(ApiErrorDto) },
          example: buildApiErrorExample({
            status,
            code,
            description,
            ...(message ? { message } : {}),
          }),
        },
      },
    }),
  );
}

export function ApiValidationErrorResponse(
  options: StatusSpecificApiErrorDecoratorOptions = {
    description: "Request validation failed.",
  },
) {
  return ApiErrorResponse({
    status: 400,
    code: options.code ?? apiErrorCodes.validationFailed,
    description: options.description,
    ...(options.message ? { message: options.message } : {}),
  });
}

export function ApiAuthenticationErrorResponse(
  options: StatusSpecificApiErrorDecoratorOptions = {
    description: "Authentication required.",
  },
) {
  return ApiErrorResponse({
    status: 401,
    code: options.code ?? apiErrorCodes.authenticationRequired,
    description: options.description,
    ...(options.message ? { message: options.message } : {}),
  });
}

export function ApiForbiddenErrorResponse(
  options: StatusSpecificApiErrorDecoratorOptions = {
    description: "Access denied.",
  },
) {
  return ApiErrorResponse({
    status: 403,
    code: options.code ?? apiErrorCodes.accessDenied,
    description: options.description,
    ...(options.message ? { message: options.message } : {}),
  });
}

export function ApiNotFoundErrorResponse(
  options: StatusSpecificApiErrorDecoratorOptions = {
    description: "Resource not found.",
  },
) {
  return ApiErrorResponse({
    status: 404,
    code: options.code ?? apiErrorCodes.resourceNotFound,
    description: options.description,
    ...(options.message ? { message: options.message } : {}),
  });
}

export function ApiConflictErrorResponse(
  options: StatusSpecificApiErrorDecoratorOptions = {
    description: "The request conflicts with the current resource state.",
  },
) {
  return ApiErrorResponse({
    status: 409,
    code: options.code ?? apiErrorCodes.conflict,
    description: options.description,
    ...(options.message ? { message: options.message } : {}),
  });
}

export function ApiInternalServerErrorResponse(
  options: StatusSpecificApiErrorDecoratorOptions = {
    description: "An unexpected internal error occurred.",
  },
) {
  return ApiErrorResponse({
    status: 500,
    code: options.code ?? apiErrorCodes.internalServerError,
    description: options.description,
    message: options.message ?? "Internal server error.",
  });
}
