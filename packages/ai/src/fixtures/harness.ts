import {
  coverageCategoryKeyValues,
  coverageStatusValues,
  requirementEpistemicStatusValues,
  requirementPriorityValues,
  requirementTypeValues,
} from "@atlashq/types";
import { z } from "zod";
import {
  type CitationVerificationStatus,
  citationVerificationStatusValues,
} from "../citation-verifier.js";
import { analysisStageKindValues } from "../pipeline.js";
import { promptAssetKindValues } from "../prompt-assets.js";
import { structuredEvidenceBlockSchema } from "../prompt-injection.js";
import adversarialFabricatedQuoteNegationFixture from "./adversarial/fabricated-quote-negation.fixture.json" with {
  type: "json",
};
import adversarialOversizedRepetitiveCostFixture from "./adversarial/oversized-repetitive-cost.fixture.json" with {
  type: "json",
};
import adversarialPromptInjectionDirectFixture from "./adversarial/prompt-injection-direct.fixture.json" with {
  type: "json",
};
import adversarialPromptInjectionIndirectFixture from "./adversarial/prompt-injection-indirect.fixture.json" with {
  type: "json",
};
import adversarialReferenceIpVerbatimCopyFixture from "./adversarial/reference-ip-verbatim-copy.fixture.json" with {
  type: "json",
};
import adversarialSchemaEscapeFixture from "./adversarial/schema-escape.fixture.json" with {
  type: "json",
};
import goldCleanWellSpecifiedFixture from "./gold/clean-well-specified.fixture.json" with {
  type: "json",
};
import goldMultiDocumentConflictsFixture from "./gold/multi-document-conflicts.fixture.json" with {
  type: "json",
};
import goldSecurityComplianceFixture from "./gold/security-compliance.fixture.json" with {
  type: "json",
};
import goldSparseUnknownHeavyFixture from "./gold/sparse-unknown-heavy.fixture.json" with {
  type: "json",
};
import goldSpreadsheetTabularFixture from "./gold/spreadsheet-tabular.fixture.json" with {
  type: "json",
};
import goldTranscriptAmbiguityFixture from "./gold/transcript-ambiguity.fixture.json" with {
  type: "json",
};

const requiredTextSchema = z.string().trim().min(1);

export const fixtureKindValues = ["gold", "adversarial"] as const;
export type FixtureKind = (typeof fixtureKindValues)[number];

const fixtureBudgetSchema = z
  .object({
    maxUsdPerRun: z.number().min(0),
    maxInputTokensPerRun: z.number().int().min(1),
    maxOutputTokensPerRun: z.number().int().min(1),
    maxWallClockMs: z.number().int().min(1),
  })
  .strict();

const fixtureContextSchema = z
  .object({
    organizationId: requiredTextSchema,
    projectId: requiredTextSchema,
    snapshotId: requiredTextSchema,
    referenceFeatureExtractionEnabled: z.boolean(),
  })
  .strict();

const fixtureCoverageSchema = z
  .object({
    categoryKey: z.enum(coverageCategoryKeyValues),
    status: z.enum(coverageStatusValues),
  })
  .strict();

export const fixtureRequirementSchema = z
  .object({
    key: requiredTextSchema,
    requirementType: z.enum(requirementTypeValues),
    priority: z.enum(requirementPriorityValues).nullable(),
    epistemicStatus: z.enum(requirementEpistemicStatusValues),
  })
  .strict();

export const fixtureCitationLabelSchema = z
  .object({
    requirementKey: requiredTextSchema,
    sourceChunkId: requiredTextSchema,
    quote: requiredTextSchema,
  })
  .strict();

const fixtureConflictSchema = z
  .object({
    leftRequirementKey: requiredTextSchema,
    rightRequirementKey: requiredTextSchema,
  })
  .strict();

const fixtureQuestionSchema = z
  .object({
    questionKey: requiredTextSchema,
    linkedRequirementKeys: z.array(requiredTextSchema),
    linkedCoverageCategoryKeys: z.array(z.enum(coverageCategoryKeyValues)),
  })
  .strict();

const fixtureHumanLabelSchema = z
  .object({
    title: requiredTextSchema,
    scenario: requiredTextSchema,
    notes: requiredTextSchema,
    ownedBy: requiredTextSchema,
  })
  .strict();

const fixtureRuntimeSchema = z
  .object({
    stageKind: z.enum(analysisStageKindValues),
    promptAssetKind: z.enum(promptAssetKindValues),
    expectedErrorCode: requiredTextSchema.nullable(),
  })
  .strict();

const fixturePredictedRequirementSchema = fixtureRequirementSchema
  .extend({
    organizationId: requiredTextSchema,
    projectId: requiredTextSchema,
    persisted: z.boolean(),
  })
  .strict();

export const fixturePredictedCitationSchema = z
  .object({
    requirementKey: requiredTextSchema,
    organizationId: requiredTextSchema,
    projectId: requiredTextSchema,
    snapshotId: requiredTextSchema,
    sourceDocumentId: requiredTextSchema,
    sourceChunkId: requiredTextSchema,
    quote: requiredTextSchema,
    verificationStatus: z.enum(citationVerificationStatusValues).optional(),
  })
  .strict();

export type FixturePredictedCitation = z.infer<typeof fixturePredictedCitationSchema> & {
  verificationStatus?: CitationVerificationStatus;
};

export const analysisFixtureModelOutputSchema = z
  .object({
    requirements: z.array(fixturePredictedRequirementSchema),
    citations: z.array(fixturePredictedCitationSchema),
    coverage: z.array(fixtureCoverageSchema),
    conflicts: z.array(fixtureConflictSchema),
    questions: z.array(fixtureQuestionSchema),
  })
  .strict();

const analysisFixtureSchemaCore = z
  .object({
    id: requiredTextSchema,
    kind: z.enum(fixtureKindValues),
    tags: z.array(requiredTextSchema).min(1),
    humanLabel: fixtureHumanLabelSchema,
    input: z
      .object({
        context: fixtureContextSchema,
        budget: fixtureBudgetSchema,
        evidenceBlocks: z.array(structuredEvidenceBlockSchema).min(1),
      })
      .strict(),
    labels: z
      .object({
        requirements: z.array(fixtureRequirementSchema),
        confirmedCitations: z.array(fixtureCitationLabelSchema),
        coverage: z.array(fixtureCoverageSchema),
        conflicts: z.array(fixtureConflictSchema),
        questions: z.array(fixtureQuestionSchema),
        unsupportedClaimKeys: z.array(requiredTextSchema),
      })
      .strict(),
    runtime: fixtureRuntimeSchema,
  })
  .strict();

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export const analysisFixtureSchema = analysisFixtureSchemaCore.superRefine((fixture, context) => {
  const labelRequirementKeys = fixture.labels.requirements.map((entry) => entry.key);
  if (hasDuplicates(labelRequirementKeys)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Label requirement keys must be unique per fixture.",
      path: ["labels", "requirements"],
    });
  }
});

export type AnalysisFixture = z.infer<typeof analysisFixtureSchema>;

const checkedInFixtures = [
  goldCleanWellSpecifiedFixture,
  goldSparseUnknownHeavyFixture,
  goldMultiDocumentConflictsFixture,
  goldSpreadsheetTabularFixture,
  goldTranscriptAmbiguityFixture,
  goldSecurityComplianceFixture,
  adversarialPromptInjectionDirectFixture,
  adversarialPromptInjectionIndirectFixture,
  adversarialSchemaEscapeFixture,
  adversarialFabricatedQuoteNegationFixture,
  adversarialReferenceIpVerbatimCopyFixture,
  adversarialOversizedRepetitiveCostFixture,
] as const satisfies readonly unknown[];

export function loadDefaultFixtureSet(): readonly AnalysisFixture[] {
  return checkedInFixtures.map((fixture) => analysisFixtureSchema.parse(fixture));
}

export function loadFixtureSetByKind(kind: FixtureKind): readonly AnalysisFixture[] {
  return loadDefaultFixtureSet().filter((fixture) => fixture.kind === kind);
}
