-- Extend the append-only audit guard to statement-level TRUNCATE as well. Any
-- attempt to clear audit_event must fail unless a disposable test harness
-- explicitly and temporarily disables only this trigger around its own cleanup.
DROP TRIGGER IF EXISTS audit_event_no_truncate ON "audit_event";
--> statement-breakpoint
CREATE TRIGGER audit_event_no_truncate
BEFORE TRUNCATE ON "audit_event"
FOR EACH STATEMENT EXECUTE FUNCTION audit_event_prevent_mutation();
