---
title: "Module 2 Implementation Plan: Source Document Vault"
module: 2
status: "Reconciled - core Module 2 implementation landed; E2E and ops hardening remain"
source_docs:
  - "docs\\core\\core-plan.md"
  - "docs\\architecture\\v1-architecture-and-tech-stack.md"
  - "docs\\impl-plan\\00-project-repository-setup.md"
  - "docs\\impl-plan\\module-01-project-workspace.md"
  - "apps\\web\\DESIGN.md"
  - "apps\\web\\PRODUCT.md"
owner_use: "Product, design, engineering, QA, security, and implementation planning for AtlasHQ V1 Module 2"
last_updated: "2026-07-11"
---

# Module 2: Source Document Vault

> **Planning note (2026-07-11).** Module 1 and the repository workspace foundation are
> implemented, and Module 2 is now largely implemented as well: the source-vault tables,
> permissions, storage/scan clients, API surface, worker handlers, web route, and compose
> profiles all exist. This plan now serves as the reconciled handoff record: it preserves the
> original roadmap and decisions while calling out the few remaining real gaps (primarily the
> dedicated source-vault E2E pack and rollout-only ops hardening). It does not rebuild
> authentication, tenancy, project authorization, audit, traceability, the typed API pipeline, or
> the Cartographer design system.

## Current implementation baseline

### Already complete - verify and consume, do not rebuild

- **Workspace and quality gates:** pnpm 11, Turborepo, TypeScript strict mode, Biome, Vitest,
  Testcontainers, Playwright, OpenAPI generation, typed API-client generation, Docker checks, and
  CI are established.
- **Module 1 database foundation:** organization, user, auth, client, project,
  project-membership, audit-event, traceability-link, and AI-run tables and migrations exist in
  `packages\db`.
- **Authentication and authorization:** Better Auth, authenticated NestJS routes,
  `ProjectAuthorizationGuard`, `RequireProjectPermission`, project-role evaluation, and
  organization/project isolation are implemented.
- **Audit and traceability:** transaction-bound audit writing and append-only audit-event database
  guards are available for reuse.
- **API contract pipeline:** shared Zod validators, `nestjs-zod` DTOs, OpenAPI generation, and the
  generated `@atlashq/api-client` contract are working.
- **Web application:** the authenticated project shell, project detail route, TanStack Query
  patterns, activity surfaces, responsive project UI, and Cartographer components are available.
- **Source Vault data model and permissions:** `packages\db` now contains
  `source_upload_session`, `source_upload_file`, `source_document`, `source_document_file`,
  `source_extraction`, `source_chunk`, and `reference_artifact`, plus the immutable-guard
  migration/checks; `packages\types` and `packages\auth` codify `sources:read` / `sources:write`.
- **Storage and scanning:** `packages\storage` has real MinIO signing/stat/stream/bootstrap and
  ClamAV clients, safe object-key helpers, private-bucket contracts, and versioning/CORS checks.
- **API surface:** `apps\api` has the Source Documents feature module, stable error codes, feature
  flag handling, OpenAPI generation, typed client output, and source-vault integration tests.
- **Worker pipeline:** `apps\worker` has verify-and-scan, extract, generate-preview,
  capture-reference, and expire-upload-session handlers with bounded streaming, deterministic
  extraction, preview generation, and retry/error classification.
- **Web handoff point:** `apps\web` has the Source Document Vault route, list/detail/intake UI,
  presentation helpers, and source-vault component tests.
- **Infrastructure profiles:** `docker-compose.yml` now defines `core`, `worker`, `storage`, and
  `scan` profiles plus the `bootstrap` and `storage-bootstrap` entry points.
- **Operational bootstrap:** `storage-bootstrap` enforces private MinIO access, versioning, and
  CORS; `bootstrap` provisions the first admin explicitly.

### Remaining gaps - this is the implementation scope

- Dedicated source-vault E2E coverage under `tests\e2e` is still pending.
- The internal queue dashboard / Bull Board rollout remains a later ops surface.
- Full rollout hardening still needs the final release-validation pass and any intentionally
  deferred telemetry.

## 1. Purpose

Module 2 centralizes every original project input as immutable, versioned, auditable evidence.
Users can upload files, paste or manually enter text, and register reference artifacts without
allowing source content to be silently changed in place.

The module ends when evidence is safely stored, scanned where required, deterministically
extracted, chunked, previewable, downloadable by authorized roles, and ready for Module 3. It does
not analyze requirements or approve AI-derived scope.

## 2. User outcomes

By the end of Module 2:

- Authorized internal contributors can add all V1 source formats to a project.
- Original bytes or canonical text snapshots are immutable and protected by application rules,
  database guards, unique object keys, and MinIO bucket versioning.
- Replacing evidence creates a new version linked to the prior version; no source is overwritten.
- Users can see upload, duplicate, scan, extraction, preview, and failure states without implying
  that requirement analysis has occurred.
- Developer and QA roles can read and download evidence but cannot upload, replace, archive, or
  change metadata.
- Client Viewer / Approver has no Source Document Vault access in V1.
- Duplicate content is detected by SHA-256, explained, and allowed only after explicit
  acknowledgement.
- Reference artifacts require rights attestation, preserve the submitted reference snapshot, and
  cannot be cleared for downstream use except by an Admin or Project Owner.
- Malware-infected or hash-mismatched files never receive preview or download URLs.
- Module 3 receives stable, versioned source and extraction contracts without being allowed to
  mutate Module 2 evidence.

## 3. Module boundary

### In scope

- Project-scoped source-document permissions.
- Full V1 input coverage:
  - PDF (`.pdf`).
  - Word (`.docx`; legacy `.doc` deferred).
  - Plain text and Markdown (`.txt`, `.md`).
  - Meeting transcripts and email copy-paste as uploaded text or manual text sources.
  - Spreadsheets (`.xlsx`, `.csv`; legacy `.xls` deferred).
  - Presentations (`.pptx`; legacy `.ppt` deferred).
  - Images/screenshots (`.png`, `.jpg`, `.jpeg`, `.webp`).
  - Manual text evidence.
  - Reference artifacts: URL, screenshot set, uploaded export, article, or app-store listing.
- Direct browser-to-MinIO upload using short-lived signed URLs.
- Ephemeral upload sessions so abandoned uploads do not become immutable source records.
- Configurable upload limit with a 100 MiB per-file default.
- SHA-256 duplicate detection, warn-and-confirm behavior, and worker-side hash verification.
- Immutable source records, archive/restore, replacement/version chains, and version history.
- MinIO bucket bootstrap, private access, bucket versioning, and app-level immutable keys.
- Extension, declared MIME, magic-byte/container validation, and archive-bomb protections.
- ClamAV streaming scan before parsing user-uploaded bytes.
- Deterministic extraction, extraction-version recording, source chunks, and safe previews.
- Feature-flagged, human-triggered, single-page reference capture with SSRF protections.
- OpenAPI, generated typed client, TanStack Query hooks, and Cartographer-based UI.
- Audit logging, correlation IDs, operational logs, health/readiness, retry, and idempotency.
- Module 3 read-only handoff contract.

### Out of scope

- Requirement extraction, normalization, citation generation, gap analysis, or question generation.
- AI-generated reference-feature candidates.
- Embeddings, pgvector, semantic retrieval, or semantic chunking.
- Requirement review, approval baselines, architecture review, delivery tracking, or handoff export.
- OCR at launch. The existing `ocr_processing_enabled` flag remains off; image metadata and preview
  still ship.
- Automated crawling, multi-page crawling, login automation, anti-bot bypass, or private-session
  capture.
- Live Google Drive/OneDrive sync. Links plus immutable user-uploaded snapshots remain the V1 rule.
- Real-time collaborative editing, CRDTs, or in-place source editing.
- Public buckets, permanent download URLs, raw object-store credentials, or storage through the API
  process.
- Hard-delete product flows, retention/purge workflows, legal hold, or MinIO object lock.
- Multipart upload. The 100 MiB V1 limit permits a simpler single-part signed PUT; multipart remains
  a later option if the limit grows.
- Full client portal access.

## 4. Source principles

- **Source content is immutable:** original files, canonical manual text, reference snapshots,
  hashes, and version ancestry never change after confirmation.
- **Metadata is auditable:** title, tags, notes, archive state, processing state, and IP-review state
  may change only through authorized, audited mutations.
- **Unconfirmed intake is not evidence:** upload-session rows are operational and expire; only a
  confirmed upload creates immutable source records.
- **Replacement is versioning:** a corrected source creates a new version with `supersedes_id`.
- **Derived artifacts are versioned:** extraction runs and chunks are append-only so Module 3 can
  cite the exact extraction it consumed.
- **Scanning precedes parsing:** no user-uploaded binary is extracted or previewed before a clean
  malware verdict.
- **Authorization precedes signing:** signed upload, preview, and download URLs are created only
  after project membership and source permissions are evaluated.
- **Reference capture stays human-in-the-loop:** one explicit page only, no crawl, no login, no
  anti-bot behavior, and no verbatim-copy positioning.
- **AI remains downstream:** Module 2 prepares evidence; it never turns evidence into approved
  requirements.

## 5. Confirmed decisions

| ID | Decision |
|---|---|
| `M2-DEC-001` | Support the full documented V1 input set. Launch allowlist is PDF, DOCX, TXT, MD, XLSX, CSV, PPTX, PNG, JPEG, and WebP, plus manual/pasted text and reference artifacts. |
| `M2-DEC-002` | Keep explicit one-page reference capture inside Module 2 behind `single_page_capture_enabled`, default off. |
| `M2-DEC-003` | Default maximum upload is 100 MiB per file, configurable by environment, not per organization in V1. |
| `M2-DEC-004` | Confirmed source evidence is archive-only. No hard-delete product flow; database guards reject delete/truncate of source truth. |
| `M2-DEC-005` | Duplicate SHA-256 matches warn and require explicit confirmation but may create a separate source record. |
| `M2-DEC-006` | Admin, Project Owner, Architect / Tech Lead, and Business Analyst / Coordinator can contribute/manage. Developer and QA are read/download only. Client Viewer / Approver has no access. |
| `M2-DEC-007` | Only Admin or Project Owner can clear or restrict reference IP review. |
| `M2-DEC-008` | Manual entry is immutable text evidence. Corrections create a new source version; no direct requirement is created. |
| `M2-DEC-009` | Application-generated immutable object keys remain the primary guarantee. MinIO bucket versioning is required; object lock is deferred. |
| `M2-DEC-010` | OCR remains off and deferred. Image sources may be ready with metadata/preview and zero extracted text chunks. |
| `M2-DEC-011` | PPTX text and speaker-note extraction uses a pinned `officeparser` adapter; slide rendering is not required. |
| `M2-DEC-012` | The Source Vault uses a rollout write flag. Turning writes off must preserve read/download access to existing sources. |

## 6. Functional requirements

### 6.1 Source intake modes

The Source Documents route exposes three explicit intake modes:

1. **File upload**
2. **Manual text / paste**
3. **Reference artifact**

Every mode requires:

- Project context.
- Title.
- Source type and document kind.
- Contributor identity.
- Tags optional.
- Provenance/source date optional.
- Notes optional.
- Explicit confirmation that submitted content becomes immutable evidence.

### 6.2 Upload sessions

Binary intake uses short-lived upload sessions rather than inserting a source document before the
upload is confirmed.

1. The web app validates the file against the allowlist and 100 MiB default.
2. A Web Worker computes SHA-256 without blocking the React main thread.
3. The API validates metadata, repeats the duplicate lookup, creates an expiring upload session,
   generates final immutable object keys, and returns one signed PUT URL per file.
4. Uppy uploads directly to MinIO.
5. The client confirms the session.
6. The API verifies object existence, size, and content type with object-store metadata.
7. A database transaction creates the immutable source, source-file rows, duplicate
   acknowledgement, version link, and audit event.
8. The API enqueues the first processing job.

Rules:

- Upload sessions expire after a configurable period, default 24 hours.
- Expired or canceled sessions and their unconfirmed objects may be removed by maintenance because
  they never became source evidence.
- Confirm is idempotent and returns the previously created source when repeated.
- Confirmation rechecks duplicate matches to close race windows.
- One regular file equals one source version.
- A screenshot-set reference may contain multiple ordered files in one source version.
- The API never proxies file bytes.

### 6.3 Duplicate behavior

Duplicate detection uses the canonical source content hash within the project and includes active,
archived, and superseded matches.

- For a single-file source, the source hash is the file SHA-256.
- For manual/reference/multi-file sources, the source hash is SHA-256 over canonical JSON containing
  immutable metadata plus ordered child-file hashes.
- A duplicate response lists matching title, source ID, version, archive/superseded state,
  contributor, and upload date.
- The user must cancel or acknowledge the exact match IDs.
- Confirmation records `duplicate_match_ids`, actor, timestamp, and an audit event.
- Duplicate acknowledgement never creates a version relationship. Only the explicit replace flow
  sets `supersedes_id`.

### 6.4 Manual text evidence

- Manual, transcript, and email-paste modes serialize the submitted content as canonical UTF-8
  text/Markdown.
- The API hashes the canonical bytes and writes them to a server-created immutable MinIO object.
- Because the application generated the object, malware scan is `not_required`; deterministic
  extraction/chunking still runs.
- The submitted body cannot be edited in place.
- Correcting content uses **Create new version**, preserving the previous body and hash.
- Module 2 does not create a requirement record from manual text.

### 6.5 Replacement and version history

- Every logical source has a stable `lineage_id`.
- Version 1 has no `supersedes_id`.
- A replacement transaction creates version N+1 with `supersedes_id = version N`.
- A unique constraint prevents one version from being superseded more than once.
- Changing immutable reference fields, replacing attachments, or performing a later page capture
  creates a new source version.
- Prior versions remain readable and downloadable to authorized roles.
- IP clearance does not carry forward; every new reference version starts `not_reviewed`.
- The UI identifies the current head, superseded versions, archive state, actor, time, and
  replacement note.

### 6.6 Archive and restore

- Archive hides a source from the default active list but preserves storage, versions, extraction,
  audit, traceability, previews, and authorized downloads.
- No delete endpoint exists.
- Restore is allowed only for the current lineage head.
- A superseded version cannot be restored as a competing current version.
- Archive and restore use optimistic concurrency and write audit events.

### 6.7 Reference artifacts

Reference metadata includes:

- `reference_kind`: `url`, `screenshot_set`, `uploaded_export`, `article`,
  `app_store_listing`.
- `capture_method`: `manual_paste`, `user_uploaded_screenshot`,
  `on_demand_single_page_capture`.
- `access_type`: `public`, `client_owned`, `permissioned`.
- `intended_use`: `inspiration`, `feature_parity`, `differentiation_baseline`.
- `ip_review_status`: `not_reviewed`, `cleared`, `restricted`.
- Source URL, captured time, title, notes, and immutable snapshot files/manifest.

Attestation:

> I confirm I have the right to provide this reference for functional inspiration only, not
> verbatim copying of protected design, text, or code.

- The checkbox is mandatory.
- Store the exact attestation text, attestation version, actor, timestamp, and linked audit event.
- Attestation fields are immutable after source confirmation.
- Admin or Project Owner may change IP review to `cleared` or `restricted`.
- A review change requires a reason and is audit logged.
- Restricted or not-reviewed references remain visible as evidence but must be excluded from Module
  3 eligible-source queries.

### 6.8 One-page reference capture

When `single_page_capture_enabled` is false:

- No capture CTA is rendered.
- Capture requests are rejected before queueing.

When enabled:

- The user explicitly requests one public HTTP/HTTPS page.
- The capture worker uses Playwright in an isolated process/container.
- Resolve and reject loopback, private, link-local, multicast, reserved, and cloud-metadata
  addresses before navigation and after every redirect/DNS resolution.
- Do not accept credentials, cookies, custom auth headers, login steps, or anti-bot workarounds.
- Limit redirects, total time, response bytes, subresource bytes, and browser process resources.
- Block downloads and navigation outside the single requested page.
- Store a screenshot plus canonical URL/title/capture metadata as a new immutable source version.
- A capture failure is explicit and does not silently fall back to a different capture method.

### 6.9 Processing and retry

User-uploaded files move through:

`verification_pending -> scan_pending -> scanning -> extraction_pending -> extracting -> ready`

Terminal alternatives:

- `quarantined`: malware found or hash mismatch; no preview/download.
- `failed`: unsupported/corrupt content or exhausted infrastructure retries.

Rules:

- Declared extension/MIME is checked before signing.
- Actual format and archive structure are checked before parsing.
- Worker recomputes SHA-256 while streaming the object.
- Scan happens before extraction or preview.
- Transient MinIO, database, Redis, or ClamAV errors retry with bounded exponential backoff.
- Malware, hash mismatch, unsafe archive, unsupported actual type, and corrupt content are
  unrecoverable until a new version is submitted.
- Authorized contributors may retry an eligible failed processing run without creating a new source.
- Workers are idempotent and safe across process restarts.

### 6.10 Deterministic extraction and previews

| Kind | Parser | Deterministic output | Preview |
|---|---|---|---|
| PDF | `pdfjs-dist` | Text by page with page locator | PDF.js/browser preview after clean scan |
| DOCX | `mammoth` | Sanitized plain text grouped by heading/paragraph | Extracted-text view; original download |
| TXT / MD / transcript / email | UTF-8 decoder | Paragraph/section chunks | Sanitized read-only text |
| XLSX | `xlsx` | Sheet and bounded row-range chunks | Extracted table/text summary; original download |
| CSV | `xlsx`/CSV parser | Bounded row-range chunks | Extracted table/text summary |
| PPTX | `officeparser` | Text and speaker notes by slide | Extracted slide text; original download |
| PNG / JPEG / WebP | `sharp` | Metadata only while OCR is off | Safe image preview/thumbnail |
| Manual text | Canonical UTF-8 path | Paragraph/section chunks | Sanitized read-only text |

Extraction rules:

- Extraction is non-AI and does not normalize requirements.
- Parsers run only in the worker process, not the API.
- Office ZIP containers enforce entry-count, decompressed-size, compression-ratio, nesting, and
  timeout limits.
- HTML produced by a parser is never rendered directly without sanitization; plain text is the
  default derived representation.
- Each extraction records parser names/versions, chunker version, source hash, status, timestamps,
  errors, and extracted-text hash.
- Reprocessing creates a new extraction version and new chunks. Prior successful extraction
  versions remain available for provenance.
- Chunks carry deterministic sequence, character offsets, type-specific locator, and content hash.

### 6.11 Mutable metadata

Authorized contributors may update:

- Title.
- Tags.
- Notes/provenance context.

They may not update:

- Original bytes or canonical manual text.
- Source content hash.
- File hashes/object keys/storage version IDs.
- Lineage, version number, or `supersedes_id`.
- Reference URL/capture method/attestation on a confirmed version.

Mutable metadata updates require optimistic concurrency and transaction-bound audit events.

## 7. Authorization model

Add two source-specific project permissions instead of overloading `project:write`:

- `sources:read`
- `sources:write`

| Role | Read/preview/download | Upload/manual/reference | Metadata/replace/archive/retry | IP clear/restrict |
|---|---:|---:|---:|---:|
| Admin | Yes | Yes | Yes | Yes |
| Project Owner | Yes | Yes | Yes | Yes |
| Architect / Tech Lead | Yes | Yes | Yes | No |
| Business Analyst / Coordinator | Yes | Yes | Yes | No |
| Developer | Yes | No | No | No |
| QA | Yes | No | No | No |
| Client Viewer / Approver | No | No | No | No |

Implementation rules:

- Extend `ProjectPermission` and the role matrix in `packages\types`.
- Update `isMutationPermission()` so both `project:read` and `sources:read` are non-mutations.
- Reuse `project:admin` for IP clearance because its existing grantees are exactly Admin and Project
  Owner.
- Every API query scopes by organization and project before source ID.
- Every signing operation receives an authorization proof generated only after access evaluation.
- Frontend affordances reflect permissions, but API enforcement is authoritative.

## 8. Data model

### 8.1 `source_upload_session`

Operational, expiring, and deletable because it is not confirmed evidence.

Key fields:

- ID, organization ID, project ID, actor ID.
- Intake mode and source metadata draft.
- Optional `supersedes_id`.
- Expected canonical source hash.
- Duplicate match IDs and acknowledgement.
- Status: `created`, `uploading`, `uploaded`, `confirmed`, `canceled`, `expired`.
- Expires at, confirmed at, created/updated timestamps.
- Idempotency key.

Indexes:

- Organization/project/status/expiry.
- Actor/status.
- Unique idempotency key.

### 8.2 `source_upload_file`

Child rows for one regular file or multiple screenshot-set files.

Key fields:

- Upload-session ID and ordinal.
- Role: `primary`, `attachment`, `snapshot`.
- Original filename, normalized filename, declared MIME, extension.
- Expected byte size and expected SHA-256.
- Final immutable object key.
- Upload status and object-store metadata.

Expired-session cleanup may delete these rows and unconfirmed objects.

### 8.3 `source_document`

Canonical immutable source-version record.

Key fields:

- ID, organization ID, project ID.
- Stable lineage ID.
- Version number.
- Nullable `supersedes_id`.
- Source type: `document`, `reference`, `manual`.
- Document kind.
- Title, notes, tags.
- Canonical content hash.
- Duplicate acknowledgement metadata.
- Processing status.
- AI processing status, default `not_started` for Module 3.
- Created/uploaded actor and timestamps.
- Archive actor/timestamp.
- Optimistic-concurrency version for mutable metadata/status.

Constraints/indexes:

- Unique `(lineage_id, version_number)`.
- Unique nullable `supersedes_id` so one version has at most one successor.
- SHA-256 format check.
- Organization/project/source-type/processing/archive indexes.
- Project/content-hash duplicate lookup index, intentionally non-unique.
- Title trigram index using the existing PostgreSQL extensions.

Database guards:

- Reject delete and truncate.
- Reject mutation of organization/project/lineage/version ancestry, source type/kind, content hash,
  creation identity, and duplicate acknowledgement after insert.
- Permit only audited metadata, processing, archive, and optimistic-version changes.

### 8.4 `source_document_file`

Immutable original evidence objects belonging to a confirmed source.

Key fields:

- Source-document ID, ordinal, and role.
- Original filename and normalized download filename.
- MIME, extension, byte size, SHA-256.
- MinIO object key and bucket version ID.
- Scan status/result/signature/scanned time.
- Created timestamp.

Constraints:

- Unique `(source_document_id, ordinal)`.
- Unique object key.
- SHA-256 and non-negative-size checks.
- Reject update/delete/truncate after confirmation, except controlled scan-status columns.

### 8.5 `source_extraction`

Append-only deterministic extraction version.

Key fields:

- Source-document ID and extraction version.
- Status.
- Parser manifest with package names/versions.
- Chunker version.
- Extracted-text hash.
- Optional preview object key/version ID.
- Started/completed timestamps.
- Failure code and safe failure detail.

Constraints:

- Unique `(source_document_id, extraction_version)`.
- Reject update after terminal success/failure except the active run's allowed state transitions.
- Reject delete/truncate.

### 8.6 `source_chunk`

Append-only child of an extraction.

Key fields:

- Organization, project, source-document, and extraction IDs.
- Zero-based sequence.
- Content.
- Character count.
- Content SHA-256.
- Locator JSON, for example page, slide, sheet/row range, or paragraph range.
- Created timestamp.

Constraints/indexes:

- Unique `(source_extraction_id, sequence)`.
- Source-document/extraction/sequence indexes.
- Reject update/delete/truncate.

### 8.7 `reference_artifact`

One-to-one companion for `source_type = reference`.

Key fields:

- Source-document ID, organization ID, project ID.
- Reference kind, capture method, access type, intended use.
- Source URL where applicable.
- IP review status, reason, actor, and timestamp.
- Exact attestation text, attestation version, actor, timestamp, and audit-event ID.
- Captured timestamp.

Constraints:

- Unique source-document ID.
- Attestation required before insert.
- Attestation fields immutable.
- IP review starts `not_reviewed`.
- New source versions create new companion rows and do not inherit clearance.
- Reject delete/truncate.

### 8.8 Migration strategy

- Add tables and indexes through the next Drizzle-generated migrations.
- Add hand-written trigger migrations following the existing audit-event guard pattern.
- Add Testcontainers guard tests beside the existing database guard tests.
- Migrations are additive. Production rollback disables writes and rolls back application images;
  it does not destructively drop source tables containing evidence.

## 9. Storage and infrastructure

### 9.1 S3-compatible client

Replace the placeholder signing contract in `packages\storage` with a real, typed MinIO-compatible
client while preserving the current authorization-before-signing invariant.

Required operations:

- Create signed PUT URL, maximum 15-minute lifetime.
- Create signed GET URL, default 10-minute and maximum 60-minute lifetime.
- Stat object/version.
- Stream object to worker.
- Upload server-generated manual/reference manifest objects.
- Create bucket if absent.
- Enable and verify bucket versioning.
- Produce safe `Content-Disposition` filenames.

No raw credential or full signed URL may be logged or written to audit records.

### 9.2 Bucket bootstrap

Add an idempotent `storage-bootstrap` one-shot service:

- Wait for MinIO health.
- Create the private bucket if absent.
- Enable bucket versioning.
- Verify versioning is enabled.
- Configure CORS only for approved web origins and required PUT/GET headers.
- Never apply public-read policy or object lock.
- Keep the bucket private (`mc anonymous set none`) and treat `WEB_ORIGIN` as the only browser
  origin that MinIO CORS should allow.

Pin the MinIO image instead of keeping `latest`.

Object lock is explicitly deferred. Application code must still have no path that deletes confirmed
source objects. Expired upload-session objects are the only V1 cleanup exception.

### 9.3 ClamAV

- Add a healthcheck and keep the TCP service internal to the Compose network.
- Stream objects through the `INSTREAM` protocol; do not buffer 100 MiB in memory.
- Keep signature updates operationally visible and health-checked (`clamdscan --ping=4 --wait=10`).
- Record clean/infected verdict, signature name, engine/signature version, duration, and timestamp.
- Scanner unavailable is retryable; scanner verdict is never inferred from a timeout.

## 10. Job and worker architecture

Replace the optional placeholder payload with a discriminated union:

- `verify-and-scan`
- `extract`
- `generate-preview`
- `capture-reference`
- `expire-upload-session`

Every job carries:

- Correlation ID.
- Organization/project/source or upload-session ID.
- Actor where applicable.
- Job kind.
- Idempotency key.
- Submitted timestamp.

Rules:

- Use the existing idempotency helper as the BullMQ `jobId`.
- Check database state before doing work so replay after Redis/worker restart is safe.
- Keep three attempts with bounded exponential backoff for transient infrastructure failures.
- Use unrecoverable failure for malware, hash mismatch, unsafe archive, unsupported actual type,
  corrupt file, or blocked capture URL.
- Use the BullMQ failed set as the V1 dead-letter surface and mount Bull Board only behind
  authenticated internal Admin/operator access.
- Persist status and audit before reporting a terminal job result.
- Propagate correlation IDs API -> queue -> worker -> audit/log.

## 11. API contract

All routes live below `/api/v1/projects/:projectId`, use shared Zod schemas and `nestjs-zod` DTOs,
declare stable OpenAPI operation IDs, and return the existing API error shape.

### Upload/session routes

```text
POST   /source-document-upload-sessions
GET    /source-document-upload-sessions/:sessionId
POST   /source-document-upload-sessions/:sessionId/confirm
POST   /source-document-upload-sessions/:sessionId/cancel
```

### Source routes

```text
GET    /source-documents
POST   /source-documents/manual
POST   /source-documents/references
GET    /source-documents/:sourceId
PATCH  /source-documents/:sourceId/metadata
POST   /source-documents/:sourceId/archive
POST   /source-documents/:sourceId/restore
POST   /source-documents/:sourceId/retry-processing
POST   /source-documents/:sourceId/versions/upload-session
POST   /source-documents/:sourceId/versions/manual
GET    /source-documents/:sourceId/versions
GET    /source-documents/:sourceId/extractions
GET    /source-documents/:sourceId/chunks
GET    /source-documents/:sourceId/files/:fileId/preview-url
GET    /source-documents/:sourceId/files/:fileId/download-url
POST   /source-documents/:sourceId/reference-capture
POST   /source-documents/:sourceId/ip-review
```

Contract requirements:

- Cursor pagination and filters for source type, kind, processing state, archive state, duplicate
  acknowledgement, tag, contributor, and IP review state.
- Search title, original filename, source ID, tag, and reference hostname.
- Signed URLs are separate operations and never embedded long-term in list/detail responses.
- Dashboard summary gains source counts and state distribution.
- Download URL issuance is audit logged without storing the URL.
- Preview/download rejects quarantined, hash-mismatched, or unavailable objects.
- Reference capture requires `single_page_capture_enabled`.
- IP review requires `project:admin`.
- OpenAPI regeneration and generated-client checks are mandatory.

### Stable Module 2 error codes

- `SOURCE_DUPLICATE_CONFIRMATION_REQUIRED`
- `SOURCE_UPLOAD_SESSION_EXPIRED`
- `SOURCE_UPLOAD_SESSION_ALREADY_CONFIRMED`
- `SOURCE_FILE_TOO_LARGE`
- `SOURCE_UPLOAD_SIZE_MISMATCH`
- `SOURCE_MIME_MISMATCH`
- `SOURCE_HASH_MISMATCH`
- `SOURCE_INFECTED`
- `SOURCE_NOT_READY`
- `SOURCE_SUPERSEDED`
- `SOURCE_ARCHIVED`
- `SOURCE_REFERENCE_ATTESTATION_REQUIRED`
- `SOURCE_REFERENCE_RESTRICTED`
- `SOURCE_CAPTURE_DISABLED`
- `SOURCE_CAPTURE_URL_BLOCKED`
- `SOURCE_PROCESSING_NOT_RETRYABLE`
- `SOURCE_STORAGE_UNAVAILABLE`

## 12. Web experience

### 12.1 Routes and navigation

- `/projects/$projectId/source-documents` - vault list.
- `/projects/$projectId/source-documents/$sourceId` - source detail.
- Search parameters preserve filters, sort, archive visibility, and intake drawer mode.
- Replace the Source Documents placeholder only; leave later-module placeholders untouched.
- The project dashboard card deep-links to the real vault and displays real counts.

### 12.2 Vault list

Desktop uses an evidence-register table; narrow screens use cards.

Visible information:

- Title and source ID.
- Source type/kind.
- Current version.
- Primary processing state.
- Duplicate indicator.
- Reference IP-review state.
- Contributor and date.
- Tags and archive state.

Required states:

- Loading skeleton.
- No sources.
- Filtered empty.
- Error/retry.
- Storage unavailable.
- Permission denied.
- Read-only rollout state.
- Offline/reconnect.

### 12.3 Intake drawer

Use a Cartographer `Sheet` with:

1. Intake mode.
2. Metadata and attestation where applicable.
3. File selection/hash/duplicate preflight.
4. Upload progress.
5. Confirmation and processing timeline.

Use Uppy Core/React/AWS-S3 for direct single-part signed PUTs. Do not add Tus or multipart in V1.

Behavior:

- Per-file progress, cancel, retry, and accessible live announcements.
- Maximum-size and allowlist feedback before upload.
- Explicit immutable-evidence warning.
- Duplicate modal with matching-source details and exact acknowledgement.
- Screenshot-set references may select multiple ordered images.
- Uppy state remains local; server source queries start after confirmation.

### 12.4 Source detail

- Metadata and provenance.
- Processing timeline.
- Original files and signed download actions.
- Safe preview or clear fallback.
- Extracted-text view labeled as derived.
- Version history.
- Duplicate acknowledgement.
- Reference attestation and IP review.
- Source-specific audit/activity.
- Archive/restore/replace/retry actions based on permission and state.

Preview rules:

- PDF through PDF.js after a clean scan.
- Images through signed URLs with safe dimensions.
- Text/Markdown as sanitized read-only text.
- DOCX/XLSX/CSV/PPTX show deterministic extracted content and original download.
- Never embed arbitrary remote HTML or execute source scripts/macros.

### 12.5 Reference review

- Show `not reviewed`, `cleared`, or `restricted`.
- Only Admin/Owner sees review controls.
- A review change requires a reason and confirmation.
- Restricted references display a prominent downstream-use warning.
- Capture CTA is absent when the flag is off.

### 12.6 Accessibility and resilience

- Keyboard-operable drawers, tables, cards, progress, dialogs, and menus.
- Visible focus and no color-only status.
- `aria-live` for upload and processing transitions.
- Preserve draft metadata in memory during temporary network loss.
- Do not claim offline upload support.
- Poll processing status with bounded TanStack Query backoff; no websocket is required.

## 13. Audit, traceability, and observability

Audit at minimum:

- Upload session confirmed/canceled.
- Source created.
- Duplicate acknowledged.
- Scan clean/infected.
- Extraction completed/failed.
- Preview generated.
- Metadata changed.
- Source replaced.
- Source archived/restored.
- Processing retried.
- Download URL requested.
- Reference attested.
- IP review changed.
- One-page capture requested/completed/failed.

Do not store live signed URLs, credentials, source body text, or full extracted content in audit.

Structured logs use the existing logger and include correlation ID, organization ID, project ID,
source ID, extraction ID, job ID, and safe status/failure code.

Initial operational signals can be structured log counters until a repository-wide metrics system
exists:

- Uploads by result.
- Scan verdict and duration.
- Extraction result/duration by format.
- Pending/failed jobs.
- Duplicate acknowledgements.
- Capture failures.
- Bucket-versioning probe failures.

Readiness:

- API reports source storage available/unavailable without preventing the core Module 1 app from
  booting when no organization has Module 2 writes enabled.
- Worker readiness verifies PostgreSQL, Redis, MinIO, bucket versioning, and ClamAV.
- Bucket-versioning failure is a deployment blocker for Module 2 writes.

## 14. Implementation roadmap

### Phase 0: Baseline verification and implementation spikes

**Depends on:** Module 1 complete.

**Tasks**

- Run existing Module 1 quality, contract, database, and Docker gates.
- Reconfirm current storage/jobs/worker/UI placeholders and do not rebuild completed foundations.
- Pin and prove the extraction matrix with tiny representative fixtures.
- Prove `officeparser` PPTX text/speaker-note extraction under Node 24.
- Prove Uppy signed single-part PUT against MinIO with the final CORS policy.
- Prove the Playwright capture isolation/SSRF guard design before enabling the flag.
- Record exact dependency versions in package manifests and lockfile during implementation.

**Outputs**

- Green baseline.
- Fixture-backed format matrix.
- Confirmed dependency/version choices.
- No production feature behavior yet.

**Acceptance criteria**

- Existing gates pass before Module 2 changes.
- Every V1 format has a deterministic parser or an explicit metadata-only behavior.
- No unresolved product decision remains.

### Phase 1: Shared contracts, permissions, config, and flags

**Depends on:** Phase 0.

**Tasks**

- Add `sources:read` and `sources:write` and update role tests.
- Reuse `project:admin` for IP review.
- Add shared source, upload-session, reference, processing, filter, and error schemas.
- Add format allowlist and canonical source-manifest hashing helpers.
- Tighten the document-processing job schema into a discriminated union.
- Add config for upload limit, session TTL, signed URL TTLs, ClamAV, bucket versioning, and capture
  limits.
- Add organization setting `source_vault_writes_enabled`, default false for rollout.
- Reuse existing `single_page_capture_enabled` and `ocr_processing_enabled`, both default false.

**Outputs**

- Tested shared contracts in `packages\types`, `packages\auth`, `packages\validators`,
  `packages\config`, and `packages\jobs`.

**Acceptance criteria**

- Role matrix matches `M2-DEC-006`.
- Developer/QA source reads remain non-mutations on archived projects.
- Invalid source/filter/job/config shapes fail deterministically.

### Phase 2: Database schema and immutability guards

**Depends on:** Phase 1.

**Tasks**

- Add upload-session, upload-file, source-document, source-document-file, source-extraction,
  source-chunk, and reference-artifact tables.
- Add constraints, indexes, optimistic concurrency, version-chain rules, and duplicate lookup.
- Add no-delete/no-truncate and immutable-column triggers.
- Add append-only extraction/chunk and attestation rules.
- Add database guard tests using the existing Testcontainers pattern.

**Outputs**

- Drizzle schema and additive migrations.
- Guard tests and updated database exports.

**Acceptance criteria**

- Migration replay succeeds from an empty database.
- Forbidden source mutation/delete/truncate operations fail at the database layer.
- Upload-session expiry cleanup remains possible.
- A version cannot have multiple successors.

### Phase 3: Storage, bucket bootstrap, and ClamAV

**Depends on:** Phase 1. May run in parallel with Phase 2 until repository integration.

**Tasks**

- Replace storage placeholders with the real S3-compatible client.
- Implement signed PUT/GET, stat, stream, and server-generated object upload.
- Add idempotent bucket bootstrap and required versioning probe.
- Pin MinIO image and configure private CORS.
- Add ClamAV client, healthcheck, streaming scan, typed failures, and fixture tests.
- Add immutable key purposes for original, reference snapshot, and derived preview objects.

**Outputs**

- Real `packages\storage`.
- `storage-bootstrap` Compose service.
- Healthy MinIO/ClamAV Module 2 profile.

**Acceptance criteria**

- Bucket bootstrap is idempotent and versioning is verified.
- Authorization is required before signing.
- Expiry bounds are enforced.
- EICAR is detected and clean 100 MiB streaming stays bounded in memory.
- Core profile can still boot without Module 2 storage.

### Phase 4: API source lifecycle

**Depends on:** Phases 2 and 3.

**Tasks**

- Implement upload-session, confirm/cancel, list/detail, metadata, archive/restore, replacement,
  manual, reference, IP-review, retry, version, chunk, preview, and download endpoints.
- Repeat duplicate checks at session creation and confirmation.
- Atomically create source records, version links, and audit events.
- Enqueue processing with stable job IDs.
- Enforce all authorization, feature flags, and stable errors.
- Extend dashboard summary.
- Regenerate OpenAPI and typed client.

**Outputs**

- NestJS Module 2 feature modules and tests.
- Generated OpenAPI/client changes.

**Acceptance criteria**

- Unauthorized and cross-tenant requests fail.
- No confirmed source can be overwritten or deleted.
- Duplicate confirmation, replacement, archive/restore, manual, and reference flows are
  transactionally correct.
- Signed URLs are never returned for quarantined sources.

### Phase 5: Worker verification, scan, extraction, preview, and capture

**Depends on:** Phases 2 and 3. API enqueue integration depends on the Phase 1 job contract.

**Tasks**

- Replace only the `document-processing` placeholder handler.
- Implement verify/hash, scan, extraction, preview, capture, and upload-session-expiry handlers.
- Add parser adapters and golden fixtures for every V1 format.
- Add append-only extraction versions and deterministic chunks.
- Add safe ZIP/container limits.
- Add retry/unrecoverable classification and database idempotency.
- Add feature-flagged Playwright capture with SSRF and resource controls.

**Outputs**

- Worker handlers, fixtures, unit tests, and a new worker integration-test target.

**Acceptance criteria**

- Every format fixture produces stable output.
- Worker restart/replay yields one effective result.
- Infected, mismatched, unsafe, or corrupt content never reaches extraction/preview.
- Capture is impossible when disabled and cannot access private networks.

### Phase 6: Web Source Document Vault

**Depends on:** Phase 4 contract stable; Phase 5 status transitions defined.

**Tasks**

- Replace the Source Documents placeholder with list/detail routes.
- Add Uppy intake drawer, hashing worker, progress, duplicate confirmation, and confirmation flow.
- Add manual and reference intake, attestation, IP review, capture flag, and screenshot-set support.
- Add safe preview, extracted text, version history, processing timeline, activity, and download.
- Add role-aware actions and complete loading/empty/error/read-only/offline/access states.
- Update dashboard source counts.
- Add typed hooks, cache invalidation, MSW handlers, and component tests.

**Outputs**

- Production Module 2 web experience using Cartographer.

**Acceptance criteria**

- All confirmed roles see only allowed actions.
- Client role cannot route into the vault.
- Duplicate, manual replacement, archive/restore, reference review, and capture-disabled states are
  covered.
- No unsafe HTML or remote content is embedded.

### Phase 7: Integration, hardening, CI, and rollout

**Depends on:** Phases 4, 5, and 6.

**Tasks**

- Add real MinIO/ClamAV worker integration tests and root/CI script wiring.
- Add API integration and Playwright source lifecycle specs.
- Add large-file, zip-bomb, SSRF, retry, duplicate-race, and permission tests.
- Add Bull Board behind authenticated internal Admin/operator access.
- Add structured operational events and readiness checks.
- Document local Module 2 profiles and environment variables.
- Roll out writes to an internal organization first, then selected organizations.

**Outputs**

- Green CI and deployment runbook.
- Feature-flag rollout and rollback procedure.

**Acceptance criteria**

- Turning `source_vault_writes_enabled` off blocks new writes but preserves reads/downloads.
- No destructive schema rollback is required.
- Full Module 2 E2E passes against PostgreSQL, Redis, MinIO, ClamAV, API, worker, and web.

> Current baseline note: the E2E item above is still the main remaining gap unless the source-vault
> Playwright pack has already landed on the current branch.

### Phase 8: Module 3 handoff

**Depends on:** Phase 7.

**Tasks**

- Freeze the read contract for ready current source versions, latest successful extraction, chunks,
  and cleared references.
- Extend AI-run input artifact version data to carry source ID, source version, source hash,
  extraction ID/version, chunker version, and storage version IDs.
- Document that Module 3 has read-only access and creates separate requirement/citation records.
- Confirm not-reviewed/restricted references are excluded from eligible-source queries.

**Outputs**

- Stable Module 3 evidence-input contract.

**Acceptance criteria**

- Module 3 planning requires no mutation or redesign of Module 2 source tables.
- Every AI run can identify the exact immutable source and extraction version it consumed.

## 15. Testing and validation gates

### Existing repository commands

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm openapi:check
pnpm api-client:check
pnpm db:check
pnpm docker:check
pnpm db:migrate:deploy
pnpm provision:admin
pnpm test:api:integration
pnpm test:web:components
pnpm test:e2e
```

Module 2 local runtime commands:

```text
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile core --profile worker --profile storage --profile scan up
docker compose --profile core --profile bootstrap run --rm bootstrap
docker compose --profile storage run --rm storage-bootstrap
```

`pnpm test:e2e` already exists, but the dedicated source-vault Playwright pack is still a remaining
gap until those specs land.

Targeted package commands already available:

```text
pnpm --filter @atlashq/types test
pnpm --filter @atlashq/auth test
pnpm --filter @atlashq/config test
pnpm --filter @atlashq/validators test
pnpm --filter @atlashq/db test
pnpm --filter @atlashq/storage test
pnpm --filter @atlashq/jobs test
pnpm --filter @atlashq/worker test
pnpm --filter @atlashq/api test
pnpm --filter @atlashq/web test
```

Phase 5/7 adds a worker integration target; only after it exists:

```text
pnpm --filter @atlashq/worker test:integration
```

### Required coverage

- **Database:** migration replay, immutable columns, delete/truncate guards, append-only extraction,
  version-chain constraints, upload-session expiry.
- **Storage:** key safety, signing authorization/expiry, bucket bootstrap/versioning, CORS, stat,
  stream, and no credential leakage.
- **Upload boundaries:** 100 MiB succeeds; 100 MiB + 1 byte fails before signing and again at
  confirmation.
- **File safety:** extension/MIME/magic mismatch, corrupt Office ZIP, archive bomb, EICAR, scanner
  unavailable, hash mismatch.
- **API:** RBAC matrix, cross-org/project isolation, duplicate acknowledgement, idempotent confirm,
  archive/restore, replacement, manual text, attestation, IP review, capture flag, retry.
- **Worker:** every format fixture, deterministic chunks, parser versions, transient retry,
  unrecoverable failure, restart/replay idempotency, bounded memory.
- **Capture security:** private/loopback/link-local/cloud-metadata IP, DNS rebinding/redirect, timeout,
  oversized resources, login/auth attempt.
- **Web:** all intake modes, progress/cancel/retry, duplicate dialog, processing timeline, safe
  preview, version history, archive, role affordances, accessibility, error/read-only/offline states.
- **E2E:** upload -> scan -> extract -> preview/download; duplicate cancel/confirm; replace; manual
  version; reference attestation and Admin/Owner clearance.
- **Contract:** OpenAPI and generated client drift.
- **Docker:** combined `core`, `worker`, `storage`, and `scan` profiles plus storage bootstrap.

## 16. Rollout and rollback

### Feature flags

| Flag | Default | Purpose |
|---|---|---|
| `source_vault_writes_enabled` | off during rollout | Blocks new intake/mutations while preserving reads |
| `single_page_capture_enabled` | off | Enables explicit one-page reference capture |
| `ocr_processing_enabled` | off | Reserved for later image OCR |

Writes-off is a rollout brake, not a read outage: list/detail/version/extraction/chunk/preview and
download paths remain available for already-confirmed clean sources; only write paths and capture
mutations are blocked.

### Rollout

1. Deploy additive migrations and code with vault writes off.
2. Bootstrap and verify MinIO bucket versioning.
3. Verify ClamAV health/signature updates and worker readiness.
4. Enable writes for an internal organization.
5. Validate upload, scan, extraction, preview, download, audit, failure, and rollback paths.
6. Enable selected external organizations.
7. Make writes generally available only after operational thresholds are stable.

### Rollback

- Turn off `source_vault_writes_enabled`.
- Preserve list, detail, history, preview, and download for existing sources.
- Stop new worker intake while allowing in-flight jobs to finish or be safely retried.
- Roll back API/web/worker images if required.
- Keep additive evidence tables and objects. Do not drop production source data to roll back code.

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| MinIO versioning is absent or disabled | Idempotent bootstrap, startup/readiness probe, block writes, critical log event |
| Browser hashing blocks the UI | Web Worker and per-file progress; 100 MiB cap |
| Client-provided hash or MIME is false | Worker streaming hash and actual-type/container validation |
| Malware reaches a parser | ClamAV clean verdict required before extraction/preview |
| Office archive bomb or parser CVE | Entry/ratio/size/time limits, pinned dependencies, worker isolation, fixtures |
| One-page capture becomes SSRF/crawling | Flag off, public HTTP/HTTPS only, IP/redirect revalidation, isolated browser, strict limits |
| Duplicate warning races | Repeat check at confirmation; duplicates remain allowed only with explicit acknowledgement |
| Version chain forks | Unique `supersedes_id`, transactional replacement, restore restrictions |
| Abandoned uploads accumulate | Ephemeral sessions, TTL cleanup, no immutable source record until confirmation |
| Processing status and queue state diverge | DB state is authoritative; idempotent handlers; audit and reconciliation job |
| Infected objects remain stored | Quarantine state blocks all signed reads; archive-only guarantee preserved |
| Reference rights status becomes stale | New content always creates a new version and resets IP review |
| Module 2 accidentally implements Module 3 | No requirement/citation/reference-feature workflows; handoff is read-only |

## 18. External guidance reviewed

- OWASP File Upload Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>
- Uppy AWS S3 integration:
  <https://uppy.io/docs/aws-s3/>
- AWS presigned upload behavior:
  <https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html>
- Better Auth security reference:
  <https://better-auth.com/docs/reference/security>
- MinIO JavaScript SDK:
  <https://docs.min.io/aistor/developers/sdk/javascript/>
- ClamAV scanning:
  <https://docs.clamav.net/manual/Usage/Scanning.html>
- Drizzle indexes and constraints:
  <https://orm.drizzle.team/docs/indexes-constraints>
- PostgreSQL multicolumn and partial indexes:
  <https://www.postgresql.org/docs/current/indexes-multicolumn.html>
- Testcontainers for Node:
  <https://node.testcontainers.org/features/containers/>
- OfficeParser PPTX/office parsing:
  <https://github.com/harshankur/officeparser>

## 19. Final acceptance checklist

- [ ] Module 1 baseline remains green and completed foundations are reused.
- [ ] Full V1 format matrix is implemented with exact allowlist and deterministic behavior.
- [ ] `sources:read`/`sources:write` role grants match the confirmed matrix.
- [ ] Upload sessions expire without creating immutable evidence.
- [ ] Confirmed sources and original file rows reject delete/truncate and content mutation.
- [ ] Replacement creates a new version with a non-forking lineage.
- [ ] Duplicate matches require explicit acknowledgement and remain separate records.
- [ ] Manual text is stored as immutable evidence and corrected only by new version.
- [ ] Reference attestation text/version/actor/time are immutable and audit linked.
- [ ] Only Admin/Owner can clear or restrict reference IP review.
- [ ] New reference versions reset IP review to `not_reviewed`.
- [ ] MinIO bucket is private, versioned, and verified before writes.
- [ ] Object lock is not introduced in V1.
- [ ] Uploads are limited to 100 MiB by default and validated at multiple layers.
- [ ] Actual type, safe archive limits, SHA-256, and ClamAV verdict are enforced before parsing.
- [ ] Quarantined sources never receive preview/download URLs.
- [ ] Every supported format has deterministic fixture coverage.
- [ ] Extraction runs and chunks are versioned and append-only.
- [ ] OCR remains off without making image upload/preview fail.
- [ ] Single-page capture is off by default and passes SSRF/resource isolation tests.
- [ ] API operations use Zod DTOs, stable errors, OpenAPI, and generated client types.
- [ ] Source list/detail/intake/reference/version UI consumes Cartographer and covers all states.
- [ ] Client Viewer / Approver cannot access Source Document Vault routes or APIs.
- [ ] Audit covers source creation, mutation, processing, download requests, attestation, and review.
- [ ] Correlation IDs propagate across API, BullMQ, worker, logs, and audit.
- [ ] Existing root gates and new Module 2 integration/E2E tests pass.
- [ ] Turning vault writes off preserves existing source reads/downloads.
- [ ] Module 3 can read exact immutable source/extraction versions without mutating Module 2 data.

## 20. Troubleshooting

- **Storage unavailable:** check the `storage` profile, MinIO health, `storage-bootstrap`, and
  `S3_REQUIRE_BUCKET_VERSIONING=true`. The API returns `SOURCE_STORAGE_UNAVAILABLE` when storage or
  the queue is not wired, and worker readiness will report bucket/versioning failures.
- **Bucket versioning disabled:** rerun `storage-bootstrap` after enabling versioning; confirmed
  source writes require a real object version ID.
- **Scan unavailable:** restart the `scan` profile and wait for ClamAV signatures to settle; the
  worker reports a retryable scanner failure when the TCP service is missing or times out.
- **Queue failure / failed retry:** a successful DB write can still surface 503 if Redis/BullMQ is
  unavailable. Retry once the queue is healthy again; quarantined or infected sources must be
  replaced, not retried in place.
- **Quarantined source replacement:** `retry-processing` only accepts genuinely failed sources with
  no infected file evidence. Quarantined sources keep their evidence and must be superseded by a
  new version.
- **Signed URL / CORS:** the browser origin used by Caddy or Vite must match `WEB_ORIGIN`, and
  MinIO CORS must allow that origin. If you browse through the compose Caddy proxy, use
  `http://localhost:8080`.
- **Capture disabled / SSRF:** reference capture requires `single_page_capture_enabled` and the
  worker-local `REFERENCE_CAPTURE_ENABLED=true` flag. The capture adapter still blocks private or
  rebinding targets; `SOURCE_CAPTURE_DISABLED` and `SOURCE_CAPTURE_URL_BLOCKED` are expected
  responses when those protections trigger.

## 21. Module 3 read-only handoff appendix

### Eligible sources

Module 3 may consume only current head versions on active projects when the source is ready:

- `project.status = 'active'`.
- `source_document.archivedAt` is `null`.
- `source_document.processingStatus = 'ready'`.
- The row is the current lineage head (`supersedesId` is `null` for a root or no newer successor
  exists).
- Reference rows are eligible only when `reference_artifact.ipReviewStatus = 'cleared'`.
- Exclude `quarantined`, `failed`, and in-flight statuses, plus `reference_artifact` rows that are
  `not_reviewed` or `restricted`.

### Read-only evidence fields

Module 3 must never mutate any column on these tables:

- `source_document`: `id`, `organizationId`, `projectId`, `lineageId`, `versionNumber`,
  `supersedesId`, `sourceType`, `documentFormat`, `title`, `notes`, `tags`, `provenanceDate`,
  `contentHash`, `duplicateAcknowledgedMatchIds`, `duplicateAcknowledgedAt`,
  `duplicateAcknowledgedBy`, `processingStatus`, `aiProcessingStatus`, `createdAt`, `createdBy`,
  `updatedAt`, `updatedBy`, `archivedAt`, `archivedBy`, `version`.
- `source_document_file`: `id`, `sourceDocumentId`, `ordinal`, `role`, `originalFileName`,
  `downloadFileName`, `format`, `declaredMimeType`, `byteSize`, `sha256`, `objectKey`,
  `objectVersionId`, `scanStatus`, `scanResult`, `scanSignatureVersion`, `scannedAt`, `createdAt`.
- `source_extraction`: `id`, `sourceDocumentId`, `extractionVersion`, `status`, `parserManifest`,
  `chunkerVersion`, `extractedTextHash`, `previewObjectKey`, `previewObjectVersionId`,
  `startedAt`, `completedAt`, `failureCode`, `failureDetail`, `createdAt`.
- `source_chunk`: `id`, `organizationId`, `projectId`, `sourceDocumentId`, `sourceExtractionId`,
  `sequence`, `content`, `characterCount`, `contentHash`, `locator`, `createdAt`.
- `reference_artifact`: `id`, `sourceDocumentId`, `organizationId`, `projectId`,
  `referenceKind`, `captureMethod`, `accessType`, `intendedUse`, `sourceUrl`,
  `ipReviewStatus`, `ipReviewReason`, `ipReviewedBy`, `ipReviewedAt`, `attestationText`,
  `attestationVersion`, `attestedBy`, `attestedAt`, `auditEventId`, `capturedAt`, `createdAt`.

### AI-run artifact version tuple

`ai_run.input_artifact_versions` should carry one opaque read-only descriptor per consumed
artifact. The descriptor must identify:

- `source_document.id`
- `source_document.versionNumber`
- `source_document.contentHash`
- `source_document_file.objectVersionId`
- `source_document_file.sha256`
- `source_extraction.id`
- `source_extraction.extractionVersion`
- `source_extraction.chunkerVersion`
- `reference_artifact.ipReviewStatus` when the input came from a reference source

The tuple is provenance only; Module 3 must not back-write any Module 2 evidence row.

### Ordering and cursor rules

- Source list queries sort newest-first by `createdAt desc, id desc`.
- Version lists sort newest-first by `versionNumber desc`.
- Extraction lists sort newest-first by `extractionVersion desc`.
- Chunk lists sort by `sequence asc, id asc`.
- Cursor pagination uses a base64url `{ createdAt, id }` cursor shape for all three list
  families, with limit+1 paging and `nextCursor` from the final returned row.

### Never mutate from Module 3

Module 3 must treat the full Source Vault as read-only input. It may create its own requirements,
citation, or analysis records, but it must never update or delete any Module 2 evidence row,
relationship, or version field.
