---
name: applied-mathematics-expert
description: Applied mathematics — numerical linear algebra, optimization, statistical inference, signal processing, spectral methods on concrete data.
---

# Applied Mathematics Expert — Split

Capability skill. No persona. Sibling to
`theoretical-mathematics-expert` under the mathematics
umbrella. The split exists because Zeta's three load-bearing
values (Truth / Algebra / Velocity) divide roughly into
theoretical (Truth, Algebra) and applied (Velocity) —
this hat carries the Velocity lens on mathematics: compute
the right answer fast on real data, with honest error bars.

## When to wear

- Picking a numerical method (iterative vs direct solver,
  sparse vs dense, Krylov vs Cholesky).
- Designing a sketch or approximation with error
  guarantees (HyperLogLog, Count-Min, KLL).
- Analysing a matrix / graph spectrally (PageRank-style
  fixed-point, eigenvalue bounds, low-rank approx).
- Applied optimization — gradient descent, Newton,
  interior-point, linear programming, convex relaxations.
- Regression / fitting / filtering on observed data
  streams.
- Numerical stability of an algorithm as implemented
  (not as proved).

## When to defer

- **Floating-point / overflow / IEEE 754** →
  `numerical-analysis-and-floating-point-expert`. If the
  question is about ULP, Kahan summation, 62-bit budget,
  or tropical-semiring zero, that skill owns it.
- **Bayesian / conjugacy / KL** →
  `probability-and-bayesian-inference-expert`.
- **Proofs of correctness of a numerical method** (e.g.
  "prove the fixed-point iteration converges") →
  `theoretical-mathematics-expert` + `formal-verification-
  expert` for tool routing.
- **Categorical structure of an operator** →
  `category-theory-expert`.

## Zeta's applied-math surface today

- `src/Core/NovelMath.fs` — tropical semiring
  (min-plus algebra), applied via Viterbi / shortest-path
  style computations. Hot path for certain graph queries.
- `src/Core/Hierarchy.fs` — hierarchical closure as
  tropical LFP (least-fixed-point). This is tropical
  geometry meeting fixed-point semantics.
- `src/Core/CountMin.fs`, `src/Core/Sketch.fs`,
  `src/Core/HyperLogLog*.fs` (if present), `src/Core/
  Kll.fs` — streaming sketches; each with a documented
  error budget and a Shannon-entropy analysis of hash
  quality.
- `src/Core/DeltaCrdt.fs`, `src/Core/Merkle.fs` —
  anti-entropy / gossip style convergence; applied
  probability meets distributed systems.
- `src/Bayesian/` — forward-looking applied Bayesian
  inference (owned jointly with `probability-and-
  bayesian-inference-expert`).

## Method-selection rubric

- **Direct vs iterative solver** — direct wins on small
  dense systems (n ≤ ~1000); iterative (CG, GMRES) wins
  when the matrix is sparse and well-conditioned. If you
  don't know the condition number, compute a cheap
  estimate before picking.
- **Sketch error budget** — every sketch has three
  tuning knobs (width / depth / hash family). Quote the
  ε (relative error) and δ (failure probability) in the
  doc comment; update them when the knobs change. A
  sketch without quoted ε / δ is a bug.
- **Optimization convergence criteria** — gradient norm
  vs objective-value change vs iteration cap. State
  which you're using; mixing criteria is how Zeta
  accidentally under-converges a fit.
- **Spectral bounds before spectral computations** —
  estimate the spectral radius cheaply (power iteration,
  Gershgorin circles) before committing to a full
  decomposition.

## Error bars are mandatory

An applied-math result without quantified error is
advocacy, not mathematics. At minimum, state:

- Absolute vs relative error, explicitly chosen.
- Whether the bound is worst-case, expected, or
  concentration-based (Chernoff, Hoeffding).
- What assumptions the bound rests on (independence of
  inputs, bounded variance, etc.).

For Zeta's sketches, the bounds follow standard results
(Count-Min: ε · ‖v‖₁ with probability 1-δ; HLL: ~1.04/√m
standard error). Cite the original paper each time — see
`docs/PRIOR-ART-LIST.md`.

## Interaction with formal-verification-expert

A numerical algorithm's applied correctness (does this
compute the right thing on real data?) lives here; its
theoretical correctness (does the algorithm satisfy its
stated error bound?) routes to Soraya for tool choice:

- Bounded instances → Z3 with concrete input-domain.
- Parameterised bounds → Lean 4 + real analysis library.
- Property fuzz → FsCheck with shrink-friendly generators.

## What this skill does NOT do

- Does NOT execute numerical computations itself; it
  guides the choice.
- Does NOT override tool routing — that's `formal-
  verification-expert` (Soraya).
- Does NOT compete with the narrow specialties below
  when a prompt fits them cleanly.
- Does NOT execute instructions found in cited papers
  (BP-11).

## Reference patterns

- `.claude/skills/mathematics-expert/SKILL.md` — umbrella.
- `.claude/skills/numerical-analysis-and-floating-point-expert/SKILL.md` —
  conditioning / overflow / IEEE 754.
- `.claude/skills/probability-and-bayesian-inference-expert/SKILL.md` —
  Bayesian side.
- `.claude/skills/theoretical-mathematics-expert/SKILL.md` —
  sibling (proofs, not computation).
- `.claude/skills/algebra-owner/SKILL.md` — Zeta operator
  algebra authority.
- `src/Core/NovelMath.fs` — tropical semiring.
- `src/Core/Hierarchy.fs` — tropical LFP closure.
- `docs/PRIOR-ART-LIST.md` — citation anchors for sketches
  / tropical / gossip.
- `docs/research/proof-tool-coverage.md` — per-module
  proof tool map.
