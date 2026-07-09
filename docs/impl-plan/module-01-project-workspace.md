---
title: "Module 1 Implementation Plan: Project Workspace"
module: 1
status: "Draft - implementation roadmap"
source_docs:
  - "docs\\core\\core-plan.md"
  - "docs\\architecture\\v1-architecture-and-tech-stack.md"
owner_use: "Product, design, engineering, QA, and implementation planning for AtlasHQ V1 Module 1"
last_updated: "2026-07-09"
---

# Module 1: Project Workspace

## 1. Purpose

Module 1 creates the central workspace for every external client project or internal product initiative. It is the foundation for AtlasHQ V1: a lightweight, secure, traceable project container where teams can manage project metadata, membership, status, audit history, and readiness for source evidence intake.

This module must establish the tenancy, authorization, audit, AI provenance, and traceability foundations needed by later modules without implementing later-module workflows.

## 2. User outcomes

By the end of Module 1:

- Internal users can sign in and access projects through their organization and, for non-admin roles, project membership.
- Admins can manage all projects within their organization with audit logging; project owners can manage projects where they hold owner membership.
- Teams can classify a workspace as an external client project or an internal product.
- Each project has enough metadata to support planning, requirement intake, architecture review, baseline approval, and handoff generation later.
- Project dashboards show current workspace health using placeholder or zero-state data until later modules populate requirements, questions, risks, architecture, and handoff artifacts.
- Every major project and membership mutation is audit logged.
- Traceability primitives exist from day one so later evidence chains can link source documents, requirements, questions, baselines, decisions, architecture, and handoffs.

## 3. Module boundary

### In scope

- Login foundation and authenticated app shell required to reach project workspaces.
- Organization/tenant foundation.
- User and project membership model.
- Client management needed to attach projects to clients.
- Project CRUD, archive, status, phase, tags, priority, and ownership metadata.
- Project-scoped RBAC enforcement in API and UI affordances.
- Basic project list and project dashboard.
- Audit event foundation.
- AI run table foundation for later reproducibility and cost tracking.
- Traceability link foundation.
- Placeholder screens and empty states for Modules 2-6 handoff points.
- OpenAPI contract, typed frontend client generation, and validation patterns for project workspace endpoints.

### Out of scope for Module 1

- Source document upload, immutable file storage, previews, ClamAV scanning, and source versioning.
- AI requirement extraction, citation verification, coverage rubrics, and AI evaluation gold sets.
- Requirement review board, approval baselines, client clarification exports, and handoff generation.
- Architecture graph authoring, Mermaid rendering, and AI architecture review.
- Heavy project management, sprint boards, timesheets, resource planning, Jira replacement behavior, execution analytics, full client portal, deep GitHub sync, or financial analytics.

## 4. Source principles to preserve

- **Immutable source docs:** Module 1 prepares project containers for immutable sources but does not mutate or store source files.
- **AI as advisor:** No AI output becomes scope or project truth automatically. Module 1 only creates `ai_run` foundations for later reviewed AI actions.
- **Traceability first:** Add generic traceability links early; do not retrofit evidence chains later.
- **Lightweight V1:** Build project workspace governance, not a project management suite.
- **Secure by design:** API enforces authentication, organization membership, project membership, role permissions, audit logging, and expiring/safe access patterns where applicable.
- **Grounded AI readiness:** Later AI outputs must be reproducible and reviewable through `ai_run`, citations, audit events, and traceability links.

## 5. Functional requirements

### 5.1 Project creation

- Only Admins or org-level project creators can create a project within their organization.
- Project creation must require:
  - Project name.
  - Project type: `client` or `internal`.
  - Project owner.
  - Initial project status.
- External client projects must require a linked client record (`client_id`).
- Internal projects may omit client (`client_id` nullable) but must still support requirement clarity, architecture review, decision logging, and handoff readiness.
- On creation, the system must:
  - Transactionally create the project, assign Project Owner membership to the creator or explicitly assigned owner, and write the audit event.
  - Initialize dashboard counters/statuses to empty or not-started values.
  - Make the project eligible for Module 2 source intake.

### 5.2 Project fields

Project records must support:

- Project ID.
- Organization ID.
- Client ID, required when `type = client` and nullable only when `type = internal`.
- Name.
- Type: `client` / `internal`.
- Status.
- Owner.
- Technical lead.
- Business owner.
- Start date.
- Expected delivery or target date.
- Current phase.
- Tags.
- Priority.
- Description.
- Base fields: `created_at`, `created_by`, `updated_at`, `updated_by`, `soft_deleted_at`, and version where relevant.

Recommended controlled values:

- Status: `draft`, `active`, `on_hold`, `completed`, `archived`.
- Current phase: `intake`, `requirements`, `clarification`, `baseline`, `architecture`, `delivery`, `handoff`, `closed`.
- Priority: `low`, `medium`, `high`, `critical`.

### 5.3 Project types

- **External client project**
  - Has client context and client stakeholders.
  - Requires a linked client record before creation completes.
  - Must be ready for later approval baseline and handoff package workflows.
  - Placeholder UI should communicate that full client portal behavior is not included in V1.
- **Internal product**
  - Does not require client approval.
  - Still uses requirements, architecture review, decision logs, traceability, and handoff readiness.

### 5.4 Project list and dashboard

- Users see only projects they can access: admins within their organization, and non-admin users through project membership.
- Project list supports search, filtering, sorting, and pagination.
- Search uses PostgreSQL full-text search where available; do not add pgvector for V1.
- List fields should include name, type, client, status, owner, technical lead, target date, priority, tags, and last updated.
- Project dashboard must include simple sections:
  1. Project summary.
  2. Current requirement status.
  3. Open questions.
  4. Open risks and delivery items.
  5. Architecture review.
  6. Next actions.
- Dashboard cards for requirement status, open questions, risks, architecture, and handoff must show zeros, "not started", or setup prompts until later modules populate real counts. They must not imply real analysis has run.

### 5.5 Memberships and RBAC

- Authorization is project-scoped through `project_membership` for non-admin roles. Admins may manage all projects within their organization without per-project membership, but every admin action must still be permission-checked and audit logged.
- Permission checks must include:
  1. User is authenticated.
  2. User belongs to the organization.
  3. User has project membership, unless the user is an organization Admin acting inside that organization.
  4. User role permits the action.
  5. Target item visibility allows access.
- V1 roles:
  - Admin.
  - Project Owner.
  - Architect / Tech Lead.
  - Business Analyst / Coordinator.
  - Developer.
  - QA.
  - Client Viewer / Approver as a role constant only for V1; limited/manual export or approval behavior is deferred unless explicitly prioritized.
- API must enforce permissions; frontend must not be the authority.
- Project membership changes must be audit logged.
- Membership rows should support role, status, invited/added metadata, and soft-delete/deactivation.

### 5.6 Status lifecycle

- Project lifecycle must support creation, activation, hold, completion, archive, and restore if allowed.
- Archived projects remain visible to authorized users through an archived filter and must not be hard-deleted.
- Status changes must record actor, previous value, new value, and timestamp in audit events.
- Status transitions should be simple and configurable in code for V1; do not build a workflow engine.

### 5.7 Auditability

- Append-only `audit_event` records are required for:
  - Project create, update, archive, restore, and status changes.
  - Client create/update when used by a project.
  - Project membership add, role change, and removal/deactivation.
  - Security-relevant auth events where practical.
  - Future artifact/download/export events, with the table ready now.
- Audit events should include organization, actor, action, entity type, entity ID, before snapshot, after snapshot, and timestamp.
- UI must expose a basic project audit/activity panel or placeholder backed by real project audit events.

### 5.8 Traceability readiness

- Implement a generic `traceability_link` foundation even if Module 1 creates few or no links initially.
- Link fields:
  - Organization ID.
  - From type.
  - From ID.
  - To type.
  - To ID.
  - Relation.
  - Created by.
  - Created at.
- The model must support the later chain:
  - source document -> citation -> requirement -> delivery_item(question) -> question_response -> approval_baseline -> architecture_graph -> decision_record -> handoff_package.
- Do not encode traceability through ad hoc string columns that cannot be queried consistently.

### 5.9 Settings

- Organization settings may be stored as JSONB when flexibility is justified and validated by Zod.
- Organization-level feature flags may initially live in validated `organization.settings`; a dedicated database-backed feature flag table is deferred until per-flag defaults, rollout, or audit requirements are needed.
- Project settings should remain minimal in Module 1:
  - Default visibility.
  - Whether the project is client-facing or internal-only.
  - Optional feature flags inherited from organization settings.
- Store secret references only; never store raw secrets in project settings.

### 5.10 Handoff to Module 2

Module 1 must leave clear extension points for Module 2 Source Document Vault:

- Project detail route contains a Source Documents placeholder tab/card.
- API has project ID and membership checks ready for `/api/v1/projects/:projectId/source-documents`.
- Data model includes project and organization keys needed by source documents.
- Audit table can record source upload/replacement/processing events later.
- Traceability link table can connect sources to derived items later.
- UI empty states explain that source evidence is the next setup step.

## 6. Non-functional requirements

- **Security:** Better Auth sessions, secure cookies in production, CSRF/origin checks, Redis-backed rate limits where appropriate, and project-level authorization on every project-scoped endpoint.
- **Tenancy:** Every major table must include `organization_id`; retrofitting tenancy later is not acceptable.
- **Auditability:** Important mutations are append-only audited.
- **Reliability:** Manual project work must not depend on AI or background jobs.
- **Performance:** Project list and dashboard should feel fast for normal team-sized portfolios; use pagination and indexes on organization, status, ownership, dates, and search fields.
- **Data integrity:** Use transactions for project creation plus owner membership plus audit writes.
- **Versioning:** Major mutable business records include base fields and version where relevant; soft-delete normal business records.
- **Observability:** Structured JSON logs with request IDs, API health endpoint, and visible audit records for project context.
- **Portability:** Align with Docker Compose self-hosted V1; no AWS or Azure managed services.
- **Accessibility:** Web screens should use accessible shadcn/Radix primitives and clear empty/error/loading states.

## 7. Data model requirements

### 7.1 Core tables for Module 1

- `organization`
  - `id`, `name`, `plan`, `settings`, base fields.
- `user`
  - `id`, `organization_id`, `name`, `email`, `status`, auth linkage, base fields.
- `client`
  - `id`, `organization_id`, `name`, `contact_person`, `email`, `notes`, `status`, base fields.
- `project`
  - `id`, `organization_id`, `client_id`, `name`, `type`, `status`, `owner_id`, `tech_lead_id`, `business_owner_id`, `start_date`, `target_date`, `current_phase`, `tags`, `priority`, `description`, base fields.
  - `client_id` is required for `type = client` and nullable only for `type = internal`.
- `project_membership`
  - `id`, `organization_id`, `project_id`, `user_id`, `role`, `status`, `created_at`, `created_by`, `updated_at`, `updated_by`, `soft_deleted_at`.
- `audit_event`
  - `id`, `organization_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `before`, `after`, `at`.
- `traceability_link`
  - `id`, `organization_id`, `from_type`, `from_id`, `to_type`, `to_id`, `relation`, `created_by`, `created_at`.
- `ai_run`
  - `id`, `organization_id`, `project_id`, `agent`, `model`, `provider`, `prompt_version`, `input_artifact_versions`, `output`, `status`, `cost`, `reviewed_by`, `accepted_rejected` or an explicitly documented mapping from `review_status`, timestamps.

### 7.2 Later-module tables prepared but not implemented

Module 1 should not implement business workflows for these tables, but its schema and API patterns must not block:

- `source_document`
- `source_chunk`
- `reference_artifact`
- `reference_feature`
- `citation`
- `requirement`
- `acceptance_criterion`
- `delivery_item`
- `question_response`
- `baseline_requirement`
- `decision_record`
- `approval_baseline`
- `architecture_artifact`
- `architecture_graph`
- `external_ref`
- `export_artifact`
- `handoff_package`

### 7.3 JSONB rules

- JSONB is allowed for `organization.settings`, `audit_event.before`, `audit_event.after`, and later `ai_run.output`.
- Validate JSONB at the application layer with Zod.
- Normalize commonly queried project fields instead of hiding them in JSONB.

## 8. API requirements and contract expectations

### 8.1 API style

- Use NestJS REST APIs.
- Generate OpenAPI 3.1 documentation from controllers and DTOs.
- Generate typed frontend clients with `openapi-typescript` and `openapi-fetch`.
- Use custom TanStack Query hooks in the web app.

### 8.2 Required endpoints

Recommended Module 1 endpoints:

- `GET /api/v1/me`
- `GET /api/v1/organizations/current`
- `GET /api/v1/clients`
- `POST /api/v1/clients`
- `GET /api/v1/clients/:clientId`
- `PATCH /api/v1/clients/:clientId`
- `POST /api/v1/clients/:clientId/archive` or equivalent deactivate endpoint
- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/:projectId`
- `PATCH /api/v1/projects/:projectId`
- `POST /api/v1/projects/:projectId/archive`
- `POST /api/v1/projects/:projectId/restore`
- `GET /api/v1/projects/:projectId/memberships`
- `POST /api/v1/projects/:projectId/memberships`
- `PATCH /api/v1/projects/:projectId/memberships/:membershipId`
- `DELETE /api/v1/projects/:projectId/memberships/:membershipId`
- `GET /api/v1/projects/:projectId/dashboard`
- `GET /api/v1/projects/:projectId/audit-events`

### 8.3 Contract rules

- Every endpoint has an operation ID.
- Every endpoint documents expected errors.
- List endpoints return consistent pagination metadata.
- Mutating endpoints write audit events.
- Project-scoped endpoints enforce project membership for non-admin roles; organization Admins may act across organization projects with audit logging.
- Client archive/deactivate behavior must prevent new client-project creation while preserving existing project history.
- DTOs use shared Zod validation where practical.
- API errors are stable enough for UI error states.
- No endpoint returns raw object storage credentials or secrets.

## 9. UI/UX requirements

### 9.1 App shell

- Authenticated app layout with navigation for projects and settings/admin areas.
- Clear organization context.
- Empty state when no projects exist.
- Access-denied state when a user lacks membership.

### 9.2 Project list

- Table or card list with search, filters, sort, loading, empty, error, and archived states.
- Visible fields: project name, client, type, status, owner, tech lead, phase, priority, target date, and updated date.
- Primary action: create project.

### 9.3 Project create/edit

- Form uses React Hook Form and Zod.
- Form supports client project and internal product flows.
- Required field validation is visible and accessible.
- Saving states and optimistic feedback are clear.
- Permission-disabled controls are visibly disabled with explanatory copy.

### 9.4 Project dashboard

- Show project summary and readiness cards:
  - Source documents: not started.
  - Requirements: not started.
  - Open questions: zero/not started.
  - Risks/delivery items: zero/not started.
  - Architecture review: not started.
  - Baseline/handoff: not started.
- Include "Next action" CTA to prepare for source intake.
- Avoid implying AI analysis has run before Module 3 exists.

### 9.5 Membership management

- Role assignment UI for authorized users.
- Clear role descriptions.
- Confirm destructive/deactivation actions.
- Audit trail visible or linked after changes.

### 9.6 Placeholder screens

- Source Documents, Requirements, Questions/Risks, Architecture, Baseline, and Handoff placeholders should be route-ready but explicitly state they are upcoming V1 modules.
- Placeholders must not fake data or imply unsupported automation.

## 10. Implementation roadmap

### Phase 0: Verify repository and architecture setup

**Depends on:** project repository setup.

**Tasks**

- Verify and consume the repository setup outputs from `00-project-repository-setup.md`; do not recreate or narrow the setup scope inside Module 1.
- Confirm pnpm workspace and Turborepo structure includes the full setup package set:
  - `apps/web`
  - `apps/api`
  - `apps/worker`
  - `packages/api-client`
  - `packages/ai`
  - `packages/auth`
  - `packages/config`
  - `packages/db`
  - `packages/doc-rendering`
  - `packages/jobs`
  - `packages/logger`
  - `packages/storage`
  - `packages/types`
  - `packages/ui`
  - `packages/validators`
- Confirm TypeScript strict mode, Biome linting/formatting, VS Code Biome workspace settings, ESM-first tooling where practical, package boundaries, and secret hygiene are already in place.
- Confirm Docker Compose profiles exist. Module 1 actively runs the core profile (`caddy`, `api`, `web`, `postgres`, `redis`); storage/scan/worker/AI profiles such as MinIO, ClamAV, and worker remain skeletons for Module 2/3 onward.
- Confirm environment validation per app/package instead of one root `.env`.
- Confirm OpenAPI generation and typed OpenAPI client generation gates exist, even if they no-op before Module 1 controllers are implemented.

**Outputs**

- Verified monorepo matching the architecture plan and repository setup document.
- Shared package dependency direction enforced.
- Local development services documented in package scripts, including the Module 1 core Compose profile.

**Acceptance criteria**

- `pnpm install`, typecheck, Biome lint/format checks, and basic builds run through Turbo.
- Apps do not import across workspace folders by relative paths.
- Module 1 implementation uses only the active subset it needs, while AI/jobs/storage/doc-rendering packages remain exports-only skeletons.

### Phase 1: Auth, tenancy, and database foundation

**Depends on:** Phase 0.

**Tasks**

- Configure Better Auth with PostgreSQL/Drizzle adapter.
- Add organization and user schema.
- Add Drizzle migrations and database client package.
- Include initial PostgreSQL extension migrations for `pg_trgm` and `unaccent` to support V1 full-text/fuzzy search without pgvector.
- Add request logging, correlation/request IDs, and API health endpoint.
- Add base auth guards and organization context resolution.

**Outputs**

- Authenticated API and web shell.
- Organization-aware user context.
- Initial migrations.

**Acceptance criteria**

- Authenticated requests resolve current user and organization.
- Unauthenticated requests to protected routes are rejected.
- Database migrations apply cleanly in local/test environments.

### Phase 2: Project, client, membership, audit, and traceability schema

**Depends on:** Phase 1.

**Tasks**

- Implement `client`, `project`, `project_membership`, `audit_event`, `traceability_link`, and `ai_run` schema.
- Add indexes for organization, project status, project membership, audit entity, and project search.
- Add constraints or validation so `client_id` is required for client projects and nullable only for internal products.
- Implement repository/service methods with transactions for mutating workflows.
- Add append-only audit helper.

**Outputs**

- Core Workspace database model.
- Audit and traceability primitives ready for later modules.

**Acceptance criteria**

- Project creation can atomically create project, Project Owner membership for the creator or assigned owner, and audit event.
- Project mutations never hard-delete business records.
- Traceability link records can be created and queried generically.

### Phase 3: API contracts and RBAC

**Depends on:** Phase 2.

**Tasks**

- Implement Module 1 REST endpoints.
- Add DTOs, validation, error responses, operation IDs, and OpenAPI generation.
- Implement role policy checks for Admin, Project Owner, Architect/Tech Lead, Business Analyst/Coordinator, Developer, and QA.
- Implement client detail/update/archive or deactivate endpoints, with archived clients unavailable for new client projects.
- Generate typed API client package and query hooks.

**Outputs**

- OpenAPI 3.1 contract for Module 1.
- Project-scoped RBAC enforcement.
- Typed frontend client.

**Acceptance criteria**

- Users cannot list, view, edit, archive, or manage membership for projects outside their membership/role.
- Admin organization-wide access is explicitly tested and audit logged.
- Mutating project and membership endpoints write audit events.
- OpenAPI spec and generated client checks pass.

### Phase 4: Web project workspace UI

**Depends on:** Phase 3.

**Tasks**

- Build authenticated app shell.
- Build project list with loading, empty, error, filtered, archived, and access-denied states.
- Build create/edit project forms.
- Build client selector/creation path required by client projects.
- Build project dashboard and placeholder module cards.
- Build membership management and audit/activity panel.

**Outputs**

- Usable Module 1 web experience.
- Route-ready placeholders for Module 2 and later V1 modules.

**Acceptance criteria**

- Users can create, view, edit, archive, restore, and navigate projects they are allowed to access.
- Users see clear empty states and no fake later-module data.
- UI actions use typed client hooks and display API validation errors.

### Phase 5: Validation, hardening, and handoff to Module 2

**Depends on:** Phase 4.

**Tasks**

- Add API unit/integration tests for project service, RBAC guards, and audit behavior.
- Add frontend component tests for project list, forms, dashboard, and access states.
- Add Playwright smoke for login -> create project -> view dashboard -> archive.
- Validate health endpoints, logs, and Docker Compose local startup.
- Confirm Module 2 route/API extension points are present.

**Outputs**

- Verified Module 1 foundation.
- Implementation notes for Module 2 Source Document Vault.

**Acceptance criteria**

- Test and static quality gates pass.
- Project workspace supports the V1 milestone outcome: workspaces can be managed with tenancy, audit, AI provenance, and traceability foundations laid early.

## 11. Testing and validation gates

- **Schema/migration tests:** Drizzle migration check and rollback/forward strategy where supported.
- **API unit tests:** project services, policy checks, audit helper, validation errors.
- **API integration tests:** Supertest + Testcontainers against PostgreSQL/Redis for auth-protected project flows.
- **Frontend tests:** Vitest, Testing Library, and MSW for project list, forms, dashboard, membership, and audit states.
- **E2E smoke:** Playwright for login and basic project lifecycle.
- **Contract checks:** OpenAPI generation and typed client generation must be part of CI.
- **Static gates:** TypeScript strict mode, Biome lint/format checks, and Docker checks. Compose config validation is acceptable until Dockerfiles exist; Docker image builds become required once app Dockerfiles are introduced.
- **Security checks:** verify project membership is enforced server-side and archived/soft-deleted records are not accidentally exposed.

## 12. Risks, assumptions, and decisions to confirm

### Risks

- Retrofitting tenancy, RBAC, or traceability later would be expensive; implement foundations now.
- Overbuilding project management could distract from requirement-to-handoff intelligence.
- Placeholder screens could confuse users if they imply unsupported AI or document processing behavior.
- Role granularity may be too broad or too narrow; keep policy definitions explicit and test-covered.
- Client Viewer / Approver can create scope creep; keep V1 limited/manual unless explicitly prioritized.

### Assumptions

- Repository setup may not exist yet and is a prerequisite for implementation.
- Better Auth email/password is sufficient for V1 authentication.
- PostgreSQL full-text search is enough for project search in V1.
- Internal teams are the primary users for V1; client portal behavior is deferred.
- Module 1 will not run AI, but must store AI provenance foundations for later modules.

### Decisions to confirm

- Final allowed project status and phase values.
- Whether internal products require a business owner.
- Whether project restore from archive is allowed for all Project Owners or only Admins.
- Whether Client Viewer / Approver ever moves beyond a role constant and exported/manual approval workflows in V1.
- Whether project tags are free-form strings or organization-managed labels in V1.

## 13. Final acceptance checklist

- [ ] Project workspace doc aligns to V1 only and avoids deferred heavy project management features.
- [ ] Project CRUD, archive, list, dashboard, and settings requirements are defined.
- [ ] Project type behavior is defined for external client projects and internal products.
- [ ] Client projects require `client_id`; internal products are the only projects where `client_id` may be null.
- [ ] Project field requirements match the core plan.
- [ ] Membership and project-scoped RBAC are specified.
- [ ] Admin organization-wide access is reconciled with non-admin project membership requirements and audit logging.
- [ ] Status lifecycle and auditability are specified.
- [ ] Traceability readiness is included from day one.
- [ ] Organization, user, client, project, membership, audit event, AI run, and traceability data requirements are defined.
- [ ] API paths, OpenAPI expectations, typed client expectations, validation, and error handling are defined.
- [ ] UI states include loading, empty, error, archived, access denied, and placeholder screens.
- [ ] Implementation phases include sequence, dependencies, outputs, and acceptance criteria.
- [ ] Testing and validation gates cover schema, API, frontend, E2E, contracts, and security.
- [ ] Risks, assumptions, and decisions to confirm are documented.
- [ ] Handoff to Module 2 Source Document Vault is explicit.
