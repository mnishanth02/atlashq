export const postgresExtensions = ["pg_trgm", "unaccent"] as const;

export const schemaAreas = [
  "tenancy-and-access",
  "source-evidence",
  "requirements-and-review",
  "delivery-governance",
  "architecture",
  "ai-and-audit",
  "integration-and-export",
] as const;

export const mutableBusinessTableColumns = [
  "organization_id",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "soft_deleted_at",
  "version",
] as const;

export const auditTableConvention = {
  appendOnly: true,
  note: "Audit tables must be append-only; do not add update/delete application paths.",
} as const;

export const drizzleSchemaPlaceholder = {
  dialect: "postgresql",
  orm: "drizzle",
  extensions: postgresExtensions,
  schemaAreas,
  mutableBusinessTableColumns,
  auditTableConvention,
  searchBaseline: "postgres-full-text-search",
  vectorSearch: "deferred",
} as const;
