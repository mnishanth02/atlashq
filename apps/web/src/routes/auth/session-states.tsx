import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

/**
 * Shown while the authenticated layout's `beforeLoad` guard is verifying the
 * session. Router `pendingMs`/`pendingMinMs` keep this from flashing on fast
 * responses; see `router.tsx`.
 */
export function SessionLoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground"
    >
      <Spinner className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Checking your session…</p>
    </div>
  );
}

/**
 * Shown when the authenticated layout's `beforeLoad` guard fails to verify the
 * session (network/server error) rather than simply finding no session (which
 * instead redirects to `/login`).
 */
export function SessionErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <Empty className="max-w-sm border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Couldn&apos;t verify your session</EmptyTitle>
          <EmptyDescription>
            AtlasHQ couldn&apos;t reach the authentication service. Check your connection and try
            again.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRetry}>
            <RotateCwIcon />
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
