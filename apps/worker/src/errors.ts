import { UnrecoverableError } from "bullmq";

/**
 * Thrown for transient infrastructure failures (MinIO, database, Redis, ClamAV unavailable/timeout).
 * BullMQ retries these with the queue's bounded exponential backoff (module-02 §6.9, §10).
 */
export class RetryableWorkerError extends Error {
  readonly retryable = true as const;
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RetryableWorkerError";
    this.code = code;
  }
}

/**
 * Thrown for malware, hash mismatch, unsafe archive, unsupported actual type, corrupt content, or
 * blocked capture URLs. Wraps `BullMQ`'s `UnrecoverableError` so a single throw both skips further
 * attempts and carries a stable machine-readable `code` for logs/audit (module-02 §6.9, §10).
 */
export class TerminalWorkerError extends UnrecoverableError {
  readonly retryable = false as const;
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "TerminalWorkerError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** Job/DB data that is missing, out of scope, or references the wrong resource: never retryable. */
export class InvalidJobDataError extends TerminalWorkerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("INVALID_JOB_DATA", message, options);
    this.name = "InvalidJobDataError";
  }
}

/**
 * Thrown when a `capture-reference` successor `source_document` already exists (`supersedes_id`
 * points at the predecessor) but is missing one or more of its required companion rows
 * (`reference_artifact`, `source_document_file`, `source_extraction`). This only happens if an
 * older, pre-atomic-transaction worker run crashed partway through creating the successor. The
 * original captured screenshot bytes/title/timestamp are not recoverable from the database alone,
 * so there is no safe way to automatically repair the row -- replay must fail loudly here instead
 * of silently treating the successor as complete or capturing a second time and forking.
 */
export class IncompleteCaptureSuccessorError extends TerminalWorkerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("INCOMPLETE_CAPTURE_SUCCESSOR", message, options);
    this.name = "IncompleteCaptureSuccessorError";
  }
}
