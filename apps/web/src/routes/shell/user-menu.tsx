import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { AuthUser } from "@/lib/auth-client";
import { signOut } from "@/lib/auth-client";
import { queryClient } from "@/state/query-client";

function getInitials(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) {
    return "?";
  }
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: { user: AuthUser | undefined }) {
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const result = await signOut();

      if (result.error || result.data?.success !== true) {
        toast.error("Couldn't sign out. Please try again.");
        return;
      }

      await navigate({ to: "/login", replace: true });
      // Clear only after the authenticated shell unmounts. Clearing while its
      // observers are active immediately refetches protected queries with the
      // already-cleared session and emits avoidable 401s in the browser.
      queryClient.clear();
    } catch {
      toast.error("Couldn't sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5" disabled={!user}>
          <Avatar size="sm">
            <AvatarImage src={user?.image ?? undefined} alt="" />
            <AvatarFallback>{getInitials(user?.name, user?.email)}</AvatarFallback>
          </Avatar>
          <span className="hidden flex-col items-start text-left leading-tight sm:flex">
            <span className="text-sm font-medium">{user?.name ?? "Unknown user"}</span>
            <span className="text-xs text-muted-foreground">{user?.email ?? ""}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {user?.name ?? "Unknown user"}
            </span>
            <span className="text-xs text-muted-foreground">{user?.email ?? "—"}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            disabled={isSigningOut}
            onSelect={(event) => {
              event.preventDefault();
              void handleSignOut();
            }}
          >
            {isSigningOut ? <Spinner /> : <LogOutIcon />}
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
