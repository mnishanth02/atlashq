-- Confirmed source lineage/version ancestry guard: enforce the stable lineage/version rules at
-- insert time (module-02 §8.3). The unique (lineage_id, version_number) index and the partial
-- unique supersedes_id index already prevent duplicate versions and forking; this trigger adds
-- the semantic rules those indexes alone cannot express.
CREATE OR REPLACE FUNCTION source_document_lineage_guard() RETURNS trigger AS $$
DECLARE
  predecessor source_document%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version_number <> 1 THEN
      RAISE EXCEPTION 'source_document % root row must start at version_number 1 (got %)',
        NEW.id, NEW.version_number
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.lineage_id <> NEW.id THEN
      RAISE EXCEPTION 'source_document % root row must have lineage_id = id', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  ELSE
    SELECT * INTO predecessor FROM source_document WHERE id = NEW.supersedes_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'source_document % supersedes unknown predecessor %', NEW.id, NEW.supersedes_id
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.organization_id <> predecessor.organization_id
      OR NEW.project_id <> predecessor.project_id
      OR NEW.lineage_id <> predecessor.lineage_id
    THEN
      RAISE EXCEPTION
        'source_document % must share organization_id/project_id/lineage_id with predecessor %',
        NEW.id, NEW.supersedes_id
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.version_number <> predecessor.version_number + 1 THEN
      RAISE EXCEPTION
        'source_document % must be exactly one version after predecessor % (expected %, got %)',
        NEW.id, NEW.supersedes_id, predecessor.version_number + 1, NEW.version_number
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_document_lineage_guard ON "source_document";
--> statement-breakpoint
CREATE TRIGGER source_document_lineage_guard
BEFORE INSERT ON "source_document"
FOR EACH ROW EXECUTE FUNCTION source_document_lineage_guard();

-- source_document: organization/project/creator/duplicate-actor scope consistency. All of these
-- columns are already immutable after insert (source_document_guard_update), so this only needs
-- to run at insert time.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION source_document_scope_guard() RETURNS trigger AS $$
DECLARE
  project_org uuid;
  creator_org uuid;
  duplicate_actor_org uuid;
BEGIN
  SELECT organization_id INTO project_org FROM project WHERE id = NEW.project_id;
  IF project_org IS NULL OR project_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'source_document % project % does not belong to organization %',
      NEW.id, NEW.project_id, NEW.organization_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT organization_id INTO creator_org FROM "user" WHERE id = NEW.created_by;
  IF creator_org IS NULL OR creator_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'source_document % created_by % does not belong to organization %',
      NEW.id, NEW.created_by, NEW.organization_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.duplicate_acknowledged_by IS NOT NULL THEN
    SELECT organization_id INTO duplicate_actor_org
      FROM "user" WHERE id = NEW.duplicate_acknowledged_by;
    IF duplicate_actor_org IS NULL OR duplicate_actor_org <> NEW.organization_id THEN
      RAISE EXCEPTION
        'source_document % duplicate_acknowledged_by % does not belong to organization %',
        NEW.id, NEW.duplicate_acknowledged_by, NEW.organization_id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_document_scope_guard ON "source_document";
--> statement-breakpoint
CREATE TRIGGER source_document_scope_guard
BEFORE INSERT ON "source_document"
FOR EACH ROW EXECUTE FUNCTION source_document_scope_guard();

-- source_upload_session: organization/project/actor scope consistency, plus optional
-- supersedes_id/created_source_id must belong to that same organization/project. Runs on both
-- INSERT and UPDATE because this table has no immutability guard of its own (operational,
-- deletable) and worker/actor updates must never be able to drift it out of tenant scope.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION source_upload_session_scope_guard() RETURNS trigger AS $$
DECLARE
  project_org uuid;
  actor_org uuid;
  supersedes_org uuid;
  supersedes_project uuid;
  created_source_org uuid;
  created_source_project uuid;
BEGIN
  SELECT organization_id INTO project_org FROM project WHERE id = NEW.project_id;
  IF project_org IS NULL OR project_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'source_upload_session % project % does not belong to organization %',
      NEW.id, NEW.project_id, NEW.organization_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT organization_id INTO actor_org FROM "user" WHERE id = NEW.actor_id;
  IF actor_org IS NULL OR actor_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'source_upload_session % actor % does not belong to organization %',
      NEW.id, NEW.actor_id, NEW.organization_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT organization_id, project_id INTO supersedes_org, supersedes_project
      FROM source_document WHERE id = NEW.supersedes_id;
    IF supersedes_org IS NULL
      OR supersedes_org <> NEW.organization_id
      OR supersedes_project <> NEW.project_id
    THEN
      RAISE EXCEPTION
        'source_upload_session % supersedes_id % does not belong to organization %/project %',
        NEW.id, NEW.supersedes_id, NEW.organization_id, NEW.project_id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  IF NEW.created_source_id IS NOT NULL THEN
    SELECT organization_id, project_id INTO created_source_org, created_source_project
      FROM source_document WHERE id = NEW.created_source_id;
    IF created_source_org IS NULL
      OR created_source_org <> NEW.organization_id
      OR created_source_project <> NEW.project_id
    THEN
      RAISE EXCEPTION
        'source_upload_session % created_source_id % does not belong to organization %/project %',
        NEW.id, NEW.created_source_id, NEW.organization_id, NEW.project_id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_upload_session_scope_guard ON "source_upload_session";
--> statement-breakpoint
CREATE TRIGGER source_upload_session_scope_guard
BEFORE INSERT OR UPDATE ON "source_upload_session"
FOR EACH ROW EXECUTE FUNCTION source_upload_session_scope_guard();

-- reference_artifact: organization/project must match its source_document, the source_document
-- must be source_type = 'reference', and attestation/review actors must belong to the
-- organization. Runs on both INSERT and UPDATE because ip_reviewed_by is a legitimately mutable
-- lifecycle field (the rest of the row is already frozen by reference_artifact_guard_update).
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reference_artifact_scope_guard() RETURNS trigger AS $$
DECLARE
  doc_org uuid;
  doc_project uuid;
  doc_source_type text;
  attester_org uuid;
  reviewer_org uuid;
BEGIN
  SELECT organization_id, project_id, source_type INTO doc_org, doc_project, doc_source_type
    FROM source_document WHERE id = NEW.source_document_id;
  IF doc_org IS NULL THEN
    RAISE EXCEPTION 'reference_artifact % references unknown source_document %',
      NEW.id, NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF doc_org <> NEW.organization_id OR doc_project <> NEW.project_id THEN
    RAISE EXCEPTION 'reference_artifact % organization/project must match source_document %',
      NEW.id, NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF doc_source_type <> 'reference' THEN
    RAISE EXCEPTION 'reference_artifact % source_document % must have source_type = ''reference''',
      NEW.id, NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT organization_id INTO attester_org FROM "user" WHERE id = NEW.attested_by;
  IF attester_org IS NULL OR attester_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'reference_artifact % attested_by % does not belong to organization %',
      NEW.id, NEW.attested_by, NEW.organization_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.ip_reviewed_by IS NOT NULL THEN
    SELECT organization_id INTO reviewer_org FROM "user" WHERE id = NEW.ip_reviewed_by;
    IF reviewer_org IS NULL OR reviewer_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'reference_artifact % ip_reviewed_by % does not belong to organization %',
        NEW.id, NEW.ip_reviewed_by, NEW.organization_id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS reference_artifact_scope_guard ON "reference_artifact";
--> statement-breakpoint
CREATE TRIGGER reference_artifact_scope_guard
BEFORE INSERT OR UPDATE ON "reference_artifact"
FOR EACH ROW EXECUTE FUNCTION reference_artifact_scope_guard();

-- source_chunk: organization/project/source_document/source_extraction must all describe the
-- same source/extraction chain. source_chunk has no mutable columns at all (fully append-only),
-- so this only needs to run at insert time.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION source_chunk_scope_guard() RETURNS trigger AS $$
DECLARE
  doc_org uuid;
  doc_project uuid;
  extraction_doc uuid;
BEGIN
  SELECT organization_id, project_id INTO doc_org, doc_project
    FROM source_document WHERE id = NEW.source_document_id;
  IF doc_org IS NULL THEN
    RAISE EXCEPTION 'source_chunk % references unknown source_document %',
      NEW.id, NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF doc_org <> NEW.organization_id OR doc_project <> NEW.project_id THEN
    RAISE EXCEPTION 'source_chunk % organization/project must match source_document %',
      NEW.id, NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT source_document_id INTO extraction_doc
    FROM source_extraction WHERE id = NEW.source_extraction_id;
  IF extraction_doc IS NULL THEN
    RAISE EXCEPTION 'source_chunk % references unknown source_extraction %',
      NEW.id, NEW.source_extraction_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF extraction_doc <> NEW.source_document_id THEN
    RAISE EXCEPTION 'source_chunk % source_extraction % must belong to source_document %',
      NEW.id, NEW.source_extraction_id, NEW.source_document_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS source_chunk_scope_guard ON "source_chunk";
--> statement-breakpoint
CREATE TRIGGER source_chunk_scope_guard
BEFORE INSERT ON "source_chunk"
FOR EACH ROW EXECUTE FUNCTION source_chunk_scope_guard();
