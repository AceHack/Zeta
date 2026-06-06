# Async all the way, truthful signatures — and `Task.Run` is a smell

Carved sentence:

> Our concurrency north star is **FoundationDB's model**: a *single-threaded*
> deterministic run loop (Flow actors) where all concurrency is cooperative
> async on one thread, so execution replays deterministically (DST, manifesto
> §7). Under that model **`Task.Run` / `Task.Factory.StartNew` / parallel
> fan-out is a smell** — it spawns real OS-thread parallelism, the exact
> nondeterminism we are moving away from. Also: **no `async void`** (unawaitable,
> swallows failures), **no sync-over-async** (`.Result`/`.Wait()`/`GetAwaiter().GetResult()`/`RunSynchronously`
> → deadlock + threadpool starvation), **no async-over-sync** (`Task.Run`
> wrapping CPU/sync work to *look* awaitable lies about yielding). A signature
> must tell the truth about whether it yields; prefer genuine async I/O on the
> single loop over spawning threads.

## Why (the FoundationDB anchor — Beacon)

FoundationDB runs its entire logical workload on one thread via **Flow**, a C++
actor/`Future` dialect, and tests it with **deterministic simulation** — the same
seed replays the same interleaving, which is why FDB's correctness story is the
reference standard. Single-threaded cooperative async has no locks, no threadpool
starvation, and is deterministic *by construction* — it directly satisfies
manifesto §2 (lock/wait-free) and §7 (DST). `Task.Run` breaks all three: it hands
work to the threadpool, reintroduces real parallelism (nondeterministic
interleaving → DST can't replay), and parks/contends threads. Genuine async I/O
(`File.*Async`, `WaitToReadAsync`, awaited — not `Task.Run`-wrapped) is the
single-thread-friendly shape: the one loop issues I/O and cooperatively yields
until it completes, spawning no thread. On library/hot paths pair real async with
`ConfigureAwait(false)` (B-0969).

**Anchor:** Zhou et al., *FoundationDB: A Distributed Unbundled Transactional Key
Value Store*, SIGMOD 2021 · Will Wilson, *Testing Distributed Systems w/
Deterministic Simulation* (Strange Loop 2014) · the Flow actor language.

## Allowed exception

Genuine CPU-bound parallelism that is *outside* the deterministic core and
explicitly opted out of DST may use the threadpool — but it must be named as such
at the call site (a comment stating it is non-deterministic / not on the sim path),
never silently. When in doubt, keep it on the single loop.

## Pointers

- [`manifesto-11-specifications.md`](manifesto-11-specifications.md) §2 lock/wait-free, §7 DST — the specs this enforces
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md) — disciplines #2 (lock/wait-free) and #4 (DST) at substrate scope
- [`anchor-to-human-prior-art.md`](anchor-to-human-prior-art.md) — why the FoundationDB citation above is load-bearing, not decoration
- B-0969 — `ConfigureAwait(false)` cross-cutting default; `docs/backlog/P1/B-0969-*.md`
- Open coordination note: `Task.Run` smells at `src/Core/Runtime.fs` (shard fan-out) and `src/Core/SpineAsync.fs` (worker) — see `docs/backlog/` async-direction finding
