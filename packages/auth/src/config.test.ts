import type { Database } from "@atlashq/db";
import { describe, expect, it } from "vitest";
import { betterAuthBasePath, betterAuthExpressWildcardPath, createAuth } from "./config.js";
import type { AuthRuntimeEnv } from "./env.js";

const fakeDb = {} as unknown as Database;

function makeEnv(overrides: Partial<AuthRuntimeEnv> = {}): AuthRuntimeEnv {
  return {
    NODE_ENV: "test",
    AUTH_SECRET: "x".repeat(32),
    AUTH_URL: "http://localhost:3000",
    WEB_ORIGIN: "http://localhost:5173",
    ...overrides,
  };
}

describe("createAuth", () => {
  it("builds a Better Auth instance without touching the database", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv() });
    expect(typeof auth.handler).toBe("function");
    expect(auth.api).toBeDefined();
  });

  it("mounts at the /api/auth base path", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv() });
    expect(auth.options.basePath).toBe("/api/auth");
    expect(betterAuthBasePath).toBe("/api/auth");
    expect(betterAuthExpressWildcardPath).toBe("/api/auth/*splat");
  });

  it("uses database-backed rate limiting with sensitive auth limits", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv() });
    expect(auth.options.rateLimit?.enabled).toBe(true);
    expect(auth.options.rateLimit?.storage).toBe("database");
    expect(auth.options.rateLimit?.customRules?.["/sign-in/email"]).toEqual({ window: 60, max: 5 });
    expect(auth.options.rateLimit?.customRules?.["/sign-up/email"]).toEqual({ window: 60, max: 5 });
  });

  it("configures UUID id generation to match the database schema", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv() });
    expect(auth.options.advanced?.database?.generateId).toBe("uuid");
  });

  it("declares additional user fields with server-controlled role/status", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv() });
    const fields = auth.options.user?.additionalFields;
    expect(fields?.organizationId).toMatchObject({ type: "string", required: true, input: true });
    expect(fields?.organizationRole).toMatchObject({ input: false });
    expect(fields?.status).toMatchObject({ input: false });
  });

  it("derives trusted origins from AUTH_URL and WEB_ORIGIN origins", () => {
    const auth = createAuth({
      db: fakeDb,
      env: makeEnv({ AUTH_URL: "http://localhost:8080", WEB_ORIGIN: "https://app.example.com" }),
    });
    expect(auth.options.trustedOrigins).toEqual([
      "http://localhost:8080",
      "https://app.example.com",
    ]);
  });

  it("collapses duplicate trusted origins", () => {
    const auth = createAuth({
      db: fakeDb,
      env: makeEnv({
        AUTH_URL: "http://localhost:3000/api/auth",
        WEB_ORIGIN: "http://localhost:3000",
      }),
    });
    expect(auth.options.trustedOrigins).toEqual(["http://localhost:3000"]);
  });

  it("disables secure cookies outside production", () => {
    const dev = createAuth({ db: fakeDb, env: makeEnv({ NODE_ENV: "development" }) });
    expect(dev.options.advanced?.useSecureCookies).toBe(false);
    expect(dev.options.advanced?.defaultCookieAttributes?.secure).toBe(false);
  });

  it("enables secure cookies in production", () => {
    const prod = createAuth({ db: fakeDb, env: makeEnv({ NODE_ENV: "production" }) });
    expect(prod.options.advanced?.useSecureCookies).toBe(true);
    expect(prod.options.advanced?.defaultCookieAttributes?.secure).toBe(true);
  });

  it("enables email/password auth with a strong minimum password length", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv() });
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.minPasswordLength).toBe(12);
  });

  it("disables public email/password sign-up by default while keeping login enabled", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv() });
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it("keeps public sign-up disabled when allowSignUp is explicitly false", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv(), allowSignUp: false });
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it("opts into public sign-up only when allowSignUp is true (trusted provisioning contexts)", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv(), allowSignUp: true });
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(false);
  });

  it("uses conservative database-backed session lifetimes", () => {
    const auth = createAuth({ db: fakeDb, env: makeEnv() });
    expect(auth.options.session?.expiresIn).toBe(60 * 60 * 24 * 7);
    expect(auth.options.session?.updateAge).toBe(60 * 60 * 24);
  });
});
