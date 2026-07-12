import {
  confidenceReasonCodeValues,
  coverageCategoryKeyValues,
  coverageEvidenceStateValues,
  coverageStatusValues,
  deliveryItemPriorityValues,
  deliveryItemSeverityValues,
  deliveryItemTypeValues,
  requirementEpistemicStatusValues,
  requirementPriorityValues,
  requirementTypeValues,
} from "@atlashq/types";
import { z } from "zod";

/**
 * Zod output-contract schemas for the seven Module 3 LLM stage kinds (module-03 §11.2). These live
 * in the worker (not `@atlashq/ai`, which only supplies the generic structured-generation wrapper
 * and prompt-asset metadata) because the exact candidate shapes are a worker-owned implementation
 * detail of how each stage turns evidence into DB rows. Every schema is intentionally narrow:
 * models may only ever propose a quote + a locating chunk id, never a citation id, offsets, or a
 * verification status -- those are always computed deterministically by the citation verifier.
 */

const requiredText = z.string().trim().min(1);
const stableKeySchema = z.string().trim().min(1).max(200);

export const quoteCandidateSchema = z
  .object({
    snapshotChunkId: requiredText,
    quote: z.string().min(1).max(2_000),
  })
  .strict();
export type QuoteCandidate = z.infer<typeof quoteCandidateSchema>;

export const requirementCandidateSchema = z
  .object({
    stableKey: stableKeySchema,
    title: requiredText.max(300),
    description: z.string().trim().max(4_000).nullable(),
    requirementType: z.enum(requirementTypeValues),
    priority: z.enum(requirementPriorityValues).nullable(),
    epistemicStatus: z.enum(requirementEpistemicStatusValues),
    inferenceBasis: z.string().trim().max(2_000).nullable(),
    citations: z.array(quoteCandidateSchema).min(1).max(6),
  })
  .strict()
  .superRefine((candidate, context) => {
    if (candidate.epistemicStatus === "assumed" && !candidate.inferenceBasis) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Assumed requirement candidates must carry an inference basis.",
        path: ["inferenceBasis"],
      });
    }
  });
export type RequirementCandidate = z.infer<typeof requirementCandidateSchema>;

export const confirmedExtractionOutputSchema = z
  .object({
    requirements: z.array(requirementCandidateSchema).max(40),
  })
  .strict();
export type ConfirmedExtractionOutput = z.infer<typeof confirmedExtractionOutputSchema>;

/** Reference-origin candidates are identical in shape but always originate from isolated batches. */
export const referenceFeatureExtractionOutputSchema = confirmedExtractionOutputSchema;
export type ReferenceFeatureExtractionOutput = z.infer<
  typeof referenceFeatureExtractionOutputSchema
>;

export const conflictCandidateSchema = z
  .object({
    requirementIds: z.array(requiredText).min(2).max(8),
    rationale: requiredText.max(2_000),
  })
  .strict();
export type ConflictCandidate = z.infer<typeof conflictCandidateSchema>;

export const conflictDetectionOutputSchema = z
  .object({
    conflicts: z.array(conflictCandidateSchema).max(50),
  })
  .strict();
export type ConflictDetectionOutput = z.infer<typeof conflictDetectionOutputSchema>;

export const coverageCategoryAssessmentSchema = z
  .object({
    categoryKey: z.enum(coverageCategoryKeyValues),
    status: z.enum(coverageStatusValues),
    rationale: z.string().trim().max(1_000).nullable(),
    evidenceState: z.enum(coverageEvidenceStateValues),
    requirementIds: z.array(requiredText).max(20),
  })
  .strict();
export type CoverageCategoryAssessment = z.infer<typeof coverageCategoryAssessmentSchema>;

export const coverageAnalysisOutputSchema = z
  .object({
    categories: z.array(coverageCategoryAssessmentSchema).length(coverageCategoryKeyValues.length),
  })
  .strict()
  .superRefine((output, context) => {
    const seen = new Set<string>();
    for (const [index, category] of output.categories.entries()) {
      if (seen.has(category.categoryKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate coverage category "${category.categoryKey}".`,
          path: ["categories", index, "categoryKey"],
        });
      }
      seen.add(category.categoryKey);
    }
  });
export type CoverageAnalysisOutput = z.infer<typeof coverageAnalysisOutputSchema>;

const deliveryItemAttributesSchema = z.record(z.string(), z.unknown()).default({});

export const deliveryItemCandidateSchema = z
  .object({
    itemType: z.enum(deliveryItemTypeValues.filter((value) => value !== "question")),
    title: requiredText.max(300),
    description: z.string().trim().max(2_000).nullable(),
    severity: z.enum(deliveryItemSeverityValues).nullable(),
    priority: z.enum(deliveryItemPriorityValues).nullable(),
    attributes: deliveryItemAttributesSchema,
    sourceRequirementId: z.string().trim().min(1).nullable(),
    citations: z.array(quoteCandidateSchema).max(6),
  })
  .strict();
export type DeliveryItemCandidate = z.infer<typeof deliveryItemCandidateSchema>;

export const deliveryItemExtractionOutputSchema = z
  .object({
    items: z.array(deliveryItemCandidateSchema).max(60),
  })
  .strict();
export type DeliveryItemExtractionOutput = z.infer<typeof deliveryItemExtractionOutputSchema>;

export const questionCandidateSchema = z
  .object({
    title: requiredText.max(300),
    description: z.string().trim().max(2_000).nullable(),
    priority: z.enum(deliveryItemPriorityValues).nullable(),
    coverageCategoryKey: z.enum(coverageCategoryKeyValues).nullable(),
    relatedRequirementIds: z.array(requiredText).max(10),
    citations: z.array(quoteCandidateSchema).max(6),
  })
  .strict();
export type QuestionCandidate = z.infer<typeof questionCandidateSchema>;

export const questionGenerationOutputSchema = z
  .object({
    questions: z.array(questionCandidateSchema).max(40),
  })
  .strict();
export type QuestionGenerationOutput = z.infer<typeof questionGenerationOutputSchema>;

/** Confidence reason codes are always computed deterministically; this re-export documents that
 * model output never carries them directly (kept here purely so stage handlers can import both
 * the schema module and the shared reason-code vocabulary from a single place). */
export { confidenceReasonCodeValues };
