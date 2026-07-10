import { describe, expect, it } from "vitest";
import { authEnvSchema, resolveTrustedOrigins, toOrigin } from "./env.js";

describe("authEnvSchema", () => {
  it("rejects an AUTH_SECRET shorter than 32 characters", () => {
    const result = authEnvSchema.safeParse({
      AUTH_SECRET: "too-short",
      AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "postgres://localhost/db",
      WEB_ORIGIN: "http://localhost:5173",
    });
    expect(result.success).toBe(false);
  });

  it("defaults NODE_ENV to development and accepts a valid config", () => {
    const result = authEnvSchema.safeParse({
      AUTH_SECRET: "x".repeat(32),
      AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "postgres://localhost/db",
      WEB_ORIGIN: "http://localhost:5173",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });
});

describe("toOrigin", () => {
  it("strips path/query and returns only the origin", () => {
    expect(toOrigin("http://localhost:8080/api/auth")).toBe("http://localhost:8080");
    expect(toOrigin("https://app.example.com/some/path?x=1")).toBe("https://app.example.com");
  });
});

describe("resolveTrustedOrigins", () => {
  it("returns the deduplicated auth and web origins", () => {
    expect(
      resolveTrustedOrigins({
        NODE_ENV: "test",
        AUTH_SECRET: "x".repeat(32),
        AUTH_URL: "http://localhost:8080/api/auth",
        WEB_ORIGIN: "https://app.example.com",
      }),
    ).toEqual(["http://localhost:8080", "https://app.example.com"]);
  });
});
