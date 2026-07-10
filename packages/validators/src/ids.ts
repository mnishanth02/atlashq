import { z } from "zod";

export const entityIdSchema = z.string().trim().min(1);
export const uuidSchema = z.uuid();

export const organizationIdSchema = uuidSchema;
export const projectIdSchema = uuidSchema;
export const clientIdSchema = uuidSchema;
export const userIdSchema = uuidSchema;
export const projectMembershipIdSchema = uuidSchema;
export const auditEventIdSchema = uuidSchema;
export const aiRunIdSchema = uuidSchema;
export const correlationIdSchema = entityIdSchema;

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

type UuidPathParamsShape<Key extends string> = {
  [Property in Key]: typeof uuidSchema;
};

export function createUuidPathParamsSchema<Key extends string>(key: Key) {
  return z.object({ [key]: uuidSchema } as UuidPathParamsShape<Key>).strict();
}
