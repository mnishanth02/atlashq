import type { IncomingHttpHeaders } from "node:http";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import type { Auth } from "./config.js";

/**
 * Create the Node/Express request handler for the Better Auth instance. Wrapping
 * `toNodeHandler` here keeps `better-auth/node` internals out of the API app.
 */
export function createAuthNodeHandler(auth: Auth) {
  return toNodeHandler(auth);
}

/**
 * Resolve the current session (if any) from raw Node request headers/cookies. Returns
 * `null` when there is no valid, unexpired session.
 */
export function getSessionFromNodeHeaders(auth: Auth, headers: IncomingHttpHeaders) {
  return auth.api.getSession({ headers: fromNodeHeaders(headers) });
}

export type ResolvedAuthSession = Awaited<ReturnType<typeof getSessionFromNodeHeaders>>;
