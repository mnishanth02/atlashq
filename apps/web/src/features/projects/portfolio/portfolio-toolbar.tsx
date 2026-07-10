import { SearchIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  type PortfolioFilters,
  PROJECT_PRIORITY_FILTER_OPTIONS,
  PROJECT_SORT_OPTIONS,
  PROJECT_STATUS_FILTER_OPTIONS,
  PROJECT_TYPE_FILTER_OPTIONS,
} from "./portfolio-filter-model";

export type PortfolioToolbarProps = {
  filters: PortfolioFilters;
  search: string;
  hasActiveFilters: boolean;
  disabled?: boolean;
  onSearchChange: (value: string) => void;
  onFilterChange: <K extends keyof PortfolioFilters>(key: K, value: PortfolioFilters[K]) => void;
  onReset: () => void;
};

/** Search + type/status/priority filters + archived toggle for the portfolio. */
export function PortfolioToolbar({
  filters,
  search,
  hasActiveFilters,
  disabled = false,
  onSearchChange,
  onFilterChange,
  onReset,
}: PortfolioToolbarProps) {
  const searchId = useId();
  const archivedId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Label htmlFor={searchId} className="sr-only">
            Search projects
          </Label>
          <Input
            id={searchId}
            type="search"
            className="pl-9"
            placeholder="Search by name, client, or tag"
            value={search}
            disabled={disabled}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.type}
            disabled={disabled}
            onValueChange={(value) => onFilterChange("type", value as PortfolioFilters["type"])}
          >
            <SelectTrigger className="w-full sm:w-36" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Type</SelectLabel>
                {PROJECT_TYPE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            disabled={disabled}
            onValueChange={(value) => onFilterChange("status", value as PortfolioFilters["status"])}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Status</SelectLabel>
                {PROJECT_STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            disabled={disabled}
            onValueChange={(value) =>
              onFilterChange("priority", value as PortfolioFilters["priority"])
            }
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Priority</SelectLabel>
                {PROJECT_PRIORITY_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={filters.sort}
            disabled={disabled}
            onValueChange={(value) => onFilterChange("sort", value as PortfolioFilters["sort"])}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Sort projects">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Sort</SelectLabel>
                {PROJECT_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={archivedId}
            checked={filters.includeArchived}
            disabled={disabled}
            onCheckedChange={(checked) => onFilterChange("includeArchived", checked)}
          />
          <Label htmlFor={archivedId} className="text-sm text-muted-foreground">
            Include archived
          </Label>
        </div>

        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={disabled}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
