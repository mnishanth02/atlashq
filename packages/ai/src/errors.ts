export const aiCoreErrorCodeValues = [
  "AI_PROVIDER_NOT_APPROVED",
  "AI_PROVIDER_POLICY_INACTIVE",
  "AI_PROVIDER_POLICY_MISMATCH",
  "AI_RUN_BUDGET_EXCEEDED",
  "AI_RUN_PROMPT_INJECTION_GUARD_TRIGGERED",
  "AI_RUN_SCHEMA_VALIDATION_FAILED",
  "AI_RUN_SEMANTIC_VALIDATION_FAILED",
  "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
  "AI_RUN_PROVIDER_TIMEOUT",
  "AI_RUN_PROVIDER_RATE_LIMITED",
  "AI_RUN_PROVIDER_FAILURE",
] as const;

export type AiCoreErrorCode = (typeof aiCoreErrorCodeValues)[number];

type AiCoreErrorOptions = {
  retryable?: boolean;
  safeDetail?: string;
  cause?: unknown;
};

export class AiCoreError extends Error {
  readonly code: AiCoreErrorCode;
  readonly retryable: boolean;
  readonly safeDetail: string | null;

  constructor(code: AiCoreErrorCode, message: string, options: AiCoreErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AiCoreError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.safeDetail = options.safeDetail ?? null;
  }
}

export type ProviderErrorClassification = {
  code: AiCoreErrorCode;
  retryable: boolean;
  detail: string;
  statusCode: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumberValue(record: Record<string, unknown>, key: string): number | null {
  const candidate = record[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function readStringValue(record: Record<string, unknown>, key: string): string | null {
  const candidate = record[key];
  return typeof candidate === "string" ? candidate : null;
}

function getErrorStatusCode(error: unknown): number | null {
  if (!isRecord(error)) {
    return null;
  }

  const directStatus = readNumberValue(error, "status");
  if (directStatus !== null) {
    return directStatus;
  }

  const statusCode = readNumberValue(error, "statusCode");
  if (statusCode !== null) {
    return statusCode;
  }

  const response = error.response;
  if (isRecord(response)) {
    const nestedStatus = readNumberValue(response, "status");
    if (nestedStatus !== null) {
      return nestedStatus;
    }
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error)) {
    const message = readStringValue(error, "message");
    if (message) {
      return message;
    }
  }

  return "Unknown provider failure.";
}

function getErrorCodeToken(error: unknown): string {
  if (!isRecord(error)) {
    return "";
  }

  const code = readStringValue(error, "code");
  if (code) {
    return code.toUpperCase();
  }

  return "";
}

export function classifyProviderError(error: unknown): ProviderErrorClassification {
  const statusCode = getErrorStatusCode(error);
  const message = getErrorMessage(error);
  const codeToken = getErrorCodeToken(error);
  const normalizedMessage = message.toLowerCase();

  if (statusCode === 429 || (statusCode === null && normalizedMessage.includes("rate limit"))) {
    return {
      code: "AI_RUN_PROVIDER_RATE_LIMITED",
      retryable: true,
      detail: "Provider rate limit reached.",
      statusCode,
    };
  }

  const timeoutLikeStatus = statusCode === 408 || statusCode === 504;
  const timeoutLikeMessage =
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("deadline exceeded") ||
    normalizedMessage.includes("abort");
  const timeoutLikeCode =
    codeToken === "ETIMEDOUT" || codeToken === "ECONNABORTED" || codeToken === "ABORT_ERR";
  if (timeoutLikeStatus || (statusCode === null && timeoutLikeMessage) || timeoutLikeCode) {
    return {
      code: "AI_RUN_PROVIDER_TIMEOUT",
      retryable: true,
      detail: "Provider request timed out.",
      statusCode,
    };
  }

  const transientStatus = statusCode !== null && statusCode >= 500;
  const transientCode =
    codeToken === "ECONNRESET" ||
    codeToken === "ENOTFOUND" ||
    codeToken === "EAI_AGAIN" ||
    codeToken === "ECONNREFUSED";
  if (transientStatus || transientCode) {
    return {
      code: "AI_RUN_TRANSIENT_PROVIDER_FAILURE",
      retryable: true,
      detail: "Transient provider transport failure.",
      statusCode,
    };
  }

  return {
    code: "AI_RUN_PROVIDER_FAILURE",
    retryable: false,
    detail: "Provider request failed.",
    statusCode,
  };
}
