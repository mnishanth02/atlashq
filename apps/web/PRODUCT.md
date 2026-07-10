# AtlasHQ — Product context

> This is the short brief that explains **why** the design system looks the way it does.
> The full specification lives in [`docs/core/core-plan.md`](../../docs/core/core-plan.md).

## What AtlasHQ is

AtlasHQ is an **AI‑assisted software‑delivery governance platform**. It takes the messy raw
inputs of a project — kickoff transcripts, emails, docs, scattered requirements — and turns
them into **defensible, cited artifacts**:

- **Requirements** traced back to their source evidence.
- **Approved scope baselines** with an auditable change history.
- **Architecture reviews**, **risk registers**, and **decision logs**.
- **Client‑ready handoff docs** where every claim can be traced to where it came from.

It is a dense, professional B2B instrument — closer to Linear / Notion / Stripe in register
than to a marketing site.

## The epistemic model (why the domain components exist)

AtlasHQ's core idea is that **not all information is equally trustworthy**, and the tool
should make that explicit rather than hide it. Every fact carries its epistemic status:

| Concept | In the UI |
| --- | --- |
| **Epistemic status** — is this `CONFIRMED`, `ASSUMED`, `UNKNOWN`, or `CONFLICTING`? | `EpistemicBadge` |
| **Confidence** — how sure are we? | `ConfidenceMeter` |
| **Severity** — how much does a finding/risk matter? | `SeverityIndicator` |
| **Citations** — what evidence backs this claim? | `CitationChip` + `EvidencePopover` |
| **Provenance** — where did this come from? | `ProvenanceTag` |
| **Lifecycle** — where is this artifact in its review flow? | `StatusPill` |
| **Traceability** — follow a claim from source → requirement → scope → decision. | `TraceabilityChain` |

These aren't generic UI widgets; they are the product's vocabulary. That's why they are
first‑class **domain components** ([`src/components/atlas`](./src/components/atlas)) built on
dedicated semantic tokens, kept deliberately separate from the brand accent so that
*evidence and risk never get confused with decoration*.

## How the product shapes the design

- **Register = product.** A governance instrument must feel calm, precise, and legible at
  density. The "Cartographer — Ink + Meridian Teal" direction (cool graphite neutrals, one
  confident teal accent) serves that, not a trend.
- **Trust must be visible.** Epistemic status and severity get their own color families and
  always pair color with icon + text, so trust signals survive outside of context and for
  color‑blind users.
- **Data reads as data.** Geist Mono carries IDs, citations, coordinates, and metrics.
- **Auditability implies rigor.** A tool whose whole job is defensibility can't ship
  inaccessible contrast — hence the hard WCAG gate in both themes.

## More

- Design‑system reference: [`DESIGN.md`](./DESIGN.md)
- Full product specification: [`docs/core/core-plan.md`](../../docs/core/core-plan.md)
- Living component documentation: run the app in development and open `/design-system`.
