import { describe, expect, it, vi } from "vitest";
import { SessionResolutionMiddleware } from "./session.middleware.js";

describe("SessionResolutionMiddleware", () => {
  it("is a no-op when the runtime auth instance is null", async () => {
    const middleware = new SessionResolutionMiddleware(null);
    const next = vi.fn();

    await middleware.use({ headers: {} } as never, {} as never, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
