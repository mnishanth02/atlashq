import { correlationIdHeader } from "@atlashq/logger";
import {
  type ApiErrorDetail,
  type ApiErrorResponse,
  apiErrorDetailSchema,
} from "@atlashq/validators";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodValidationException } from "nestjs-zod";
import { ZodError, z } from "zod";
import { apiErrorCodes } from "./dto-conventions.js";

type ErrorRequest = Request & {
  id?: unknown;
  log?: {
    error: (context: unknown, message?: string) => void;
  };
};

type HttpExceptionBody = {
  code?: unknown;
  details?: unknown;
  message?: unknown;
};

type ZodIssueLike = {
  code?: unknown;
  message?: unknown;
  path?: unknown;
};

function statusCodeToErrorCode(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return apiErrorCodes.badRequest;
    case HttpStatus.UNAUTHORIZED:
      return apiErrorCodes.authenticationRequired;
    case HttpStatus.FORBIDDEN:
      return apiErrorCodes.accessDenied;
    case HttpStatus.NOT_FOUND:
      return apiErrorCodes.resourceNotFound;
    case HttpStatus.CONFLICT:
      return apiErrorCodes.conflict;
    default:
      return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
        ? apiErrorCodes.internalServerError
        : apiErrorCodes.httpError;
  }
}

function getHttpExceptionBody(exception: HttpException): HttpExceptionBody {
  const response = exception.getResponse();

  if (typeof response === "string") {
    return { message: response };
  }

  return response && typeof response === "object" ? (response as HttpExceptionBody) : {};
}

function getMessage(body: HttpExceptionBody, exception: HttpException): string {
  if (typeof body.message === "string" && body.message.trim().length > 0) {
    return body.message;
  }

  if (Array.isArray(body.message)) {
    const message = body.message.find(
      (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
    );
    if (message) {
      return message;
    }
  }

  return exception.message || "Request failed.";
}

function normalizePath(path: unknown): Array<string | number> {
  if (!Array.isArray(path) || path.length === 0) {
    return ["request"];
  }

  const normalized = path
    .map((segment) => (typeof segment === "number" ? segment : String(segment)))
    .filter((segment) => typeof segment === "number" || segment.length > 0);

  return normalized.length > 0 ? normalized : ["request"];
}

function normalizeHttpExceptionDetails(body: HttpExceptionBody): ApiErrorDetail[] | undefined {
  if (!Array.isArray(body.details) || body.details.length === 0) {
    return undefined;
  }
  const parsed = z.array(apiErrorDetailSchema).min(1).safeParse(body.details);
  return parsed.success ? parsed.data : undefined;
}

function normalizeZodDetails(error: unknown): ApiErrorDetail[] | undefined {
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return undefined;
  }

  const issues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(issues) || issues.length === 0) {
    return undefined;
  }

  return issues.map((issue): ApiErrorDetail => {
    const value = issue && typeof issue === "object" ? (issue as ZodIssueLike) : {};
    return {
      path: normalizePath(value.path),
      message:
        typeof value.message === "string" && value.message.trim().length > 0
          ? value.message
          : "Invalid value.",
      code: typeof value.code === "string" && value.code.trim().length > 0 ? value.code : "invalid",
    };
  });
}

function getCorrelationId(request: ErrorRequest): string | undefined {
  if (typeof request.id === "string" && request.id.trim().length > 0) {
    return request.id;
  }

  const header = request.headers[correlationIdHeader];
  if (typeof header === "string" && header.trim().length > 0) {
    return header;
  }

  if (Array.isArray(header)) {
    return header.find((value) => value.trim().length > 0);
  }

  return undefined;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorRequest>();
    const response = http.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const isValidationException =
      exception instanceof ZodValidationException || exception instanceof ZodError;
    const statusCode = isValidationException
      ? HttpStatus.BAD_REQUEST
      : isHttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const correlationId = getCorrelationId(request);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      request.log?.error({ err: exception, correlationId }, "Unhandled API request error");
      const httpBody = isHttpException ? getHttpExceptionBody(exception) : {};
      const explicit5xxCode =
        typeof httpBody.code === "string" && /^[A-Z0-9_]+$/.test(httpBody.code)
          ? httpBody.code
          : undefined;
      const preserveExplicit = isHttpException && explicit5xxCode !== undefined;
      response.status(statusCode).json({
        statusCode,
        code: preserveExplicit ? (explicit5xxCode as string) : apiErrorCodes.internalServerError,
        message: preserveExplicit
          ? getMessage(httpBody, exception as HttpException)
          : "Internal server error.",
        ...(correlationId ? { correlationId } : {}),
      } satisfies ApiErrorResponse);
      return;
    }

    const exceptionBody = isHttpException ? getHttpExceptionBody(exception) : {};
    const details = isValidationException
      ? normalizeZodDetails(
          exception instanceof ZodValidationException ? exception.getZodError() : exception,
        )
      : normalizeHttpExceptionDetails(exceptionBody);
    const explicitCode =
      typeof exceptionBody.code === "string" && /^[A-Z0-9_]+$/.test(exceptionBody.code)
        ? exceptionBody.code
        : undefined;

    response.status(statusCode).json({
      statusCode,
      code:
        explicitCode ??
        (isValidationException
          ? apiErrorCodes.validationFailed
          : statusCodeToErrorCode(statusCode)),
      message: isValidationException
        ? "Request validation failed."
        : getMessage(exceptionBody, exception as HttpException),
      ...(details ? { details } : {}),
      ...(correlationId ? { correlationId } : {}),
    } satisfies ApiErrorResponse);
  }
}
