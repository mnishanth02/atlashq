-- Enforce append-only audit_event at the database level: no UPDATE or DELETE is ever
-- permitted, regardless of which application code path or role attempts it.
CREATE OR REPLACE FUNCTION audit_event_prevent_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_event_no_update ON "audit_event";
--> statement-breakpoint
CREATE TRIGGER audit_event_no_update
BEFORE UPDATE ON "audit_event"
FOR EACH ROW EXECUTE FUNCTION audit_event_prevent_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_event_no_delete ON "audit_event";
--> statement-breakpoint
CREATE TRIGGER audit_event_no_delete
BEFORE DELETE ON "audit_event"
FOR EACH ROW EXECUTE FUNCTION audit_event_prevent_mutation();
