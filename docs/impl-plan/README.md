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

When a module has already landed or partially landed, update the module plan to
reconcile the current baseline and call out only the real remaining gaps. The
Module 2 plan in `docs\impl-plan\module-02-source-document-vault.md` follows
that pattern.
