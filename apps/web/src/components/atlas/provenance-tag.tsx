import {
  BookMarkedIcon,
  FileTextIcon,
  type LucideIcon,
  PencilLineIcon,
  SparklesIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ProvenanceKind = "source" | "reference" | "manual" | "ai";

const PROVENANCE_META: Record<ProvenanceKind, { label: string; icon: LucideIcon }> = {
  source: { label: "Source", icon: FileTextIcon },
  reference: { label: "Reference", icon: BookMarkedIcon },
  manual: { label: "Manual", icon: PencilLineIcon },
  ai: { label: "AI", icon: SparklesIcon },
};

export type ProvenanceTagProps = ComponentProps<"span"> & {
  kind: ProvenanceKind;
  variant?: "ghost" | "outline";
  label?: string;
};

export function ProvenanceTag({
  kind,
  variant = "ghost",
  label,
  className,
  ...props
}: ProvenanceTagProps) {
  const meta = PROVENANCE_META[kind];
  const Icon = meta.icon;

  return (
    <span
      data-slot="provenance-tag"
      data-kind={kind}
      className={cn(
        "inline-flex w-fit items-center gap-1 align-middle text-xs font-medium text-muted-foreground [&_svg]:size-3 [&_svg]:shrink-0",
        variant === "outline" && "rounded-md border border-border bg-card/50 px-1.5 py-0.5",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className={kind === "ai" ? "text-primary-strong" : undefined} />
      {label ?? meta.label}
    </span>
  );
}

export const PROVENANCE_KINDS: ProvenanceKind[] = ["source", "reference", "manual", "ai"];
