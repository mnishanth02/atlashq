import type { Auth } from "@atlashq/auth";
import type { Database } from "@atlashq/db";

/**
 * Runtime values that are composed lazily in `main.ts` from validated env and
 * injected into the Nest module. They are `null` for offline tooling (OpenAPI
 * document generation) so that building the module never opens a database
 * connection or requires auth secrets.
 */
export type ApiRuntime = {
  auth: Auth | null;
  db: Database | null;
};

export const NULL_RUNTIME: ApiRuntime = { auth: null, db: null };

/** Injection token for the composed Better Auth instance (`Auth | null`). */
export const AUTH_INSTANCE = "ATLASHQ_AUTH_INSTANCE";

/** Injection token for the composed Drizzle database client (`Database | null`). */
export const DATABASE_CLIENT = "ATLASHQ_DATABASE_CLIENT";

/** Injection token for the organization-scoped project access query boundary. */
export const PROJECT_ACCESS_QUERIES = "ATLASHQ_PROJECT_ACCESS_QUERIES";

/** Injection token for the read-only auth directory (fresh user/org lookups). */
export const AUTH_DIRECTORY = "ATLASHQ_AUTH_DIRECTORY";
