import { z } from "zod";

/**
 * Search shape for the requirement-analysis list route. `runId` isn't part of
 * this schema — the run detail route carries `runId` as a path param instead
 * (`/projects/$projectId/requirement-analysis/$runId`), matching how the
 * Source Document Vault splits list vs. detail routes.
 */
export const requirementAnalysisSearchSchema = z.object({
  status: z
    .enum([
      "requested",
      "snapshotting",
      "queued",
      "running",
      "waiting_retry",
      "completed",
      "completed_with_warnings",
      "failed",
      "canceled",
    ])
    .optional(),
  mode: z.enum(["fresh", "replay", "reprocess", "retry"]).optional(),
  launch: z.boolean().optional(),
});

export type RequirementAnalysisSearch = z.infer<typeof requirementAnalysisSearchSchema>;

/**
 * Search shape for the run detail route. `tab` selects which panel is active
 * (stages/requirements/delivery items/coverage/citations/traceability);
 * `requirementId`/`deliveryItemId`/`citationId` deep-link to a specific
 * record's evidence within the active panel.
 */
export const requirementAnalysisDetailSearchSchema = z.object({
  tab: z
    .enum(["stages", "requirements", "delivery-items", "coverage", "citations", "traceability"])
    .optional(),
  requirementId: z.string().optional(),
  deliveryItemId: z.string().optional(),
  citationId: z.string().optional(),
  requirementType: z
    .enum([
      "functional",
      "non_functional",
      "business_rule",
      "data",
      "integration",
      "security",
      "compliance",
      "operational",
    ])
    .optional(),
  epistemicStatus: z.enum(["confirmed", "assumed", "unknown", "conflicting"]).optional(),
  deliveryItemType: z
    .enum(["question", "risk", "assumption", "dependency", "blocker", "scope_change_candidate"])
    .optional(),
});

export type RequirementAnalysisDetailSearch = z.infer<typeof requirementAnalysisDetailSearchSchema>;
