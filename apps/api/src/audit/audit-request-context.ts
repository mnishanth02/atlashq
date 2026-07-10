import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { correlationIdHeader } from "@atlashq/logger";
import type { OrganizationId, UserId } from "@atlashq/types";
import type { RequestSessionContext } from "../auth/session-context.js";

/** Audit actor (organization + user) derived from the resolved authenticated session. */
export type AuditActor = {
  organizationId: OrganizationId;
  actorId: UserId;
};

/** Derive the audit actor from the resolved authenticated session for the current request. */
export function resolveAuditActor(session: RequestSessionContext): AuditActor {
  return {
    organizationId: session.user.organizationId,
    actorId: session.user.id,
  };
}

type CorrelationIdCarrier = {
  /** The request id pino-http assigns via `genReqId` (see `@atlashq/logger`). */
  id?: unknown;
  headers: IncomingHttpHeaders;
};

function firstNonEmpty(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value.trim().length > 0 ? value : undefined;
  }

  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0);
  }

  return undefined;
}

/**
 * Resolve the correlation id to record on an audit event.
 *
 * Preference order: the request id pino-http already assigned (`request.id`, itself derived from
 * the `x-correlation-id` header or a generated id — see `createPinoRequestLogger`), then the
 * `x-correlation-id` header read directly (covers requests the request logger never saw, such as
 * in unit tests), then an explicit generated fallback. Correlation ids are intentionally treated
 * as arbitrary non-empty external strings and are never assumed, parsed, or validated as UUIDs.
 */
export function resolveAuditCorrelationId(request: CorrelationIdCarrier): string {
  if (typeof request.id === "string" && request.id.trim().length > 0) {
    return request.id;
  }

  const header = firstNonEmpty(request.headers[correlationIdHeader]);
  if (header) {
    return header;
  }

  return randomUUID();
}

/** Combined actor + correlation context a feature service needs to build an audit input. */
export type AuditRequestContext = {
  actor: AuditActor;
  correlationId: string;
};

/** Resolve both the audit actor and correlation id for the current request in one call. */
export function resolveAuditRequestContext(
  session: RequestSessionContext,
  request: CorrelationIdCarrier,
): AuditRequestContext {
  return {
    actor: resolveAuditActor(session),
    correlationId: resolveAuditCorrelationId(request),
  };
}
