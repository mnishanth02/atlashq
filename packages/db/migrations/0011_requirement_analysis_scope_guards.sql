-- Cross-table scope/DAG-integrity guards for Module 3 (module-03 §9.3, §9.4). These enforce
-- invariants indexes/FKs alone cannot express: same-run/organization/project consistency across
-- the stage DAG, batches, batch chunk membership, and the frozen snapshot chain back to Module 2
-- source/extraction/chunk/reference rows. All guards run BEFORE INSERT because none of these rows
-- have a mutable organization/project/run/snapshot/source identity column after insert.

-- requirement_analysis_stage_dependency: both stages must belong to the same run/organization/
-- project as the dependency edge itself.
CREATE OR REPLACE FUNCTION requirement_analysis_stage_dependency_scope_guard() RETURNS trigger AS $$
DECLARE
  stage_row requirement_analysis_stage%ROWTYPE;
  depends_on_row requirement_analysis_stage%ROWTYPE;
BEGIN
  SELECT * INTO stage_row FROM requirement_analysis_stage WHERE id = NEW.stage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'requirement_analysis_stage_dependency references unknown stage %', NEW.stage_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT * INTO depends_on_row FROM requirement_analysis_stage WHERE id = NEW.depends_on_stage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'requirement_analysis_stage_dependency references unknown stage %',
      NEW.depends_on_stage_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF stage_row.run_id <> NEW.run_id OR depends_on_row.run_id <> NEW.run_id THEN
    RAISE EXCEPTION 'requirement_analysis_stage_dependency % -> % must share run %',
      NEW.stage_id, NEW.depends_on_stage_id, NEW.run_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF stage_row.organization_id <> NEW.organization_id
    OR depends_on_row.organization_id <> NEW.organization_id
    OR stage_row.project_id <> NEW.project_id
    OR depends_on_row.project_id <> NEW.project_id
  THEN
    RAISE EXCEPTION
      'requirement_analysis_stage_dependency % -> % must share organization %/project %',
      NEW.stage_id, NEW.depends_on_stage_id, NEW.organization_id, NEW.project_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_stage_dependency_scope_guard ON "requirement_analysis_stage_dependency";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_stage_dependency_scope_guard
BEFORE INSERT ON "requirement_analysis_stage_dependency"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_stage_dependency_scope_guard();

-- requirement_analysis_batch: its stage must belong to the same run/organization/project as the
-- batch itself.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION requirement_analysis_batch_scope_guard() RETURNS trigger AS $$
DECLARE
  stage_row requirement_analysis_stage%ROWTYPE;
BEGIN
  SELECT * INTO stage_row FROM requirement_analysis_stage WHERE id = NEW.stage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'requirement_analysis_batch % references unknown stage %', NEW.id, NEW.stage_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF stage_row.run_id <> NEW.run_id
    OR stage_row.organization_id <> NEW.organization_id
    OR stage_row.project_id <> NEW.project_id
  THEN
    RAISE EXCEPTION 'requirement_analysis_batch % must share run/organization/project with stage %',
      NEW.id, NEW.stage_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_batch_scope_guard ON "requirement_analysis_batch";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_batch_scope_guard
BEFORE INSERT ON "requirement_analysis_batch"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_batch_scope_guard();

-- requirement_analysis_batch_chunk: organization/project must match both the batch and the
-- snapshot chunk. Run identity is intentionally NOT compared here: replay/reprocess/retry runs
-- reuse the exact prior snapshot (module-03 §8.2), so a batch created under a new run legitimately
-- references requirement_analysis_snapshot_chunk rows frozen under the original run.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION requirement_analysis_batch_chunk_scope_guard() RETURNS trigger AS $$
DECLARE
  batch_org uuid;
  batch_project uuid;
  chunk_org uuid;
  chunk_project uuid;
BEGIN
  SELECT organization_id, project_id INTO batch_org, batch_project
    FROM requirement_analysis_batch WHERE id = NEW.batch_id;
  IF batch_org IS NULL THEN
    RAISE EXCEPTION 'requirement_analysis_batch_chunk references unknown batch %', NEW.batch_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF batch_org <> NEW.organization_id OR batch_project <> NEW.project_id THEN
    RAISE EXCEPTION 'requirement_analysis_batch_chunk organization/project must match batch %',
      NEW.batch_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT organization_id, project_id INTO chunk_org, chunk_project
    FROM requirement_analysis_snapshot_chunk WHERE id = NEW.snapshot_chunk_id;
  IF chunk_org IS NULL THEN
    RAISE EXCEPTION 'requirement_analysis_batch_chunk references unknown snapshot chunk %',
      NEW.snapshot_chunk_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF chunk_org <> NEW.organization_id OR chunk_project <> NEW.project_id THEN
    RAISE EXCEPTION
      'requirement_analysis_batch_chunk organization/project must match snapshot chunk %',
      NEW.snapshot_chunk_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_batch_chunk_scope_guard ON "requirement_analysis_batch_chunk";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_batch_chunk_scope_guard
BEFORE INSERT ON "requirement_analysis_batch_chunk"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_batch_chunk_scope_guard();

-- requirement_analysis_snapshot_source: organization/project must match the snapshot header and
-- the frozen source_document; the frozen source_extraction must belong to that same source
-- document; an optional reference_artifact must belong to that same source document and
-- organization/project (module-02 §8.7 read-only handoff, module-03 §9.3).
--> statement-breakpoint
CREATE OR REPLACE FUNCTION requirement_analysis_snapshot_source_scope_guard() RETURNS trigger AS $$
DECLARE
  snapshot_org uuid;
  snapshot_project uuid;
  doc_org uuid;
  doc_project uuid;
  extraction_doc uuid;
  reference_doc uuid;
BEGIN
  SELECT organization_id, project_id INTO snapshot_org, snapshot_project
    FROM requirement_analysis_snapshot WHERE id = NEW.snapshot_id;
  IF snapshot_org IS NULL THEN
    RAISE EXCEPTION 'requirement_analysis_snapshot_source references unknown snapshot %',
      NEW.snapshot_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF snapshot_org <> NEW.organization_id OR snapshot_project <> NEW.project_id THEN
    RAISE EXCEPTION
      'requirement_analysis_snapshot_source organization/project must match snapshot %',
      NEW.snapshot_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT organization_id, project_id INTO doc_org, doc_project
    FROM source_document WHERE id = NEW.source_document_id;
  IF doc_org IS NULL THEN
    RAISE EXCEPTION 'requirement_analysis_snapshot_source references unknown source_document %',
      NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF doc_org <> NEW.organization_id OR doc_project <> NEW.project_id THEN
    RAISE EXCEPTION
      'requirement_analysis_snapshot_source organization/project must match source_document %',
      NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT source_document_id INTO extraction_doc
    FROM source_extraction WHERE id = NEW.source_extraction_id;
  IF extraction_doc IS NULL OR extraction_doc <> NEW.source_document_id THEN
    RAISE EXCEPTION
      'requirement_analysis_snapshot_source source_extraction % must belong to source_document %',
      NEW.source_extraction_id, NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.reference_artifact_id IS NOT NULL THEN
    SELECT source_document_id INTO reference_doc
      FROM reference_artifact WHERE id = NEW.reference_artifact_id;
    IF reference_doc IS NULL OR reference_doc <> NEW.source_document_id THEN
      RAISE EXCEPTION
        'requirement_analysis_snapshot_source reference_artifact % must belong to source_document %',
        NEW.reference_artifact_id, NEW.source_document_id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_source_scope_guard ON "requirement_analysis_snapshot_source";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_source_scope_guard
BEFORE INSERT ON "requirement_analysis_snapshot_source"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_snapshot_source_scope_guard();

-- requirement_analysis_snapshot_file: organization/project must match the parent snapshot source,
-- and the frozen source_document_file must belong to that snapshot source's source_document.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION requirement_analysis_snapshot_file_scope_guard() RETURNS trigger AS $$
DECLARE
  source_org uuid;
  source_project uuid;
  source_document uuid;
  file_document uuid;
BEGIN
  SELECT organization_id, project_id, source_document_id
    INTO source_org, source_project, source_document
    FROM requirement_analysis_snapshot_source WHERE id = NEW.snapshot_source_id;
  IF source_org IS NULL THEN
    RAISE EXCEPTION 'requirement_analysis_snapshot_file references unknown snapshot source %',
      NEW.snapshot_source_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF source_org <> NEW.organization_id OR source_project <> NEW.project_id THEN
    RAISE EXCEPTION
      'requirement_analysis_snapshot_file organization/project must match snapshot source %',
      NEW.snapshot_source_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT source_document_id INTO file_document
    FROM source_document_file WHERE id = NEW.source_document_file_id;
  IF file_document IS NULL OR file_document <> source_document THEN
    RAISE EXCEPTION
      'requirement_analysis_snapshot_file source_document_file % must belong to snapshot source %''s source_document',
      NEW.source_document_file_id, NEW.snapshot_source_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_file_scope_guard ON "requirement_analysis_snapshot_file";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_file_scope_guard
BEFORE INSERT ON "requirement_analysis_snapshot_file"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_snapshot_file_scope_guard();

-- requirement_analysis_snapshot_chunk: organization/project must match the parent snapshot source,
-- and the frozen source_chunk must belong to that snapshot source's source_document/
-- source_extraction chain.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION requirement_analysis_snapshot_chunk_scope_guard() RETURNS trigger AS $$
DECLARE
  source_org uuid;
  source_project uuid;
  source_document uuid;
  source_extraction uuid;
  chunk_document uuid;
  chunk_extraction uuid;
BEGIN
  SELECT organization_id, project_id, source_document_id, source_extraction_id
    INTO source_org, source_project, source_document, source_extraction
    FROM requirement_analysis_snapshot_source WHERE id = NEW.snapshot_source_id;
  IF source_org IS NULL THEN
    RAISE EXCEPTION 'requirement_analysis_snapshot_chunk references unknown snapshot source %',
      NEW.snapshot_source_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF source_org <> NEW.organization_id OR source_project <> NEW.project_id THEN
    RAISE EXCEPTION
      'requirement_analysis_snapshot_chunk organization/project must match snapshot source %',
      NEW.snapshot_source_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT source_document_id, source_extraction_id INTO chunk_document, chunk_extraction
    FROM source_chunk WHERE id = NEW.source_chunk_id;
  IF chunk_document IS NULL THEN
    RAISE EXCEPTION 'requirement_analysis_snapshot_chunk references unknown source_chunk %',
      NEW.source_chunk_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF chunk_document <> source_document OR chunk_extraction <> source_extraction THEN
    RAISE EXCEPTION
      'requirement_analysis_snapshot_chunk source_chunk % must belong to snapshot source %''s source_document/source_extraction',
      NEW.source_chunk_id, NEW.snapshot_source_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_snapshot_chunk_scope_guard ON "requirement_analysis_snapshot_chunk";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_snapshot_chunk_scope_guard
BEFORE INSERT ON "requirement_analysis_snapshot_chunk"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_snapshot_chunk_scope_guard();
