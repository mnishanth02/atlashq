import { test as base, expect } from "@playwright/test";
import { E2E_BASE_URL } from "../support/test-data";

type BrowserFailure = {
  kind: "console" | "page" | "response" | "request";
  detail: string;
};

/**
 * Matches an in-flight API response so `browserHealth` can allow-list a *specific*,
 * test-declared expected error (e.g. a 409 duplicate-confirmation response, a 403
 * permission-denied response, or a 403 capture-disabled response) without ever silently
 * swallowing unrelated failures. All provided fields must match; omitted fields match anything.
 */
type ExpectedApiResponse = {
  method?: string;
  status?: number;
  pathIncludes?: string;
};

type E2EFixtures = {
  browserHealth: undefined;
  expectedApiResponses: ExpectedApiResponse[];
  allowApiResponse: (matcher: ExpectedApiResponse) => void;
};

function isApiUrl(value: string): boolean {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    const configuredOrigin = new URL(process.env.E2E_BASE_URL ?? E2E_BASE_URL).origin;
    return url.origin === configuredOrigin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/** Parses the status code out of Chromium's "Failed to load resource" console error text. */
function parseResourceLoadStatus(text: string): number | undefined {
  const match = /Failed to load resource: the server responded with a status of (\d+)/.exec(text);
  return match?.[1] ? Number(match[1]) : undefined;
}

export const test = base.extend<E2EFixtures>({
  expectedApiResponses: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature requires the object pattern.
    async ({}, use) => {
      await use([]);
    },
    {},
  ],
  allowApiResponse: [
    async ({ expectedApiResponses }, use) => {
      await use((matcher) => {
        expectedApiResponses.push(matcher);
      });
    },
    {},
  ],
  browserHealth: [
    async ({ page, expectedApiResponses }, use) => {
      const failures: BrowserFailure[] = [];

      page.on("console", (message) => {
        if (message.type() !== "error") {
          return;
        }
        const text = message.text();
        const status = parseResourceLoadStatus(text);
        if (status !== undefined) {
          // Chromium logs a devtools-only console error for every non-2xx network response, in
          // addition to the `response` event above. Suppress it when the *same* response has
          // already been explicitly allow-listed via `allowApiResponse`, so we don't double-count
          // one expected failure as two.
          const url = message.location().url;
          const isExpected =
            isApiUrl(url) &&
            expectedApiResponses.some(
              (matcher) =>
                (matcher.status === undefined || matcher.status === status) &&
                (matcher.pathIncludes === undefined || url.includes(matcher.pathIncludes)),
            );
          if (isExpected) {
            return;
          }
        }
        failures.push({ kind: "console", detail: text });
      });
      page.on("pageerror", (error) => {
        failures.push({ kind: "page", detail: error.stack ?? error.message });
      });
      page.on("response", (response) => {
        if (!isApiUrl(response.url()) || response.status() < 400) {
          return;
        }
        const method = response.request().method();
        const isExpected = expectedApiResponses.some(
          (matcher) =>
            (matcher.status === undefined || matcher.status === response.status()) &&
            (matcher.method === undefined || matcher.method === method) &&
            (matcher.pathIncludes === undefined || response.url().includes(matcher.pathIncludes)),
        );
        if (isExpected) {
          return;
        }
        failures.push({
          kind: "response",
          detail: `${response.status()} ${method} ${response.url()}`,
        });
      });
      page.on("requestfailed", (request) => {
        if (isApiUrl(request.url())) {
          const errorText = request.failure()?.errorText;
          // TanStack Query aborts superseded read requests during route changes and
          // mutation invalidation. Chromium reports those intentional GET cancellations.
          if (request.method() === "GET" && errorText === "net::ERR_ABORTED") {
            return;
          }
          failures.push({
            kind: "request",
            detail: `${request.method()} ${request.url()}: ${errorText ?? "failed"}`,
          });
        }
      });

      await use(undefined);

      expect(failures, "Browser console/page/API failures must be empty").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
