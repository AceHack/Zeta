---
name: Checked vs unchecked arithmetic — production-tier Craft topic (not onboarding) + Zeta production-code audit; unchecked is much faster when safe; per-site bound analysis required
description: Aaron 2026-04-23 Otto-47 — *"make sure we are using uncheck and check arithmatic approperatily, unchecked is much faster when its safe to use it, this is production code training level not onboarding materials, and make sure our production code does this backlog itmes"*. Names two BACKLOG items at once: (a) Craft needs a production-tier ladder above onboarding, exemplified by a checked-vs-unchecked module; (b) Zeta production code uses `Checked.(+)`/`Checked.(*)` pervasively (ZSet/Operators/Aggregate/TimeSeries/Crdt/CountMin/NovelMath) and each site should be audited for bound-provability — demote to unchecked where the bound can be proved, keep Checked where it cannot, benchmark the delta.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Checked vs unchecked arithmetic — production-tier directive

## Verbatim (2026-04-23 Otto-47)

> oh yeah i forgot to mention make sure we are using uncheck
> and check arithmatic approperatily, unchecked is much
> faster when its safe to use it, this is production code
> training level not onboarding materials, and make sure
> our production code does this backlog itmes

## Two entangled directives

**(1) Craft curriculum gains a production tier.**
Previous Craft modules (zset-basics, retraction-intuition,
operator-composition, semiring-basics) are explicitly
onboarding-tier: anchor metaphors (tally-counter, undo-button,
LEGO, recipe-template), applied-default-theoretical-opt-in.
Aaron names a *distinct* tier: **production code training**.
This tier isn't a harder version of onboarding — it's a
different audience with different goals. Covers performance-
correctness tradeoffs, JIT behavior, allocation discipline,
bound-proving, benchmark-driven-tuning. The checked-vs-
unchecked arithmetic topic is the exemplar.

**(2) Zeta production code needs a checked/unchecked audit.**
Current state (observed at directive time):

- `Checked.(+)` / `Checked.(*)` appear ~30 times across
  `src/Core/{ZSet, Operators, Aggregate, TimeSeries, Crdt,
  CountMin, NovelMath, IndexedZSet}.fs`
- Canonical rationale at `src/Core/ZSet.fs:227-230`:
  *"Z-set weights are int64 but nothing stops a stream
  from running forever; silent wraparound on overflow would
  turn a +2^63 multiset into a -2^63 multiset and corrupt
  every downstream query."*
- Rationale is correct for **weight sums on unbounded
  streams** but applies unevenly — some sites are bounded
  by construction (counter increments, bounded-domain
  products, SIMD-lane sums) and paying checked-arithmetic
  cost unnecessarily

The audit is not "add checked everywhere" — it is
"**demote checked to unchecked where the bound can be
proved, keep it where it cannot.**" Aaron's *"unchecked is
much faster when its safe to use it"* is the
operative principle: F# defaults to unchecked; `Checked.`
is a deliberate opt-in that pays ~2-5ns per op on tight
loops and disables SIMD-vectorisation paths entirely
(`System.Numerics.Vector<int64>` has no checked variant).

## Site classification for the audit

Per-site decision matrix (applied during BACKLOG execution,
not this tick):

| Class | Rationale | Default |
|---|---|---|
| **Bounded-by-construction** | Compile-time or type-system proof the expression cannot overflow (e.g. `Int32.MaxValue + 1` impossible because LHS is `byte`) | unchecked |
| **Bounded-by-workload** | Provable bound via invariant (e.g. counter increment monotonic; total op count < 2^63 for any reasonable uptime) | unchecked + comment citing the bound |
| **Bounded-by-pre-check** | Cheap upstream guard makes overflow impossible in hot path | unchecked in hot loop, check at boundary |
| **Unbounded stream sums** | Cumulative weights across infinite stream; no bound provable | **keep Checked** with rationale comment |
| **User-controlled × user-weight** | Product of two caller-provided values; overflow is attack surface | **keep Checked** |
| **SIMD-candidate** | Loop that could vectorize via `Vector<int64>` | unchecked with pre-check for overflow at block boundary |

## How to apply

### For the production-tier Craft module

Anchor: a concrete F# benchmark the reader can run showing
the throughput delta between `Checked.(+)` and `(+)` on a
100M-element int64 sum loop. Expected result: 2-4x speedup
unchecked, larger if SIMD-vectorisation fires. Reader leaves
with:

- F# defaults to unchecked; `Checked.` is opt-in
- When to opt in (rules above)
- How to prove a bound (FsCheck property test; upstream
  invariant; algebraic argument)
- How to detect silent overflow in production (sign-flip
  invariant checks; observation at stream boundaries)
- The Zeta-specific choice: cumulative-weight sums stay
  Checked because stream-lifetime > 2^63 ops is not
  excludable; counter increments and SIMD-lane sums demote

This is **production training**, not onboarding — a reader
already comfortable with F# types, spans, and allocation.
Prerequisites: zset-basics + operator-composition onboarding
modules + familiarity with BenchmarkDotNet.

### For the production-code audit

Scope: every `Checked.` site under `src/**`. Deliverable:

1. `docs/research/checked-unchecked-audit-2026-MM-DD.md`
   listing every site with its classification, bound
   argument, and recommended action
2. Per-action BenchmarkDotNet micro-benchmark showing
   throughput delta (keeps gains honest; prevents
   Goodhart-risk of demoting safe-sites for vanity-perf)
3. Property-test additions where a bound is asserted
   (FsCheck random-generation within the proven range;
   boundary tests at ±2^62)
4. PR demoting only sites with (a) classification proved
   and (b) benchmark showing ≥5% improvement and (c)
   property tests validating the bound

Owner: Naledi (perf-engineer) runs the benchmarks;
Soraya (formal-verification) validates the bound proofs;
Kenji (Architect) integrates. Kira (harsh-critic) reviews
the final PR — any unjustified demotion is a P0.

## Composes with

- `feedback_samples_readability_real_code_zero_alloc_2026_04_22.md`
  — same split-discipline (samples ≠ production); this extends
  it to pedagogy (onboarding-tier ≠ production-tier)
- `project_semiring_parameterized_zeta_regime_change_...`
  — Checked arithmetic is semiring-specific; a
  semiring-parameterized rewrite would move the audit
  from int64 to whichever semiring's `⊕` is being used
- `feedback_deletions_over_insertions_complexity_reduction_
  cyclomatic_proxy.md` — demoting `Checked.(+)` to `(+)`
  is a deletion-with-tests-passing (complexity-reduction
  positive signal) if bounds hold
- `docs/BENCHMARKS.md` "Allocation guarantees" — the
  audit's benchmark deliverable lands here
- `src/Core/ZSet.fs:227-230` — the canonical rationale
  comment that the audit preserves or replaces per site

## What this directive is NOT

- **Not a mandate to demote every `Checked.` site.** Some
  are genuinely unbounded — the canonical stream-weight-sum
  case at ZSet.fs:227 stays Checked. The audit is about
  identifying where we over-applied, not removing all
  safety.
- **Not a license to skip property tests.** Every demotion
  pays for itself only if the bound is proved; demoting
  without the proof is a regression waiting to happen.
- **Not authorisation to disable `CheckForOverflowUnderflow`
  project-wide.** F# defaults are already unchecked; we opt
  into checked explicitly. The audit preserves that
  explicit-opt-in model.
- **Not a rush.** Per-site analysis + benchmarks + property
  tests is L-effort. Land as a research doc first, then a
  PR series (one subsystem at a time), with Naledi's
  benchmarks in each PR.
- **Not a replacement for the Checked-by-default rule for
  new code.** When writing new arithmetic, default to
  Checked; demote to unchecked only after the bound
  analysis. The audit is retrospective; the rule going
  forward stays Checked-first.
- **Not onboarding material.** Aaron was explicit: this is
  production-tier. Onboarding-tier Craft modules do not
  teach `Checked.` / `unchecked`. A reader who doesn't yet
  understand why a ZSet is an `ImmutableArray<ZEntry>` is
  not ready for overflow semantics.

## Attribution

Aaron (human maintainer) named the directive. Otto (loop-
agent PM hat) absorbed it + filed this memory + BACKLOG
rows. Naledi + Soraya + Kenji + Kira queued for execution
when the audit row fires. The production-tier Craft module
owner is TBD — likely Naledi (perf authorial voice) with
Kenji integration.
