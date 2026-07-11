/**
 * Lazy pdf.js preview.
 *
 * This module is dynamically imported so pdf.js (~2 MB) never enters the
 * initial vault/detail chunk. It renders a signed-URL PDF entirely on a
 * `<canvas>` — never in an `<iframe>` — so embedded HTML/JavaScript is not
 * given a browsing context. Attaching bytes to the API via `disableAutoFetch`
 * plus `useSystemFonts: true`/`isEvalSupported: false`/`disableCreateObjectURL`
 * further restricts what the parser will attempt to do with untrusted PDFs.
 *
 * Cleanup contract:
 *  - The loading task and each render task are cancelled on unmount and when
 *    the source URL changes, so navigating between sources never leaves a
 *    render loop pointed at a stale canvas.
 *  - Any error is surfaced via `onError` for the caller's fallback UI; the
 *    component itself never throws.
 */
import { ChevronLeftIcon, ChevronRightIcon, FileWarningIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy singletons for the pdf.js module + worker URL. Loaded once for the
// lifetime of the tab so subsequent previews don't re-parse the worker file.
type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
};

type PdfPageViewport = { width: number; height: number };

type PdfRenderTask = {
  promise: Promise<void>;
  cancel(): void;
};

type PdfPageProxy = {
  getViewport(options: { scale: number }): PdfPageViewport;
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfPageViewport;
    canvas?: HTMLCanvasElement;
  }): PdfRenderTask;
  cleanup(): void;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocumentProxy>;
  destroy(): Promise<void>;
};

export type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: Record<string, unknown>): PdfLoadingTask;
};

let pdfjsPromise: Promise<PdfJsModule> | null = null;

/**
 * Load pdf.js and configure the worker exactly once. The worker file is
 * asset-imported (`?url`) so Vite emits it as a separate chunk and hashes it
 * for cache-busting. Kept in module scope so re-renders/re-mounts don't
 * re-import it.
 */
async function loadPdfjs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, workerUrl] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf.js
        // ships without a bundled type for the browser build entry we use.
        import("pdfjs-dist") as unknown as Promise<PdfJsModule>,
        import("pdfjs-dist/build/pdf.worker.min.mjs?url").then((m) => m.default as string),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export type PdfPreviewProps = {
  /** Signed URL for the PDF bytes. Changing this URL cancels any in-flight render. */
  url: string;
  /** Accessible title announced to screen readers. */
  title: string;
  /**
   * Optional render scale. Kept small by default so mobile-first CSS clamps
   * width without triggering huge canvas allocations.
   */
  scale?: number;
  /** Notified with a human message when loading/rendering fails. */
  onError?: (message: string) => void;
};

const DEFAULT_SCALE = 1.25;

export default function PdfPreview({
  url,
  title,
  scale = DEFAULT_SCALE,
  onError,
}: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentRef = useRef<PdfDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PdfLoadingTask | null>(null);
  const renderTaskRef = useRef<PdfRenderTask | null>(null);

  const cancelInFlight = useCallback(async () => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
    }
    if (loadingTaskRef.current) {
      try {
        await loadingTaskRef.current.destroy();
      } catch {
        // ignore
      }
      loadingTaskRef.current = null;
    }
    if (documentRef.current) {
      try {
        await documentRef.current.destroy();
      } catch {
        // ignore
      }
      documentRef.current = null;
    }
  }, []);

  // Load the document whenever the URL changes.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);
    setNumPages(null);
    setPage(1);

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        const task = pdfjs.getDocument({
          url,
          // Keep the parser sandboxed: refuse eval, don't create object URLs
          // to blob-embed fonts, don't auto-fetch cross-origin resources.
          isEvalSupported: false,
          useSystemFonts: true,
          disableAutoFetch: true,
          disableStream: false,
        });
        loadingTaskRef.current = task;
        const document = await task.promise;
        if (cancelled) {
          try {
            await document.destroy();
          } catch {
            // ignore
          }
          return;
        }
        documentRef.current = document;
        setNumPages(document.numPages);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load PDF preview";
        setErrorMessage(message);
        setStatus("error");
        onError?.(message);
      }
    })();

    return () => {
      cancelled = true;
      void cancelInFlight();
    };
  }, [url, cancelInFlight, onError]);

  // Render the current page whenever the document or page index changes.
  useEffect(() => {
    if (status !== "ready" || !documentRef.current) return;
    const document = documentRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let cancelled = false;
    let pageProxy: PdfPageProxy | null = null;

    (async () => {
      try {
        pageProxy = await document.getPage(page);
        if (cancelled) return;
        const viewport = pageProxy.getViewport({ scale });
        const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        const renderTask = pageProxy.render({ canvasContext: context, viewport, canvas });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (error) {
        if (cancelled) return;
        // pdf.js signals cancellation as a rejection with name === "RenderingCancelledException".
        const name = (error as { name?: string } | null)?.name;
        if (name === "RenderingCancelledException") {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to render page";
        setErrorMessage(message);
        setStatus("error");
        onError?.(message);
      } finally {
        renderTaskRef.current = null;
        if (pageProxy) {
          try {
            pageProxy.cleanup();
          } catch {
            // ignore
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [status, page, scale, onError]);

  const canPrev = numPages !== null && page > 1;
  const canNext = numPages !== null && page < numPages;

  if (status === "error") {
    return (
      <Alert variant="destructive">
        <FileWarningIcon />
        <AlertTitle>PDF preview failed</AlertTitle>
        <AlertDescription>
          {errorMessage ?? "This PDF couldn't be rendered inline. Download the file to review it."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground" aria-live="polite">
          {numPages === null ? "Loading PDF…" : `Page ${page} of ${numPages}`}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-3.5" /> Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p))}
            disabled={!canNext}
            aria-label="Next page"
          >
            Next <ChevronRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="max-h-[540px] overflow-auto rounded-md border bg-muted/20 p-2">
        {status === "loading" ? <Skeleton className="h-64 w-full" /> : null}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`PDF preview of ${title}, page ${page}${numPages ? ` of ${numPages}` : ""}`}
          className="mx-auto block"
          data-testid="pdf-preview-canvas"
        />
      </div>
    </div>
  );
}
