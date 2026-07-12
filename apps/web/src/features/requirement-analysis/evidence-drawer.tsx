import { QuoteIcon } from "lucide-react";
import { useState } from "react";
import { CitationChip } from "@/components/atlas";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { CitationListItem, CitationListQuery } from "./requirement-analysis-api";
import {
  useAnalysisCitationEvidenceQuery,
  useAnalysisCitationsQuery,
} from "./requirement-analysis-hooks";
import { formatCitationVerificationStatus } from "./requirement-analysis-presentation";

export type EvidenceDrawerFilter = Pick<
  CitationListQuery,
  "requirementId" | "deliveryItemId" | "coverageMatrixEntryId"
>;

export type EvidenceDrawerProps = {
  projectId: string;
  runId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: EvidenceDrawerFilter;
};

function toCitationChipEvidence(citation: CitationListItem) {
  const locatorEntries = Object.entries(citation.locator ?? {});
  const locator =
    locatorEntries.length > 0
      ? locatorEntries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ")
      : undefined;
  return {
    id: citation.id,
    source: `Source chunk #${citation.sourceChunkSequence}`,
    excerpt: citation.quoteTextOriginal,
    ...(locator !== undefined ? { locator } : {}),
    provenance: "source" as const,
  };
}

/**
 * Sheet-based evidence drawer (task requirement #4): renders the full rich
 * citation provenance (content hashes, extraction/chunk identifiers, quote
 * offsets, verification status) that the shared `Evidence` type intentionally
 * doesn't carry. Lists every citation matching the filter, then expands the
 * selected one with `useAnalysisCitationEvidenceQuery`.
 */
export function EvidenceDrawer({
  projectId,
  runId,
  title,
  open,
  onOpenChange,
  filter,
}: EvidenceDrawerProps) {
  const [selectedCitationId, setSelectedCitationId] = useState<string | undefined>(undefined);
  const citationsQuery = useAnalysisCitationsQuery(projectId, runId, filter);
  const evidenceQuery = useAnalysisCitationEvidenceQuery(
    projectId,
    runId,
    selectedCitationId,
    Boolean(selectedCitationId),
  );

  const citations = citationsQuery.data?.items ?? [];

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedCitationId(undefined);
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Evidence — {title}</SheetTitle>
          <SheetDescription>
            Verified citations back to the frozen source snapshot for this run. Traceability only —
            no accept, edit, or reject actions live here.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          {citationsQuery.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : citations.length === 0 ? (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <QuoteIcon />
                </EmptyMedia>
                <EmptyTitle>No citations recorded</EmptyTitle>
                <EmptyDescription>
                  This artifact has no verified citations from the current run.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {citations.map((citation) => (
                <CitationChip
                  key={citation.id}
                  evidence={toCitationChipEvidence(citation)}
                  aria-pressed={selectedCitationId === citation.id}
                  onClick={() => setSelectedCitationId(citation.id)}
                />
              ))}
            </div>
          )}

          {selectedCitationId ? (
            evidenceQuery.isPending ? (
              <Skeleton className="h-64 w-full" />
            ) : evidenceQuery.data ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-md border border-border p-3 text-sm">
                <dt className="col-span-2 font-medium text-foreground">
                  {evidenceQuery.data.sourceTitle} · {evidenceQuery.data.sourceVersionLabel}
                </dt>
                <dd className="col-span-2 rounded bg-muted/60 p-2 text-xs leading-relaxed text-foreground/90 italic">
                  “{evidenceQuery.data.quoteTextOriginal}”
                </dd>
                <dt className="text-muted-foreground">Verification</dt>
                <dd>{formatCitationVerificationStatus(evidenceQuery.data.verificationStatus)}</dd>
                <dt className="text-muted-foreground">Normalization mode</dt>
                <dd className="font-mono text-xs">{evidenceQuery.data.normalizationMode}</dd>
                <dt className="text-muted-foreground">Match offsets</dt>
                <dd className="font-mono text-xs">
                  {evidenceQuery.data.matchStartOffset}–{evidenceQuery.data.matchEndOffset}
                </dd>
                <dt className="text-muted-foreground">Source extraction</dt>
                <dd className="font-mono text-xs">
                  {evidenceQuery.data.sourceExtractionId} (v
                  {evidenceQuery.data.sourceExtractionVersion})
                </dd>
                <dt className="text-muted-foreground">Source chunk</dt>
                <dd className="font-mono text-xs">
                  {evidenceQuery.data.sourceChunkId} #{evidenceQuery.data.sourceChunkSequence}
                </dd>
                <dt className="text-muted-foreground">Source content hash</dt>
                <dd
                  className="truncate font-mono text-xs"
                  title={evidenceQuery.data.sourceContentHash}
                >
                  {evidenceQuery.data.sourceContentHash}
                </dd>
                <dt className="text-muted-foreground">Chunk content hash</dt>
                <dd
                  className="truncate font-mono text-xs"
                  title={evidenceQuery.data.chunkContentHash}
                >
                  {evidenceQuery.data.chunkContentHash}
                </dd>
                <dt className="text-muted-foreground">Quote hash</dt>
                <dd className="truncate font-mono text-xs" title={evidenceQuery.data.quoteHash}>
                  {evidenceQuery.data.quoteHash}
                </dd>
                {Object.entries(evidenceQuery.data.locator).length > 0 ? (
                  <>
                    <dt className="col-span-2 pt-1 font-medium text-foreground">Locator</dt>
                    {Object.entries(evidenceQuery.data.locator).map(([key, value]) => (
                      <dd key={key} className="col-span-2 font-mono text-xs">
                        {key}: {String(value)}
                      </dd>
                    ))}
                  </>
                ) : null}
              </dl>
            ) : null
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
