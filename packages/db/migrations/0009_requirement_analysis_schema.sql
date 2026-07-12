CREATE TABLE "citation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"analysis_run_id" uuid NOT NULL,
	"requirement_id" uuid,
	"coverage_matrix_entry_id" uuid,
	"delivery_item_id" uuid,
	"source_document_id" uuid NOT NULL,
	"source_version_number" integer NOT NULL,
	"source_content_hash" text NOT NULL,
	"source_extraction_id" uuid NOT NULL,
	"source_extraction_version" integer NOT NULL,
	"source_chunk_id" uuid NOT NULL,
	"source_chunk_sequence" integer NOT NULL,
	"chunk_content_hash" text NOT NULL,
	"locator" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quote_text_original" text NOT NULL,
	"quote_text_normalized" text NOT NULL,
	"quote_hash" text NOT NULL,
	"match_start_offset" integer NOT NULL,
	"match_end_offset" integer NOT NULL,
	"normalization_mode" text NOT NULL,
	"verification_status" text NOT NULL,
	"created_by_ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "citation_exactly_one_target_check" CHECK (num_nonnulls("citation"."requirement_id", "citation"."coverage_matrix_entry_id", "citation"."delivery_item_id") = 1),
	CONSTRAINT "citation_verification_status_check" CHECK ("verification_status" in ('verified_exact', 'downgraded_fuzzy', 'failed')),
	CONSTRAINT "citation_normalization_mode_check" CHECK (length(btrim("citation"."normalization_mode")) > 0),
	CONSTRAINT "citation_source_content_hash_check" CHECK ("citation"."source_content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "citation_chunk_content_hash_check" CHECK ("citation"."chunk_content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "citation_quote_hash_check" CHECK ("citation"."quote_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "citation_match_offset_check" CHECK ("citation"."match_end_offset" > "citation"."match_start_offset"),
	CONSTRAINT "citation_match_start_offset_check" CHECK ("citation"."match_start_offset" >= 0),
	CONSTRAINT "citation_verified_exact_requires_quote_check" CHECK ("citation"."verification_status" <> 'verified_exact' or length(btrim("citation"."quote_text_original")) > 0)
);
--> statement-breakpoint
CREATE TABLE "coverage_matrix_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"analysis_run_id" uuid NOT NULL,
	"category_key" text NOT NULL,
	"category_label" text NOT NULL,
	"category_order" integer NOT NULL,
	"status" text NOT NULL,
	"rationale" text,
	"evidence_state" text NOT NULL,
	"question_delivery_item_id" uuid,
	"created_by_ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coverage_matrix_entry_category_key_check" CHECK ("category_key" in ('auth_identity', 'roles_permissions', 'data_model_entities', 'integrations', 'notifications', 'reporting_analytics', 'admin', 'error_handling', 'audit_logging', 'nfr_performance_scale_availability', 'security_compliance', 'deployment_environments', 'data_migration', 'i18n_localization', 'accessibility', 'backup_disaster_recovery', 'slas', 'support_model')),
	CONSTRAINT "coverage_matrix_entry_category_label_check" CHECK (length(btrim("coverage_matrix_entry"."category_label")) > 0),
	CONSTRAINT "coverage_matrix_entry_category_order_check" CHECK ("coverage_matrix_entry"."category_order" between 1 and 18),
	CONSTRAINT "coverage_matrix_entry_status_check" CHECK ("status" in ('addressed', 'partial', 'absent')),
	CONSTRAINT "coverage_matrix_entry_evidence_state_check" CHECK ("evidence_state" in ('verified_citation', 'none_found', 'downgraded'))
);
--> statement-breakpoint
CREATE TABLE "delivery_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"analysis_run_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"epistemic_status" text NOT NULL,
	"confidence_band" text,
	"confidence_reason_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"severity" text,
	"priority" text,
	"status" text DEFAULT 'open' NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_requirement_id" uuid,
	"created_by_ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_item_title_check" CHECK (length(btrim("delivery_item"."title")) > 0),
	CONSTRAINT "delivery_item_item_type_check" CHECK ("item_type" in ('question', 'risk', 'assumption', 'dependency', 'blocker', 'scope_change_candidate')),
	CONSTRAINT "delivery_item_epistemic_status_check" CHECK ("epistemic_status" in ('confirmed', 'assumed', 'unknown', 'conflicting')),
	CONSTRAINT "delivery_item_confidence_band_check" CHECK ("confidence_band" is null or "confidence_band" in ('low', 'medium', 'high')),
	CONSTRAINT "delivery_item_severity_check" CHECK ("severity" is null or "severity" in ('low', 'medium', 'high')),
	CONSTRAINT "delivery_item_priority_check" CHECK ("priority" is null or "priority" in ('low', 'medium', 'high')),
	CONSTRAINT "delivery_item_status_check" CHECK ("status" in ('open')),
	CONSTRAINT "delivery_item_visibility_check" CHECK ("visibility" in ('internal')),
	CONSTRAINT "delivery_item_unknown_conflicting_confidence_check" CHECK ("delivery_item"."epistemic_status" not in ('unknown', 'conflicting') or "delivery_item"."confidence_band" is null)
);
--> statement-breakpoint
CREATE TABLE "organization_ai_provider_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"policy_name" text NOT NULL,
	"model_alias" text NOT NULL,
	"resolved_model_id" text NOT NULL,
	"data_retention_mode" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_for_requirement_analysis" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"approval_note" text,
	"provider_terms_snapshot_hash" text,
	"max_usd_per_run" numeric(12, 4) DEFAULT 3 NOT NULL,
	"max_input_tokens_per_run" integer DEFAULT 300000 NOT NULL,
	"max_output_tokens_per_run" integer DEFAULT 30000 NOT NULL,
	"max_wall_clock_seconds" integer DEFAULT 1800 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "organization_ai_provider_policy_provider_check" CHECK (length(btrim("organization_ai_provider_policy"."provider")) > 0),
	CONSTRAINT "organization_ai_provider_policy_policy_name_check" CHECK (length(btrim("organization_ai_provider_policy"."policy_name")) > 0),
	CONSTRAINT "organization_ai_provider_policy_model_alias_check" CHECK (length(btrim("organization_ai_provider_policy"."model_alias")) > 0),
	CONSTRAINT "organization_ai_provider_policy_resolved_model_id_check" CHECK (length(btrim("organization_ai_provider_policy"."resolved_model_id")) > 0),
	CONSTRAINT "organization_ai_provider_policy_data_retention_mode_check" CHECK (length(btrim("organization_ai_provider_policy"."data_retention_mode")) > 0),
	CONSTRAINT "organization_ai_provider_policy_status_check" CHECK ("status" in ('draft', 'approved', 'inactive')),
	CONSTRAINT "organization_ai_provider_policy_approval_fields_check" CHECK (("organization_ai_provider_policy"."status" = 'draft') or ("organization_ai_provider_policy"."approved_by" is not null and "organization_ai_provider_policy"."approved_at" is not null and "organization_ai_provider_policy"."approval_note" is not null)),
	CONSTRAINT "organization_ai_provider_policy_approved_flag_check" CHECK (("organization_ai_provider_policy"."status" = 'approved') = "organization_ai_provider_policy"."approved_for_requirement_analysis"),
	CONSTRAINT "organization_ai_provider_policy_max_usd_check" CHECK ("organization_ai_provider_policy"."max_usd_per_run" > 0),
	CONSTRAINT "organization_ai_provider_policy_max_input_tokens_check" CHECK ("organization_ai_provider_policy"."max_input_tokens_per_run" > 0),
	CONSTRAINT "organization_ai_provider_policy_max_output_tokens_check" CHECK ("organization_ai_provider_policy"."max_output_tokens_per_run" > 0),
	CONSTRAINT "organization_ai_provider_policy_max_wall_clock_check" CHECK ("organization_ai_provider_policy"."max_wall_clock_seconds" > 0),
	CONSTRAINT "organization_ai_provider_policy_version_check" CHECK ("organization_ai_provider_policy"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "requirement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"analysis_run_id" uuid NOT NULL,
	"stable_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"requirement_type" text NOT NULL,
	"priority" text,
	"epistemic_status" text NOT NULL,
	"confidence_band" text,
	"confidence_reason_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"inference_basis" text,
	"origin" text NOT NULL,
	"lifecycle_state" text DEFAULT 'ai_suggested' NOT NULL,
	"dedupe_group_key" text,
	"parent_requirement_id" uuid,
	"source_summary" text,
	"created_by_ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_title_check" CHECK (length(btrim("requirement"."title")) > 0),
	CONSTRAINT "requirement_stable_key_check" CHECK (length(btrim("requirement"."stable_key")) > 0),
	CONSTRAINT "requirement_requirement_type_check" CHECK ("requirement_type" in ('functional', 'non_functional', 'business_rule', 'data', 'integration', 'security', 'compliance', 'operational')),
	CONSTRAINT "requirement_priority_check" CHECK ("priority" is null or "priority" in ('must_have', 'should_have', 'could_have', 'later')),
	CONSTRAINT "requirement_epistemic_status_check" CHECK ("epistemic_status" in ('confirmed', 'assumed', 'unknown', 'conflicting')),
	CONSTRAINT "requirement_confidence_band_check" CHECK ("confidence_band" is null or "confidence_band" in ('low', 'medium', 'high')),
	CONSTRAINT "requirement_origin_check" CHECK ("origin" in ('source', 'reference', 'manual')),
	CONSTRAINT "requirement_lifecycle_state_check" CHECK ("lifecycle_state" in ('ai_suggested')),
	CONSTRAINT "requirement_assumed_inference_basis_check" CHECK ("requirement"."epistemic_status" <> 'assumed' or "requirement"."inference_basis" is not null),
	CONSTRAINT "requirement_unknown_conflicting_confidence_check" CHECK ("requirement"."epistemic_status" not in ('unknown', 'conflicting') or "requirement"."confidence_band" is null)
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"batch_order" integer NOT NULL,
	"source_chunk_start_sequence" integer NOT NULL,
	"source_chunk_end_sequence" integer NOT NULL,
	"input_token_estimate" integer NOT NULL,
	"max_output_tokens" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"ai_run_id" uuid,
	"repair_of_batch_id" uuid,
	"shape_only_repair_used" boolean DEFAULT false NOT NULL,
	"cache_key" text,
	"cache_hit_of_batch_id" uuid,
	"failure_code" text,
	"failure_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_analysis_batch_status_check" CHECK ("status" in ('pending', 'running', 'waiting_retry', 'completed', 'completed_with_warnings', 'failed', 'canceled', 'skipped')),
	CONSTRAINT "requirement_analysis_batch_order_check" CHECK ("requirement_analysis_batch"."batch_order" >= 0),
	CONSTRAINT "requirement_analysis_batch_chunk_sequence_check" CHECK ("requirement_analysis_batch"."source_chunk_end_sequence" >= "requirement_analysis_batch"."source_chunk_start_sequence"),
	CONSTRAINT "requirement_analysis_batch_input_token_estimate_check" CHECK ("requirement_analysis_batch"."input_token_estimate" >= 0),
	CONSTRAINT "requirement_analysis_batch_max_output_tokens_check" CHECK ("requirement_analysis_batch"."max_output_tokens" > 0),
	CONSTRAINT "requirement_analysis_batch_attempt_number_check" CHECK ("requirement_analysis_batch"."attempt_number" >= 1),
	CONSTRAINT "requirement_analysis_batch_failure_fields_check" CHECK (("requirement_analysis_batch"."status" <> 'failed') or ("requirement_analysis_batch"."failure_code" is not null))
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_batch_chunk" (
	"batch_id" uuid NOT NULL,
	"snapshot_chunk_id" uuid NOT NULL,
	"chunk_order" integer NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	CONSTRAINT "requirement_analysis_batch_chunk_batch_id_snapshot_chunk_id_pk" PRIMARY KEY("batch_id","snapshot_chunk_id"),
	CONSTRAINT "requirement_analysis_batch_chunk_order_check" CHECK ("requirement_analysis_batch_chunk"."chunk_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"cancel_requested_at" timestamp with time zone,
	"cancel_requested_by" uuid,
	"cancel_reason" text,
	"source_snapshot_id" uuid,
	"replay_of_run_id" uuid,
	"reprocess_of_run_id" uuid,
	"retry_of_run_id" uuid,
	"provider_policy_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model_alias" text NOT NULL,
	"resolved_model_id" text NOT NULL,
	"provider_data_retention_mode" text NOT NULL,
	"prompt_bundle_version" text NOT NULL,
	"prompt_bundle_hash" text NOT NULL,
	"schema_bundle_version" text NOT NULL,
	"schema_bundle_hash" text NOT NULL,
	"pipeline_version" text NOT NULL,
	"pipeline_hash" text NOT NULL,
	"model_policy_hash" text NOT NULL,
	"max_usd" numeric(12, 4) NOT NULL,
	"max_input_tokens" integer NOT NULL,
	"max_output_tokens" integer NOT NULL,
	"max_wall_clock_seconds" integer NOT NULL,
	"input_tokens_used" integer DEFAULT 0 NOT NULL,
	"output_tokens_used" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 4) DEFAULT 0 NOT NULL,
	"artifact_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"warning_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"failure_code" text,
	"failure_detail" text,
	"failure_retryable" boolean,
	"failed_stage_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"correlation_id" text NOT NULL,
	CONSTRAINT "requirement_analysis_run_mode_check" CHECK ("mode" in ('fresh', 'replay', 'reprocess', 'retry')),
	CONSTRAINT "requirement_analysis_run_status_check" CHECK ("status" in ('requested', 'snapshotting', 'queued', 'running', 'waiting_retry', 'completed', 'completed_with_warnings', 'failed', 'canceled')),
	CONSTRAINT "requirement_analysis_run_resolved_model_id_check" CHECK (length(btrim("requirement_analysis_run"."resolved_model_id")) > 0),
	CONSTRAINT "requirement_analysis_run_correlation_id_check" CHECK (length(btrim("requirement_analysis_run"."correlation_id")) > 0),
	CONSTRAINT "requirement_analysis_run_max_usd_check" CHECK ("requirement_analysis_run"."max_usd" > 0),
	CONSTRAINT "requirement_analysis_run_max_input_tokens_check" CHECK ("requirement_analysis_run"."max_input_tokens" > 0),
	CONSTRAINT "requirement_analysis_run_max_output_tokens_check" CHECK ("requirement_analysis_run"."max_output_tokens" > 0),
	CONSTRAINT "requirement_analysis_run_max_wall_clock_check" CHECK ("requirement_analysis_run"."max_wall_clock_seconds" > 0),
	CONSTRAINT "requirement_analysis_run_input_tokens_used_check" CHECK ("requirement_analysis_run"."input_tokens_used" >= 0),
	CONSTRAINT "requirement_analysis_run_output_tokens_used_check" CHECK ("requirement_analysis_run"."output_tokens_used" >= 0),
	CONSTRAINT "requirement_analysis_run_cost_usd_check" CHECK ("requirement_analysis_run"."cost_usd" >= 0),
	CONSTRAINT "requirement_analysis_run_mode_lineage_check" CHECK (("requirement_analysis_run"."mode" = 'fresh' and "requirement_analysis_run"."replay_of_run_id" is null and "requirement_analysis_run"."reprocess_of_run_id" is null and "requirement_analysis_run"."retry_of_run_id" is null)
        or ("requirement_analysis_run"."mode" = 'replay' and "requirement_analysis_run"."replay_of_run_id" is not null and "requirement_analysis_run"."reprocess_of_run_id" is null and "requirement_analysis_run"."retry_of_run_id" is null)
        or ("requirement_analysis_run"."mode" = 'reprocess' and "requirement_analysis_run"."reprocess_of_run_id" is not null and "requirement_analysis_run"."replay_of_run_id" is null and "requirement_analysis_run"."retry_of_run_id" is null)
        or ("requirement_analysis_run"."mode" = 'retry' and "requirement_analysis_run"."retry_of_run_id" is not null and "requirement_analysis_run"."replay_of_run_id" is null and "requirement_analysis_run"."reprocess_of_run_id" is null)),
	CONSTRAINT "requirement_analysis_run_cancel_fields_check" CHECK (("requirement_analysis_run"."cancel_requested_at" is null and "requirement_analysis_run"."cancel_requested_by" is null) or ("requirement_analysis_run"."cancel_requested_at" is not null and "requirement_analysis_run"."cancel_requested_by" is not null)),
	CONSTRAINT "requirement_analysis_run_failure_fields_check" CHECK (("requirement_analysis_run"."status" <> 'failed') or ("requirement_analysis_run"."failure_code" is not null and "requirement_analysis_run"."failure_retryable" is not null))
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"snapshot_hash" text NOT NULL,
	"source_count" integer NOT NULL,
	"chunk_count" integer NOT NULL,
	"total_character_count" integer NOT NULL,
	"eligibility_rules_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_analysis_snapshot_hash_check" CHECK ("requirement_analysis_snapshot"."snapshot_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "requirement_analysis_snapshot_source_count_check" CHECK ("requirement_analysis_snapshot"."source_count" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_chunk_count_check" CHECK ("requirement_analysis_snapshot"."chunk_count" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_total_character_count_check" CHECK ("requirement_analysis_snapshot"."total_character_count" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_eligibility_rules_version_check" CHECK (length(btrim("requirement_analysis_snapshot"."eligibility_rules_version")) > 0)
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_snapshot_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_source_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_chunk_id" uuid NOT NULL,
	"chunk_sequence" integer NOT NULL,
	"chunk_order" integer NOT NULL,
	"chunk_content_hash" text NOT NULL,
	"locator_hash" text NOT NULL,
	"character_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_analysis_snapshot_chunk_sequence_check" CHECK ("requirement_analysis_snapshot_chunk"."chunk_sequence" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_chunk_order_check" CHECK ("requirement_analysis_snapshot_chunk"."chunk_order" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_chunk_content_hash_check" CHECK ("requirement_analysis_snapshot_chunk"."chunk_content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "requirement_analysis_snapshot_chunk_locator_hash_check" CHECK ("requirement_analysis_snapshot_chunk"."locator_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "requirement_analysis_snapshot_chunk_character_count_check" CHECK ("requirement_analysis_snapshot_chunk"."character_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_snapshot_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_source_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_document_file_id" uuid NOT NULL,
	"file_ordinal" integer NOT NULL,
	"file_sha256" text NOT NULL,
	"object_version_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_analysis_snapshot_file_ordinal_check" CHECK ("requirement_analysis_snapshot_file"."file_ordinal" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_file_sha256_check" CHECK ("requirement_analysis_snapshot_file"."file_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_snapshot_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"source_lineage_id" uuid NOT NULL,
	"source_version_number" integer NOT NULL,
	"source_content_hash" text NOT NULL,
	"source_extraction_id" uuid NOT NULL,
	"source_extraction_version" integer NOT NULL,
	"chunker_version" text NOT NULL,
	"extracted_text_hash" text,
	"reference_artifact_id" uuid,
	"reference_ip_review_status" text,
	"chunk_manifest_hash" text NOT NULL,
	"chunk_sequence_start" integer NOT NULL,
	"chunk_sequence_end" integer NOT NULL,
	"chunk_count" integer NOT NULL,
	"character_count" integer NOT NULL,
	"source_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_analysis_snapshot_source_content_hash_check" CHECK ("requirement_analysis_snapshot_source"."source_content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "requirement_analysis_snapshot_source_extracted_text_hash_check" CHECK ("requirement_analysis_snapshot_source"."extracted_text_hash" is null or "requirement_analysis_snapshot_source"."extracted_text_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "requirement_analysis_snapshot_source_chunk_manifest_hash_check" CHECK ("requirement_analysis_snapshot_source"."chunk_manifest_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "requirement_analysis_snapshot_source_chunk_sequence_check" CHECK ("requirement_analysis_snapshot_source"."chunk_sequence_end" >= "requirement_analysis_snapshot_source"."chunk_sequence_start"),
	CONSTRAINT "requirement_analysis_snapshot_source_chunk_count_check" CHECK ("requirement_analysis_snapshot_source"."chunk_count" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_source_character_count_check" CHECK ("requirement_analysis_snapshot_source"."character_count" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_source_order_check" CHECK ("requirement_analysis_snapshot_source"."source_order" >= 0),
	CONSTRAINT "requirement_analysis_snapshot_source_reference_review_check" CHECK (("requirement_analysis_snapshot_source"."reference_artifact_id" is null) = ("requirement_analysis_snapshot_source"."reference_ip_review_status" is null)),
	CONSTRAINT "requirement_analysis_snapshot_source_reference_cleared_check" CHECK ("requirement_analysis_snapshot_source"."reference_artifact_id" is null or "requirement_analysis_snapshot_source"."reference_ip_review_status" = 'cleared')
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_stage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"input_hash" text,
	"output_hash" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"retry_after" timestamp with time zone,
	"failure_code" text,
	"failure_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_analysis_stage_kind_check" CHECK ("kind" in ('freeze_snapshot', 'batch_planning', 'confirmed_extraction', 'citation_verification', 'reference_feature_extraction', 'normalization_deduplication', 'conflict_detection', 'coverage_analysis', 'delivery_item_extraction', 'question_generation', 'finalize_review_package')),
	CONSTRAINT "requirement_analysis_stage_status_check" CHECK ("status" in ('pending', 'running', 'waiting_retry', 'completed', 'completed_with_warnings', 'failed', 'canceled', 'skipped')),
	CONSTRAINT "requirement_analysis_stage_attempt_number_check" CHECK ("requirement_analysis_stage"."attempt_number" >= 1),
	CONSTRAINT "requirement_analysis_stage_idempotency_key_check" CHECK (length(btrim("requirement_analysis_stage"."idempotency_key")) > 0),
	CONSTRAINT "requirement_analysis_stage_failure_fields_check" CHECK (("requirement_analysis_stage"."status" <> 'failed') or ("requirement_analysis_stage"."failure_code" is not null))
);
--> statement-breakpoint
CREATE TABLE "requirement_analysis_stage_dependency" (
	"stage_id" uuid NOT NULL,
	"depends_on_stage_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	CONSTRAINT "requirement_analysis_stage_dependency_stage_id_depends_on_stage_id_pk" PRIMARY KEY("stage_id","depends_on_stage_id"),
	CONSTRAINT "requirement_analysis_stage_dependency_no_self_check" CHECK ("requirement_analysis_stage_dependency"."stage_id" <> "requirement_analysis_stage_dependency"."depends_on_stage_id")
);
--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_analysis_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_requirement_id_requirement_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirement"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_coverage_matrix_entry_id_coverage_matrix_entry_id_fk" FOREIGN KEY ("coverage_matrix_entry_id") REFERENCES "public"."coverage_matrix_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_delivery_item_id_delivery_item_id_fk" FOREIGN KEY ("delivery_item_id") REFERENCES "public"."delivery_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_source_extraction_id_source_extraction_id_fk" FOREIGN KEY ("source_extraction_id") REFERENCES "public"."source_extraction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_source_chunk_id_source_chunk_id_fk" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."source_chunk"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_created_by_ai_run_id_ai_run_id_fk" FOREIGN KEY ("created_by_ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_matrix_entry" ADD CONSTRAINT "coverage_matrix_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_matrix_entry" ADD CONSTRAINT "coverage_matrix_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_matrix_entry" ADD CONSTRAINT "coverage_matrix_entry_analysis_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_matrix_entry" ADD CONSTRAINT "coverage_matrix_entry_question_delivery_item_id_delivery_item_id_fk" FOREIGN KEY ("question_delivery_item_id") REFERENCES "public"."delivery_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_matrix_entry" ADD CONSTRAINT "coverage_matrix_entry_created_by_ai_run_id_ai_run_id_fk" FOREIGN KEY ("created_by_ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_item" ADD CONSTRAINT "delivery_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_item" ADD CONSTRAINT "delivery_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_item" ADD CONSTRAINT "delivery_item_analysis_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_item" ADD CONSTRAINT "delivery_item_source_requirement_id_requirement_id_fk" FOREIGN KEY ("source_requirement_id") REFERENCES "public"."requirement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_item" ADD CONSTRAINT "delivery_item_created_by_ai_run_id_ai_run_id_fk" FOREIGN KEY ("created_by_ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ai_provider_policy" ADD CONSTRAINT "organization_ai_provider_policy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ai_provider_policy" ADD CONSTRAINT "organization_ai_provider_policy_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ai_provider_policy" ADD CONSTRAINT "organization_ai_provider_policy_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ai_provider_policy" ADD CONSTRAINT "organization_ai_provider_policy_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_analysis_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_parent_requirement_id_requirement_id_fk" FOREIGN KEY ("parent_requirement_id") REFERENCES "public"."requirement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_created_by_ai_run_id_ai_run_id_fk" FOREIGN KEY ("created_by_ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch" ADD CONSTRAINT "requirement_analysis_batch_stage_id_requirement_analysis_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."requirement_analysis_stage"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch" ADD CONSTRAINT "requirement_analysis_batch_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch" ADD CONSTRAINT "requirement_analysis_batch_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch" ADD CONSTRAINT "requirement_analysis_batch_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch" ADD CONSTRAINT "requirement_analysis_batch_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch" ADD CONSTRAINT "requirement_analysis_batch_repair_of_batch_id_requirement_analysis_batch_id_fk" FOREIGN KEY ("repair_of_batch_id") REFERENCES "public"."requirement_analysis_batch"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch" ADD CONSTRAINT "requirement_analysis_batch_cache_hit_of_batch_id_requirement_analysis_batch_id_fk" FOREIGN KEY ("cache_hit_of_batch_id") REFERENCES "public"."requirement_analysis_batch"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch_chunk" ADD CONSTRAINT "requirement_analysis_batch_chunk_batch_id_requirement_analysis_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."requirement_analysis_batch"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch_chunk" ADD CONSTRAINT "requirement_analysis_batch_chunk_snapshot_chunk_id_requirement_analysis_snapshot_chunk_id_fk" FOREIGN KEY ("snapshot_chunk_id") REFERENCES "public"."requirement_analysis_snapshot_chunk"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch_chunk" ADD CONSTRAINT "requirement_analysis_batch_chunk_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_batch_chunk" ADD CONSTRAINT "requirement_analysis_batch_chunk_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_cancel_requested_by_user_id_fk" FOREIGN KEY ("cancel_requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_source_snapshot_id_requirement_analysis_snapshot_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."requirement_analysis_snapshot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_replay_of_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("replay_of_run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_reprocess_of_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("reprocess_of_run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_retry_of_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("retry_of_run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_provider_policy_id_organization_ai_provider_policy_id_fk" FOREIGN KEY ("provider_policy_id") REFERENCES "public"."organization_ai_provider_policy"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_run" ADD CONSTRAINT "requirement_analysis_run_failed_stage_id_requirement_analysis_stage_id_fk" FOREIGN KEY ("failed_stage_id") REFERENCES "public"."requirement_analysis_stage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot" ADD CONSTRAINT "requirement_analysis_snapshot_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot" ADD CONSTRAINT "requirement_analysis_snapshot_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot" ADD CONSTRAINT "requirement_analysis_snapshot_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_chunk" ADD CONSTRAINT "requirement_analysis_snapshot_chunk_snapshot_source_id_requirement_analysis_snapshot_source_id_fk" FOREIGN KEY ("snapshot_source_id") REFERENCES "public"."requirement_analysis_snapshot_source"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_chunk" ADD CONSTRAINT "requirement_analysis_snapshot_chunk_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_chunk" ADD CONSTRAINT "requirement_analysis_snapshot_chunk_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_chunk" ADD CONSTRAINT "requirement_analysis_snapshot_chunk_source_chunk_id_source_chunk_id_fk" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."source_chunk"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_file" ADD CONSTRAINT "requirement_analysis_snapshot_file_snapshot_source_id_requirement_analysis_snapshot_source_id_fk" FOREIGN KEY ("snapshot_source_id") REFERENCES "public"."requirement_analysis_snapshot_source"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_file" ADD CONSTRAINT "requirement_analysis_snapshot_file_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_file" ADD CONSTRAINT "requirement_analysis_snapshot_file_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_file" ADD CONSTRAINT "requirement_analysis_snapshot_file_source_document_file_id_source_document_file_id_fk" FOREIGN KEY ("source_document_file_id") REFERENCES "public"."source_document_file"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_source" ADD CONSTRAINT "requirement_analysis_snapshot_source_snapshot_id_requirement_analysis_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."requirement_analysis_snapshot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_source" ADD CONSTRAINT "requirement_analysis_snapshot_source_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_source" ADD CONSTRAINT "requirement_analysis_snapshot_source_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_source" ADD CONSTRAINT "requirement_analysis_snapshot_source_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_source" ADD CONSTRAINT "requirement_analysis_snapshot_source_source_extraction_id_source_extraction_id_fk" FOREIGN KEY ("source_extraction_id") REFERENCES "public"."source_extraction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_snapshot_source" ADD CONSTRAINT "requirement_analysis_snapshot_source_reference_artifact_id_reference_artifact_id_fk" FOREIGN KEY ("reference_artifact_id") REFERENCES "public"."reference_artifact"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_stage" ADD CONSTRAINT "requirement_analysis_stage_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_stage" ADD CONSTRAINT "requirement_analysis_stage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_stage" ADD CONSTRAINT "requirement_analysis_stage_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_stage_dependency" ADD CONSTRAINT "requirement_analysis_stage_dependency_stage_id_requirement_analysis_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."requirement_analysis_stage"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_stage_dependency" ADD CONSTRAINT "requirement_analysis_stage_dependency_depends_on_stage_id_requirement_analysis_stage_id_fk" FOREIGN KEY ("depends_on_stage_id") REFERENCES "public"."requirement_analysis_stage"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_stage_dependency" ADD CONSTRAINT "requirement_analysis_stage_dependency_run_id_requirement_analysis_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."requirement_analysis_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_stage_dependency" ADD CONSTRAINT "requirement_analysis_stage_dependency_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_analysis_stage_dependency" ADD CONSTRAINT "requirement_analysis_stage_dependency_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "citation_requirement_target_uidx" ON "citation" USING btree ("requirement_id","source_chunk_id","quote_hash","match_start_offset","match_end_offset") WHERE "citation"."requirement_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "citation_coverage_target_uidx" ON "citation" USING btree ("coverage_matrix_entry_id","source_chunk_id","quote_hash","match_start_offset","match_end_offset") WHERE "citation"."coverage_matrix_entry_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "citation_delivery_item_target_uidx" ON "citation" USING btree ("delivery_item_id","source_chunk_id","quote_hash","match_start_offset","match_end_offset") WHERE "citation"."delivery_item_id" is not null;--> statement-breakpoint
CREATE INDEX "citation_analysis_run_id_idx" ON "citation" USING btree ("analysis_run_id");--> statement-breakpoint
CREATE INDEX "citation_organization_id_idx" ON "citation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "citation_project_id_idx" ON "citation" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "citation_source_document_id_idx" ON "citation" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "citation_source_chunk_id_idx" ON "citation" USING btree ("source_chunk_id");--> statement-breakpoint
CREATE INDEX "citation_source_extraction_id_idx" ON "citation" USING btree ("source_extraction_id");--> statement-breakpoint
CREATE INDEX "citation_created_by_ai_run_id_idx" ON "citation" USING btree ("created_by_ai_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coverage_matrix_entry_run_category_uidx" ON "coverage_matrix_entry" USING btree ("analysis_run_id","category_key");--> statement-breakpoint
CREATE INDEX "coverage_matrix_entry_run_order_idx" ON "coverage_matrix_entry" USING btree ("analysis_run_id","category_order");--> statement-breakpoint
CREATE INDEX "coverage_matrix_entry_org_project_idx" ON "coverage_matrix_entry" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "coverage_matrix_entry_project_id_idx" ON "coverage_matrix_entry" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "coverage_matrix_entry_question_delivery_item_id_idx" ON "coverage_matrix_entry" USING btree ("question_delivery_item_id");--> statement-breakpoint
CREATE INDEX "coverage_matrix_entry_created_by_ai_run_id_idx" ON "coverage_matrix_entry" USING btree ("created_by_ai_run_id");--> statement-breakpoint
CREATE INDEX "delivery_item_analysis_run_item_type_idx" ON "delivery_item" USING btree ("analysis_run_id","item_type");--> statement-breakpoint
CREATE INDEX "delivery_item_analysis_run_cursor_idx" ON "delivery_item" USING btree ("analysis_run_id","created_at","id");--> statement-breakpoint
CREATE INDEX "delivery_item_project_id_idx" ON "delivery_item" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "delivery_item_org_id_idx" ON "delivery_item" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "delivery_item_source_requirement_id_idx" ON "delivery_item" USING btree ("source_requirement_id");--> statement-breakpoint
CREATE INDEX "delivery_item_created_by_ai_run_id_idx" ON "delivery_item" USING btree ("created_by_ai_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_ai_provider_policy_org_name_uidx" ON "organization_ai_provider_policy" USING btree ("organization_id","policy_name");--> statement-breakpoint
CREATE INDEX "organization_ai_provider_policy_org_status_idx" ON "organization_ai_provider_policy" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "organization_ai_provider_policy_approved_by_idx" ON "organization_ai_provider_policy" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "organization_ai_provider_policy_created_by_idx" ON "organization_ai_provider_policy" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "organization_ai_provider_policy_updated_by_idx" ON "organization_ai_provider_policy" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_run_stable_key_uidx" ON "requirement" USING btree ("analysis_run_id","stable_key");--> statement-breakpoint
CREATE INDEX "requirement_project_id_idx" ON "requirement" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirement_organization_id_idx" ON "requirement" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_status_idx" ON "requirement" USING btree ("analysis_run_id","epistemic_status");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_type_idx" ON "requirement" USING btree ("analysis_run_id","requirement_type");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_cursor_idx" ON "requirement" USING btree ("analysis_run_id","created_at","id");--> statement-breakpoint
CREATE INDEX "requirement_dedupe_group_key_idx" ON "requirement" USING btree ("dedupe_group_key");--> statement-breakpoint
CREATE INDEX "requirement_parent_requirement_id_idx" ON "requirement" USING btree ("parent_requirement_id");--> statement-breakpoint
CREATE INDEX "requirement_created_by_ai_run_id_idx" ON "requirement" USING btree ("created_by_ai_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_batch_stage_order_attempt_uidx" ON "requirement_analysis_batch" USING btree ("stage_id","batch_order","attempt_number");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_run_id_idx" ON "requirement_analysis_batch" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_org_project_idx" ON "requirement_analysis_batch" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_project_id_idx" ON "requirement_analysis_batch" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_ai_run_id_idx" ON "requirement_analysis_batch" USING btree ("ai_run_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_repair_of_batch_id_idx" ON "requirement_analysis_batch" USING btree ("repair_of_batch_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_cache_hit_of_batch_id_idx" ON "requirement_analysis_batch" USING btree ("cache_hit_of_batch_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_cache_key_idx" ON "requirement_analysis_batch" USING btree ("cache_key");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_batch_chunk_batch_order_uidx" ON "requirement_analysis_batch_chunk" USING btree ("batch_id","chunk_order");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_chunk_snapshot_chunk_id_idx" ON "requirement_analysis_batch_chunk" USING btree ("snapshot_chunk_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_chunk_org_project_idx" ON "requirement_analysis_batch_chunk" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_batch_chunk_project_id_idx" ON "requirement_analysis_batch_chunk" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_run_active_per_project_uidx" ON "requirement_analysis_run" USING btree ("project_id") WHERE "requirement_analysis_run"."status" in ('requested', 'snapshotting', 'queued', 'running', 'waiting_retry');--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_org_status_idx" ON "requirement_analysis_run" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_project_created_at_idx" ON "requirement_analysis_run" USING btree ("project_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_correlation_id_idx" ON "requirement_analysis_run" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_requested_by_idx" ON "requirement_analysis_run" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_cancel_requested_by_idx" ON "requirement_analysis_run" USING btree ("cancel_requested_by");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_source_snapshot_id_idx" ON "requirement_analysis_run" USING btree ("source_snapshot_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_replay_of_run_id_idx" ON "requirement_analysis_run" USING btree ("replay_of_run_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_reprocess_of_run_id_idx" ON "requirement_analysis_run" USING btree ("reprocess_of_run_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_retry_of_run_id_idx" ON "requirement_analysis_run" USING btree ("retry_of_run_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_provider_policy_id_idx" ON "requirement_analysis_run" USING btree ("provider_policy_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_run_failed_stage_id_idx" ON "requirement_analysis_run" USING btree ("failed_stage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_snapshot_run_id_uidx" ON "requirement_analysis_snapshot" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_org_project_idx" ON "requirement_analysis_snapshot" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_project_id_idx" ON "requirement_analysis_snapshot" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_snapshot_chunk_source_chunk_uidx" ON "requirement_analysis_snapshot_chunk" USING btree ("snapshot_source_id","source_chunk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_snapshot_chunk_order_uidx" ON "requirement_analysis_snapshot_chunk" USING btree ("snapshot_source_id","chunk_order");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_chunk_org_project_idx" ON "requirement_analysis_snapshot_chunk" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_chunk_project_id_idx" ON "requirement_analysis_snapshot_chunk" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_chunk_source_chunk_id_idx" ON "requirement_analysis_snapshot_chunk" USING btree ("source_chunk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_snapshot_file_source_ordinal_uidx" ON "requirement_analysis_snapshot_file" USING btree ("snapshot_source_id","file_ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_snapshot_file_source_document_file_uidx" ON "requirement_analysis_snapshot_file" USING btree ("snapshot_source_id","source_document_file_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_file_org_project_idx" ON "requirement_analysis_snapshot_file" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_file_project_id_idx" ON "requirement_analysis_snapshot_file" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_file_source_document_file_id_idx" ON "requirement_analysis_snapshot_file" USING btree ("source_document_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_snapshot_source_snapshot_document_uidx" ON "requirement_analysis_snapshot_source" USING btree ("snapshot_id","source_document_id","source_extraction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_snapshot_source_order_uidx" ON "requirement_analysis_snapshot_source" USING btree ("snapshot_id","source_order");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_source_org_project_document_idx" ON "requirement_analysis_snapshot_source" USING btree ("organization_id","project_id","source_document_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_source_project_id_idx" ON "requirement_analysis_snapshot_source" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_source_document_id_idx" ON "requirement_analysis_snapshot_source" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_source_extraction_id_idx" ON "requirement_analysis_snapshot_source" USING btree ("source_extraction_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_snapshot_source_reference_artifact_id_idx" ON "requirement_analysis_snapshot_source" USING btree ("reference_artifact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_stage_run_kind_attempt_uidx" ON "requirement_analysis_stage" USING btree ("run_id","kind","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_analysis_stage_idempotency_key_uidx" ON "requirement_analysis_stage" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_run_status_idx" ON "requirement_analysis_stage" USING btree ("run_id","status");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_org_project_idx" ON "requirement_analysis_stage" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_project_id_idx" ON "requirement_analysis_stage" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_kind_idx" ON "requirement_analysis_stage" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_dependency_depends_on_stage_id_idx" ON "requirement_analysis_stage_dependency" USING btree ("depends_on_stage_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_dependency_stage_id_idx" ON "requirement_analysis_stage_dependency" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_dependency_run_id_idx" ON "requirement_analysis_stage_dependency" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_dependency_org_project_idx" ON "requirement_analysis_stage_dependency" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "requirement_analysis_stage_dependency_project_id_idx" ON "requirement_analysis_stage_dependency" USING btree ("project_id");