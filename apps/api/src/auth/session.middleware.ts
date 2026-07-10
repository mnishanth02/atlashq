import type { Auth } from "@atlashq/auth";
import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AUTH_INSTANCE } from "../runtime/runtime.js";
import { resolveRequestSession } from "./session-context.js";

/**
 * Resolves the Better Auth session once per request and caches it on the request
 * object. Enforcement is left to {@link AuthenticatedGuard}; this middleware only
 * makes the session context available to guards, decorators, and controllers.
 */
@Injectable()
export class SessionResolutionMiddleware implements NestMiddleware {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth | null) {}

  async use(request: Request, _response: Response, next: NextFunction): Promise<void> {
    if (this.auth) {
      await resolveRequestSession(this.auth, request);
    }

    next();
  }
}
