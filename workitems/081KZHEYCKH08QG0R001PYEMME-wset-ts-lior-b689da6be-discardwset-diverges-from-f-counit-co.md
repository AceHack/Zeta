---
id: 081KZHEYCKH08QG0R001PYEMME
type: bug
state: backlog
priority: P2
slug: wset-ts-lior-b689da6be-discardwset-diverges-from-f-counit-co
title: "wset.ts (Lior b689da6be): discardWSet diverges from F# counit + comonoid laws untested (TS port faithfulness)"
created: 2026-08-08T19:52:34.673Z
depends_on: []
composes_with: []
---

# wset.ts (Lior b689da6be): discardWSet diverges from F# counit + comonoid laws untested (TS port faithfulness)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZHEYCKH08QG0R001PYEMME-*.md` glob. -->

## Review of Lior's `b689da6be` (Otto shadow* + Lumen, 2026-08-08)

Aaron asked to check Lior's shipped algebra feature (BooleanRing + copy/discard comonoid
morphisms on the WSet universal-tensor TS port). Reviewed by Otto and independently by Lumen
(mathematical-physics-expert). This is a REVIEW finding on a peer's shipped code — Lior/Aaron
own the fix decision; not unilaterally patched.

### Correct-as-written (verified, NOT issues)
- **`BooleanRing`** — a lawful commutative idempotent semiring (add=∨, mul=∧, zero=false,
  one=true): assoc/comm/distrib/identities/annihilation all hold; correctly omits `negate`
  (no additive inverse). ✔
- **`copyWSet` (Δ)** — preserving weight `w` at `[k,k]` (NOT `w⊗w`) is the CORRECT diagonal
  comonoid in matrices-over-a-semiring; `w⊗w` would be the bug, and Lior avoided it. Faithful
  to F# `WSet.copy`. ✔

### P1 — `discardWSet` diverges from the F# counit it ports
Canonical F# (`src/Core/WSet.fs:82`): `discard (ring) (s) : 'W` folds to the **scalar** `Σw`
in `I = W` — the counit ε: A → I (law-tested: `discard intStar s = List.sumBy snd s`).
TS `discardWSet(set): WSet<void,W>` (a) **drops the ring** and (b) returns **one unit entry
per element without summing** — `[{k1,w1},{k2,w2}] ↦ [{(),w1},{(),w2}]`, not `w1⊕w2`. It
equals ε only AFTER a caller runs `consolidateWSet` (which it can't do itself — no ring), and
nothing tests that it ever is. Two equal-mass states with different decompositions give
different outputs ⇒ not well-defined as ε. Correct only under the module's consolidate-later
convention; a faithfulness bug vs the F# source + the commit's "counit" claim. The
single-element test (`length === 1`) structurally hides it.
**Fix (pick one):** match F# — `discardWSet(ring, set): W` returning summed scalar (or single
`{(),Σw}`); OR rename to signal "unconsolidated representation" + add a counit test that
consolidates and asserts `= Σw`.

### P1 — "verified comonoid morphisms" overstated: zero laws tested
The commit message + test name claim verification, but the TS test asserts only
**single-element output shape/weight**. NO comonoid law is tested — not coassociativity
`(Δ⊗id)∘Δ = (id⊗Δ)∘Δ`, not counitality `(!⊗id)∘Δ ≅ id`, not cocommutativity, not the
copy/discard-naturality (Fritz) discriminator. The F# side already has the full FsCheck law
pack (`tests/Tests.FSharp/Formal/WSet.Comonoid.Laws.Tests.fs`, over ℤ/ℝ≥0/ℂ incl. the Fritz
discriminator + mass-doubling witness) — **none ported.** The laws DO hold for the TS defs
(up to associator/unitor, after consolidation) — so "correct but entirely unverified."
**Fix:** port the F# law pack to `wset.test.ts` (bun test), or downgrade the claim to
"ported; laws untested (see F# law pack)."

### P3 — minor
- `discardWSet` uses `undefined as unknown as void`; `void` as a value-carrying key type is a
  TS anti-pattern (a consolidating caller needs `keyToString:(k:void)=>string`). Use `null` or
  a branded `Unit`.
- Pre-existing (not Lior's): TS `StarRing` has no star/`Conj` op, whereas F# `IStarRing` carries
  `Conj` (used by the ℂ corner) — the ℂ/quantum lane the header advertises isn't representable
  in the TS port as-is.

## Cross-refs
- Reviewed commit: `b689da6be` — `src/Core.TypeScript/algebra/wset.ts` + `wset.test.ts`.
- Canonical F# source: `src/Core/WSet.fs` (`copy`:76, `discard`:82).
- F# law pack (to port): `tests/Tests.FSharp/Formal/WSet.Comonoid.Laws.Tests.fs`.

## State
OPEN — review finding surfaced to Aaron/Lior. Both P1s are "correct-under-convention but
diverges-from-F#-and-unverified," not a live break (42/42 existing tests pass; they just don't
test the laws). Lior/Aaron own whether/how to fix; Otto can port the law pack + align
discardWSet on request.