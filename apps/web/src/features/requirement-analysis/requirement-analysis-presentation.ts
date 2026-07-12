import { coverageCategoryDescriptors } from "@atlashq/types";
import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  CircleCheckIcon,
  ClockIcon,
  FileWarningIcon,
  Loader2Icon,
  OctagonXIcon,
  PlayIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { Evidence, ProvenanceKind } from "@/components/atlas";
import type {
  AnalysisEligibleSourceExclusionReason,
  AnalysisRunMode,
  AnalysisRunStatus,
  AnalysisStageKind,
  AnalysisStageStatus,
  CitationEvidenceResponse,
  CitationListItem,
  CoverageEntry,
  EligibleSourcePreviewItem,
  ProviderPolicySummary,
  RequirementAnalysisCapabilitiesResponse,
} from "./requirement-analysis-api";
import { isTerminalRunStatus } from "./requirement-analysis-api";

/* -------------------- Run status / mode -------------------- */

export type AnalysisRunSeverity = "critical" | "high" | "medium" | "low" | "info";

type RunStatusMeta = {
  label: string;
  icon: LucideIcon;
  severity: AnalysisRunSeverity;
  isTerminal: boolean;
};

const RUN_STATUS_META: Record<AnalysisRunStatus, RunStatusMeta> = {
  requested: { label: "Requested", icon: ClockIcon, severity: "info", isTerminal: false },
  snapshotting: { label: "Snapshotting", icon: Loader2Icon, severity: "info", isTerminal: false },
  queued: { label: "Queued", icon: ClockIcon, severity: "info", isTerminal: false },
  running: { label: "Running", icon: Loader2Icon, severity: "info", isTerminal: false },
  waiting_retry: {
    label: "Waiting to retry",
    icon: ClockIcon,
    severity: "medium",
    isTerminal: false,
  },
  completed: { label: "Completed", icon: CircleCheckIcon, severity: "low", isTerminal: true },
  completed_with_warnings: {
    label: "Completed with warnings",
    icon: FileWarningIcon,
    severity: "medium",
    isTerminal: true,
  },
  failed: { label: "Failed", icon: OctagonXIcon, severity: "critical", isTerminal: true },
  canceled: { label: "Canceled", icon: BanIcon, severity: "info", isTerminal: true },
};

export function getRunStatusMeta(status: AnalysisRunStatus) {
  return RUN_STATUS_META[status];
}

export function formatRunStatus(status: AnalysisRunStatus) {
  return RUN_STATUS_META[status].label;
}

const RUN_MODE_LABELS: Record<AnalysisRunMode, string> = {
  fresh: "Fresh run",
  replay: "Replay",
  reprocess: "Reprocess",
  retry: "Retry",
};

const RUN_MODE_ICONS: Record<AnalysisRunMode, LucideIcon> = {
  fresh: PlayIcon,
  replay: RefreshCwIcon,
  reprocess: RefreshCwIcon,
  retry: RefreshCwIcon,
};

export function formatRunMode(mode: AnalysisRunMode) {
  return RUN_MODE_LABELS[mode];
}

export function getRunModeIcon(mode: AnalysisRunMode) {
  return RUN_MODE_ICONS[mode];
}

/* -------------------- Stage status / kind -------------------- */

const STAGE_KIND_LABELS: Record<AnalysisStageKind, string> = {
  freeze_snapshot: "Freeze snapshot",
  batch_planning: "Batch planning",
  confirmed_extraction: "Confirmed extraction",
  citation_verification: "Citation verification",
  reference_feature_extraction: "Reference feature extraction",
  normalization_deduplication: "Normalization & deduplication",
  conflict_detection: "Conflict detection",
  coverage_analysis: "Coverage analysis",
  delivery_item_extraction: "Delivery item extraction",
  question_generation: "Question generation",
  finalize_review_package: "Finalize review package",
};

export function formatStageKind(kind: AnalysisStageKind) {
  return STAGE_KIND_LABELS[kind];
}

type StageStatusMeta = {
  label: string;
  severity: AnalysisRunSeverity;
};

const STAGE_STATUS_META: Record<AnalysisStageStatus, StageStatusMeta> = {
  pending: { label: "Pending", severity: "info" },
  running: { label: "Running", severity: "info" },
  waiting_retry: { label: "Waiting to retry", severity: "medium" },
  completed: { label: "Completed", severity: "low" },
  completed_with_warnings: { label: "Completed with warnings", severity: "medium" },
  failed: { label: "Failed", severity: "critical" },
  canceled: { label: "Canceled", severity: "info" },
  skipped: { label: "Skipped", severity: "info" },
};

export function getStageStatusMeta(status: AnalysisStageStatus) {
  return STAGE_STATUS_META[status];
}

export function formatStageStatus(status: AnalysisStageStatus) {
  return STAGE_STATUS_META[status].label;
}

/* -------------------- Eligible source exclusion reasons -------------------- */

const EXCLUSION_REASON_LABELS: Record<AnalysisEligibleSourceExclusionReason, string> = {
  not_ready: "Source is not ready — processing hasn't completed.",
  archived: "Source is archived and excluded from analysis.",
  non_head_version: "A newer version of this source exists; only the head version is eligible.",
  missing_successful_extraction: "No successful extraction is available for this source.",
  reference_not_cleared: "Reference material has not cleared IP review.",
  reference_feature_extraction_disabled:
    "Reference feature extraction is disabled for this workspace.",
};

export function formatExclusionReason(
  reason: AnalysisEligibleSourceExclusionReason | null,
): string | null {
  if (!reason) {
    return null;
  }
  return EXCLUSION_REASON_LABELS[reason];
}

export function countIncludedSources(items: readonly EligibleSourcePreviewItem[]): number {
  return items.filter((item) => item.included).length;
}

/* -------------------- Coverage categories -------------------- */

export const COVERAGE_CATEGORY_ORDER = coverageCategoryDescriptors;

export type CoverageMatrixRow = {
  key: (typeof coverageCategoryDescriptors)[number]["key"];
  label: string;
  order: number;
  entry: CoverageEntry | null;
};

/**
 * Always renders exactly the 18 fixed rubric categories (module-03 §8.5),
 * regardless of how many coverage entries the API returned — a run that
 * hasn't reached the coverage-analysis stage yet still shows every row with
 * `entry: null` so the matrix never silently omits a category.
 */
export function buildCoverageMatrix(entries: readonly CoverageEntry[]): CoverageMatrixRow[] {
  const byKey = new Map(entries.map((entry) => [entry.categoryKey, entry]));
  return coverageCategoryDescriptors.map((descriptor) => ({
    key: descriptor.key,
    label: descriptor.label,
    order: descriptor.order,
    entry: byKey.get(descriptor.key) ?? null,
  }));
}

const COVERAGE_STATUS_META: Record<
  CoverageEntry["status"],
  { label: string; severity: AnalysisRunSeverity }
> = {
  addressed: { label: "Addressed", severity: "low" },
  partial: { label: "Partial", severity: "medium" },
  absent: { label: "Absent", severity: "high" },
};

export function getCoverageStatusMeta(status: CoverageEntry["status"]) {
  return COVERAGE_STATUS_META[status];
}

const COVERAGE_EVIDENCE_STATE_LABELS: Record<CoverageEntry["evidenceState"], string> = {
  verified_citation: "Verified citation",
  none_found: "No evidence found",
  downgraded: "Downgraded evidence",
};

export function formatCoverageEvidenceState(state: CoverageEntry["evidenceState"]) {
  return COVERAGE_EVIDENCE_STATE_LABELS[state];
}

/* -------------------- Citation verification -------------------- */

const CITATION_VERIFICATION_LABELS: Record<CitationListItem["verificationStatus"], string> = {
  verified_exact: "Verified exact match",
  downgraded_fuzzy: "Downgraded (fuzzy match)",
  failed: "Verification failed",
};

export function formatCitationVerificationStatus(status: CitationListItem["verificationStatus"]) {
  return CITATION_VERIFICATION_LABELS[status];
}

/* -------------------- Epistemic / confidence gating -------------------- */

/**
 * `unknown` and `conflicting` epistemic statuses never carry a confidence
 * band (the DTO enforces `confidenceBand: null` for both), so `ConfidenceMeter`
 * must never render for them — showing a meter would imply a confidence
 * reading that was never computed.
 */
export function shouldShowConfidenceMeter(confidenceBand: "low" | "medium" | "high" | null) {
  return confidenceBand !== null;
}

/* -------------------- Provider policy -------------------- */

export function formatProviderPolicySummary(policy: ProviderPolicySummary["provider"]) {
  const labels: Record<ProviderPolicySummary["provider"], string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    "openai-compatible": "OpenAI-compatible",
    local: "Local",
  };
  return labels[policy];
}

/* -------------------- Capability gating -------------------- */

export function capabilityDisabledReason(
  capabilities: RequirementAnalysisCapabilitiesResponse,
): string | null {
  if (!capabilities.safeDisabled) {
    return null;
  }
  switch (capabilities.safeDisabledReason) {
    case "analysis_feature_disabled":
      return "AI requirement analysis is disabled for this workspace. Existing runs remain visible if reads are enabled.";
    case "provider_not_approved":
      return "No approved AI provider policy is configured for this project yet. An organization admin must approve a provider before a run can start.";
    case "queue_unavailable":
      return "The analysis processing queue is unavailable right now. Existing runs remain visible; new runs can't start until the queue recovers.";
    case "reads_disabled":
      return "Requirement analysis reads are disabled for this workspace.";
    default:
      return "Requirement analysis is currently unavailable.";
  }
}

export function readsDisabledReason(
  capabilities: RequirementAnalysisCapabilitiesResponse,
): string | null {
  if (capabilities.readsEnabled) {
    return null;
  }
  return "Requirement analysis reads are disabled for this workspace.";
}

export function canLaunchRun(
  capabilities: RequirementAnalysisCapabilitiesResponse,
  canAnalyze: boolean,
): boolean {
  return (
    canAnalyze &&
    capabilities.analysisEnabled &&
    capabilities.queueAvailable &&
    capabilities.approvedProviderPolicyAvailable &&
    !capabilities.safeDisabled
  );
}

/* -------------------- Run action affordance rules (module-03 §8.2-8.3) -------------------- */

export function canCancelRun(status: AnalysisRunStatus, canAnalyze: boolean): boolean {
  if (!canAnalyze) return false;
  return (
    status === "requested" ||
    status === "snapshotting" ||
    status === "queued" ||
    status === "running" ||
    status === "waiting_retry"
  );
}

export function canRetryRun(
  status: AnalysisRunStatus,
  failureRetryable: boolean,
  canAnalyze: boolean,
): boolean {
  return canAnalyze && status === "failed" && failureRetryable;
}

export function canReplayRun(status: AnalysisRunStatus, canAnalyze: boolean): boolean {
  return canAnalyze && isTerminalRunStatus(status);
}

export function canReprocessRun(status: AnalysisRunStatus, canAnalyze: boolean): boolean {
  return canAnalyze && isTerminalRunStatus(status);
}

/* -------------------- Formatting helpers -------------------- */

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatTokenCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatBudgetUsagePercent(used: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((used / max) * 100));
}

/* -------------------- Requirement / delivery item labels -------------------- */

const REQUIREMENT_TYPE_LABELS: Record<
  | "functional"
  | "non_functional"
  | "business_rule"
  | "data"
  | "integration"
  | "security"
  | "compliance"
  | "operational",
  string
> = {
  functional: "Functional",
  non_functional: "Non-functional",
  business_rule: "Business rule",
  data: "Data",
  integration: "Integration",
  security: "Security",
  compliance: "Compliance",
  operational: "Operational",
};

export function formatRequirementType(type: keyof typeof REQUIREMENT_TYPE_LABELS): string {
  return REQUIREMENT_TYPE_LABELS[type];
}

const REQUIREMENT_PRIORITY_LABELS: Record<
  "must_have" | "should_have" | "could_have" | "later",
  string
> = {
  must_have: "Must have",
  should_have: "Should have",
  could_have: "Could have",
  later: "Later",
};

export function formatRequirementPriority(
  priority: keyof typeof REQUIREMENT_PRIORITY_LABELS | null,
): string {
  return priority ? REQUIREMENT_PRIORITY_LABELS[priority] : "Unset";
}

const LIFECYCLE_STATE_TO_PILL: Record<
  | "ai_suggested"
  | "under_review"
  | "accepted"
  | "needs_clarification"
  | "rejected"
  | "approved"
  | "changed"
  | "deprecated",
  | "ai-suggested"
  | "under-review"
  | "accepted"
  | "needs-clarification"
  | "rejected"
  | "approved"
  | "changed"
  | "deprecated"
> = {
  ai_suggested: "ai-suggested",
  under_review: "under-review",
  accepted: "accepted",
  needs_clarification: "needs-clarification",
  rejected: "rejected",
  approved: "approved",
  changed: "changed",
  deprecated: "deprecated",
};

export function toLifecycleStatusPill(lifecycleState: keyof typeof LIFECYCLE_STATE_TO_PILL) {
  return LIFECYCLE_STATE_TO_PILL[lifecycleState];
}

const DELIVERY_ITEM_TYPE_LABELS: Record<
  "question" | "risk" | "assumption" | "dependency" | "blocker" | "scope_change_candidate",
  string
> = {
  question: "Question",
  risk: "Risk",
  assumption: "Assumption",
  dependency: "Dependency",
  blocker: "Blocker",
  scope_change_candidate: "Scope change candidate",
};

export function formatDeliveryItemType(itemType: keyof typeof DELIVERY_ITEM_TYPE_LABELS): string {
  return DELIVERY_ITEM_TYPE_LABELS[itemType];
}

export function toSeverityOrInfo(value: "low" | "medium" | "high" | null): AnalysisRunSeverity {
  return value ?? "info";
}

/* -------------------- Evidence adapter -------------------- */

/**
 * Maps a citation-evidence DTO (rich provenance: content hashes, extraction
 * and chunk identifiers, offsets, verification status) into the simplified
 * `Evidence` shape the shared `CitationChip`/`EvidencePopover` components
 * expect. The popover intentionally shows only a preview; the full metadata
 * set is rendered by the evidence drawer instead of being force-fit into the
 * shared component.
 */
export function toEvidence(
  citation: Pick<
    CitationEvidenceResponse,
    "id" | "sourceTitle" | "quoteTextOriginal" | "locator" | "verificationStatus"
  >,
): Evidence {
  const provenance: ProvenanceKind = "source";
  const locatorEntries = Object.entries(citation.locator ?? {});
  const locator =
    locatorEntries.length > 0
      ? locatorEntries.map(([key, value]) => `${key}: ${value}`).join(" · ")
      : undefined;

  return {
    id: citation.id,
    source: citation.sourceTitle,
    excerpt: citation.quoteTextOriginal,
    ...(locator !== undefined ? { locator } : {}),
    provenance,
  };
}
