import { cva, type VariantProps } from "class-variance-authority";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  type LucideIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type EpistemicStatus = "confirmed" | "assumed" | "unknown" | "conflicting";
export type EpistemicAppearance = "subtle" | "solid" | "outline";

type StatusMeta = {
  label: string;
  icon: LucideIcon;
  subtle: string;
  solid: string;
  outline: string;
};

const STATUS_META: Record<EpistemicStatus, StatusMeta> = {
  confirmed: {
    label: "Confirmed",
    icon: CircleCheckIcon,
    subtle: "border-confirmed-border bg-confirmed-subtle text-confirmed-strong",
    solid: "border-transparent bg-confirmed text-confirmed-foreground",
    outline: "border-confirmed-border bg-transparent text-confirmed-strong",
  },
  assumed: {
    label: "Assumed",
    icon: CircleDashedIcon,
    subtle: "border-assumed-border bg-assumed-subtle text-assumed-strong",
    solid: "border-transparent bg-assumed text-assumed-foreground",
    outline: "border-assumed-border bg-transparent text-assumed-strong",
  },
  unknown: {
    label: "Unknown",
    icon: CircleHelpIcon,
    subtle: "border-unknown-border bg-unknown-subtle text-unknown-strong",
    solid: "border-transparent bg-unknown text-unknown-foreground",
    outline: "border-unknown-border bg-transparent text-unknown-strong",
  },
  conflicting: {
    label: "Conflicting",
    icon: TriangleAlertIcon,
    subtle: "border-conflicting-border bg-conflicting-subtle text-conflicting-strong",
    solid: "border-transparent bg-conflicting text-conflicting-foreground",
    outline: "border-conflicting-border bg-transparent text-conflicting-strong",
  },
};

const epistemicBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border font-medium uppercase leading-none tracking-[0.06em] whitespace-nowrap align-middle [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "h-5 px-1.5 text-[0.625rem] [&_svg]:size-3",
        md: "h-6 px-2 text-[0.6875rem] [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type EpistemicBadgeProps = ComponentProps<"span"> &
  VariantProps<typeof epistemicBadgeVariants> & {
    status: EpistemicStatus;
    appearance?: EpistemicAppearance;
    showIcon?: boolean;
    label?: string;
  };

export function EpistemicBadge({
  status,
  appearance = "subtle",
  size,
  showIcon = true,
  label,
  className,
  ...props
}: EpistemicBadgeProps) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      data-slot="epistemic-badge"
      data-status={status}
      className={cn(epistemicBadgeVariants({ size }), meta[appearance], className)}
      {...props}
    >
      {showIcon ? <Icon aria-hidden="true" /> : null}
      {label ?? meta.label}
    </span>
  );
}

export const EPISTEMIC_STATUSES: EpistemicStatus[] = [
  "confirmed",
  "assumed",
  "unknown",
  "conflicting",
];
