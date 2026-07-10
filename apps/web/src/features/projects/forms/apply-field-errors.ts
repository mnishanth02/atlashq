import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { AtlasApiError } from "@/features/api";

/**
 * Structural guard for {@link AtlasApiError}. Checked by shape (name + Error)
 * rather than `instanceof` so this module — and its unit tests — stay free of a
 * runtime dependency on the API client (the test runner does not resolve the
 * `@/` alias for value imports).
 */
function isAtlasApiError(error: unknown): error is AtlasApiError {
  return error instanceof Error && error.name === "AtlasApiError";
}

/**
 * Resolve a human-readable message for any thrown value. Prefers the Atlas API
 * error message, falls back to a generic native error message, then a default.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isAtlasApiError(error)) {
    return error.message;
  }
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  return fallback;
}

/**
 * Match a server error `path` (e.g. `["body", "clientId"]` or `["tags", 0]`) to
 * a known form field. Scans from the end so the most specific field segment
 * wins, and ignores numeric array indices.
 */
export function matchApiErrorField(
  path: ReadonlyArray<string | number>,
  knownFields: ReadonlySet<string>,
): string | undefined {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const segment = path[index];
    if (typeof segment === "string" && knownFields.has(segment)) {
      return segment;
    }
  }
  return undefined;
}

/**
 * Apply an {@link AtlasApiError}'s field-level `details` onto a React Hook Form
 * via `setError`, routing each issue to the matching form field. Returns the
 * number of field errors applied so the caller can fall back to a form-level
 * alert when the failure isn't field-specific (returns `0`).
 */
export function applyApiFieldErrors<TValues extends FieldValues>(
  setError: UseFormSetError<TValues>,
  error: unknown,
  knownFields: ReadonlyArray<Path<TValues>>,
): number {
  if (!isAtlasApiError(error) || !error.details) {
    return 0;
  }

  const known = new Set<string>(knownFields);
  let applied = 0;

  for (const detail of error.details) {
    const field = matchApiErrorField(detail.path, known);
    if (!field) {
      continue;
    }
    setError(field as Path<TValues>, { type: "server", message: detail.message });
    applied += 1;
  }

  return applied;
}
