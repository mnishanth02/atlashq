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
  "email",
  "phone",
  "phoneNumber",
  "ssn",
  "nationalId",
  "passportNumber",
  "address",
  "token",
  "tokens",
  "accessToken",
  "refreshToken",
  "apiKey",
  "clientSecret",
  "privateKey",
  "accessKeyId",
  "secretAccessKey",
  "connectionString",
  "signedUrl",
  "signedUploadUrl",
  "signedDownloadUrl",
  "presignedUrl",
  "prompt",
  "prompts",
  "systemPrompt",
  "userPrompt",
  "messages",
  "inputText",
  "sourceChunk",
  "sourceChunks",
  "structuredEvidenceBlocks",
  "quoteTextOriginal",
  "quoteTextNormalized",
  "modelOutput",
  "modelOutputs",
  "fullModelOutput",
  "providerResponseBody",
  "aiRun.output",
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
  "req.body.prompt",
  "req.body.prompts",
  "req.body.messages",
  "req.body.sourceChunk",
  "req.body.sourceChunks",
  "req.body.structuredEvidenceBlocks",
  "req.body.quoteTextOriginal",
  "req.body.quoteTextNormalized",
  "req.body.modelOutput",
  "req.body.modelOutputs",
  "req.body.fullModelOutput",
  "request.headers.authorization",
  "request.headers.cookie",
  "request.body.prompt",
  "request.body.prompts",
  "request.body.messages",
  "request.body.sourceChunk",
  "request.body.sourceChunks",
  "request.body.structuredEvidenceBlocks",
  "request.body.quoteTextOriginal",
  "request.body.quoteTextNormalized",
  "request.body.modelOutput",
  "request.body.modelOutputs",
  "request.body.fullModelOutput",
  "response.body.modelOutput",
  "response.body.modelOutputs",
  "response.body.fullModelOutput",
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
