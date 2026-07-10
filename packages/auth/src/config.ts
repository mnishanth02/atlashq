import type { Database } from "@atlashq/db";
import { betterAuthSchema, rateLimit } from "@atlashq/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { type AuthRuntimeEnv, resolveTrustedOrigins } from "./env.js";

/** Origin-relative base path where the Better Auth Node handler is mounted. */
export const betterAuthBasePath = "/api/auth";

/** @deprecated Prefer {@link betterAuthBasePath}. Retained for existing call sites. */
export const betterAuthRouteMountPath = betterAuthBasePath;

/**
 * Express 5 catch-all pattern for mounting the Better Auth handler. Express 5 uses a
 * named splat (`*splat`) rather than the bare `*` wildcard used by Express 4.
 */
export const betterAuthExpressWildcardPath = `${betterAuthBasePath}/*splat`;

const sevenDaysInSeconds = 60 * 60 * 24 * 7;
const oneDayInSeconds = 60 * 60 * 24;
const oneMinuteInSeconds = 60;

export type CreateAuthOptions = {
  db: Database;
  env: AuthRuntimeEnv;
  /**
   * Allow public email/password self sign-up through `POST /sign-up/email`.
   *
   * Defaults to `false`: the mounted production API and every browser-facing
   * surface reject public sign-up, so a caller can never enrol themselves into
   * an arbitrary tenant by supplying a known `organizationId`. Only trusted,
   * server-only, **non-mounted** contexts (the initial-admin provisioning CLI
   * and the integration/E2E provisioning harnesses) may opt in by passing
   * `true`. `main.ts` and {@link createApiApp} never set this.
   */
  allowSignUp?: boolean;
};

/**
 * Build a real, database-backed Better Auth instance.
 *
 * This factory performs no I/O and reads no `process.env` at module load time — the
 * caller supplies an already-validated env object and a lazily created Drizzle
 * database client, which keeps offline tooling (OpenAPI generation, unit tests) free
 * of live database/secret requirements.
 */
export function createAuth(options: CreateAuthOptions) {
  const { db, env, allowSignUp = false } = options;
  const isProduction = env.NODE_ENV === "production";

  return betterAuth({
    appName: "AtlasHQ",
    secret: env.AUTH_SECRET,
    baseURL: env.AUTH_URL,
    basePath: betterAuthBasePath,
    trustedOrigins: resolveTrustedOrigins(env),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { ...betterAuthSchema, rateLimit },
    }),
    emailAndPassword: {
      enabled: true,
      // Public self sign-up is closed by default. When disabled, Better Auth
      // rejects `POST /sign-up/email` (HTTP or server API) with
      // `EMAIL_PASSWORD_SIGN_UP_DISABLED`, so an unauthenticated caller can
      // never auto-enrol into a tenant by guessing an `organizationId`. Sign-in
      // and session issuance stay enabled regardless.
      disableSignUp: !allowSignUp,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    user: {
      // `organizationId` is provisioned at signup; `organizationRole` and `status`
      // are server-controlled and default at the database layer.
      additionalFields: {
        organizationId: { type: "string", required: true, input: true },
        organizationRole: { type: "string", required: false, input: false },
        status: { type: "string", required: false, input: false },
      },
    },
    session: {
      expiresIn: sevenDaysInSeconds,
      updateAge: oneDayInSeconds,
      storeSessionInDatabase: true,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: oneMinuteInSeconds,
      max: 100,
      customRules: {
        "/sign-in/email": { window: oneMinuteInSeconds, max: 5 },
        "/sign-up/email": { window: oneMinuteInSeconds, max: 5 },
        "/forget-password": { window: oneMinuteInSeconds, max: 3 },
        "/reset-password": { window: oneMinuteInSeconds, max: 5 },
      },
    },
    advanced: {
      database: {
        // Matches the `uuid` primary keys defined in `@atlashq/db`.
        generateId: "uuid",
      },
      cookiePrefix: "atlashq",
      useSecureCookies: isProduction,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Inferred `{ session, user }` shape, including the additional user fields. */
export type AuthSession = Auth["$Infer"]["Session"];

/** Authenticated user shape including `organizationId`, `organizationRole`, `status`. */
export type AuthUser = AuthSession["user"];

/** Persisted session record shape (id, token, expiry, etc.). */
export type AuthSessionRecord = AuthSession["session"];
