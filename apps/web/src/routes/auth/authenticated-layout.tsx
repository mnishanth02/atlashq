import type { ErrorRouteProps } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/auth-client";
import { evaluateAuthenticatedGuard } from "./session-guard";
import { SessionErrorState } from "./session-states";

/**
 * Session guard for the authenticated layout route. Redirects unauthenticated
 * visitors to `/login` with a safe `redirect` search param; re-throws session
 * fetch failures so the route's `errorComponent` (below) can render an explicit,
 * retryable error state instead of silently redirecting to `/login`.
 */
export async function authenticatedBeforeLoad({ location }: { location: { href: string } }) {
  const { data, error } = await getSession();

  if (error) {
    throw new Error("Unable to verify your session. Please try again.");
  }

  const outcome = evaluateAuthenticatedGuard(!!data, location.href);

  if (outcome.kind === "redirect-to-login") {
    throw redirect({ to: "/login", search: { redirect: outcome.redirect } });
  }
}

export function AuthenticatedErrorComponent({ reset }: ErrorRouteProps) {
  return <SessionErrorState onRetry={reset} />;
}
