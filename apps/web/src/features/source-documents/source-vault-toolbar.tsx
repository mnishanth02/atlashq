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
import type { SourceDocumentsSearch } from "@/routes/projects/source-documents-search";
import type {
  SourceFormat,
  SourceIpReviewStatus,
  SourceProcessingStatus,
  SourceType,
} from "./sources-api";

export const ANY_VALUE = "any";

const TYPE_OPTIONS: readonly { value: SourceType | typeof ANY_VALUE; label: string }[] = [
  { value: ANY_VALUE, label: "All types" },
  { value: "document", label: "Document" },
  { value: "reference", label: "Reference" },
  { value: "manual", label: "Manual text" },
];

const FORMAT_OPTIONS: readonly { value: SourceFormat | typeof ANY_VALUE; label: string }[] = [
  { value: ANY_VALUE, label: "All formats" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "txt", label: "Plain text" },
  { value: "md", label: "Markdown" },
  { value: "xlsx", label: "XLSX" },
  { value: "csv", label: "CSV" },
  { value: "pptx", label: "PPTX" },
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
];

const STATUS_OPTIONS: readonly {
  value: SourceProcessingStatus | typeof ANY_VALUE;
  label: string;
}[] = [
  { value: ANY_VALUE, label: "All processing" },
  { value: "verification_pending", label: "Verification pending" },
  { value: "scan_pending", label: "Scan pending" },
  { value: "scanning", label: "Scanning" },
  { value: "extraction_pending", label: "Extraction pending" },
  { value: "extracting", label: "Extracting" },
  { value: "ready", label: "Ready" },
  { value: "quarantined", label: "Quarantined" },
  { value: "failed", label: "Failed" },
];

const IP_REVIEW_OPTIONS: readonly {
  value: SourceIpReviewStatus | typeof ANY_VALUE;
  label: string;
}[] = [
  { value: ANY_VALUE, label: "Any IP review" },
  { value: "not_reviewed", label: "Not reviewed" },
  { value: "cleared", label: "Cleared" },
  { value: "restricted", label: "Restricted" },
];

export type SourceVaultToolbarProps = {
  search: SourceDocumentsSearch;
  hasActiveFilters: boolean;
  disabled?: boolean;
  onChange: (partial: Partial<SourceDocumentsSearch>) => void;
  onReset: () => void;
};

export function SourceVaultToolbar({
  search,
  hasActiveFilters,
  disabled = false,
  onChange,
  onReset,
}: SourceVaultToolbarProps) {
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
            Search sources
          </Label>
          <Input
            id={searchId}
            type="search"
            className="pl-9"
            placeholder="Search title, ID, filename, or reference host"
            value={search.q ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onChange({ q: event.target.value.length > 0 ? event.target.value : undefined })
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={search.type ?? ANY_VALUE}
            disabled={disabled}
            onValueChange={(value) =>
              onChange({ type: value === ANY_VALUE ? undefined : (value as SourceType) })
            }
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by source type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Type</SelectLabel>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={search.format ?? ANY_VALUE}
            disabled={disabled}
            onValueChange={(value) =>
              onChange({
                format: value === ANY_VALUE ? undefined : (value as SourceFormat),
              })
            }
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Format</SelectLabel>
                {FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={search.status ?? ANY_VALUE}
            disabled={disabled}
            onValueChange={(value) =>
              onChange({
                status: value === ANY_VALUE ? undefined : (value as SourceProcessingStatus),
              })
            }
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by processing status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Processing</SelectLabel>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={search.ipReview ?? ANY_VALUE}
            disabled={disabled}
            onValueChange={(value) =>
              onChange({
                ipReview: value === ANY_VALUE ? undefined : (value as SourceIpReviewStatus),
              })
            }
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by IP review">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>IP review</SelectLabel>
                {IP_REVIEW_OPTIONS.map((option) => (
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
            checked={Boolean(search.includeArchived)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ includeArchived: checked ? true : undefined })}
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

export function hasActiveVaultFilters(search: SourceDocumentsSearch): boolean {
  return Boolean(
    search.q ||
      search.type ||
      search.format ||
      search.status ||
      search.ipReview ||
      search.includeArchived,
  );
}
