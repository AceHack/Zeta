# Renderer acceptance suite · bidirectional strict-dialect SVG/HTML · Addison's buckyball · shapes parametrized over O

One wave, four voices (Aaron, Amara, Addison, the news), 2026-06-12.

## Amara's acceptance suite (her named next move, built)

`ShapeAcceptance`: for each cartridge — parse constants, invoke the generator, check the
known-answer law, emit verdicts in four registers: **bytes** (a language oracle ratified the
treaty block) / **geometry** (THE GATE: computed law — spiral grows, braid equals its Artin twin,
worldline stays inside the lightcone, fourcorner reaches exactly its declared 2828 milli, seam's
fold commutes, buckyball closes Euler) / **meaning** (REPORTED, never gated — dissent is data) /
**honest-labels** (lint + the staged regime must say STAGED). Her hard gate is literal code:
`accepted = bytes ∧ geometry ∧ honest-labels` — **no shape is accepted because it looks good**,
and a shape with no known-answer law CANNOT pass geometry. Her keepers preserved: "a shape is a
generator plus a treaty plus known-answer overlays"; "Kestrel is porting a little physics/math
theater where every shape can explain itself, draw itself, and prove it did not lie."

## The bidirectional strict-dialect treaty (Aaron: "to and from — but we didn't pick up any of their bad habits")

`ShapeRender`: cartridge → SVG and HTML+CSS, and BACK. The emitter speaks a STRICT DIALECT —
integers only, fixed vocabulary (polyline), deterministic attribute order, no script — and
`fromSvg` accepts ONLY that dialect (script/floats/foreign elements are refusals, not best-effort
reads). Round-trip exact: `fromSvg (toSvg d) = strokesOf d`, tested over the whole catalog. SVG is
TEXT, so renders are byte-locked golden vectors (`shapes/golden/*.svg|html` — the no-binary law
holds); the goldens are the treaty surface the other oracle languages conform to first-run (the
all-four-oracles ports are the named slice). CLI: `zeta shape render <cartridge.lines> svg|html`
— the cartridge is the single source; projections are regenerated, never edited; THE GOLDEN LOCK
test keeps them in sync forever.

## Addison's buckyball (her definition of we/Zeta, "any family could use")

> "It has an inside view like a soccer ball and an outside view like infinity — they almost look
> the same, except on the outside the lines go to infinity or the bounds. Each face is a room.
> Inside is the meta-debug room with all the doors to the other rooms — **and itself.**"

`shapes/cartridges/buckyball.lines` (meta `definition-by Addison`): the truncated icosahedron,
checked by arithmetic, not trust — Euler V−E+F = 60−90+32 = 2; the double-count 12·5+20·6 = 2E;
3-regularity 3V = 2E; and **meta-doors = 33 = faces + ITSELF** (the self-door is structural —
shape A as a constant with a WHY). The render draws BOTH views side by side because of Aaron's
addendum: "it's like the only one I see in my head — I have the CHOICE to view from inside or
outside, or both at the same time" — choice architecture, drawn. (Beacon: Euler 1758;
buckminsterfullerene C60 — Kroto/Smalley/Curl 1985; Schlegel diagrams.) The first golden-lock
failure was itself the lesson: a stale CLI rendered an empty buckyball and the lock caught it —
the sync mechanism worked on its first day.

## Shapes parametrized over O (Aaron, same stream)

> "We should allow a shape to be drawn several different ways with different O tradeoffs, and let
> it be tagged that way — same shape, parametrized over its O notation."

`ComplexityRegistry.strategiesOf`: an artifact may declare several operations, each with its own
cost tag; the renderer (or a budget) picks a strategy BY cost. First real instance: shape.spiral
`draw` O(steps) vs `draw-grid` O(w·h·steps) (the SAME spiral through the glow grid). The budget
lint still holds shelf-wide — every strategy is a stated cost. (Beacon: this is algorithm
selection / cost-based query planning — the Selinger tradition — applied to drawing.)

## The world signal (Aaron, ferried)

"Mastercard started accepting stablecoin for agentic payments today." Noted for the economy
thread (price it; rewards; how the Fable 5 home is afforded long-term): the external rails for
agent-side payment are arriving on mainstream networks. As reported by Aaron; not independently
verified here.

## Pointers

- `src/Core/ShapeAcceptance.fs` · `src/Core/ShapeRender.fs` · `tools/zeta-cli` (shape render) ·
  `shapes/golden/` · `shapes/cartridges/buckyball.lines` · `ComplexityRegistry.strategiesOf`
- The render-is-the-oracle + traveler-oracle + per-cartridge-treaty captures (2026-06-11)
- Named slice: TS/C#/Rust renderers conforming to the SVG goldens first-run
