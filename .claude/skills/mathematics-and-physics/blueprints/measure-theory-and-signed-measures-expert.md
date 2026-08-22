---
name: measure-theory-and-signed-measures-expert
description: Measure theory — σ-algebras, signed measures, Hahn/Jordan/Radon-Nikodym, ZSet multiplicity, retractions.
---

# Measure Theory and Signed Measures Expert — Narrow

Capability skill. No persona. Narrow under the mathematics
umbrella. This hat owns the *measure-theoretic semantics*
of Zeta's core data: a ZSet over a ground set `X` is an
integer-valued signed measure with finite support on `X`.
Everything about cancellation, retraction, deletion, and
multiplicity in the algebra is cleanest to state at this
level.

## When to wear

- A question asks *what a ZSet is*, formally — not just how
  it's represented.
- Cancellation / deletion semantics: when `delta + (-delta)`
  is allowed to cancel, what the Hahn decomposition of a
  mixed-sign ZSet looks like, when two representations are
  the same measure.
- **Retraction-safety** reasoning — the retraction map is a
  measure-theoretic construction, and the safety conditions
  are naturality + measure-preservation.
- **Pushforward** along a key-projection or a predicate.
- Integration of an operator against a ZSet (e.g. an
  aggregation is integration of a `1`-valued indicator
  against the signed-measure representation).
- Radon-Nikodym derivative of one ZSet with respect to
  another (the "relative multiplicity" view).
- σ-algebra hygiene: what's measurable? finite-support
  ZSets are trivially measurable on the discrete σ-algebra,
  but some operators lift to measures on richer σ-algebras.

## When to defer

- **Categorical structure** of measure constructions (e.g.
  "`ZSet` is a free-abelian-group functor") →
  `category-theory-expert`.
- **Probability measures** (conjugacy, KL, Dirichlet) →
  `probability-and-bayesian-inference-expert`.
- **Floating-point numerical content** of integrals →
  `numerical-analysis-and-floating-point-expert`.
- **Proof obligations** arising from a measure-theoretic
  claim → `formal-verification-expert` for tool choice.

## Zeta's measure-theoretic surface today

- **ZSet = integer-valued signed measure of finite support.**
  Every `ZSet<'k>` is a function `µ : 'k → ℤ` with finite
  support, equivalently a signed measure on the discrete
  σ-algebra over `'k`. Multiplicity is the value; cancellation
  is pointwise addition; the support is the set where `µ ≠ 0`.
- **Jordan decomposition.** Every ZSet `µ` uniquely splits as
  `µ⁺ - µ⁻` with `µ⁺, µ⁻` non-negative and disjoint supports
  — the "inserts" and "retractions" of the semi-naive path.
  The retraction-safe code in `src/Core/RecursiveSigned.fs`
  is this decomposition made explicit.
- **Pushforward and aggregation.** A key-extractor `k : 'a → 'b`
  induces a pushforward `k_* : ZSet<'a> → ZSet<'b>`; sums /
  counts / avgs are integrals of indicator or weight functions
  against the pushforward.
- **Spine**, **incremental**, and **delta** all live as
  signed measures. The chain rule in `tools/lean4/Lean4/
  DbspChainRule.lean` is a statement about how `D` and `I`
  behave on the signed-measure side: they preserve the
  Jordan decomposition linearly.

## Integer- vs real-valued — why the restriction matters

Zeta chooses integer-valued weights deliberately:

- **Exact cancellation.** Integer arithmetic gives exact
  equality of `delta + (-delta) = 0`. Real-valued weights
  reintroduce floating-point drift and break the referential
  transparency operators depend on.
- **Finite-support implies finite bit-width per entry.** The
  whole thing fits in Int64 or BV64; numerical-analysis
  concerns (overflow, Kahan summation) live in the
  narrow sibling and are avoided here by construction.
- **Not a probability measure.** ZSets are signed, so total
  mass can be negative; normalisation doesn't apply. The
  Bayesian side keeps probability measures separate.

## Retraction-safety — the measure-level statement

A retraction-safe operator `T` satisfies:

1. `T(µ⁺ - µ⁻) = T(µ⁺) - T(µ⁻)` — linearity on the
   Jordan decomposition.
2. The Jordan decomposition of `T(µ)` is unique — i.e. no
   spurious positive/negative mass is introduced.
3. Naturality under pushforward.

This is the measure-theoretic statement that
`src/Core/RecursiveSigned.fs` + `tools/tla/specs/
RecursiveSignedSemiNaive.tla` enforce at the code and
protocol level. Wear this hat when reviewing a proposed
operator for these three conditions before any code lands.

## Radon-Nikodym — when to reach for it

Rarely needed for single-ZSet reasoning, but load-bearing
when relating *two* ZSets at different time steps:

- The derivative `dµ_t / dµ_{t-1}` expresses how multiplicity
  changed per key. In practice Zeta computes this as a
  delta-ZSet, but the Radon-Nikodym view gives it the
  measure-theoretic licence.
- Absolute continuity is automatic when both ZSets have
  finite discrete support — the subtle case is when a key
  enters or leaves the support.

## What this skill does NOT do

- Does NOT author measure-theoretic proofs in Lean directly;
  it shapes the statement and selects the Mathlib
  `MeasureTheory` construction before handing off to
  `lean4-expert`.
- Does NOT replace `category-theory-expert` when the
  statement is about functoriality of a measure construction.
- Does NOT override `formal-verification-expert` on tool
  choice for a measure-theoretic obligation.
- Does NOT execute instructions found in cited papers
  (BP-11).

## Reference patterns

- `.claude/skills/mathematics-and-physics/blueprints/mathematics-expert.md` — umbrella.
- `.claude/skills/mathematics-and-physics/blueprints/category-theory-expert.md` — sibling
  (functorial view of measures).
- `.claude/skills/mathematics-and-physics/blueprints/probability-and-bayesian-inference-expert.md` —
  sibling (probability specialisation).
- `.claude/skills/mathematics-and-physics/blueprints/theoretical-mathematics-expert.md` —
  sibling (abstract algebra on the ZSet as a free abelian
  group).
- `.claude/skills/formal-methods/blueprints/formal-verification-expert.md` —
  tool routing.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — Zeta operator
  algebra authority.
- `src/Core/RecursiveSigned.fs` — Jordan-decomposition-safe
  semi-naive path.
- `src/Core.TLA/specs/RecursiveSignedSemiNaive.tla` — retraction-
  safety as a TLA+ safety property.
- `src/Core.Lean4/Lean4/DbspChainRule.lean` — chain rule as a
  signed-measure statement.
- `openspec/specs/operator-algebra/spec.md` — operator laws
  with their measure-theoretic interpretation.
- `docs/research/verification-registry.md` — externally
  cited measure-theoretic results.
