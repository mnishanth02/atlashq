import { z } from "zod";

export const createProjectPlaceholderDto = z.object({
  name: z.string().trim().min(1).max(120),
});

export type CreateProjectPlaceholderDto = z.infer<typeof createProjectPlaceholderDto>;
