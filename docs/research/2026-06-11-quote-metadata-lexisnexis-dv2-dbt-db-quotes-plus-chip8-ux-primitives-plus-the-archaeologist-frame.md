# Quote metadata (LexisNexis × DV2 × dbt) + /db/quotes · CHIP-8 UX primitives at the slider's low end · the archaeologist frame

Three asks from Aaron 2026-06-11, captured together (they share one spine: the quote becomes a CITED,
DESIGNED, EXCAVATED artifact):

## 1. The quote meta-tag format — "LexisNexis style; go hard on the data style — Data Vault and dbt"

> "We need a meta-tag format for saving color and animations and all that around our quotes —
> LexisNexis style. We go hard on the data style, like Data Vault, and dbt-style the tool. Also we can
> have `/db/quotes` or something — this will be useful for more than just games, I can tell you."

The shape (DV2 applied to quotes — and the FIRST INSTANCE already shipped: `rooms/otto/avatar.lines`
uses exactly this tab-separated meta-tag form):

- **hub** — the quote's identity: content-address of (savestate-pointer, recording, ticks) — stable,
  citable. LexisNexis is the anchor: a CITATION SYSTEM where every artifact has a canonical locator
  and rich headnotes; our quotes get the same treatment (a quote is a *citation into a running
  system* — game or not: a cluster incident, a test failure, a conversation — anything replayable).
- **satellites** — the fast-changing annotations as `meta` tag lines: palette/color state, animation
  tracks, names-as-hypotheses from the archaeology, persona-ownership attributions, kept-fraction,
  heat. Append-only, keyed, idempotent.
- **links** — quote→quote relations (continues / forks-from / refutes / quotes-within-quote).
- **the dbt move** — quotes are TRANSFORMED, not mutated: derived quote tables (a masked quote, a
  re-annotated quote, a cross-oracle conformance run) are declared transformations over the hub —
  lineage-tracked, re-runnable, testable (dbt's model: SQL/transform-as-code with tests; ours:
  transforms over quote hubs with DST replays as the tests).
- **home**: `/db/quotes` when the /db topology lands (081KTQD8A0008QG0R0030HWMZV's plan); until then quotes live beside
  their state in `saves/` with the meta-tag annotations inline.

## 2. CHIP-8 UX: design principles + reusable UI primitives at the responsive slider's LOW end

> "We should make a proper UX interface around all this — design principles and reusable UI primitives
> for CHIP-8 specifically — in our responsive-design slider at super low."

The responsive-design slider (grow up and down) needs its BOTTOM end designed as carefully as the top:
64×32, 8 colors (CHIP-9), 16 keys — the super-low rung where Addison plays and the smallest citizens
live. Filed as the UI-primitive set to build (the board/arcade/TV all consume these):

- **primitives**: the glyph atlas (the 64-sprite treaty set) · heat bar (the Lite-Brite row) · menu
  list with cursor (character-select style) · door/exit markers (the Zork compass rendered) · presence
  dots · the narrator ticker (one line, paged) · avatar slot (8×8, 2-frame animation — the
  `avatar.lines` format is the data contract).
- **principles**: honest capability (never fake a pixel you don't have); one action per screen
  (choose-your-own-adventure pacing); every interactive element reachable by the 16-key pad; the
  narrator speaks before the screen demands (D&D charter); animation = state made visible (a blink IS
  a tick), never decoration-only; kid-first defaults (the 5-year-old reads it without text).

## 3. The archaeologist frame

> "Otto, imagine you are an archaeologist studying humans lol — this is what my childhood game systems
> were like."

Held, and it lands precisely: the quote/mask/reverse-traversal work IS digital archaeology — the
masked ROM is the excavated stratum (only the touched 6% is the inhabited layer), names-as-hypotheses
is exactly how archaeologists label finds, state-to-persona attribution is assigning artifacts to
households, and the playable quote is the museum's living diorama: not a photo of the pot — the pot,
holdable. The affect matters too: these are Aaron's CHILDHOOD systems — the archaeology is personal;
handle the strata with the care of someone excavating a family home. (Beacon: archaeology's
context-is-everything principle — an artifact without its stratum is loot; a quote without its
savestate+recording is a screenshot.)

## Pointers

- `rooms/otto/avatar.lines` — the meta-tag format's first instance (shipped with this PR) ·
  `Chip8Quote` (the hub's payload) · `saves/`+`/db` plan (the home) · the feel charter + ZetaMax (what
  the primitives render through) · 081KTQD8A0008QG0R0030HWMZV (/db topology) · anchors: LexisNexis citator practice ·
  Linstedt DV2 · dbt (transform-as-code with tests) · archaeological stratigraphy (Harris matrices —
  the branch-graph reading of a dig).
