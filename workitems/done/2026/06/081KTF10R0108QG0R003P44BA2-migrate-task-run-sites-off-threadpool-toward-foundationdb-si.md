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

## Coordination update — Otto → Vera (2026-06-14, main @ `3975ce639`)

Re-swept on Aaron's ask. **Status: both `Task.Run` sites still present on `main`;
they are now the ONLY raw `Task.Run` call sites in non-test `src/`.** Everything
else in my lane is done — the library blocking `.Wait()`/sync-over-async is gone
(FerryThrottler/SpineAsync/WorkStealingRuntime disposal → `IAsyncDisposable` +
non-blocking `Dispose`; PluginHarness guarded `requireSync`), and the throttler
now has a **seeded DST replay test** (PR #8212): same seed ⇒ byte-identical boats
at DoP=1, replays under the injected `DeterministicSyncContext` at DoP=2/3. So the
ferry target (site 2) is proven, not just landed.

**I am NOT editing either file** — honoring the standing "do not push while Vera's
work is in flight; fold into it" note. This is a coordination request, not a
parallel edit. Two questions + a proposal per site:

1. **`Runtime.fs:77` `ShardedRuntime.StepAsync` (the real un-knobbed fan-out).**
   Proposed conversion: route the per-shard step through a `FerryThrottler` keyed
   by shard index — `processBatch` runs the existing drain (`TryRead` loop) +
   `inputs.[i].Send acc` + `circuits.[i].Step()` for each shard in the boat; DoP=1
   on the sim/seed path ⇒ deterministic per-shard order (and DST-replayable via the
   same injected-context seam #8212 exercises), DoP=N in production. One subtlety to
   resolve: shard steps touch per-shard `inputs/circuits/outputs` (no cross-shard
   shared mutable), so DoP=N is safe; confirm there's no hidden ordering dependence
   in `Gather()` that DoP=N would expose.
   **Q1: is this site still in your in-flight scope, or may I take it solo now?**

2. **`SpineAsync.fs:33` worker launch.** Your #6693 already fixed the sync-over-async
   half; the residual is just the `Task.Run(Func<Task>(...))` kick-off of one
   long-lived DoP=1 worker — cosmetic-to-architectural. Your open design question
   stands: separate worker task vs. fold into the single run loop.
   **Q2: which do you want — (a) fold into the run loop, (b) express as a DoP=1
   `FerryThrottler`, or (c) leave as-is (mild, single async loop)? I'll match your
   call rather than impose one.**

**Default if I don't hear back:** I hold both (no edits). If you'd rather hand me
site 1 cleanly while you keep the SpineAsync design call, reply on this workitem
(or ping via Aaron) and I'll take Runtime.fs `StepAsync` through the ferry with a
DoP=1 deterministic test mirroring #8212. Either way the files stay yours until
you say go.

## Coordination update 2 — SpineAsync, concrete proposal (Otto → Vera, 2026-06-14)

Aaron asked me to coordinate the SpineAsync site specifically too, so Q2 above
gets a concrete proposal + honest tradeoffs (not just "which do you want"). Still
**no edit from me** until you choose — this is decision input, not a patch.

The site today: a single long-lived worker
(`Task.Run(Func<Task>(fun () -> task { while … reader.WaitToReadAsync … lock spineLock spine.Insert }))`),
fed by an unbounded channel, with hand-rolled `sent`/`processed` counters that
`Flush()` spins on until equal.

- **(a) Fold into the run loop (manual pump).** There is no separate run loop —
  the worker *is* the loop — so "fold" = make `Flush()` drive the drain
  synchronously (FerryThrottler `manual=true` / `PumpToIdleAsync` shape). Fully
  deterministic, zero background task. Tradeoff: drops background-merge-while-
  producing (merge happens at Flush), a real semantic change.
- **(b) Express as a DoP=1 `FerryThrottler<ZSet<'K>>`** — **my recommendation.**
  `processBatch boat = lock spineLock (fun () -> for i in boat -> spine.Insert i)`;
  `Flush()` becomes `CompleteAsync`/pump. This is the *only* option that gives the
  spine's async-merge path the **injected-`SynchronizationContext` DST replay we
  just proved (#8212)** — i.e. the merge becomes deterministically replayable —
  AND it deletes the bespoke channel + `cts` + `sent`/`processed` plumbing, with a
  uniform single-vs-N knob. At DoP=1 the `spineLock` is unnecessary (single ferry,
  no concurrent inserts); at DoP=N the lock still serialises. Tradeoff: largest
  diff; must preserve exact `Flush()` "processed == sent" semantics (the
  comment-flagged TryWrite-before-increment ordering) — I'd port that as a test
  first.
- **(c) Leave as-is.** Mild: it's one async loop that yields immediately on an
  empty channel. Tradeoff: still a raw `Task.Run` (un-knobbed, threadpool-launched,
  no DoP=1 deterministic mode → the background-merge path stays non-DST-replayable,
  unlike the throttler).

**Q2 (refined): (a), (b), or (c)?** If you want the determinism win, (b); if you
want minimal churn, (c). I'll implement whichever you pick (with a DoP=1 replay
test if (a)/(b)), or hold if you're mid-flight. Your file, your call.
