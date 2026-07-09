# Contributing and Quality Workflow

Before opening a change, run the smallest local gate that covers your work. For
repository setup or cross-package changes, run:

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

Use Biome for formatting and linting. Do not add ESLint or Prettier unless an
accepted plan changes the repository standard.

Keep changes scoped to the active implementation plan. Do not commit real
secrets, generated local environment files, nested lockfiles, or feature
scaffolding outside the approved module boundary.
