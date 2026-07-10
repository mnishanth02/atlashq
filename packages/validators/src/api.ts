import { organizationRoleValues } from "@atlashq/types";
import { z } from "zod";
import {
  correlationIdSchema,
  createUuidPathParamsSchema,
  isoDateTimeSchema,
  uuidSchema,
} from "./ids.js";

const userStatusValues = ["active", "suspended", "archived"] as const;

export const apiErrorCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9_]+$/, "Error codes must use uppercase snake case.");

export const apiErrorDetailSchema = z
  .object({
    path: z.array(z.union([z.string().trim().min(1), z.number().int().min(0)])).min(1),
    message: z.string().trim().min(1),
    code: z.string().trim().min(1),
  })
  .strict();

export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;

export const apiErrorSchema = z
  .object({
    statusCode: z.number().int().min(100).max(599),
    code: apiErrorCodeSchema,
    message: z.string().trim().min(1),
    details: z.array(apiErrorDetailSchema).min(1).optional(),
    correlationId: correlationIdSchema.optional(),
  })
  .strict();

export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;

export const authenticatedUserStatusSchema = z.enum(userStatusValues);

export const authenticatedUserResponseSchema = z
  .object({
    id: uuidSchema,
    email: z.email(),
    name: z.string().trim().min(1),
    organizationId: uuidSchema,
    organizationRole: z.enum(organizationRoleValues),
    status: authenticatedUserStatusSchema,
  })
  .strict();

export type AuthenticatedUserResponse = z.infer<typeof authenticatedUserResponseSchema>;

export const authenticatedSessionResponseSchema = z
  .object({
    id: uuidSchema,
    expiresAt: isoDateTimeSchema,
  })
  .strict();

export type AuthenticatedSessionResponse = z.infer<typeof authenticatedSessionResponseSchema>;

export const authenticatedMeResponseSchema = z
  .object({
    user: authenticatedUserResponseSchema,
    session: authenticatedSessionResponseSchema,
  })
  .strict();

export type AuthenticatedMeResponse = z.infer<typeof authenticatedMeResponseSchema>;

export const currentOrganizationResponseSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1),
    plan: z.string().trim().min(1),
    role: z.enum(organizationRoleValues),
  })
  .strict();

export type CurrentOrganizationResponse = z.infer<typeof currentOrganizationResponseSchema>;

export { createUuidPathParamsSchema };
