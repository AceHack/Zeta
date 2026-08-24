---
id: 081M0RQFVW7087G0R003T9XP1R
type: bug
state: backlog
priority: P2
slug: flaky-on-macos-26-mixintests-weakmap-gc-test-asserts-nondete
title: "Flaky on macos-26: MixinTests WeakMap GC test asserts nondeterministic collection"
created: 2026-08-24T01:52:18.823Z
depends_on: []
composes_with: []
---

# Flaky on macos-26: MixinTests WeakMap GC test asserts nondeterministic collection

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0RQFVW7087G0R003T9XP1R-*.md` glob. -->

## What happened

`build-and-test (macos-26)` on PR #14606 head `e1aa6e10` (run 32680530072,
job 97296592816): 5518/5525 passed, ONE failed —

> Failed Zeta.Tests.MixinTests.F# WeakMap elements are garbage collected
> when key has no strong references (MixinTests.fs:91) — Assert.True()
> Failure, 3 ms.

The PR's diff touches a gate workflow job, build-graph.json, a workitem
file, and one comment character in a .tsx — nothing that can influence
.NET GC behaviour. The test asserts a `WeakReference` target was
collected after a forced collection, which the runtime does NOT
guarantee: JIT/interpreter root-retention and tiered compilation keep
locals reachable unpredictably, and macos arm64 is where this class
flakes most.

## What this asks for

Make the test deterministic or honest about nondeterminism:

- The standard fix: allocate the key in a separate NON-INLINED method
  (`[<MethodImpl(MethodImplOptions.NoInlining)>]`) so no interpreter
  local pins it, then `GC.Collect(); GC.WaitForPendingFinalizers();
  GC.Collect()` — and retry the assertion in a short bounded loop
  rather than asserting a single collection pass.
- If collection still cannot be forced reliably, the assertion is not a
  falsifier on this runtime — mark the platform skip with the reason,
  rather than letting it tax unrelated PRs (this is the
  ambient-entropy-in-tests class: a verdict depending on GC timing).

## Pointers

- `tests/Tests.FSharp/MixinTests.fs:91` — the assertion.
- PR #14606 — the unrelated PR it failed on (re-kicked; the failure is
  recorded here instead of being lost in a rerun).
