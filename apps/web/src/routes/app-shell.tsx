import { Outlet } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";

function AtlasMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="AtlasHQ"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" className="stroke-primary" strokeWidth="1.5" opacity="0.9" />
      <path
        d="M12 2.5V21.5M2.5 12H21.5"
        className="stroke-primary"
        strokeWidth="1"
        opacity="0.35"
      />
      <rect
        x="8.6"
        y="8.6"
        width="6.8"
        height="6.8"
        rx="1"
        transform="rotate(45 12 12)"
        className="fill-primary"
      />
    </svg>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2.5">
            <AtlasMark className="size-6" />
            <span className="text-[0.95rem] font-semibold tracking-tight">AtlasHQ</span>
            <Badge
              variant="outline"
              className="ml-0.5 h-5 border-border/70 px-1.5 font-mono text-[0.625rem] font-medium text-muted-foreground"
            >
              Design System
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
