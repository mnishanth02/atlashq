import type { IncomingHttpHeaders } from "node:http";
import { type Auth, getSessionFromNodeHeaders, type ResolvedAuthSession } from "@atlashq/auth";

/** Authenticated user projection attached to the per-request context. */
export type AuthenticatedUserContext = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationRole: string;
  status: string;
};

/** Minimal session projection (identity + expiry) attached to the request. */
export type AuthenticatedSessionContext = {
  id: string;
  expiresAt: Date;
};

/** Typed, per-request authentication context resolved from Better Auth. */
export type RequestSessionContext = {
  user: AuthenticatedUserContext;
  session: AuthenticatedSessionContext;
};

type SessionResolutionState = {
  context: RequestSessionContext | null;
};

/**
 * Per-request cache so the Better Auth session is resolved at most once per
 * request regardless of how many middleware/guards/decorators consult it. Keyed
 * by the request object itself so there is no risk of colliding with other
 * request properties and no need to augment Express types.
 */
const sessionStates = new WeakMap<object, SessionResolutionState>();

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string | number);
}

/**
 * Convert a raw Better Auth session (or `null`) into the narrow, stable request
 * context. `organizationId` is a required additional field; `organizationRole`
 * and `status` are read defensively so a missing/invalid `status` never presents
 * as an active user.
 */
export function normalizeSession(resolved: ResolvedAuthSession): RequestSessionContext | null {
  if (!resolved) {
    return null;
  }

  const { user, session } = resolved;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: readString(user.organizationId, ""),
      organizationRole: readString(user.organizationRole, "member"),
      status: readString(user.status, ""),
    },
    session: {
      id: session.id,
      expiresAt: toDate(session.expiresAt),
    },
  };
}

type HeaderCarrier = { headers: IncomingHttpHeaders };

/**
 * Resolve and cache the session for a request. Idempotent: subsequent calls for
 * the same request object return the cached context without re-querying.
 */
export async function resolveRequestSession(
  auth: Auth,
  request: HeaderCarrier,
): Promise<RequestSessionContext | null> {
  const cached = sessionStates.get(request);
  if (cached) {
    return cached.context;
  }

  const resolved = await getSessionFromNodeHeaders(auth, request.headers);
  const context = normalizeSession(resolved);
  sessionStates.set(request, { context });
  return context;
}

/** Return the already-resolved session context for a request, if any. */
export function getResolvedSession(request: object): RequestSessionContext | null {
  return sessionStates.get(request)?.context ?? null;
}
