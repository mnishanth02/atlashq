import { Building2Icon, CircleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentOrganizationQuery } from "@/features/api";
import { getOrganizationContextPresentation } from "./organization-context-model";

export function OrgContextSlot() {
  const organizationQuery = useCurrentOrganizationQuery();
  const presentation = getOrganizationContextPresentation({
    organization: organizationQuery.data,
    isPending: organizationQuery.isPending,
    isError: organizationQuery.isError,
  });

  return (
    <Button
      variant="outline"
      className="h-auto w-full justify-start gap-2 px-2.5 py-2 text-left"
      disabled
      title="This is your current organization. Organization switching isn't available."
      aria-busy={presentation.state === "loading"}
    >
      {presentation.state === "error" ? (
        <CircleAlertIcon className="shrink-0 text-muted-foreground" />
      ) : (
        <Building2Icon className="shrink-0 text-muted-foreground" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium">{presentation.name}</span>
        {presentation.plan || presentation.role ? (
          <span className="flex flex-wrap items-center gap-1">
            {presentation.plan ? (
              <Badge variant="secondary" className="font-normal">
                {presentation.plan}
              </Badge>
            ) : null}
            {presentation.role ? (
              <Badge variant="outline" className="font-normal">
                {presentation.role}
              </Badge>
            ) : null}
          </span>
        ) : null}
      </span>
    </Button>
  );
}
