import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  FileUpIcon,
  InfoIcon,
  PencilLineIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { type ChangeEvent, lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ProvenanceTag, SeverityIndicator } from "@/components/atlas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AtlasApiError } from "@/features/api";
import { hashFile } from "./hash-file";
import { acknowledgementIdsFromMatches } from "./intake/intake-helpers";
import { createSessionUploader, type UploadProgress } from "./intake/upload-runner";
import {
  applyCapabilityGates,
  capabilityDisabledReason,
  formatByteSize,
  formatIpReviewStatus,
  formatProcessingStatus,
  formatSourceFormat,
  formatSourceType,
  getIpReviewMeta,
  getProcessingMeta,
  isReadyForPreview,
  isReferenceCaptureFile,
  isRetryEligible,
  sourceHeadline,
} from "./source-presentation";
import { SourceVaultForbidden } from "./source-vault-states";
import {
  type DuplicateMatch,
  extractDuplicateMatches,
  fetchSourceFileSignedUrl,
  isSourceErrorCode,
  SOURCE_ERROR_CODES,
  type SourceDetailResponse,
  type SourceVersionUploadSessionInput,
} from "./sources-api";
import {
  useArchiveSourceMutation,
  useCancelUploadSessionMutation,
  useChangeSourceIpReviewMutation,
  useConfirmUploadSessionMutation,
  useCreateVersionManualMutation,
  useCreateVersionUploadSessionMutation,
  useRequestReferenceCaptureMutation,
  useRestoreSourceMutation,
  useRetrySourceProcessingMutation,
  useSourceChunksQuery,
  useSourceDetailQuery,
  useSourceExtractionsQuery,
  useSourceFileSignedUrlQuery,
  useSourceVaultCapabilities,
  useSourceVersionsQuery,
  useUpdateSourceMetadataMutation,
} from "./sources-hooks";
import {
  acceptedExtensions,
  acceptedMimeTypes,
  declaredMimeForFormat,
  formatFromFileName,
  maxUploadBytes,
  validateUploadFile,
} from "./upload-formats";
import { useSourceViewerContext } from "./use-source-viewer-context";

export type SourceDetailPageProps = {
  projectId: string;
  sourceId: string;
};

/**
 * Lazy-loaded pdf.js preview. Kept out of the initial detail chunk so pdf.js
 * (~2 MB) is only fetched when a viewer opens a PDF source that is Ready.
 */
const LazyPdfPreview = lazy(() => import("./pdf-preview"));

export function SourceDetailPage({ projectId, sourceId }: SourceDetailPageProps) {
  const viewer = useSourceViewerContext(projectId);
  const detailQuery = useSourceDetailQuery(
    viewer.permissions.canRead ? projectId : undefined,
    sourceId,
  );
  const capabilities = useSourceVaultCapabilities(
    viewer.permissions.canRead ? projectId : undefined,
  );

  if (viewer.isLoading) {
    return <DetailLoading />;
  }
  if (viewer.isForbidden || !viewer.permissions.canRead) {
    return <SourceVaultForbidden projectId={projectId} />;
  }

  if (detailQuery.isPending) {
    return <DetailLoading />;
  }
  if (detailQuery.isError) {
    const status =
      detailQuery.error instanceof AtlasApiError ? detailQuery.error.status : undefined;
    if (status === 404) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Source not found</AlertTitle>
          <AlertDescription>
            The source you requested could not be found in this project.{" "}
            <Link to="/projects/$projectId/source-documents" params={{ projectId }}>
              Back to source vault
            </Link>
          </AlertDescription>
        </Alert>
      );
    }
    if (status === 403) {
      return <SourceVaultForbidden projectId={projectId} />;
    }
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load source</AlertTitle>
        <AlertDescription>
          {detailQuery.error instanceof AtlasApiError
            ? detailQuery.error.message
            : "The source failed to load. Retry or return to the vault."}
        </AlertDescription>
      </Alert>
    );
  }

  const source = detailQuery.data;
  const permissions = applyCapabilityGates(viewer.permissions, capabilities.data);
  const capabilityNotice = capabilityDisabledReason(capabilities.data);

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader projectId={projectId} source={source} />
      {capabilityNotice ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Source vault is read-only</AlertTitle>
          <AlertDescription>{capabilityNotice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <MetadataCard projectId={projectId} source={source} permissions={permissions} />
          <FilesCard projectId={projectId} source={source} canDownload={permissions.canRead} />
          <PreviewCard projectId={projectId} source={source} />
          <VersionsCard
            projectId={projectId}
            source={source}
            permissions={permissions}
            singlePageCaptureEnabled={capabilities.data.singlePageCaptureEnabled}
          />
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <ProcessingCard projectId={projectId} source={source} permissions={permissions} />
          {source.sourceType === "reference" && source.reference ? (
            <ReferenceIntellectualPropertyCard
              projectId={projectId}
              source={source}
              permissions={permissions}
              singlePageCaptureEnabled={capabilities.data.singlePageCaptureEnabled}
            />
          ) : null}
          <ActionsCard projectId={projectId} source={source} permissions={permissions} />
        </aside>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Header                                                                 */
/* ----------------------------------------------------------------------- */

function DetailHeader({ projectId, source }: { projectId: string; source: SourceDetailResponse }) {
  return (
    <header className="flex flex-col gap-3">
      <Link
        to="/projects/$projectId/source-documents"
        params={{ projectId }}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
        Back to source vault
      </Link>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ProvenanceTag
            kind={
              source.sourceType === "reference"
                ? "reference"
                : source.sourceType === "manual"
                  ? "manual"
                  : "source"
            }
            label={formatSourceType(source.sourceType)}
          />
          <Badge variant="outline">v{source.versionNumber}</Badge>
          {source.isArchived ? (
            <Badge variant="outline">
              <ArchiveIcon className="mr-1 size-3" /> Archived
            </Badge>
          ) : null}
          {source.hasDuplicateAcknowledgement ? (
            <Badge variant="outline">Duplicate acknowledged</Badge>
          ) : null}
        </div>
        <h1 className="text-xl font-semibold tracking-tight break-words">{source.title}</h1>
        <p className="text-sm text-muted-foreground">{sourceHeadline(source)}</p>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------------- */
/*  Metadata                                                               */
/* ----------------------------------------------------------------------- */

function MetadataCard({
  projectId,
  source,
  permissions,
}: {
  projectId: string;
  source: SourceDetailResponse;
  permissions: { canEditMetadata: boolean };
}) {
  const [editOpen, setEditOpen] = useState(false);
  const _isSuperseded = source.supersedesId !== null || Boolean(source.archivedAt);
  const canEdit =
    permissions.canEditMetadata &&
    !source.isArchived &&
    // The API rejects metadata edits on archived/superseded lineage nodes;
    // hiding the affordance keeps the surface honest but the API remains
    // authoritative.
    !isSupersededVersion(source);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Metadata</CardTitle>
          {source.isArchived ? (
            <CardDescription>
              This source is archived — metadata is preserved read-only.
            </CardDescription>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
            aria-label="Edit metadata"
          >
            <PencilLineIcon className="size-3.5" /> Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <MetaRow label="Kind" value={formatSourceType(source.sourceType)} />
        <MetaRow label="Format" value={formatSourceFormat(source.documentFormat)} />
        <MetaRow label="Lineage" value={<span className="font-mono">{source.lineageId}</span>} />
        <MetaRow
          label="Content hash"
          value={<span className="font-mono">{source.contentHash.slice(0, 20)}…</span>}
        />
        <MetaRow
          label="Provenance date"
          value={source.provenanceDate ? source.provenanceDate.slice(0, 10) : "—"}
        />
        <MetaRow
          label="Uploaded"
          value={new Date(source.createdAt).toISOString().slice(0, 16).replace("T", " ")}
        />
        {source.tags.length > 0 ? (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
            <div className="flex flex-wrap gap-1">
              {source.tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {source.notes ? (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Notes</span>
            <p className="text-sm whitespace-pre-wrap">{source.notes}</p>
          </div>
        ) : null}
      </CardContent>

      {canEdit ? (
        <EditMetadataDialog
          projectId={projectId}
          source={source}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </Card>
  );
}

/**
 * A version is "superseded" when a newer version of the same lineage has
 * taken its place. The API returns `supersedesId` on the *new* head (pointing
 * at the previous version), so this helper conservatively marks a source as
 * non-editable if it is archived; the versions list separately marks rows
 * that are not the current head.
 */
function isSupersededVersion(source: Pick<SourceDetailResponse, "isArchived">): boolean {
  return source.isArchived;
}

function EditMetadataDialog({
  projectId,
  source,
  open,
  onClose,
}: {
  projectId: string;
  source: SourceDetailResponse;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(source.title);
  const [tags, setTags] = useState(source.tags.join(", "));
  const [notes, setNotes] = useState(source.notes ?? "");
  const update = useUpdateSourceMetadataMutation(projectId, source.id);
  const canSubmit = title.trim().length > 0 && !update.isPending;

  const submit = () => {
    update.mutate(
      {
        version: source.version,
        title: title.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: notes.trim().length > 0 ? notes : null,
      },
      {
        onSuccess: () => {
          toast.success("Metadata updated");
          onClose();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update metadata");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit metadata</DialogTitle>
          <DialogDescription>
            Title, tags, and notes are stored per-version. Content changes must be captured through
            a new version.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="meta-title">Title</FieldLabel>
            <Input
              id="meta-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="meta-tags">Tags</FieldLabel>
            <Input
              id="meta-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="meta-notes">Notes</FieldLabel>
            <Textarea
              id="meta-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {update.isPending ? <Spinner /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Files                                                                  */
/* ----------------------------------------------------------------------- */

function FilesCard({
  projectId,
  source,
  canDownload,
}: {
  projectId: string;
  source: SourceDetailResponse;
  canDownload: boolean;
}) {
  if (source.files.length === 0) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Files</CardTitle>
        <CardDescription>
          Every uploaded artifact is content-addressed and scanned before it becomes available.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Scan</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {source.files.map((file) => (
              <TableRow key={file.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="truncate font-medium">{file.originalFileName}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      sha256:{file.sha256.slice(0, 12)}…
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">{file.role}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatByteSize(file.byteSize)}
                </TableCell>
                <TableCell>
                  <ScanStatusBadge status={file.scanStatus} />
                </TableCell>
                <TableCell className="text-right">
                  {canDownload &&
                  (file.scanStatus === "clean" || file.scanStatus === "not_required") ? (
                    <DownloadFileButton
                      projectId={projectId}
                      sourceId={source.id}
                      fileId={file.id}
                    />
                  ) : file.scanStatus === "infected" || file.scanStatus === "failed" ? (
                    <span className="text-xs text-muted-foreground">Unavailable</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Download available after scan
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ScanStatusBadge({
  status,
}: {
  status: SourceDetailResponse["files"][number]["scanStatus"];
}) {
  const map: Record<
    typeof status,
    { label: string; severity: "critical" | "high" | "info" | "low" | "medium" }
  > = {
    not_required: { label: "Not required", severity: "info" },
    pending: { label: "Pending", severity: "info" },
    clean: { label: "Clean", severity: "low" },
    infected: { label: "Infected", severity: "critical" },
    failed: { label: "Scan failed", severity: "high" },
  };
  const meta = map[status];
  return <SeverityIndicator size="sm" severity={meta.severity} label={meta.label} />;
}

function DownloadFileButton({
  projectId,
  sourceId,
  fileId,
}: {
  projectId: string;
  sourceId: string;
  fileId: string;
}) {
  // Fully event-driven: we never call `window.open` or set state during
  // render. The download URL is fetched inside the click handler and opened
  // from the resolved promise. This preserves the "no side effects during
  // render" rule and makes the button safe to render N times per row.
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    try {
      const result = await fetchSourceFileSignedUrl(projectId, sourceId, fileId, "download");
      const url = result?.url;
      if (!url) {
        toast.error("Download URL is unavailable. Try again in a moment.");
        return;
      }
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.error(
          "Your browser blocked the download popup. Allow popups for this site and retry.",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate download URL");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => void handleClick()}
      disabled={isPending}
    >
      {isPending ? <Spinner /> : <DownloadIcon className="size-3.5" />}
      Download
    </Button>
  );
}

/* ----------------------------------------------------------------------- */
/*  Preview                                                                */
/* ----------------------------------------------------------------------- */

function PreviewCard({ projectId, source }: { projectId: string; source: SourceDetailResponse }) {
  const isReady = isReadyForPreview(source);
  const primaryFile = source.files.find((f) => f.role === "primary") ?? source.files[0];
  const isPdf = primaryFile?.format === "pdf";
  const isImage =
    primaryFile &&
    (["png", "jpg", "jpeg", "webp"] as const).includes(
      primaryFile.format as "png" | "jpg" | "jpeg" | "webp",
    );
  const isPdfOrImage = isPdf || Boolean(isImage);
  const signedPreview = useSourceFileSignedUrlQuery(
    projectId,
    source.id,
    primaryFile?.id,
    "preview",
    Boolean(isReady && isPdfOrImage && primaryFile),
  );
  const chunks = useSourceChunksQuery(projectId, isReady && !isPdfOrImage ? source.id : undefined);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const signedUrl = signedPreview.data?.url ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          Previews render inline for supported formats. Unsupported files show metadata and a
          download link only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isReady ? (
          <Alert>
            <FileTextIcon />
            <AlertTitle>Preview not yet available</AlertTitle>
            <AlertDescription>
              A preview will appear here once processing completes.
            </AlertDescription>
          </Alert>
        ) : isPdf && signedUrl ? (
          pdfError ? (
            <div className="flex flex-col gap-3">
              <Alert variant="destructive">
                <FileTextIcon />
                <AlertTitle>PDF preview failed</AlertTitle>
                <AlertDescription>
                  {pdfError} Download the file above to review the source content.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <LazyPdfPreview
                url={signedUrl}
                title={primaryFile?.originalFileName ?? source.title}
                onError={setPdfError}
              />
            </Suspense>
          )
        ) : isImage && signedUrl ? (
          <img
            src={signedUrl}
            alt={primaryFile?.originalFileName ?? "Preview"}
            className="max-h-[540px] w-full rounded-md border object-contain"
          />
        ) : isPdfOrImage && signedPreview.isFetching ? (
          <Skeleton className="h-64 w-full" />
        ) : chunks.data && chunks.data.items.length > 0 ? (
          <ScrollArea className="max-h-[540px] rounded-md border p-3">
            <div className="flex flex-col gap-4">
              {chunks.data.items.map((chunk) => (
                <div key={chunk.id} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Chunk {chunk.sequence + 1} · {chunk.characterCount} chars
                  </span>
                  <p className="text-sm whitespace-pre-wrap">{chunk.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : chunks.isFetching ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Alert>
            <FileTextIcon />
            <AlertTitle>No inline preview available</AlertTitle>
            <AlertDescription>
              Download the file above to review the source content.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------- */
/*  Versions                                                               */
/* ----------------------------------------------------------------------- */

function VersionsCard({
  projectId,
  source,
  permissions,
  singlePageCaptureEnabled,
}: {
  projectId: string;
  source: SourceDetailResponse;
  permissions: { canReplace: boolean };
  singlePageCaptureEnabled: boolean;
}) {
  const versions = useSourceVersionsQuery(projectId, source.id);
  const [replaceOpen, setReplaceOpen] = useState(false);

  // Only allow "Create new version" when this row is the current head of its
  // lineage. If this source is archived, or if a newer version exists in the
  // versions list, we suppress the CTA. We also suppress the CTA while the
  // versions query is still pending so we never expose the button on a stale
  // (possibly non-head) view. The API remains authoritative — the mutation
  // itself will reject stale writes with a 409, which the dialog surfaces.
  const items = versions.data?.items ?? [];
  const latest = items.reduce<{ versionNumber: number; id: string } | null>((acc, v) => {
    if (!acc || v.versionNumber > acc.versionNumber) {
      return { versionNumber: v.versionNumber, id: v.id };
    }
    return acc;
  }, null);
  const isHead = latest !== null && latest.id === source.id;
  const versionKind = versionReplacementKind(source);
  const canReplace =
    permissions.canReplace &&
    !source.isArchived &&
    isHead &&
    (versionKind !== "reference-url" || singlePageCaptureEnabled);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Version history</CardTitle>
          <CardDescription>Every replacement creates a new version.</CardDescription>
        </div>
        {canReplace && versionKind !== "unsupported" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReplaceOpen(true)}
            aria-label="Create new version"
          >
            <PlusIcon className="size-3.5" /> New version
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {versions.isPending ? (
          <div className="p-4">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : versions.data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.data.items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Badge variant={v.id === source.id ? "default" : "outline"}>
                      v{v.versionNumber}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {v.id === source.id ? (
                      <span className="font-medium">{v.title}</span>
                    ) : (
                      <Link
                        to="/projects/$projectId/source-documents/$sourceId"
                        params={{ projectId, sourceId: v.id }}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {v.title}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(v.createdAt).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>{formatProcessingStatus(v.processingStatus)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No history available.</p>
        )}
      </CardContent>

      {replaceOpen && canReplace && versionKind !== "unsupported" ? (
        <NewVersionDialog
          projectId={projectId}
          source={source}
          kind={versionKind}
          open={replaceOpen}
          onClose={() => setReplaceOpen(false)}
        />
      ) : null}
    </Card>
  );
}

type VersionKind = "document" | "manual" | "reference-upload" | "reference-url" | "unsupported";

function versionReplacementKind(source: SourceDetailResponse): VersionKind {
  if (source.sourceType === "document") {
    return "document";
  }
  if (source.sourceType === "manual") {
    return "manual";
  }
  if (source.sourceType === "reference") {
    if (isReferenceCaptureFile(source)) {
      return "reference-upload";
    }
    return "reference-url";
  }
  return "unsupported";
}

function NewVersionDialog({
  projectId,
  source,
  kind,
  open,
  onClose,
}: {
  projectId: string;
  source: SourceDetailResponse;
  kind: Exclude<VersionKind, "unsupported">;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create new version</DialogTitle>
          <DialogDescription>
            {kind === "document"
              ? "Upload a single replacement file. Existing files remain on the previous version."
              : kind === "manual"
                ? "Provide the full replacement body. The API records this as an immutable new version."
                : kind === "reference-upload"
                  ? "Upload the replacement screenshots or export."
                  : "Re-capture the current URL to record a fresh version."}
          </DialogDescription>
        </DialogHeader>

        {kind === "document" ? (
          <DocumentReplacementForm projectId={projectId} source={source} onDone={onClose} />
        ) : null}
        {kind === "manual" ? (
          <ManualReplacementForm projectId={projectId} source={source} onDone={onClose} />
        ) : null}
        {kind === "reference-upload" ? (
          <ReferenceUploadReplacementForm projectId={projectId} source={source} onDone={onClose} />
        ) : null}
        {kind === "reference-url" ? (
          <ReferenceUrlReplacementForm projectId={projectId} source={source} onDone={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------- */
/*  Processing                                                             */
/* ----------------------------------------------------------------------- */

function ProcessingCard({
  projectId,
  source,
  permissions,
}: {
  projectId: string;
  source: SourceDetailResponse;
  permissions: { canRetry: boolean };
}) {
  const meta = getProcessingMeta(source.processingStatus);
  const extractions = useSourceExtractionsQuery(projectId, source.id);
  const retry = useRetrySourceProcessingMutation(projectId, source.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing</CardTitle>
        <CardDescription>
          Live status of scanning, extraction, and chunking pipelines.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SeverityIndicator
          severity={meta.severity}
          label={formatProcessingStatus(source.processingStatus)}
        />
        {isRetryEligible(source) && permissions.canRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              retry.mutate(
                { version: source.version },
                {
                  onSuccess: () => toast.success("Retry queued"),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Retry failed"),
                },
              )
            }
            disabled={retry.isPending}
          >
            {retry.isPending ? <Spinner /> : <RotateCcwIcon className="size-3.5" />} Retry
            processing
          </Button>
        ) : null}
        {source.processingStatus === "quarantined" ? (
          <Alert variant="destructive">
            <AlertTitle>Content quarantined</AlertTitle>
            <AlertDescription>
              This source is quarantined by malware scanning and can't be retried. Contact an admin.
            </AlertDescription>
          </Alert>
        ) : null}

        <Separator />

        {extractions.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : extractions.data && extractions.data.items.length > 0 ? (
          <ul className="flex flex-col gap-2 text-xs">
            {extractions.data.items.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 rounded-md border border-border p-2">
                <span className="font-medium">
                  Extraction v{e.extractionVersion} · {e.status}
                </span>
                {e.startedAt ? (
                  <span className="text-muted-foreground">
                    Started {new Date(e.startedAt).toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                ) : null}
                {e.failureCode ? (
                  <span className="text-destructive">
                    {e.failureCode}: {e.failureDetail}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No extraction runs yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------- */
/*  Reference IP                                                           */
/* ----------------------------------------------------------------------- */

function ReferenceIntellectualPropertyCard({
  projectId,
  source,
  permissions,
  singlePageCaptureEnabled,
}: {
  projectId: string;
  source: SourceDetailResponse;
  permissions: { canManageIpReview: boolean; canRequestCapture: boolean };
  singlePageCaptureEnabled: boolean;
}) {
  const reference = source.reference;
  const capture = useRequestReferenceCaptureMutation(projectId, source.id);
  const change = useChangeSourceIpReviewMutation(projectId, source.id);
  const [reviewOpen, setReviewOpen] = useState<"cleared" | "restricted" | null>(null);
  const [reason, setReason] = useState("");
  if (!reference) return null;
  const meta = getIpReviewMeta(reference.ipReviewStatus);

  const requestCapture = () => {
    if (!reference.sourceUrl) return;
    capture.mutate(
      { url: reference.sourceUrl },
      {
        onSuccess: () =>
          toast.success("Capture requested — a new version will appear when the worker finishes."),
        onError: (err) => {
          if (isSourceErrorCode(err, SOURCE_ERROR_CODES.captureDisabled)) {
            toast.error("Capture is disabled for this organization.");
            return;
          }
          toast.error(err instanceof Error ? err.message : "Capture request failed");
        },
      },
    );
  };

  const submitReview = () => {
    if (!reviewOpen || reason.trim().length === 0) return;
    change.mutate(
      { version: source.version, ipReviewStatus: reviewOpen, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("IP review updated");
          setReviewOpen(null);
          setReason("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "IP review failed"),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reference & IP review</CardTitle>
        <CardDescription>
          Attestation and IP clearance state for this reference artifact.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <SeverityIndicator
          severity={meta.severity}
          label={formatIpReviewStatus(reference.ipReviewStatus)}
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Kind</span>
          <span className="capitalize">{reference.referenceKind.replaceAll("_", " ")}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Capture method
          </span>
          <span className="capitalize">{reference.captureMethod.replaceAll("_", " ")}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Attestation</span>
          <p className="text-xs">{reference.attestationText}</p>
          <span className="text-xs text-muted-foreground">
            v{reference.attestationVersion} · attested{" "}
            {new Date(reference.attestedAt).toISOString().slice(0, 10)}
          </span>
        </div>

        {isReferenceCaptureFile(source) &&
        permissions.canRequestCapture &&
        singlePageCaptureEnabled ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={capture.isPending || !reference.sourceUrl}
            onClick={requestCapture}
          >
            {capture.isPending ? <Spinner /> : null} Request fresh capture
          </Button>
        ) : null}

        {permissions.canManageIpReview ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setReviewOpen("cleared")}
            >
              <ShieldCheckIcon className="size-3.5" /> Mark cleared
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setReviewOpen("restricted")}
            >
              Mark restricted
            </Button>
          </div>
        ) : null}
      </CardContent>

      <Dialog
        open={reviewOpen !== null}
        onOpenChange={(v) => (v ? undefined : setReviewOpen(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewOpen === "cleared" ? "Clear IP review" : "Restrict IP review"}
            </DialogTitle>
            <DialogDescription>
              A reason is required and will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="review-reason">Reason</FieldLabel>
              <Textarea
                id="review-reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewOpen(null)}
              disabled={change.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitReview}
              disabled={change.isPending || reason.trim().length === 0}
            >
              {change.isPending ? <Spinner /> : null} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------------------------------------------------- */
/*  Actions                                                                */
/* ----------------------------------------------------------------------- */

function ActionsCard({
  projectId,
  source,
  permissions,
}: {
  projectId: string;
  source: SourceDetailResponse;
  permissions: {
    canArchive: boolean;
    canRestore: boolean;
  };
}) {
  const archive = useArchiveSourceMutation(projectId, source.id);
  const restore = useRestoreSourceMutation(projectId, source.id);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!permissions.canArchive && !permissions.canRestore) return null;

  const doArchive = () => {
    const trimmed = reason.trim();
    archive.mutate(
      trimmed ? { version: source.version, reason: trimmed } : { version: source.version },
      {
        onSuccess: () => {
          toast.success("Source archived");
          setArchiveOpen(false);
          setReason("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Archive failed"),
      },
    );
  };

  const doRestore = () =>
    restore.mutate(
      { version: source.version },
      {
        onSuccess: () => toast.success("Source restored"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Restore failed"),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!source.isArchived && permissions.canArchive ? (
          <Button type="button" variant="outline" onClick={() => setArchiveOpen(true)}>
            <ArchiveIcon className="size-3.5" /> Archive source
          </Button>
        ) : null}
        {source.isArchived && permissions.canRestore ? (
          <Button type="button" variant="outline" onClick={doRestore} disabled={restore.isPending}>
            {restore.isPending ? <Spinner /> : null} Restore source
          </Button>
        ) : null}
      </CardContent>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this source?</DialogTitle>
            <DialogDescription>
              Archived sources remain readable and downloadable but cannot be replaced or retried.
              Provide a reason for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="archive-reason">Reason (optional)</FieldLabel>
              <Input
                id="archive-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveOpen(false)}
              disabled={archive.isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={doArchive} disabled={archive.isPending}>
              {archive.isPending ? <Spinner /> : null} Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------------------------------------------------- */
/*  Version replacement forms                                              */
/* ----------------------------------------------------------------------- */

const REFERENCE_ATTESTATION_TEXT =
  "I confirm I have the right to provide this reference for functional inspiration only, not verbatim copying of protected design, text, or code." as const;

async function cancelVersionSessionWithWarning(
  cancelSession: ReturnType<typeof useCancelUploadSessionMutation>,
  sessionId: string,
) {
  try {
    await cancelSession.mutateAsync({ sessionId, input: { reason: "user-cancelled" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel request failed";
    toast.warning(`Couldn't cancel the upload session (${message}). It will expire automatically.`);
  }
}

function DocumentReplacementForm({
  projectId,
  source,
  onDone,
}: {
  projectId: string;
  source: SourceDetailResponse;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const [file, setFile] = useState<{ file: File; sha256?: string; error?: string } | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [duplicatePhase, setDuplicatePhase] = useState<"create" | "confirm" | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const uploaderRef = useRef<ReturnType<typeof createSessionUploader> | null>(null);
  const pendingBodyRef = useRef<SourceVersionUploadSessionInput | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createSession = useCreateVersionUploadSessionMutation(projectId, source.id);
  const confirmSession = useConfirmUploadSessionMutation(projectId);
  const cancelSession = useCancelUploadSessionMutation(projectId);

  useEffect(() => () => uploaderRef.current?.destroy(), []);

  const isPending = createSession.isPending || confirmSession.isPending || isHashing;
  const canSubmit = Boolean(file?.sha256) && !file?.error && !isPending;

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      setFile(null);
      return;
    }
    if (files.length > 1) {
      toast.error("Document replacement accepts a single file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const f = files[0];
    if (!f) return;
    const v = validateUploadFile({ name: f.name, type: f.type, size: f.size });
    if (!v.ok) {
      setFile({ file: f, error: v.reason });
      return;
    }
    setFile({ file: f });
    setIsHashing(true);
    try {
      const sha256 = await hashFile(f);
      setFile({ file: f, sha256 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to hash file");
    } finally {
      setIsHashing(false);
    }
  };

  const runSession = async (body: SourceVersionUploadSessionInput) => {
    pendingBodyRef.current = body;
    let session: Awaited<ReturnType<typeof createSession.mutateAsync>>;
    try {
      session = await createSession.mutateAsync(body);
    } catch (err) {
      if (isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)) {
        setDuplicates(extractDuplicateMatches(err));
        setDuplicatePhase("create");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to start replacement upload");
      return;
    }
    setSessionId(session.id);
    const prepared = session.files
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((f) => {
        if (!file) throw new Error("Missing local file");
        return {
          file: file.file,
          sessionFileId: f.id,
          ordinal: f.ordinal,
          signedUploadUrl: f.signedUploadUrl,
          signedUploadUrlExpiresAt: f.signedUploadUrlExpiresAt,
          declaredMimeType: f.declaredMimeType,
        };
      });
    const uploader = createSessionUploader(prepared, {
      onProgress: setProgress,
      onError: (message) => toast.error(message),
      onAllComplete: async () => {
        await confirmWithSession(session.id);
      },
    });
    uploaderRef.current = uploader;
    await uploader.start();
  };

  const confirmWithSession = async (sid: string, ackIds?: string[]) => {
    try {
      const result = await confirmSession.mutateAsync({
        sessionId: sid,
        input:
          ackIds && ackIds.length > 0
            ? { duplicateAcknowledgement: { acknowledgedMatchIds: ackIds } }
            : {},
      });
      toast.success("New version created");
      onDone();
      const newId = result.id;
      if (newId !== source.id) {
        void navigate({
          to: "/projects/$projectId/source-documents/$sourceId",
          params: { projectId, sourceId: newId },
        });
      }
    } catch (err) {
      if (isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)) {
        setDuplicates(extractDuplicateMatches(err));
        setDuplicatePhase("confirm");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to confirm replacement");
    }
  };

  const handleSubmit = async () => {
    if (!file?.sha256 || file.error) return;
    const format = formatFromFileName(file.file.name);
    if (!format) {
      toast.error("Unsupported file type");
      return;
    }
    const body: SourceVersionUploadSessionInput = {
      sourceType: "document",
      documentFormat: format,
      title: source.title,
      tags: source.tags,
      ...(source.notes ? { notes: source.notes } : {}),
      files: [
        {
          ordinal: 0,
          role: "primary",
          originalFileName: file.file.name,
          format,
          declaredMimeType: file.file.type || declaredMimeForFormat(format),
          byteSize: file.file.size,
          sha256: file.sha256,
        },
      ],
    };
    await runSession(body);
  };

  const acknowledgeDuplicates = async () => {
    const matches = duplicates ?? [];
    const ids = acknowledgementIdsFromMatches(matches);
    if (duplicatePhase === "create") {
      const pending = pendingBodyRef.current;
      if (!pending) return;
      const body: SourceVersionUploadSessionInput = {
        ...pending,
        duplicateAcknowledgement: { acknowledgedMatchIds: ids },
      };
      setDuplicates(null);
      setDuplicatePhase(null);
      await runSession(body);
      return;
    }
    if (duplicatePhase === "confirm" && sessionId) {
      setDuplicates(null);
      setDuplicatePhase(null);
      await confirmWithSession(sessionId, ids);
    }
  };

  const handleCancel = async () => {
    uploaderRef.current?.cancel();
    if (sessionId) {
      await cancelVersionSessionWithWarning(cancelSession, sessionId);
    }
    onDone();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <Field data-invalid={file?.error ? "" : undefined}>
        <FieldLabel htmlFor="new-version-file">Replacement file</FieldLabel>
        <input
          id="new-version-file"
          ref={inputRef}
          type="file"
          accept={[...acceptedExtensions(), ...acceptedMimeTypes()].join(",")}
          onChange={(e) => void onPickFile(e)}
          className="text-sm"
        />
        <FieldDescription>
          One file, up to {formatByteSize(maxUploadBytes())}. Uploaded as v{source.version + 1} of
          this lineage.
        </FieldDescription>
        {file?.error ? <FieldError>{file.error}</FieldError> : null}
      </Field>
      {progress.length > 0 ? (
        <div className="flex flex-col gap-2">
          {progress.map((p) => (
            <div key={p.sessionFileId} className="flex flex-col gap-1">
              <span className="text-xs">{p.fileName}</span>
              <Progress value={p.percent} />
            </div>
          ))}
        </div>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleCancel()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? <Spinner /> : <FileUpIcon className="size-4" />} Create new version
        </Button>
      </DialogFooter>
      {duplicates ? (
        <DuplicateAckDialog
          matches={duplicates}
          open={duplicates !== null}
          onCancel={() => {
            setDuplicates(null);
            setDuplicatePhase(null);
          }}
          onAcknowledge={acknowledgeDuplicates}
          isPending={isPending}
        />
      ) : null}
    </form>
  );
}

function ManualReplacementForm({
  projectId,
  source,
  onDone,
}: {
  projectId: string;
  source: SourceDetailResponse;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const create = useCreateVersionManualMutation(projectId, source.id);
  // Existing chunks are surfaced *read-only* — we never silently seed the
  // editable state with the previous body because manual versions are
  // immutable snapshots. The user must type a fresh body.
  const chunks = useSourceChunksQuery(projectId, source.id);

  const isPending = create.isPending;
  const canSubmit = body.trim().length > 0 && !isPending;

  const submit = async (ackIds?: string[]) => {
    try {
      const result = await create.mutateAsync({
        title: source.title,
        tags: source.tags,
        ...(source.notes ? { notes: source.notes } : {}),
        body,
        ...(ackIds && ackIds.length > 0
          ? { duplicateAcknowledgement: { acknowledgedMatchIds: ackIds } }
          : {}),
      });
      toast.success("New manual version created");
      onDone();
      const newId = result.id ?? source.id;
      if (newId !== source.id) {
        void navigate({
          to: "/projects/$projectId/source-documents/$sourceId",
          params: { projectId, sourceId: newId },
        });
      }
    } catch (err) {
      if (isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)) {
        setDuplicates(extractDuplicateMatches(err));
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to save new version");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {chunks.data && chunks.data.items.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Previous version (read-only)
          </span>
          <ScrollArea className="h-32 rounded-md border p-2 text-xs">
            {chunks.data.items.map((c) => (
              <p key={c.id} className="whitespace-pre-wrap">
                {c.content}
              </p>
            ))}
          </ScrollArea>
        </div>
      ) : null}
      <Field>
        <FieldLabel htmlFor="manual-replace-body">New body</FieldLabel>
        <Textarea
          id="manual-replace-body"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste the full replacement text here."
        />
        <FieldDescription>
          Manual versions are immutable — provide the entire new body.
        </FieldDescription>
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
          {isPending ? <Spinner /> : null} Create new version
        </Button>
      </DialogFooter>
      {duplicates ? (
        <DuplicateAckDialog
          matches={duplicates}
          open={duplicates !== null}
          onCancel={() => setDuplicates(null)}
          onAcknowledge={() => {
            const ids = acknowledgementIdsFromMatches(duplicates);
            setDuplicates(null);
            void submit(ids);
          }}
          isPending={isPending}
        />
      ) : null}
    </div>
  );
}

function ReferenceUploadReplacementForm({
  projectId,
  source,
  onDone,
}: {
  projectId: string;
  source: SourceDetailResponse;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  // The reference kind (screenshot_set | uploaded_export) determines whether
  // we allow multiple files. We infer it from the current source's reference
  // metadata; if unavailable the safe default is single-file uploaded_export.
  const referenceKind: "screenshot_set" | "uploaded_export" =
    source.reference?.referenceKind === "screenshot_set" ? "screenshot_set" : "uploaded_export";
  const requiresMultiple = referenceKind === "screenshot_set";

  const [selected, setSelected] = useState<{ file: File; sha256?: string; error?: string }[]>([]);
  const [attested, setAttested] = useState(false);
  const [isHashing, setIsHashing] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [duplicatePhase, setDuplicatePhase] = useState<"create" | "confirm" | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const uploaderRef = useRef<ReturnType<typeof createSessionUploader> | null>(null);
  const pendingBodyRef = useRef<SourceVersionUploadSessionInput | null>(null);

  const createSession = useCreateVersionUploadSessionMutation(projectId, source.id);
  const confirmSession = useConfirmUploadSessionMutation(projectId);
  const cancelSession = useCancelUploadSessionMutation(projectId);

  useEffect(() => () => uploaderRef.current?.destroy(), []);

  const isPending = createSession.isPending || confirmSession.isPending || isHashing;
  const canSubmit =
    selected.length > 0 &&
    selected.every((s) => s.sha256 && !s.error) &&
    attested &&
    (!requiresMultiple ? selected.length === 1 : true) &&
    !isPending;

  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      setSelected([]);
      return;
    }
    if (!requiresMultiple && files.length > 1) {
      toast.error("Uploaded export accepts a single file.");
      return;
    }
    const initial = files.map((file) => {
      const v = validateUploadFile(
        { name: file.name, type: file.type, size: file.size },
        requiresMultiple ? "screenshot" : "any",
      );
      return v.ok ? { file } : { file, error: v.reason };
    });
    setSelected(initial);
    setIsHashing(true);
    try {
      const hashed = await Promise.all(
        initial.map(async (entry) => {
          if (entry.error) return entry;
          const sha256 = await hashFile(entry.file);
          return { ...entry, sha256 };
        }),
      );
      setSelected(hashed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to hash files");
    } finally {
      setIsHashing(false);
    }
  };

  const buildBody = (
    valid: readonly { file: File; sha256: string }[],
  ): SourceVersionUploadSessionInput => ({
    sourceType: "reference",
    title: source.title,
    tags: source.tags,
    ...(source.notes ? { notes: source.notes } : {}),
    reference: {
      referenceKind,
      captureMethod: "user_uploaded_screenshot",
      accessType: source.reference?.accessType ?? "public",
      intendedUse: source.reference?.intendedUse ?? "inspiration",
      ...(source.reference?.sourceUrl ? { sourceUrl: source.reference.sourceUrl } : {}),
      attestation: {
        attestationText: REFERENCE_ATTESTATION_TEXT,
        attestationVersion: "v1",
        acceptedAt: new Date().toISOString(),
      },
    },
    files: valid.map((entry, index) => {
      const fmt = formatFromFileName(entry.file.name);
      if (!fmt) throw new Error(`Unsupported: ${entry.file.name}`);
      return {
        ordinal: index,
        role: index === 0 ? "primary" : "attachment",
        originalFileName: entry.file.name,
        format: fmt,
        declaredMimeType: entry.file.type || declaredMimeForFormat(fmt),
        byteSize: entry.file.size,
        sha256: entry.sha256,
      };
    }),
  });

  const runSession = async (body: SourceVersionUploadSessionInput) => {
    pendingBodyRef.current = body;
    let session: Awaited<ReturnType<typeof createSession.mutateAsync>>;
    try {
      session = await createSession.mutateAsync(body);
    } catch (err) {
      if (isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)) {
        setDuplicates(extractDuplicateMatches(err));
        setDuplicatePhase("create");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to start replacement upload");
      return;
    }
    setSessionId(session.id);
    const ordered = session.files.slice().sort((a, b) => a.ordinal - b.ordinal);
    const prepared = ordered.map((f) => {
      const local = selected[f.ordinal]?.file;
      if (!local) throw new Error(`Missing local file for ordinal ${f.ordinal}`);
      return {
        file: local,
        sessionFileId: f.id,
        ordinal: f.ordinal,
        signedUploadUrl: f.signedUploadUrl,
        signedUploadUrlExpiresAt: f.signedUploadUrlExpiresAt,
        declaredMimeType: f.declaredMimeType,
      };
    });
    const uploader = createSessionUploader(prepared, {
      onProgress: setProgress,
      onError: (message) => toast.error(message),
      onAllComplete: async () => {
        await confirmWithSession(session.id);
      },
    });
    uploaderRef.current = uploader;
    await uploader.start();
  };

  const confirmWithSession = async (sid: string, ackIds?: string[]) => {
    try {
      const result = await confirmSession.mutateAsync({
        sessionId: sid,
        input:
          ackIds && ackIds.length > 0
            ? { duplicateAcknowledgement: { acknowledgedMatchIds: ackIds } }
            : {},
      });
      toast.success("New reference version created");
      onDone();
      const newId = result.id;
      if (newId !== source.id) {
        void navigate({
          to: "/projects/$projectId/source-documents/$sourceId",
          params: { projectId, sourceId: newId },
        });
      }
    } catch (err) {
      if (isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)) {
        setDuplicates(extractDuplicateMatches(err));
        setDuplicatePhase("confirm");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to confirm replacement");
    }
  };

  const handleSubmit = async () => {
    const valid = selected.filter(
      (s): s is { file: File; sha256: string } => Boolean(s.sha256) && !s.error,
    );
    if (valid.length === 0) return;
    await runSession(buildBody(valid));
  };

  const acknowledgeDuplicates = async () => {
    const matches = duplicates ?? [];
    const ids = acknowledgementIdsFromMatches(matches);
    if (duplicatePhase === "create") {
      const pending = pendingBodyRef.current;
      if (!pending) return;
      const body: SourceVersionUploadSessionInput = {
        ...pending,
        duplicateAcknowledgement: { acknowledgedMatchIds: ids },
      };
      setDuplicates(null);
      setDuplicatePhase(null);
      await runSession(body);
      return;
    }
    if (duplicatePhase === "confirm" && sessionId) {
      setDuplicates(null);
      setDuplicatePhase(null);
      await confirmWithSession(sessionId, ids);
    }
  };

  const handleCancel = async () => {
    uploaderRef.current?.cancel();
    if (sessionId) {
      await cancelVersionSessionWithWarning(cancelSession, sessionId);
    }
    onDone();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <Field>
        <FieldLabel htmlFor="reference-replace-files">
          {requiresMultiple ? "Replacement screenshots" : "Replacement export file"}
        </FieldLabel>
        <input
          id="reference-replace-files"
          type="file"
          multiple={requiresMultiple}
          accept={[...acceptedExtensions(), ...acceptedMimeTypes()].join(",")}
          onChange={(e) => void onPickFiles(e)}
          className="text-sm"
        />
        <FieldDescription>
          {requiresMultiple
            ? "Upload screenshots in order. Duplicate filenames are allowed."
            : `One file, up to ${formatByteSize(maxUploadBytes())}.`}
        </FieldDescription>
        {selected.some((s) => s.error) ? (
          <FieldError>{selected.find((s) => s.error)?.error}</FieldError>
        ) : null}
      </Field>
      <Field orientation="horizontal">
        <input
          id="replace-attest"
          type="checkbox"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
        />
        <FieldLabel htmlFor="replace-attest">{REFERENCE_ATTESTATION_TEXT}</FieldLabel>
      </Field>
      {progress.length > 0 ? (
        <div className="flex flex-col gap-2">
          {progress.map((p) => (
            <div key={p.sessionFileId} className="flex flex-col gap-1">
              <span className="text-xs">{p.fileName}</span>
              <Progress value={p.percent} />
            </div>
          ))}
        </div>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleCancel()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? <Spinner /> : <FileUpIcon className="size-4" />} Create new version
        </Button>
      </DialogFooter>
      {duplicates ? (
        <DuplicateAckDialog
          matches={duplicates}
          open={duplicates !== null}
          onCancel={() => {
            setDuplicates(null);
            setDuplicatePhase(null);
          }}
          onAcknowledge={acknowledgeDuplicates}
          isPending={isPending}
        />
      ) : null}
    </form>
  );
}

function ReferenceUrlReplacementForm({
  projectId,
  source,
  onDone,
}: {
  projectId: string;
  source: SourceDetailResponse;
  onDone: () => void;
}) {
  const capture = useRequestReferenceCaptureMutation(projectId, source.id);
  const [url, setUrl] = useState(source.reference?.sourceUrl ?? "");
  const isPending = capture.isPending;
  const canSubmit = url.trim().length > 0 && !isPending;

  const submit = () => {
    capture.mutate(
      { url: url.trim() },
      {
        onSuccess: () => {
          toast.success("Fresh capture queued");
          onDone();
        },
        onError: (err) => {
          if (isSourceErrorCode(err, SOURCE_ERROR_CODES.captureDisabled)) {
            toast.warning(
              "URL captures are disabled for this workspace. Upload screenshots via a separate reference flow to record a new version.",
            );
            return;
          }
          toast.error(err instanceof Error ? err.message : "Failed to queue capture");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="ref-replace-url">URL</FieldLabel>
        <Input
          id="ref-replace-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
        />
        <FieldDescription>
          Queues a fresh capture; a new version is recorded when capture completes.
        </FieldDescription>
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={!canSubmit}>
          {isPending ? <Spinner /> : null} Queue capture
        </Button>
      </DialogFooter>
    </div>
  );
}

function DuplicateAckDialog({
  matches,
  open,
  onCancel,
  onAcknowledge,
  isPending,
}: {
  matches: readonly DuplicateMatch[];
  open: boolean;
  onCancel: () => void;
  onAcknowledge: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate source detected</DialogTitle>
          <DialogDescription>
            Acknowledge the exact matches below to proceed. If the API returned different matches
            since your last attempt, this dialog reflects the latest set.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-64 flex-col gap-2 overflow-auto text-sm">
          {matches.map((m) => (
            <div
              key={m.sourceId}
              className="flex flex-col gap-1 rounded-md border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{m.title}</span>
                <Badge variant="outline">v{m.versionNumber}</Badge>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{m.sourceId}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={onAcknowledge} disabled={isPending}>
            {isPending ? <Spinner /> : null} Acknowledge &amp; retry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------- */
/*  Loading                                                                */
/* ----------------------------------------------------------------------- */

function DetailLoading() {
  return (
    <output aria-label="Loading source" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </output>
  );
}

// Public API of this module.
export type { SourceDetailResponse };
