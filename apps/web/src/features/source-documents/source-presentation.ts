import type { LucideIcon } from "lucide-react";
import {
  BookMarkedIcon,
  CircleCheckIcon,
  ClockIcon,
  FileWarningIcon,
  Loader2Icon,
  PencilLineIcon,
  ShieldAlertIcon,
} from "lucide-react";
import type {
  SourceDetailResponse,
  SourceFormat,
  SourceIpReviewStatus,
  SourceListItem,
  SourceProcessingStatus,
  SourceType,
  SourceVaultCapabilitiesResponse,
} from "./sources-api";

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  document: "Document",
  reference: "Reference",
  manual: "Manual text",
};

const SOURCE_FORMAT_LABELS: Record<SourceFormat, string> = {
  pdf: "PDF",
  docx: "Word (DOCX)",
  txt: "Plain text",
  md: "Markdown",
  xlsx: "Spreadsheet (XLSX)",
  csv: "CSV",
  pptx: "Presentation (PPTX)",
  png: "PNG image",
  jpg: "JPEG image",
  jpeg: "JPEG image",
  webp: "WebP image",
};

const PROCESSING_STATUS_LABELS: Record<SourceProcessingStatus, string> = {
  verification_pending: "Verification pending",
  scan_pending: "Malware scan pending",
  scanning: "Scanning",
  extraction_pending: "Extraction pending",
  extracting: "Extracting",
  ready: "Ready",
  quarantined: "Quarantined",
  failed: "Failed",
};

const IP_REVIEW_LABELS: Record<SourceIpReviewStatus, string> = {
  not_reviewed: "Not reviewed",
  cleared: "Cleared",
  restricted: "Restricted",
};

export type ProcessingSeverity = "critical" | "high" | "medium" | "low" | "info";

type ProcessingMeta = {
  label: string;
  icon: LucideIcon;
  /** Cartographer semantic severity — never raw colors. */
  severity: ProcessingSeverity;
  isTerminal: boolean;
  isBlocking: boolean;
};

const PROCESSING_META: Record<SourceProcessingStatus, ProcessingMeta> = {
  verification_pending: {
    label: "Verification pending",
    icon: ClockIcon,
    severity: "info",
    isTerminal: false,
    isBlocking: false,
  },
  scan_pending: {
    label: "Malware scan pending",
    icon: ClockIcon,
    severity: "info",
    isTerminal: false,
    isBlocking: false,
  },
  scanning: {
    label: "Scanning",
    icon: Loader2Icon,
    severity: "info",
    isTerminal: false,
    isBlocking: false,
  },
  extraction_pending: {
    label: "Extraction pending",
    icon: ClockIcon,
    severity: "info",
    isTerminal: false,
    isBlocking: false,
  },
  extracting: {
    label: "Extracting",
    icon: Loader2Icon,
    severity: "info",
    isTerminal: false,
    isBlocking: false,
  },
  ready: {
    label: "Ready",
    icon: CircleCheckIcon,
    severity: "low",
    isTerminal: true,
    isBlocking: false,
  },
  quarantined: {
    label: "Quarantined",
    icon: ShieldAlertIcon,
    severity: "critical",
    isTerminal: true,
    isBlocking: true,
  },
  failed: {
    label: "Failed",
    icon: FileWarningIcon,
    severity: "high",
    isTerminal: true,
    isBlocking: true,
  },
};

const IP_REVIEW_META: Record<
  SourceIpReviewStatus,
  { label: string; severity: ProcessingSeverity }
> = {
  not_reviewed: { label: "IP not reviewed", severity: "medium" },
  cleared: { label: "IP cleared", severity: "low" },
  restricted: { label: "IP restricted", severity: "high" },
};

const SOURCE_TYPE_META: Record<SourceType, { label: string; icon: LucideIcon }> = {
  document: { label: "Document", icon: BookMarkedIcon },
  reference: { label: "Reference", icon: BookMarkedIcon },
  manual: { label: "Manual text", icon: PencilLineIcon },
};

export function formatSourceType(type: SourceType) {
  return SOURCE_TYPE_LABELS[type];
}

export function formatSourceFormat(format: SourceFormat | null | undefined) {
  if (!format) {
    return "—";
  }
  return SOURCE_FORMAT_LABELS[format] ?? format;
}

export function formatProcessingStatus(status: SourceProcessingStatus) {
  return PROCESSING_STATUS_LABELS[status];
}

export function formatIpReviewStatus(status: SourceIpReviewStatus) {
  return IP_REVIEW_LABELS[status];
}

export function getProcessingMeta(status: SourceProcessingStatus) {
  return PROCESSING_META[status];
}

export function getIpReviewMeta(status: SourceIpReviewStatus) {
  return IP_REVIEW_META[status];
}

export function getSourceTypeMeta(type: SourceType) {
  return SOURCE_TYPE_META[type];
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Permission derivation for the Source Vault. Uses shared role/permission
 * definitions from `@atlashq/types` (which already declares `sources:read`
 * and `sources:write` per module-02 §7).
 */
export type SourceViewerPermissions = {
  canRead: boolean;
  canWrite: boolean;
  canManageIpReview: boolean;
  canRetry: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canReplace: boolean;
  canEditMetadata: boolean;
  canRequestCapture: boolean;
};

export function readOnlyStateReason(permissions: SourceViewerPermissions): string | null {
  if (!permissions.canRead) {
    return "Your role does not have access to this project's source vault.";
  }
  if (!permissions.canWrite) {
    return "Read/download access only — Developer and QA roles cannot upload or replace evidence.";
  }
  return null;
}

/* -------------------- Capability gating -------------------- */

/**
 * Combine role-derived permissions with the server-authoritative capability
 * flags. The API is always the final gate, but hiding controls the server
 * cannot honor keeps the surface honest and avoids "click, get error" churn.
 *
 * Every write flag turns off when:
 *   - writes are disabled globally for the workspace, or
 *   - required storage is unavailable, or
 *   - the queue is unavailable (retries, on-demand capture, and version
 *     upload sessions all rely on queued jobs).
 *
 * Read/download flags are never touched — those are always allowed even when
 * writes are disabled.
 */
export function applyCapabilityGates(
  permissions: SourceViewerPermissions,
  capabilities: SourceVaultCapabilitiesResponse,
): SourceViewerPermissions {
  const writesUsable =
    capabilities.writesEnabled && capabilities.storageAvailable && capabilities.queueAvailable;
  if (writesUsable) {
    return permissions;
  }
  return {
    ...permissions,
    canWrite: false,
    canEditMetadata: false,
    canReplace: false,
    canArchive: false,
    canRestore: false,
    canRetry: false,
    canRequestCapture: false,
  };
}

/**
 * Human-readable explanation for a capability disablement. Returns `null`
 * when writes are usable, otherwise a short, non-alarming string aimed at
 * making the read-only state understandable without implying broken systems.
 */
export function capabilityDisabledReason(
  capabilities: SourceVaultCapabilitiesResponse,
): string | null {
  if (capabilities.writesEnabled && capabilities.storageAvailable && capabilities.queueAvailable) {
    return null;
  }
  const parts: string[] = [];
  if (!capabilities.writesEnabled) {
    parts.push("write operations are disabled for this workspace");
  }
  if (!capabilities.storageAvailable) {
    parts.push("source storage is unavailable");
  }
  if (!capabilities.queueAvailable) {
    parts.push("the processing queue is unavailable");
  }
  return `Source vault is read-only — ${parts.join(", ")}. Reads and downloads remain available.`;
}

export function ocrProcessingExplanation(
  capabilities: SourceVaultCapabilitiesResponse,
): string | null {
  if (capabilities.ocrProcessingEnabled) {
    return null;
  }
  return "OCR is not enabled for this workspace, so image sources record metadata only — the text of scanned pages will not be indexed.";
}

/* -------------------- Duplicate acknowledgement helpers -------------------- */

export function isCurrentVersion(
  source: Pick<SourceDetailResponse, "id" | "lineageId"> & {
    files?: unknown;
  },
) {
  return source;
}

/* -------------------- Search/filter route params -------------------- */

const PROCESSING_STATUS_VALUES: readonly SourceProcessingStatus[] = [
  "verification_pending",
  "scan_pending",
  "scanning",
  "extraction_pending",
  "extracting",
  "ready",
  "quarantined",
  "failed",
];

const SOURCE_TYPE_VALUES: readonly SourceType[] = ["document", "reference", "manual"];

const SOURCE_FORMAT_VALUES: readonly SourceFormat[] = [
  "pdf",
  "docx",
  "txt",
  "md",
  "xlsx",
  "csv",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "webp",
];

const IP_REVIEW_VALUES: readonly SourceIpReviewStatus[] = ["not_reviewed", "cleared", "restricted"];

export function parseSourceListSearch(search: Record<string, unknown>): SourceVaultSearch {
  const result: SourceVaultSearch = {};
  if (typeof search.q === "string" && search.q.length > 0) result.q = search.q;
  const type = matchOne(search.type, SOURCE_TYPE_VALUES);
  if (type) result.type = type;
  const format = matchOne(search.format, SOURCE_FORMAT_VALUES);
  if (format) result.format = format;
  const status = matchOne(search.status, PROCESSING_STATUS_VALUES);
  if (status) result.status = status;
  const ipReview = matchOne(search.ipReview, IP_REVIEW_VALUES);
  if (ipReview) result.ipReview = ipReview;
  if (search.includeArchived === true || search.includeArchived === "true") {
    result.includeArchived = true;
  }
  if (search.intake === "file" || search.intake === "manual" || search.intake === "reference") {
    result.intake = search.intake;
  }
  return result;
}

function matchOne<T extends string>(raw: unknown, values: readonly T[]): T | undefined {
  if (typeof raw === "string" && (values as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return undefined;
}

export type SourceVaultSearch = {
  q?: string | undefined;
  type?: SourceType | undefined;
  format?: SourceFormat | undefined;
  status?: SourceProcessingStatus | undefined;
  ipReview?: SourceIpReviewStatus | undefined;
  includeArchived?: boolean | undefined;
  intake?: "file" | "manual" | "reference" | undefined;
};

/* -------------------- Query filter derivation -------------------- */

export function buildSourcesListQuery(search: SourceVaultSearch) {
  const query: Record<string, string | boolean | number> = { limit: 25 };
  if (search.q) query.search = search.q;
  if (search.type) query.sourceType = search.type;
  if (search.format) query.documentFormat = search.format;
  if (search.status) query.processingStatus = search.status;
  if (search.ipReview) query.ipReviewStatus = search.ipReview;
  if (search.includeArchived) query.includeArchived = true;
  return query as unknown as import("./sources-api").SourceListQuery;
}

/* -------------------- Presentation of a list item -------------------- */

export function sourceHeadline(item: SourceListItem | SourceDetailResponse) {
  const parts: string[] = [formatSourceType(item.sourceType)];
  if (item.documentFormat) {
    parts.push(formatSourceFormat(item.documentFormat));
  }
  parts.push(`v${item.versionNumber}`);
  return parts.join(" · ");
}

export function isReadyForPreview(source: SourceDetailResponse) {
  return source.processingStatus === "ready" && !source.isArchived;
}

export function isRetryEligible(source: SourceDetailResponse) {
  return source.processingStatus === "failed" && !source.isArchived;
}

export function isReferenceCaptureFile(source: SourceDetailResponse): boolean {
  return (
    source.sourceType === "reference" &&
    source.reference?.captureMethod === "on_demand_single_page_capture"
  );
}
