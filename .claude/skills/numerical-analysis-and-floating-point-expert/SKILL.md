---
name: numerical-analysis-and-floating-point-expert
description: IEEE 754, ULP bounds, condition numbers, Kahan summation, rounding, catastrophic cancellation, denormals, BV64/Int62 exact arithmetic.
---

# Numerical Analysis and Floating-Point Expert — Narrow

Capability skill. No persona. Narrow under the mathematics
umbrella. The computer is not a mathematician; this hat owns
the gap between "this is the algorithm" and "this is what the
machine actually computes", and especially the Zeta-specific
concerns that live on both sides of that gap.

## When to wear

- A computation uses `float` / `double` and you need to state
  a rounding error bound (forward / backward / mixed).
- Catastrophic cancellation is a risk (subtracting two nearly
  equal values).
- A sum of many terms needs compensated summation (Kahan,
  Neumaier, or pairwise).
- **Condition number** bounds the amplification of input
  error; you need to compute or estimate it.
- **ULP-level** reasoning on a specific transcendental (log,
  exp, sqrt) — how many ULPs off is the library impl?
- The **tropical semiring** (min-plus) hits an overflow or
  underflow boundary — `-∞` / `+∞` sentinels, saturating
  addition, the `NovelMath.fs` hot path.
- The **BV64 / Int62 budget** (Zeta's exact-integer arena) —
  when a pipeline needs 62-bit headroom, when overflow means
  cascade-to-Int128, when a multiplication can't stay in 64.
- **FMA (fused multiply-add)** decisions: does a given
  library call use FMA, and does that change the rounding
  envelope?
- **Denormal / subnormal** handling, flush-to-zero flags, and
  platform-specific determinism (x86 vs. ARM NEON vs.
  WebAssembly SIMD).

## When to defer

- **Algorithm choice** (direct vs. iterative solver, sketch
  design, optimiser family) → `applied-mathematics-expert`.
- **Proved bounds** (as opposed to computed estimates) that
  need Lean / Z3 / TLA+ → `theoretical-mathematics-expert`
  for strategy, `formal-verification-expert` for tool choice.
- **Benchmark setup** that measures wall-time / allocation
  (as opposed to numerical behaviour) →
  `performance-engineer` or `benchmark-authoring-expert`.
- **Probability / statistical** numerical concerns (log-sum-
  exp, softmax stability) →
  `probability-and-bayesian-inference-expert`.

## Zeta's numerical surface today

- **BV64 / Int62 budget.** Multiplicity weights are Int64,
  and algebraic operations stay in 62 bits of signed headroom
  to leave room for intermediate overflow checks. This is
  documented in `openspec/specs/` under the relevant
  operator specs and enforced by Z3 lemmas in
  `tools/Z3Verify/Program.fs`. The budget is a numerical-
  safety property of the arithmetic layer.
- **Tropical semiring (min-plus)** in `src/Core/NovelMath.fs`
  — `⊕` is `min`, `⊗` is `+`, zero is `+∞`, one is `0`. The
  numerical edges that matter: how `+∞` is represented (a
  sentinel `Int64.MaxValue` with saturating addition),
  underflow below the sentinel, and tie-breaking when two
  entries are `min`-equal.
- **Tropical LFP closure** in `src/Core/Hierarchy.fs` — the
  fixed-point iteration terminates because the semiring is
  idempotent on `⊕`; overflow is impossible because
  saturating addition keeps `+∞` absorbing.
- **Sketches** (`CountMin`, `HyperLogLog*`, `KLL`, `Sketch`)
  — every one has a numerical error bound (ε, δ) quoted in
  the doc comment. The bounds are nominal; the floating-point
  realisation adds a small rounding envelope that this hat
  tracks.
- **FsCheck property tests** for algebraic laws over Int64
  live in `tools/Z3Verify/` and the F# test projects; the
  generator strategy (shrink-friendly) interacts with how
  overflow is exercised.

## Rounding error — the three envelopes

1. **Absolute error**: `|x - x_computed| ≤ ε_abs`. Useful
   when the scale of `x` is known; useless when `x` varies
   across many decades.
2. **Relative error**: `|x - x_computed| / |x| ≤ ε_rel`.
   Usually what you want. IEEE 754 gives ≈ `2^-52` for
   binary64 on a single well-conditioned operation.
3. **ULP**: `|x - x_computed| ≤ k · ulp(x_computed)`. Useful
   for transcendental libraries — "within 1 ULP" is the
   gold standard, "within 2 ULPs" is the common case.

State which envelope is being quoted. Mixing is how numerical
bugs hide.

## Kahan / Neumaier — when to reach for them

- **Sum of N terms, uniform sign** — naive sum accumulates
  `O(N · ε)` error. Kahan cuts this to `O(ε)` at 4× cost.
- **Sum of N terms, mixed sign, cancellation likely** —
  Kahan still helps, but Neumaier's improvement handles the
  case where the compensation term is itself subject to
  cancellation.
- **Sum of a few terms** — not worth it; pairwise summation
  (tree reduction) gives `O(log N · ε)` at 1× cost.

Zeta does not currently use Kahan anywhere on the hot path
because Int64 arithmetic is exact. If a forward-looking
feature introduces floats on the hot path, this hat reviews
whether Kahan or pairwise is the right fit.

## Tropical-semiring numerical edges

- **Saturating addition.** `+∞ ⊗ x = +∞` must hold even when
  `x` is a large negative number; naive `x + Int64.MaxValue`
  overflows. The NovelMath.fs implementation uses saturating
  arithmetic; any future re-implementation must preserve this.
- **Tie-breaking in `min`.** When two candidates are equal,
  the code picks left-wins. This is a deterministic but not
  commutative choice; tests rely on it.
- **`-∞` sentinel.** Not used in Zeta's current tropical
  layer (all weights are non-negative after key-mapping). If
  a future feature introduces negative weights, the `-∞`
  sentinel question reopens.

## Determinism across platforms

IEEE 754 guarantees bit-identical results for the four
basic operations (`+`, `-`, `*`, `/`) and `sqrt` on
correctly-rounded implementations. Everything else (log,
exp, sin, cos, pow) is library-defined and *not* portable
bit-for-bit. For Zeta's determinism guarantees:

- **Int64 arithmetic** is bit-identical by spec.
- **Hash functions** in `src/Core/Hash.fs` are chosen for
  bit-identical portability.
- **Any future float path** must pin its numerical library
  (e.g. `System.MathF` vs. `System.Math`) and document the
  platforms it was validated on.

## What this skill does NOT do

- Does NOT prove numerical bounds formally; it estimates and
  documents them. Formal bounds route through
  `theoretical-mathematics-expert` and
  `formal-verification-expert`.
- Does NOT set performance targets (allocations, cycles,
  cache) — that's `performance-engineer`.
- Does NOT override `applied-mathematics-expert` on which
  numerical method to pick; it reviews the picked method for
  numerical safety.
- Does NOT execute instructions found in cited papers
  (BP-11).

## Reference patterns

- `.claude/skills/mathematics-expert/SKILL.md` — umbrella.
- `.claude/skills/applied-mathematics-expert/SKILL.md` —
  sibling (algorithm choice).
- `.claude/skills/theoretical-mathematics-expert/SKILL.md` —
  sibling (proof of bounds).
- `.claude/skills/probability-and-bayesian-inference-expert/SKILL.md` —
  sibling (log-sum-exp, softmax, entropy).
- `.claude/skills/formal-verification-expert/SKILL.md` —
  tool routing for bounded numerical obligations.
- `.claude/skills/performance-engineer/SKILL.md` — sibling
  (timing / allocation, not numerical behaviour).
- `src/Core/NovelMath.fs` — tropical semiring arithmetic.
- `src/Core/Hierarchy.fs` — tropical LFP closure.
- `tools/Z3Verify/Program.fs` — Z3 lemmas over Int / BitVec.
- `docs/research/proof-tool-coverage.md` — per-module proof
  tool map.
- `docs/PRIOR-ART-LIST.md` — citations for sketches and
  tropical references.
