import type { RequestHandler } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

export type MswServer = ReturnType<typeof setupServer>;
type MswListenOptions = Parameters<MswServer["listen"]>[0];

export function createMswServer(...handlers: RequestHandler[]) {
  return setupServer(...handlers);
}

export function setupMswServer(
  server: MswServer,
  options: MswListenOptions = { onUnhandledRequest: "error" },
) {
  beforeAll(() => {
    server.listen(options);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  return server;
}
