# universal/interference — Universal Interference Interface (how distinct PATHS to one outcome combine)

> **Universal Interference Interface** — the sibling of [`universal/evidence`](evidence.md), and
> deliberately **not** a member of its family. Evidence combines by **join**: idempotent, so the same
> source twice counts once. Interference combines by **sum**: `a + a = 2a`, and opposite-phase
> contributions **cancel**. Both are legitimate; the defect this file exists to end is **one operation
> pretending to be both**.

Aaron, 2026-08-14: *"we can support join and interference both operations and name them differently,
more rx operations are fine."*

## Why this is a sibling file and not a section of `evidence`

They are different algebras with different closure properties, and `universal/` is one-shape-per-file:

- **Evidence** is a **bounded join-semilattice** — idempotent, commutative, associative, unit `empty`,
  no inverses. Its load-bearing property is that *the result of a fold is a valid input to the next fold
  up*, which is what makes it scale-free across individual → society → world (§9, §10).
- **Interference** is the additive group of a **free ℂ-module** `ℂ[Outcome]` — commutative, associative,
  unit `[]`, **inverses exist**, and **NOT idempotent**. Its load-bearing property is the opposite one:
  contributions can **destroy** each other, which is the only way a quorum can disagree with itself to
  zero.

Idempotency (§12) is therefore **declined at this layer by design**, not violated by accident. Filing
that inside `evidence` would make the evidence file assert two contradictory closure properties, and the
society design leans on exactly one of them.

## The shape

| | join (`universal/evidence`) | interference (this file) |
|---|---|---|
| carrier | provenance-keyed atom set | free ℂ-module `ℂ[Outcome]` |
| combine | union | sum |
| `x • x` | `x` (idempotent) | `2x` (**not** idempotent) |
| inverses | none | yes — `x + (−x) = 0` |
| can the result shrink? | never | **yes — that is the instrument** |
| question it answers | *how many independent sources said this?* | *what did the distinct paths add up to?* |

## The composition order is the design

**Join first, interfere second, Born last.** A quorum joins by source — deduplicating, which is the only
thing that stops six agents relaying one data stream folding to six times the confidence (measured
in-repo: `precision = 66.0` on a mean wrong by 5.66) — and *then* sums the distinct sources' amplitudes,
where phases get to cancel. `bornProb` is the third and final crossing, into probabilities. Three named
layers, two named boundaries, and each boundary applied exactly once.

Reversing the order double-counts. Skipping the join makes redundancy indistinguishable from
reinforcement — six copies of one belief look exactly like six independent agreements, which is the
Bayesian layer's blindness restated in amplitudes.

## Cancellation is a MEASUREMENT, not a failure mode

A quorum summing to zero is telling you something true: its members were opposite-phase. The honest
handling is `dual-use-detection-is-neutral-oracle-decides` — report the **neutral fact** (*destructive
interference occurred, at magnitude X*) and let policy attach the reading: honest disagreement,
adversarial phase injection, or a miscalibrated member. `QuorumAlgebra.interferenceExcess` is that fact:
`Coherent − Incoherent`, negative for destructive, positive for constructive, zero for no interference.

**The ambiguity must be stated, not silently resolved.** Soraya's `QuorumPhaseCancellation.tla` shows
the two readings are **observationally identical** from the resultant alone when honest members are
permitted opposite phases — no amount of watching separates them; only a constraint on honest phase does.

**And the tolerance is set by normalisation, not by member count.** With per-member amplitude uncapped,
`f = 1` annihilates any quorum of any size. Normalise per-member contribution before this layer is given
authority, or quorum tolerance collapses from `f < n/3` to `f = 1`.

## Membership contract (what taking this shape requires)

1. **Name the operation.** If it sums, it is not called `merge`, `combine`, or anything a reader could
   mistake for a join. One name, one algebra.
2. **State the idempotency verdict out loud.** "§12 declined here, by design" is a passing answer;
   silence is not.
3. **Report cancellation as a fact.** Emit the magnitude; never emit a verdict.
4. **Cross to probabilities exactly once**, at the Born boundary, and never back — `bornProb ∘ ofSoft =
   id`, but `ofSoft ∘ bornProb` erases every phase. A section, not an isomorphism.
5. **Do not let a threshold delete amplitude.** See the boundary below; a dimensionful epsilon in a
   projective theory is a physics error, not a tuning parameter.

## Bit-perfection (honest boundary — this shape is NOT treaty-grade today)

**Stated plainly: the interference half cannot be byte-locked as implemented.** `AmplitudeEmu`'s
amplitudes are IEEE-754 pairs with an `EPS = 1e-12` drop that deletes any branch whose sum has
`|z| ≤ 1e-6`. Measured consequences (`tests/Tests.FSharp/QuorumAlgebra.Tests.fs`):

- **associativity fails structurally** — one grouping measures `None`, the other `Some` at `1.6e-6`; on a
  larger witness the two groupings differ by `1.0e-7` on a value of `5.0`, about `1.1e8` ULPs;
- **scale-covariance fails** — `support(a) = 2` but `support(0.5·a) = 1`, so halving a state (physically
  the identity, since states are rays) changes its measured Born distribution.

The exit is an **exact cyclotomic carrier** `ℤ[ζ_N]`: unitary modular data is cyclotomic, so nothing is
lost by restricting phases to `N`-th roots of unity, and in an exact ring the only thing dropped is an
*exact* zero — which cannot change a later sum. This is the same restriction Soraya's TLA+ model had to
make (4th roots of unity ⇒ Gaussian integers) to be checking anything at all. Scoping, cost, and the
choice of `N`: `docs/research/2026-08-14-the-quorum-fold-is-not-a-join-interference-vs-evidence-and-the-cyclotomic-exit-lumen.md`.

The **join half is already exact** (ordinal string keys, `String.CompareOrdinal`), and
`QuorumAlgebra.interfereQuorum` folds in ordinal source order, so the sum is at least **reproducible**
across nodes even while it is not exact.

Reference implementation: `src/Core/QuorumAlgebra.fs` (both operations, named apart); the sum itself is
`src/Core/AmplitudeEmu.fs` (`mergeOf`), unchanged.

Anchors: Feynman & Hibbs 1965 (sum-over-paths: amplitudes for *distinct paths* add, and that is exactly
the operation this file names); Born 1926 (the `|ψ|²` crossing); Shapiro, Preguiça, Baquero & Zawirski
2011 (the join-semilattice this shape is explicitly *outside*); Coste & Gannon 1994 and Ng & Schauenburg
2010 (modular data is cyclotomic — the exactness route). *Cited from standing knowledge, not
page-checked.*
