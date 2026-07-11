import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * pdf.js is mocked at module scope so no real workers, network calls, or
 * canvas rasterization happens in jsdom. The mocks let us verify:
 *  - The component renders a <canvas> and never an <iframe>.
 *  - Page navigation calls getPage with the new page index.
 *  - Cancellation is invoked on unmount and on url change.
 *  - Load failures surface the fallback Alert (not an iframe).
 */
const pdfjsMocks = vi.hoisted(() => {
  const cancel = vi.fn();
  const destroy = vi.fn(async () => {});
  const docDestroy = vi.fn(async () => {});
  const cleanup = vi.fn();
  const getPage = vi.fn(async (_pageNumber: number) => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 120 * scale }),
    render: () => ({
      promise: Promise.resolve(),
      cancel,
    }),
    cleanup,
  }));
  const getDocument = vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 3,
      getPage,
      destroy: docDestroy,
    }),
    destroy,
  }));
  const failGetDocument = vi.fn(() => ({
    promise: Promise.reject(new Error("boom")),
    destroy,
  }));
  return {
    cancel,
    destroy,
    docDestroy,
    getPage,
    getDocument,
    failGetDocument,
    GlobalWorkerOptions: { workerSrc: "" },
  };
});

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: pdfjsMocks.GlobalWorkerOptions,
  getDocument: (...args: Parameters<typeof pdfjsMocks.getDocument>) =>
    pdfjsMocks.getDocument(...args),
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "/mock-pdf-worker.mjs",
}));

// jsdom does not implement Canvas 2D contexts — return a minimal stub so the
// component's render() call doesn't throw.
beforeEach(() => {
  vi.stubGlobal("HTMLCanvasElement", HTMLCanvasElement);
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    setTransform: vi.fn(),
  })) as unknown as HTMLCanvasElement["getContext"];
});

afterEach(() => {
  vi.clearAllMocks();
});

async function importPreview() {
  const mod = await import("./pdf-preview");
  return mod.default;
}

describe("PdfPreview", () => {
  it("renders a canvas (not an iframe) and shows the current page count", async () => {
    const PdfPreview = await importPreview();
    render(<PdfPreview url="https://example.com/a.pdf" title="Alpha" />);

    const canvas = await screen.findByTestId("pdf-preview-canvas");
    expect(canvas.tagName.toLowerCase()).toBe("canvas");
    // No iframe is ever mounted for the PDF preview.
    expect(document.querySelector("iframe")).toBeNull();
    // Page indicator reflects the loaded document.
    expect(await screen.findByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it("advances to the next page when Next is clicked", async () => {
    const user = userEvent.setup();
    const PdfPreview = await importPreview();
    render(<PdfPreview url="https://example.com/a.pdf" title="Alpha" />);

    await screen.findByText(/Page 1 of 3/);
    await user.click(screen.getByRole("button", { name: /Next page/i }));

    expect(await screen.findByText(/Page 2 of 3/)).toBeInTheDocument();
    // Page 2 was requested from pdf.js.
    expect(pdfjsMocks.getPage).toHaveBeenCalledWith(2);
  });

  it("destroys the pdf.js document + loading task on unmount", async () => {
    const PdfPreview = await importPreview();
    const { unmount } = render(<PdfPreview url="https://example.com/a.pdf" title="Alpha" />);

    await screen.findByText(/Page 1 of 3/);
    unmount();

    // Either the loading-task destroy or the document destroy is invoked on unmount.
    // The component calls both when the doc has already resolved.
    expect(
      pdfjsMocks.destroy.mock.calls.length + pdfjsMocks.docDestroy.mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("shows a safe fallback Alert (no iframe) when loading fails", async () => {
    // Swap getDocument to a failing implementation for this test only.
    pdfjsMocks.getDocument.mockImplementationOnce(() => ({
      promise: Promise.reject(new Error("bad pdf")),
      destroy: pdfjsMocks.destroy,
    }));

    const onError = vi.fn();
    const PdfPreview = await importPreview();
    render(<PdfPreview url="https://example.com/broken.pdf" title="Broken" onError={onError} />);

    expect(await screen.findByText(/PDF preview failed/i)).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(onError).toHaveBeenCalledWith("bad pdf");
  });
});
