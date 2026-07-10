import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Mirrors `packages/auth/src/config.ts`'s `user.additionalFields` shape without
 * importing the server `@atlashq/auth` package (and its Drizzle/Node dependencies)
 * into the browser bundle. Keep these two definitions in sync by hand.
 */
const additionalUserFields = {
  organizationId: { type: "string", required: true, input: true },
  organizationRole: { type: "string", required: false, input: false },
  status: { type: "string", required: false, input: false },
} as const;

/**
 * Browser Better Auth client. Requests are same-origin (`/api/auth/*`) — in dev via
 * the Vite proxy configured in `vite.config.ts`, in production behind Caddy — so no
 * base URL or CORS configuration is needed and the session cookie is sent
 * automatically with `credentials: "include"`.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [inferAdditionalFields({ user: additionalUserFields })],
});

export const { signIn, signOut, useSession, getSession } = authClient;

/** Resolved `useSession()`/`getSession()` data payload, including additional fields. */
export type AuthSession = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;

/** Authenticated user shape from the session payload, including additional fields. */
export type AuthUser = AuthSession["user"];
