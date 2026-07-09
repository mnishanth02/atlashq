import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type LifecycleStatus =
  | "draft"
  | "ai-suggested"
  | "under-review"
  | "needs-clarification"
  | "accepted"
  | "approved"
  | "rejected"
  | "changed"
  | "deprecated";

type Tone = "neutral" | "brand" | "progress" | "caution" | "positive" | "affirm" | "negative";

const TONE_CLASS: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/70" },
  brand: { pill: "border-primary/25 bg-primary/10 text-primary-strong", dot: "bg-primary" },
  progress: {
    pill: "border-sev-low-border bg-sev-low-subtle text-sev-low-strong",
    dot: "bg-sev-low",
  },
  caution: {
    pill: "border-assumed-border bg-assumed-subtle text-assumed-strong",
    dot: "bg-assumed",
  },
  positive: {
    pill: "border-confirmed-border bg-confirmed-subtle text-confirmed-strong",
    dot: "bg-confirmed",
  },
  affirm: {
    pill: "border-transparent bg-confirmed text-confirmed-foreground",
    dot: "bg-confirmed-foreground/80",
  },
  negative: {
    pill: "border-conflicting-border bg-conflicting-subtle text-conflicting-strong",
    dot: "bg-conflicting",
  },
};

const STATUS_META: Record<LifecycleStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  "ai-suggested": { label: "AI-suggested", tone: "brand" },
  "under-review": { label: "Under review", tone: "progress" },
  "needs-clarification": { label: "Needs clarification", tone: "caution" },
  accepted: { label: "Accepted", tone: "positive" },
  approved: { label: "Approved", tone: "affirm" },
  rejected: { label: "Rejected", tone: "negative" },
  changed: { label: "Changed", tone: "caution" },
  deprecated: { label: "Deprecated", tone: "neutral" },
};

const statusPillVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border font-medium leading-none whitespace-nowrap align-middle",
  {
    variants: {
      size: {
        sm: "h-5 px-2 text-[0.6875rem]",
        md: "h-6 px-2.5 text-xs",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type StatusPillProps = ComponentProps<"span"> &
  VariantProps<typeof statusPillVariants> & {
    status: LifecycleStatus;
    showDot?: boolean;
    label?: string;
  };

export function StatusPill({
  status,
  size,
  showDot = true,
  label,
  className,
  ...props
}: StatusPillProps) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASS[meta.tone];

  return (
    <span
      data-slot="status-pill"
      data-status={status}
      className={cn(statusPillVariants({ size }), tone.pill, className)}
      {...props}
    >
      {showDot ? (
        <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden="true" />
      ) : null}
      {label ?? meta.label}
    </span>
  );
}

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  "draft",
  "ai-suggested",
  "under-review",
  "needs-clarification",
  "accepted",
  "approved",
  "rejected",
  "changed",
  "deprecated",
];
