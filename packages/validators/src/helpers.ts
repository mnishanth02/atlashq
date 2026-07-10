import { z } from "zod";

export const optimisticVersionSchema = z.number().int().positive();

export const booleanQuerySchema = z
  .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
  .transform((value) => value === true || value === "true" || value === "1");

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
