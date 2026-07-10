import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import {
  type AuthenticatedSessionContext,
  type AuthenticatedUserContext,
  getResolvedSession,
  type RequestSessionContext,
} from "./session-context.js";

function requireSession(context: ExecutionContext): RequestSessionContext {
  const request = context.switchToHttp().getRequest<Request>();
  const session = getResolvedSession(request);

  if (!session) {
    throw new UnauthorizedException("Authentication required.");
  }

  return session;
}

/** Inject the full resolved session context (user + session) into a handler. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestSessionContext => requireSession(context),
);

/** Inject the authenticated user projection into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUserContext =>
    requireSession(context).user,
);

/** Inject the persisted session projection (id + expiry) into a handler. */
export const CurrentAuthSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSessionContext =>
    requireSession(context).session,
);

/** Inject the authenticated user's organization id into a handler. */
export const CurrentOrganizationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    requireSession(context).user.organizationId,
);
