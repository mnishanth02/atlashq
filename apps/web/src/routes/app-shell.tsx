import { Link, Outlet } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useSession } from "@/lib/auth-client";
import { AppBreadcrumbs } from "./shell/breadcrumbs";
import { MobileNav } from "./shell/mobile-nav";
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "./shell/nav-config";
import { OrgContextSlot } from "./shell/org-context";
import { UserMenu } from "./shell/user-menu";

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

/**
 * Authenticated product shell: a desktop nav rail (collapses to a `Sheet` on
 * mobile via `MobileNav`), a header with breadcrumbs/org-context/theme/user
 * affordances, and the routed `<Outlet />`. Rendered only once
 * `authenticatedBeforeLoad` (see `routes/auth/authenticated-layout.tsx`) has
 * confirmed a session exists, so `user` is expected to be defined — the `?.`
 * fallbacks below only guard the brief instant before `useSession()` resolves
 * its own cache.
 */
export function AppShell() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/80 bg-card/40 md:flex">
          <div className="flex h-14 items-center gap-2.5 border-b border-border/80 px-5">
            <AtlasMark className="size-6" />
            <span className="text-[0.95rem] font-semibold tracking-tight">AtlasHQ</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent data-[status=active]:bg-accent"
              >
                <item.icon className="text-muted-foreground" />
                {item.label}
              </Link>
            ))}
            <div className="mt-1 flex flex-col gap-1 border-t border-border/70 pt-2">
              {SECONDARY_NAV_ITEMS.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  disabled={item.disabled}
                  title={item.disabledReason}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <item.icon />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
          <div className="border-t border-border/80 p-3">
            <OrgContextSlot />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-md md:px-6">
            <MobileNav />
            <div className="min-w-0 flex-1">
              <AppBreadcrumbs />
            </div>
            <ThemeToggle />
            <UserMenu user={user} />
          </header>
          <main className="min-w-0 flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
