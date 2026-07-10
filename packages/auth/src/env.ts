import { z } from "zod";

export const authEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
  WEB_ORIGIN: z.string().url(),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

/**
 * Minimal structural view of the environment required to build the Better Auth
 * instance. Kept intentionally narrow so both {@link AuthEnv} and the API's richer
 * env object satisfy it without a hard dependency between packages.
 */
export type AuthRuntimeEnv = {
  NODE_ENV: "development" | "test" | "production";
  AUTH_SECRET: string;
  AUTH_URL: string;
  WEB_ORIGIN: string;
};

export function toOrigin(url: string): string {
  return new URL(url).origin;
}

/**
 * Resolve the CSRF/origin trusted origins from the auth base URL origin and the web
 * origin. Duplicates are collapsed so the list stays minimal.
 */
export function resolveTrustedOrigins(env: AuthRuntimeEnv): string[] {
  const origins = [toOrigin(env.AUTH_URL), toOrigin(env.WEB_ORIGIN)];
  return [...new Set(origins)];
}
