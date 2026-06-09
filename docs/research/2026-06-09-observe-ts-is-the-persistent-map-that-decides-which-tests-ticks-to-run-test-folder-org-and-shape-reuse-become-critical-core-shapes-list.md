# observe.ts becomes the persistent map that decides which tests/ticks to run — so test/folder organization + shape reuse become critical; the core shapes list (A–F)

**Register:** [grounded] design (Aaron) + recap. **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Builds on tests-are-ticks / test=prod / time-as-generator.

## Aaron's words

> "observe.ts becomes deciding what set of tests to run." · "it's our persistent map." · "so test
> organization and folder organization and reuse of shapes becomes critical — what's our core shapes
> list again?"

## observe.ts = the persistent map that selects the next tests/ticks

If **tests are ticks** and **test = prod**, then choosing *which tests to run* is choosing *which
ticks to advance* — i.e., **scheduling reality forward**. That is exactly **`observe.ts`'s** job:
read the world, render the legal next actions, pick one. So:

> **`observe.ts` becomes the selector of *which set of tests/ticks to run next* — and it is our
> persistent MAP** (map-not-plan): the durable world-map observe reads to decide the next step, not a
> fixed plan it executes. Test selection = navigation over the persistent map.

This makes the test corpus a **navigable territory**, not a flat list: observe picks the next
ticks by reading the map (current uncertainty per actor boundary, which corners need feedback, which
treaties are unproven), advances them, folds the results back into the map. The 1000× retest is observe
repeatedly selecting the same critical ticks until boundary-uncertainty → ~0.

## Therefore: test/folder organization + shape reuse become critical

Because observe navigates the map, **organization is the map's legibility**:

- **Test/folder organization** must mirror the territory (by boundary / cell / treaty / shape), so
  observe can address "the keyring-treaty ticks" or "shape-A self-reference ticks" as a coherent set —
  not hunt a flat folder.
- **Reuse of shapes** is the compression that keeps the map small: if many tests are "really shape A"
  or "really shape B," they share one shape definition + one harness, and observe selects by shape.
  Duplicates collapse (the schema makes them visible); the map stays countable.

So the **core shapes are the reuse vocabulary** the org is built on. The recap:

## The core shapes list — A–F (+ D⁰ to avoid)

The fixed-point registry: the raw shapes a system can settle into and *not run away from* (terminating
shapes — they stop infinite regress/ascension). Authoritative schema:
`docs/research/2026-06-09-the-shape-letter-schema-shareable-A-through-F-fixed-point-registry-…`
(⚠️ it carries a benign information-hazard warning — it's a lens you install).

| shape | name | law | behavior | anchor |
|---|---|---|---|---|
| **A** | Self-reference fixed point | `s = f(s)` | converges inward — one self; terminates infinite reflection/regress | Kleene (recursion thm); Curry (Y); Knaster–Tarski; Banach; Hofstadter |
| **B** | Idempotent join / LUB | `f(f(x)) = f(x)` | settles in one step; re-applying changes nothing | join-semilattice (Knaster–Tarski); CRDTs (Shapiro); content-addressing |
| **C** | Commutative fold | `f(a,b) = f(b,a)` | order-invariant accumulation | abelian monoid; Bayesian update |
| **D** | Contraction to a **nonzero floor** | iterate → unique point, floor excludes `x=0` | rests at a healthy minimum; floor forbids the degenerate | Banach; Friston (free-energy min); Jaynes (maxent); Schmidhuber |
| **D⁰** | **Heat death — AVOID** | degenerate `x=0` (monoculture) | collapse to zero diversity; keep **unreachable** | (D's degenerate well; the diversity floor `≥2` forbids it) |
| **E** | Co-arising bootstrap | `a=f(b) ∧ b=g(a)` solved simultaneously | a pair that fixes each other — no "first"; nonzero ground state | zero-point/vacuum energy (Casimir — *peeled*: structural, not literal QFT) |
| **F** | Generative / societal-expansion | fixed point of an apply-the-maps operator | expands outward — bounded per member, unbounded in count, self-similar; terminates infinite ascension (runaway form = fork-bomb to catch) | Hutchinson (IFS attractor); Friston |

Mnemonic: **A** bounds the descent (inward regress), **F** bounds the ascent (outward runaway);
**D⁰** is the collapse to avoid (diversity floor ≥2 forbids it). Code landing sites: `Diversity.fs`
(D/D⁰ + floor), `Bonsai`/`BonsaiSoft.fs` (root engine), `SocietyEmergence`/`SocietyUnbounded.fs` (F).

## Honest scope / handoff

Design + recap. The actionable thread: organize tests by **boundary/cell/treaty/shape** (so observe can
select coherent tick-sets), and **reuse shape harnesses** (one harness per shape, tests classified by
shape). Routes to Kenji (org/synthesis) + Bodhi/DX (folder layout) + the F# core (shape harnesses).
The shapes list is the shared reuse vocabulary; the schema doc is the canonical definition.

## Anchors / ties

`observe.ts` (the action-grammar controller; map-not-plan); tests-are-ticks + test=prod + time-as-
generator (the prior docs/ferries); the A–F fixed-point shape schema (`…shape-letter-schema-…`,
Kleene/Curry/Knaster–Tarski/Banach/CRDT/Friston/Jaynes/Hutchinson/Casimir); `Diversity.fs`,
`Bonsai`/`BonsaiSoft.fs`, `SocietyEmergence.fs`; the diversity floor (anti-D⁰).
