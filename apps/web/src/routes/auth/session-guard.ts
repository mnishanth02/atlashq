import { sanitizeRedirectTarget } from "../../lib/auth-redirect";

export type SessionGuardOutcome =
  | { kind: "allow" }
  | { kind: "redirect-to-login"; redirect: string }
  | { kind: "redirect-to-target"; href: string };

/**
 * Pure decision for the authenticated layout's `beforeLoad` guard: unauthenticated
 * visitors are sent to `/login` with the current location preserved as the `redirect`
 * search param (see `auth-redirect.ts` for how that param is later sanitized).
 */
export function evaluateAuthenticatedGuard(
  hasSession: boolean,
  currentHref: string,
): SessionGuardOutcome {
  if (hasSession) {
    return { kind: "allow" };
  }
  return { kind: "redirect-to-login", redirect: sanitizeRedirectTarget(currentHref) };
}

/**
 * Pure decision for the `/login` route's `beforeLoad` guard: an already-authenticated
 * visitor is redirected to their intended destination (defaulting to `/projects`)
 * instead of being shown the sign-in form again.
 */
export function evaluateLoginGuard(
  hasSession: boolean,
  redirectParam: string | undefined,
): SessionGuardOutcome {
  if (!hasSession) {
    return { kind: "allow" };
  }
  return { kind: "redirect-to-target", href: sanitizeRedirectTarget(redirectParam) };
}
