import { z } from "zod";

export const sourceDocumentsSearchSchema = z.object({
  q: z.string().min(1).optional(),
  type: z.enum(["document", "reference", "manual"]).optional(),
  format: z
    .enum(["pdf", "docx", "txt", "md", "xlsx", "csv", "pptx", "png", "jpg", "jpeg", "webp"])
    .optional(),
  status: z
    .enum([
      "verification_pending",
      "scan_pending",
      "scanning",
      "extraction_pending",
      "extracting",
      "ready",
      "quarantined",
      "failed",
    ])
    .optional(),
  ipReview: z.enum(["not_reviewed", "cleared", "restricted"]).optional(),
  includeArchived: z.boolean().optional(),
  intake: z.enum(["file", "manual", "reference"]).optional(),
  sort: z.enum(["created_desc", "created_asc", "title_asc"]).optional(),
});

export type SourceDocumentsSearch = z.infer<typeof sourceDocumentsSearchSchema>;
