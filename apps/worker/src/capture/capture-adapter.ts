/**
 * Injectable one-page reference capture adapter (module-02 §6.8). The production implementation
 * (`createPlaywrightCaptureAdapter`) drives an isolated `playwright-core` Chromium instance; tests
 * inject a fake that never launches a real browser. The handler depends only on this interface.
 */
export type CaptureRequest = {
  url: string;
  timeoutMs: number;
  maxRedirects: number;
  maxResponseBytes: number;
  maxTotalBytes: number;
};

export type CaptureResult = {
  finalUrl: string;
  title: string;
  screenshotPng: Buffer;
  capturedAt: string;
};

export class CaptureUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CaptureUnavailableError";
  }
}

export class CaptureFailedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CaptureFailedError";
  }
}

export type CaptureAdapter = {
  capture(request: CaptureRequest): Promise<CaptureResult>;
};
