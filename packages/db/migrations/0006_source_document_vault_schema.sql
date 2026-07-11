CREATE TABLE "reference_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"reference_kind" text NOT NULL,
	"capture_method" text NOT NULL,
	"access_type" text NOT NULL,
	"intended_use" text NOT NULL,
	"source_url" text,
	"ip_review_status" text DEFAULT 'not_reviewed' NOT NULL,
	"ip_review_reason" text,
	"ip_reviewed_by" uuid,
	"ip_reviewed_at" timestamp with time zone,
	"attestation_text" text NOT NULL,
	"attestation_version" text NOT NULL,
	"attested_by" uuid NOT NULL,
	"attested_at" timestamp with time zone NOT NULL,
	"audit_event_id" uuid,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_artifact_attestation_text_check" CHECK (length(btrim("reference_artifact"."attestation_text")) > 0),
	CONSTRAINT "reference_artifact_attestation_version_check" CHECK (length(btrim("reference_artifact"."attestation_version")) > 0),
	CONSTRAINT "reference_artifact_reference_kind_check" CHECK ("reference_kind" in ('url', 'screenshot_set', 'uploaded_export', 'article', 'app_store_listing')),
	CONSTRAINT "reference_artifact_capture_method_check" CHECK ("capture_method" in ('manual_paste', 'user_uploaded_screenshot', 'on_demand_single_page_capture')),
	CONSTRAINT "reference_artifact_access_type_check" CHECK ("access_type" in ('public', 'client_owned', 'permissioned')),
	CONSTRAINT "reference_artifact_intended_use_check" CHECK ("intended_use" in ('inspiration', 'feature_parity', 'differentiation_baseline')),
	CONSTRAINT "reference_artifact_ip_review_status_check" CHECK ("ip_review_status" in ('not_reviewed', 'cleared', 'restricted')),
	CONSTRAINT "reference_artifact_capture_source_url_check" CHECK (("reference_artifact"."capture_method" <> 'on_demand_single_page_capture') or ("reference_artifact"."source_url" is not null))
);
--> statement-breakpoint
CREATE TABLE "source_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"source_extraction_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"content" text NOT NULL,
	"character_count" integer NOT NULL,
	"content_hash" text NOT NULL,
	"locator" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_chunk_sequence_check" CHECK ("source_chunk"."sequence" >= 0),
	CONSTRAINT "source_chunk_character_count_check" CHECK ("source_chunk"."character_count" >= 0),
	CONSTRAINT "source_chunk_content_hash_check" CHECK ("source_chunk"."content_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "source_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"lineage_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"supersedes_id" uuid,
	"source_type" text NOT NULL,
	"document_format" text,
	"title" text NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"provenance_date" timestamp with time zone,
	"content_hash" text NOT NULL,
	"duplicate_acknowledged_match_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"duplicate_acknowledged_at" timestamp with time zone,
	"duplicate_acknowledged_by" uuid,
	"processing_status" text DEFAULT 'verification_pending' NOT NULL,
	"ai_processing_status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "source_document_title_check" CHECK (length(btrim("source_document"."title")) > 0),
	CONSTRAINT "source_document_source_type_check" CHECK ("source_type" in ('document', 'reference', 'manual')),
	CONSTRAINT "source_document_document_format_check" CHECK ("document_format" is null or "document_format" in ('pdf', 'docx', 'txt', 'md', 'xlsx', 'csv', 'pptx', 'png', 'jpg', 'jpeg', 'webp')),
	CONSTRAINT "source_document_document_format_presence_check" CHECK ((("source_document"."source_type" = 'document' and "source_document"."document_format" is not null) or ("source_document"."source_type" <> 'document' and "source_document"."document_format" is null))),
	CONSTRAINT "source_document_processing_status_check" CHECK ("processing_status" in ('verification_pending', 'scan_pending', 'scanning', 'extraction_pending', 'extracting', 'ready', 'quarantined', 'failed')),
	CONSTRAINT "source_document_ai_processing_status_check" CHECK ("ai_processing_status" in ('not_started', 'queued', 'in_progress', 'completed', 'failed')),
	CONSTRAINT "source_document_content_hash_check" CHECK ("source_document"."content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "source_document_version_number_check" CHECK ("source_document"."version_number" > 0),
	CONSTRAINT "source_document_version_check" CHECK ("source_document"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "source_document_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"role" text NOT NULL,
	"original_file_name" text NOT NULL,
	"download_file_name" text NOT NULL,
	"format" text NOT NULL,
	"declared_mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"object_key" text NOT NULL,
	"object_version_id" text NOT NULL,
	"scan_status" text DEFAULT 'not_required' NOT NULL,
	"scan_result" jsonb,
	"scan_signature_version" text,
	"scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_document_file_ordinal_check" CHECK ("source_document_file"."ordinal" >= 0),
	CONSTRAINT "source_document_file_byte_size_check" CHECK ("source_document_file"."byte_size" > 0),
	CONSTRAINT "source_document_file_sha256_check" CHECK ("source_document_file"."sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "source_document_file_format_check" CHECK ("format" in ('pdf', 'docx', 'txt', 'md', 'xlsx', 'csv', 'pptx', 'png', 'jpg', 'jpeg', 'webp')),
	CONSTRAINT "source_document_file_role_check" CHECK ("role" in ('primary', 'attachment', 'snapshot')),
	CONSTRAINT "source_document_file_scan_status_check" CHECK ("scan_status" in ('not_required', 'pending', 'clean', 'infected', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "source_extraction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document_id" uuid NOT NULL,
	"extraction_version" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"parser_manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chunker_version" text NOT NULL,
	"extracted_text_hash" text,
	"preview_object_key" text,
	"preview_object_version_id" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_code" text,
	"failure_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_extraction_version_check" CHECK ("source_extraction"."extraction_version" > 0),
	CONSTRAINT "source_extraction_status_check" CHECK ("status" in ('pending', 'running', 'succeeded', 'failed')),
	CONSTRAINT "source_extraction_extracted_text_hash_check" CHECK ("source_extraction"."extracted_text_hash" is null or "source_extraction"."extracted_text_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "source_upload_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_session_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"role" text NOT NULL,
	"original_file_name" text NOT NULL,
	"normalized_file_name" text NOT NULL,
	"declared_mime_type" text NOT NULL,
	"extension" text NOT NULL,
	"expected_byte_size" bigint NOT NULL,
	"expected_sha256" text NOT NULL,
	"object_key" text NOT NULL,
	"upload_status" text DEFAULT 'pending' NOT NULL,
	"object_store_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_upload_file_ordinal_check" CHECK ("source_upload_file"."ordinal" >= 0),
	CONSTRAINT "source_upload_file_expected_byte_size_check" CHECK ("source_upload_file"."expected_byte_size" > 0),
	CONSTRAINT "source_upload_file_expected_sha256_check" CHECK ("source_upload_file"."expected_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "source_upload_file_role_check" CHECK ("role" in ('primary', 'attachment', 'snapshot')),
	CONSTRAINT "source_upload_file_upload_status_check" CHECK ("upload_status" in ('pending', 'uploaded'))
);
--> statement-breakpoint
CREATE TABLE "source_upload_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"intake_mode" text NOT NULL,
	"metadata_draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"supersedes_id" uuid,
	"expected_content_hash" text NOT NULL,
	"duplicate_match_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"duplicate_acknowledged_at" timestamp with time zone,
	"duplicate_acknowledged_by" uuid,
	"status" text DEFAULT 'created' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_source_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_upload_session_intake_mode_check" CHECK ("intake_mode" in ('file_upload', 'manual_text', 'reference_artifact')),
	CONSTRAINT "source_upload_session_status_check" CHECK ("status" in ('created', 'uploading', 'uploaded', 'confirmed', 'canceled', 'expired')),
	CONSTRAINT "source_upload_session_expected_content_hash_check" CHECK ("source_upload_session"."expected_content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "source_upload_session_idempotency_key_check" CHECK (length(btrim("source_upload_session"."idempotency_key")) > 0)
);
--> statement-breakpoint
ALTER TABLE "reference_artifact" ADD CONSTRAINT "reference_artifact_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_artifact" ADD CONSTRAINT "reference_artifact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_artifact" ADD CONSTRAINT "reference_artifact_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_artifact" ADD CONSTRAINT "reference_artifact_ip_reviewed_by_user_id_fk" FOREIGN KEY ("ip_reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_artifact" ADD CONSTRAINT "reference_artifact_attested_by_user_id_fk" FOREIGN KEY ("attested_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_artifact" ADD CONSTRAINT "reference_artifact_audit_event_id_audit_event_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "public"."audit_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunk" ADD CONSTRAINT "source_chunk_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunk" ADD CONSTRAINT "source_chunk_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunk" ADD CONSTRAINT "source_chunk_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunk" ADD CONSTRAINT "source_chunk_source_extraction_id_source_extraction_id_fk" FOREIGN KEY ("source_extraction_id") REFERENCES "public"."source_extraction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_supersedes_id_source_document_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_duplicate_acknowledged_by_user_id_fk" FOREIGN KEY ("duplicate_acknowledged_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_archived_by_user_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document_file" ADD CONSTRAINT "source_document_file_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_extraction" ADD CONSTRAINT "source_extraction_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_upload_file" ADD CONSTRAINT "source_upload_file_upload_session_id_source_upload_session_id_fk" FOREIGN KEY ("upload_session_id") REFERENCES "public"."source_upload_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_upload_session" ADD CONSTRAINT "source_upload_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_upload_session" ADD CONSTRAINT "source_upload_session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_upload_session" ADD CONSTRAINT "source_upload_session_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_upload_session" ADD CONSTRAINT "source_upload_session_supersedes_id_source_document_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_upload_session" ADD CONSTRAINT "source_upload_session_duplicate_acknowledged_by_user_id_fk" FOREIGN KEY ("duplicate_acknowledged_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_upload_session" ADD CONSTRAINT "source_upload_session_created_source_id_source_document_id_fk" FOREIGN KEY ("created_source_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reference_artifact_source_document_id_uidx" ON "reference_artifact" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "reference_artifact_project_ip_review_status_idx" ON "reference_artifact" USING btree ("project_id","ip_review_status");--> statement-breakpoint
CREATE INDEX "reference_artifact_organization_id_idx" ON "reference_artifact" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "reference_artifact_attested_by_idx" ON "reference_artifact" USING btree ("attested_by");--> statement-breakpoint
CREATE INDEX "reference_artifact_ip_reviewed_by_idx" ON "reference_artifact" USING btree ("ip_reviewed_by");--> statement-breakpoint
CREATE INDEX "reference_artifact_audit_event_id_idx" ON "reference_artifact" USING btree ("audit_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_chunk_extraction_sequence_uidx" ON "source_chunk" USING btree ("source_extraction_id","sequence");--> statement-breakpoint
CREATE INDEX "source_chunk_organization_id_idx" ON "source_chunk" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "source_chunk_project_id_idx" ON "source_chunk" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "source_chunk_source_document_id_idx" ON "source_chunk" USING btree ("source_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_document_lineage_version_uidx" ON "source_document" USING btree ("lineage_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "source_document_supersedes_id_uidx" ON "source_document" USING btree ("supersedes_id") WHERE "source_document"."supersedes_id" is not null;--> statement-breakpoint
CREATE INDEX "source_document_organization_status_idx" ON "source_document" USING btree ("organization_id","processing_status");--> statement-breakpoint
CREATE INDEX "source_document_project_status_idx" ON "source_document" USING btree ("project_id","processing_status","archived_at");--> statement-breakpoint
CREATE INDEX "source_document_project_source_type_idx" ON "source_document" USING btree ("project_id","source_type");--> statement-breakpoint
CREATE INDEX "source_document_project_content_hash_idx" ON "source_document" USING btree ("project_id","content_hash");--> statement-breakpoint
CREATE INDEX "source_document_created_by_idx" ON "source_document" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "source_document_updated_by_idx" ON "source_document" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "source_document_archived_by_idx" ON "source_document" USING btree ("archived_by");--> statement-breakpoint
CREATE INDEX "source_document_duplicate_acknowledged_by_idx" ON "source_document" USING btree ("duplicate_acknowledged_by");--> statement-breakpoint
CREATE INDEX "source_document_title_trgm_idx" ON "source_document" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "source_document_file_document_ordinal_uidx" ON "source_document_file" USING btree ("source_document_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "source_document_file_object_key_uidx" ON "source_document_file" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "source_document_file_scan_status_idx" ON "source_document_file" USING btree ("scan_status");--> statement-breakpoint
CREATE UNIQUE INDEX "source_extraction_document_version_uidx" ON "source_extraction" USING btree ("source_document_id","extraction_version");--> statement-breakpoint
CREATE INDEX "source_extraction_document_status_idx" ON "source_extraction" USING btree ("source_document_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "source_upload_file_session_ordinal_uidx" ON "source_upload_file" USING btree ("upload_session_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "source_upload_file_object_key_uidx" ON "source_upload_file" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "source_upload_session_organization_project_status_idx" ON "source_upload_session" USING btree ("organization_id","project_id","status");--> statement-breakpoint
CREATE INDEX "source_upload_session_project_id_idx" ON "source_upload_session" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "source_upload_session_expires_at_idx" ON "source_upload_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "source_upload_session_actor_status_idx" ON "source_upload_session" USING btree ("actor_id","status");--> statement-breakpoint
CREATE INDEX "source_upload_session_supersedes_id_idx" ON "source_upload_session" USING btree ("supersedes_id");--> statement-breakpoint
CREATE INDEX "source_upload_session_created_source_id_idx" ON "source_upload_session" USING btree ("created_source_id");--> statement-breakpoint
CREATE INDEX "source_upload_session_duplicate_acknowledged_by_idx" ON "source_upload_session" USING btree ("duplicate_acknowledged_by");--> statement-breakpoint
CREATE UNIQUE INDEX "source_upload_session_idempotency_key_uidx" ON "source_upload_session" USING btree ("idempotency_key");