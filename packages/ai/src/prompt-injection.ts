import { z } from "zod";

const requiredTextSchema = z.string().trim().min(1);

export const evidenceOriginValues = ["source", "reference"] as const;
export type EvidenceOrigin = (typeof evidenceOriginValues)[number];

export const structuredEvidenceBlockSchema = z
  .object({
    blockId: requiredTextSchema,
    organizationId: requiredTextSchema,
    projectId: requiredTextSchema,
    snapshotId: requiredTextSchema,
    sourceDocumentId: requiredTextSchema,
    sourceChunkId: requiredTextSchema,
    chunkContentHash: requiredTextSchema,
    origin: z.enum(evidenceOriginValues),
    text: z.string(),
    locator: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type StructuredEvidenceBlock = z.infer<typeof structuredEvidenceBlockSchema>;

export const promptInjectionFindingCodeValues = [
  "cross_tenant_metadata_mismatch",
  "cross_snapshot_mismatch",
  "forbidden_xml_role_tag",
  "forbidden_evidence_delimiter",
  "direct_prompt_override_phrase",
] as const;

export type PromptInjectionFindingCode = (typeof promptInjectionFindingCodeValues)[number];

export type PromptInjectionFinding = {
  code: PromptInjectionFindingCode;
  severity: "error" | "warning";
  blockId: string;
  message: string;
};

export type PromptInjectionCheckResult = {
  safe: boolean;
  findings: readonly PromptInjectionFinding[];
};

const forbiddenXmlRolePattern = /<\/?(system|assistant|developer|tool|function|instruction)\b/iu;
const forbiddenEvidenceDelimiterPattern = /<\/?evidence-block\b/iu;
const directPromptOverridePattern =
  /\b(ignore (all|any|the) previous instructions|system prompt|follow these instructions instead)\b/iu;

export const promptInjectionCheckInputSchema = z
  .object({
    expectedOrganizationId: requiredTextSchema,
    expectedProjectId: requiredTextSchema,
    expectedSnapshotId: requiredTextSchema,
    blocks: z.array(structuredEvidenceBlockSchema),
  })
  .strict();

export type PromptInjectionCheckInput = z.infer<typeof promptInjectionCheckInputSchema>;

export function runPromptInjectionStructuralChecks(
  input: PromptInjectionCheckInput,
): PromptInjectionCheckResult {
  const parsed = promptInjectionCheckInputSchema.parse(input);
  const findings: PromptInjectionFinding[] = [];

  for (const block of parsed.blocks) {
    if (
      block.organizationId !== parsed.expectedOrganizationId ||
      block.projectId !== parsed.expectedProjectId
    ) {
      findings.push({
        code: "cross_tenant_metadata_mismatch",
        severity: "error",
        blockId: block.blockId,
        message: "Evidence block organization/project metadata does not match the run context.",
      });
    }

    if (block.snapshotId !== parsed.expectedSnapshotId) {
      findings.push({
        code: "cross_snapshot_mismatch",
        severity: "error",
        blockId: block.blockId,
        message: "Evidence block snapshot metadata does not match the frozen snapshot.",
      });
    }

    if (forbiddenXmlRolePattern.test(block.text)) {
      findings.push({
        code: "forbidden_xml_role_tag",
        severity: "error",
        blockId: block.blockId,
        message: "Evidence contains forbidden role-like XML tags.",
      });
    }

    if (forbiddenEvidenceDelimiterPattern.test(block.text)) {
      findings.push({
        code: "forbidden_evidence_delimiter",
        severity: "error",
        blockId: block.blockId,
        message: "Evidence contains structural delimiter tokens reserved for prompt wrapping.",
      });
    }

    if (directPromptOverridePattern.test(block.text)) {
      findings.push({
        code: "direct_prompt_override_phrase",
        severity: "warning",
        blockId: block.blockId,
        message: "Evidence contains common prompt-injection override language.",
      });
    }
  }

  return {
    safe: findings.every((finding) => finding.severity !== "error"),
    findings,
  };
}
