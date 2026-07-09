import { randomUUID } from "node:crypto";
import pino, { type Logger, type LoggerOptions } from "pino";
import { pinoHttp } from "pino-http";

export const correlationIdHeader = "x-correlation-id";

export const sensitiveRedactionPaths = [
  "authorization",
  "cookie",
  "cookies",
  "password",
  "passwordHash",
  "token",
  "tokens",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "AUTH_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
] as const;

export type AtlasLogger = Logger;

export type AtlasLoggerOptions = LoggerOptions & {
  name?: string;
};

export function createCorrelationId(incoming?: string | string[] | null): string {
  if (typeof incoming === "string" && incoming.trim().length > 0) {
    return incoming;
  }

  if (Array.isArray(incoming)) {
    const first = incoming.find((value) => value.trim().length > 0);
    if (first) {
      return first;
    }
  }

  return randomUUID();
}

export function createAtlasLogger(options: AtlasLoggerOptions = {}): AtlasLogger {
  return pino({
    name: options.name ?? "atlashq",
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [...sensitiveRedactionPaths],
      censor: "[REDACTED]",
    },
    ...options,
  });
}

export function createPinoRequestLogger(options: AtlasLoggerOptions = {}) {
  const logger = createAtlasLogger({ name: "atlashq-api", ...options });

  return pinoHttp({
    logger,
    genReqId: (request) => createCorrelationId(request.headers[correlationIdHeader]),
    customProps: (request) => ({
      correlationId: request.id,
      route: request.url,
    }),
    redact: {
      paths: [...sensitiveRedactionPaths],
      censor: "[REDACTED]",
    },
  });
}

export function childLogger(
  logger: AtlasLogger,
  context: Record<string, string | number | boolean>,
) {
  return logger.child(context);
}
