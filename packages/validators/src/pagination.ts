import { z } from "zod";

export const paginationQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z
  .object({
    limit: z.number().int().min(1).max(100),
    nextCursor: z.string().trim().min(1).nullable(),
    hasMore: z.boolean(),
    total: z.number().int().min(0).optional(),
  })
  .strict();

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Builds a `{ items, pageInfo }` list-response schema for a given item schema. */
export function createPaginatedResponseSchema<ItemSchema extends z.ZodType>(
  itemSchema: ItemSchema,
) {
  return z
    .object({
      items: z.array(itemSchema),
      pageInfo: paginationMetaSchema,
    })
    .strict();
}
