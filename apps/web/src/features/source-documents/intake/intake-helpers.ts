import { formatByteSize } from "../source-presentation";
import type { DuplicateMatch } from "../sources-api";

/**
 * Format a duplicate match for the acknowledgement dialog. Never merges
 * silently; every match must be listed with its identifying attributes so the
 * user has to explicitly acknowledge each one.
 */
export function summarizeDuplicateMatches(matches: readonly DuplicateMatch[]): string {
  if (matches.length === 0) return "";
  return matches
    .map((m) => `${m.title} · v${m.versionNumber} (${m.sourceId.slice(0, 8)})`)
    .join("\n");
}

export function acknowledgementIdsFromMatches(matches: readonly DuplicateMatch[]) {
  return matches.map((m) => m.sourceId);
}

export function formatFileSummary(file: File): string {
  return `${file.name} · ${formatByteSize(file.size)}`;
}
