# AtlasHQ

## Repository setup conventions

- Use Node.js `24.13.1` from `.nvmrc` (Node 24 active LTS).
- Use pnpm only. The root `package.json` pins `pnpm@11.10.0`; do not commit npm or Yarn lockfiles.
- Use pnpm workspaces under `apps/*` and `packages/*`, orchestrated by Turborepo root scripts.
- TypeScript projects should extend `tsconfig.base.json`; add project references in root `tsconfig.json` as apps and packages are introduced.
- Use Biome for linting, formatting, and import organization. Do not add ESLint or Prettier unless a future plan explicitly changes this.
- Keep real environment and secret files out of git; commit `.env.example` files only.

## Setup and quality gates

See `docs/setup/repository-setup.md` for local bootstrap, environment handling,
quality commands, CI behavior, and documentation conventions.

Useful commands:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm openapi:check
pnpm api-client:check
pnpm db:check
pnpm docker:check
```

Docker Compose dev (API + worker hot reload, Vite HMR via Caddy on
http://localhost:8080):

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile core --profile worker --profile storage up
```

Additional conventions:

- ADRs: `docs/architecture/adr/README.md`
- Implementation plans: `docs/impl-plan/README.md`
- Contribution workflow: `docs/contributing.md`
