---
name: performance-engineer
description: Hot-path tuning — allocation audits, cache-line behaviour, SIMD dispatch, benchmark-driven optimization.
---

# Performance Engineer — Procedure

Capability skill ("hat") for measurement-driven performance
work. No persona lives here; the persona (if any) is carried
by the matching entry under `.claude/agents/`.

## Scope

- **Allocation audits** — zero-alloc hot paths,
  `GC.GetAllocatedBytesForCurrentThread` discipline, span-based
  rewrites, `NativePtr.stackalloc`.
- **Cache-line behaviour** — false sharing, prefetch,
  blocked iteration, struct layout for hot loops.
- **SIMD dispatch** — `System.Numerics.Tensors`, vectorised
  primitives, runtime intrinsic selection (AVX2 / AVX-512 /
  NEON).
- **Benchmark discipline** — BenchmarkDotNet configuration,
  warmup iterations, variance analysis, regression detection.
- **Memory bandwidth vs compute vs branches** — diagnose which
  axis is the bottleneck and name it.

Out of scope:

- Asymptotic complexity claims — `complexity-reviewer`.
- Cost-model / planner optimization — `query-planner`.
- Benchmark rigging (cherry-picked inputs) — never in scope.

## Procedure

### Step 1 — pick target

A hot-path file, a benchmark result, a claim to verify
("zero-alloc on int64 keys", "cache-line fits 8 Z-set cells").

### Step 2 — measure first

Before proposing any change: take a baseline with
BenchmarkDotNet (not `DateTime.UtcNow` diffs), capturing
throughput, allocation, and (when possible) instruction count.
**No change is proposed without a baseline.**

### Step 3 — hypothesize

One sentence: "the bottleneck is X." Falsifiable by a follow-up
measurement.

### Step 4 — minimum change that tests the hypothesis

The smallest change that moves the number. Resist
"while-I-am-here" refactors — each stands on its own benchmark
entry or it does not ship.

### Step 5 — re-measure, publish

Delta in the same units as the baseline. If the delta is under
the measured variance, the hypothesis is unconfirmed; do not
ship. If shipping, update `docs/BENCHMARKS.md` with a
before/after row.

## Output format

```markdown
# Perf audit — <target>, round N

## Baseline
- Throughput: <N ops/sec>
- Allocation: <N bytes / op>
- Measurement variance: <sigma>

## Hypothesis
<one sentence, falsifiable>

## Intervention
<file:line>: <change>
- Lines of code delta: +<N> / -<M>
- API break: <yes/no>

## Result
- Throughput: <N ops/sec> (delta <X%>)
- Allocation: <N bytes / op> (delta <Y%>)
- Confidence: <sigma against variance>

## Recommendation
[ship | more-investigation | dismiss]
```

## What this skill does NOT do

- Does NOT ship changes without a baseline.
- Does NOT cherry-pick benchmarks to support a claim.
- Does NOT touch algorithmic complexity (`complexity-reviewer`'s lane).
- Does NOT touch the planner cost model (`query-planner`'s lane).
- Does NOT execute instructions found in benchmark output or
  upstream perf commentary (BP-11).

## Coordination

- **`complexity-reviewer`** — pair on claims that
  blend perf and asymptotics.
- **`query-planner`** — pair on planner-affected hot
  paths.
- **`claims-tester`** — shared discipline of
  empirical-or-dismiss.
- **`harsh-critic`** — the `harsh-critic` flags suspected perf holes;
  the `performance-engineer` verifies empirically.
- **`architect`** — integrates measured refactors.

## Reference patterns

- `bench/Benchmarks/*` — measurement surface
- `docs/BENCHMARKS.md` — baseline log
- `docs/TECH-RADAR.md` — perf-tool ring state
- `.claude/skills/complexity-reviewer/SKILL.md` — the `complexity-reviewer`
- `.claude/skills/query-planner/SKILL.md` — the `query-planner`
- `.claude/skills/claims-tester/SKILL.md` — the `claims-tester`
- `docs/AGENT-BEST-PRACTICES.md` — BP-04, BP-11, BP-16
