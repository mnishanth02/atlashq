import { z } from "zod";
import {
  auditEventIdSchema,
  correlationIdSchema,
  entityIdSchema,
  isoDateTimeSchema,
  organizationIdSchema,
  projectIdSchema,
  userIdSchema,
} from "./ids.js";
import { paginationQuerySchema } from "./pagination.js";

// Keep the public contract JSON-shaped without emitting a recursive OpenAPI component. The
// committed client generator cannot represent a self-referential component inside its generated
// `components["schemas"]` map, while persisted audit snapshots are already guaranteed to be JSON.
const jsonSnapshotValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

const jsonSnapshotSchema = z.record(z.string(), jsonSnapshotValueSchema);

/**
 * Canonical `audit_event` response shape (module-01 §5.7/§7.1): organization, actor, action,
 * entity type/id, optional project, before/after snapshots, correlation id, and `at` timestamp.
 */
export const auditEventResponseSchema = z
  .object({
    id: auditEventIdSchema,
    organizationId: organizationIdSchema,
    actorId: userIdSchema,
    action: z.string().trim().min(1),
    entityType: z.string().trim().min(1),
    entityId: entityIdSchema,
    projectId: projectIdSchema.optional(),
    before: jsonSnapshotSchema.nullable(),
    after: jsonSnapshotSchema.nullable(),
    correlationId: correlationIdSchema,
    at: isoDateTimeSchema,
  })
  .strict();

export type AuditEventResponse = z.infer<typeof auditEventResponseSchema>;

export const auditEventListFilterSchema = paginationQuerySchema
  .extend({
    entityType: z.string().trim().min(1).optional(),
    entityId: entityIdSchema.optional(),
    actorId: userIdSchema.optional(),
  })
  .strict();

export type AuditEventListFilter = z.infer<typeof auditEventListFilterSchema>;
