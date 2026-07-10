"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { OrganizationUserListResponse } from "@/features/api";
import { useOrganizationUsersQuery } from "@/features/api";
import { cn } from "@/lib/utils";

export type OrganizationUserOption = OrganizationUserListResponse["items"][number];

const SEARCH_RESULT_LIMIT = 25;
const DEFAULT_PLACEHOLDER = "Search by name or email\u2026";

export type OrganizationUserPickerProps = {
  id?: string;
  value: OrganizationUserOption | null;
  onSelect: (user: OrganizationUserOption) => void;
  /** User ids to hide from the results, e.g. members already added to the project. */
  excludeUserIds?: readonly string[];
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  "aria-describedby"?: string;
};

/**
 * Accessible, query-backed combobox for selecting an active organization user.
 * Only ever offers users returned by the directory search API - never fabricates
 * entries from free text input.
 */
export function OrganizationUserPicker({
  id,
  value,
  onSelect,
  excludeUserIds = [],
  disabled = false,
  invalid = false,
  placeholder = DEFAULT_PLACEHOLDER,
  ...rest
}: OrganizationUserPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const trimmedSearch = deferredSearch.trim();

  const usersQuery = useOrganizationUsersQuery({
    status: "active",
    limit: SEARCH_RESULT_LIMIT,
    ...(trimmedSearch ? { search: trimmedSearch } : {}),
  });

  const excluded = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);
  const items = useMemo(
    () => (usersQuery.data?.items ?? []).filter((user) => !excluded.has(user.id)),
    [usersQuery.data, excluded],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="w-full justify-between font-normal"
          {...rest}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? `${value.name} \u00b7 ${value.email}` : placeholder}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false} label="Search organization members">
          <CommandInput value={search} onValueChange={setSearch} placeholder={placeholder} />
          <CommandList>
            {usersQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Spinner />
                {"Loading organization members\u2026"}
              </div>
            ) : usersQuery.isError ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm">
                <span className="text-destructive">Couldn't load organization members.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => usersQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : items.length === 0 ? (
              <CommandEmpty>
                {trimmedSearch ? "No members match your search." : "No members available."}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {items.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => {
                      onSelect(user);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <CheckIcon
                      className={cn("mr-1", value?.id === user.id ? "opacity-100" : "opacity-0")}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
