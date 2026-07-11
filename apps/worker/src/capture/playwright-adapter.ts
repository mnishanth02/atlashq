import { existsSync } from "node:fs";
import type { CaptureAdapter, CaptureRequest, CaptureResult } from "./capture-adapter.js";
import { CaptureFailedError, CaptureUnavailableError } from "./capture-adapter.js";
import {
  fetchPinnedHttpResource,
  type PinnedFetchRequest,
  type PinnedFetchResponse,
} from "./pinned-http-client.js";
import {
  assertPublicHttpUrl,
  CaptureUrlBlockedError,
  type HostnameResolver,
} from "./ssrf-guard.js";

type PinnedFetcher = (request: PinnedFetchRequest) => Promise<PinnedFetchResponse>;

type PlaywrightChromium = {
  executablePath(): string;
  launch(options: Record<string, unknown>): Promise<PlaywrightBrowser>;
};

type PlaywrightBrowser = {
  newContext(options: Record<string, unknown>): Promise<PlaywrightBrowserContext>;
  close(): Promise<void>;
};

type PlaywrightBrowserContext = {
  route(url: string, handler: (route: PlaywrightRoute) => Promise<void>): Promise<void> | void;
  routeWebSocket?(
    url: string,
    handler: (route: { abort?(): Promise<void>; close?(): Promise<void> }) => Promise<void>,
  ): Promise<void> | void;
  newPage(): Promise<PlaywrightPage>;
  on(event: "page", handler: (page: PlaywrightPage) => void): void;
};

type PlaywrightPage = {
  on(event: "download", handler: (download: { cancel(): Promise<void> | void }) => void): void;
  goto(url: string, options: { waitUntil: "load"; timeout: number }): Promise<void>;
  title(): Promise<string>;
  screenshot(options: { type: "png" }): Promise<Buffer>;
  url(): string;
};

type PlaywrightRoute = {
  request(): {
    url(): string;
    method(): string;
    headers(): Record<string, string>;
    postDataBuffer(): Buffer | null;
  };
  abort(errorCode?: string): Promise<void>;
  fulfill(options: {
    status: number;
    headers: Record<string, string>;
    body: Buffer;
  }): Promise<void>;
};

export type PlaywrightCaptureAdapterDependencies = {
  resolver?: HostnameResolver;
  pinnedFetch?: PinnedFetcher;
  loadChromium?: () => Promise<{ chromium: PlaywrightChromium }>;
  now?: () => number;
};

const BLOCKED_REQUEST_HEADERS = new Set([
  "authorization",
  "connection",
  "cookie",
  "host",
  "keep-alive",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const BLOCKED_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const CHROMIUM_CAPTURE_ARGS = [
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-domain-reliability",
  "--disable-extensions",
  "--disable-sync",
  "--metrics-recording-only",
  "--no-first-run",
];

/**
 * Real one-page reference capture adapter (module-02 §6.8): launches an isolated `playwright-core`
 * Chromium instance with no persistent profile, no credentials/cookies/auth headers, and no
 * download capability, revalidates the SSRF guard on the initial URL and on every navigation
 * (including redirects and subresources) via request interception, and enforces bounded time/
 * redirect/response-byte/total-byte limits. Fails explicitly with {@link CaptureUnavailableError}
 * if no Chromium executable is installed, rather than silently falling back to another method.
 */
export function createPlaywrightCaptureAdapter(
  dependencies: PlaywrightCaptureAdapterDependencies = {},
): CaptureAdapter {
  const resolveHostname = dependencies.resolver;
  const pinnedFetch = dependencies.pinnedFetch ?? fetchPinnedHttpResource;
  const loadChromium =
    dependencies.loadChromium ??
    (async (): Promise<{ chromium: PlaywrightChromium }> =>
      (await import("playwright-core")) as unknown as {
        chromium: PlaywrightChromium;
      });
  const now = dependencies.now ?? Date.now;

  return {
    async capture(request: CaptureRequest): Promise<CaptureResult> {
      const { chromium } = await loadChromium();
      const executablePath = chromium.executablePath();

      if (!executablePath || !existsSync(executablePath)) {
        throw new CaptureUnavailableError(
          "No Chromium executable is installed for the reference-capture adapter.",
        );
      }

      const browser = await chromium.launch({
        headless: true,
        executablePath,
        args: CHROMIUM_CAPTURE_ARGS,
      });
      const deadline = now() + request.timeoutMs;
      let redirectCount = 0;
      let totalBytes = 0;
      let violation: Error | null = null;

      try {
        const context = await browser.newContext({
          acceptDownloads: false,
          ignoreHTTPSErrors: false,
          extraHTTPHeaders: {},
          javaScriptEnabled: true,
          bypassCSP: false,
          serviceWorkers: "block",
        });

        context.on("page", (page) => {
          page.on("download", (download) => {
            void download.cancel();
          });
        });

        if (typeof context.routeWebSocket !== "function") {
          throw new CaptureUnavailableError(
            "The installed Playwright runtime does not support WebSocket routing.",
          );
        }

        await context.routeWebSocket("**/*", async (route) => {
          if (typeof route.abort === "function") {
            await route.abort();
            return;
          }

          if (typeof route.close === "function") {
            await route.close();
            return;
          }

          throw new CaptureUnavailableError(
            "The installed Playwright runtime cannot fail closed on WebSocket channels.",
          );
        });

        await context.route("**/*", async (route) => {
          const routedRequest = route.request();

          try {
            const validatedUrl = await assertPublicHttpUrl(
              routedRequest.url(),
              resolveHostname ? { resolver: resolveHostname } : {},
            );
            const requestBody = routedRequest.postDataBuffer() ?? undefined;
            const response = await pinnedFetch({
              url: validatedUrl.url,
              method: routedRequest.method(),
              headers: sanitizeRequestHeaders(routedRequest.headers()),
              pinnedAddress: validatedUrl.selectedAddress,
              timeoutMs: remainingTime(deadline, now),
              maxResponseBytes: request.maxResponseBytes,
              ...(requestBody ? { body: requestBody } : {}),
            });

            totalBytes += response.body.length;
            if (totalBytes > request.maxTotalBytes) {
              throw new CaptureFailedError(
                `Capture total response bytes exceeded the maximum of ${request.maxTotalBytes}.`,
              );
            }

            const redirectLocation = response.headers.location;
            if (isRedirectStatus(response.status) && redirectLocation) {
              redirectCount += 1;
              if (redirectCount > request.maxRedirects) {
                throw new CaptureFailedError(
                  `Capture exceeded the maximum of ${request.maxRedirects} redirects.`,
                );
              }

              const redirectUrl = new URL(redirectLocation, validatedUrl.url).toString();
              await assertPublicHttpUrl(
                redirectUrl,
                resolveHostname ? { resolver: resolveHostname } : {},
              );
            }

            await route.fulfill({
              status: response.status,
              headers: sanitizeResponseHeaders(response.headers, response.body.length),
              body: response.body,
            });
          } catch (error) {
            violation ??= error instanceof Error ? error : new Error(String(error));
            await route.abort("blockedbyclient");
          }
        });

        const page = await context.newPage();

        page.on("download", (download) => {
          void download.cancel();
        });

        await page.goto(request.url, {
          waitUntil: "load",
          timeout: remainingTime(deadline, now),
        });

        if (violation) {
          throw violation;
        }

        const finalUrl = page.url();
        const title = await page.title();
        const screenshotPng = await page.screenshot({ type: "png" });

        if (violation) {
          throw violation;
        }

        return {
          finalUrl,
          title,
          screenshotPng,
          capturedAt: new Date().toISOString(),
        };
      } catch (error) {
        if (violation) {
          throw violation;
        }
        if (error instanceof CaptureUnavailableError) {
          throw error;
        }
        if (error instanceof CaptureUrlBlockedError || error instanceof CaptureFailedError) {
          throw error;
        }
        throw new CaptureFailedError("Reference capture failed.", { cause: error });
      } finally {
        await browser.close();
      }
    },
  };
}

function sanitizeRequestHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())),
  );
}

function sanitizeResponseHeaders(
  headers: Record<string, string>,
  contentLength: number,
): Record<string, string> {
  const sanitized = Object.fromEntries(
    Object.entries(headers).filter(([key]) => !BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())),
  );
  sanitized["content-length"] = String(contentLength);
  return sanitized;
}

function remainingTime(deadline: number, now: () => number): number {
  const timeLeft = deadline - now();
  if (timeLeft <= 0) {
    throw new CaptureFailedError("Capture timed out.");
  }
  return timeLeft;
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}
