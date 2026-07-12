import { z } from "zod";
import { hashCanonicalJson } from "./json.js";

export const analysisStageKindValues = [
  "freeze_snapshot",
  "batch_planning",
  "confirmed_extraction",
  "citation_verification",
  "reference_feature_extraction",
  "normalization_deduplication",
  "conflict_detection",
  "coverage_analysis",
  "delivery_item_extraction",
  "question_generation",
  "finalize_review_package",
] as const;

export type AnalysisStageKind = (typeof analysisStageKindValues)[number];

export type PipelineStageDescriptor = {
  kind: AnalysisStageKind;
  version: string;
  dependsOn: readonly AnalysisStageKind[];
  usesModel: boolean;
};

export type PipelineDescriptor = {
  version: string;
  stages: readonly PipelineStageDescriptor[];
  hash: string;
};

const module03Stages: readonly PipelineStageDescriptor[] = [
  {
    kind: "freeze_snapshot",
    version: "1.0.0",
    dependsOn: [],
    usesModel: false,
  },
  {
    kind: "batch_planning",
    version: "1.0.0",
    dependsOn: ["freeze_snapshot"],
    usesModel: false,
  },
  {
    kind: "confirmed_extraction",
    version: "1.0.0",
    dependsOn: ["batch_planning"],
    usesModel: true,
  },
  {
    kind: "reference_feature_extraction",
    version: "1.0.0",
    dependsOn: ["batch_planning"],
    usesModel: true,
  },
  {
    kind: "citation_verification",
    version: "1.0.0",
    dependsOn: ["confirmed_extraction", "reference_feature_extraction"],
    usesModel: false,
  },
  {
    kind: "normalization_deduplication",
    version: "1.0.0",
    dependsOn: ["citation_verification"],
    usesModel: false,
  },
  {
    kind: "conflict_detection",
    version: "1.0.0",
    dependsOn: ["normalization_deduplication"],
    usesModel: true,
  },
  {
    kind: "coverage_analysis",
    version: "1.0.0",
    dependsOn: ["normalization_deduplication"],
    usesModel: true,
  },
  {
    kind: "delivery_item_extraction",
    version: "1.0.0",
    dependsOn: ["normalization_deduplication"],
    usesModel: true,
  },
  {
    kind: "question_generation",
    version: "1.0.0",
    dependsOn: [
      "normalization_deduplication",
      "conflict_detection",
      "coverage_analysis",
      "delivery_item_extraction",
    ],
    usesModel: true,
  },
  {
    kind: "finalize_review_package",
    version: "1.0.0",
    dependsOn: [
      "citation_verification",
      "normalization_deduplication",
      "conflict_detection",
      "coverage_analysis",
      "delivery_item_extraction",
      "question_generation",
    ],
    usesModel: false,
  },
];

export const module03PipelineVersion = "module-03-requirement-analyzer-v1";

export const module03PipelineDescriptor: PipelineDescriptor = {
  version: module03PipelineVersion,
  stages: module03Stages,
  hash: hashCanonicalJson({
    version: module03PipelineVersion,
    stages: module03Stages,
  }),
};

const seededStageSet = new Set<AnalysisStageKind>([
  "confirmed_extraction",
  "reference_feature_extraction",
  "conflict_detection",
  "coverage_analysis",
  "delivery_item_extraction",
  "question_generation",
]);

export const stageSamplingProfileSchema = z
  .object({
    stageKind: z.enum(analysisStageKindValues),
    temperature: z.literal(0),
    seed: z.number().int().min(0).optional(),
    seedApplied: z.boolean(),
    seedUnsupportedWarning: z.string().trim().min(1).nullable(),
  })
  .strict();

export type StageSamplingProfile = z.infer<typeof stageSamplingProfileSchema>;

export function createDeterministicSamplingProfile(stageKind: AnalysisStageKind, seed?: number) {
  if (seed === undefined) {
    return stageSamplingProfileSchema.parse({
      stageKind,
      temperature: 0,
      seedApplied: false,
      seedUnsupportedWarning: null,
    });
  }

  if (seededStageSet.has(stageKind)) {
    return stageSamplingProfileSchema.parse({
      stageKind,
      temperature: 0,
      seed,
      seedApplied: true,
      seedUnsupportedWarning: null,
    });
  }

  return stageSamplingProfileSchema.parse({
    stageKind,
    temperature: 0,
    seedApplied: false,
    seedUnsupportedWarning: `Seed ignored for deterministic non-LLM stage "${stageKind}".`,
  });
}
