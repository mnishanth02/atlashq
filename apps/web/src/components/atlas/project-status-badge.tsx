import type { ProjectStatus } from "@atlashq/types";
import {
  ArchiveIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  type LucideIcon,
  PauseCircleIcon,
  RadioIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PROJECT_STATUS_PRESENTATION = {
  draft: { label: "Draft", icon: CircleDashedIcon, variant: "outline" },
  active: { label: "Active", icon: RadioIcon, variant: "secondary" },
  on_hold: { label: "On hold", icon: PauseCircleIcon, variant: "outline" },
  completed: { label: "Completed", icon: CheckCircle2Icon, variant: "secondary" },
  archived: { label: "Archived", icon: ArchiveIcon, variant: "outline" },
} as const satisfies Record<
  ProjectStatus,
  {
    label: string;
    icon: LucideIcon;
    variant: "outline" | "secondary";
  }
>;

export type ProjectStatusBadgeProps = {
  status: ProjectStatus;
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const presentation = PROJECT_STATUS_PRESENTATION[status];
  const Icon = presentation.icon;

  return (
    <Badge variant={presentation.variant} data-status={status}>
      <Icon data-icon="inline-start" />
      {presentation.label}
    </Badge>
  );
}
