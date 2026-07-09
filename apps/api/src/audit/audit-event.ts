export type AuditMutationAction = "create" | "update" | "delete";

export type AuditEventPlaceholder = {
  action: AuditMutationAction;
  actorId: string;
  projectId?: string;
  resourceType: string;
  resourceId: string;
  correlationId: string;
};

export function describeAuditConvention(event: AuditEventPlaceholder) {
  return {
    ...event,
    convention: "Mutating endpoints must emit audit events after durable state changes.",
  };
}
