import { projectRoleValues } from "@atlashq/types";
import { z } from "zod";

export const entityIdSchema = z.string().trim().min(1);
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const correlationIdSchema = z.string().trim().min(1);
export const projectRoleSchema = z.enum(projectRoleValues);

export const paginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function parseDto<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  return schema.parse(input);
}

export function safeParseDto<Schema extends z.ZodType>(schema: Schema, input: unknown) {
  return schema.safeParse(input);
}

export function createDtoSchema<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object(shape).strict();
}
