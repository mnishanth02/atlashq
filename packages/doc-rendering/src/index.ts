import { z } from "zod";

export const exportFormatValues = ["markdown", "html", "pdf"] as const;
export type ExportFormat = (typeof exportFormatValues)[number];

export const renderRequestSchema = z.object({
  source: z.string().min(1),
  format: z.enum(exportFormatValues),
  projectId: z.string().min(1).optional(),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;

export type RenderPlan = {
  format: ExportFormat;
  status: "placeholder";
  requiresWorkerQueue: true;
};

export function createRenderPlan(request: RenderRequest): RenderPlan {
  const parsed = renderRequestSchema.parse(request);

  return {
    format: parsed.format,
    status: "placeholder",
    requiresWorkerQueue: true,
  };
}
