import { describe, expect, it } from "vitest";
import {
  acceptedExtensions,
  acceptedMimeTypes,
  formatFromFileName,
  maxUploadBytes,
  validateUploadFile,
} from "./upload-formats";

describe("upload formats", () => {
  it("defaults to a 100 MiB upload limit", () => {
    expect(maxUploadBytes()).toBe(100 * 1024 * 1024);
  });

  it("resolves formats from filename extensions", () => {
    expect(formatFromFileName("plan.pdf")).toBe("pdf");
    expect(formatFromFileName("PLAN.PDF")).toBe("pdf");
    expect(formatFromFileName("notes.markdown")).toBe("md");
    expect(formatFromFileName("noext")).toBeNull();
    expect(formatFromFileName("thing.exe")).toBeNull();
  });

  it("lists all accepted extensions for the default and screenshot kinds", () => {
    expect(acceptedExtensions().length).toBeGreaterThan(5);
    const screenshots = acceptedExtensions("screenshot");
    expect(screenshots).toEqual(expect.arrayContaining([".png", ".jpg", ".webp"]));
    expect(screenshots).not.toContain(".pdf");
  });

  it("provides mime types that Uppy can hand to a file picker", () => {
    const mimes = acceptedMimeTypes();
    expect(mimes).toEqual(expect.arrayContaining(["application/pdf", "image/png"]));
  });

  it("validates size and format for uploads", () => {
    expect(validateUploadFile({ name: "small.pdf", type: "application/pdf", size: 1024 })).toEqual({
      ok: true,
      format: "pdf",
    });

    expect(
      validateUploadFile({ name: "big.pdf", type: "application/pdf", size: 200 * 1024 * 1024 }),
    ).toMatchObject({ ok: false });

    expect(
      validateUploadFile({ name: "code.exe", type: "application/octet-stream", size: 100 }),
    ).toMatchObject({ ok: false });
  });

  it("rejects non-image files in screenshot kind", () => {
    expect(
      validateUploadFile({ name: "note.pdf", type: "application/pdf", size: 100 }, "screenshot"),
    ).toMatchObject({ ok: false });
  });
});
