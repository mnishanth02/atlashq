import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureFailedError, CaptureUnavailableError } from "./capture-adapter.js";
import type { PinnedFetchRequest, PinnedFetchResponse } from "./pinned-http-client.js";
import { createPlaywrightCaptureAdapter } from "./playwright-adapter.js";
import { CaptureUrlBlockedError, type HostnameResolutionRecord } from "./ssrf-guard.js";

type ScenarioStep =
  | {
      kind: "request";
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: Buffer;
      afterRoute?: (result: { aborted: boolean; fulfilled: boolean }) => void;
    }
  | {
      kind: "websocket";
      abortSpy: () => void;
    };

function buildResolver(
  responses: Record<string, HostnameResolutionRecord[] | HostnameResolutionRecord[][]>,
) {
  const counters = new Map<string, number>();

  return vi.fn(async (hostname: string) => {
    const response = responses[hostname];
    if (!response) {
      throw new Error(`Unexpected hostname ${hostname}`);
    }

    const firstEntry = response[0];
    if (Array.isArray(firstEntry)) {
      const index = counters.get(hostname) ?? 0;
      counters.set(hostname, index + 1);
      return (response as HostnameResolutionRecord[][])[index] ?? [];
    }

    return response as HostnameResolutionRecord[];
  });
}

function buildPinnedFetch(
  handlers: Record<string, { status: number; headers?: Record<string, string>; body?: Buffer }>,
) {
  return vi.fn(async ({ url }: Pick<PinnedFetchRequest, "url">): Promise<PinnedFetchResponse> => {
    const response = handlers[url];
    if (!response) {
      throw new Error(`Unexpected fetch for ${url}`);
    }

    return {
      status: response.status,
      statusText: "",
      headers: response.headers ?? { "content-type": "text/plain" },
      body: response.body ?? Buffer.from("ok"),
    };
  });
}

function buildChromiumScenario({
  steps,
  finalUrl,
  title = "Captured page",
  screenshot = Buffer.from("png"),
}: {
  steps: ScenarioStep[];
  finalUrl: string;
  title?: string;
  screenshot?: Buffer;
}) {
  let routeHandler:
    | ((route: {
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
      }) => Promise<void>)
    | undefined;
  let webSocketHandler: ((route: { abort(): Promise<void> }) => Promise<void>) | undefined;
  let newContextOptions: Record<string, unknown> | undefined;
  type RouteHandler = Exclude<typeof routeHandler, undefined>;
  type WebSocketHandler = Exclude<typeof webSocketHandler, undefined>;

  const browserClose = vi.fn().mockResolvedValue(undefined);

  const page = {
    on: vi.fn(),
    goto: vi.fn(async () => {
      for (const step of steps) {
        if (step.kind === "websocket") {
          if (!webSocketHandler) {
            throw new Error("WebSocket route handler was not registered.");
          }
          await webSocketHandler({
            abort: vi.fn(async () => {
              step.abortSpy();
            }),
          });
          continue;
        }

        if (!routeHandler) {
          throw new Error("HTTP route handler was not registered.");
        }

        const routeState = { aborted: false, fulfilled: false };
        await routeHandler({
          request: () => ({
            url: () => step.url,
            method: () => step.method ?? "GET",
            headers: () => step.headers ?? {},
            postDataBuffer: () => step.body ?? null,
          }),
          abort: vi.fn(async () => {
            routeState.aborted = true;
          }),
          fulfill: vi.fn(async () => {
            routeState.fulfilled = true;
          }),
        });
        step.afterRoute?.(routeState);
      }
    }),
    title: vi.fn(async () => title),
    screenshot: vi.fn(async () => screenshot),
    url: vi.fn(() => finalUrl),
  };

  const context = {
    route: vi.fn(async (_url: string, handler: RouteHandler) => {
      routeHandler = handler;
    }),
    routeWebSocket: vi.fn(async (_url: string, handler: WebSocketHandler) => {
      webSocketHandler = handler;
    }),
    newPage: vi.fn(async () => page),
    on: vi.fn(),
  };

  const chromium = {
    executablePath: vi.fn(() => process.execPath),
    launch: vi.fn(async () => ({
      newContext: vi.fn(async (options: Record<string, unknown>) => {
        newContextOptions = options;
        return context;
      }),
      close: browserClose,
    })),
  };

  return {
    chromium,
    page,
    context,
    browserClose,
    getNewContextOptions: () => newContextOptions,
  };
}

const captureRequest = {
  url: "https://example.com/",
  timeoutMs: 5_000,
  maxRedirects: 2,
  maxResponseBytes: 1_000,
  maxTotalBytes: 2_000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPlaywrightCaptureAdapter", () => {
  it("pins the validated IP for the exact request and strips cookie/auth headers", async () => {
    const resolver = buildResolver({
      "rebind.example.com": [
        [{ address: "93.184.216.34", family: 4 }],
        [{ address: "10.0.0.5", family: 4 }],
      ],
    });
    const pinnedFetch = vi.fn(
      async (_request: PinnedFetchRequest): Promise<PinnedFetchResponse> => ({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "text/html" },
        body: Buffer.from("<html></html>"),
      }),
    );
    const scenario = buildChromiumScenario({
      finalUrl: "https://rebind.example.com/",
      steps: [
        {
          kind: "request",
          url: "https://rebind.example.com/",
          headers: {
            authorization: "Bearer secret",
            cookie: "session=abc",
            "proxy-authorization": "Basic secret",
            host: "rebind.example.com",
            accept: "text/html",
          },
        },
      ],
    });

    const adapter = createPlaywrightCaptureAdapter({
      resolver,
      pinnedFetch,
      loadChromium: async () => ({ chromium: scenario.chromium }),
    });

    const result = await adapter.capture({
      ...captureRequest,
      url: "https://rebind.example.com/",
    });

    expect(result.finalUrl).toBe("https://rebind.example.com/");
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(pinnedFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://rebind.example.com/",
        pinnedAddress: "93.184.216.34",
        headers: { accept: "text/html" },
      }),
    );
  });

  it("blocks a redirect whose validated target resolves to a private address", async () => {
    const resolver = buildResolver({
      "public.example.com": [{ address: "93.184.216.34", family: 4 }],
      "private.example.com": [{ address: "10.0.0.25", family: 4 }],
    });
    const pinnedFetch = buildPinnedFetch({
      "https://public.example.com/": {
        status: 302,
        headers: { location: "http://private.example.com/secret" },
        body: Buffer.alloc(0),
      },
    });
    const scenario = buildChromiumScenario({
      finalUrl: "https://public.example.com/",
      steps: [{ kind: "request", url: "https://public.example.com/" }],
    });

    const adapter = createPlaywrightCaptureAdapter({
      resolver,
      pinnedFetch,
      loadChromium: async () => ({ chromium: scenario.chromium }),
    });

    await expect(
      adapter.capture({ ...captureRequest, url: "https://public.example.com/" }),
    ).rejects.toBeInstanceOf(CaptureUrlBlockedError);
  });

  it("pins subresource requests instead of allowing a second DNS resolution to rebind privately", async () => {
    const resolver = buildResolver({
      "page.example.com": [{ address: "93.184.216.34", family: 4 }],
      "asset.example.com": [
        [{ address: "93.184.216.35", family: 4 }],
        [{ address: "169.254.169.254", family: 4 }],
      ],
    });
    const pinnedFetch = buildPinnedFetch({
      "https://page.example.com/": {
        status: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.from('<script src="https://asset.example.com/app.js"></script>'),
      },
      "https://asset.example.com/app.js": {
        status: 200,
        headers: { "content-type": "application/javascript" },
        body: Buffer.from("console.log('ok')"),
      },
    });
    const scenario = buildChromiumScenario({
      finalUrl: "https://page.example.com/",
      steps: [
        { kind: "request", url: "https://page.example.com/" },
        { kind: "request", url: "https://asset.example.com/app.js" },
      ],
    });

    const adapter = createPlaywrightCaptureAdapter({
      resolver,
      pinnedFetch,
      loadChromium: async () => ({ chromium: scenario.chromium }),
    });

    await expect(
      adapter.capture({ ...captureRequest, url: "https://page.example.com/" }),
    ).resolves.toEqual(
      expect.objectContaining({
        finalUrl: "https://page.example.com/",
      }),
    );

    expect(pinnedFetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: "https://asset.example.com/app.js",
        pinnedAddress: "93.184.216.35",
      }),
    );
  });

  it("blocks websocket handshakes and configures service workers to fail closed", async () => {
    const resolver = buildResolver({
      "example.com": [{ address: "93.184.216.34", family: 4 }],
    });
    const pinnedFetch = buildPinnedFetch({
      "https://example.com/": {
        status: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.from("<html></html>"),
      },
    });
    const webSocketAbortSpy = vi.fn();
    const scenario = buildChromiumScenario({
      finalUrl: "https://example.com/",
      steps: [
        { kind: "websocket", abortSpy: webSocketAbortSpy },
        { kind: "request", url: "https://example.com/" },
      ],
    });

    const adapter = createPlaywrightCaptureAdapter({
      resolver,
      pinnedFetch,
      loadChromium: async () => ({ chromium: scenario.chromium }),
    });

    await adapter.capture(captureRequest);

    expect(webSocketAbortSpy).toHaveBeenCalledTimes(1);
    expect(scenario.getNewContextOptions()).toEqual(
      expect.objectContaining({
        acceptDownloads: false,
        serviceWorkers: "block",
      }),
    );
  });

  it("enforces the total byte limit across multiple fulfilled resources", async () => {
    const resolver = buildResolver({
      "example.com": [{ address: "93.184.216.34", family: 4 }],
      "cdn.example.com": [{ address: "93.184.216.35", family: 4 }],
    });
    const pinnedFetch = buildPinnedFetch({
      "https://example.com/": {
        status: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.alloc(900, 1),
      },
      "https://cdn.example.com/app.js": {
        status: 200,
        headers: { "content-type": "application/javascript" },
        body: Buffer.alloc(1_300, 1),
      },
    });
    const scenario = buildChromiumScenario({
      finalUrl: "https://example.com/",
      steps: [
        { kind: "request", url: "https://example.com/" },
        { kind: "request", url: "https://cdn.example.com/app.js" },
      ],
    });

    const adapter = createPlaywrightCaptureAdapter({
      resolver,
      pinnedFetch,
      loadChromium: async () => ({ chromium: scenario.chromium }),
    });

    await expect(
      adapter.capture({
        ...captureRequest,
        maxResponseBytes: 2_000,
        maxTotalBytes: 2_000,
      }),
    ).rejects.toBeInstanceOf(CaptureFailedError);
  });

  it("enforces the redirect limit before fulfilling the extra hop", async () => {
    const resolver = buildResolver({
      "one.example.com": [{ address: "93.184.216.34", family: 4 }],
      "two.example.com": [{ address: "93.184.216.35", family: 4 }],
      "three.example.com": [{ address: "93.184.216.36", family: 4 }],
    });
    const pinnedFetch = buildPinnedFetch({
      "https://one.example.com/": {
        status: 302,
        headers: { location: "https://two.example.com/" },
        body: Buffer.alloc(0),
      },
      "https://two.example.com/": {
        status: 302,
        headers: { location: "https://three.example.com/" },
        body: Buffer.alloc(0),
      },
    });
    const scenario = buildChromiumScenario({
      finalUrl: "https://two.example.com/",
      steps: [
        { kind: "request", url: "https://one.example.com/" },
        { kind: "request", url: "https://two.example.com/" },
      ],
    });

    const adapter = createPlaywrightCaptureAdapter({
      resolver,
      pinnedFetch,
      loadChromium: async () => ({ chromium: scenario.chromium }),
    });

    await expect(
      adapter.capture({ ...captureRequest, url: "https://one.example.com/", maxRedirects: 1 }),
    ).rejects.toBeInstanceOf(CaptureFailedError);
  });

  it("fails closed when the Playwright runtime cannot block websocket channels", async () => {
    const chromium = {
      executablePath: vi.fn(() => process.execPath),
      launch: vi.fn(async () => ({
        newContext: vi.fn(async () => ({
          route: vi.fn(),
          newPage: vi.fn(),
          on: vi.fn(),
        })),
        close: vi.fn(async () => undefined),
      })),
    };

    const adapter = createPlaywrightCaptureAdapter({
      loadChromium: async () => ({ chromium }),
    });

    await expect(adapter.capture(captureRequest)).rejects.toBeInstanceOf(CaptureUnavailableError);
  });
});
