import type { LucideIcon } from "lucide-react";
import { FolderKanbanIcon, SettingsIcon } from "lucide-react";

export type NavItem = {
  label: string;
  to: "/projects";
  icon: LucideIcon;
  /** Set when the affordance is visible but not wired up to a real destination yet. */
  disabled?: boolean;
  disabledReason?: string;
};

/** Primary product navigation, rendered in both the desktop rail and mobile sheet. */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Projects", to: "/projects", icon: FolderKanbanIcon },
];

/**
 * Settings/organization admin is intentionally not implemented yet. The affordance
 * stays visible (per product direction) but disabled, with a reason surfaced via
 * `title`/`aria-describedby` at the call site, so it isn't mistaken for a broken link.
 */
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  {
    label: "Settings & admin",
    to: "/projects",
    icon: SettingsIcon,
    disabled: true,
    disabledReason: "Settings and organization admin are not available yet.",
  },
];

/**
 * Maps a matched route's `fullPath` (see `router.tsx`) to a human-readable breadcrumb
 * label. `staticData` route options aren't available in the installed TanStack Router
 * version, so breadcrumbs are resolved from this lookup via `useMatches()` instead.
 */
export const ROUTE_BREADCRUMB_LABELS: Record<string, string> = {
  "/projects": "Projects",
  "/projects/$projectId": "Project",
  "/projects/$projectId/source-documents": "Source documents",
  "/projects/$projectId/source-documents/$sourceId": "Source document",
  "/projects/$projectId/requirement-analysis": "Requirement analysis",
  "/projects/$projectId/requirement-analysis/$runId": "Run",
};
