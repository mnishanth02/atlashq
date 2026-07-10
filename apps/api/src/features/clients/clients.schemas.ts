import {
  clientContactPersonSchema,
  clientCreateInputSchema,
  clientEmailSchema,
  clientListFilterSchema,
  clientNameSchema,
  clientNotesSchema,
  clientStatusSchema,
  clientUpdateInputSchema,
  createPaginatedResponseSchema,
  createUuidPathParamsSchema,
  isoDateTimeSchema,
  uuidSchema,
} from "@atlashq/validators";
import { z } from "zod";

export { clientCreateInputSchema, clientListFilterSchema, clientUpdateInputSchema };
export type ClientCreateInput = z.output<typeof clientCreateInputSchema>;
export type ClientUpdateInput = z.output<typeof clientUpdateInputSchema>;
export type ClientListFilter = z.output<typeof clientListFilterSchema>;

export const clientResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: uuidSchema,
    name: clientNameSchema,
    contactPerson: clientContactPersonSchema.nullable(),
    email: clientEmailSchema.nullable(),
    notes: clientNotesSchema.nullable(),
    status: clientStatusSchema,
    createdAt: isoDateTimeSchema,
    createdBy: uuidSchema.nullable(),
    updatedAt: isoDateTimeSchema,
    updatedBy: uuidSchema.nullable(),
    softDeletedAt: isoDateTimeSchema.nullable(),
    version: z.number().int().positive(),
  })
  .strict();

export type ClientResponse = z.infer<typeof clientResponseSchema>;

export const clientListResponseSchema = createPaginatedResponseSchema(clientResponseSchema);

export type ClientListResponse = z.infer<typeof clientListResponseSchema>;

export const clientPathParamsSchema = createUuidPathParamsSchema("clientId");
