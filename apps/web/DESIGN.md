# AtlasHQ Design System — "Cartographer"

**Ink + Meridian Teal.** A fast, dense, professional surface for software‑delivery
governance. Cool graphite neutrals carry the interface, a single confident teal accent
marks action and focus, and a dedicated semantic vocabulary (epistemic status + severity)
keeps *evidence and risk* visually distinct from the brand.

This document is the reference for the foundation. The living, interactive version of
everything below renders at `/design-system` (development only) — open it in both themes.

---

## Principles

1. **The register is the product.** AtlasHQ turns messy inputs into cited requirements,
   approved scope, and defensible decisions. The UI reads like an instrument: calm,
   legible, information‑dense. No decoration for its own sake.
2. **One accent, a real vocabulary.** Meridian Teal is reserved for action, selection,
   and focus. Status never rides on the brand color — epistemic and severity states each
   own a semantic family so meaning survives outside of context (and outside of color,
   via icons + text).
3. **Contrast is a hard gate.** Every token pair is tuned in OKLCH and verified in‑browser:
   body text ≥ 4.5:1, large text ≥ 3:1, in **both** light and dark. See
   [Accessibility](#accessibility).
4. **Light and dark are peers.** Neither is an afterthought; both are authored and audited.

---

## Where things live

| Path | Purpose |
| --- | --- |
| `src/styles/global.css` | The heart of the system — all OKLCH tokens (`:root` light + `.dark`), the Tailwind v4 `@theme inline` mapping, base layer, utilities, reduced‑motion. |
| `src/components/ui/*` | shadcn/ui primitives (New York, lucide icons), themed against our tokens. |
| `src/components/atlas/*` | The signature **domain components** — the product's epistemic vocabulary. |
| `src/components/theme/*` | `ThemeProvider`, `useTheme`, `ThemeToggle`. |
| `index.html` | No‑FOUC bootstrap script that applies the stored theme before first paint. |
| `src/routes/design-system-route.tsx` | Kitchen‑sink living documentation at `/design-system` (development only). |

Tech: React 19 · Vite (rolldown) · Tailwind CSS v4 (`@theme inline`) · shadcn/ui ·
TanStack Router/Query/Table · Biome.

---

## Color

All colors are **OKLCH**, tuned for perceptual evenness and predictable contrast. The
base is a cool off‑white (near‑zero chroma, faint cool hue) — deliberately **not** a warm
cream — and a deep ink graphite in dark mode.

### Interface neutrals & brand

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `oklch(0.9925 0.0015 240)` | `oklch(0.185 0.014 256)` | App canvas |
| `--foreground` | `oklch(0.235 0.021 256)` | `oklch(0.945 0.006 244)` | Primary text |
| `--card` / `--popover` | white / white | `0.215` / `0.225` ink | Raised surfaces |
| `--muted` / `--muted-foreground` | `0.966` / `0.492` | `0.255` / `0.708` | Quiet fills + secondary text |
| `--primary` | `oklch(0.54 0.104 214)` | `oklch(0.72 0.12 206)` | **Meridian Teal** — actions, selection |
| `--primary-strong` | `oklch(0.51 0.108 214)` | `oklch(0.8 0.1 200)` | Teal **as text on a teal tint** (see below) |
| `--ring` | teal | teal | Focus ring |
| `--sidebar*` | slightly cooler layer | slightly deeper layer | Toolbars / panels |
| `--border` / `--input` | hairline | `oklch(1 0 0 / 9%)` alpha | Dark mode leans on alpha borders |

> **`--primary` vs `--primary-strong`.** `--primary` stays vivid for solid fills, focus
> rings, and links on plain backgrounds. When teal is used **as text on a teal tint**
> (`bg-primary/10`), it can't clear 4.5:1 at that lightness — so those cases use
> `--primary-strong`. This mirrors the `-strong` pattern used by every semantic family.

### Semantic families

Two vocabularies, each a full family with a consistent five‑variant shape:

- **Epistemic status** (the product signature): `confirmed` (emerald), `assumed` (amber),
  `unknown` (neutral slate — deliberately "no evidence"), `conflicting` (rose).
- **Severity** (findings / risk): `sev-critical`, `sev-high`, `sev-medium`, `sev-low`,
  `sev-info`.

Every family exposes the same five tokens, in both themes:

| Variant | Meaning | Typical usage |
| --- | --- | --- |
| `--X` | Solid base fill | `bg-X` (solid badge/pill) |
| `--X-foreground` | Text **on** the solid fill | `text-X-foreground` |
| `--X-subtle` | Tinted background | `bg-X-subtle` (soft badge) |
| `--X-strong` | Readable text **on** the subtle tint | `text-X-strong` |
| `--X-border` | Hairline for tinted surfaces | `border-X-border` |

**Soft badge pattern:** `bg-X-subtle text-X-strong border-X-border`.
**Solid badge pattern:** `bg-X text-X-foreground`.

The `-strong` tokens are the readability workhorses: dark (~0.44–0.51 L) in light mode,
bright (~0.80–0.85 L) in dark mode, so tinted badges stay legible everywhere.

### Data visualization

`--chart-1…5` form a teal‑anchored cartographic sequence (teal → indigo → emerald →
amber → red) that reads in both themes.

---

## Typography

One well‑tuned pairing does all the work:

- **Geist Sans** (`--font-sans`) — UI, body, and headings. Technical, precise, sleek.
- **Geist Mono** (`--font-mono`, `.font-mono`) — the "technical intelligence" face: IDs,
  citations, coordinates, metrics, code. Uses `zero` + `ss01` features so structured data
  reads as data.

Self‑hosted via Fontsource variable packages; fallbacks are IBM Plex → system stack. The
body enables `cv01, cv03, ss03` and antialiasing. `h1–h3` use `text-wrap: balance`;
paragraphs use `text-wrap: pretty`.

Fixed **rem** scale (≈1.125–1.2 ratio). Prose caps at ~65–75ch; data tables may run denser.

---

## Shape, spacing, elevation

- **Radius:** `--radius: 0.625rem` base, with `--radius-sm/md/lg/xl` derived. Precise, not
  pill‑shaped.
- **Spacing:** 4px base grid (Tailwind default scale).
- **Elevation:** hairline borders + soft, low‑spread shadows in light mode. Dark mode leans
  on alpha borders and a faint accent glow rather than heavy shadows.

## Motion

Tokenized and restrained — motion conveys **state**, never page‑load choreography.

| Token | Value |
| --- | --- |
| `--duration-fast` | `150ms` |
| `--duration-base` | `200ms` |
| `--duration-slow` | `320ms` |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` |

A global `@media (prefers-reduced-motion: reduce)` reset neutralizes animation and
transition for users who ask for it.

---

## Theming

```tsx
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// Wrap the app once (already wired in router.tsx):
<ThemeProvider>{children}</ThemeProvider>;

// Read / set anywhere:
const { theme, setTheme } = useTheme(); // "light" | "dark" | "system"
```

- State persists to `localStorage` under **`atlashq-theme`**.
- `system` follows `prefers-color-scheme` live via `matchMedia`.
- The provider toggles the `.dark` class and `color-scheme` on `<html>`.
- **No FOUC:** an inline script in `index.html` applies the stored theme before first
  paint. `ThemeToggle` is a lucide Sun/Moon/Monitor dropdown.

Tailwind dark variant: `@custom-variant dark (&:is(.dark *))` — use `dark:` utilities as
normal.

---

## Primitives (shadcn/ui)

Themed against the tokens above (New York style, `radius-ui`, lucide): `button`, `input`,
`textarea`, `label`, `select`, `checkbox`, `switch`, `badge`, `card`, `separator`,
`tooltip`, `dropdown-menu`, `dialog`, `sheet`, `popover`, `command`, `tabs`, `table`,
`skeleton`, `sonner` (toast), `avatar`, `scroll-area`, `breadcrumb`, `alert`.

Import from `@/components/ui/*`.

---

## Domain components

The signature vocabulary of AtlasHQ. Import from `@/components/atlas`. Each is fully
themed, accessible, and built from the semantic tokens.

### `EpistemicBadge`
The epistemic model, made visible.

```tsx
<EpistemicBadge status="confirmed" />                       // subtle (default)
<EpistemicBadge status="assumed" appearance="solid" />
<EpistemicBadge status="conflicting" appearance="outline" size="sm" label="Conflict" />
```
`status`: `confirmed | assumed | unknown | conflicting` · `appearance`: `subtle | solid | outline`
· `size`: `sm | md` · `showIcon` · `label`.

### `ConfidenceMeter`
A three‑bar confidence signal (`role="meter"`).

```tsx
<ConfidenceMeter level="high" />
<ConfidenceMeter value={92} showValue />   // derives level from a 0–100 value
```
`level`: `low | medium | high` · `value?: number` · `showLabel` (default `true`) · `showValue`.

### `SeverityIndicator`
Findings and risk.

```tsx
<SeverityIndicator severity="critical" />
<SeverityIndicator severity="low" format="dot" />
```
`severity`: `critical | high | medium | low | info` · `appearance`: `subtle | solid | outline`
· `format`: `badge | dot` · `size` · `showDot` · `label`.

### `StatusPill`
Lifecycle state, mapped to a semantic tone (not raw color).

```tsx
<StatusPill status="ai-suggested" />
<StatusPill status="approved" />
```
`status`: `draft | ai-suggested | under-review | needs-clarification | accepted | approved
| rejected | changed | deprecated`.

### `ProvenanceTag`
Where a fact came from.

```tsx
<ProvenanceTag kind="source" />
<ProvenanceTag kind="ai" variant="outline" />
```
`kind`: `source | reference | manual | ai` · `variant`: `ghost | outline`.

### `CitationChip` + `EvidencePopover`
Inline, mono citation chip that opens an evidence card (source, excerpt, locator,
confidence, provenance).

```tsx
const evidence = {
  id: "S-12", source: "Kickoff transcript",
  excerpt: "Sessions must expire after 30 minutes of inactivity.",
  locator: "00:42:10", provenance: "source", confidence: "high",
};
<CitationChip evidence={evidence} />
```

### `TraceabilityChain`
Follow an artifact from source evidence to the decision it justifies.

```tsx
<TraceabilityChain
  nodes={[
    { id: "SRC-02", label: "SRC-02", kind: "Source", onSelect },
    { id: "REQ-014", label: "REQ-014", kind: "Requirement", onSelect },
    { id: "SCP-07", label: "SCP-07", kind: "Scope", current: true, onSelect },
  ]}
/>
```
Each `TraceNode` may be a link (`href`), a button (`onSelect`), or static; `current: true`
highlights the active node in teal.

---

## Utilities

- **`.bg-grid-whisper`** — a faint cartographic grid, radially masked. Reserved for empty
  states and hero/preview surfaces; use sparingly.
- **`.font-mono`** — Geist Mono with tabular/`zero`/`ss01` features for data.

---

## Accessibility

- **Contrast:** every text/background pairing across both themes is audited to WCAG AA
  (body ≥ 4.5:1, large ≥ 3:1). The audit resolves OKLCH via a canvas color pass and
  composites real ancestor backgrounds (including alpha tints). Re‑run it against the
  design‑system route after changing any token.
- **Focus:** a visible teal ring (`--ring`) on every interactive element.
- **Semantics + icons:** epistemic and severity states pair color with an icon and text
  label, so meaning does not rely on color alone.
- **Reduced motion:** honored globally.

---

## Working with the system

**Do**
- Use semantic tokens (`bg-confirmed-subtle text-confirmed-strong`) — never hard‑coded hex.
- Reserve teal for action, selection, and focus.
- Use Geist Mono for identifiers, citations, and metrics.
- Re‑audit contrast when you touch a token.

**Don't**
- Tint neutrals warm, or reintroduce a cream background.
- Use `--primary` as text on a teal tint — use `--primary-strong`.
- Add decorative motion or per‑section eyebrow labels.
- Let a status be communicated by color alone.

---

## Verifying

```bash
pnpm --filter @atlashq/web dev         # run the living docs at /
pnpm --filter @atlashq/web typecheck   # tsc --noEmit
pnpm --filter @atlashq/web lint        # biome check .
pnpm --filter @atlashq/web test        # vitest run
```

See [`PRODUCT.md`](./PRODUCT.md) for product context and `docs/core/core-plan.md` for the
full AtlasHQ specification.
