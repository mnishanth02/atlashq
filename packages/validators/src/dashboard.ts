import { z } from "zod";

/**
 * Dashboard sections must show zeros/"not started"/setup prompts until later modules populate
 * real counts (module-01 §5.4) — they must not imply real analysis has run. `ready` is used by
 * later modules (module-02: source vault) to indicate a live counter with real data.
 */
export const dashboardCounterStateValues = [
  "zero",
  "not_started",
  "setup_required",
  "ready",
] as const;
export const dashboardCounterStateSchema = z.enum(dashboardCounterStateValues);

export const dashboardSummarySectionSchema = z
  .object({
    state: dashboardCounterStateSchema,
    count: z.number().int().min(0).default(0),
    label: z.string().trim().min(1),
  })
  .strict();

export type DashboardSummarySection = z.infer<typeof dashboardSummarySectionSchema>;

export const dashboardZeroStateSchema = z
  .object({
    requirements: dashboardSummarySectionSchema,
    openQuestions: dashboardSummarySectionSchema,
    risksAndDeliveryItems: dashboardSummarySectionSchema,
    architectureReview: dashboardSummarySectionSchema,
    nextActions: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export type DashboardZeroState = z.infer<typeof dashboardZeroStateSchema>;

function notStartedSection(label: string): DashboardSummarySection {
  return { state: "not_started", count: 0, label };
}

/** Builds the Module 1 zero-state dashboard payload before later modules populate real data. */
export function createDashboardZeroState(): DashboardZeroState {
  return {
    requirements: notStartedSection("Requirements"),
    openQuestions: notStartedSection("Open questions"),
    risksAndDeliveryItems: notStartedSection("Risks & delivery items"),
    architectureReview: notStartedSection("Architecture review"),
    nextActions: ["Prepare for source document intake."],
  };
}
