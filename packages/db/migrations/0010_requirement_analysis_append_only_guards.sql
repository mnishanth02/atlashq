-- Frozen snapshot header/source/file/chunk rows and citation rows are fully append-only
-- (module-03 §9.3, §9.6): every column is immutable after insert, so every UPDATE/DELETE/TRUNCATE
-- is rejected outright, mirroring source_vault_prevent_delete/audit_event_prevent_mutation.
CREATE OR REPLACE FUNCTION requirement_analysis_prevent_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_no_update ON "requirement_analysis_snapshot";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_no_update
BEFORE UPDATE ON "requirement_analysis_snapshot"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_no_delete ON "requirement_analysis_snapshot";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_no_delete
BEFORE DELETE ON "requirement_analysis_snapshot"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_no_truncate ON "requirement_analysis_snapshot";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_no_truncate
BEFORE TRUNCATE ON "requirement_analysis_snapshot"
FOR EACH STATEMENT EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_source_no_update ON "requirement_analysis_snapshot_source";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_source_no_update
BEFORE UPDATE ON "requirement_analysis_snapshot_source"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_source_no_delete ON "requirement_analysis_snapshot_source";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_source_no_delete
BEFORE DELETE ON "requirement_analysis_snapshot_source"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_source_no_truncate ON "requirement_analysis_snapshot_source";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_source_no_truncate
BEFORE TRUNCATE ON "requirement_analysis_snapshot_source"
FOR EACH STATEMENT EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_file_no_update ON "requirement_analysis_snapshot_file";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_file_no_update
BEFORE UPDATE ON "requirement_analysis_snapshot_file"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_file_no_delete ON "requirement_analysis_snapshot_file";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_file_no_delete
BEFORE DELETE ON "requirement_analysis_snapshot_file"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_file_no_truncate ON "requirement_analysis_snapshot_file";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_file_no_truncate
BEFORE TRUNCATE ON "requirement_analysis_snapshot_file"
FOR EACH STATEMENT EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_chunk_no_update ON "requirement_analysis_snapshot_chunk";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_chunk_no_update
BEFORE UPDATE ON "requirement_analysis_snapshot_chunk"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_chunk_no_delete ON "requirement_analysis_snapshot_chunk";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_chunk_no_delete
BEFORE DELETE ON "requirement_analysis_snapshot_chunk"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_chunk_no_truncate ON "requirement_analysis_snapshot_chunk";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_chunk_no_truncate
BEFORE TRUNCATE ON "requirement_analysis_snapshot_chunk"
FOR EACH STATEMENT EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS citation_no_update ON "citation";
--> statement-breakpoint
CREATE TRIGGER citation_no_update
BEFORE UPDATE ON "citation"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS citation_no_delete ON "citation";
--> statement-breakpoint
CREATE TRIGGER citation_no_delete
BEFORE DELETE ON "citation"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS citation_no_truncate ON "citation";
--> statement-breakpoint
CREATE TRIGGER citation_no_truncate
BEFORE TRUNCATE ON "citation"
FOR EACH STATEMENT EXECUTE FUNCTION requirement_analysis_prevent_mutation();
