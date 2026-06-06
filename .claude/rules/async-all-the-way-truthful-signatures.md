# Async all the way — and the signature tells the truth

Carved sentence:

> Async all the way, or sync all the way — never bridge, and never lie about
> which. **No `async void`** (it is fire-and-forget: exceptions escape to the
> top, nothing can await it — use `Task`/`Task<_>` / F# `Async<_>`/`Task`).
> **No sync-over-async** (`.Result`, `.Wait()`, `.GetAwaiter().GetResult()`,
> `Async.RunSynchronously` on a hot/shared-context path → deadlock and
> threadpool starvation). **No async-over-sync** (`Task.Run` wrapping CPU-bound
> sync work to *look* awaitable lies to the caller about yielding). A method's
> signature must tell the truth about whether it actually yields; prefer
> genuinely-async APIs over fake ones.

## Why

`async void` can't be awaited and swallows its failure path — an unobservable
crash. Sync-over-async blocks a threadpool thread on a continuation that needs a
threadpool thread → self-deadlock under load; it also defeats the
lock-free/wait-free discipline (manifesto §2) by reintroducing a blocking wait.
Async-over-sync is the mirror lie: a `Task`-returning signature that never yields
makes callers pay async overhead and reason wrongly about concurrency. Truthful
interfaces — sync stays sync, async genuinely yields — keep the concurrency model
honest end to end. On library/hot paths, pair real async with
`ConfigureAwait(false)` (B-0969) so we don't capture a context we don't own.

## Pointers

- B-0969 — `ConfigureAwait(false)` as a cross-cutting .NET default (the companion
  hot-path rule); `docs/backlog/P1/B-0969-*.md`
- [`manifesto-11-specifications.md`](manifesto-11-specifications.md) §2 Lock/Wait-free
  — sync-over-async reintroduces the blocking wait this spec forbids
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md)
  — discipline #2 (lock-free/wait-free) is the same constraint at substrate scope
