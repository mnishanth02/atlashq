import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { analysisStageKindValues } from "../pipeline.js";
import { promptAssetKindValues } from "../prompt-assets.js";

const requiredTextSchema = z.string().trim().min(1);

const replayRawResponseSchema = z
  .object({
    output: z.unknown(),
    usage: z
      .object({
        inputTokens: z.number().int().min(0),
        outputTokens: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export const replayRawFixtureSchema = z
  .object({
    fixtureId: requiredTextSchema,
    stageKind: z.enum(analysisStageKindValues),
    promptAssetKind: z.enum(promptAssetKindValues),
    schemaName: requiredTextSchema,
    schemaVersion: requiredTextSchema,
    responses: z.array(replayRawResponseSchema),
  })
  .strict();

export type ReplayRawFixture = z.infer<typeof replayRawFixtureSchema>;

const replayBoundUsageSchema = z
  .object({
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    totalTokens: z.number().int().min(0),
    costUsd: z.number().min(0).nullable(),
  })
  .strict();

export const replayBoundFixtureSchema = z
  .object({
    fixtureId: requiredTextSchema,
    stageKind: z.enum(analysisStageKindValues),
    promptAssetKind: z.enum(promptAssetKindValues),
    schemaName: requiredTextSchema,
    schemaVersion: requiredTextSchema,
    schemaHash: requiredTextSchema,
    pipelineHash: requiredTextSchema,
    promptBundleHash: requiredTextSchema,
    promptAssetHash: requiredTextSchema,
    inputHash: requiredTextSchema,
    rawResponsesHash: requiredTextSchema,
    attemptRequestHashes: z.array(requiredTextSchema),
    expectedErrorCode: requiredTextSchema.nullable(),
    expectedOutputHash: requiredTextSchema.nullable(),
    expectedShapeOnlyRepairUsed: z.boolean(),
    expectedUsage: replayBoundUsageSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expectedErrorCode) {
      if (value.expectedOutputHash !== null || value.expectedUsage !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Error-bound replay fixtures cannot define output hash or usage expectations.",
        });
      }
      return;
    }

    if (value.expectedOutputHash === null || value.expectedUsage === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Successful replay fixtures must define output hash and usage expectations.",
      });
    }
  });

export type ReplayBoundFixture = z.infer<typeof replayBoundFixtureSchema>;

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));

function loadJsonDirectory(directoryName: string): readonly unknown[] {
  const directoryPath = path.join(fixtureDirectory, directoryName);
  const files = readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return files.map((fileName) => {
    const filePath = path.join(directoryPath, fileName);
    const content = readFileSync(filePath, "utf8");
    return JSON.parse(content) as unknown;
  });
}

function ensureUniqueFixtureIds(fixtures: readonly { fixtureId: string }[]): void {
  const fixtureIds = new Set<string>();
  for (const fixture of fixtures) {
    if (fixtureIds.has(fixture.fixtureId)) {
      throw new TypeError(`Duplicate replay artifact fixtureId "${fixture.fixtureId}".`);
    }
    fixtureIds.add(fixture.fixtureId);
  }
}

export function loadReplayRawFixtures(): readonly ReplayRawFixture[] {
  const fixtures = loadJsonDirectory("replay-raw").map((entry) =>
    replayRawFixtureSchema.parse(entry),
  );
  ensureUniqueFixtureIds(fixtures);
  return fixtures;
}

export function loadReplayBoundFixtures(): readonly ReplayBoundFixture[] {
  const fixtures = loadJsonDirectory("replay-bound").map((entry) =>
    replayBoundFixtureSchema.parse(entry),
  );
  ensureUniqueFixtureIds(fixtures);
  return fixtures;
}
