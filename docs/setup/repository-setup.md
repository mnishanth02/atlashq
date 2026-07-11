---
title: AtlasHQ Repository Setup
status: active
last_updated: 2026-07-11
source_plan: ../impl-plan/00-project-repository-setup.md
---

# AtlasHQ Repository Setup

This repository is the Phase 0-6 foundation for AtlasHQ V1. It is a pnpm,
Turborepo, Biome, and TypeScript monorepo with placeholders only; feature work
starts in module plans.

## Local prerequisites

- Node.js `24.13.1` from `.nvmrc`.
- pnpm `11.10.0` from the root `packageManager` field.
- Docker Desktop or another Docker Compose CLI for full compose validation.

Use pnpm only. Do not commit npm or Yarn lockfiles.

## Module 2 local stack

Module 2 requires four compose profiles:

| Profile | What it starts |
|---|---|
| `core` | Caddy, API, web, Postgres, Redis |
| `worker` | worker runtime plus the shared migration service |
| `storage` | MinIO plus `storage-bootstrap` |
| `scan` | ClamAV |

Recommended local stack for Module 2 work:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile core --profile worker --profile storage --profile scan up
```

Initial admin provisioning is explicit and separate:

```powershell
INITIAL_ADMIN_ORG_NAME=... INITIAL_ADMIN_NAME=... INITIAL_ADMIN_EMAIL=... INITIAL_ADMIN_PASSWORD=... docker compose --profile core --profile bootstrap run --rm bootstrap
```

If you need to rerun storage bootstrap on its own:

```powershell
docker compose --profile storage run --rm storage-bootstrap
```

## Bootstrap

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Run contract, database, and infrastructure gates before opening a PR:

```powershell
pnpm openapi:check
pnpm api-client:check
pnpm db:check
pnpm docker:check
```

`docker:check` validates Docker Compose and Caddy configuration. Because app
Dockerfiles are intentionally not present yet, CI does not build images; image
builds become required when Dockerfiles are introduced.

## Environment files

- Keep real secrets out of git.
- Use per-app examples only:
  - `apps/web/.env.example`
  - `apps/api/.env.example`
  - `apps/worker/.env.example`
- Do not create a root `.env`.
- Web env values must stay frontend-safe and use `VITE_*`.
- Server-only values such as database URLs, auth secrets, storage credentials,
  GitHub tokens, and AI provider keys must stay in API or worker environments.

Examples use placeholder values only. Replace them locally or in your external
secret manager; never paste real values into docs, source, or handoff files.

## Module 2 runtime environment

The `@atlashq/config` package now validates the Module 2 API, worker, and
storage environment contracts.

### `apps\api` / core API boot

Required:

- `NODE_ENV` — default `development`.
- `PORT` — default `3000`.
- `DATABASE_URL`.
- `REDIS_URL`.
- `AUTH_SECRET` — at least 32 characters.
- `AUTH_URL`.
- `WEB_ORIGIN`.
- `LOG_LEVEL` — default `info`.

Optional for core boot, but part of the Source Vault contract when supplied:

- `S3_ENDPOINT`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES` — default `104857600`.
- `SOURCE_UPLOAD_SESSION_TTL_SECONDS` — default `86400`.
- `SOURCE_UPLOAD_URL_TTL_SECONDS` — default `900`.
- `SOURCE_DOWNLOAD_URL_TTL_SECONDS` — default `600`.
- `S3_REQUIRE_BUCKET_VERSIONING` — default `true`.

Safe local values:

- `AUTH_URL=http://localhost:8080`
- `WEB_ORIGIN=http://localhost:8080`
- `REDIS_URL=redis://localhost:6379`
- `S3_ENDPOINT=http://localhost:9000`
- `S3_ACCESS_KEY_ID=local-compose-minio-access`
- `S3_SECRET_ACCESS_KEY=local-compose-minio-secret`
- `S3_BUCKET=atlashq-local`

### `apps\worker` / Module 2 worker

Required:

- `NODE_ENV` — default `development`.
- `DATABASE_URL`.
- `REDIS_URL`.
- `S3_ENDPOINT`.
- `S3_ACCESS_KEY_ID`.
- `S3_SECRET_ACCESS_KEY`.
- `S3_BUCKET`.
- `LOG_LEVEL` — default `info`.
- `WORKER_CONCURRENCY` — default `2`.
- `SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES` — default `104857600`.
- `SOURCE_UPLOAD_SESSION_TTL_SECONDS` — default `86400`.
- `SOURCE_UPLOAD_URL_TTL_SECONDS` — default `900`.
- `SOURCE_DOWNLOAD_URL_TTL_SECONDS` — default `600`.
- `S3_REQUIRE_BUCKET_VERSIONING` — default `true`.
- `CLAMAV_HOST` — default `clamav`.
- `CLAMAV_PORT` — default `3310`.
- `CLAMAV_TIMEOUT_MS` — default `30000`.
- `REFERENCE_CAPTURE_TIMEOUT_MS` — default `20000`.
- `REFERENCE_CAPTURE_MAX_REDIRECTS` — default `5`.
- `REFERENCE_CAPTURE_MAX_RESPONSE_BYTES` — default `26214400`.
- `REFERENCE_CAPTURE_MAX_TOTAL_BYTES` — default `78643200`.

Optional:

- `OPENAI_API_KEY`.
- `ANTHROPIC_API_KEY`.
- `REFERENCE_CAPTURE_ENABLED` — worker-local flag, default off unless set to `true`.

Safe local values:

- Use the same local MinIO and Redis values listed above.
- Leave the AI keys unset, or use a throwaway placeholder such as
  `replace-with-local-development-key`.

## Quality workflow

Root scripts delegate to Turborepo package tasks:

| Command | Purpose |
|---|---|
| `pnpm lint` | Biome lint/import checks |
| `pnpm format:check` | Biome formatting check |
| `pnpm format` | Biome safe formatting and fixes |
| `pnpm typecheck` | Strict TypeScript checks |
| `pnpm test` | Unit or placeholder tests |
| `pnpm build` | App and package build outputs |
| `pnpm openapi:check` | API OpenAPI contract gate |
| `pnpm api-client:check` | Typed API client generation gate |
| `pnpm db:check` | Drizzle/migration placeholder gate |
| `pnpm docker:check` | Compose/Caddy configuration gate |

GitHub Actions runs the same gates with `pnpm install --frozen-lockfile`, so CI
fails on lockfile drift and does not require real secrets.

## Documentation conventions

- Product plans live under `docs/core/`.
- Architecture and ADRs live under `docs/architecture/`.
- Implementation plans live under `docs/impl-plan/`.
- Setup and runbook-style repository docs live under `docs/setup/`.
- Future module plans must identify source anchors, confirmed requirements,
  assumptions, out-of-scope items, risks, and acceptance criteria.

V1 intentionally excludes Next.js, AWS/Azure managed service scaffolding,
pgvector, CRDT/multiplayer editing, heavy task-management features, and a full
client portal unless a later accepted plan explicitly changes scope.
