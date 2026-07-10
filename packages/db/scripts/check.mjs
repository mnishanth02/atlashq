import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = resolve(packageRoot, "migrations");
const metaRoot = resolve(migrationsRoot, "meta");
const packageJsonPath = resolve(packageRoot, "package.json");
const configPath = resolve(packageRoot, "drizzle.config.ts");
const schemaPath = resolve(packageRoot, "src", "schema.ts");
const journalPath = resolve(metaRoot, "_journal.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

for (const path of [packageJsonPath, configPath, schemaPath, journalPath]) {
  assert(existsSync(path), `Missing required database file: ${path}`);
}

const packageJson = readJson(packageJsonPath);
const config = readFileSync(configPath, "utf8");
const journal = readJson(journalPath);
const migrationFiles = readdirSync(migrationsRoot)
  .filter((fileName) => /^\d{4}_[a-z0-9_]+\.sql$/u.test(fileName))
  .sort();

assert(packageJson.dependencies?.["drizzle-orm"], "drizzle-orm must be a runtime dependency.");
assert(packageJson.dependencies?.pg, "pg must be a runtime dependency.");
assert(
  packageJson.devDependencies?.["drizzle-kit"],
  "drizzle-kit must be a development dependency.",
);
assert(packageJson.devDependencies?.["@types/pg"], "@types/pg must be a development dependency.");

for (const scriptName of ["db:generate", "db:migrate", "db:studio", "db:check"]) {
  assert(packageJson.scripts?.[scriptName], `Missing package script: ${scriptName}`);
}

assert(/dialect:\s*"postgresql"/u.test(config), "Drizzle config must use the PostgreSQL dialect.");
assert(/schema:\s*"\.\/src\/schema\.ts"/u.test(config), "Drizzle config must load src/schema.ts.");
assert(/out:\s*"\.\/migrations"/u.test(config), "Drizzle config must write migrations/.");
assert(/process\.env\.DATABASE_URL/u.test(config), "Drizzle config must read DATABASE_URL.");

assert(journal.version === "7", "Unexpected Drizzle migration journal version.");
assert(journal.dialect === "postgresql", "Migration journal must use PostgreSQL.");
assert(Array.isArray(journal.entries) && journal.entries.length > 0, "Migration journal is empty.");
assert(
  journal.entries.every((entry, index) => entry.idx === index),
  "Migration journal entries must have sequential indexes.",
);

const journalMigrationFiles = journal.entries.map((entry) => `${entry.tag}.sql`).sort();
assert(
  JSON.stringify(migrationFiles) === JSON.stringify(journalMigrationFiles),
  "Migration SQL files and Drizzle journal entries are out of sync.",
);

const migrations = migrationFiles
  .map((fileName) => readFileSync(resolve(migrationsRoot, fileName), "utf8"))
  .join("\n");
const normalizedMigrations = migrations.toLowerCase();

for (const extension of ["pg_trgm", "unaccent"]) {
  assert(
    new RegExp(`create\\s+extension\\s+if\\s+not\\s+exists\\s+${extension}`, "iu").test(migrations),
    `Missing PostgreSQL extension migration: ${extension}`,
  );
}

assert(
  !/create\s+extension\s+(?:if\s+not\s+exists\s+)?"?(?:vector|pgvector)"?/iu.test(migrations),
  "pgvector is intentionally out of scope for V1.",
);
assert(
  !normalizedMigrations.includes("pgvector"),
  "Migration content must not reference pgvector.",
);

const lastEntry = journal.entries.at(-1);
assert(lastEntry, "Migration journal must have a latest entry.");
const snapshotPath = resolve(metaRoot, `${String(lastEntry.idx).padStart(4, "0")}_snapshot.json`);
assert(existsSync(snapshotPath), `Missing Drizzle snapshot for migration ${lastEntry.tag}.`);
const snapshot = readJson(snapshotPath);

const requiredTables = [
  "organization",
  "user",
  "session",
  "account",
  "verification",
  "client",
  "project",
  "project_membership",
  "audit_event",
  "traceability_link",
  "ai_run",
];

for (const tableName of requiredTables) {
  const table = snapshot.tables?.[`public.${tableName}`];
  assert(table, `Latest Drizzle snapshot is missing table: ${tableName}`);
  assert(table.columns?.id?.type === "uuid", `${tableName}.id must be a UUID.`);
  assert(
    new RegExp(`create\\s+table\\s+"${tableName}"`, "iu").test(migrations),
    `Migrations do not create table: ${tableName}`,
  );
}

const requiredColumns = {
  user: [
    "organization_id",
    "organization_role",
    "name",
    "email",
    "email_verified",
    "image",
    "status",
    "created_at",
    "updated_at",
  ],
  session: [
    "expires_at",
    "token",
    "created_at",
    "updated_at",
    "ip_address",
    "user_agent",
    "user_id",
  ],
  account: [
    "account_id",
    "provider_id",
    "user_id",
    "access_token",
    "refresh_token",
    "id_token",
    "access_token_expires_at",
    "refresh_token_expires_at",
    "scope",
    "password",
    "created_at",
    "updated_at",
  ],
  verification: ["identifier", "value", "expires_at", "created_at", "updated_at"],
  project: [
    "organization_id",
    "client_id",
    "name",
    "type",
    "status",
    "owner_id",
    "tech_lead_id",
    "business_owner_id",
    "start_date",
    "target_date",
    "current_phase",
    "tags",
    "priority",
    "visibility",
    "description",
    "soft_deleted_at",
    "version",
  ],
  project_membership: [
    "organization_id",
    "project_id",
    "user_id",
    "role",
    "status",
    "invited_at",
    "invited_by",
    "added_at",
    "added_by",
    "deactivated_at",
    "soft_deleted_at",
  ],
  audit_event: [
    "organization_id",
    "actor_id",
    "action",
    "entity_type",
    "entity_id",
    "project_id",
    "before",
    "after",
    "correlation_id",
    "at",
  ],
  traceability_link: [
    "organization_id",
    "from_type",
    "from_id",
    "to_type",
    "to_id",
    "relation",
    "created_by",
    "created_at",
  ],
  ai_run: [
    "organization_id",
    "project_id",
    "agent",
    "model",
    "provider",
    "prompt_version",
    "input_artifact_versions",
    "output",
    "run_status",
    "cost",
    "reviewed_by",
    "review_status",
    "created_at",
    "updated_at",
  ],
};

for (const [tableName, columnNames] of Object.entries(requiredColumns)) {
  const table = snapshot.tables[`public.${tableName}`];
  for (const columnName of columnNames) {
    assert(table.columns?.[columnName], `Latest snapshot is missing ${tableName}.${columnName}.`);
  }
}

const auditColumns = snapshot.tables["public.audit_event"].columns;
for (const mutableColumn of ["updated_at", "updated_by", "soft_deleted_at", "version"]) {
  assert(!auditColumns[mutableColumn], `audit_event must remain append-only: ${mutableColumn}`);
}

assert(
  auditColumns.correlation_id?.type === "text",
  "audit_event.correlation_id must be text: the request/response logger intentionally accepts " +
    "arbitrary non-empty external correlation IDs, not only UUIDs.",
);

const requiredConstraints = [
  "project_client_type_check",
  "project_status_check",
  "project_visibility_check",
  "project_membership_role_check",
  "project_membership_status_check",
  "ai_run_status_check",
  "ai_run_review_status_check",
  "audit_event_correlation_id_check",
];

for (const constraintName of requiredConstraints) {
  assert(
    new RegExp(`constraint\\s+"${constraintName}"`, "iu").test(migrations),
    `Missing required constraint: ${constraintName}`,
  );
}

const requiredIndexes = [
  "user_organization_status_idx",
  "session_user_id_idx",
  "account_user_id_idx",
  "verification_identifier_idx",
  "client_organization_status_idx",
  "project_organization_status_idx",
  "project_client_id_idx",
  "project_owner_id_idx",
  "project_tech_lead_id_idx",
  "project_business_owner_id_idx",
  "project_search_idx",
  "project_name_trgm_idx",
  "project_membership_project_status_idx",
  "project_membership_user_status_idx",
  "project_membership_active_uidx",
  "audit_event_project_at_idx",
  "audit_event_entity_at_idx",
  "traceability_link_from_idx",
  "traceability_link_to_idx",
  "ai_run_project_status_idx",
];

for (const indexName of requiredIndexes) {
  assert(
    new RegExp(`create\\s+(?:unique\\s+)?index\\s+"${indexName}"`, "iu").test(migrations),
    `Missing required index: ${indexName}`,
  );
}

const extensionPosition = normalizedMigrations.indexOf("create extension if not exists pg_trgm");
const trigramIndexPosition = normalizedMigrations.indexOf("gin_trgm_ops");
assert(
  extensionPosition >= 0 && trigramIndexPosition > extensionPosition,
  "pg_trgm must be enabled before trigram indexes are created.",
);

assert(
  /create\s+or\s+replace\s+function\s+audit_event_prevent_mutation/iu.test(migrations),
  "Missing append-only audit_event trigger function migration.",
);
assert(
  /drop\s+trigger\s+if\s+exists\s+audit_event_no_update/iu.test(migrations) &&
    /create\s+trigger\s+audit_event_no_update\s*\n?before\s+update\s+on\s+"audit_event"/iu.test(
      migrations,
    ),
  "Missing idempotent audit_event append-only UPDATE trigger.",
);
assert(
  /drop\s+trigger\s+if\s+exists\s+audit_event_no_delete/iu.test(migrations) &&
    /create\s+trigger\s+audit_event_no_delete\s*\n?before\s+delete\s+on\s+"audit_event"/iu.test(
      migrations,
    ),
  "Missing idempotent audit_event append-only DELETE trigger.",
);
assert(
  /drop\s+trigger\s+if\s+exists\s+audit_event_no_truncate/iu.test(migrations) &&
    /create\s+trigger\s+audit_event_no_truncate\s*\n?before\s+truncate\s+on\s+"audit_event"/iu.test(
      migrations,
    ),
  "Missing idempotent audit_event append-only TRUNCATE trigger.",
);
assert(
  !/before\s+insert\s+on\s+"audit_event"/iu.test(migrations),
  "audit_event append-only guard must not block INSERT.",
);

console.log(
  `DB schema check passed: ${requiredTables.length} tables, ${requiredIndexes.length} required indexes, ${migrationFiles.length} journaled migration.`,
);
