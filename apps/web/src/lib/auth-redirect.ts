const DEFAULT_REDIRECT_TARGET = "/projects";

/**
 * Guards against open-redirect vectors when a `redirect` search param is echoed back
 * as a navigation target. Only same-origin, root-relative paths are accepted:
 * rejects protocol-relative URLs (`//evil.example`), backslash tricks (`/\evil`),
 * and any absolute URL containing a scheme (`javascript:`, `https://evil.example`).
 */
export function isSafeRedirectTarget(candidate: unknown): candidate is string {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return false;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return false;
  }

  if (candidate.includes("://")) {
    return false;
  }

  return true;
}

/**
 * Resolves a candidate redirect target (typically the `redirect` search param read
 * from a route's `beforeLoad`) to a safe, same-origin path, falling back to
 * `/projects` when the candidate is missing or unsafe.
 */
export function sanitizeRedirectTarget(
  candidate: unknown,
  fallback: string = DEFAULT_REDIRECT_TARGET,
): string {
  return isSafeRedirectTarget(candidate) ? candidate : fallback;
}

export { DEFAULT_REDIRECT_TARGET };
