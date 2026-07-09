---
title: AtlasHQ Repository Setup
status: active
last_updated: 2026-07-09
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
