import type { Auth } from "@atlashq/auth";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AUTH_INSTANCE } from "../runtime/runtime.js";
import {
  getResolvedSession,
  type RequestSessionContext,
  resolveRequestSession,
} from "./session-context.js";

/** The only user status permitted to pass authentication. */
export const ACTIVE_USER_STATUS = "active";

/**
 * Pure authentication assertion. Rejects absent, expired, and non-active
 * (suspended/archived) sessions. Kept separate from the guard so the security
 * decision can be unit tested without a NestJS execution context. Errors are
 * intentionally generic so they do not disclose whether a session existed.
 */
export function assertAuthenticatedSession(
  session: RequestSessionContext | null,
  now: number = Date.now(),
): asserts session is RequestSessionContext {
  if (!session) {
    throw new UnauthorizedException("Authentication required.");
  }

  if (session.session.expiresAt.getTime() <= now) {
    throw new UnauthorizedException("Authentication required.");
  }

  if (session.user.status !== ACTIVE_USER_STATUS) {
    throw new ForbiddenException("Account is not active.");
  }
}

/**
 * Guard that requires a valid, active authenticated session. It relies on the
 * session-resolution middleware but also resolves on demand so it stays correct
 * (and testable) when used on a route the middleware did not cover.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth | null) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    let session = getResolvedSession(request);

    if (!session && this.auth) {
      session = await resolveRequestSession(this.auth, request);
    }

    assertAuthenticatedSession(session);
    return true;
  }
}
