import { ChevronRightIcon } from "lucide-react";
import { type ComponentProps, Fragment } from "react";
import { cn } from "@/lib/utils";

export type TraceNode = {
  id: string;
  label: string;
  kind?: string;
  href?: string;
  current?: boolean;
  onSelect?: () => void;
};

export type TraceabilityChainProps = Omit<ComponentProps<"nav">, "children"> & {
  nodes: TraceNode[];
  label?: string;
};

function nodeClassName(node: TraceNode, interactive: boolean): string {
  return cn(
    "flex flex-col gap-1 rounded-md border px-2.5 py-1.5 text-left transition-colors",
    node.current
      ? "border-primary/30 bg-primary/10"
      : "border-transparent hover:border-border hover:bg-muted",
    interactive && "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
  );
}

function NodeBody({ node }: { node: TraceNode }) {
  return (
    <>
      {node.kind ? (
        <span className="text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {node.kind}
        </span>
      ) : null}
      <span
        className={cn(
          "font-mono text-xs font-medium leading-none",
          node.current ? "text-primary-strong" : "text-foreground",
        )}
      >
        {node.label}
      </span>
    </>
  );
}

export function TraceabilityChain({
  nodes,
  label = "Traceability",
  className,
  ...props
}: TraceabilityChainProps) {
  return (
    <nav aria-label={label} className={cn("w-full", className)} {...props}>
      <ol className="flex items-center gap-1 overflow-x-auto pb-1">
        {nodes.map((node, index) => {
          const ariaCurrent = node.current ? ("step" as const) : undefined;

          return (
            <Fragment key={node.id}>
              <li className="shrink-0">
                {node.href ? (
                  <a
                    href={node.href}
                    aria-current={ariaCurrent}
                    className={nodeClassName(node, true)}
                  >
                    <NodeBody node={node} />
                  </a>
                ) : node.onSelect ? (
                  <button
                    type="button"
                    onClick={node.onSelect}
                    aria-current={ariaCurrent}
                    className={nodeClassName(node, true)}
                  >
                    <NodeBody node={node} />
                  </button>
                ) : (
                  <span aria-current={ariaCurrent} className={nodeClassName(node, false)}>
                    <NodeBody node={node} />
                  </span>
                )}
              </li>
              {index < nodes.length - 1 ? (
                <li aria-hidden="true" className="shrink-0">
                  <ChevronRightIcon className="size-4 text-muted-foreground/40" />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
