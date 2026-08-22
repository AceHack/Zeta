# Async all the way, truthful signatures — beautiful on 1, scales to N

Carved sentence:

> Concurrency must be **scale-free across thread count** (manifesto §1 applied to
> threads): run *beautifully on one thread* — deterministic, DST-replayable,
> FoundationDB-style — *and* scale to N, **same code path, no special cases**. The
> knob is a degree-of-parallelism on a queue/ferry abstraction (DoP=1 ⇒ a single
> cooperative loop ⇒ deterministic; DoP=N ⇒ N ferries draining the same queue).
> So **raw `Task.Run` / `Task.Factory.StartNew` is a smell** — it is *un-knobbed*
> thread spawn: you can't dial it to 1, it bypasses the queue, and it makes the
> run nondeterministic (DST can't replay it). Route parallel work through a
> throttle with a DoP knob instead. Also: **no `async void`**, **no
> sync-over-async** (`.Result`/`.Wait()`/`GetAwaiter().GetResult()`/`RunSynchronously`),
> **no async-over-sync** (`Task.Run` wrapping sync work to look awaitable). A
> signature must tell the truth about whether it yields.

## Why

The goal is one substrate that is correct and *legible* at DoP=1 — where
FoundationDB's run loop (Flow actors + deterministic simulation) is the reference
standard: single-threaded, no locks, no threadpool starvation, replays the same
interleaving from the same seed (manifesto §2 lock/wait-free, §7 DST) — and still
fast at DoP=N when you want throughput. A **ferry-boat throttle** gives both from
one code path: items go on a bounded queue; `MaxDegreeOfParallelism` ferries pull
and process them with a genuinely-async processor (`await itemProcessor`, not a
blocked thread). Set DoP=1 on the simulation/seed path and you have the
deterministic FDB loop for free; set DoP=N in production. `Task.Run` can do
neither — it spawns straight onto the threadpool with no DoP ceiling, no queue, no
1-thread mode, and no determinism. That is the smell.

## Prescribed pattern (the alternative to `Task.Run`)

A queue + DoP-knobbed ferry. Reference shapes (TPL Dataflow `ActionBlock` with
`MaxDegreeOfParallelism`, or `SemaphoreSlim`-gated async) both degrade cleanly to
DoP=1. Genuine async I/O (`File.*Async`, `WaitToReadAsync` awaited) is the
single-loop-friendly form: the ferry yields while I/O is in flight, spawning no
thread.

## Anchors (Beacon)

- **Ferry-boat throttle prior art (human anchor):** the maintainer's Itron
  `Platform.DotNet` `Threading.Tasks.Throttling` — `IThrottler.TryProcessAsync`,
  `ThrottlerConfiguration.MaxDegreeOfParallelism` / `MaxQueueSize`, impls over
  `ActionBlock` and `SemaphoreSlim`, batch variant. The "1-to-N ferries, degrades
  to 1" design we are emulating.
- **Single-thread determinism:** Zhou et al., *FoundationDB* (SIGMOD 2021); Will
  Wilson, *Testing Distributed Systems w/ Deterministic Simulation* (Strange Loop
  2014); the Flow actor language.

## Pointers

- [`manifesto-13-specifications.md`](manifesto-13-specifications.md) §1 scale-free, §2 lock/wait-free, §7 DST
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md) — #1 scale-free, #2 lock/wait-free, #4 DST
- [`anchor-to-human-prior-art.md`](anchor-to-human-prior-art.md) — why the anchors above are load-bearing
- 081KT07NV0008QG0R001YDB73K — `ConfigureAwait(false)` cross-cutting default
- Worked instance: `src/Core/Runtime.fs` (shard fan-out) + `src/Core/SpineAsync.fs` (worker) are **off** raw `Task.Run` — both on `FerryThrottler` since `1e012b7273`; workitem `081KTF10R0108QG0R003P44BA2`
