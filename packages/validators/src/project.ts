import {
  projectPhaseValues,
  projectPriorityValues,
  projectSortValues,
  projectStatusValues,
  projectTypeValues,
  projectVisibilityValues,
  projectWritableStatusValues,
} from "@atlashq/types";
import { z } from "zod";
import { booleanQuerySchema, optimisticVersionSchema } from "./helpers.js";
import { clientIdSchema, isoDateTimeSchema, userIdSchema } from "./ids.js";
import { paginationQuerySchema } from "./pagination.js";

export const projectTypeSchema = z.enum(projectTypeValues);
export const projectStatusSchema = z.enum(projectStatusValues);
export const projectWritableStatusSchema = z.enum(projectWritableStatusValues);
export const projectPhaseSchema = z.enum(projectPhaseValues);
export const projectPrioritySchema = z.enum(projectPriorityValues);
export const projectVisibilitySchema = z.enum(projectVisibilityValues);
export const projectSortSchema = z.enum(projectSortValues);

/** Free-form, trimmed tag string (see @atlashq/types `ProjectTag`); V1 has no fixed vocabulary. */
export const projectTagSchema = z.string().trim().min(1).max(64);

export const projectNameSchema = z.string().trim().min(1).max(200);
export const projectDescriptionSchema = z.string().trim().min(1).max(4000);

const projectCreateCommonShape = {
  name: projectNameSchema,
  ownerId: userIdSchema,
  techLeadId: userIdSchema.optional(),
  businessOwnerId: userIdSchema.optional(),
  startDate: isoDateTimeSchema.optional(),
  targetDate: isoDateTimeSchema.optional(),
  status: projectWritableStatusSchema.default("draft"),
  phase: projectPhaseSchema.default("intake"),
  priority: projectPrioritySchema.default("medium"),
  visibility: projectVisibilitySchema.default("organization"),
  tags: z.array(projectTagSchema).max(20).default([]),
  description: projectDescriptionSchema.optional(),
};

const clientProjectCreateInputSchema = z
  .object({
    ...projectCreateCommonShape,
    type: z.literal("client"),
    clientId: clientIdSchema,
  })
  .strict();

const internalProjectCreateInputSchema = z
  .object({
    ...projectCreateCommonShape,
    type: z.literal("internal"),
  })
  .strict();

export const projectCreateInputSchema = z.discriminatedUnion("type", [
  clientProjectCreateInputSchema,
  internalProjectCreateInputSchema,
]);

export type ProjectCreateInput = z.infer<typeof projectCreateInputSchema>;

export const projectUpdateInputSchema = z
  .object({
    version: optimisticVersionSchema,
    name: projectNameSchema.optional(),
    type: projectTypeSchema.optional(),
    clientId: clientIdSchema.nullable().optional(),
    ownerId: userIdSchema.optional(),
    techLeadId: userIdSchema.nullable().optional(),
    businessOwnerId: userIdSchema.nullable().optional(),
    startDate: isoDateTimeSchema.nullable().optional(),
    targetDate: isoDateTimeSchema.nullable().optional(),
    status: projectWritableStatusSchema.optional(),
    phase: projectPhaseSchema.optional(),
    priority: projectPrioritySchema.optional(),
    visibility: projectVisibilitySchema.optional(),
    tags: z.array(projectTagSchema).max(20).optional(),
    description: projectDescriptionSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "At least one mutable field must be provided to update a project.",
  });

export type ProjectUpdateInput = z.infer<typeof projectUpdateInputSchema>;

export const projectListFilterSchema = paginationQuerySchema
  .extend({
    type: projectTypeSchema.optional(),
    status: projectStatusSchema.optional(),
    phase: projectPhaseSchema.optional(),
    priority: projectPrioritySchema.optional(),
    visibility: projectVisibilitySchema.optional(),
    clientId: clientIdSchema.optional(),
    ownerId: userIdSchema.optional(),
    search: z.string().trim().min(1).optional(),
    includeArchived: booleanQuerySchema.default(false),
    sort: projectSortSchema.default("updated_desc"),
  })
  .strict();

export type ProjectListFilter = z.infer<typeof projectListFilterSchema>;
