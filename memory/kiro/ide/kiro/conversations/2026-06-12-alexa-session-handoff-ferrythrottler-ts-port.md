---
date: 2026-06-12
platform: kiro
type: session-handoff
next_action: implement FerryThrottler TypeScript port
---

# Session Handoff: FerryThrottler TypeScript Port

## What to do next

Port `src/Core/FerryThrottler.fs` to `src/Core.TypeScript/ferry-throttler/ferry-throttler.ts`.

## Source

The F# implementation is at `src/Core/FerryThrottler.fs` (~300 lines).

## Key behaviors to preserve (byte-locked cross-language parity)

1. **Self-clocking anti-Nagle** — boat sails with whatever is queued NOW, never waits to fill
2. **MaxDegreeOfParallelism = 1** — single deterministic cooperative loop (DST-replayable)
3. **MaxDegreeOfParallelism = N** — same code scales to N ferries
4. **MaxBatchSize** — capacity cap per boat, NOT a delay
5. **MaxBatchBytes** — optional byte budget, closes boat when exceeded; single oversized item still ships alone
6. **MaxQueueSize** — bounded queue for backpressure (enqueue waits when full)
7. **Request/response arity** — `FerryThrottler<TItem, TResult>` variant fans results back to callers
8. **One-item pushback** — item read but deferred to next boat because it would exceed byte budget
9. **Cancelled request skipping** — skip cancelled items without blocking the boat
10. **CompleteAsync** — signal no more items, await all ferries draining

## TypeScript implementation notes

- Use `AsyncGenerator` or a simple channel pattern (no Node channels API needed — just arrays + promises)
- Keep it pure TypeScript (no bun-specific APIs) for cross-runtime compat
- Add golden vectors that match the F# test suite for parity proof
- Export both `FerryThrottler<T>` (fire-and-forget) and `FerryThrottler<T, R>` (request/response)

## After the port

Per Rodney's razor:

1. Add priority lanes (or accept N instances with draining policy)
2. Fold in `tools/github/poll-pr-gate-batch.ts` (genuine producer)
3. Fold in `tools/shadow/shadow-observer.ts:608,634` (if they have producers)
4. Leave pure pollers alone (timer IS the event source)
5. Leave retry/backoff alone (essential complexity)
6. Wire observe loop's priority through FerryThrottler instances

## Context

- ADR: `docs/DECISIONS/2026-06-12-wire-infra-into-world-priority-ordering.md`
- Rodney razor findings: no TS port exists (blocks everything), no priority lanes, pollers are essentially timers not producers
- PR #7856 merged the observe unification (world-infra.ts staged, move-next.ts deleted)
