import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ConfidenceLevel = "low" | "medium" | "high";

const LEVEL_META: Record<ConfidenceLevel, { label: string; filled: number }> = {
  low: { label: "Low", filled: 1 },
  medium: { label: "Medium", filled: 2 },
  high: { label: "High", filled: 3 },
};

const BAR_HEIGHTS = ["h-2", "h-2.5", "h-3"] as const;

function levelFromValue(value: number): ConfidenceLevel {
  if (value < 34) {
    return "low";
  }
  if (value < 67) {
    return "medium";
  }
  return "high";
}

export type ConfidenceMeterProps = Omit<ComponentProps<"span">, "children"> & {
  level?: ConfidenceLevel;
  value?: number;
  showLabel?: boolean;
  showValue?: boolean;
};

export function ConfidenceMeter({
  level,
  value,
  showLabel = true,
  showValue = false,
  className,
  ...props
}: ConfidenceMeterProps) {
  const resolved = level ?? (value != null ? levelFromValue(value) : "medium");
  const meta = LEVEL_META[resolved];

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="meter" is the correct ARIA role for this custom gauge; the native <meter> element renders a single continuous bar, not discrete signal bars
    <span
      data-slot="confidence-meter"
      data-level={resolved}
      role="meter"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={meta.filled}
      aria-valuetext={`${meta.label} confidence`}
      className={cn("inline-flex items-center gap-2 align-middle", className)}
      {...props}
    >
      <span className="flex h-3 items-end gap-[3px]" aria-hidden="true">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            className={cn(
              "w-1 rounded-full transition-colors",
              height,
              index < meta.filled ? "bg-foreground" : "bg-muted-foreground/25",
            )}
          />
        ))}
      </span>
      {showLabel ? (
        <span className="text-xs font-medium text-muted-foreground">
          {meta.label}
          {showValue && value != null ? (
            <span className="ml-1 font-mono text-muted-foreground">{Math.round(value)}%</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["low", "medium", "high"];
