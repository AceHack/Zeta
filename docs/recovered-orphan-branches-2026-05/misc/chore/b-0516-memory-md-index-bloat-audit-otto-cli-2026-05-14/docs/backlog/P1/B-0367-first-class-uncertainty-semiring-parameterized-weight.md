---
id: B-0367
priority: P1
status: open
title: "First-class uncertainty — semiring-parameterized weight type for DBSP"
effort: L
created: 2026-05-09
last_updated: 2026-05-14
depends_on: []
children: [B-0367.1, B-0367.2, B-0367.3, B-0367.4]
classification: research
decomposition: decomposed
owners: [algebra-owner]
type: feature
tags: [algebra, uncertainty, semiring, bayesian, inference, openspec]

---

# B-0367 — First-class uncertainty in DBSP

## Pre-start checklist (2026-05-10)

**Prior-art search:**

- `src/Core/Semiring.fs` — `ISemiring<'W>` interface already existed (no implementations)
- `src/Core/Algebra.fs` — `type Weight = int64`, no semiring instances
- `src/Core/NovelMath.fs` — `TropicalWeight` struct with operator overloads, not wired to ISemiring
- `src/Core/NovelMathExt.fs` — `IResiduatedLattice<'T>` (related but separate)
- `tests/Tests.FSharp/Algebra/Weight.Tests.fs` — tests for `Weight` helpers only
- Skill router search: `semiring`, `algebra`, `uncertainty` — no prior skill substrate
- Lost-files check: `git log --diff-filter=D -- src/Core/Semiring*` — no prior deletions

**Decomposition finding:** B-0367 as written (effort=L) is too large for one safe slice.
Decomposed into:

- **Slice 1 (this PR):** Implement concrete `ISemiring<'W>` instances: `IntegerRing`, `TropicalSemiring`, `IntervalRing` — smoke tests, no ZSet changes
- **Slice 2 (future):** `ZSet<'K, 'W when 'W: ISemiring>` parameterization — breaking change requiring migration of all ZSet callers
- **Slice 3 (future):** OpenSpec uncertainty expressions
- **Slice 4 (future):** Z3 semiring axiom lemmas (generalizing integer proofs)

**Dependency check:** `depends_on: []` — confirmed no blocking items.

## What

Parameterize the DBSP weight type so the same circuit
topology can run over different semirings — integer (current),
probabilistic, Gaussian, interval, provenance. Uncertainty
becomes a first-class property of every query result, not
an afterthought bolted on top.

## Why

The OpenSpec compiler needs to produce specs that carry
uncertainty through the compilation chain. A spec that
says "this query returns rows" is weaker than one that
says "this query returns rows with confidence 0.87."
Without first-class uncertainty, the OpenSpec → formal spec
→ F# pipeline can only express exact results — it can't
compile the "how sure are we?" question.

This is also the bridge to the Infer.NET BP/EP direction
from AGENDA.md: belief propagation IS incremental Bayesian
inference, which IS DBSP over a probabilistic semiring.
Same circuit, different weight type.

## The algebra

DBSP operators (D, I, z⁻¹) are linear over the weight
semiring. Current: (Z, +, ×) — the integer ring. The
generalization:

```
ZSet<'K, 'W when 'W : ISemiring>
  where ISemiring provides:
    zero: 'W
    add: 'W -> 'W -> 'W
    mul: 'W -> 'W -> 'W
    (optionally) negate: 'W -> 'W  // ring, not just semiring
```

Candidate weight types:

| Semiring | Weight | Answers | Ring? |
|---|---|---|---|
| Integer (current) | int64 | multiplicity + retraction | yes |
| Boolean | bool | exists? | no |
| Tropical | (float, min, +) | shortest path / confidence | no |
| Probabilistic | [0,1] | how likely? | no |
| Gaussian | (μ, σ²) | estimate + uncertainty | yes |
| Interval | [lo, hi] | bounded uncertainty | yes |
| Provenance | polynomial | which inputs contributed? | yes |

## Key design decisions

1. **Ring vs semiring**: retraction (negative weights)
   requires a ring (additive inverse). Pure semirings
   (boolean, tropical, probabilistic) don't support
   retraction — they'd need the counting variant or
   a different fixpoint strategy.

2. **Distinct operator**: currently clamps to {0, 1}.
   Under probabilistic weights, becomes a threshold
   operator (clamp below cutoff to zero). Under
   Gaussian, becomes a significance test.

3. **Semi-naive optimization**: requires subtraction
   (Δ = new - old). Non-ring semirings need the
   RecursiveCounting variant or a different incremental
   strategy.

4. **Performance**: generic weight dispatch vs
   specialized paths. The integer path must not regress.

## Prior art

- Green, Karvounarakis, Tannen 2007 "Provenance
  Semirings" (PODS) — the foundational framework
- Budiu et al. 2022 "DBSP" — Z-ring instantiation
- Infer.NET — Bayesian inference as message passing
  (the EP/BP direction from AGENDA.md)
- Reaqtor — standing queries with checkpoint (the
  durability layer for streaming inference)

## What exists in Zeta today

- `src/Core/ZSet.fs` — hardcoded `Weight = int64`
- `src/Bayesian/BayesianAggregate.fs` — Bayesian
  aggregation but external to the weight algebra
- `src/Core/NovelMath.fs` — tropical semiring work
  (non-integer semiring already explored)
- `src/Core/Algebra.fs` — algebraic laws, currently
  integer-specific

## Acceptance criteria

- [ ] `Weight` type is generic with ISemiring constraint
- [ ] Integer path performance unchanged (zero regression)
- [ ] At least one non-integer semiring compiles and
  passes a smoke test (Gaussian or Interval)
- [ ] OpenSpec can express uncertainty in spec output
- [ ] Z3 lemmas generalize to semiring axioms

## Composes with

- OpenSpec compiler (the motivation — specs need uncertainty)
- Infer.NET BP/EP direction (belief propagation = DBSP
  over probabilistic semiring)
- `src/Bayesian/` (absorbs into the weight algebra)
- Tropical semiring work in `NovelMath.fs`
- The Superfluid reactor equation (uncertainty in the
  learning gain term)

## Prior art — time-uncertainty in production databases

Aaron 2026-05-09: "lookup spanner and cockroach db real db
primitives of time and lamport include uncertainty measurement
on the datetime" + "there is tidb we should research this
actually and decide if we want to support multiple and make
it pluggable."

| System | Timestamp model | Uncertainty primitive |
|---|---|---|
| Spanner | TrueTime (GPS + atomic) | `[earliest, latest]` interval; commit-wait |
| CockroachDB | HLC (Lamport + wall-clock) | Read uncertainty restart window |
| TiDB | TSO (centralized oracle) | Single-point, no interval |
| YugabyteDB | HLC variant | Similar to CockroachDB |

Lamport's logical clocks → Spanner's TrueTime intervals →
Zeta's weight semiring intervals. Three instantiations of
"carry uncertainty, don't pretend precision."

**Research question:** should Zeta parameterize the
time-uncertainty model (pluggable, like the weight
semiring) so it works over any of these backends? Or
hardcode one model?
