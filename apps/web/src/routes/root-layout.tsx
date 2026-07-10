import { Outlet } from "@tanstack/react-router";

/**
 * Root route component. Deliberately chrome-less: unauthenticated routes
 * (`/login`, `/design-system`) and the authenticated layout (`AppShell`) each
 * own their own header/navigation, so this only establishes the page's base
 * background/text tokens and renders the matched child route.
 */
export function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}
