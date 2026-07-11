import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureFailedError, CaptureUnavailableError } from "../capture/capture-adapter.js";
import { CaptureUrlBlockedError } from "../capture/ssrf-guard.js";

const requireSourceDocument = vi.fn();
const findCaptureSuccessorState = vi.fn();
const findReferenceArtifact = vi.fn();
const createReferenceCaptureSuccessor = vi.fn();
const recordWorkerAuditEvent = vi.fn();

vi.mock("../db/source-vault-repository.js", async () => {
  const actual = await vi.importActual<typeof import("../db/source-vault-repository.js")>(
    "../db/source-vault-repository.js",
  );
  return {
    ...actual,
    requireSourceDocument: (...args: unknown[]) => requireSourceDocument(...args),
    findCaptureSuccessorState: (...args: unknown[]) => findCaptureSuccessorState(...args),
    findReferenceArtifact: (...args: unknown[]) => findReferenceArtifact(...args),
    createReferenceCaptureSuccessor: (...args: unknown[]) =>
      createReferenceCaptureSuccessor(...args),
    // `isCaptureSuccessorComplete` is a pure function -- keep the real implementation so these
    // tests exercise the actual completeness decision, not a mock stand-in for it.
  };
});

vi.mock("../runtime/audit.js", () => ({
  recordWorkerAuditEvent: (...args: unknown[]) => recordWorkerAuditEvent(...args),
}));

const { handleCaptureReference } = await import("./capture-reference.js");
const {
  IncompleteCaptureSuccessorError,
  InvalidJobDataError,
  RetryableWorkerError,
  TerminalWorkerError,
} = await import("../errors.js");

const PREDECESSOR_ID = "11111111-1111-1111-1111-111111111111";
const SUCCESSOR_ID = "22222222-2222-2222-2222-222222222222";
const LINEAGE_ID = "33333333-3333-3333-3333-333333333333";
const EXTRACTION_ID = "44444444-4444-4444-4444-444444444444";
const ORG_ID = "org-1";
const PROJECT_ID = "project-1";
const CAPTURE_URL = "https://example.com/page";

function buildPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: "capture-reference" as const,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    idempotencyKey: "key-1",
    correlationId: "corr-1",
    submittedAt: new Date().toISOString(),
    sourceDocumentId: PREDECESSOR_ID,
    actorId: "actor-1",
    captureUrl: CAPTURE_URL,
    ...overrides,
  };
}

/** The predecessor `source_document` row -- this must never be mutated by a successful or a
 * failed capture attempt (only a brand-new successor version may carry the new content). */
function buildPredecessorRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PREDECESSOR_ID,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    lineageId: LINEAGE_ID,
    versionNumber: 1,
    supersedesId: null,
    sourceType: "reference",
    documentFormat: null,
    title: "Example reference",
    notes: null,
    tags: [],
    provenanceDate: null,
    contentHash: "a".repeat(64),
    processingStatus: "capture_pending",
    createdBy: "actor-0",
    ...overrides,
  };
}

function buildReferenceArtifactRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "reference-1",
    sourceDocumentId: PREDECESSOR_ID,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    referenceKind: "web_page",
    captureMethod: "on_demand_single_page_capture",
    accessType: "public",
    intendedUse: "citation",
    sourceUrl: CAPTURE_URL,
    ipReviewStatus: "not_reviewed",
    attestationText: "I attest I have the right to use this reference.",
    attestationVersion: "v1",
    attestedBy: "actor-0",
    attestedAt: new Date("2024-01-01T00:00:00.000Z"),
    capturedAt: null,
    ...overrides,
  };
}

function buildCaptureResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    finalUrl: CAPTURE_URL,
    title: "Example page",
    screenshotPng: Buffer.from("fake-png-bytes"),
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    db: {},
    storage: {
      putObject: vi.fn().mockResolvedValue({ objectKey: "capture-key", versionId: "v1" }),
    },
    env: {
      REFERENCE_CAPTURE_TIMEOUT_MS: 15_000,
      REFERENCE_CAPTURE_MAX_REDIRECTS: 3,
      REFERENCE_CAPTURE_MAX_RESPONSE_BYTES: 10_000_000,
      REFERENCE_CAPTURE_MAX_TOTAL_BYTES: 20_000_000,
    },
    captureEnabled: true,
    captureAdapter: { capture: vi.fn().mockResolvedValue(buildCaptureResult()) },
    ...overrides,
  };
}

function buildQueue() {
  return { add: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  findCaptureSuccessorState.mockResolvedValue(null);
});

describe("handleCaptureReference", () => {
  it("fails terminally with CAPTURE_DISABLED when the feature flag is off", async () => {
    const context = buildContext({ captureEnabled: false });

    await expect(
      handleCaptureReference(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(TerminalWorkerError);

    expect(requireSourceDocument).not.toHaveBeenCalled();
  });

  it("captures successfully, creates a NEW immutable source_document version atomically, and never mutates the predecessor", async () => {
    const predecessor = buildPredecessorRow();
    requireSourceDocument.mockResolvedValue(predecessor);
    findReferenceArtifact.mockResolvedValue(buildReferenceArtifactRow());
    const successor = {
      ...predecessor,
      id: SUCCESSOR_ID,
      versionNumber: 2,
      supersedesId: predecessor.id,
      processingStatus: "extraction_pending",
    };
    createReferenceCaptureSuccessor.mockResolvedValue({
      kind: "created",
      successor,
      extraction: { id: EXTRACTION_ID },
    });

    const context = buildContext();
    const queue = buildQueue();
    const captureResult = buildCaptureResult();
    (context.captureAdapter as { capture: ReturnType<typeof vi.fn> }).capture.mockResolvedValue(
      captureResult,
    );

    await handleCaptureReference(context as never, queue as never, buildPayload());

    // All companion rows are created through the single atomic transaction function -- there is
    // no separate insert-per-row code path left in the handler at all.
    expect(createReferenceCaptureSuccessor).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        predecessorId: predecessor.id,
        successor: expect.objectContaining({
          organizationId: predecessor.organizationId,
          projectId: predecessor.projectId,
          lineageId: predecessor.lineageId,
          versionNumber: predecessor.versionNumber + 1,
          processingStatus: "extraction_pending",
          createdBy: "actor-1",
        }),
        referenceArtifact: expect.objectContaining({
          captureMethod: "on_demand_single_page_capture",
          capturedAt: new Date(captureResult.capturedAt),
          sourceUrl: CAPTURE_URL,
        }),
        file: expect.objectContaining({
          role: "snapshot",
          format: "png",
          objectKey: "capture-key",
        }),
        audit: expect.objectContaining({
          action: "source.capture.succeeded",
          organizationId: ORG_ID,
          projectId: PROJECT_ID,
        }),
      }),
    );

    expect(queue.add).toHaveBeenCalledWith(
      "extract",
      expect.objectContaining({
        kind: "extract",
        sourceDocumentId: SUCCESSOR_ID,
        sourceExtractionId: EXTRACTION_ID,
      }),
      expect.anything(),
    );
  });

  it("a ready predecessor (not a fresh capture_pending row) is still capturable", async () => {
    const predecessor = buildPredecessorRow({ processingStatus: "ready" });
    requireSourceDocument.mockResolvedValue(predecessor);
    findReferenceArtifact.mockResolvedValue(buildReferenceArtifactRow());
    createReferenceCaptureSuccessor.mockResolvedValue({
      kind: "created",
      successor: {
        ...predecessor,
        id: SUCCESSOR_ID,
        versionNumber: 2,
        supersedesId: predecessor.id,
      },
      extraction: { id: EXTRACTION_ID },
    });

    const context = buildContext();

    await handleCaptureReference(context as never, buildQueue() as never, buildPayload());

    expect(context.captureAdapter.capture).toHaveBeenCalled();
    expect(createReferenceCaptureSuccessor).toHaveBeenCalled();
  });

  it("throws a retryable error when the capture adapter reports unavailability, without creating a successor", async () => {
    requireSourceDocument.mockResolvedValue(buildPredecessorRow());
    findReferenceArtifact.mockResolvedValue(buildReferenceArtifactRow());

    const context = buildContext({
      captureAdapter: {
        capture: vi.fn().mockRejectedValue(new CaptureUnavailableError("no browser installed")),
      },
    });

    await expect(
      handleCaptureReference(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(RetryableWorkerError);

    expect(createReferenceCaptureSuccessor).not.toHaveBeenCalled();
  });

  it("fails terminally with an audit record when the URL is SSRF-blocked, without mutating or superseding the predecessor", async () => {
    const predecessor = buildPredecessorRow();
    requireSourceDocument.mockResolvedValue(predecessor);
    findReferenceArtifact.mockResolvedValue(buildReferenceArtifactRow());

    const context = buildContext({
      captureAdapter: {
        capture: vi.fn().mockRejectedValue(new CaptureUrlBlockedError("private IP address")),
      },
    });

    await expect(
      handleCaptureReference(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(TerminalWorkerError);

    expect(createReferenceCaptureSuccessor).not.toHaveBeenCalled();
    expect(recordWorkerAuditEvent).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        entityType: "source_document",
        entityId: predecessor.id,
        after: expect.objectContaining({ failureCode: "CAPTURE_BLOCKED" }),
      }),
    );
  });

  it("fails terminally on a generic capture failure, without mutating the predecessor", async () => {
    requireSourceDocument.mockResolvedValue(buildPredecessorRow());
    findReferenceArtifact.mockResolvedValue(buildReferenceArtifactRow());

    const context = buildContext({
      captureAdapter: {
        capture: vi.fn().mockRejectedValue(new CaptureFailedError("navigation timed out")),
      },
    });

    await expect(
      handleCaptureReference(context as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(TerminalWorkerError);

    expect(createReferenceCaptureSuccessor).not.toHaveBeenCalled();
    expect(recordWorkerAuditEvent).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        after: expect.objectContaining({ failureCode: "CAPTURE_FAILED" }),
      }),
    );
  });

  it("rejects when the payload captureUrl does not match the reference_artifact row", async () => {
    requireSourceDocument.mockResolvedValue(buildPredecessorRow());
    findReferenceArtifact.mockResolvedValue(
      buildReferenceArtifactRow({ sourceUrl: "https://example.com/other-page" }),
    );

    await expect(
      handleCaptureReference(buildContext() as never, buildQueue() as never, buildPayload()),
    ).rejects.toBeInstanceOf(InvalidJobDataError);
  });

  it("is idempotent: replay against a fully committed successor never forks again and re-enqueues extract for the existing successor", async () => {
    const predecessor = buildPredecessorRow();
    requireSourceDocument.mockResolvedValue(predecessor);
    const successor = {
      ...predecessor,
      id: SUCCESSOR_ID,
      versionNumber: 2,
      supersedesId: predecessor.id,
    };
    findCaptureSuccessorState.mockResolvedValue({
      successor,
      hasReferenceArtifact: true,
      hasSourceDocumentFile: true,
      extraction: { id: EXTRACTION_ID },
    });

    const context = buildContext();
    const queue = buildQueue();

    await handleCaptureReference(context as never, queue as never, buildPayload());

    // Replay never captures again and never attempts a second fork.
    expect(context.captureAdapter.capture).not.toHaveBeenCalled();
    expect(createReferenceCaptureSuccessor).not.toHaveBeenCalled();
    expect(findReferenceArtifact).not.toHaveBeenCalled();

    // It still (idempotently) re-enqueues extraction for the already-created successor.
    expect(queue.add).toHaveBeenCalledWith(
      "extract",
      expect.objectContaining({
        kind: "extract",
        sourceDocumentId: SUCCESSOR_ID,
        sourceExtractionId: EXTRACTION_ID,
      }),
      expect.anything(),
    );
  });

  it("fails explicitly (never silently completes) when a replayed successor is missing its source_extraction row", async () => {
    const predecessor = buildPredecessorRow();
    requireSourceDocument.mockResolvedValue(predecessor);
    findCaptureSuccessorState.mockResolvedValue({
      successor: {
        ...predecessor,
        id: SUCCESSOR_ID,
        versionNumber: 2,
        supersedesId: predecessor.id,
      },
      hasReferenceArtifact: true,
      hasSourceDocumentFile: true,
      extraction: null,
    });

    const context = buildContext();
    const queue = buildQueue();

    await expect(
      handleCaptureReference(context as never, queue as never, buildPayload()),
    ).rejects.toBeInstanceOf(IncompleteCaptureSuccessorError);

    expect(queue.add).not.toHaveBeenCalled();
    expect(context.captureAdapter.capture).not.toHaveBeenCalled();
    expect(createReferenceCaptureSuccessor).not.toHaveBeenCalled();
  });

  it("fails explicitly when a replayed successor is missing its reference_artifact or source_document_file companion", async () => {
    const predecessor = buildPredecessorRow();
    requireSourceDocument.mockResolvedValue(predecessor);
    findCaptureSuccessorState.mockResolvedValue({
      successor: {
        ...predecessor,
        id: SUCCESSOR_ID,
        versionNumber: 2,
        supersedesId: predecessor.id,
      },
      hasReferenceArtifact: false,
      hasSourceDocumentFile: true,
      extraction: { id: EXTRACTION_ID },
    });

    const context = buildContext();
    const queue = buildQueue();

    await expect(
      handleCaptureReference(context as never, queue as never, buildPayload()),
    ).rejects.toBeInstanceOf(IncompleteCaptureSuccessorError);

    expect(queue.add).not.toHaveBeenCalled();
  });
});
