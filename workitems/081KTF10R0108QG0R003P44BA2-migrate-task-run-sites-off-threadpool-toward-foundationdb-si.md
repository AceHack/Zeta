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

FoundationDB is our concurrency north star: a single-threaded deterministic
run loop (Flow actors) tested with deterministic simulation. Under that model
`Task.Run` / threadpool fan-out is a **smell** — it reintroduces real OS-thread
parallelism, the nondeterminism DST (manifesto §7) exists to eliminate. See the
rule `.claude/rules/async-all-the-way-truthful-signatures.md` (FDB-anchored,
Beacon citation: Zhou et al. SIGMOD 2021; Will Wilson, Strange Loop 2014).

## Coordination

Vera is actively reworking async perf in her own clone (incl. the SpineAsync
worker). This note is a **finding for coordination, not a parallel edit** — do
not push code changes to these files while that work is in flight; fold into it.

## Sites found (sweep 2026-06-06)

1. **`src/Core/SpineAsync.fs:33`** — background merge worker is `Task.Run(fun () -> ...)`
   that blocks on `reader.WaitToReadAsync(...).AsTask().Result` (sync-over-async,
   line 42). Parks one threadpool thread for the spine's whole lifetime.
   - Prepared (held, unpushed) patch: rewrite as a `backgroundTask` loop with
     `let! ready = reader.WaitToReadAsync ct` — genuine async, parks no thread.
     Verified locally: Core builds 0/0, Spine tests 30/30. Patch text saved at
     `/tmp/spineasync-async-truthful.patch` (regenerate from this note if lost).
   - Open design question for the FDB direction: should this worker exist as a
     separate task at all, or fold into the single run loop?

2. **`src/Core/Runtime.fs:77`** — `ShardedRuntime.StepAsync` fans shard work out
   via `Array.init shardCount (fun i -> Task.Run(...))` + `Task.WhenAll`. Genuine
   CPU parallelism today; under the single-thread model this is the canonical
   "parallel fan-out" smell. Needs a direction call: keep as an explicitly
   DST-opted-out parallel fast path (allowed-exception per the rule), or serialize
   onto the deterministic loop.

## Not violations (reviewed, leave as-is)

- `src/Core/PluginHarness.fs` ×4 — synchronous law-runner harness; canonical
  ValueTask sync-consume idiom (`IsCompletedSuccessfully` then
  `GetAwaiter().GetResult()`); no async caller to mislead.

## Related landed work

- `IAsyncBackingStore` / `BackedSpineAsync` additive contract (the truthful-async
  disk store Vera deferred) — separate work item; gives a single-thread-friendly
  async I/O path so no `Task.Run`-over-sync-I/O pretense is needed for spill.
