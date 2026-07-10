import type { CurrentOrganizationResponse } from "@/features/api";

export type OrganizationContextPresentation = {
  name: string;
  plan: string | null;
  role: string | null;
  state: "ready" | "loading" | "error";
};

function formatLabel(value: string) {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  return normalized.length > 0
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "Not specified";
}

export function getOrganizationContextPresentation(input: {
  organization: CurrentOrganizationResponse | undefined;
  isPending: boolean;
  isError: boolean;
}): OrganizationContextPresentation {
  if (input.organization) {
    return {
      name: input.organization.name,
      plan: formatLabel(input.organization.plan),
      role: formatLabel(input.organization.role),
      state: "ready",
    };
  }

  if (input.isError) {
    return {
      name: "Organization unavailable",
      plan: "Couldn’t load context",
      role: null,
      state: "error",
    };
  }

  return {
    name: input.isPending ? "Loading organization…" : "Organization unavailable",
    plan: null,
    role: null,
    state: "loading",
  };
}
