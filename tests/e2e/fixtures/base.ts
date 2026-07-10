import { test as base, expect } from "@playwright/test";
import { E2E_BASE_URL } from "../support/test-data";

type BrowserFailure = {
  kind: "console" | "page" | "response" | "request";
  detail: string;
};

type E2EFixtures = {
  browserHealth: undefined;
};

function isApiUrl(value: string): boolean {
  const url = new URL(value);
  const configuredOrigin = new URL(process.env.E2E_BASE_URL ?? E2E_BASE_URL).origin;
  return url.origin === configuredOrigin && url.pathname.startsWith("/api/");
}

export const test = base.extend<E2EFixtures>({
  browserHealth: [
    async ({ page }, use) => {
      const failures: BrowserFailure[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          failures.push({ kind: "console", detail: message.text() });
        }
      });
      page.on("pageerror", (error) => {
        failures.push({ kind: "page", detail: error.stack ?? error.message });
      });
      page.on("response", (response) => {
        if (isApiUrl(response.url()) && response.status() >= 400) {
          failures.push({
            kind: "response",
            detail: `${response.status()} ${response.request().method()} ${response.url()}`,
          });
        }
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

      await use();

      expect(failures, "Browser console/page/API failures must be empty").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
