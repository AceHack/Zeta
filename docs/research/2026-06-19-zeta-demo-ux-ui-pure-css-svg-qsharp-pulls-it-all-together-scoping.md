# Zeta demo UX/UI — pure CSS/SVG + Q#, pulling the whole thesis together (scoping)

**Status:** scoping. Aaron 2026-06-19: *"get some UX/UI going that's interesting and will pull all this
together in pure CSS SVG Q#."* One interactive-feeling demo that makes the whole 2026-06-19 thesis *visible*,
rendered **declaratively (pure CSS/SVG, no JS)** over the **Q# / soft substrate**. Built on existing render
substrate (`HtmlCssBinding.fs` / `ShapeRender.fs`); honest verified-first-slice plan (the Q# compute lane is
the frontier).

## The concept — one screen, every thread visible

A **cart** (the common source of meaning) rendered as CSS/SVG, with panels that each surface one thread, all
declarative (a pure function of state = the *animate-not-update* discipline):

- **The cart** → CSS/SVG render (`HtmlCssBinding` box-shadow pixels + CSS-var palette `--c0…--c7`; or
  `ShapeRender` SVG strict dialect). The meaning unit you're looking at.
- **The soft ensemble** (`SoftEmu`) → the superposition made visible: weighted overlaid frames (opacity =
  branch weight) — "we're all lenses on nothing," the soft state you can see.
- **NCA territorial sim** → loose→harden→relax (soft→snap→relax): species (`Chip8Citizen` identities) compete
  on the grid; borders form and flow; **fitness = mutual empowerment**, not growth.
- **Societal-DORA health dials** (live SVG gauges) → `EmpowermentFrequency` / `CaptureRate` / `MirrorRate` /
  **QPG**. "Healthy ecosystem = everyone respected, measured."
- **Anti-mirror `ρ_owe` meter** → per-link decorrelation gauge (genuine other vs mirror).
- **NFT mint moment** → a `snap` animation (soft→hard): the slice freezes into a git-commit / Merkle root;
  shows the **mint gate** (pair-identity ∧ no-correlation ∧ anti-mirror ∧ mutual-empowerment) lighting up
  green before it can mint.
- **Zeta-NTP phase clock** → the soft phase `φ` (canonical) + correlated local clocks (UTC / Mars-sol / ship)
  each `± uncertainty`; UTC's leap-seconds and borders shown as the *mutable* observations, the phase as the
  stable base.
- **Grounding indicator** → the play/real line: unbacked = a children's game (soft, glowing, ephemeral) vs
  backed = grounded (hard, solid). The backing (golden-vectors/proofs/seed/measure) shown as the ground wire.

## The Q# connection

The **six-op Z-set ISA** (EMIT/RETRACT/BRANCH/JOIN/MERGE/FOLD) is the compute: the demo shows the ops driving
the soft ensemble (EMIT/RETRACT = the +1/−1 oscillation; BRANCH = superposition; MERGE/FOLD = interference),
with `gen(gen)===gen` as the self-hosting capstone. **Honest scope:** the Q# lane is the **frontier** —
`ZSetISA.qs` is currently `--no-verify` and Q# is not in CI; the *verified* compute is the F# soft substrate
(`SoftEmu`/`Decorrelation`/`SocietalDora`). So Q# is the aspirational compute layer; the demo runs on F# today
and shows the Q# ops as the lane being lit up.

## Pure CSS/SVG constraint (why)

Declarative render = **pure function of state** = the NFT *animate-not-update / displayClock* discipline (no
live imperative draw state). **No canvas, no WebGL, no imperative JS.** `HtmlCssBinding` (pure static HTML+CSS:
box-shadow pixel-art, `@keyframes`+`steps()`, CSS-var palette) + `ShapeRender` (SVG strict dialect,
byte-lockable golden vectors). Runs anywhere, no heavy runtime (thinnest-substrate / no-OS). The in-file
caveat already noted: CSS animation = wall-clock *look*; bit-exact state stays in the substrate — exactly the
animate/commit split.

## The thinnest runnable FIRST SLICE (buildable today, verified substrate)

1. **Slice 1 (today, no Q#):** render a real cart + its `SoftEmu` ensemble + **one** societal-DORA dial as
   pure CSS/SVG via `HtmlCssBinding`/`ShapeRender`. Verified F# substrate; a static page, byte-lockable.
2. **Slice 2:** wire the NCA territorial sim (mutual-empowerment fitness) + the live societal-DORA dials +
   `ρ_owe` meter; DST knobs (seed/threshold) as the play-God controls.
3. **Slice 3:** the NFT mint moment (snap → git-commit/Merkle) + the Zeta-NTP phase clock + grounding
   indicator.
4. **Slice 4 (frontier):** swap the F# compute for the **Q# six-op ISA** once `ZSetISA.qs` is verified / Q# is
   in CI; show `gen(gen)===gen` self-hosting.

**Build verified-first; Q# is the frontier lane, not slice 1.** Don't ship the Q# compute as if verified
(it isn't) — render the *concept* of the ops while the F# substrate does the real compute, and mark the Q#
panel as the frontier.

## Routing

Builder: the CSS/SVG render + F# soft substrate exists (`HtmlCssBinding`/`ShapeRender`/`SoftEmu`); the new work
is the panel composition + the NCA-sim wiring (see
`docs/research/2026-06-19-nca-territorial-sim-on-chip8-substrate-css-svg-mutual-empowerment-societal-dora-scoping.md`).
The Q# lane → Alexa (the six-op ISA / `ZSetISA.qs` verification first). Ties: the math-team handoff
(`docs/handoffs/2026-06-19-otto-to-math-team-nft-ntp-anti-mirror-societal-dora-formalization.md`); the cart =
common-source-of-meaning; the soft/hard·play/real·grounding thread. Authorship: Otto (scoping).
