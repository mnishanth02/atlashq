import { QuoteIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type ConfidenceLevel, ConfidenceMeter } from "./confidence-meter";
import { type ProvenanceKind, ProvenanceTag } from "./provenance-tag";

export type Evidence = {
  id: string;
  source: string;
  excerpt: string;
  locator?: string;
  provenance?: ProvenanceKind;
  confidence?: ConfidenceLevel;
};

export type EvidencePopoverProps = {
  evidence: Evidence;
  children: ReactNode;
  align?: "start" | "center" | "end" | undefined;
};

export function EvidencePopover({ evidence, children, align = "start" }: EvidencePopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <ProvenanceTag kind={evidence.provenance ?? "source"} />
          <span className="font-mono text-[0.6875rem] text-muted-foreground">{evidence.id}</span>
        </div>
        <div className="space-y-2.5 px-3 py-3">
          <p className="text-sm font-medium text-foreground">{evidence.source}</p>
          <figure className="relative rounded-md bg-muted/60 px-3 py-2.5">
            <QuoteIcon
              aria-hidden="true"
              className="absolute top-2 right-2 size-3.5 text-muted-foreground/30"
            />
            <blockquote className="text-sm leading-relaxed text-foreground/90 italic">
              {evidence.excerpt}
            </blockquote>
          </figure>
          {evidence.locator || evidence.confidence ? (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {evidence.locator ? (
                <span className="font-mono text-xs text-muted-foreground">{evidence.locator}</span>
              ) : (
                <span />
              )}
              {evidence.confidence ? <ConfidenceMeter level={evidence.confidence} /> : null}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type CitationChipProps = Omit<ComponentProps<"button">, "children"> & {
  evidence: Evidence;
  align?: "start" | "center" | "end";
};

export function CitationChip({ evidence, align, className, ...props }: CitationChipProps) {
  return (
    <EvidencePopover evidence={evidence} align={align}>
      <button
        type="button"
        data-slot="citation-chip"
        aria-label={`Evidence ${evidence.id} from ${evidence.source}`}
        className={cn(
          "inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 align-middle font-mono text-[0.6875rem] leading-none text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-3 [&_svg]:shrink-0",
          className,
        )}
        {...props}
      >
        <QuoteIcon aria-hidden="true" className="text-muted-foreground/70" />
        {evidence.id}
      </button>
    </EvidencePopover>
  );
}
