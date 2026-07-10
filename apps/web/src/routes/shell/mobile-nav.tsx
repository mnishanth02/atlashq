import { Link } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "./nav-config";
import { OrgContextSlot } from "./org-context";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open navigation">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-base">AtlasHQ</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3" aria-label="Primary">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground hover:bg-accent data-[status=active]:bg-accent"
            >
              <item.icon className="text-muted-foreground" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-border p-3">
          {SECONDARY_NAV_ITEMS.map((item) => (
            <Button
              key={item.to}
              variant="ghost"
              className="justify-start gap-2.5 px-2.5"
              disabled={item.disabled}
              title={item.disabledReason}
            >
              <item.icon className="text-muted-foreground" />
              {item.label}
            </Button>
          ))}
          <OrgContextSlot />
        </div>
      </SheetContent>
    </Sheet>
  );
}
