import { projectRoles } from "@atlashq/types";
import { describe, expect, it } from "vitest";
import { canProjectRole, createBetterAuthPlaceholderConfig } from "./index.js";

describe("auth placeholders", () => {
  it("configures server-only Better Auth defaults and project RBAC", () => {
    const config = createBetterAuthPlaceholderConfig({
      NODE_ENV: "production",
      AUTH_SECRET: "a".repeat(32),
      AUTH_URL: "https://api.example.com",
      DATABASE_URL: "postgres://example",
      REDIS_URL: "redis://localhost:6379",
      WEB_ORIGIN: "https://app.example.com",
    });

    expect(config.security.secureCookies).toBe(true);
    expect(config.optionalRedis?.rateLimitStorage).toBe("secondary-storage");
    expect(canProjectRole(projectRoles.developer, "project:read")).toBe(true);
  });
});
