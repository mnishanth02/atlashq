import { z } from "zod";
import { optimisticVersionSchema } from "./helpers.js";
import { paginationQuerySchema } from "./pagination.js";

export const clientNameSchema = z.string().trim().min(1).max(200);
export const clientContactPersonSchema = z.string().trim().min(1).max(200);
export const clientEmailSchema = z.email().max(320);
export const clientNotesSchema = z.string().trim().min(1).max(4000);

/**
 * `client.status` is a required DB column (module-01 §7.1) but V1 does not define a controlled
 * vocabulary for it, unlike the project enums. Model it as a bounded, trimmed, free-form string
 * until a canonical set of values is specified.
 */
export const clientStatusSchema = z.string().trim().min(1).max(40);

const clientSharedShape = {
  name: clientNameSchema,
  contactPerson: clientContactPersonSchema.optional(),
  email: clientEmailSchema.optional(),
  notes: clientNotesSchema.optional(),
  status: clientStatusSchema,
};

export const clientCreateInputSchema = z
  .object({ ...clientSharedShape, status: clientStatusSchema.default("active") })
  .strict();

export type ClientCreateInput = z.infer<typeof clientCreateInputSchema>;

// Built from `clientSharedShape` (no default), not a `.partial()` of the create schema — see the
// matching comment in project.ts for why defaults and `.partial()` don't mix for update DTOs.
export const clientUpdateInputSchema = z
  .object({
    version: optimisticVersionSchema,
    name: clientNameSchema.optional(),
    contactPerson: clientContactPersonSchema.nullable().optional(),
    email: clientEmailSchema.nullable().optional(),
    notes: clientNotesSchema.nullable().optional(),
    status: clientStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "At least one mutable field must be provided to update a client.",
  });

export type ClientUpdateInput = z.infer<typeof clientUpdateInputSchema>;

export const clientListFilterSchema = paginationQuerySchema
  .extend({
    status: clientStatusSchema.optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type ClientListFilter = z.infer<typeof clientListFilterSchema>;
