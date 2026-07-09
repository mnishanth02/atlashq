import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = resolve(packageRoot, "migrations");
const migrationPath = resolve(packageRoot, "migrations", "0000_enable_text_search_extensions.sql");
const schemaPath = resolve(packageRoot, "src", "schema.ts");

if (!existsSync(migrationPath)) {
  throw new Error("Missing baseline migration: migrations/0000_enable_text_search_extensions.sql");
}

if (!existsSync(schemaPath)) {
  throw new Error("Missing Drizzle schema placeholder: src/schema.ts");
}

const migration = readFileSync(migrationPath, "utf8");
const schema = readFileSync(schemaPath, "utf8");
const vectorExtensionPattern = /create\s+extension\s+(?:if\s+not\s+exists\s+)?"?vector"?/i;

for (const extension of ["pg_trgm", "unaccent"]) {
  if (!migration.includes(`CREATE EXTENSION IF NOT EXISTS ${extension}`)) {
    throw new Error(`Missing PostgreSQL extension placeholder: ${extension}`);
  }

  if (!schema.includes(`"${extension}"`)) {
    throw new Error(`Schema placeholder does not declare expected extension: ${extension}`);
  }
}

for (const fileName of readdirSync(migrationsRoot)) {
  if (!fileName.endsWith(".sql")) {
    continue;
  }

  const migrationContent = readFileSync(resolve(migrationsRoot, fileName), "utf8").toLowerCase();

  if (migrationContent.includes("pgvector") || vectorExtensionPattern.test(migrationContent)) {
    throw new Error(`Vector search extensions are intentionally out of scope for V1: ${fileName}`);
  }
}

const requiredSchemaSnippets = [
  'dialect: "postgresql"',
  'orm: "drizzle"',
  "auditTableConvention",
  "appendOnly: true",
  "mutableBusinessTableColumns",
  "organization_id",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "soft_deleted_at",
  "version",
  "tenancy-and-access",
  "source-evidence",
  "requirements-and-review",
  "delivery-governance",
  "architecture",
  "ai-and-audit",
  "integration-and-export",
];

for (const snippet of requiredSchemaSnippets) {
  if (!schema.includes(snippet)) {
    throw new Error(`DB schema placeholder is missing required convention: ${snippet}`);
  }
}

if (schema.includes("pgvector")) {
  throw new Error("pgvector is intentionally out of scope for V1.");
}

console.log("DB migration and schema placeholder check passed.");
