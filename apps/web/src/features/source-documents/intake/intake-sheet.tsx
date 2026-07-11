import { useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, FileUpIcon, InfoIcon, PencilLineIcon } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { hashFile } from "../hash-file";
import {
  type DuplicateMatch,
  extractDuplicateMatches,
  getSourceDetailInvalidationTargets,
  invalidateSourceTargets,
  isSourceErrorCode,
  requestReferenceCapture,
  SOURCE_ERROR_CODES,
  type UploadSessionCreateInput,
} from "../sources-api";
import {
  useCancelUploadSessionMutation,
  useConfirmUploadSessionMutation,
  useCreateManualSourceMutation,
  useCreateReferenceSourceMutation,
  useCreateUploadSessionMutation,
  useSourceVaultCapabilities,
} from "../sources-hooks";
import {
  acceptedExtensions,
  acceptedMimeTypes,
  declaredMimeForFormat,
  formatFromFileName,
  maxUploadBytes,
  validateUploadFile,
} from "../upload-formats";
import { REFERENCE_ATTESTATION_TEXT } from "./intake-constants";
import { acknowledgementIdsFromMatches } from "./intake-helpers";
import { createSessionUploader, type UploadProgress } from "./upload-runner";

type IntakeMode = "file" | "manual" | "reference";

export type IntakeSheetProps = {
  projectId: string;
  open: boolean;
  initialMode?: IntakeMode;
  onOpenChange: (open: boolean) => void;
  onModeChange?: (mode: IntakeMode) => void;
};

const MODE_TABS: readonly { value: IntakeMode; label: string }[] = [
  { value: "file", label: "Upload file" },
  { value: "manual", label: "Manual text" },
  { value: "reference", label: "Reference" },
];

/**
 * IntakeSheet is a controlled surface: `initialMode` is the source of truth
 * for which sub-form renders. When the tab changes we notify the caller via
 * `onModeChange` and remount the sub-form using a `key` so per-form state is
 * cleared without any `useEffect` derived-state syncing.
 */
export function IntakeSheet({
  projectId,
  open,
  initialMode = "file",
  onOpenChange,
  onModeChange,
}: IntakeSheetProps) {
  const mode = initialMode;
  const capabilities = useSourceVaultCapabilities(projectId);
  const handleTabChange = (next: string) => {
    const value = next as IntakeMode;
    if (value !== mode) {
      onModeChange?.(value);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-2xl flex-col gap-0 sm:w-[560px] sm:max-w-none"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Add source document</SheetTitle>
          <SheetDescription>
            Sources are immutable once confirmed. Corrections create a new version. Choose the
            best-fit intake for the material you have.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={mode} onValueChange={handleTabChange} className="border-b px-4 py-2">
          <TabsList variant="line">
            {MODE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/*
             * `key={mode}` intentionally remounts the sub-form on tab switch
             * so its internal state resets cleanly. This replaces a previous
             * `useEffect(() => setMode(initialMode), …)` derived-state bug.
             */}
            {mode === "file" ? (
              <FileIntakeForm
                key="file"
                projectId={projectId}
                onClose={() => onOpenChange(false)}
              />
            ) : null}
            {mode === "manual" ? (
              <ManualIntakeForm
                key="manual"
                projectId={projectId}
                onClose={() => onOpenChange(false)}
              />
            ) : null}
            {mode === "reference" ? (
              <ReferenceIntakeForm
                key="reference"
                projectId={projectId}
                singlePageCaptureEnabled={capabilities.data.singlePageCaptureEnabled}
                onClose={() => onOpenChange(false)}
              />
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ----------------------------------------------------------------------- */
/*  Shared: metadata inputs                                                */
/* ----------------------------------------------------------------------- */

function MetadataFields({
  title,
  setTitle,
  notes,
  setNotes,
  tags,
  setTags,
  disabled,
}: {
  title: string;
  setTitle: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  tags: string;
  setTags: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="intake-title">Title</FieldLabel>
        <Input
          id="intake-title"
          required
          value={title}
          disabled={disabled}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Client onboarding requirements v1"
        />
        <FieldDescription>Displayed everywhere this source is referenced.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="intake-tags">Tags</FieldLabel>
        <Input
          id="intake-tags"
          value={tags}
          disabled={disabled}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Comma-separated"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="intake-notes">Notes</FieldLabel>
        <Textarea
          id="intake-notes"
          value={notes}
          disabled={disabled}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context, provenance, or handling notes"
          rows={3}
        />
      </Field>
    </FieldGroup>
  );
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/* ----------------------------------------------------------------------- */
/*  Duplicate acknowledgement                                              */
/* ----------------------------------------------------------------------- */

function DuplicateAcknowledgementDialog({
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
            One or more existing sources share the same content hash. Confirm you want to add this
            as a distinct entry; the vault will never silently merge duplicates.
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
              <span className="text-xs text-muted-foreground">
                Uploaded {new Date(m.uploadedAt).toISOString().slice(0, 10)}
                {m.isArchived ? " · archived" : ""}
                {m.isSuperseded ? " · superseded" : ""}
              </span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={onAcknowledge} disabled={isPending}>
            {isPending ? <Spinner /> : null} Add as new source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------- */
/*  Attestation field                                                      */
/* ----------------------------------------------------------------------- */

function AttestationField({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        disabled={disabled}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>Attestation</FieldLabel>
        <FieldDescription>{REFERENCE_ATTESTATION_TEXT}</FieldDescription>
      </FieldContent>
    </Field>
  );
}

/* ----------------------------------------------------------------------- */
/*  File upload intake                                                     */
/* ----------------------------------------------------------------------- */

type SelectedFile = {
  clientId: string;
  file: File;
  sha256?: string;
  validationError?: string;
};

/**
 * Assign a stable per-selection identifier so React keys don't depend on
 * array index. Filenames alone are not unique (a screenshot set may
 * legitimately contain duplicate names) and `File` objects have no identity
 * of their own.
 */
function nextClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `f-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * Attempt to cancel an outstanding upload session. Failure is surfaced as a
 * non-blocking warning toast rather than being silently swallowed — the
 * server-side TTL will eventually reclaim the slot, but the user must know
 * the request did not complete cleanly.
 */
async function cancelSessionWithWarning(
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

function FileIntakeForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [duplicatePhase, setDuplicatePhase] = useState<"create" | "confirm" | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploaderRef = useRef<ReturnType<typeof createSessionUploader> | null>(null);
  // Snapshot of the most recent create body so we can retry once the user
  // acknowledges the current duplicate set.
  const pendingBodyRef = useRef<UploadSessionCreateInput | null>(null);

  const createSession = useCreateUploadSessionMutation(projectId);
  const confirmSession = useConfirmUploadSessionMutation(projectId);
  const cancelSession = useCancelUploadSessionMutation(projectId);

  const canSubmit =
    title.trim().length > 0 &&
    selected !== null &&
    Boolean(selected.sha256) &&
    !selected.validationError &&
    !createSession.isPending &&
    !confirmSession.isPending;

  // Genuine cleanup: destroy Uppy when the form unmounts.
  useEffect(() => {
    return () => uploaderRef.current?.destroy();
  }, []);

  const onSelectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      setSelected(null);
      return;
    }
    if (files.length > 1) {
      toast.error("Standard document intake accepts one file at a time.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const file = files[0];
    if (!file) return;
    const v = validateUploadFile({ name: file.name, type: file.type, size: file.size });
    const clientId = nextClientId();
    const initial: SelectedFile = v.ok
      ? { clientId, file }
      : { clientId, file, validationError: v.reason };
    setSelected(initial);
    if (initial.validationError) return;
    setIsHashing(true);
    try {
      const sha256 = await hashFile(file);
      setSelected({ clientId, file, sha256 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to hash file");
    } finally {
      setIsHashing(false);
    }
  };

  const runSession = async (body: UploadSessionCreateInput) => {
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
      toast.error(err instanceof Error ? err.message : "Failed to start upload");
      return;
    }

    setSessionId(session.id);

    const prepared = session.files
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((f) => {
        if (!selected) throw new Error("No selected file for upload session");
        return {
          file: selected.file,
          sessionFileId: f.id,
          ordinal: f.ordinal,
          signedUploadUrl: f.signedUploadUrl,
          signedUploadUrlExpiresAt: f.signedUploadUrlExpiresAt,
          declaredMimeType: f.declaredMimeType,
        };
      });

    const uploader = createSessionUploader(prepared, {
      onProgress: (updates) => setProgress(updates),
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
      await confirmSession.mutateAsync({
        sessionId: sid,
        input:
          ackIds && ackIds.length > 0
            ? { duplicateAcknowledgement: { acknowledgedMatchIds: ackIds } }
            : {},
      });
      toast.success("Source uploaded");
      onClose();
    } catch (err) {
      if (isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)) {
        // Duplicate set can change between create-time and confirm-time; the
        // user must re-acknowledge the *latest* matches before retry.
        setDuplicates(extractDuplicateMatches(err));
        setDuplicatePhase("confirm");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to confirm upload");
    }
  };

  const handleSubmit = async () => {
    if (!selected?.sha256 || selected.validationError) return;
    const format = formatFromFileName(selected.file.name);
    if (!format) {
      toast.error("Unsupported file type");
      return;
    }
    const body: UploadSessionCreateInput = {
      sourceType: "document",
      documentFormat: format,
      title: title.trim(),
      tags: parseTags(tags),
      ...(notes ? { notes } : {}),
      files: [
        {
          ordinal: 0,
          role: "primary",
          originalFileName: selected.file.name,
          format,
          declaredMimeType: selected.file.type || declaredMimeForFormat(format),
          byteSize: selected.file.size,
          sha256: selected.sha256,
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
      const body: UploadSessionCreateInput = {
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

  const cancelDuplicates = () => {
    setDuplicates(null);
    setDuplicatePhase(null);
  };

  const handleCancel = async () => {
    uploaderRef.current?.cancel();
    if (sessionId) {
      await cancelSessionWithWarning(cancelSession, sessionId);
    }
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <Alert>
        <InfoIcon />
        <AlertTitle>Files up to 100 MiB are supported</AlertTitle>
        <AlertDescription>
          Files upload directly to storage using a short-lived signed URL. SHA-256 is computed in a
          background worker before the upload starts, so evidence stays traceable.
        </AlertDescription>
      </Alert>

      <MetadataFields
        title={title}
        setTitle={setTitle}
        notes={notes}
        setNotes={setNotes}
        tags={tags}
        setTags={setTags}
        disabled={createSession.isPending}
      />

      <Field data-invalid={selected?.validationError ? true : undefined}>
        <FieldLabel htmlFor="intake-file">File</FieldLabel>
        <input
          ref={fileRef}
          id="intake-file"
          type="file"
          accept={acceptedMimeTypes().join(",")}
          onChange={(e) => void onSelectFile(e)}
          className="block w-full text-sm"
          disabled={createSession.isPending || confirmSession.isPending}
        />
        <FieldDescription>
          One file per source. Accepted extensions: {acceptedExtensions().join(", ")}. Max{" "}
          {(maxUploadBytes() / (1024 * 1024)).toFixed(0)} MiB.
        </FieldDescription>
        {selected?.validationError ? <FieldError>{selected.validationError}</FieldError> : null}
      </Field>

      {selected ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{selected.file.name}</span>
            <span className="text-xs text-muted-foreground">
              {(selected.file.size / 1024 / 1024).toFixed(2)} MiB
            </span>
          </div>
          {selected.validationError ? (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircleIcon className="size-3" />
              {selected.validationError}
            </span>
          ) : isHashing && !selected.sha256 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Spinner /> Hashing…
            </span>
          ) : selected.sha256 ? (
            <span className="font-mono text-xs text-muted-foreground">
              sha256:{selected.sha256.slice(0, 12)}…
            </span>
          ) : null}
        </div>
      ) : null}

      {progress.length > 0 ? (
        <output aria-live="polite" className="flex flex-col gap-3">
          {progress.map((p) => (
            <div key={p.fileId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate">{p.fileName}</span>
                <span className="text-muted-foreground">{p.percent}%</span>
              </div>
              <Progress value={p.percent} />
              {p.status === "error" ? (
                <span className="text-xs text-destructive">{p.errorMessage}</span>
              ) : null}
            </div>
          ))}
        </output>
      ) : null}

      <SheetFooter className="flex-row items-center justify-end gap-2 border-t p-0 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleCancel()}
          disabled={confirmSession.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {createSession.isPending || confirmSession.isPending ? (
            <Spinner />
          ) : (
            <FileUpIcon data-icon="inline-start" />
          )}
          Start upload
        </Button>
      </SheetFooter>

      {duplicates ? (
        <DuplicateAcknowledgementDialog
          matches={duplicates}
          open
          onCancel={cancelDuplicates}
          onAcknowledge={() => void acknowledgeDuplicates()}
          isPending={createSession.isPending || confirmSession.isPending}
        />
      ) : null}
    </form>
  );
}

/* ----------------------------------------------------------------------- */
/*  Manual text intake                                                     */
/* ----------------------------------------------------------------------- */

function ManualIntakeForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [body, setBody] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);

  const createManual = useCreateManualSourceMutation(projectId);
  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  const submit = async (ackIds?: string[]) => {
    try {
      await createManual.mutateAsync({
        title: title.trim(),
        tags: parseTags(tags),
        ...(notes ? { notes } : {}),
        body,
        ...(ackIds && ackIds.length > 0
          ? { duplicateAcknowledgement: { acknowledgedMatchIds: ackIds } }
          : {}),
      });
      toast.success("Manual source created");
      onClose();
    } catch (err) {
      if (isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)) {
        const matches = extractDuplicateMatches(err);
        setDuplicates(matches);
        setPendingIds(acknowledgementIdsFromMatches(matches));
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to create manual source");
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Alert>
        <PencilLineIcon />
        <AlertTitle>Manual text is immutable once saved</AlertTitle>
        <AlertDescription>
          Corrections must be captured as a new version, not by editing this entry. The content you
          paste here becomes the canonical evidence body.
        </AlertDescription>
      </Alert>

      <MetadataFields
        title={title}
        setTitle={setTitle}
        notes={notes}
        setNotes={setNotes}
        tags={tags}
        setTags={setTags}
        disabled={createManual.isPending}
      />

      <Field>
        <FieldLabel htmlFor="manual-body">Body</FieldLabel>
        <Textarea
          id="manual-body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste or type the source content"
          rows={12}
          disabled={createManual.isPending}
        />
      </Field>

      <SheetFooter className="flex-row items-center justify-end gap-2 border-t p-0 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || createManual.isPending}>
          {createManual.isPending ? <Spinner /> : null} Save source
        </Button>
      </SheetFooter>

      {duplicates ? (
        <DuplicateAcknowledgementDialog
          matches={duplicates}
          open
          onCancel={() => {
            setDuplicates(null);
            setPendingIds(null);
          }}
          onAcknowledge={() => {
            setDuplicates(null);
            void submit(pendingIds ?? []);
          }}
          isPending={createManual.isPending}
        />
      ) : null}
    </form>
  );
}

/* ----------------------------------------------------------------------- */
/*  Reference intake                                                       */
/* ----------------------------------------------------------------------- */

/**
 * Reference kinds fall into two families:
 *   - Metadata-only (URL / article / app store listing) — direct endpoint.
 *   - File-bearing (screenshot_set / uploaded_export) — upload-session flow.
 */
const REFERENCE_KIND_OPTIONS = [
  { value: "url", label: "URL", family: "direct" },
  { value: "screenshot_set", label: "Screenshot set", family: "upload" },
  { value: "uploaded_export", label: "Uploaded export", family: "upload" },
  { value: "article", label: "Article", family: "direct" },
  { value: "app_store_listing", label: "App store listing", family: "direct" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  family: "direct" | "upload";
}>;

type ReferenceKindOption = (typeof REFERENCE_KIND_OPTIONS)[number];
type ReferenceKind = ReferenceKindOption["value"];

const ACCESS_TYPE_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "client_owned", label: "Client owned" },
  { value: "permissioned", label: "Permissioned" },
] as const;

const INTENDED_USE_OPTIONS = [
  { value: "inspiration", label: "Inspiration" },
  { value: "feature_parity", label: "Feature parity" },
  { value: "differentiation_baseline", label: "Differentiation baseline" },
] as const;

type ReferenceFamily = ReferenceKindOption["family"];

function referenceFamily(kind: ReferenceKind): ReferenceFamily {
  const option = REFERENCE_KIND_OPTIONS.find((o) => o.value === kind);
  return option?.family ?? "direct";
}

/**
 * Direct-endpoint capture methods. `user_uploaded_screenshot` is deliberately
 * excluded — it must always route through an upload session so the bytes are
 * scanned and stored under a canonical object key.
 *
 * `on_demand_single_page_capture` is only offered when the server-authoritative
 * `singlePageCaptureEnabled` flag is true; when the capability is disabled the
 * option is omitted entirely (never rendered disabled or discovered by a
 * failed submission).
 */
const DIRECT_CAPTURE_METHODS = [
  { value: "manual_paste", label: "Manual paste" },
  { value: "on_demand_single_page_capture", label: "On-demand capture" },
] as const;

type DirectCaptureMethod = (typeof DIRECT_CAPTURE_METHODS)[number]["value"];

function availableDirectCaptureMethods(
  singlePageCaptureEnabled: boolean,
): ReadonlyArray<(typeof DIRECT_CAPTURE_METHODS)[number]> {
  if (singlePageCaptureEnabled) return DIRECT_CAPTURE_METHODS;
  return DIRECT_CAPTURE_METHODS.filter((m) => m.value !== "on_demand_single_page_capture");
}

function ReferenceIntakeForm({
  projectId,
  singlePageCaptureEnabled,
  onClose,
}: {
  projectId: string;
  singlePageCaptureEnabled: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [kind, setKind] = useState<ReferenceKind>("url");

  const family = referenceFamily(kind);

  if (family === "upload") {
    // The upload-session subform owns its own state and mutations; remount
    // via key when the kind changes so state is cleared cleanly.
    return (
      <ReferenceUploadForm
        key={kind}
        projectId={projectId}
        kind={kind as "screenshot_set" | "uploaded_export"}
        onKindChange={setKind}
        commonTitle={title}
        setCommonTitle={setTitle}
        commonNotes={notes}
        setCommonNotes={setNotes}
        commonTags={tags}
        setCommonTags={setTags}
        onClose={onClose}
      />
    );
  }

  return (
    <ReferenceDirectForm
      key={kind}
      projectId={projectId}
      kind={kind}
      onKindChange={setKind}
      singlePageCaptureEnabled={singlePageCaptureEnabled}
      title={title}
      setTitle={setTitle}
      notes={notes}
      setNotes={setNotes}
      tags={tags}
      setTags={setTags}
      onClose={onClose}
    />
  );
}

/* --- Reference kind picker (shared shell) --- */

function ReferenceKindPicker({
  kind,
  onChange,
  disabled,
}: {
  kind: ReferenceKind;
  onChange: (kind: ReferenceKind) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="ref-kind">Reference kind</FieldLabel>
      <Select
        value={kind}
        onValueChange={(v) => onChange(v as ReferenceKind)}
        disabled={disabled ?? false}
      >
        <SelectTrigger id="ref-kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {REFERENCE_KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

/* --- Direct reference (URL / article / app_store_listing) --- */

function ReferenceDirectForm({
  projectId,
  kind,
  onKindChange,
  singlePageCaptureEnabled,
  title,
  setTitle,
  notes,
  setNotes,
  tags,
  setTags,
  onClose,
}: {
  projectId: string;
  kind: ReferenceKind;
  onKindChange: (kind: ReferenceKind) => void;
  singlePageCaptureEnabled: boolean;
  title: string;
  setTitle: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  onClose: () => void;
}) {
  const captureMethods = availableDirectCaptureMethods(singlePageCaptureEnabled);
  // The very first method is always the safe manual_paste default; use it as
  // the initial value so we never seed a disabled capture method that has been
  // omitted from the visible option list.
  const [captureMethod, setCaptureMethod] = useState<DirectCaptureMethod>("manual_paste");
  const [accessType, setAccessType] =
    useState<(typeof ACCESS_TYPE_OPTIONS)[number]["value"]>("public");
  const [intendedUse, setIntendedUse] =
    useState<(typeof INTENDED_USE_OPTIONS)[number]["value"]>("inspiration");
  const [sourceUrl, setSourceUrl] = useState("");
  const [attested, setAttested] = useState(false);

  const createReference = useCreateReferenceSourceMutation(projectId);
  const queryClient = useQueryClient();

  const requiresUrl = kind === "url" || kind === "article" || kind === "app_store_listing";
  const requiresUrlForCapture = captureMethod === "on_demand_single_page_capture";
  const canSubmit =
    title.trim().length > 0 &&
    attested &&
    (!requiresUrl || sourceUrl.trim().length > 0) &&
    (!requiresUrlForCapture || sourceUrl.trim().length > 0) &&
    !createReference.isPending;

  const submit = async () => {
    let created: Awaited<ReturnType<typeof createReference.mutateAsync>>;
    try {
      created = await createReference.mutateAsync({
        title: title.trim(),
        tags: parseTags(tags),
        ...(notes ? { notes } : {}),
        reference: {
          referenceKind: kind as
            | "url"
            | "article"
            | "app_store_listing"
            | "screenshot_set"
            | "uploaded_export",
          captureMethod,
          accessType,
          intendedUse,
          ...(sourceUrl ? { sourceUrl } : {}),
          attestation: {
            attestationText: REFERENCE_ATTESTATION_TEXT,
            attestationVersion: "v1",
            acceptedAt: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record reference");
      return;
    }

    // For on-demand capture, kick off the capture mutation against the source
    // we just created; a queued capture completes as a new version.
    if (captureMethod === "on_demand_single_page_capture" && sourceUrl && created?.id) {
      try {
        await requestReferenceCapture(projectId, created.id, { url: sourceUrl });
        await invalidateSourceTargets(
          queryClient,
          getSourceDetailInvalidationTargets(projectId, created.id),
        );
        toast.success("Reference recorded — capture queued.");
      } catch (err) {
        if (isSourceErrorCode(err, SOURCE_ERROR_CODES.captureDisabled)) {
          toast.warning(
            "Reference recorded, but automatic capture is disabled for this organization. Add screenshots or an exported file via a new reference of kind “Screenshot set” or “Uploaded export”.",
          );
        } else {
          toast.warning(
            `Reference recorded, but capture request failed: ${
              err instanceof Error ? err.message : "unknown error"
            }. You can request another capture from the source detail page.`,
          );
        }
      }
    } else {
      toast.success("Reference recorded");
    }

    onClose();
    return created;
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <MetadataFields
        title={title}
        setTitle={setTitle}
        notes={notes}
        setNotes={setNotes}
        tags={tags}
        setTags={setTags}
        disabled={createReference.isPending}
      />

      <Separator />

      <FieldGroup>
        <ReferenceKindPicker
          kind={kind}
          onChange={onKindChange}
          disabled={createReference.isPending}
        />

        <Field>
          <FieldLabel htmlFor="ref-capture">Capture method</FieldLabel>
          <Select
            value={captureMethod}
            onValueChange={(v) => setCaptureMethod(v as DirectCaptureMethod)}
            disabled={createReference.isPending}
          >
            <SelectTrigger id="ref-capture">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {captureMethods.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            {singlePageCaptureEnabled
              ? "On-demand capture asks the worker to fetch and archive a snapshot of the source URL."
              : "On-demand capture is disabled for this workspace. Record the URL as a manual reference; you can attach screenshots or an exported file via a separate reference of kind “Screenshot set” or “Uploaded export”."}
          </FieldDescription>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ref-access">Access type</FieldLabel>
            <Select
              value={accessType}
              onValueChange={(v) => setAccessType(v as typeof accessType)}
              disabled={createReference.isPending}
            >
              <SelectTrigger id="ref-access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ACCESS_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ref-use">Intended use</FieldLabel>
            <Select
              value={intendedUse}
              onValueChange={(v) => setIntendedUse(v as typeof intendedUse)}
              disabled={createReference.isPending}
            >
              <SelectTrigger id="ref-use">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {INTENDED_USE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {requiresUrl || requiresUrlForCapture ? (
          <Field>
            <FieldLabel htmlFor="ref-url">Source URL</FieldLabel>
            <Input
              id="ref-url"
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/reference"
              disabled={createReference.isPending}
            />
          </Field>
        ) : null}
      </FieldGroup>

      <Separator />

      <AttestationField
        id="ref-attest"
        checked={attested}
        onChange={setAttested}
        disabled={createReference.isPending}
      />

      <SheetFooter className="flex-row items-center justify-end gap-2 border-t p-0 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {createReference.isPending ? <Spinner /> : null} Save reference
        </Button>
      </SheetFooter>
    </form>
  );
}

/* --- Reference upload session (screenshot_set / uploaded_export) --- */

function ReferenceUploadForm({
  projectId,
  kind,
  onKindChange,
  commonTitle,
  setCommonTitle,
  commonNotes,
  setCommonNotes,
  commonTags,
  setCommonTags,
  onClose,
}: {
  projectId: string;
  kind: "screenshot_set" | "uploaded_export";
  onKindChange: (kind: ReferenceKind) => void;
  commonTitle: string;
  setCommonTitle: (v: string) => void;
  commonNotes: string;
  setCommonNotes: (v: string) => void;
  commonTags: string;
  setCommonTags: (v: string) => void;
  onClose: () => void;
}) {
  const [accessType, setAccessType] =
    useState<(typeof ACCESS_TYPE_OPTIONS)[number]["value"]>("public");
  const [intendedUse, setIntendedUse] =
    useState<(typeof INTENDED_USE_OPTIONS)[number]["value"]>("inspiration");
  const [sourceUrl, setSourceUrl] = useState("");
  const [attested, setAttested] = useState(false);

  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [isHashing, setIsHashing] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [duplicatePhase, setDuplicatePhase] = useState<"create" | "confirm" | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const uploaderRef = useRef<ReturnType<typeof createSessionUploader> | null>(null);
  const pendingBodyRef = useRef<UploadSessionCreateInput | null>(null);

  const createSession = useCreateUploadSessionMutation(projectId);
  const confirmSession = useConfirmUploadSessionMutation(projectId);
  const cancelSession = useCancelUploadSessionMutation(projectId);

  useEffect(() => {
    return () => uploaderRef.current?.destroy();
  }, []);

  const requiresMultiple = kind === "screenshot_set";
  const isPending = createSession.isPending || confirmSession.isPending;
  const canSubmit =
    commonTitle.trim().length > 0 &&
    attested &&
    selected.length > 0 &&
    selected.every((s) => s.sha256 && !s.validationError) &&
    (!requiresMultiple ? selected.length === 1 : selected.length >= 1) &&
    !isPending;

  const onSelectFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      setSelected([]);
      return;
    }
    if (!requiresMultiple && files.length > 1) {
      toast.error("Uploaded export accepts a single file.");
      return;
    }
    const initial: SelectedFile[] = files.map((file) => {
      const v = validateUploadFile(
        { name: file.name, type: file.type, size: file.size },
        requiresMultiple ? "screenshot" : "any",
      );
      const clientId = nextClientId();
      return v.ok ? { clientId, file } : { clientId, file, validationError: v.reason };
    });
    setSelected(initial);
    setIsHashing(true);
    try {
      const hashed = await Promise.all(
        initial.map(async (entry) => {
          if (entry.validationError) return entry;
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
    validFiles: readonly (SelectedFile & { sha256: string })[],
  ): UploadSessionCreateInput => ({
    sourceType: "reference",
    title: commonTitle.trim(),
    tags: parseTags(commonTags),
    ...(commonNotes ? { notes: commonNotes } : {}),
    reference: {
      referenceKind: kind,
      captureMethod: "user_uploaded_screenshot",
      accessType,
      intendedUse,
      ...(sourceUrl ? { sourceUrl } : {}),
      attestation: {
        attestationText: REFERENCE_ATTESTATION_TEXT,
        attestationVersion: "v1",
        acceptedAt: new Date().toISOString(),
      },
    },
    files: validFiles.map((entry, index) => {
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

  const runSession = async (body: UploadSessionCreateInput) => {
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
      toast.error(err instanceof Error ? err.message : "Failed to start reference upload");
      return;
    }

    setSessionId(session.id);
    const orderedFiles = session.files.slice().sort((a, b) => a.ordinal - b.ordinal);
    const prepared = orderedFiles.map((f) => {
      // Correlate by ordinal (session file ordering matches the local
      // selection order); do NOT match by filename because a screenshot set
      // may legitimately contain duplicate filenames.
      const localFile = selected[f.ordinal]?.file;
      if (!localFile) throw new Error(`Missing local file for ordinal ${f.ordinal}`);
      return {
        file: localFile,
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
      await confirmSession.mutateAsync({
        sessionId: sid,
        input:
          ackIds && ackIds.length > 0
            ? { duplicateAcknowledgement: { acknowledgedMatchIds: ackIds } }
            : {},
      });
      toast.success("Reference uploaded");
      onClose();
    } catch (err) {
      if (isSourceErrorCode(err, SOURCE_ERROR_CODES.duplicateConfirmationRequired)) {
        setDuplicates(extractDuplicateMatches(err));
        setDuplicatePhase("confirm");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to confirm reference upload");
    }
  };

  const handleSubmit = async () => {
    const validFiles = selected.filter(
      (s): s is SelectedFile & { sha256: string } => Boolean(s.sha256) && !s.validationError,
    );
    if (validFiles.length === 0) return;
    const body = buildBody(validFiles);
    await runSession(body);
  };

  const acknowledgeDuplicates = async () => {
    const matches = duplicates ?? [];
    const ids = acknowledgementIdsFromMatches(matches);
    if (duplicatePhase === "create") {
      const pending = pendingBodyRef.current;
      if (!pending) return;
      const body: UploadSessionCreateInput = {
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

  const cancelDuplicates = () => {
    setDuplicates(null);
    setDuplicatePhase(null);
  };

  const handleCancel = async () => {
    uploaderRef.current?.cancel();
    if (sessionId) {
      await cancelSessionWithWarning(cancelSession, sessionId);
    }
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <Alert>
        <InfoIcon />
        <AlertTitle>
          {requiresMultiple
            ? "Screenshot set — one or more image files"
            : "Uploaded export — a single exported file"}
        </AlertTitle>
        <AlertDescription>
          {requiresMultiple
            ? "Upload the screenshots in the order they should appear. Duplicate filenames are allowed."
            : "Upload the exported PDF or document representing this reference. One file per source."}
        </AlertDescription>
      </Alert>

      <MetadataFields
        title={commonTitle}
        setTitle={setCommonTitle}
        notes={commonNotes}
        setNotes={setCommonNotes}
        tags={commonTags}
        setTags={setCommonTags}
        disabled={isPending}
      />

      <Separator />

      <FieldGroup>
        <ReferenceKindPicker kind={kind} onChange={onKindChange} disabled={isPending} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ref-access-upload">Access type</FieldLabel>
            <Select
              value={accessType}
              onValueChange={(v) => setAccessType(v as typeof accessType)}
              disabled={isPending}
            >
              <SelectTrigger id="ref-access-upload">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ACCESS_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ref-use-upload">Intended use</FieldLabel>
            <Select
              value={intendedUse}
              onValueChange={(v) => setIntendedUse(v as typeof intendedUse)}
              disabled={isPending}
            >
              <SelectTrigger id="ref-use-upload">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {INTENDED_USE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="ref-url-upload">Source URL (optional)</FieldLabel>
          <Input
            id="ref-url-upload"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/reference"
            disabled={isPending}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="ref-files">Files</FieldLabel>
          <input
            id="ref-files"
            type="file"
            accept={acceptedMimeTypes(requiresMultiple ? "screenshot" : "any").join(",")}
            multiple={requiresMultiple}
            onChange={(e) => void onSelectFiles(e)}
            className="block w-full text-sm"
            disabled={isPending}
          />
          <FieldDescription>
            {requiresMultiple
              ? `Accepted: ${acceptedExtensions("screenshot").join(", ")}. Order matters — files upload in the order selected.`
              : `Accepted: ${acceptedExtensions().join(", ")}. Exactly one file.`}
          </FieldDescription>
        </Field>
      </FieldGroup>

      {selected.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          {selected.map((s, index) => (
            <div key={s.clientId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {index + 1}. {s.file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(s.file.size / 1024 / 1024).toFixed(2)} MiB
                </span>
              </div>
              {s.validationError ? (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircleIcon className="size-3" />
                  {s.validationError}
                </span>
              ) : isHashing && !s.sha256 ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Spinner /> Hashing…
                </span>
              ) : s.sha256 ? (
                <span className="font-mono text-xs text-muted-foreground">
                  sha256:{s.sha256.slice(0, 12)}…
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {progress.length > 0 ? (
        <output aria-live="polite" className="flex flex-col gap-3">
          {progress.map((p) => (
            <div key={p.fileId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate">{p.fileName}</span>
                <span className="text-muted-foreground">{p.percent}%</span>
              </div>
              <Progress value={p.percent} />
              {p.status === "error" ? (
                <span className="text-xs text-destructive">{p.errorMessage}</span>
              ) : null}
            </div>
          ))}
        </output>
      ) : null}

      <Separator />

      <AttestationField
        id="ref-attest-upload"
        checked={attested}
        onChange={setAttested}
        disabled={isPending}
      />

      <SheetFooter className="flex-row items-center justify-end gap-2 border-t p-0 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleCancel()}
          disabled={confirmSession.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? <Spinner /> : <FileUpIcon data-icon="inline-start" />} Start upload
        </Button>
      </SheetFooter>

      {duplicates ? (
        <DuplicateAcknowledgementDialog
          matches={duplicates}
          open
          onCancel={cancelDuplicates}
          onAcknowledge={() => void acknowledgeDuplicates()}
          isPending={isPending}
        />
      ) : null}
    </form>
  );
}
