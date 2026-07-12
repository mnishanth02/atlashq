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
  "source_upload_session",
  "source_upload_file",
  "source_document",
  "source_document_file",
  "source_extraction",
  "source_chunk",
  "reference_artifact",
  "organization_ai_provider_policy",
  "requirement_analysis_run",
  "requirement_analysis_snapshot",
  "requirement_analysis_snapshot_source",
  "requirement_analysis_snapshot_file",
  "requirement_analysis_snapshot_chunk",
  "requirement_analysis_stage",
  "requirement_analysis_stage_dependency",
  "requirement_analysis_batch",
  "requirement_analysis_batch_chunk",
  "requirement",
  "citation",
  "coverage_matrix_entry",
  "delivery_item",
];

// Link tables intentionally use a composite primary key instead of a synthetic id column
// (module-03 §9.4): the natural key already uniquely identifies the row.
const compositePrimaryKeyTables = new Set([
  "requirement_analysis_stage_dependency",
  "requirement_analysis_batch_chunk",
]);

for (const tableName of requiredTables) {
  const table = snapshot.tables?.[`public.${tableName}`];
  assert(table, `Latest Drizzle snapshot is missing table: ${tableName}`);
  if (!compositePrimaryKeyTables.has(tableName)) {
    assert(table.columns?.id?.type === "uuid", `${tableName}.id must be a UUID.`);
  }
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
  source_upload_session: [
    "organization_id",
    "project_id",
    "actor_id",
    "intake_mode",
    "metadata_draft",
    "supersedes_id",
    "expected_content_hash",
    "duplicate_match_ids",
    "duplicate_acknowledged_at",
    "duplicate_acknowledged_by",
    "status",
    "expires_at",
    "confirmed_at",
    "created_source_id",
    "idempotency_key",
    "created_at",
    "updated_at",
  ],
  source_upload_file: [
    "upload_session_id",
    "ordinal",
    "role",
    "original_file_name",
    "normalized_file_name",
    "declared_mime_type",
    "extension",
    "expected_byte_size",
    "expected_sha256",
    "object_key",
    "upload_status",
    "object_store_metadata",
    "created_at",
    "updated_at",
  ],
  source_document: [
    "organization_id",
    "project_id",
    "lineage_id",
    "version_number",
    "supersedes_id",
    "source_type",
    "document_format",
    "title",
    "notes",
    "tags",
    "provenance_date",
    "content_hash",
    "duplicate_acknowledged_match_ids",
    "duplicate_acknowledged_at",
    "duplicate_acknowledged_by",
    "processing_status",
    "ai_processing_status",
    "created_at",
    "created_by",
    "updated_at",
    "updated_by",
    "archived_at",
    "archived_by",
    "version",
  ],
  source_document_file: [
    "source_document_id",
    "ordinal",
    "role",
    "original_file_name",
    "download_file_name",
    "format",
    "declared_mime_type",
    "byte_size",
    "sha256",
    "object_key",
    "object_version_id",
    "scan_status",
    "scan_result",
    "scan_signature_version",
    "scanned_at",
    "created_at",
  ],
  source_extraction: [
    "source_document_id",
    "extraction_version",
    "status",
    "parser_manifest",
    "chunker_version",
    "extracted_text_hash",
    "preview_object_key",
    "preview_object_version_id",
    "started_at",
    "completed_at",
    "failure_code",
    "failure_detail",
    "created_at",
  ],
  source_chunk: [
    "organization_id",
    "project_id",
    "source_document_id",
    "source_extraction_id",
    "sequence",
    "content",
    "character_count",
    "content_hash",
    "locator",
    "created_at",
  ],
  reference_artifact: [
    "source_document_id",
    "organization_id",
    "project_id",
    "reference_kind",
    "capture_method",
    "access_type",
    "intended_use",
    "source_url",
    "ip_review_status",
    "ip_review_reason",
    "ip_reviewed_by",
    "ip_reviewed_at",
    "attestation_text",
    "attestation_version",
    "attested_by",
    "attested_at",
    "audit_event_id",
    "captured_at",
    "created_at",
  ],
  organization_ai_provider_policy: [
    "organization_id",
    "provider",
    "policy_name",
    "status",
    "approved_for_requirement_analysis",
    "approved_by",
    "approved_at",
    "approval_note",
    "max_usd_per_run",
    "max_input_tokens_per_run",
    "max_output_tokens_per_run",
    "max_wall_clock_seconds",
    "version",
  ],
  requirement_analysis_run: [
    "organization_id",
    "project_id",
    "requested_by",
    "mode",
    "status",
    "cancel_requested_at",
    "cancel_requested_by",
    "cancel_reason",
    "source_snapshot_id",
    "replay_of_run_id",
    "reprocess_of_run_id",
    "retry_of_run_id",
    "provider_policy_id",
    "max_usd",
    "max_input_tokens",
    "max_output_tokens",
    "max_wall_clock_seconds",
    "input_tokens_used",
    "output_tokens_used",
    "cost_usd",
    "failure_code",
    "failure_retryable",
    "failed_stage_id",
    "correlation_id",
  ],
  requirement_analysis_stage_dependency: [
    "run_id",
    "organization_id",
    "project_id",
    "stage_id",
    "depends_on_stage_id",
  ],
  requirement_analysis_batch_chunk: [
    "organization_id",
    "project_id",
    "batch_id",
    "snapshot_chunk_id",
  ],
  requirement: [
    "organization_id",
    "project_id",
    "analysis_run_id",
    "stable_key",
    "requirement_type",
    "priority",
    "epistemic_status",
    "confidence_band",
    "inference_basis",
    "origin",
    "lifecycle_state",
    "parent_requirement_id",
  ],
  citation: [
    "organization_id",
    "project_id",
    "analysis_run_id",
    "requirement_id",
    "coverage_matrix_entry_id",
    "delivery_item_id",
    "source_document_id",
    "source_extraction_id",
    "source_chunk_id",
    "quote_hash",
    "match_start_offset",
    "match_end_offset",
    "verification_status",
  ],
  coverage_matrix_entry: [
    "organization_id",
    "project_id",
    "analysis_run_id",
    "category_key",
    "category_order",
    "status",
    "evidence_state",
    "question_delivery_item_id",
  ],
  delivery_item: [
    "organization_id",
    "project_id",
    "analysis_run_id",
    "item_type",
    "status",
    "visibility",
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

// source_chunk is fully append-only (module-02 §8.6): it never carries a soft-delete, archive, or
// optimistic-version column the way mutable-metadata tables do.
const sourceChunkColumns = snapshot.tables["public.source_chunk"].columns;
for (const disallowedColumn of ["updated_at", "updated_by", "soft_deleted_at", "version"]) {
  assert(
    !sourceChunkColumns[disallowedColumn],
    `source_chunk must remain append-only: unexpected column ${disallowedColumn}`,
  );
}

const requiredConstraints = [
  "project_client_type_check",
  "project_status_check",
  "project_visibility_check",
  "project_membership_role_check",
  "project_membership_status_check",
  "ai_run_status_check",
  "ai_run_review_status_check",
  "audit_event_correlation_id_check",
  "source_upload_session_status_check",
  "source_upload_session_expected_content_hash_check",
  "source_upload_file_expected_sha256_check",
  "source_document_source_type_check",
  "source_document_document_format_presence_check",
  "source_document_processing_status_check",
  "source_document_ai_processing_status_check",
  "source_document_content_hash_check",
  "source_document_file_sha256_check",
  "source_document_file_scan_status_check",
  "source_extraction_status_check",
  "source_chunk_content_hash_check",
  "reference_artifact_reference_kind_check",
  "reference_artifact_ip_review_status_check",
  "reference_artifact_capture_source_url_check",
  "organization_ai_provider_policy_status_check",
  "organization_ai_provider_policy_approval_fields_check",
  "organization_ai_provider_policy_approved_flag_check",
  "requirement_analysis_run_mode_check",
  "requirement_analysis_run_status_check",
  "requirement_analysis_run_mode_lineage_check",
  "requirement_analysis_run_failure_fields_check",
  "requirement_analysis_stage_status_check",
  "requirement_analysis_batch_status_check",
  "requirement_requirement_type_check",
  "requirement_epistemic_status_check",
  "requirement_lifecycle_state_check",
  "requirement_assumed_inference_basis_check",
  "requirement_unknown_conflicting_confidence_check",
  "citation_exactly_one_target_check",
  "citation_verification_status_check",
  "citation_match_offset_check",
  "coverage_matrix_entry_category_key_check",
  "coverage_matrix_entry_category_order_check",
  "coverage_matrix_entry_status_check",
  "delivery_item_item_type_check",
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
  "source_upload_session_organization_project_status_idx",
  "source_upload_session_expires_at_idx",
  "source_upload_session_idempotency_key_uidx",
  "source_upload_file_session_ordinal_uidx",
  "source_upload_file_object_key_uidx",
  "source_document_lineage_version_uidx",
  "source_document_supersedes_id_uidx",
  "source_document_project_status_idx",
  "source_document_project_content_hash_idx",
  "source_document_title_trgm_idx",
  "source_document_file_document_ordinal_uidx",
  "source_document_file_object_key_uidx",
  "source_extraction_document_version_uidx",
  "source_chunk_extraction_sequence_uidx",
  "reference_artifact_source_document_id_uidx",
  "reference_artifact_project_ip_review_status_idx",
  "organization_ai_provider_policy_org_name_uidx",
  "organization_ai_provider_policy_org_status_idx",
  "requirement_analysis_run_active_per_project_uidx",
  "requirement_analysis_run_org_status_idx",
  "requirement_analysis_snapshot_run_id_uidx",
  "requirement_analysis_stage_dependency_stage_id_idx",
  "requirement_analysis_stage_dependency_project_id_idx",
  "requirement_analysis_batch_chunk_project_id_idx",
  "requirement_analysis_run_stable_key_uidx",
  "coverage_matrix_entry_run_category_uidx",
  "citation_requirement_target_uidx",
  "citation_coverage_target_uidx",
  "citation_delivery_item_target_uidx",
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

// Module 2 Source Document Vault: source_document, source_document_file, source_extraction,
// source_chunk, and reference_artifact are archive-only (module-02 §8). Every one of them must
// reject DELETE and TRUNCATE outright, while source_upload_session/source_upload_file remain
// deletable for expiry cleanup and must NOT gain delete/truncate guards.
assert(
  /create\s+or\s+replace\s+function\s+source_vault_prevent_delete/iu.test(migrations),
  "Missing shared source-vault archive-only trigger function migration.",
);

const sourceVaultArchiveOnlyTables = [
  "source_document",
  "source_document_file",
  "source_extraction",
  "source_chunk",
  "reference_artifact",
];

for (const tableName of sourceVaultArchiveOnlyTables) {
  assert(
    new RegExp(
      `drop\\s+trigger\\s+if\\s+exists\\s+${tableName}_no_delete[\\s\\S]*?` +
        `create\\s+trigger\\s+${tableName}_no_delete\\s*\\n?before\\s+delete\\s+on\\s+"${tableName}"`,
      "iu",
    ).test(migrations),
    `Missing archive-only DELETE guard trigger for ${tableName}.`,
  );
  assert(
    new RegExp(
      `drop\\s+trigger\\s+if\\s+exists\\s+${tableName}_no_truncate[\\s\\S]*?` +
        `create\\s+trigger\\s+${tableName}_no_truncate\\s*\\n?before\\s+truncate\\s+on\\s+"${tableName}"`,
      "iu",
    ).test(migrations),
    `Missing archive-only TRUNCATE guard trigger for ${tableName}.`,
  );
}

for (const tableName of ["source_upload_session", "source_upload_file"]) {
  assert(
    !new RegExp(`before\\s+delete\\s+on\\s+"${tableName}"`, "iu").test(migrations),
    `${tableName} must remain deletable for expiry cleanup and must not gain a delete guard.`,
  );
}

// Partial-mutation guards: source_document, source_document_file, source_extraction, and
// reference_artifact allow specific lifecycle/processing/metadata/review columns to change, while
// source_chunk blocks UPDATE entirely (module-02 §8.3-§8.7).
assert(
  /create\s+or\s+replace\s+function\s+source_document_guard_update/iu.test(migrations),
  "Missing source_document immutable-column UPDATE guard function.",
);
assert(
  /create\s+or\s+replace\s+function\s+source_document_file_guard_update/iu.test(migrations),
  "Missing source_document_file immutable-column UPDATE guard function.",
);
assert(
  /create\s+or\s+replace\s+function\s+source_extraction_guard_update/iu.test(migrations),
  "Missing source_extraction terminal-state UPDATE guard function.",
);
assert(
  /create\s+or\s+replace\s+function\s+reference_artifact_guard_update/iu.test(migrations),
  "Missing reference_artifact attestation-immutability UPDATE guard function.",
);
assert(
  /create\s+trigger\s+source_chunk_no_update\s*\n?before\s+update\s+on\s+"source_chunk"/iu.test(
    migrations,
  ),
  "source_chunk must reject every UPDATE (fully append-only).",
);

// Lineage/version-ancestry guard: source_document root rows must self-anchor (supersedes_id
// null, version_number 1, lineage_id = id) and replacement rows must inherit
// organization_id/project_id/lineage_id from their predecessor and advance version_number by
// exactly one (module-02 §8.3). Enforced at INSERT since these columns are already immutable on
// UPDATE via source_document_guard_update.
assert(
  /create\s+or\s+replace\s+function\s+source_document_lineage_guard/iu.test(migrations),
  "Missing source_document lineage/version ancestry guard function.",
);
assert(
  /create\s+trigger\s+source_document_lineage_guard\s*\n?before\s+insert\s+on\s+"source_document"/iu.test(
    migrations,
  ),
  "Missing source_document lineage/version ancestry BEFORE INSERT trigger.",
);

// Cross-tenant scope-consistency guards for denormalized organization/project/actor relations
// most exposed to corruption (module-02 §8.1, §8.3, §8.6, §8.7).
assert(
  /create\s+or\s+replace\s+function\s+source_document_scope_guard/iu.test(migrations),
  "Missing source_document organization/project/creator scope guard function.",
);
assert(
  /create\s+trigger\s+source_document_scope_guard\s*\n?before\s+insert\s+on\s+"source_document"/iu.test(
    migrations,
  ),
  "Missing source_document scope guard BEFORE INSERT trigger.",
);
assert(
  /create\s+or\s+replace\s+function\s+source_upload_session_scope_guard/iu.test(migrations),
  "Missing source_upload_session organization/project/actor scope guard function.",
);
assert(
  /create\s+trigger\s+source_upload_session_scope_guard\s*\n?before\s+insert\s+or\s+update\s+on\s+"source_upload_session"/iu.test(
    migrations,
  ),
  "Missing source_upload_session scope guard BEFORE INSERT OR UPDATE trigger.",
);
assert(
  /create\s+or\s+replace\s+function\s+reference_artifact_scope_guard/iu.test(migrations),
  "Missing reference_artifact organization/project/source_type/actor scope guard function.",
);
assert(
  /create\s+trigger\s+reference_artifact_scope_guard\s*\n?before\s+insert\s+or\s+update\s+on\s+"reference_artifact"/iu.test(
    migrations,
  ),
  "Missing reference_artifact scope guard BEFORE INSERT OR UPDATE trigger.",
);
assert(
  /create\s+or\s+replace\s+function\s+source_chunk_scope_guard/iu.test(migrations),
  "Missing source_chunk organization/project/extraction-chain scope guard function.",
);
assert(
  /create\s+trigger\s+source_chunk_scope_guard\s*\n?before\s+insert\s+on\s+"source_chunk"/iu.test(
    migrations,
  ),
  "Missing source_chunk scope guard BEFORE INSERT trigger.",
);

// Module 3 (AI Requirement Analyzer): frozen snapshot header/source/file/chunk rows and citation
// rows are fully append-only after insert (module-03 §9.3, §9.6).
assert(
  /create\s+or\s+replace\s+function\s+requirement_analysis_prevent_mutation/iu.test(migrations),
  "Missing shared requirement-analysis append-only trigger function migration.",
);

const requirementAnalysisAppendOnlyTables = [
  "requirement_analysis_snapshot",
  "requirement_analysis_snapshot_source",
  "requirement_analysis_snapshot_file",
  "requirement_analysis_snapshot_chunk",
  "citation",
];

for (const tableName of requirementAnalysisAppendOnlyTables) {
  assert(
    new RegExp(
      `drop\\s+trigger\\s+if\\s+exists\\s+${tableName}_no_update[\\s\\S]*?` +
        `create\\s+trigger\\s+${tableName}_no_update\\s*\\n?before\\s+update\\s+on\\s+"${tableName}"`,
      "iu",
    ).test(migrations),
    `Missing append-only UPDATE guard trigger for ${tableName}.`,
  );
  assert(
    new RegExp(
      `drop\\s+trigger\\s+if\\s+exists\\s+${tableName}_no_delete[\\s\\S]*?` +
        `create\\s+trigger\\s+${tableName}_no_delete\\s*\\n?before\\s+delete\\s+on\\s+"${tableName}"`,
      "iu",
    ).test(migrations),
    `Missing append-only DELETE guard trigger for ${tableName}.`,
  );
  assert(
    new RegExp(
      `drop\\s+trigger\\s+if\\s+exists\\s+${tableName}_no_truncate[\\s\\S]*?` +
        `create\\s+trigger\\s+${tableName}_no_truncate\\s*\\n?before\\s+truncate\\s+on\\s+"${tableName}"`,
      "iu",
    ).test(migrations),
    `Missing append-only TRUNCATE guard trigger for ${tableName}.`,
  );
}

// requirement, coverage_matrix_entry, and delivery_item are derived truth: no hard DELETE/TRUNCATE,
// but UPDATE stays open for a later module's lifecycle.
for (const tableName of ["requirement", "coverage_matrix_entry", "delivery_item"]) {
  assert(
    new RegExp(`drop\\s+trigger\\s+if\\s+exists\\s+${tableName}_no_delete`, "iu").test(migrations),
    `Missing derived-truth DELETE guard trigger for ${tableName}.`,
  );
  assert(
    new RegExp(`drop\\s+trigger\\s+if\\s+exists\\s+${tableName}_no_truncate`, "iu").test(
      migrations,
    ),
    `Missing derived-truth TRUNCATE guard trigger for ${tableName}.`,
  );
}

// Scope/DAG-integrity guards: stage dependency edges, batches, batch chunks, and the frozen
// snapshot chain must stay consistent with run/organization/project identity (module-03 §9.3-§9.4).
const requirementAnalysisScopeGuardFunctions = [
  "requirement_analysis_stage_dependency_scope_guard",
  "requirement_analysis_batch_scope_guard",
  "requirement_analysis_batch_chunk_scope_guard",
  "requirement_analysis_snapshot_source_scope_guard",
  "requirement_analysis_snapshot_file_scope_guard",
  "requirement_analysis_snapshot_chunk_scope_guard",
];

for (const functionName of requirementAnalysisScopeGuardFunctions) {
  assert(
    new RegExp(`create\\s+or\\s+replace\\s+function\\s+${functionName}`, "iu").test(migrations),
    `Missing Module 3 scope guard function: ${functionName}.`,
  );
  assert(
    new RegExp(`create\\s+trigger\\s+${functionName}\\s*\\n?before\\s+insert`, "iu").test(
      migrations,
    ),
    `Missing BEFORE INSERT trigger wiring for ${functionName}.`,
  );
}

// Epistemic/finalization guards (module-03 §6.1, §8.5, §9.5, §9.7): confirmed requirements and
// addressed coverage rows must have a verified citation by commit; a run may only finalize with
// exactly 18 coverage rows and every partial/absent row question-linked; coverage rows freeze once
// their run is terminal.
assert(
  /create\s+or\s+replace\s+function\s+requirement_confirmed_citation_guard/iu.test(migrations),
  "Missing requirement_confirmed_citation_guard function.",
);
assert(
  /create\s+constraint\s+trigger\s+requirement_confirmed_citation_guard[\s\S]*?deferrable\s+initially\s+deferred/iu.test(
    migrations,
  ),
  "requirement_confirmed_citation_guard must be a DEFERRABLE INITIALLY DEFERRED constraint trigger.",
);
assert(
  /create\s+or\s+replace\s+function\s+coverage_matrix_entry_addressed_citation_guard/iu.test(
    migrations,
  ),
  "Missing coverage_matrix_entry_addressed_citation_guard function.",
);
assert(
  /create\s+constraint\s+trigger\s+coverage_matrix_entry_addressed_citation_guard[\s\S]*?deferrable\s+initially\s+deferred/iu.test(
    migrations,
  ),
  "coverage_matrix_entry_addressed_citation_guard must be a DEFERRABLE INITIALLY DEFERRED constraint trigger.",
);
assert(
  /create\s+or\s+replace\s+function\s+requirement_analysis_run_completion_guard/iu.test(migrations),
  "Missing requirement_analysis_run_completion_guard function (exactly-18-categories finalization check).",
);
assert(
  /create\s+or\s+replace\s+function\s+coverage_matrix_entry_terminal_guard/iu.test(migrations),
  "Missing coverage_matrix_entry_terminal_guard function (append-only after run finalization).",
);

console.log(
  `DB schema check passed: ${requiredTables.length} tables, ${requiredIndexes.length} required indexes, ${migrationFiles.length} journaled migration.`,
);
