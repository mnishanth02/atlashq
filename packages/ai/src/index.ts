import type { ProjectId } from "@atlashq/types";
import { z } from "zod";

export const aiProviderValues = ["openai", "anthropic", "local-placeholder"] as const;
export type AiProvider = (typeof aiProviderValues)[number];

export const promptContractSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  purpose: z.enum(["requirements-analysis", "architecture-review", "citation-check"]),
  inputSchemaName: z.string().min(1),
  outputSchemaName: z.string().min(1),
});

export type PromptContract = z.infer<typeof promptContractSchema>;

export type AiRunPlaceholder = {
  projectId: ProjectId;
  provider: AiProvider;
  prompt: PromptContract;
  status: "planned";
};

export function createAiProviderRegistry(providers: readonly AiProvider[] = ["local-placeholder"]) {
  return {
    providers,
    defaultProvider: providers[0] ?? "local-placeholder",
    note: "Vercel AI SDK wiring is deferred until real AI workflows are implemented.",
  } as const;
}

export function planAiRun(input: AiRunPlaceholder): AiRunPlaceholder {
  return input;
}
