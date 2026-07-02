# GitHub Pages ⊕ design language ⊕ dark hall ⊕ vault — additive integration plan

**Provenance:** Aaron 2026-07-02: "integrate our existing GitHub Pages + design
language + dark hall + Addison's fallout-shelter vault (UX design tsx, reference not
code) — mash them together into our existing GitHub Pages WITHOUT destroying what we
have."

## Ground truth (verified before touching anything)

- **The live site is committed static HTML**, served directly: root `index.html`
  (redirect) → `demo/` (Factory Dashboard, 2435-line static HTML), plus `genesis/`
  (amber/teal settlement console, built from `genesis/_src` jsx reference) and
  `inventory/`. The Astro workflow (`pages-deploy.yml`) is an **unconfigured stub**
  (`bun run build # will need to be configured`, no `dist`, no astro config) — it does
  NOT currently build anything. So the non-destructive rule is concrete: **add new
  static dirs; never edit `demo/ genesis/ inventory/ index.html`.**
- **Four palettes exist and are three KINDS** (the mash's central design fact):
  - portal `:root` cool tokens (shadcn kit) — CHROME
  - dark-hall `--room-*` warm phosphor — CHROME
  - genesis amber/teal (Space Grotesk/Mono) — CHROME
  - shapes `--c0..--c7` — DATA CHANNELS (categorical by generator index; NOT chrome)
  The three chrome palettes can fuse to one token hub (DV2.0: tokens=hub); the data
  channels stay separate (Bertin: value ≠ hue).

## First slice — LANDED (this PR)

`hall/index.html` — a self-contained neon-liminal "Dark Hall" landing that:
- fuses the three chrome palettes into one token block (the mash, minimal),
- inlines three real shape goldens (adinkra/braid/sybil-verdict SVGs, copied from
  `db/shapes/golden/`) as QPG hero art — `image-rendering: pixelated`, honest,
- links `demo/ genesis/ inventory/` as-is (honored, unchanged),
- zero edits to any existing file (verified: `git status` shows only `hall/`).

## Next slices (additive, in order)

1. **Live shape gallery** — render more of the catalog's goldens (they regenerate
   from cartridges; a build step could copy `db/shapes/golden/*.svg` into `hall/` so
   the gallery stays in sync — but keep it a COPY step, goldens stay source-of-truth).
2. **The design-language showcase** — mount the synced portal kit (the same
   `_ds_bundle.js` the claude.ai/design project uses) on a `hall/kit/` page so the
   real components render on the real tokens (dogfoods the design sync).
3. **Dark-hall room, live** — `darkhall-room.ts` renders a transcript → HTML; a
   `hall/room/` page can show a seeded room (DST-replayable, zero JS at rest).
4. **Addison's fallout-shelter vault** — BLOCKED on the reference: the vault UX tsx
   Aaron named are not in this repo (searched: only `genesis/_src` jsx +
   `vault-credential-proxy.ts` exist). NEEDED: where the vault reference tsx live
   (in-repo path, another repo, or a design file). Once located, port the vault
   aesthetic as a `hall/vault/` themed section — the fallout-shelter frame for the
   credential/identity surfaces, honoring it as Addison's design.
5. **Palette unification decision (Aaron's call)** — do the three chrome palettes
   converge to one hub, or stay three rooms with a shared grammar? Recommended: shared
   grammar (semantic roles: ground/panel/line/text/intent), per-room hues — so genesis
   stays amber, dark hall stays phosphor, portal stays cool, but they compose. The
   skin/semantics guardrail applies: hues are skin, roles are invariant.

## The one guardrail carried in

Skins recolor, never remap meaning (the design-ethics rule): fusing palettes changes
hues, never what `--intent-destructive` or a shape's `--c*` channel MEANS. And the
shapes stay generated — the gallery copies goldens, never hand-draws them.
