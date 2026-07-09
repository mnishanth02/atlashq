# Implementation Plan Conventions

Implementation plans live in this directory and should stay traceable to
`docs/core/` and `docs/architecture/`.

Each plan should include:

- Purpose and module boundary.
- Source anchors.
- Confirmed requirements.
- Assumptions.
- Out-of-scope items.
- Risks.
- Acceptance criteria and validation commands.

Plans should preserve the V1 lightweight scope. Do not introduce Next.js,
AWS/Azure managed service scaffolding, pgvector, CRDT editing, heavy project
management, or full client portal behavior unless an accepted architecture
decision explicitly changes the scope.
