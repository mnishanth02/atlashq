---
title: "Module 3 Implementation Plan: AI Requirement Analyzer"
module: 3
status: "Implemented - integration hardening underway"
source_docs:
  - "docs\\core\\core-plan.md"
  - "docs\\architecture\\v1-architecture-and-tech-stack.md"
  - "docs\\impl-plan\\00-project-repository-setup.md"
  - "docs\\impl-plan\\module-01-project-workspace.md"
  - "docs\\impl-plan\\module-02-source-document-vault.md"
  - "apps\\web\\DESIGN.md"
  - "apps\\web\\PRODUCT.md"
owner_use: "Product, BA, architecture, engineering, QA, security, and implementation planning for AtlasHQ V1 Module 3"
last_updated: "2026-07-11"
---

# Module 3: AI Requirement Analyzer

> **Planning note (2026-07-11).** Module 1 and the Source Document Vault are treated as landed
> foundations. This plan does not rebuild authentication, tenancy, project authorization, audit,
> traceability, source intake, extraction, chunking, typed API generation, or the Cartographer design
> system. Module 3 consumes those foundations and implements the analyzer only: source eligibility
> preview, explicit analysis runs, frozen source snapshots, specialized AI/deterministic stages,
> normalized AI-suggested artifacts, fixed-rubric coverage, and read-only evidence inspection.
> Requirement review/accept/edit/reject/bulk lifecycle is reserved for Module 4.
>
> **Review note.** Claude Opus 4.8 completed the final architecture/specification review. This
> revision closes the resulting confidence-rubric, stage-DAG, reference-isolation, shared
> delivery-item vocabulary, sampling, API, queue, snapshot, retry, and cache clarifications.

## Current implementation baseline

### Already complete - verify and consume, do not rebuild

- **Implementation-plan conventions:** plans must preserve the V1 lightweight scope and reconcile the
  live baseline rather than restating obsolete scaffolding work
  (`docs\impl-plan\README.md:1-23`).
- **Module 1 foundation:** workspace, roles, auth, audit, traceability, API contract generation, and
  web shell foundations are landed and are explicitly consumed by Module 2
  (`docs\impl-plan\module-02-source-document-vault.md:29-45`).
- **Module 2 Source Vault:** source tables, permissions, storage/scan clients, API surface, worker
  handlers, and web routes are present (`docs\impl-plan\module-02-source-document-vault.md:46-58`).
- **Read-only Module 3 handoff:** Module 2 already defines eligible current ready sources, IP-cleared
  references, exact evidence fields, `ai_run.input_artifact_versions`, cursor ordering, and a hard
  "never mutate Module 2 evidence" rule (`docs\impl-plan\module-02-source-document-vault.md:1312-1379`).
- **AI provenance table exists:** `ai_run` stores organization/project, agent, model, provider,
  prompt version, input artifact versions, JSON output snapshot, run status, cost, review status, and
  timestamps (`packages\db\src\schema.ts:590-625`). Module 3 must extend provenance around it; it
  must not make `ai_run.output` the system of record.
- **Source/extraction/chunk tables exist:** `source_document` records lineage/version/hash/processing
  state (`packages\db\src\schema.ts:762-840`), while `source_extraction` and `source_chunk` carry
  deterministic extraction versions, chunk order, content hash, locator, and project/tenant scope
  (`packages\db\src\schema.ts:907-975`).
- **Worker document-processing pipeline exists:** `packages\jobs` defines queue names including
  `document-processing`, `ai-analysis`, and `citation-verification`, plus the Module 2 discriminated
  document-processing payload (`packages\jobs\src\index.ts:4-13`, `packages\jobs\src\index.ts:80-101`).
  `apps\worker` dispatches `verify-and-scan`, `extract`, `generate-preview`, `capture-reference`,
  and `expire-upload-session` handlers (`apps\worker\src\handlers\dispatch.ts:17-37`).
- **RBAC source of truth exists:** `ProjectPermission` already includes `requirements:review`,
  `sources:read`, and `sources:write`; `project:read` and `sources:read` are the only non-mutating
  permissions (`packages\types\src\index.ts:45-108`).
- **API and web Source Vault handoff points exist:** source-document routes use authenticated
  project authorization and `sources:*` permissions (`apps\api\src\features\source-documents\source-documents.controller.ts:1-140`),
  and the web app already has source list/detail/intake routes plus bounded TanStack Query polling
  (`apps\web\src\router.tsx:93-106`, `apps\web\src\features\source-documents\sources-hooks.ts:160-175`).
- **Cartographer UI vocabulary exists:** the design system exposes `EpistemicBadge`,
  `ConfidenceMeter`, `CitationChip`/`EvidencePopover`, `ProvenanceTag`, and `TraceabilityChain` as
  product vocabulary (`apps\web\PRODUCT.md:20-36`, `apps\web\DESIGN.md:179-250`).
- **Quality gates exist:** root and CI scripts cover lint, format, typecheck, test, build, OpenAPI,
  generated API client, DB migrations, Docker, API/worker integration, web component tests, and E2E
  (`package.json:6-26`, `.github\workflows\ci.yml:1-153`).

### Placeholders and Module 3 gaps - this is the implementation scope

- **`packages\ai` is a placeholder:** it has no AI SDK dependency and only exposes provider/run
  planning helpers (`packages\ai\package.json:24-30`, `packages\ai\src\index.ts:13-24`,
  `packages\ai\src\index.ts:109-121`). Module 3 must add the real Vercel AI SDK wrapper.
- **AI queues are generic placeholders:** `ai-analysis` currently accepts only the base payload plus
  optional `aiRunId` (`packages\jobs\src\index.ts:95-101`). Module 3 must define analysis-run,
  stage, batch, citation-verification, replay/reprocess, and cancellation payloads.
- **No normalized Module 3 artifact schema exists:** current DB has `ai_run`, source/extraction/chunk,
  audit, and traceability, but no first-class `requirement`, `citation`, `coverage_matrix_entry`,
  `delivery_item`, analysis-run snapshot/stage/batch tables, provider-policy approval tables, or eval
  harness tables (`packages\db\src\schema.ts:590-625`, `packages\db\src\schema.ts:762-975`).
- **Current docs still contain older AI SDK wording:** architecture lines mention `generateObject`
  (`docs\architecture\v1-architecture-and-tech-stack.md:595-608`). Module 3 must implement the
  current AI SDK server API via `generateText` with `Output.object({ schema })` inside `packages\ai`,
  not leak provider details into domain code.
- **Reference feature extraction must remain off:** Module 2 stores references and IP review state,
  but Module 3 must not process reference artifacts until legal/IP approval and adversarial tests pass.

## 1. Purpose

Module 3 converts immutable project evidence into structured, cited, reviewable delivery
intelligence. It produces AI-suggested requirements, citations, coverage entries, and delivery items
for risks, assumptions, dependencies, conflicts, clarification questions, potential scope creep, and
out-of-scope candidates.

The analyzer is the heart of V1, but it remains advisory. It creates normalized suggestions and
evidence packages; it does not accept, reject, approve, edit, baseline, or mutate source evidence.

## 2. User outcomes

By the end of Module 3:

- Authorized internal users can preview eligible source evidence before launching analysis.
- AI analysis is safe-disabled until the organization has explicitly approved a provider/model and
  data-retention mode.
- A user with `requirements:analyze` can start an analysis run with conservative cost/token/time
  budgets and a single configured provider/model policy.
- Users can watch run progress through polling, cancel future work, and inspect stage/batch status.
- Every model call is reproducible through concrete prompt/schema/pipeline/model-policy hashes,
  resolved model ID, source snapshot tuple, usage, cost, and provider attempt metadata.
- CONFIRMED requirements are persisted only when a deterministic non-LLM verifier proves an exact
  quote citation exists in the frozen source chunk.
- ASSUMED items include inference basis. UNKNOWN coverage/questions are explicit. CONFLICTING items
  cite contradictory source spans and wait for Module 4 human resolution.
- Coverage is presented as the fixed 18-category addressed/partial/absent rubric, not an exhaustive
  promise that all possible gaps were found.
- Reviewers can read normalized suggestions, coverage, delivery items, citations, and evidence in
  read-only form before Module 4 supplies review mutations.

## 3. Module boundary

### In scope

- Organization/provider approval gate and safe-disabled default.
- Eligible-source preview for the active project.
- Explicit run creation, listing, detail, cancel, retry, replay, reprocess, and fresh-analysis modes.
- One active run per project and three active runs per organization.
- Frozen source snapshot and chunk manifest for each run.
- Specialized worker stages:
  1. freeze snapshot,
  2. batch planning,
  3. confirmed extraction,
  4. citation verification,
  5. normalization/deduplication,
  6. conflict detection,
  7. coverage/gaps,
  8. assumptions/dependencies/risks/scope/out-of-scope,
  9. clarification-question generation,
  10. finalize review package.
- Normalized first-class rows for requirements, citations, coverage matrix entries, and delivery
  items.
- Minimal read-only result/evidence UI, including source/citation popovers and run progress.
- Prompt assets checked in and versioned.
- Deterministic citation verifier, confidence-band computation, budget enforcement, and eval harness.
- Audit, traceability links, stable error codes, observability, and runbook.

### Out of scope

- Accept/edit/reject/approve requirement lifecycle.
- Bulk-review board, redline editing, acceptance criteria authoring, and baseline generation.
- Client clarification exports and answer ingestion.
- Architecture graph generation or review.
- Handoff generation.
- Semantic retrieval, embeddings, pgvector, automated reference feature extraction by default, or any
  model tool/function call with side effects.
- SSE/WebSocket progress. Module 3 uses polling.
- Any mutation of Module 2 evidence, source processing states, chunks, or reference IP review rows.

## 4. Source anchors

| Area | Anchors | Module 3 implication |
|---|---|---|
| Product principle | `docs\core\core-plan.md:160-195` | AI is advisor, CONFIRMED requires verified citation, confidence is banded, eval is mandatory. |
| Module 3 core | `docs\core\core-plan.md:450-575` | Analyzer is a specialized pipeline; outputs include requirements, assumptions, dependencies, risks, questions, scope creep, out-of-scope, conflicts, and coverage. |
| AI agents and controls | `docs\core\core-plan.md:1280-1558` | Extraction-only CONFIRMED step, deterministic verifier, normalization, ordered DAG, grounding/cost/eval controls. |
| Data model | `docs\core\core-plan.md:1568-1720`, `docs\core\core-plan.md:1869-2040` | Requirements, citations, delivery items, AI runs, and traceability are first-class governance records. |
| Architecture | `docs\architecture\v1-architecture-and-tech-stack.md:550-635` | AI calls go through `packages\ai`; worker owns pipelines; no LLM citation verifier. |
| Module matrix | `docs\architecture\v1-architecture-and-tech-stack.md:697-710` | Module 3 owns coverage/citations UI, BullMQ AI pipeline, `requirement`, `citation`, `ai_run`, `delivery_item`. |
| Eval gates | `docs\architecture\v1-architecture-and-tech-stack.md:874-885` | Valid quotes, unsupported-claim detection, coverage categories, and question linkage are required checks. |
| Guardrails | `docs\architecture\v1-architecture-and-tech-stack.md:1031-1042` | No auto-approval, no model confidence decimals, deterministic citation matching, no vector search. |
| Source handoff | `docs\impl-plan\module-02-source-document-vault.md:1312-1379` | Read-only eligible sources and exact source/extraction/chunk tuple must be frozen. |
| UI vocabulary | `apps\web\PRODUCT.md:20-36`, `apps\web\DESIGN.md:179-250` | Reuse epistemic, confidence, citation, provenance, and traceability components. |
| Current polling precedent | `apps\web\src\features\source-documents\sources-hooks.ts:160-175` | Reuse 3-second bounded polling pattern for run progress. |

## 5. Confirmed decisions

| ID | Confirmed decision |
|---|---|
| `M3-DEC-001` | Boundary is Module 3 analyzer only: pipeline, run/source selection/progress, normalized generated artifacts, coverage, and minimal read-only result/evidence inspection. Full Requirement Review Board lifecycle belongs to Module 4. |
| `M3-DEC-002` | Persistence uses normalized first-class rows. AI-suggested requirements/citations/coverage and generic delivery items are system-of-record rows. `ai_run.output` remains a reproducibility snapshot only. |
| `M3-DEC-003` | Each run uses exactly one configured provider/model policy. There is no automatic semantic fallback. Retry/reprocess with a different policy is an explicit new attempt/run and preserves provenance. |
| `M3-DEC-004` | AI analysis is disabled until the organization explicitly approves a provider/model/data-retention mode. Default is safe-disabled. |
| `M3-DEC-005` | Default budgets are conservative and configurable: USD 3/run, 300k input tokens, 30k output tokens, 30-minute wall-clock, one active run per project, and three active runs per organization. |
| `M3-DEC-006` | Gold labels are jointly owned by Product/BA and Architect; Engineering maintains the harness. |
| `M3-DEC-007` | Reference-artifact feature extraction is default off until legal/IP review and adversarial tests pass. While off, references remain visible in eligibility preview with an exclusion reason but are not frozen or batched. |
| `M3-DEC-008` | `delivery_item.item_type` keeps the shared cross-module vocabulary: `question`, `risk`, `assumption`, `dependency`, `blocker`, and `scope_change_candidate`. Module 3 specializations use validated attributes rather than incompatible new type names. |

## 6. Hard invariants

### 6.1 Grounding and epistemic rules

- The analyzer is a pipeline of specialized stages, never one mega-prompt.
- `confirmed`, `assumed`, `unknown`, and `conflicting` are stored/API lowercase enum values, matching
  existing UI vocabulary. UI may render uppercase labels.
- `confirmed` requires at least one verified deterministic quote citation. The verifier is code, not
  an LLM.
- `assumed` requires an inference basis and may include supporting context, but it is never presented
  as confirmed scope.
- `unknown` generates clarification-question content.
- `conflicting` requires multiple contradictory citations and defers resolution to Module 4.
- Abstention is valid. No silent assumptions.
- Confidence is `low`, `medium`, or `high`, computed deterministically from structured signals.
  `unknown` and `conflicting` have no confidence band.
- Raw model confidence decimals are never stored in domain artifacts or exposed through the API.

#### Deterministic confidence-band rubric

Confidence describes evidence quality and analyzer agreement, not whether the model says it is
confident. Persist `confidence_reason_codes` with every non-null band so the UI and eval harness can
explain the result.

Signals:

- Count of `verified_exact` citations.
- Count of distinct corroborating source documents.
- Evidence-span completeness: full requirement-bearing clause versus ambiguous/fragmentary span.
- Agreement between extraction, normalization, coverage, and conflict stages.
- Coverage status for the item's mapped category.
- Presence of an inference basis and supporting context for `assumed`.

Mapping:

- `high`: `confirmed`, at least two independent source documents with `verified_exact` citations,
  complete evidence spans, no stage disagreement, no conflict, and mapped coverage is `addressed`.
- `medium`: `confirmed` with at least one `verified_exact` citation and no conflict but without
  independent corroboration; or `assumed` with a non-empty inference basis plus at least one verified
  supporting-context citation.
- `low`: `confirmed` with exact citation but incomplete/ambiguous evidence or a non-conflicting stage
  disagreement; or `assumed` with a valid inference basis but no verified supporting-context
  citation.
- `unknown` and `conflicting`: `confidence_band = null`.

The pure band calculator accepts typed reason signals, never a provider logprob, percentage, or
self-reported confidence value. Any conflict changes the epistemic status to `conflicting` instead
of merely lowering the band.

### 6.2 Source and retrieval rules

- Source contract is read-only.
- Eligible evidence is only active project, ready, unarchived, current lineage heads.
- A reference requires both `ip_review_status = 'cleared'` and
  `ai_reference_feature_extraction_enabled = true`. When the flag is off, preview returns the
  reference with exclusion reason `reference_feature_extraction_disabled`; it is not frozen or
  batched.
- Freeze the exact source/extraction/file/chunk version and hash tuple before model calls.
- Never mutate Module 2 evidence.
- No pgvector, embeddings, semantic retrieval, or semantic chunking. Batch deterministically by
  source order, extraction version, and chunk sequence with model-safe context budgets.
- Source chunks are untrusted evidence, never instructions. Prompts must isolate chunks in structured
  tags and reiterate tenant/project boundaries.
- Reference feature extraction runs in a separate stage/context and never shares a context window with
  confidential-source extraction.

### 6.3 AI SDK and provider rules

- All provider calls go through `packages\ai`.
- Use the current AI SDK server API for structured outputs: `generateText({ output:
  Output.object({ schema }), ... })`. Domain services call AtlasHQ wrappers and never import provider
  adapters directly.
- Pin `ai@^7` and compatible provider adapters in `packages\ai`; do not rely on `latest` because the
  structured-output API differs across AI SDK majors.
- No tools/function calls with side effects are allowed for Module 3 analysis agents.
- Provider retry is only for transient transport/rate-limit/timeout errors against the same resolved
  provider/model policy. There is no automatic provider/model fallback.
- Prompt assets, schemas, and pipeline definitions are checked in and versioned.
- Record prompt hash, schema hash, pipeline hash, model-policy hash, concrete resolved model ID, and
  provider data-handling mode.
- Structured output repair is limited to one shape-only repair. It cannot add facts or quotes.
  Schema or semantic failure after repair is explicit.

### 6.4 Progress, kill switches, and preservation

- Module 3 progress uses bounded polling. No SSE/WebSocket in this module.
- Kill switches stop new analysis requests, new model calls, and new worker jobs while preserving
  read access to existing runs and artifacts.
- Cancel requests are read-preserving: already persisted artifacts remain visible with provenance;
  future batches/stages stop as soon as safe.

## 7. Data handling, provider approval, and budgets

### 7.1 Provider approval model

Add an organization-level provider policy table and API surface before analysis can run:

```text
organization_ai_provider_policy
  id uuid primary key
  organization_id uuid not null
  provider text not null
  policy_name text not null
  model_alias text not null
  resolved_model_id text not null
  data_retention_mode text not null
  status text not null default 'draft'
  approved_for_requirement_analysis boolean not null default false
  approved_by uuid null
  approved_at timestamptz null
  approval_note text null
  provider_terms_snapshot_hash text null
  max_usd_per_run numeric(12, 4) not null default 3.00
  max_input_tokens_per_run integer not null default 300000
  max_output_tokens_per_run integer not null default 30000
  max_wall_clock_seconds integer not null default 1800
  created_at timestamptz not null
```

Rules:

- `status` is `draft`, `approved`, or `inactive`; approval fields are nullable only in `draft`.
- A deferred/check-trigger invariant requires all approval fields and
  `approved_for_requirement_analysis = true` when `status = 'approved'`.
- Safe-disabled default: no approved policy means `AI_PROVIDER_NOT_APPROVED`.
- A run freezes exactly one policy ID and resolved model ID at creation.
- A policy can transition from `approved` to `inactive` for new runs without hiding prior artifacts.
- Provider credentials stay in environment/secret manager. Store only provider/model identifiers and
  approval metadata.
- API and worker logs must redact prompts, quotes, source chunks, signed URLs, credentials, and full
  model outputs by default.
- Organization Admins manage policy metadata through
  `/api/v1/organizations/current/ai-provider-policies`; the API never accepts or returns provider
  credentials.

### 7.2 Default budgets

| Budget | Default | Enforcement |
|---|---:|---|
| Cost | USD 3 per run | Pre-call projected ceiling and post-call actual usage aggregation. |
| Input tokens | 300,000 per run | Batch planner refuses additional model batches. |
| Output tokens | 30,000 per run | Wrapper max-output limits and aggregation. |
| Wall clock | 30 minutes | Run supervisor marks timeout and stops future calls. |
| Project concurrency | 1 active run | Partial unique index on active statuses. |
| Organization concurrency | 3 active runs | Transactional count check plus Redis/BullMQ limiter. |

Statuses considered active: `requested`, `snapshotting`, `queued`, `running`, and `waiting_retry`.

## 8. Functional requirements

### 8.1 Eligible-source preview

API returns a read-only preview of sources that would be frozen:

- Current active project only.
- `source_document.processing_status = 'ready'`.
- `source_document.archived_at is null`.
- Current lineage head only.
- Latest successful `source_extraction`.
- Chunks sorted by `sequence asc, id asc`.
- References included only when `reference_artifact.ip_review_status = 'cleared'`.
- References excluded when `reference_artifact` is `not_reviewed` or `restricted`.
- Cleared references are also excluded with `reference_feature_extraction_disabled` while the
  reference feature flag is off.

Preview includes source ID, title, version, type, format, content hash, extraction ID/version,
chunker version, chunk count, total characters, reference IP status, and exclusion reason.

### 8.2 Run modes

| Mode | User intent | Snapshot | Provider/prompt/schema policy | Output behavior |
|---|---|---|---|---|
| `fresh` | Analyze current ready sources. | Freeze current eligible sources. | Choose one approved policy and current pipeline version. | Creates a new run and new artifacts. |
| `replay` | Re-execute for audit/debug with identical frozen inputs. Provider nondeterminism may still produce different output. | Reuse exact prior snapshot. | Same prompt/schema/pipeline/model policy hashes, resolved model ID, sampling settings, and seed when supported. | Creates a new run linked to original; never overwrites. |
| `reprocess` | Use same snapshot with explicit new version/policy. | Reuse exact prior snapshot. | Explicitly choose new prompt/schema/pipeline/model policy. | Creates new run; preserves provenance and prior outputs. |
| `retry` | Retry a terminal failed run that is explicitly marked retryable. | Reuse exact prior snapshot in a new run linked by `retry_of_run_id`. | Same policy/resolved model ID and version hashes. | Creates a new run; internal transient attempts before terminal failure stay in the original run. |

Any attempt that uses a different provider/model policy is `reprocess`, not retry.

### 8.3 Run state machine

`requirement_analysis_run.status` values:

```text
requested -> snapshotting -> queued -> running -> completed
                                         -> completed_with_warnings
                                         -> failed
                                         -> canceled
running -> waiting_retry -> queued/running
requested/snapshotting/queued/running/waiting_retry -> canceled when cancel_requested_at is honored
```

Rules:

- `completed` means all required stages succeeded and all persisted artifacts passed deterministic
  validation.
- `completed_with_warnings` means required stages completed but optional/read-only outputs were
  omitted, downgraded, or explicitly marked warning.
- `failed` stores stable error code, safe detail, failed stage, and retryability.
- `canceled` preserves snapshot, stage records, completed artifacts, and model-call provenance.
- Terminal runs are immutable except for operational annotation fields such as `read_notices`.

### 8.4 Artifact states

Module 3 creates requirements only with lifecycle state `ai_suggested`.

Allowed Module 3 requirement states:

```text
ai_suggested
```

Module 4 may later add or transition to `under_review`, `accepted`, `needs_clarification`,
`rejected`, `approved`, `changed`, or `deprecated`. Module 3 API must not expose mutations for those
states.

### 8.5 Fixed coverage rubric

The coverage matrix has exactly 18 categories:

1. Auth/identity
2. Roles and permissions
3. Data model and entities
4. Integrations
5. Notifications
6. Reporting/analytics
7. Admin
8. Error handling
9. Audit/logging
10. NFRs: performance, scale, availability
11. Security/compliance
12. Deployment/environments
13. Data migration
14. i18n/localization
15. Accessibility
16. Backup/DR
17. SLAs
18. Support model

Each category status is `addressed`, `partial`, or `absent`. `addressed` requires verified evidence.
`partial` carries verified evidence or an explicit `none_found` marker and requires a generated
question. `absent` carries `none_found` and requires a generated question. The matrix is a bounded
rubric, not an exhaustive gap guarantee.

## 9. Data model and DDL recommendations

### 9.1 New controlled values

Use DB check constraints and shared `@atlashq/types` enums.

```text
requirement_epistemic_status: confirmed | assumed | unknown | conflicting
confidence_band: low | medium | high
analysis_run_status: requested | snapshotting | queued | running | waiting_retry | completed | completed_with_warnings | failed | canceled
analysis_stage_status: pending | running | waiting_retry | completed | completed_with_warnings | failed | canceled | skipped
analysis_stage_kind:
  freeze_snapshot | batch_planning | confirmed_extraction | citation_verification |
  reference_feature_extraction | normalization_deduplication | conflict_detection | coverage_analysis |
  delivery_item_extraction | question_generation | finalize_review_package
coverage_status: addressed | partial | absent
requirement_lifecycle_state: ai_suggested
delivery_item_type: question | risk | assumption | dependency | blocker | scope_change_candidate
analysis_artifact_origin: source | reference | manual
```

`unknown` and `conflicting` rows must enforce `confidence_band is null`.

### 9.2 `requirement_analysis_run`

Top-level user-visible run.

Key fields:

- `id`
- `organization_id`
- `project_id`
- `requested_by`
- `mode`: `fresh`, `replay`, `reprocess`, `retry`
- `status`
- `cancel_requested_at`, `cancel_requested_by`, `cancel_reason`
- `source_snapshot_id`
- `replay_of_run_id`, `reprocess_of_run_id`, `retry_of_run_id`
- `provider_policy_id`
- `provider`, `model_alias`, `resolved_model_id`
- `provider_data_retention_mode`
- `prompt_bundle_version`, `prompt_bundle_hash`
- `schema_bundle_version`, `schema_bundle_hash`
- `pipeline_version`, `pipeline_hash`
- `model_policy_hash`
- `max_usd`, `max_input_tokens`, `max_output_tokens`, `max_wall_clock_seconds`
- `input_tokens_used`, `output_tokens_used`, `cost_usd`
- `artifact_counts` JSONB summary only
- `warning_codes` text array
- `failure_code`, `failure_detail`, `failure_retryable boolean`, `failed_stage_id`
- `started_at`, `completed_at`, `created_at`, `updated_at`
- `correlation_id`

Constraints/indexes:

- Check status and mode values.
- Positive budgets.
- `resolved_model_id` not blank.
- Partial unique index: one active run per project.
- Organization/status index for active run count.
- Project/created_at index for run list.
- Correlation ID index.
- Foreign keys restrict delete from project/user/policy.

### 9.3 `requirement_analysis_snapshot` and sources

Snapshot header:

- `id`, `organization_id`, `project_id`, `run_id`
- `snapshot_hash`
- `source_count`, `chunk_count`, `total_character_count`
- `eligibility_rules_version`
- `created_at`

Snapshot source rows:

- `id`, `snapshot_id`, `organization_id`, `project_id`
- `source_document_id`, `source_lineage_id`, `source_version_number`, `source_content_hash`
- `source_extraction_id`, `source_extraction_version`, `chunker_version`, `extracted_text_hash`
- `reference_artifact_id`, `reference_ip_review_status`
- `chunk_manifest_hash`
- `chunk_sequence_start`, `chunk_sequence_end`, `chunk_count`, `character_count`
- `source_order`

Snapshot file rows:

- `id`, `snapshot_source_id`, `organization_id`, `project_id`
- `source_document_file_id`, `file_ordinal`, `file_sha256`, `object_version_id`
- `created_at`

Snapshot chunk rows:

- `id`, `snapshot_source_id`, `organization_id`, `project_id`
- `source_chunk_id`, `chunk_sequence`, `chunk_order`, `chunk_content_hash`
- `locator_hash`, `character_count`, `created_at`

Constraints/indexes:

- Unique `(snapshot_id, source_document_id, source_extraction_id)`.
- Unique `(snapshot_source_id, file_ordinal)` and `(snapshot_source_id, source_chunk_id)`.
- Index `(organization_id, project_id, source_document_id)`.
- `reference_ip_review_status = 'cleared'` when `reference_artifact_id is not null`.
- References cannot appear in snapshot rows while reference extraction is disabled.
- Snapshot header/source/file/chunk rows are immutable after insert; use append-only guard migration.

### 9.4 Stage and batch records

`requirement_analysis_stage`:

- `id`, `run_id`, `organization_id`, `project_id`
- `kind`, `status`, `attempt_number`
- `idempotency_key`
- `input_hash`, `output_hash`
- `started_at`, `completed_at`, `retry_after`, `failure_code`, `failure_detail`
- `created_at`, `updated_at`

`requirement_analysis_stage_dependency`:

- `stage_id`, `depends_on_stage_id`, `run_id`, `organization_id`, `project_id`
- Composite primary key `(stage_id, depends_on_stage_id)`.
- Foreign keys restrict delete and a constraint trigger verifies both stages belong to the same
  run/organization/project.

`requirement_analysis_batch`:

- `id`, `stage_id`, `run_id`, `organization_id`, `project_id`
- `batch_order`
- `source_chunk_start_sequence`, `source_chunk_end_sequence`
- `input_token_estimate`, `max_output_tokens`
- `status`, `attempt_number`
- `ai_run_id` nullable for deterministic stages; not null for actual model calls
- `repair_of_batch_id` nullable
- `shape_only_repair_used boolean default false`
- `cache_key` nullable
- `cache_hit_of_batch_id` nullable
- `failure_code`, `failure_detail`
- `created_at`, `updated_at`

`requirement_analysis_batch_chunk`:

- `batch_id`, `snapshot_chunk_id`, `chunk_order`, `organization_id`, `project_id`
- Composite primary key `(batch_id, snapshot_chunk_id)`.
- Unique `(batch_id, chunk_order)` preserves the exact prompt order even when a batch spans sources
  or non-contiguous source sequences.

Rules:

- Deterministic stages have stage records and audit events even when no `ai_run` exists.
- Every actual model call has an `ai_run` row and a batch link.
- Transient retry creates a new attempt record and preserves prior failed attempts.
- Shape-only repair creates at most one repair batch and cannot introduce new facts, quotes, or
  citations.
- Cross-run extraction cache is organization-scoped and applies only to source-local
  `confirmed_extraction` and `reference_feature_extraction` batches. The cache key includes source
  content/extraction/chunker hashes, stage kind, prompt/schema/pipeline/model-policy hashes, and
  sampling settings. Cache hits reuse the prior structured `ai_run.output` snapshot, create new
  run-local artifacts with `cache_hit_of_batch_id`, and always re-run deterministic citation
  verification. Coverage, conflict, deduplication, and question stages are never reused across
  different project source sets.

### 9.5 `requirement`

First-class AI-suggested requirement. Module 3 creates only `lifecycle_state = 'ai_suggested'`.

Key fields:

- `id`, `organization_id`, `project_id`, `analysis_run_id`
- `stable_key` deterministic from normalized title/type/evidence hashes within the run
- `title`, `description`
- `requirement_type`: `functional`, `non_functional`, `business_rule`, `data`, `integration`,
  `security`, `compliance`, `operational`
- `priority`: `must_have`, `should_have`, `could_have`, `later`, nullable when unsupported
- `epistemic_status`
- `confidence_band` nullable
- `confidence_reason_codes` text array
- `inference_basis` nullable
- `origin`: `source`, `reference`, `manual`
- `lifecycle_state` default `ai_suggested`
- `dedupe_group_key`, `parent_requirement_id` nullable
- `source_summary` safe short text
- `created_by_ai_run_id`
- `created_at`, `updated_at`

Constraints/indexes:

- Check lowercase enums.
- A deferrable PostgreSQL constraint trigger,
  `requirement_confirmed_citation_guard`, checks at transaction commit that every `confirmed`
  requirement has at least one same-tenant/project `verified_exact` citation. Service transactions
  insert the requirement and citations atomically; this invariant is not left to application-only
  convention.
- `assumed` requires `inference_basis`.
- `unknown` and `conflicting` require `confidence_band is null`.
- Unique `(analysis_run_id, stable_key)`.
- Index project/run/status/type.
- No Module 3 route updates lifecycle state beyond `ai_suggested`.

### 9.6 `citation`

Immutable citation row for requirements, coverage entries, and delivery items.

Key fields:

- `id`, `organization_id`, `project_id`, `analysis_run_id`
- `requirement_id` nullable FK
- `coverage_matrix_entry_id` nullable FK
- `delivery_item_id` nullable FK
- `source_document_id`, `source_version_number`, `source_content_hash`
- `source_extraction_id`, `source_extraction_version`
- `source_chunk_id`, `source_chunk_sequence`, `chunk_content_hash`
- `locator` JSONB copied from `source_chunk.locator`
- `quote_text_original`
- `quote_text_normalized`
- `quote_hash`
- `match_start_offset`, `match_end_offset`
- `normalization_mode`
- `verification_status`: `verified_exact`, `downgraded_fuzzy`, `failed`
- `created_by_ai_run_id`
- `created_at`

Constraints/indexes:

- Verified citation requires non-empty quote, offsets, source/chunk IDs, and `verification_status =
  'verified_exact'`.
- `num_nonnulls(requirement_id, coverage_matrix_entry_id, delivery_item_id) = 1`.
- `match_end_offset > match_start_offset`.
- Partial unique indexes per target on target ID, source chunk, quote hash, and offsets.
- Index source document/chunk and target lookup.
- Append-only guard: no update/delete/truncate.

### 9.7 `coverage_matrix_entry`

One row per analysis run/category.

Fields:

- `id`, `organization_id`, `project_id`, `analysis_run_id`
- `category_key`, `category_label`, `category_order`
- `status`: `addressed`, `partial`, `absent`
- `rationale`
- `evidence_state`: `verified_citation`, `none_found`, `downgraded`
- `question_delivery_item_id` nullable
- `created_by_ai_run_id`
- `created_at`

Constraints/indexes:

- Unique `(analysis_run_id, category_key)`.
- Exactly 18 rows required before run can complete.
- `partial` and `absent` require a generated clarification question delivery item.
- `addressed` requires at least one verified citation.
- Coverage rows may be inserted before question generation with `question_delivery_item_id = null`.
  Question generation back-fills this one field, and `finalize_review_package` enforces the
  `partial|absent => question` invariant before the run can complete. After terminal finalization,
  coverage rows are append-only.

### 9.8 `delivery_item`

Generic first-class rows for Module 3-generated concerns. Do not create a dedicated review-queue
table; Module 4 can query normalized artifact state and type.

Fields:

- `id`, `organization_id`, `project_id`, `analysis_run_id`
- `item_type`: `question`, `risk`, `assumption`, `dependency`, `blocker`,
  `scope_change_candidate`
- `title`, `description`
- `epistemic_status`
- `confidence_band` nullable
- `confidence_reason_codes` text array
- `severity`: `low`, `medium`, `high`, nullable where not applicable
- `priority`: `low`, `medium`, `high`, nullable
- `status`: `open`
- `visibility`: `internal`
- `attributes` JSONB guarded by per-type Zod schemas
- `source_requirement_id` nullable
- `created_by_ai_run_id`
- `created_at`, `updated_at`

Per-type attributes:

- `risk`: category, probability band, impact band, mitigation prompt, trigger.
- `assumption`: inference basis, validation needed, validation method.
- `dependency`: dependency name, external/internal, blocked area, risk if delayed.
- `blocker` with `attributes.subtype = 'conflict'`: contradiction summary, conflicting citation
  IDs, suggested resolution question.
- `question`: question text, why it matters, suggested response format, impact if
  unanswered, linked coverage/requirement/conflict IDs.
- `scope_change_candidate` with `attributes.classification = 'scope_creep'`: change source,
  baseline impact hypothesis, approval needed.
- `scope_change_candidate` with `attributes.classification = 'out_of_scope'`: exclusion basis and
  supporting quote/none-found rationale.

### 9.9 Traceability links

Create links in the existing generic traceability table:

- source document -> citation (`supports`)
- citation -> requirement (`supports`)
- citation -> delivery item (`supports`)
- coverage entry -> delivery item question (`raises_question`)
- requirement -> delivery item conflict/risk/assumption (`relates_to`)
- analysis run -> requirement/coverage/delivery item (`generated`)

## 10. Citation verification algorithm

Only deterministic verification can produce `confirmed`.

Algorithm:

1. Load frozen chunk content by snapshot tuple; do not re-query mutable "latest" source state.
2. Normalize both chunk content and proposed quote:
   - Unicode NFC.
   - Normalize Unicode whitespace to ASCII space for matching.
   - Normalize smart quotes and smart dashes to canonical quote/dash forms.
   - Preserve case and punctuation for exact normalized matching.
3. Search for an exact contiguous normalized match.
4. If exactly one match is found, store original offsets, original quote, normalized quote, quote
   hash, chunk hash, locator, normalization mode, and `verified_exact`.
5. If multiple matches are found in the same chunk, choose the smallest deterministic offset and
   record `multiple_match_warning`.
6. If no exact match is found, perform bounded fuzzy comparison only to classify/downgrade or aid
   debugging. Fuzzy comparison can never upgrade to confirmed.
7. If a requirement lacks a verified citation, downgrade it to `assumed` when an inference basis is
   valid, to `unknown` when no support exists, or reject the candidate.
8. Persist no `confirmed` requirement until citation rows are committed in the same transaction.

## 11. Worker pipeline

### 11.1 Stage dependency graph

```text
freeze_snapshot
  -> batch_planning
    +-> confirmed_extraction [confidential/non-reference batches only] --------+
    +-> reference_feature_extraction [reference only; flag-gated/skippable] ---+
                                                                              |
                                                                              v
                                                                  citation_verification
                                                                              |
                                                                              v
                                                               normalization_deduplication
                                                                  +-----------+-----------+
                                                                  v           v           v
                                                         conflict_detection coverage_analysis delivery_item_extraction
                                                                  +-----------+-----------+
                                                                              v
                                                                    question_generation
                                                                              |
                                                                              v
                                                                  finalize_review_package
```

`question_generation` depends on completed normalization, conflict, coverage, and delivery-item
branches. `finalize_review_package` fans in every required branch and cannot run while any required
stage is non-terminal.

### 11.2 Stage responsibilities

| Stage | LLM? | Responsibilities | Failure behavior |
|---|---:|---|---|
| `freeze_snapshot` | No | Apply eligibility, lock manifest, write snapshot hash and audit. | No eligible sources => explicit failed/empty result. |
| `batch_planning` | No | Deterministic chunk ordering and token-budget batches. | Budget overflow creates warning and excludes tail batches with reason. |
| `confirmed_extraction` | Yes | Extract only explicitly supported candidates and quoted spans from non-reference evidence. | Schema failure may use one shape-only repair; semantic failures reject batch. |
| `reference_feature_extraction` | Yes | Process only IP-cleared reference batches in isolated prompts/context; skipped while the feature flag is off. | Disabled/uncleared references never enter model context. |
| `citation_verification` | No | Verify quotes and offsets; downgrade/reject unsupported candidates. | Any persisted `confirmed` with unverified citation is impossible. |
| `normalization_deduplication` | Mostly No, optional LLM | Split compounds, merge duplicates, keep all citations. | Deterministic fallback keeps separate requirements with warning. |
| `conflict_detection` | Yes + deterministic post-check | Identify contradictory citations and create conflict items. | Requires at least two citations; otherwise reject conflict. |
| `coverage_analysis` | Yes + deterministic completeness check | Produce 18 coverage entries. | Missing category rows fail the stage. |
| `delivery_item_extraction` | Yes | Risks, assumptions, dependencies, and canonical `scope_change_candidate` rows classified as scope-creep or out-of-scope. | Unsupported items downgraded or rejected. |
| `question_generation` | Yes | After normalization, conflict, coverage, and delivery-item stages complete, generate linked question delivery items for unknown/partial/absent/conflicting findings. | Missing required question linkage fails stage. |
| `finalize_review_package` | No | Fan-in all required branches; back-fill coverage-question links and transactionally compute counts, traceability links, run status, and audit summary. | Partial artifacts remain read-only; run becomes failed or warning. |

### 11.3 AI wrapper behavior

`packages\ai` should expose an application wrapper, for example:

```text
generateStructuredAnalysisStep({
  organizationId,
  projectId,
  runId,
  stageKind,
  batchId,
  providerPolicy,
  promptAsset,
  schema,
  structuredEvidenceBlocks,
  budget,
  idempotencyKey,
})
```

Implementation requirements:

- Internally use `generateText` and `Output.object({ schema })`.
- Use temperature `0` for every Module 3 structured generation stage. Set a seed only when the
  selected provider supports it, record unsupported-setting warnings, and never claim identical
  outputs are guaranteed.
- Disable provider tool/function calls for Module 3.
- Resolve provider/model once from frozen policy.
- Capture response headers/body only as safe metadata; do not log raw body by default.
- Validate output with Zod and semantic validators.
- Compute usage/cost from provider usage metadata.
- Return typed result and a persisted `ai_run` ID.

## 12. API contract

All routes live under `/api/v1/projects/:projectId/requirement-analysis`, use authenticated
project authorization, shared Zod DTOs, stable OpenAPI operation IDs, generated client types, and
the existing API error shape.

### 12.1 Routes

```text
GET    /eligible-sources
GET    /provider-policies
POST   /runs
GET    /runs
GET    /runs/:runId
POST   /runs/:runId/cancel
POST   /runs/:runId/retry
POST   /runs/:runId/replay
POST   /runs/:runId/reprocess
GET    /runs/:runId/stages
GET    /runs/:runId/batches
GET    /runs/:runId/requirements
GET    /runs/:runId/requirements/:requirementId
GET    /runs/:runId/delivery-items
GET    /runs/:runId/delivery-items/:itemId
GET    /runs/:runId/coverage
GET    /runs/:runId/citations
GET    /runs/:runId/evidence/:citationId
GET    /runs/:runId/traceability
```

`POST /runs` creates a `fresh` run with:

```ts
{
  providerPolicyId: string;
  sourceDocumentIds?: string[]; // omitted means all sources eligible under current feature flags
}
```

`retry`, `replay`, and `reprocess` always create a new run linked to the terminal source run.
`retry` is allowed only when the source run is `failed` with `retryable = true`; otherwise return
`AI_RUN_NOT_RETRYABLE`. Automatic transient attempts before terminal failure remain stage/batch
attempts inside the original run. `reprocess` requires explicit replacement version/policy IDs.

No Module 4 mutation routes are exposed.

### 12.2 Permissions

Add two permissions:

```text
requirements:read
requirements:analyze
```

Recommended grants:

| Role | Read analysis | Start/cancel analysis |
|---|---:|---:|
| Admin | Yes | Yes |
| Project Owner | Yes | Yes |
| Architect / Tech Lead | Yes | Yes |
| Business Analyst / Coordinator | Yes | Yes |
| Developer | Yes | No |
| QA | Yes | No |
| Client Viewer / Approver | No | No |

Implementation:

- Reuse `requirements:review` as a Module 4 permission; do not overload it for starting analysis.
- Grant `requirements:read` to Admin, Project Owner, Architect / Tech Lead, Business Analyst /
  Coordinator, Developer, and QA. Do not grant it to Client Viewer / Approver in V1.
- Grant `requirements:analyze` only to Admin, Project Owner, Architect / Tech Lead, and Business
  Analyst / Coordinator.
- `requirements:analyze` is mutating and must be denied on archived projects.
- The service must enforce an explicit archived/inactive-project freeze before snapshot creation;
  the project authorization guard alone is insufficient because organization admins can otherwise
  pass broad project permission checks.

### 12.3 Stable error codes

- `AI_ANALYSIS_DISABLED`
- `AI_PROVIDER_NOT_APPROVED`
- `AI_PROVIDER_POLICY_INACTIVE`
- `AI_PROVIDER_POLICY_MISMATCH`
- `AI_RUN_BUDGET_EXCEEDED`
- `AI_RUN_CONCURRENCY_EXCEEDED`
- `AI_RUN_NOT_CANCELABLE`
- `AI_RUN_NOT_RETRYABLE`
- `AI_RUN_SNAPSHOT_EMPTY`
- `AI_RUN_SOURCE_NOT_ELIGIBLE`
- `AI_RUN_SOURCE_SNAPSHOT_STALE`
- `AI_RUN_SCHEMA_VALIDATION_FAILED`
- `AI_RUN_SEMANTIC_VALIDATION_FAILED`
- `AI_RUN_CITATION_VERIFICATION_FAILED`
- `AI_RUN_PROMPT_INJECTION_GUARD_TRIGGERED`
- `AI_RUN_TRANSIENT_PROVIDER_FAILURE`
- `AI_RUN_PROVIDER_TIMEOUT`
- `AI_RUN_PROVIDER_RATE_LIMITED`
- `AI_RUN_REFERENCE_FEATURE_EXTRACTION_DISABLED`
- `AI_ARTIFACT_NOT_FOUND`
- `AI_EVIDENCE_ACCESS_DENIED`

Organization policy management routes:

```text
GET    /api/v1/organizations/current/ai-provider-policies
POST   /api/v1/organizations/current/ai-provider-policies
POST   /api/v1/organizations/current/ai-provider-policies/:policyId/approve
POST   /api/v1/organizations/current/ai-provider-policies/:policyId/deactivate
```

These routes are Admin-only, store no credentials, audit every approval/deactivation, and reject
approval when the selected provider/model/data-retention mode is not available in deployment
configuration.

## 13. Queue payload contracts

Extend `packages\jobs` with discriminated unions:

```ts
type RequirementAnalysisJobPayload =
  | { kind: "freeze-snapshot"; runId: string; organizationId: string; projectId: string; actorId: string; correlationId: string; idempotencyKey: string; submittedAt: string }
  | { kind: "plan-batches"; runId: string; snapshotId: string; organizationId: string; projectId: string; correlationId: string; idempotencyKey: string; submittedAt: string }
  | { kind: "run-stage"; runId: string; stageId: string; stageKind: AnalysisStageKind; organizationId: string; projectId: string; correlationId: string; idempotencyKey: string; submittedAt: string }
  | { kind: "run-batch"; runId: string; stageId: string; batchId: string; organizationId: string; projectId: string; correlationId: string; idempotencyKey: string; submittedAt: string }
  | { kind: "finalize-run"; runId: string; organizationId: string; projectId: string; correlationId: string; idempotencyKey: string; submittedAt: string }
  | { kind: "cancel-run"; runId: string; organizationId: string; projectId: string; actorId: string; correlationId: string; idempotencyKey: string; submittedAt: string };
```

Queue mapping:

```text
jobPayloadSchemas["ai-analysis"] = requirementAnalysisJobPayloadSchema
jobPayloadSchemas["citation-verification"] = citationVerificationJobPayloadSchema
```

The `ai-analysis` queue owns run supervision, snapshot, batching, AI stages, and finalization. The
`citation-verification` queue receives `{ runId, stageId, batchId, organizationId, projectId,
correlationId, idempotencyKey, submittedAt }`, performs deterministic verification, and signals the
supervisor to continue only after its run-local batches are terminal.

Rules:

- Use stable BullMQ `jobId = idempotencyKey`.
- Worker rechecks DB state before every side effect.
- Jobs are safe across Redis/worker restarts.
- Run/stage/batch DB state is authoritative; queue state is operational.

## 14. Web experience

### 14.1 Routes

```text
/projects/$projectId/requirements/analyzer
/projects/$projectId/requirements/analyzer/runs/$runId
/projects/$projectId/requirements/analyzer/runs/$runId/requirements/$requirementId
/projects/$projectId/requirements/analyzer/runs/$runId/delivery-items/$itemId
/projects/$projectId/requirements/analyzer/runs/$runId/coverage
```

These routes are read-only for artifacts. Launch/cancel/retry actions appear only for
`requirements:analyze`.

### 14.2 Screens/components

- **Analyzer landing:** safe-disabled/provider approval state, eligible source preview, budget
  summary, "Start analysis" CTA.
- **Run list:** status, mode, source count, artifact counts, provider policy name, cost/tokens,
  created by, created at.
- **Run detail:** progress timeline by stage, batch status drawer, warnings/errors, cancel button,
  retry/replay/reprocess/fresh actions.
- **Requirement results:** table/cards with `EpistemicBadge`, `ConfidenceMeter` only for
  confirmed/assumed, `CitationChip`, `ProvenanceTag`, and `TraceabilityChain`.
- **Coverage matrix:** fixed 18-row rubric, status chips, evidence links, linked questions.
- **Delivery items:** grouped risks/assumptions/dependencies/conflicts/questions/scope/out-of-scope
  with severity indicators.
- **Evidence drawer:** citation quote, source title/version, locator, offsets, chunk hash, source
  hash, extraction version, normalization mode.
- **Read-only Module 4 handoff banner:** explain that accept/edit/reject is coming in Module 4.

### 14.3 States

Required states:

- Safe-disabled.
- Provider approved but no eligible sources.
- Eligible source exclusions.
- Loading, empty, filtered empty.
- Running with bounded polling every 3 seconds while non-terminal.
- Canceled, failed, completed with warnings, completed.
- Permission denied.
- Budget exhausted.
- Read-preserving kill switch active.
- Reference extraction disabled.

## 15. Security and prompt-injection controls

- Treat all source chunks as hostile content.
- Prompts must place evidence inside structural delimiters with immutable metadata and explicit
  instruction that evidence text is not executable instruction.
- No provider tool/function calls with side effects.
- Tenant/project IDs are passed as structured metadata and verified before persistence.
- Never include another tenant's chunks in a batch; snapshot queries are organization/project scoped.
- Redact raw source text from logs, audit events, metrics, and provider error details.
- Store prompt/schema hashes and safe prompt asset IDs, not full prompts in audit.
- Keep raw model output only in `ai_run.output` when necessary for reproducibility and protect it
  with the same project authorization as source-derived artifacts.
- Add adversarial fixtures for prompt injection, schema escape, quote fabrication, cross-tenant
  leakage, and provider error leakage.

## 16. Audit, observability, and SLOs

### 16.1 Audit events

Audit at minimum:

- Provider policy approved/deactivated.
- Eligible-source preview requested.
- Analysis run requested/snapshot frozen/queued/started/completed/failed/canceled.
- Cancel requested and honored.
- Retry/replay/reprocess/fresh run requested.
- Stage started/completed/failed.
- Budget threshold exceeded.
- Citation verification downgrade/reject summary.
- Artifacts finalized.
- Evidence inspected.
- Kill switch changed.

Do not audit raw source chunks, full prompts, provider request bodies, provider responses, signed
URLs, credentials, or full generated text.

### 16.2 Metrics/log signals

Initial metrics can be structured log counters until a metrics system is added:

- Runs by status/mode/provider policy.
- Queue latency and stage duration.
- Token/cost usage.
- Citation verification pass/downgrade/fail counts.
- Schema validation and shape-only repair counts.
- Coverage categories by addressed/partial/absent.
- Artifact counts by type/status.
- Cancellation latency.
- Provider transient failure/rate-limit/timeout counts.

### 16.3 Initial SLOs

| Signal | Baseline target |
|---|---:|
| Eligible-source preview latency | p95 < 2 seconds for 500 chunks. |
| Analysis run wall clock | p95 within configured 30-minute budget. |
| Cancel acknowledgment | p95 < 10 seconds to stop scheduling new calls. |
| Citation verifier | 100% deterministic before persistence. |
| Cross-tenant leakage | 0 tolerated. |
| Persisted confirmed with unverified citation | 0 tolerated. |

## 17. Evaluation and gold-set harness

### 17.1 Ownership and fixtures

- Product/BA and Architect jointly own labels.
- Engineering owns harness, deterministic checks, CI integration, and fixture hygiene.
- Start with 8-12 human-labeled fixture projects covering:
  - Client portal/RFP.
  - Internal product spec.
  - Spreadsheet-heavy requirements.
  - Transcript/email ambiguity.
  - Conflicting documents.
  - Security/compliance-heavy project.
  - Sparse/unknown-heavy project.
  - Reference-artifact project, disabled by default until legal/IP gate.

### 17.2 Metrics

- Citation precision/recall.
- Requirement extraction precision/recall by type.
- Coverage classification accuracy for the 18 categories.
- Abstention correctness.
- Conflict precision/recall.
- Question linkage correctness.
- Schema validity.
- Zero post-gate hallucination.
- Cost and wall-clock ceilings.
- Adversarial prompt-injection/exfiltration/schema-escape/IP/cost fixtures.

No LLM-as-judge release gate. LLMs may help generate candidate fixtures, but release decisions use
human labels and deterministic assertions.

### 17.3 Initial release thresholds

Conservative tunable baselines:

| Gate | Threshold |
|---|---:|
| Schema validity after max one repair | 100% |
| Persisted `confirmed` with unverified citation | 0 |
| Cross-tenant leakage | 0 |
| Unsupported persisted confirmed claim | 0 |
| Verified citation precision | >= 99% |
| Verified citation recall against labeled confirmed requirements | >= 90% |
| Requirement precision for must-have/functional labels | >= 85% |
| Requirement recall for must-have/functional labels | >= 75% |
| Coverage classification accuracy | >= 85% |
| Question linkage correctness | >= 90% |
| Conflict precision | >= 85% |
| Conflict recall | >= 70% |
| Abstention correctness on unsupported claims | >= 95% |
| Budget compliance | 100% of runs stop before configured ceilings |

Lower recall is acceptable at launch when the system abstains rather than inventing scope. Thresholds
can increase after gold labels mature.

## 18. Testing matrix

| Layer | Coverage |
|---|---|
| Shared types | New enums, permissions, state-machine transitions, coverage categories, delivery item attribute schemas. |
| DB/migrations | Constraints, indexes, active-run partial uniqueness, append-only snapshot/citation guards, no confirmed without verified citation transaction tests. |
| AI wrapper | Provider-policy resolution, `generateText`/`Output.object` binding, no tools, usage/cost capture, transient retry classification, redaction. |
| Prompt assets | Hash stability, schema compatibility, prompt version registry, injection delimiters. |
| Citation verifier | Unicode NFC, whitespace/smart quote/dash normalization, offsets, multiple matches, fuzzy downgrade never upgrade. |
| Batch planner | Deterministic source/chunk order, token budgets, snapshot hash, no pgvector/semantic retrieval. |
| Worker | Stage DAG, idempotency, cancellation, retry, one shape-only repair, budget exhaustion, partial failure/warning finalization. |
| API unit | DTO validation, stable errors, RBAC, provider approval gate, run modes, no Module 4 mutations. |
| API integration | Cross-tenant isolation, source eligibility, snapshot freezing, artifact lists/details/evidence, cancel/retry/replay/reprocess/fresh. |
| Web component | Safe-disabled, eligible-source preview, run progress polling, result tables, evidence drawer, permission states, kill switch. |
| E2E | Ready sources -> run -> progress -> completed artifacts -> read-only evidence; cancel; budget failure; provider disabled; no eligible sources. |
| Eval harness | 8-12 gold projects and adversarial fixtures with deterministic thresholds. |
| Contract | OpenAPI generation and generated API client drift. |
| CI/Docker | Existing root gates plus targeted AI/package/worker/API/web tests. |

Targeted commands after implementation:

```text
pnpm turbo run test --filter=@atlashq/types --filter=@atlashq/auth --filter=@atlashq/config --filter=@atlashq/validators --filter=@atlashq/ai --filter=@atlashq/jobs --filter=@atlashq/db
pnpm turbo run test --filter=@atlashq/api --filter=@atlashq/worker --filter=@atlashq/web
pnpm test:api:integration
pnpm test:worker:integration
pnpm test:web:components
pnpm openapi:check
pnpm api-client:check
pnpm db:check
pnpm test:e2e
```

Use Turbo for package unit/typecheck/lint tasks so changed workspace dependencies are built through
the repository dependency graph before tests execute. Use the existing root integration/component
scripts for task names not currently declared in `turbo.json`.

## 19. Implementation roadmap

### Phase 0: Baseline verification and AI SDK spike

**Depends on:** Module 1/2 green baseline.

Tasks:

- Run existing targeted tests around source handoff, auth, jobs, DB, API, worker, and web.
- Verify current AI SDK structured-output usage with `generateText` + `Output.object({ schema })`.
- Pin `ai@^7` plus compatible provider adapters in `packages\ai\package.json`.
- Prove wrapper redaction, usage capture, and no-tool configuration against a fake/local provider.
- Inventory no dedicated Module 3 files/routes exist yet and confirm only additive files are needed.

Exit criteria:

- Baseline green.
- AI SDK wrapper spike documented in tests.
- No implementation decision remains open.

### Phase 1: Shared contracts, permissions, config, and prompt assets

Tasks:

- Add Module 3 enums/types to `packages\types`.
- Add `requirements:read`, `requirements:analyze`, and role grants in
  `packages\types`/`packages\auth`.
- Add provider-policy, run, artifact, coverage, citation, and delivery-item Zod schemas to
  `packages\validators`.
- Add AI config/env defaults and kill switches to `packages\config`.
- Add prompt/schema/pipeline asset registry with hashes under `packages\ai`.
- Add deterministic sampling profiles (temperature 0; optional recorded seed) per stage.
- Extend `packages\jobs` with Module 3 queue payloads.

Exit criteria:

- Shared contract tests pass.
- Provider approval safe-disabled behavior is the default.
- Prompt assets are versioned and hash-checked.

### Phase 2: Database schema, migrations, and guards

Tasks:

- Add provider policy, analysis run, snapshot header/source/file/chunk, stage/dependency,
  batch/chunk, requirement, citation, coverage, and delivery item tables.
- Add constraints/indexes from §9.
- Add append-only guards for snapshots/citations and lifecycle-state guard for Module 3 requirements.
- Add migration replay and guard tests.

Exit criteria:

- Empty DB migration replay succeeds.
- Active-run concurrency constraints work.
- DB/tests prevent persisted confirmed items without verified citations.

### Phase 3: API orchestration

Tasks:

- Add NestJS feature module under `apps\api`.
- Add Admin-only organization provider-policy create/approve/deactivate routes.
- Implement eligible-source preview.
- Implement fresh-run creation plus list/get/cancel/retry/replay/reprocess routes.
- Implement read-only artifact, coverage, citation, evidence, and traceability routes.
- Enforce RBAC, provider approval, budgets, concurrency, idempotency, and stable errors.
- Generate OpenAPI and API client.

Exit criteria:

- API integration tests cover permission, tenant, provider, source eligibility, and run-mode behavior.
- No Module 4 review mutation endpoint exists.

### Phase 4: Worker analyzer pipeline

Tasks:

- Implement run supervisor and stage DAG.
- Implement snapshot freezing and deterministic batch planning.
- Implement `packages\ai` real wrapper and model-call persistence.
- Implement extraction, citation verification, normalization/dedup, conflict, coverage, delivery item,
  question, and finalize stages.
- Implement isolated reference extraction behind its default-off flag and organization-scoped
  content-hash extraction caching with citation re-verification on cache hits.
- Implement cancellation, transient retry, shape-only repair, budget stop, and run finalization.

Exit criteria:

- Worker tests prove idempotency, retry, cancellation, verifier, and budget behavior.
- Every actual model call has an `ai_run` row.
- Deterministic stages have stage records and audit events.

### Phase 5: Web analyzer experience

Tasks:

- Add analyzer routes and navigation from project detail.
- Build safe-disabled/provider-policy and eligible-source preview states.
- Build run list/detail/progress with 3-second bounded polling.
- Build read-only requirements, delivery items, coverage, citations, evidence, and traceability views.
- Reuse Cartographer domain components.
- Add MSW handlers and component tests.

Exit criteria:

- Users can launch only when permitted and configured.
- Running/canceled/failed/completed states are understandable.
- Artifact UI is read-only and clearly hands off review to Module 4.

### Phase 6: Eval harness, adversarial tests, and release gates

Tasks:

- Add gold-set fixture structure and 8-12 labeled projects.
- Add deterministic metric computation and CI target.
- Add adversarial fixtures for injection, exfiltration, schema escape, IP/reference, and cost attacks.
- Publish initial threshold report.

Exit criteria:

- Release thresholds in §17.3 pass.
- Failures block prompt/model/schema/pipeline changes.
- No LLM-as-judge gate is used.

### Phase 7: Rollout, observability, and runbook

Tasks:

- Deploy additive migrations with analysis disabled.
- Enable provider policy for an internal organization.
- Run controlled internal analyses and compare to gold labels.
- Enable selected organizations.
- Add operational dashboards/log queries and incident runbook.

Exit criteria:

- Kill switches verified.
- Existing artifacts remain readable through rollback.
- Cost/concurrency and citation SLOs are stable.

## 20. Rollout and rollback

### Feature flags / kill switches

| Flag | Default | Effect |
|---|---|---|
| `ai_requirement_analysis_enabled` | off | Blocks new runs; reads remain enabled. |
| `ai_model_calls_enabled` | off until provider approval | Blocks worker model calls; queued runs wait/fail safely. |
| `ai_reference_feature_extraction_enabled` | off | Excludes references from snapshots/batches and blocks the isolated reference stage; preview remains readable with an exclusion reason. |
| `ai_eval_gate_required` | on before external rollout | Requires eval thresholds for prompt/model/schema changes. |
| `ai_analysis_reads_enabled` | on | Emergency read switch; should remain on unless security incident requires hiding artifacts. |

### Rollout

1. Ship migrations and code with analysis disabled.
2. Configure and approve one provider/model/data-retention policy for an internal organization.
3. Run gold-set and adversarial harness.
4. Enable internal project analyses under default budgets.
5. Review cost, citation, leakage, and cancellation signals.
6. Enable selected external organizations.
7. Broaden only after thresholds and SLOs remain stable.

### Rollback

- Turn off `ai_requirement_analysis_enabled` and `ai_model_calls_enabled`.
- Let in-flight deterministic finalization complete if safe; otherwise cancel outstanding runs.
- Keep read access to existing runs/artifacts.
- Roll back API/web/worker images if needed.
- Keep additive tables. Do not drop production AI artifacts during rollback.

## 21. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hallucinated confirmed requirement | Deterministic citation verifier; zero tolerance gate; no persistence as confirmed without verified quote. |
| Prompt injection from source chunks | Structural isolation, no tools, untrusted-evidence instructions, adversarial fixtures, redaction. |
| Cross-tenant leakage | Organization/project-scoped snapshot queries, DB FKs/indexes, integration tests, zero-tolerance eval. |
| Cost overrun | Conservative budgets, batch planner, pre-call projections, provider usage aggregation, kill switch. |
| Provider outage/rate limit | Retry only transient same-policy attempts; explicit failure and user retry/reprocess. |
| Schema drift | Shared Zod schemas, prompt/schema hashes, OpenAPI/client checks, shape-only repair limit. |
| Coverage overclaim | Fixed rubric wording and UI copy: addressed/partial/absent only, not exhaustive gap guarantee. |
| Reference IP/legal risk | Feature extraction off by default; separate stage/context; legal/IP prerequisite. |
| Reprocessing unchanged evidence repeats cost | Organization-scoped content-hash extraction cache; cache hits still re-run deterministic citation verification. |
| Module 3 accidentally implements Module 4 | No review mutation routes, requirement lifecycle fixed at `ai_suggested`, read-only UI banner. |
| `ai_run.output` becomes hidden system of record | Normalized artifact tables are authoritative; `ai_run.output` is provenance snapshot only. |

## 22. Operational prerequisites

These are prerequisites, not open product questions:

- At least one organization-approved provider/model/data-retention policy before any real analysis.
- Provider credentials available to worker runtime through environment/secret manager.
- Product/BA + Architect gold labels for initial fixture set.
- Legal/IP approval and adversarial tests before enabling reference feature extraction.
- Security review of prompt redaction, source isolation, tenant scoping, and provider data handling.

## 23. Definition of Done and acceptance criteria

- [ ] AI analysis is safe-disabled by default.
- [ ] Provider policy approval is explicit and recorded.
- [ ] Exactly one provider/model policy is frozen per run.
- [ ] No automatic provider/model fallback exists.
- [ ] Run budgets and concurrency limits are enforced.
- [ ] Source preview and snapshot use only eligible read-only Module 2 evidence.
- [ ] Snapshot freezes exact source/file/extraction/chunk hashes and versions.
- [ ] Multi-file sources and every consumed chunk have immutable snapshot rows.
- [ ] Worker pipeline is specialized and stage records are persisted.
- [ ] Every model call has an `ai_run` row and provenance hashes.
- [ ] Normalized requirement/citation/coverage/delivery-item rows are the system of record.
- [ ] No Module 4 accept/edit/reject/approve mutation exists.
- [ ] `confirmed` cannot persist without deterministic verified quote citation.
- [ ] `assumed`, `unknown`, and `conflicting` rules are enforced.
- [ ] Confidence bands are deterministic and lowercase; raw decimals are not exposed.
- [ ] Confidence reason codes and the explicit signal-to-band rubric are persisted and tested.
- [ ] Coverage matrix has exactly 18 categories.
- [ ] Polling progress uses bounded 3-second TanStack Query pattern.
- [ ] Prompt assets are checked in, versioned, and hash-validated.
- [ ] Shape-only repair is limited to one attempt.
- [ ] Eval harness and adversarial fixtures pass release thresholds.
- [ ] Existing root gates and targeted Module 3 tests pass.
- [ ] Kill switches preserve reads and stop new calls/jobs.
- [ ] Module 4 handoff appendix below is satisfied.

## 24. Module 4 handoff appendix

Module 4 receives read-only normalized suggestions and may build the Review Board on top of them.

### Handoff data

- `requirement` rows with `lifecycle_state = 'ai_suggested'`.
- Immutable `citation` rows with verified offsets and source tuple.
- `coverage_matrix_entry` rows with linked questions.
- `delivery_item` rows using the shared canonical types; conflict/out-of-scope/scope-creep
  specializations live in validated attributes.
- Traceability links between sources, citations, requirements, coverage, and delivery items.
- `requirement_analysis_run`, stage, batch, and `ai_run` provenance.

### Handoff invariants

- Module 4 must not reinterpret unverified citations as confirmed.
- Module 4 may accept/edit/reject/approve by creating review/lifecycle records or requirement
  versions; it must not mutate Module 3 citations.
- Module 4 can query normalized artifact states/types instead of a dedicated review-queue table.
- Module 4 should preserve original AI suggestion text and show human edits as separate versions.
- Module 4 should continue to use deterministic citation verification for any edit that claims
  confirmed evidence.

## 25. Expected affected files

Implementation should be additive and focused:

- `packages\types\src\index.ts` - enums, permissions, artifact/run types.
- `packages\auth\src\permissions.ts` and tests - permission matrix export/coverage.
- `packages\validators\src\requirement-analysis.ts` and tests - Zod contracts.
- `packages\config\src\index.ts` and tests - AI flags, budgets, provider env.
- `packages\jobs\src\index.ts` and tests - Module 3 job payload unions.
- `packages\ai\src\*` and tests - AI SDK wrapper, provider policy, prompt registry, verifier helpers.
- `packages\ai\package.json` - pinned `ai@^7` and compatible provider adapters.
- `packages\db\src\schema.ts`, migrations, guard tests - tables and constraints.
- `apps\api\src\features\requirement-analysis\*` and integration tests - API orchestration.
- `apps\api\src\features\organization-ai-provider-policies\*` and integration tests - explicit
  organization approval lifecycle.
- `apps\worker\src\requirement-analysis\*` and tests - stages, batch planning, citation verifier.
- `apps\web\src\features\requirement-analysis\*` and routes/tests - UI and hooks.
- `packages\api-client` generated output after OpenAPI regeneration.
- `tests\e2e\*` - analyzer E2E flows.

No implementation should modify Module 2 source evidence semantics except to read the handoff
contract.

## 26. External implementation references used

- Official AI SDK structured-output docs: `generateText` with `Output.object({ schema })`, schema
  validation, output types, and stream/non-stream behavior.
- OWASP GenAI / LLM Prompt Injection guidance: direct and indirect prompt-injection risks,
  information disclosure, content manipulation, and tool-abuse mitigations.
- NIST AI Risk Management Framework: trustworthy AI risk management, governance, measurement, and
  operational risk framing.
- Provider data-retention documentation for the selected provider(s): required before approving an
  organization provider policy.
- Existing AtlasHQ source docs listed in frontmatter.
