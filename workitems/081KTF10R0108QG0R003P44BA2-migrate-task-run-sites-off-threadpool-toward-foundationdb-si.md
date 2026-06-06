---
id: 081KTF10R0108QG0R003P44BA2
type: task
state: backlog
priority: P2
slug: migrate-task-run-sites-off-threadpool-toward-foundationdb-si
title: "Migrate Task.Run sites off threadpool toward FoundationDB single-thread deterministic model"
created: 2026-06-06T17:52:13.825Z
depends_on: []
composes_with: []
---

# Migrate Task.Run sites off threadpool toward FoundationDB single-thread deterministic model

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF10R0108QG0R003P44BA2-*.md` glob. -->

## Why (direction)

Concurrency must be **scale-free across thread count**: beautiful on 1 thread
(deterministic, DST-replayable, FoundationDB-style) AND scale to N — same code
path. The mechanism is a **ferry-boat throttle**: a bounded queue + a
`MaxDegreeOfParallelism` knob; DoP=1 ⇒ single cooperative loop ⇒ deterministic,
DoP=N ⇒ N ferries. Raw `Task.Run` is a **smell** because it is *un-knobbed*
spawn — no DoP ceiling, no queue, no 1-thread mode, nondeterministic (DST §7
can't replay). The migration target is NOT "single-thread only"; it is "route
parallel work through a DoP-knobbed throttle that defaults to 1." See the rule
`.claude/rules/async-all-the-way-truthful-signatures.md`. Prior-art anchor: the
maintainer's Itron `Threading.Tasks.Throttling` (`IThrottler`,
`ThrottlerConfiguration.MaxDegreeOfParallelism`, ActionBlock / SemaphoreSlim
impls); FDB anchor: Zhou et al. SIGMOD 2021; Will Wilson, Strange Loop 2014.

## Coordination

Vera is actively reworking async perf in her own clone (incl. the SpineAsync
worker). This note is a **finding for coordination, not a parallel edit** — do
not push code changes to these files while that work is in flight; fold into it.

## Sites found (sweep 2026-06-06)

1. **`src/Core/SpineAsync.fs:33`** — UPDATE 2026-06-06: the sync-over-async half
   is **RESOLVED by Vera in PR #6693** (merge `436128c7c`) — the `.Result` block is
   gone; the worker is now a genuine `task { let! ready = WaitToReadAsync ... }`.
   Otto's held `/tmp/spineasync-async-truthful.patch` is therefore **obsolete**
   (superseded — do not apply).
   - REMAINING smell: the worker is still launched via `Task.Run(Func<Task>(...))`.
     It is a single long-lived async worker (effectively DoP=1), so the residual
     question is cosmetic-to-architectural: `Task.Run` to kick off one async loop
     is mild, but for the FDB direction either fold it into the run loop or express
     it as a DoP=1 `FerryThrottler` so the single-vs-N knob is uniform.
   - Open design question (FDB): should this worker exist as a separate task at
     all, or fold into the single run loop?

2. **`src/Core/Runtime.fs:77`** — `ShardedRuntime.StepAsync` fans shard work out
   via `Array.init shardCount (fun i -> Task.Run(...))` + `Task.WhenAll`.
   Un-knobbed fan-out: always spawns `shardCount` threadpool tasks, no DoP=1
   mode, nondeterministic interleaving. Target: route shard steps through a
   ferry-boat throttle with `MaxDegreeOfParallelism` (DoP=1 on the sim/seed path
   ⇒ deterministic per-shard order; DoP=N in production). Same code path both.

## Not violations (reviewed, leave as-is)

- `src/Core/PluginHarness.fs` ×4 — synchronous law-runner harness; canonical
  ValueTask sync-consume idiom (`IsCompletedSuccessfully` then
  `GetAwaiter().GetResult()`); no async caller to mislead.

## Related landed work

- `src/Core/FerryThrottler.fs` — LANDED (`3497fa3e4`): the DoP-knobbed ferry-boat
  throttle this migration targets (DoP=1 deterministic ⇒ scale to N). The Runtime
  shard fan-out (site 2) should route through it.
- `IAsyncBackingStore` / `BackedSpineAsync` — LANDED (`e0a68c1e2`, gate-green): the
  truthful-async disk store (the piece Vera handed to Otto); no `Task.Run`-over-
  sync-I/O pretense for spill.
