-- Confirmed source truth is archive-only: reject DELETE/TRUNCATE on the five
-- immutable/append-only Module 2 tables, mirroring audit_event_prevent_mutation.
-- Upload session/file rows are intentionally exempt (operational, deletable for
-- expiry cleanup) and get no guard triggers at all.
CREATE OR REPLACE FUNCTION source_vault_prevent_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is archive-only: % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_document_no_delete ON "source_document";
--> statement-breakpoint
CREATE TRIGGER source_document_no_delete
BEFORE DELETE ON "source_document"
FOR EACH ROW EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_document_no_truncate ON "source_document";
--> statement-breakpoint
CREATE TRIGGER source_document_no_truncate
BEFORE TRUNCATE ON "source_document"
FOR EACH STATEMENT EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_document_file_no_delete ON "source_document_file";
--> statement-breakpoint
CREATE TRIGGER source_document_file_no_delete
BEFORE DELETE ON "source_document_file"
FOR EACH ROW EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_document_file_no_truncate ON "source_document_file";
--> statement-breakpoint
CREATE TRIGGER source_document_file_no_truncate
BEFORE TRUNCATE ON "source_document_file"
FOR EACH STATEMENT EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_extraction_no_delete ON "source_extraction";
--> statement-breakpoint
CREATE TRIGGER source_extraction_no_delete
BEFORE DELETE ON "source_extraction"
FOR EACH ROW EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_extraction_no_truncate ON "source_extraction";
--> statement-breakpoint
CREATE TRIGGER source_extraction_no_truncate
BEFORE TRUNCATE ON "source_extraction"
FOR EACH STATEMENT EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_chunk_no_delete ON "source_chunk";
--> statement-breakpoint
CREATE TRIGGER source_chunk_no_delete
BEFORE DELETE ON "source_chunk"
FOR EACH ROW EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_chunk_no_truncate ON "source_chunk";
--> statement-breakpoint
CREATE TRIGGER source_chunk_no_truncate
BEFORE TRUNCATE ON "source_chunk"
FOR EACH STATEMENT EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reference_artifact_no_delete ON "reference_artifact";
--> statement-breakpoint
CREATE TRIGGER reference_artifact_no_delete
BEFORE DELETE ON "reference_artifact"
FOR EACH ROW EXECUTE FUNCTION source_vault_prevent_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reference_artifact_no_truncate ON "reference_artifact";
--> statement-breakpoint
CREATE TRIGGER reference_artifact_no_truncate
BEFORE TRUNCATE ON "reference_artifact"
FOR EACH STATEMENT EXECUTE FUNCTION source_vault_prevent_delete();

-- source_chunk is fully append-only: no column is ever mutable after insert, so
-- every UPDATE is rejected outright by reusing the generic delete/truncate guard.
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_chunk_no_update ON "source_chunk";
--> statement-breakpoint
CREATE TRIGGER source_chunk_no_update
BEFORE UPDATE ON "source_chunk"
FOR EACH ROW EXECUTE FUNCTION source_vault_prevent_delete();

-- source_document: identity, content, and version-ancestry fields are immutable.
-- Only lifecycle/processing/metadata fields required by later services may change:
-- title, notes, tags, provenance_date, processing_status, ai_processing_status,
-- updated_at/updated_by, archived_at/archived_by, version.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION source_document_guard_update() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.lineage_id IS DISTINCT FROM OLD.lineage_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
    OR NEW.source_type IS DISTINCT FROM OLD.source_type
    OR NEW.document_format IS DISTINCT FROM OLD.document_format
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.duplicate_acknowledged_match_ids IS DISTINCT FROM OLD.duplicate_acknowledged_match_ids
    OR NEW.duplicate_acknowledged_at IS DISTINCT FROM OLD.duplicate_acknowledged_at
    OR NEW.duplicate_acknowledged_by IS DISTINCT FROM OLD.duplicate_acknowledged_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'source_document identity/content/version ancestry is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_document_guard_update ON "source_document";
--> statement-breakpoint
CREATE TRIGGER source_document_guard_update
BEFORE UPDATE ON "source_document"
FOR EACH ROW EXECUTE FUNCTION source_document_guard_update();

-- source_document_file: object identity, hash, and storage version are immutable.
-- Only scan_status/scan_result/scan_signature_version/scanned_at may change.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION source_document_file_guard_update() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.source_document_id IS DISTINCT FROM OLD.source_document_id
    OR NEW.ordinal IS DISTINCT FROM OLD.ordinal
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.original_file_name IS DISTINCT FROM OLD.original_file_name
    OR NEW.download_file_name IS DISTINCT FROM OLD.download_file_name
    OR NEW.format IS DISTINCT FROM OLD.format
    OR NEW.declared_mime_type IS DISTINCT FROM OLD.declared_mime_type
    OR NEW.byte_size IS DISTINCT FROM OLD.byte_size
    OR NEW.sha256 IS DISTINCT FROM OLD.sha256
    OR NEW.object_key IS DISTINCT FROM OLD.object_key
    OR NEW.object_version_id IS DISTINCT FROM OLD.object_version_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'source_document_file identity/hash/storage version is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_document_file_guard_update ON "source_document_file";
--> statement-breakpoint
CREATE TRIGGER source_document_file_guard_update
BEFORE UPDATE ON "source_document_file"
FOR EACH ROW EXECUTE FUNCTION source_document_file_guard_update();

-- source_extraction: once a run reaches a terminal status (succeeded/failed) it is
-- fully frozen so prior successful runs are preserved (no delete-and-reinsert).
-- While non-terminal, only worker-owned processing fields may change; the
-- document/version/creation identity never changes.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION source_extraction_guard_update() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'source_extraction % run % is terminal and immutable', OLD.status, OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.source_document_id IS DISTINCT FROM OLD.source_document_id
    OR NEW.extraction_version IS DISTINCT FROM OLD.extraction_version
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'source_extraction document/version ancestry is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_extraction_guard_update ON "source_extraction";
--> statement-breakpoint
CREATE TRIGGER source_extraction_guard_update
BEFORE UPDATE ON "source_extraction"
FOR EACH ROW EXECUTE FUNCTION source_extraction_guard_update();

-- reference_artifact: attestation fields (and all other identity fields) are
-- immutable once inserted; only the IP review workflow may progress the row.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reference_artifact_guard_update() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.source_document_id IS DISTINCT FROM OLD.source_document_id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.reference_kind IS DISTINCT FROM OLD.reference_kind
    OR NEW.capture_method IS DISTINCT FROM OLD.capture_method
    OR NEW.access_type IS DISTINCT FROM OLD.access_type
    OR NEW.intended_use IS DISTINCT FROM OLD.intended_use
    OR NEW.source_url IS DISTINCT FROM OLD.source_url
    OR NEW.attestation_text IS DISTINCT FROM OLD.attestation_text
    OR NEW.attestation_version IS DISTINCT FROM OLD.attestation_version
    OR NEW.attested_by IS DISTINCT FROM OLD.attested_by
    OR NEW.attested_at IS DISTINCT FROM OLD.attested_at
    OR NEW.audit_event_id IS DISTINCT FROM OLD.audit_event_id
    OR NEW.captured_at IS DISTINCT FROM OLD.captured_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'reference_artifact attestation/identity is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS reference_artifact_guard_update ON "reference_artifact";
--> statement-breakpoint
CREATE TRIGGER reference_artifact_guard_update
BEFORE UPDATE ON "reference_artifact"
FOR EACH ROW EXECUTE FUNCTION reference_artifact_guard_update();
