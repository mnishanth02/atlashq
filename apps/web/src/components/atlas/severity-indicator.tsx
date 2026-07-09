import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type SeverityAppearance = "subtle" | "solid" | "outline";

type SeverityMeta = {
  label: string;
  dot: string;
  subtle: string;
  solid: string;
  outline: string;
};

const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critical: {
    label: "Critical",
    dot: "bg-sev-critical",
    subtle: "border-sev-critical-border bg-sev-critical-subtle text-sev-critical-strong",
    solid: "border-transparent bg-sev-critical text-sev-critical-foreground",
    outline: "border-sev-critical-border bg-transparent text-sev-critical-strong",
  },
  high: {
    label: "High",
    dot: "bg-sev-high",
    subtle: "border-sev-high-border bg-sev-high-subtle text-sev-high-strong",
    solid: "border-transparent bg-sev-high text-sev-high-foreground",
    outline: "border-sev-high-border bg-transparent text-sev-high-strong",
  },
  medium: {
    label: "Medium",
    dot: "bg-sev-medium",
    subtle: "border-sev-medium-border bg-sev-medium-subtle text-sev-medium-strong",
    solid: "border-transparent bg-sev-medium text-sev-medium-foreground",
    outline: "border-sev-medium-border bg-transparent text-sev-medium-strong",
  },
  low: {
    label: "Low",
    dot: "bg-sev-low",
    subtle: "border-sev-low-border bg-sev-low-subtle text-sev-low-strong",
    solid: "border-transparent bg-sev-low text-sev-low-foreground",
    outline: "border-sev-low-border bg-transparent text-sev-low-strong",
  },
  info: {
    label: "Info",
    dot: "bg-sev-info",
    subtle: "border-sev-info-border bg-sev-info-subtle text-sev-info-strong",
    solid: "border-transparent bg-sev-info text-sev-info-foreground",
    outline: "border-sev-info-border bg-transparent text-sev-info-strong",
  },
};

const severityBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border font-medium leading-none whitespace-nowrap align-middle",
  {
    variants: {
      size: {
        sm: "h-5 px-1.5 text-[0.6875rem]",
        md: "h-6 px-2 text-xs",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type SeverityIndicatorProps = ComponentProps<"span"> &
  VariantProps<typeof severityBadgeVariants> & {
    severity: Severity;
    appearance?: SeverityAppearance;
    format?: "badge" | "dot";
    showDot?: boolean;
    label?: string;
  };

export function SeverityIndicator({
  severity,
  appearance = "subtle",
  size,
  format = "badge",
  showDot = true,
  label,
  className,
  ...props
}: SeverityIndicatorProps) {
  const meta = SEVERITY_META[severity];
  const text = label ?? meta.label;

  if (format === "dot") {
    return (
      <span
        data-slot="severity-indicator"
        data-severity={severity}
        className={cn("inline-flex items-center gap-1.5 align-middle", className)}
        {...props}
      >
        <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
        <span className="text-xs font-medium text-foreground">{text}</span>
      </span>
    );
  }

  return (
    <span
      data-slot="severity-indicator"
      data-severity={severity}
      className={cn(severityBadgeVariants({ size }), meta[appearance], className)}
      {...props}
    >
      {showDot ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            appearance === "solid" ? "bg-current opacity-80" : meta.dot,
          )}
          aria-hidden="true"
        />
      ) : null}
      {text}
    </span>
  );
}

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];
