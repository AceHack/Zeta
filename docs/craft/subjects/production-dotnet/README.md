# Production .NET — the craft tier for performance-correctness work

**Tier:** production
**Audience:** contributors fluent in F# types, spans, and
allocation; already comfortable with the onboarding Craft
tier under `subjects/zeta/` (currently ships with
`retraction-intuition` on main; `zset-basics`,
`operator-composition`, `semiring-basics` are in-flight
PRs `#200` / `#203` / `#206`).
**Prerequisites:** BenchmarkDotNet literacy; willingness to
read disassembly when it matters; property-based testing
(FsCheck) in your toolbelt.

---

## What this tier is

This is a **distinct ladder** from the onboarding Craft tier
— not a harder onboarding. The onboarding tier teaches *what
a Z-set is* with a tally-counter anchor; the production tier
teaches *when to pay a checked-arithmetic cost and when to
demote it for a measured speedup*. Different audience,
different prerequisites, different lessons.

Both tiers share the Craft pedagogy discipline:

- **Applied is default, theoretical is opt-in.** A production-
  tier reader still gets the decision framework before the
  formal justification. The theoretical section is where the
  bound-proof lives for readers who want to verify the
  reasoning.
- **Anchor in real code.** Every module references a concrete
  site in Zeta (or a runnable benchmark) rather than a
  contrived example. Production-tier anchors are bigger —
  they show the workload shape, not just the syntax.
- **Bidirectional alignment.** After the module, both reader
  and author should be better calibrated. If a reader spots
  an unjustified claim, the module gets revised.

## What lives here

| Module | Focus | Zeta touchpoint |
|---|---|---|
| [`checked-vs-unchecked`](checked-vs-unchecked/module.md) | When F# `Checked.(+)` is load-bearing vs. when `(+)` is fine | `src/Core/ZSet.fs:227-230` rationale |

More modules land as the production-discipline BACKLOG fires.
Expected neighbours (not yet authored):

- `zero-alloc-hot-loops` — `Span<T>`, `ArrayPool<T>`,
  `stackalloc`, when JIT elides bounds-checks, when it does
  not
- `simd-vectorisation` — `System.Numerics.Vector<int64>`,
  alignment rules, the ban on mixed checked+vectorised
  arithmetic
- `struct-vs-ref-semantics` — readonly-struct-by-in-ref
  patterns; struct-tuple `ZEntry` rationale
- `jit-inlining-rules` — `[<MethodImpl(AggressiveInlining)>]`
  vs. `inline` keyword; when inlining triggers vs. silently
  fails

## How to read a production-tier module

1. **Anchor section** — the runnable scenario (often a
   BenchmarkDotNet harness you can clone and execute). Read
   this first; run it if you can.
2. **Decision framework** — a small number of cases, each
   with a clear rule and a concrete example.
3. **Theoretical track (opt-in)** — the bound-proof or
   algebraic justification. Skip on first read; return when
   you need to justify your own demotion.
4. **Zeta-specific choice** — how the framework applied to
   our code. Names the sites, the rationale, the tradeoff.
5. **Composes with** — other Craft modules and memory files
   that sharpen this one.

## What this tier is NOT

- **Not an advanced-onboarding module.** Onboarding readers
  should not start here. A reader who has not yet internalised
  what a Z-set is cannot productively reason about overflow
  bounds on Z-set weight sums.
- **Not a micro-optimisation playground.** Every proposed
  demotion or rewrite is justified by (a) a proved bound and
  (b) a BenchmarkDotNet measurement showing ≥ 5 % improvement.
  No vibes-perf.
- **Not a license to skip correctness.** Production-tier
  techniques that risk correctness (e.g. demoting `Checked.`
  to `(+)`) demand property-test coverage for the asserted
  bound. If the bound cannot be proved, the safer code stays.
