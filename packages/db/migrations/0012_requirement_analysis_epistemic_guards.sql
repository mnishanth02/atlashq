-- Epistemic and finalization guards (module-03 §6.1, §8.5, §9.5, §9.7). Two are DEFERRABLE
-- constraint triggers so a single service transaction may insert a requirement/coverage row and
-- its supporting citation(s) in either order, with the invariant checked once at COMMIT. The other
-- two enforce the fixed 18-category coverage rubric at run finalization and freeze coverage rows
-- once their run reaches a terminal status.

-- requirement: every `confirmed` requirement must have at least one same-tenant/project
-- `verified_exact` citation by the time the transaction commits (module-03 §6.1, §9.5). This is
-- the deterministic, non-LLM grounding guarantee -- it cannot be left to application convention.
CREATE OR REPLACE FUNCTION requirement_confirmed_citation_guard() RETURNS trigger AS $$
DECLARE
  verified_citation_count integer;
BEGIN
  IF NEW.epistemic_status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO verified_citation_count
    FROM citation
    WHERE requirement_id = NEW.id
      AND organization_id = NEW.organization_id
      AND project_id = NEW.project_id
      AND verification_status = 'verified_exact';
  IF verified_citation_count = 0 THEN
    RAISE EXCEPTION
      'requirement % is confirmed but has no same-tenant/project verified_exact citation at commit',
      NEW.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_confirmed_citation_guard ON "requirement";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER requirement_confirmed_citation_guard
AFTER INSERT OR UPDATE ON "requirement"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION requirement_confirmed_citation_guard();

-- coverage_matrix_entry: every `addressed` category must have at least one same-tenant/project
-- `verified_exact` citation by commit (module-03 §9.7). `partial`/`absent` question-linkage is
-- enforced later at run finalization instead (question generation is a subsequent stage/
-- transaction, so it cannot be checked at this row's own commit).
--> statement-breakpoint
CREATE OR REPLACE FUNCTION coverage_matrix_entry_addressed_citation_guard() RETURNS trigger AS $$
DECLARE
  verified_citation_count integer;
BEGIN
  IF NEW.status <> 'addressed' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO verified_citation_count
    FROM citation
    WHERE coverage_matrix_entry_id = NEW.id
      AND organization_id = NEW.organization_id
      AND project_id = NEW.project_id
      AND verification_status = 'verified_exact';
  IF verified_citation_count = 0 THEN
    RAISE EXCEPTION
      'coverage_matrix_entry % is addressed but has no same-tenant/project verified_exact citation at commit',
      NEW.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS coverage_matrix_entry_addressed_citation_guard ON "coverage_matrix_entry";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER coverage_matrix_entry_addressed_citation_guard
AFTER INSERT OR UPDATE ON "coverage_matrix_entry"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION coverage_matrix_entry_addressed_citation_guard();

-- requirement_analysis_run: a run may only transition into completed/completed_with_warnings once
-- all exactly-18 fixed rubric categories exist and every partial/absent category has a
-- clarification question linked (module-03 §8.5, §9.7 finalize_review_package invariant).
--> statement-breakpoint
CREATE OR REPLACE FUNCTION requirement_analysis_run_completion_guard() RETURNS trigger AS $$
DECLARE
  category_count integer;
  missing_question_count integer;
BEGIN
  SELECT count(*) INTO category_count
    FROM coverage_matrix_entry WHERE analysis_run_id = NEW.id;
  IF category_count <> 18 THEN
    RAISE EXCEPTION
      'requirement_analysis_run % cannot complete: expected 18 coverage_matrix_entry rows, found %',
      NEW.id, category_count
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT count(*) INTO missing_question_count
    FROM coverage_matrix_entry
    WHERE analysis_run_id = NEW.id
      AND status IN ('partial', 'absent')
      AND question_delivery_item_id IS NULL;
  IF missing_question_count > 0 THEN
    RAISE EXCEPTION
      'requirement_analysis_run % cannot complete: % partial/absent coverage rows are missing a clarification question',
      NEW.id, missing_question_count
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_analysis_run_completion_guard ON "requirement_analysis_run";
--> statement-breakpoint
CREATE TRIGGER requirement_analysis_run_completion_guard
BEFORE UPDATE ON "requirement_analysis_run"
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed', 'completed_with_warnings'))
EXECUTE FUNCTION requirement_analysis_run_completion_guard();

-- coverage_matrix_entry: once its run reaches any terminal status, coverage rows are append-only
-- (module-03 §9.7). Question generation legitimately backfills question_delivery_item_id earlier,
-- while the run is still non-terminal.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION coverage_matrix_entry_terminal_guard() RETURNS trigger AS $$
DECLARE
  run_status text;
BEGIN
  SELECT status INTO run_status
    FROM requirement_analysis_run WHERE id = OLD.analysis_run_id;
  IF run_status IN ('completed', 'completed_with_warnings', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'coverage_matrix_entry % is append-only once run % is terminal (status %)',
      OLD.id, OLD.analysis_run_id, run_status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS coverage_matrix_entry_terminal_guard ON "coverage_matrix_entry";
--> statement-breakpoint
CREATE TRIGGER coverage_matrix_entry_terminal_guard
BEFORE UPDATE ON "coverage_matrix_entry"
FOR EACH ROW EXECUTE FUNCTION coverage_matrix_entry_terminal_guard();

-- requirement, coverage_matrix_entry, and delivery_item are derived truth: Module 3 never hard
-- deletes or truncates them (module-03 hard invariants). UPDATE remains allowed (subject to the
-- guards above) so a later module's review/finalization lifecycle can still transition these rows;
-- reuses the shared requirement_analysis_prevent_mutation() function defined in migration 0010.
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_no_delete ON "requirement";
--> statement-breakpoint
CREATE TRIGGER requirement_no_delete
BEFORE DELETE ON "requirement"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS requirement_no_truncate ON "requirement";
--> statement-breakpoint
CREATE TRIGGER requirement_no_truncate
BEFORE TRUNCATE ON "requirement"
FOR EACH STATEMENT EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS coverage_matrix_entry_no_delete ON "coverage_matrix_entry";
--> statement-breakpoint
CREATE TRIGGER coverage_matrix_entry_no_delete
BEFORE DELETE ON "coverage_matrix_entry"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS coverage_matrix_entry_no_truncate ON "coverage_matrix_entry";
--> statement-breakpoint
CREATE TRIGGER coverage_matrix_entry_no_truncate
BEFORE TRUNCATE ON "coverage_matrix_entry"
FOR EACH STATEMENT EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS delivery_item_no_delete ON "delivery_item";
--> statement-breakpoint
CREATE TRIGGER delivery_item_no_delete
BEFORE DELETE ON "delivery_item"
FOR EACH ROW EXECUTE FUNCTION requirement_analysis_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS delivery_item_no_truncate ON "delivery_item";
--> statement-breakpoint
CREATE TRIGGER delivery_item_no_truncate
BEFORE TRUNCATE ON "delivery_item"
FOR EACH STATEMENT EXECUTE FUNCTION requirement_analysis_prevent_mutation();
