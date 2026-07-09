---
title: AtlasHQ Project Repository Setup Requirements and Roadmap
status: draft
source_docs:
  - docs/core/core-plan.md
  - docs/architecture/v1-architecture-and-tech-stack.md
owner_use: Implementation planning baseline for repository setup before Module 1 development
last_updated: 2026-07-09
---

# AtlasHQ Project Repository Setup Requirements and Roadmap

## 1. Purpose and Outcome

This document defines the detailed requirements and implementation roadmap for preparing the AtlasHQ repository before Module 1, Project Workspace, begins.

The outcome is a clean, validated monorepo foundation that supports the V1 architecture:

- `pnpm` workspaces and Turborepo orchestration.
- React + Vite + TanStack Router web app placeholder with the form/table libraries Module 1 will need.
- NestJS API placeholder.
- BullMQ worker placeholder.
- Shared TypeScript packages for database, auth, config, logging, jobs, storage, validation, API client, AI, rendering, UI, and domain types.
- Docker Compose infrastructure placeholders for PostgreSQL, Redis, MinIO, ClamAV, Caddy, API, worker, and web/static serving, grouped with profiles so early modules can run only the services they need.
- Environment, quality, documentation, and CI conventions that keep V1 lightweight, traceable, secure, and implementation-ready.

This setup is not a feature build. It creates the repository skeleton, guardrails, and placeholders needed so Module 1 can start without reworking foundational decisions.

## 2. Source Alignment

Primary source anchors:

- `docs/architecture/v1-architecture-and-tech-stack.md`
  - Sections 2, 3, 5, 6, 7, 8, 9, 15, 17, 18, 22, 24, 25, 26.
- `docs/core/core-plan.md`
  - Sections 5, 6, 7, 10, 11, 12, 16, 17, 20.

Architecture decisions supersede older broad options in the core plan where they conflict. For example, the core plan's Section 17 mentions Next.js as a possible frontend option, but the architecture document explicitly chooses React + Vite + TanStack Router and rejects Next.js for V1.

## 3. In Scope and Out of Scope

### 3.1 In Scope

- Initialize the monorepo layout and workspace metadata.
- Add root package management, TypeScript, Biome linting/formatting, testing, and Turborepo configuration placeholders.
- Add minimal app placeholders for `apps/web`, `apps/api`, and `apps/worker`.
- Add shared package placeholders with clear dependency direction.
- Add Docker Compose and Caddy placeholders for the V1 topology.
- Add environment example files and Zod-based configuration validation placeholders.
- Add placeholder auth, database, storage, queue, logging, OpenAPI, and health-check conventions.
- Add CI workflow expectations for build, lint, test, typecheck, OpenAPI generation, migration checks, and Docker build checks.
- Add documentation conventions for implementation plans, ADRs, and module plans.

### 3.2 Out of Scope

- Building Module 1 Project Workspace features.
- Implementing real login screens, project CRUD, membership logic, dashboards, or API business endpoints.
- Creating production database schema beyond placeholder migration/schema structure.
- Implementing real Better Auth flows beyond integration placeholders.
- Implementing AI extraction, document processing, exports, handoff generation, or architecture workspace features.
- Building full sprint boards, timesheets, resource allocation, client portal, pgvector search, CRDT/multiplayer editing, deep GitHub/Jira sync, or financial analytics.
- Storing or committing real secrets.

## 4. Detailed Setup Requirements

### 4.1 Repository Structure

The repository must use this initial structure:

```text
atlashq/
  apps/
    web/
    api/
    worker/
  packages/
    api-client/
    ai/
    auth/
    config/
    db/
    doc-rendering/
    jobs/
    logger/
    storage/
    types/
    ui/
    validators/
  docs/
    architecture/
    core/
    impl-plan/
  infra/
    caddy/
    docker/
  .github/
    workflows/
```

Requirements:

- Root scripts must delegate to `turbo run` and must not manually chain app/package builds.
- Workspace dependencies must use `workspace:*`.
- Cross-package imports must respect the architecture dependency direction.
- Generated outputs must be declared in `turbo.json`.
- App and package directories must include enough placeholder files for TypeScript project references or package exports to resolve cleanly.

### 4.2 Tooling

Required tooling:

- Node.js LTS pinned by `.nvmrc`, Volta, or mise. Assumption: use `.nvmrc` unless the team confirms another pinning tool.
- `pnpm` as the only package manager.
- Turborepo for `build`, `lint`, `typecheck`, `test`, `format`, `openapi`, `db:check`, and `docker:check` orchestration.
- TypeScript strict mode.
- ESM-first package and tooling configuration where practical; any CommonJS usage must be explicit and justified by tool support.
- Biome for linting and formatting. Do not add ESLint or Prettier unless a future exception is explicitly documented.
- VS Code workspace settings that make the Biome extension the default formatter and enable Biome fixes/organize-imports on save.
- Vitest for shared package tests.
- Playwright reserved for E2E once app behavior exists.

Root-level expected scripts:

- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm format`
- `pnpm openapi:check`
- `pnpm api-client:check`
- `pnpm db:check`
- `pnpm docker:check`

### 4.3 Apps

#### `apps/web`

Placeholder requirements:

- React + Vite SPA.
- TanStack Router route tree placeholder.
- TanStack Query client placeholder.
- React Hook Form and TanStack Table dependencies/placeholders, because Module 1 project forms and lists require them.
- Tailwind CSS and shadcn/ui-compatible structure placeholder.
- Frontend-safe env example with only `VITE_*` values.
- API client import placeholder from `packages/api-client`.
- No server-side framework, no Next.js, and no TanStack Start for V1.

#### `apps/api`

Placeholder requirements:

- NestJS application shell.
- REST API prefix `/api/v1`.
- Better Auth route placeholder under `/api/auth/*`.
- Health endpoint placeholder.
- OpenAPI 3.1 generation placeholder with operation ID convention.
- Pino request logging placeholder with correlation/request IDs.
- Zod or compatible DTO validation convention.
- Project-scoped authorization guard placeholder.
- Audit-event writing convention placeholder for mutating endpoints.

#### `apps/worker`

Placeholder requirements:

- BullMQ worker process shell.
- Queue registration placeholders for:
  - `document-processing`
  - `ai-analysis`
  - `citation-verification`
  - `export-generation`
  - `github-sync`
  - `maintenance`
- Idempotent job handler convention.
- Worker health endpoint or health command placeholder.
- Pino logging and correlation metadata placeholders.

### 4.4 Packages

Required package placeholders:

- `packages/api-client`: generated OpenAPI types, `openapi-fetch` wrapper, and future TanStack Query hooks.
- `packages/ai`: Vercel AI SDK wrapper, provider registry, prompt contracts, and AI run helpers.
- `packages/auth`: Better Auth config helpers, session types, permission helpers, and project-scoped RBAC types.
- `packages/config`: Zod environment schemas per app/process.
- `packages/db`: Drizzle schema, migrations directory, database client, and migration check script placeholder.
- `packages/doc-rendering`: Markdown, HTML, PDF, and export helper placeholders.
- `packages/jobs`: queue names, Zod job payload schemas, job utilities, retry/idempotency conventions.
- `packages/logger`: Pino setup, redaction defaults, correlation ID utilities.
- `packages/storage`: MinIO/S3-compatible abstraction, signed URL helper placeholders, content hash utilities.
- `packages/types`: shared domain types that are safe to import broadly.
- `packages/ui`: shared presentational UI primitives only when reuse is proven.
- `packages/validators`: shared Zod schemas and DTO validation helpers.

Dependency direction must prevent domain apps from importing implementation internals through relative paths.

AI, jobs, storage, and document-rendering packages are exports-only skeletons during setup. They exist to lock dependency direction and avoid later workspace churn, not to implement document processing, AI workflows, or export behavior before their modules.

### 4.5 Infrastructure

Required placeholders:

- `docker-compose.yml` or equivalent compose files for:
  - core profile: `caddy`, `api`, `web`, `postgres`, `redis`.
  - storage profile: `minio`.
  - scan profile: `clamav`.
  - worker/ai profile: `worker` and later AI/background job dependencies.
- Caddy config placeholder for:
  - `/` static web serving.
  - `/api/v1/*` API routing.
  - `/api/auth/*` auth routing.
  - `/health` health routing.
- Local development defaults must avoid AWS/Azure managed services.
- Docker health checks should be represented for API, worker, DB, Redis, and MinIO.
- Module 1 local startup should be possible with the core profile only; storage, scan, worker, and AI profiles remain available for Module 2/3 onward.

### 4.6 Environment and Configuration

Requirements:

- Do not use one root `.env` for all packages.
- Add examples only; never commit real secrets.
- Commit `.env.example` files, but ignore real environment/secret files including `.env`, `.env.*`, `!.env.example`, `*.pem`, `*.key`, `*.crt`, `*.p12`, and local secret override files.
- Commit a single root `pnpm-lock.yaml`; do not allow `package-lock.json`, `yarn.lock`, or nested pnpm lockfiles.
- Expected examples:
  - `apps/web/.env.example` for `VITE_API_BASE_URL` and frontend-safe values.
  - `apps/api/.env.example` for `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `AUTH_URL`, storage credentials, and server-only values.
  - `apps/worker/.env.example` for `DATABASE_URL`, `REDIS_URL`, AI provider keys, storage credentials, and worker-only values.
- `packages/config` must own Zod schemas for app-specific config validation.
- Web must never receive AI provider keys, database URLs, storage secrets, GitHub tokens, or Better Auth secrets.

### 4.7 Auth Placeholder

Requirements:

- Better Auth must be the V1 auth standard.
- Placeholder config must support email/password, environment-provided secret and URL, PostgreSQL/Drizzle adapter, secure cookies in production, origin/CSRF checks, and optional Redis-backed session/rate-limit support.
- Authorization placeholders must be project-scoped, based on organization, project membership, role, and visibility.
- V1 roles must be represented as types/constants:
  - Admin
  - Project Owner
  - Architect / Tech Lead
  - Business Analyst / Coordinator
  - Developer
  - QA
  - Client Viewer / Approver as a role constant only unless a later module explicitly enables limited/manual export or approval behavior.

### 4.8 Database Placeholder

Requirements:

- PostgreSQL is the system of record.
- Drizzle ORM and Drizzle Kit are the migration standard.
- Placeholder schema areas must leave room for:
  - Tenancy and access.
  - Source evidence.
  - Requirements and review.
  - Delivery governance.
  - Architecture.
  - AI and audit.
  - Integration and export.
- All major mutable business table conventions must include `organization_id`, `created_at`, `created_by`, `updated_at`, `updated_by`, `soft_deleted_at`, and `version` where relevant.
- Placeholder docs or code comments must note that audit tables are append-only.
- PostgreSQL full-text search is the V1 search baseline; no pgvector placeholder should be added for V1.
- Initial migration placeholders must include `pg_trgm` and `unaccent` extension setup for fuzzy and accent-insensitive text search.
- Organization-level feature flags may initially live in validated `organization.settings`; a dedicated database-backed feature flag table is deferred until per-flag defaults, rollout, or audit requirements justify it.

### 4.9 Storage and Queue Placeholder

Requirements:

- MinIO stores source documents, reference artifacts, and generated exports.
- Storage abstraction must assume immutable object keys, SHA-256 content hashes, no public buckets, expiring signed URLs, and authorization checks before URL generation.
- Redis must be used for BullMQ queues, rate limits, and short-lived operational state.
- BullMQ payload schemas must be Zod-validated.
- Job handlers must be idempotent, retryable where safe, and able to write status to related DB rows.

### 4.10 Observability and Logging

Requirements:

- Pino JSON logs for API and worker.
- Request/correlation ID propagation.
- Redaction defaults for tokens, cookies, passwords, auth secrets, storage credentials, database URLs, and AI provider keys.
- Health endpoint placeholders for API and worker.
- BullMQ dashboard placeholder decision, such as Bull Board or equivalent, for internal inspection.
- AI run cost/status reporting must be planned through `ai_run`, not ad hoc logs.

### 4.11 Documentation Conventions

Requirements:

- Implementation plans live under `docs/impl-plan/`.
- Architecture decisions remain under `docs/architecture/`.
- Product/core planning remains under `docs/core/`.
- Future module implementation documents should reference source anchors and distinguish:
  - confirmed requirements,
  - assumptions,
  - out-of-scope items,
  - risks,
  - acceptance criteria.
- Handoff and runbook docs must never include raw secrets; they may reference external secret locations only.

### 4.12 Quality Gates

Minimum gates before Module 1:

- Install succeeds with `pnpm install`.
- TypeScript strict typecheck passes.
- Biome lint passes.
- Biome formatting check passes.
- Unit test command passes, even if only placeholder tests exist.
- OpenAPI generation/check command exists and passes or clearly no-ops until controllers exist.
- Typed OpenAPI client generation/check command exists and passes or clearly no-ops until controllers exist.
- Drizzle migration check command exists and passes or clearly no-ops until schema exists.
- Docker Compose config validates. Docker image build checks may initially validate configuration only until app Dockerfiles exist, but image builds become required as soon as Dockerfiles are introduced.
- CI workflow executes the same checks.

## 5. Placeholder Deliverables Required Before Module 1

Module 1 can begin only after these deliverables exist:

1. Root workspace files:
   - `package.json`
   - `pnpm-workspace.yaml`
   - `turbo.json`
   - TypeScript, Biome lint/format, VS Code workspace, and ignore configuration.
2. App placeholders:
   - `apps/web`
   - `apps/api`
   - `apps/worker`
3. Package placeholders:
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
- Biome config:
    - `biome.json`
    - `.vscode/settings.json` for workspace formatter and code-action defaults.
4. Environment examples per app/process.
5. Docker Compose and Caddy placeholders.
6. CI workflow placeholder that runs repository quality gates.
7. Documentation stubs for:
   - local setup,
   - environment variables,
   - architecture decisions,
   - module implementation plans,
   - contribution/quality workflow.

## 6. Implementation Roadmap

### Phase 0: Confirm Setup Decisions

| Item | Tasks | Dependencies | Outputs | Acceptance Criteria |
|---|---|---|---|---|
| Runtime pinning | Choose `.nvmrc`, Volta, or mise; document chosen Node LTS version | None | Runtime version file and setup note | New contributors can identify the required Node version |
| Biome standard | Configure Biome linting, formatting, import organization, and line-ending policy | None | `biome.json` and VS Code workspace settings | Biome lint and format commands can run from root |
| Package manager policy | Lock pnpm usage and avoid npm/yarn lockfiles | None | `packageManager` field and workspace file | Repository has one package manager and one lockfile |

### Phase 1: Monorepo Foundation

| Item | Tasks | Dependencies | Outputs | Acceptance Criteria |
|---|---|---|---|---|
| Root workspace | Add root package metadata, `pnpm-workspace.yaml`, and `turbo.json` | Phase 0 | Workspace skeleton | `pnpm install` recognizes apps and packages |
| Shared TypeScript config | Add strict base config and per-project extension pattern | Root workspace | TS config files | `pnpm typecheck` can be wired through Turbo |
| Quality scripts | Add root `build`, `lint`, `typecheck`, `test`, `format` scripts | Root workspace | Script conventions | Root scripts delegate to `turbo run` |

### Phase 2: App Placeholders

| Item | Tasks | Dependencies | Outputs | Acceptance Criteria |
|---|---|---|---|---|
| Web placeholder | Add Vite React app shell, route placeholder, query client placeholder, React Hook Form/TanStack Table readiness, env example | Phase 1 | `apps/web` | Web build/typecheck participates in Turbo |
| API placeholder | Add NestJS shell, API prefix, health route, OpenAPI placeholder, logger placeholder | Phase 1 | `apps/api` | API typecheck/build participates in Turbo |
| Worker placeholder | Add worker entry point, queue registry, health command or endpoint, logger placeholder | Phase 1 | `apps/worker` | Worker typecheck/build participates in Turbo |

### Phase 3: Shared Package Placeholders

| Item | Tasks | Dependencies | Outputs | Acceptance Criteria |
|---|---|---|---|---|
| Core shared packages | Add `types`, `validators`, `config`, `logger` | Phase 1 | Package exports | Apps can import shared package placeholders via `workspace:*` |
| Domain infrastructure packages | Add `db`, `auth`, `jobs`, `storage` | Core shared packages | Package exports and minimal tests | Types compile and dependency direction is respected |
| Feature support packages | Add `api-client`, `ai`, `doc-rendering`, `ui` | Core shared packages | Package exports | Packages are empty-safe but implementation-ready |

### Phase 4: Infrastructure and Environment

| Item | Tasks | Dependencies | Outputs | Acceptance Criteria |
|---|---|---|---|---|
| Environment examples | Add per-app `.env.example` files and config schema placeholders | Phases 2-3 | Env docs and examples | Secrets are server-only and examples contain no real values |
| Docker Compose | Add compose services for Caddy, API, web, worker, Postgres, Redis, MinIO, ClamAV with core/storage/scan/worker or equivalent profiles | Phases 2-3 | Compose file | Core profile supports Module 1; full config validates without relying on AWS/Azure |
| Caddy config | Add routes for web, API, auth, and health | Docker Compose | Caddy config | Routing matches architecture topology |

### Phase 5: Contracts, Migrations, and Gates

| Item | Tasks | Dependencies | Outputs | Acceptance Criteria |
|---|---|---|---|---|
| OpenAPI gate | Add generation/check command placeholder | API placeholder | OpenAPI check script | CI can run the command without failing due to missing feature endpoints |
| Typed API client gate | Add generated client check placeholder using OpenAPI output | OpenAPI gate and API client package | Client generation script | CI can prove frontend client generation is wired before feature endpoints land |
| Drizzle gate | Add migration/schema check placeholder | DB package | DB check script | CI can verify schema/migration state |
| Test gate | Add placeholder tests for package utilities and app bootstraps | App/package placeholders | Passing test command | `pnpm test` passes through Turbo |

### Phase 6: CI and Documentation

| Item | Tasks | Dependencies | Outputs | Acceptance Criteria |
|---|---|---|---|---|
| CI workflow | Add GitHub Actions workflow for install, lint, typecheck, test, build, OpenAPI, typed API client, DB, Docker checks | Phases 1-5 | CI workflow | CI reflects local quality gates |
| Setup docs | Document local setup, env handling, quality commands, and implementation-plan conventions | Phases 1-5 | Repo setup docs | Module 1 team can bootstrap locally without undocumented steps |
| Final review | Verify no real secrets, no app feature drift, no V1 out-of-scope scaffolding | All phases | Review checklist | Repository is ready for Module 1 |

## 7. Testing, Validation Gates, and CI Expectations

Before Module 1 starts, validation should include:

```text
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm openapi:check
pnpm api-client:check
pnpm db:check
pnpm docker:check
```

CI expectations:

- Use pnpm with dependency caching.
- Fail on lockfile drift.
- Run root scripts through Turborepo.
- Validate Docker Compose configuration.
- Treat Docker image builds as required once Dockerfiles exist; before then, `docker:check` may validate Compose/configuration without pretending images were built.
- Do not require real secrets in CI.
- Use example or test environment variables only.
- Keep feature tests minimal until Module 1 exists, but ensure placeholder apps/packages compile.

## 8. Risks, Assumptions, and Decisions to Confirm

### 8.1 Risks

- Scaffold drift: app generators may create files that conflict with monorepo dependency direction.
- Early overengineering: creating full feature implementations during setup could violate V1 lightweight boundaries.
- Secret leakage: shared root `.env` or frontend env mistakes could expose server-only values.
- Toolchain mismatch: package manager or Node version inconsistency can break onboarding.
- Core-plan drift: older recommendations, especially Next.js, may conflict with the finalized architecture.

### 8.2 Assumptions

- `.nvmrc` is acceptable for Node LTS pinning unless the team prefers Volta or mise.
- GitHub Actions is acceptable for CI unless a self-hosted runner is required.
- Placeholder commands may no-op only when no real implementation exists yet, but they must be replaced as features land.
- Docker Compose is the V1 deployment baseline for local and early internal environments.

### 8.3 Decisions to Confirm

- Exact Node.js LTS version.
- Exact Biome rule strictness and any project-specific rule overrides.
- Whether Biome should organize imports on every save or only through explicit save actions in VS Code.
- Whether the repo should include a minimal generated OpenAPI artifact immediately or only a generation script.
- Whether Bull Board is the accepted queue dashboard placeholder.
- Exact timing for introducing app Dockerfiles; once introduced, CI must build images rather than only validate Compose.

## 9. Final Acceptance Checklist

- [ ] Repository uses `pnpm` workspaces and Turborepo.
- [ ] Root scripts delegate to Turbo.
- [ ] `apps/web` placeholder uses React + Vite + TanStack Router.
- [ ] `apps/web` includes React Hook Form and TanStack Table readiness for Module 1.
- [ ] `apps/api` placeholder uses NestJS REST and reserves `/api/v1` plus `/api/auth/*`.
- [ ] `apps/worker` placeholder uses BullMQ queue conventions.
- [ ] Shared packages exist with architecture-aligned boundaries.
- [ ] TypeScript strict mode is configured.
- [ ] Biome linting and formatting checks are configured.
- [ ] Per-app environment examples exist and contain no real secrets.
- [ ] Real env/secret files are ignored, examples are committed, and only one root `pnpm-lock.yaml` is used.
- [ ] Better Auth placeholder is server-only and environment-driven.
- [ ] Drizzle/PostgreSQL placeholder exists.
- [ ] Database placeholder includes `pg_trgm` and `unaccent` extension setup.
- [ ] MinIO/S3-compatible storage placeholder exists.
- [ ] Redis/BullMQ placeholder exists.
- [ ] Pino logging and correlation ID placeholders exist.
- [ ] Docker Compose and Caddy topology placeholders exist.
- [ ] CI runs install, lint, typecheck, test, build, OpenAPI, typed client generation, DB, and Docker checks.
- [ ] No Next.js, AWS/Azure managed service, pgvector, CRDT, heavy task-management, or client-portal scaffold is introduced for V1.
- [ ] Documentation explains setup conventions clearly enough for Module 1 implementation to begin.
