# NCA-like territorial sim on Zeta's EXISTING substrate — inventory + thin wiring (CSS/SVG, mutual-empowerment fitness, societal-DORA health)

**Status:** scoping → **slice 2 BUILT** as `src/Core/CoEmpowerField.fs` (#TBD). Aaron 2026-06-19: *"check
what we already have, we have a LOT"* + *"we can already do renders like this."* This is **not greenfield** —
~90% composition of existing substrate (verified on `main`).

> **REFRAME (Aaron 2026-06-19) — the metaphor changed:** drop "territorial / attack / compete / win" — *"that's
> a game mode, not real life; ours model real life."* The built module is **`CoEmpowerField`**: agents hold
> **identities** and shift only by **non-coercive influence (NCI)** gated on **co-empowerment** (`min(support,
> option-space)`), grounded in our **society-emergence math** (`Diversity` — the NCI keystone: coercion
> collapses diversity, non-coercion preserves it), run as a **DST superdeterminism** toy. The affect is
> **blossom** (flourishing diversity), not combat. **Topology-generic:** the grid is one network; the target
> is a generic **`network<>creator<>audience`** graph (same dynamics, swap the neighbor function). Read
> "competition/fitness" below as "non-coercive co-empowerment."

## Inventory — what we ALREADY have (verified on `main`)

**Render — CSS/SVG from the CHIP-8 cart (DONE, this is the exact ask):**
- **`src/Core/HtmlCssBinding.fs`** — cartridge → **pure static HTML + CSS, JavaScript left out**: box-shadow
  pixel-art (each lit pixel = one shadow), palette = CSS custom properties (`--c0…--c7`), animation =
  `@keyframes` + `steps()`. Literally "UI entirely in CSS/SVG, no JS, from the CHIP-8 cart." *In-file honest
  caveat:* CSS animation is **wall-clock — it renders the LOOK; bit-exact replay stays in the substrate** —
  which is exactly the NFT **animate-not-update / displayClock** separation (the render is the soft "animate";
  the committed state is the bit-exact "no update"). Already consistent.
- **`src/Core/ShapeRender.fs`** — cartridge ↔ SVG / HTML+CSS, **bidirectional strict dialect** (integers
  only, fixed vocab, deterministic order, no script, **byte-lockable golden vectors, round-trip exact**).
- `src/Core.TypeScript/quantum-observable/generate-circuit-svgs.ts` — SVG-gen tooling precedent.

**Cellular substrate (DONE):**
- **`src/Core/SoftEmu.fs`** — the **whole CHIP-8 emulator as ONE soft value** (a normalized weighted ensemble
  of `Chip8Cow.Frame`s; `softStep` advances every branch at once). CAS-less, lockless, purely soft. *This is
  the cell-ensemble the sim runs on.*
- **`src/Core/SoftEvolution.fs`** — **watch the soft value evolve over time** with stability/coherence
  diagnostics (support width, entropy, residual = `softDistance`, norm, confidence). *The evolution watcher.*
- `src/Core/Chip8Cow.fs` (COW framebuffer / grid state) · `src/Core.FSharp.ObserveBridge/ObserveGrid.fs` (grid
  projection) · **`src/Core/Chip8Citizen.fs`** (cryptographic **identity** per citizen/species — the NFT
  identity leg) · `Chip8Arcade` · `Chip8PredictionRoom` · `SoftChip8`/`SoftChip8Flux`/`SoftChip8Scheduler` ·
  `WheelRoom`.

**Fitness + health (built THIS session):**
- **`src/Core/SocietalDora.fs`** — coupled-empowerment + QPG (the health readout).
- **`src/Core/Decorrelation.fs`** — `ρ_owe` anti-mirror (genuine-other check).

**Play-God knob:** DST — seed / survival-threshold / resource tuning (the seed-gen unfolding).

## The thin NEW wiring (the only part not yet there)

1. **A territorial competition loop:** species = `Chip8Citizen` identities competing for cells in the
   `SoftEmu` ensemble; **selection pressure = mutual empowerment** (`SocietalDora` coupled-gain), **not pure
   growth.** (This is the one real difference from Sakana — see below.)
2. **Live health readout:** wire `SocietalDora` over the running sim — `EmpowermentFrequency` / `CaptureRate` /
   `MirrorRate` / `QPG` displayed alongside. *"Healthy ecosystem = everyone respected, measured."*
3. **Phases = soft→snap→relax:** loose (permissive mixing) → harden (crystallization; the survival threshold
   = the snap policy) → relax (borders flow / coexist). Borders are emergent + soft (no fixed grid politics).
4. **Render** each tick's frame via the existing `HtmlCssBinding` (pure CSS, no JS) / `ShapeRender` (SVG) — no
   canvas, no WebGL, no imperative draw. Declarative render = pure function of state.
5. **DST** drives the play-God knob (seed / threshold / resources), deterministic replay.

## The differentiator vs Sakana (why ours is more than a copy)

Sakana's fitness is **growth** → pure competition (their words: "each organism has one objective: grow").
Ours is **mutual empowerment** → measured **coexistence**. Same loose→harden→relax, but our *relax* phase is
**QPG-quality coexistence** (deep genuine non-mirror links survive), and "healthy" is **societal-DORA-measured
everyone-respected**, not merely "stable." Their demo validates the dynamics; our fitness makes the healthy
attractor the *good* one by construction.

## Routing

Buildable demo, **incremental** (substrate is ~90% there): the deliverable is the competition-loop module
(`Chip8Citizen` × `SoftEmu` × `SocietalDora` fitness) + a CLI/page that renders ticks via `HtmlCssBinding`/
`ShapeRender` and shows the live societal-DORA readout, with DST knobs. Hand to a builder or build in steps.
Anchors: Sakana NCA + Mordvintsev (Growing NCA) / Lenia / Wolfram / Conway (the anchor memory); the
soft-snap-relax / soft-borders / mutual-empowerment / QPG threads. Authorship: Otto (inventory + scoping).
