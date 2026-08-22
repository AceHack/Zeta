---
id: 081M05DPGKR087G0R0017GX310
type: bug
state: backlog
priority: P2
slug: categoricalfactortensor-has-three-absent-key-semantics-and-o
title: "CategoricalFactorTensor has three absent-key semantics and one keyspace for two distributions"
created: 2026-08-16T13:55:36.696Z
depends_on: []
composes_with:
  - 081M05DPKQA087G0R0036HE8CE
---

# CategoricalFactorTensor has three absent-key semantics and one keyspace for two distributions

`CategoricalFactorTensor.logProbabilities` is a `ReadonlyMap<string, number>` — a
**partial** function. Every consumer must therefore supply a total extension (a
default for absent keys). `src/Core.TypeScript/bayesian/categorical-bayesian-planner.ts`
supplies **three different ones**, and reads the map under **two different key
namespaces**. Consequence: a `CategoricalFactorTensor` value does not denote a
single mathematical function — what it means depends on which call site reads it.

Found while investigating whether an adapter to `FactorGenerator` was warranted
(081M05DPKQA087G0R0036HE8CE). This bug is the reason that adapter is blocked.

## Defect 1 — three absent-key semantics in one file

| site | default | what it means |
|---|---|---|
| `combineFactorsCommutatively` L44–45 | `?? 0.0` | `log(1)` — the **identity of log-space addition**. Algebraically forced. |
| `BayesianHierarchicalSearch` coarse L158 | `?? -0.1` | heuristic penalty for an unseen **block** |
| `BayesianHierarchicalSearch` fine L236, L277 | `?? -0.05` | heuristic penalty for an unseen **cell** |

These are not merely three different numbers; they are two different *kinds*.
`0.0` is the monoid identity and is **not tunable** — the fusion contract depends
on it (see falsifier below). `-0.05` / `-0.1` are search heuristics and *are*
tunable. Storing both kinds behind the same bare `??` literal hides which is which.

**Verified (mutation, not inference).** Changing L44/L45 from `?? 0.0` to `?? -0.05`
leaves the pairwise test *green* and turns the 100-permutation property test **red**:

```
Expected: [["0,0",-0.2],...,["3,3",-1.04]]
Received: [["0,0",-0.2],...,["3,3",-1.09]]
```

That result also grades the two existing tests:

- `STRICT BYTE-LOCK COMMUTATIVE INVARIANT` (pairwise `combine(A,B) === combine(B,A)`)
  **survives the mutation** — as it must, since `(a+d)+(b+d)` commutes for *any* `d`.
  It tests commutativity and **cannot** pin the identity element. Not a vacuous
  test, but not a falsifier for this property.
- `PROPERTY TEST: 100 random frame arrival permutations` **is** the falsifier. What
  it actually pins is **associativity of the left fold**, which holds iff `d = 0`:
  a factor absent from one operand accumulates `+d` once per combine step it is
  absent from, so different bracketings drift apart by multiples of `d`.

**Fix direction:** carry the absent-key semantics **in the type** (e.g. a required
`defaultLogProb` field, or a distinct type for a fused factor whose default is
fixed at `0.0`), so no call site can silently choose a different total extension.

## Defect 2 — one keyspace, two distributions

The module docstring declares two distinct distributions: *"Coarse Level 0 …
P(B_next | B_curr)"* and *"Fine Level 1 … log P(S_next | S_curr, A)"*. Both are
read out of the **same** `transitionFactors.logProbabilities` map, with block
coords and cell coords formatted by the same `` `${r},${c}` `` scheme and no
namespace tag. Block `1,1` and cell `1,1` are the same string.

**Verified by instrumenting the search** (probe on the existing test's fixture:
`gridSize=8, blockSize=2, factorA` with keys `0,0 0,1 1,1`):

```
keys queried as BLOCK coords: 0,0 0,1 0,2 0,3 1,0 ... 3,3
keys queried as CELL  coords: 0,0 0,1 1,0 1,1 ... 7,7
same string used as both    : 0,0 0,1 1,0 1,1 2,0 2,1 3,0 3,1   (8)
tensor entries consumed at BOTH levels: 0,0 0,1 1,1            (3 of 3)
```

**All three** entries of the fixture are consumed once as a block-level
transition belief and again as a cell-level step log-likelihood. The overlap is
structural, not fixture-specific: block coords range `0..ceil(gridSize/blockSize)-1`
and cell coords range `0..gridSize-1`, so every block key is also a valid cell key
whenever `blockSize > 1`.

**Fix direction:** namespace the keys (`b:1,1` vs `s:1,1`) or — better — take two
tensors, since they are two distributions. Note this changes `BayesianHierarchicalSearch`'s
signature, so it is a behaviour change, not a rename.

## Recorded coincidence (NOT a claim of intent)

`-0.1 === 2 × -0.05`, and the existing test uses `blockSize = 2` — so the coarse
default *numerically* equals two fine steps in that one configuration. Nothing in
the code scales the default by `blockSize`; both are bare literals. Logged as a
**coincidence** under `.claude/rules/numerology-vs-number-theory.md`, not as
evidence that the coarse default was derived from the fine one. It would be
promoted only by finding the intent (or by the fix making it `-0.05 * blockSize`
deliberately).

## Minor, separate — the falsifier's own hygiene

The property test shuffles with `[...factors].sort(() => Math.random() - 0.5)`:

- **Unseeded ambient randomness** in a determinism test — a DST §7 / §13
  noninterference smell. It is not replayable from a seed.
- **Biased shuffle.** Measured over 600k trials on 3 elements:
  `ABC 25.0% · BAC 25.0% · ACB/BCA/CAB/CBA 12.5% each` — not uniform over the 6
  permutations.

Neither invalidates the falsifier — measured `P(100 consecutive identity perms)
≈ 6e-61`, so the flaky-pass risk is negligible. Recorded so the test is not later
mistaken for a seeded property test.

## Falsifiers available for the fix

1. The existing 100-permutation test already goes red if the fusion identity is not
   `0.0` (demonstrated above). Keep it; consider seeding it.
2. Add a direct associativity test: `combine(combine(A,B),C) === combine(A,combine(B,C))`
   byte-for-byte — this pins `d = 0` explicitly rather than statistically.
3. For Defect 2: a test asserting that a tensor entry keyed for a block is *not*
   read at the cell level. Today such a test fails; that is the point.

## Provenance

Investigated by the shadow, routed by Otto, 2026-08-16. Mutation run and keyspace
probe executed against `origin/main`; both results reproduced before filing. No
production code changed by this work-item.
