CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"agent" text NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_artifact_versions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"output" jsonb,
	"run_status" text DEFAULT 'planned' NOT NULL,
	"cost" jsonb,
	"reviewed_by" uuid,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_run_agent_check" CHECK (length(btrim("ai_run"."agent")) > 0),
	CONSTRAINT "ai_run_model_check" CHECK (length(btrim("ai_run"."model")) > 0),
	CONSTRAINT "ai_run_provider_check" CHECK (length(btrim("ai_run"."provider")) > 0),
	CONSTRAINT "ai_run_prompt_version_check" CHECK (length(btrim("ai_run"."prompt_version")) > 0),
	CONSTRAINT "ai_run_status_check" CHECK ("run_status" in ('planned', 'running', 'succeeded', 'failed')),
	CONSTRAINT "ai_run_review_status_check" CHECK ("review_status" in ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"project_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"correlation_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_event_action_check" CHECK (length(btrim("audit_event"."action")) > 0),
	CONSTRAINT "audit_event_entity_type_check" CHECK (length(btrim("audit_event"."entity_type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"soft_deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "client_name_check" CHECK (length(btrim("client"."name")) > 0),
	CONSTRAINT "client_status_check" CHECK (length(btrim("client"."status")) > 0),
	CONSTRAINT "client_version_check" CHECK ("client"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"soft_deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "organization_name_check" CHECK (length(btrim("organization"."name")) > 0),
	CONSTRAINT "organization_plan_check" CHECK (length(btrim("organization"."plan")) > 0),
	CONSTRAINT "organization_version_check" CHECK ("organization"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_id" uuid NOT NULL,
	"tech_lead_id" uuid,
	"business_owner_id" uuid,
	"start_date" timestamp with time zone,
	"target_date" timestamp with time zone,
	"current_phase" text DEFAULT 'intake' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"visibility" text DEFAULT 'organization' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"soft_deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "project_name_check" CHECK (length(btrim("project"."name")) > 0),
	CONSTRAINT "project_type_check" CHECK ("type" in ('client', 'internal')),
	CONSTRAINT "project_status_check" CHECK ("status" in ('draft', 'active', 'on_hold', 'completed', 'archived')),
	CONSTRAINT "project_current_phase_check" CHECK ("current_phase" in ('intake', 'requirements', 'clarification', 'baseline', 'architecture', 'delivery', 'handoff', 'closed')),
	CONSTRAINT "project_priority_check" CHECK ("priority" in ('low', 'medium', 'high', 'critical')),
	CONSTRAINT "project_visibility_check" CHECK ("visibility" in ('private', 'organization')),
	CONSTRAINT "project_client_type_check" CHECK ((("project"."type" = 'client' and "project"."client_id" is not null) or ("project"."type" = 'internal' and "project"."client_id" is null))),
	CONSTRAINT "project_version_check" CHECK ("project"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "project_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone,
	"invited_by" uuid,
	"added_at" timestamp with time zone,
	"added_by" uuid,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"soft_deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "project_membership_role_check" CHECK ("role" in ('Admin', 'Project Owner', 'Architect / Tech Lead', 'Business Analyst / Coordinator', 'Developer', 'QA', 'Client Viewer / Approver')),
	CONSTRAINT "project_membership_status_check" CHECK ("status" in ('invited', 'active', 'removed')),
	CONSTRAINT "project_membership_version_check" CHECK ("project_membership"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "traceability_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_type" text NOT NULL,
	"from_id" uuid NOT NULL,
	"to_type" text NOT NULL,
	"to_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "traceability_link_from_type_check" CHECK (length(btrim("traceability_link"."from_type")) > 0),
	CONSTRAINT "traceability_link_to_type_check" CHECK (length(btrim("traceability_link"."to_type")) > 0),
	CONSTRAINT "traceability_link_relation_check" CHECK (length(btrim("traceability_link"."relation")) > 0)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_role" text DEFAULT 'member' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"soft_deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_organization_role_check" CHECK ("organization_role" in ('admin', 'member')),
	CONSTRAINT "user_status_check" CHECK ("status" in ('active', 'suspended', 'archived')),
	CONSTRAINT "user_version_check" CHECK ("user"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_tech_lead_id_user_id_fk" FOREIGN KEY ("tech_lead_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_business_owner_id_user_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traceability_link" ADD CONSTRAINT "traceability_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traceability_link" ADD CONSTRAINT "traceability_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_uidx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "ai_run_organization_created_at_idx" ON "ai_run" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_run_project_status_idx" ON "ai_run" USING btree ("project_id","run_status","review_status");--> statement-breakpoint
CREATE INDEX "ai_run_reviewed_by_idx" ON "ai_run" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "audit_event_organization_at_idx" ON "audit_event" USING btree ("organization_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_event_actor_id_idx" ON "audit_event" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_event_project_at_idx" ON "audit_event" USING btree ("project_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_event_entity_at_idx" ON "audit_event" USING btree ("entity_type","entity_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_event_correlation_id_idx" ON "audit_event" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "client_organization_status_idx" ON "client" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "client_created_by_idx" ON "client" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "client_updated_by_idx" ON "client" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "client_soft_deleted_at_idx" ON "client" USING btree ("soft_deleted_at");--> statement-breakpoint
CREATE INDEX "client_name_trgm_idx" ON "client" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "organization_soft_deleted_at_idx" ON "organization" USING btree ("soft_deleted_at");--> statement-breakpoint
CREATE INDEX "project_organization_status_idx" ON "project" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "project_client_id_idx" ON "project" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "project_owner_id_idx" ON "project" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_tech_lead_id_idx" ON "project" USING btree ("tech_lead_id");--> statement-breakpoint
CREATE INDEX "project_business_owner_id_idx" ON "project" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "project_created_by_idx" ON "project" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "project_updated_by_idx" ON "project" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "project_soft_deleted_at_idx" ON "project" USING btree ("soft_deleted_at");--> statement-breakpoint
CREATE INDEX "project_target_date_idx" ON "project" USING btree ("target_date");--> statement-breakpoint
CREATE INDEX "project_tags_idx" ON "project" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "project_name_trgm_idx" ON "project" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "project_search_idx" ON "project" USING gin (to_tsvector('english', "name" || ' ' || coalesce("description", '')));--> statement-breakpoint
CREATE INDEX "project_membership_organization_id_idx" ON "project_membership" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_membership_project_status_idx" ON "project_membership" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "project_membership_user_status_idx" ON "project_membership" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "project_membership_invited_by_idx" ON "project_membership" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "project_membership_added_by_idx" ON "project_membership" USING btree ("added_by");--> statement-breakpoint
CREATE INDEX "project_membership_created_by_idx" ON "project_membership" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "project_membership_updated_by_idx" ON "project_membership" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "project_membership_soft_deleted_at_idx" ON "project_membership" USING btree ("soft_deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_membership_active_uidx" ON "project_membership" USING btree ("project_id","user_id") WHERE "project_membership"."soft_deleted_at" is null and "project_membership"."status" <> 'removed';--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "traceability_link_from_idx" ON "traceability_link" USING btree ("organization_id","from_type","from_id");--> statement-breakpoint
CREATE INDEX "traceability_link_to_idx" ON "traceability_link" USING btree ("organization_id","to_type","to_id");--> statement-breakpoint
CREATE INDEX "traceability_link_created_by_idx" ON "traceability_link" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "traceability_link_relation_uidx" ON "traceability_link" USING btree ("organization_id","from_type","from_id","to_type","to_id","relation");--> statement-breakpoint
CREATE INDEX "user_organization_status_idx" ON "user" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "user_created_by_idx" ON "user" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "user_updated_by_idx" ON "user" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "user_soft_deleted_at_idx" ON "user" USING btree ("soft_deleted_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "verification" USING btree ("expires_at");