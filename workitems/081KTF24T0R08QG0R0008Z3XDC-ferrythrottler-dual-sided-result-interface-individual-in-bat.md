---
id: 081KTF24T0R08QG0R0008Z3XDC
type: task
state: backlog
priority: P2
slug: ferrythrottler-dual-sided-result-interface-individual-in-bat
title: "FerryThrottler dual-sided result interface: individual-in, batched-middle, individual-result-out"
created: 2026-06-06T18:11:55.544Z
depends_on: []
composes_with: []
---

# FerryThrottler dual-sided result interface: individual-in, batched-middle, individual-result-out

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF24T0R08QG0R0008Z3XDC-*.md` glob. -->

## Owner: UNASSIGNED — proposed for Vera (NOT yet routed)

Vera is **not aware of the throttler yet**; this is a candidate handoff the
maintainer may route to her, not an accepted assignment. Suggestions below are
Otto's, captured so whoever picks it up has them.

Add the dual-sided ergonomic to FerryThrottler (the Itron IThrottler design):
the producer submits **individual** items and gets back a `Task<TResult>` for
**that** item, while the processor receives **batches** — batching is invisible
to both sides. Current `FerryThrottler<'TItem>` (landed) has only the batch core
(EnqueueAsync = accepted-not-processed; side-effect batch processor). This adds
the result arity on top of that core.

## Shape

`FerryThrottler<'TItem,'TResult>`:

- `ProcessAsync(item, ?ct) : Task<'TResult>` — individual feel; backed by a
  per-item `TaskCompletionSource<'TResult>`.
- batch processor: `ReadOnlyMemory<'TItem> -> CancellationToken -> Task<'TResult[]>`
  returning results aligned by index; throttler fans them back to each item's TCS.

## Otto's suggestions

1. **TCS with `RunContinuationsAsynchronously`** — so a caller's continuation
   never runs inline on the ferry; otherwise consumer code executes on the single
   deterministic loop and starves it (Itron's `AllowSynchronousContinuations`
   knob, defaulted the safe way).
2. **Result-length contract**: if `results.Length <> boat.Length`, fault the whole
   boat with an `InvalidOperationException` (processor contract violation) rather
   than silently dropping/misaligning. On processor exception, `TrySetException`
   on every item in the boat.
3. **Keep both arities** — `FerryThrottler<'TItem>` (fire / side-effect: spill
   writes, shard steps) and `FerryThrottler<'TItem,'TResult>` (request/response).
   Don't force a result channel where there's no result.
4. **Cancellation**: link the per-item ct; an item cancelled while still queued
   should `TrySetCanceled` and be skipped, not shipped.
5. **Reuse the self-clocked + byte-aware drain core** verbatim (carry a parallel
   `TaskCompletionSource[]` buffer alongside the item buffer). DoP=1 fans results
   back in boat order → deterministic.
6. **DoP=1 still beautiful**: at one ferry the per-item completion order is
   deterministic; document that N-ferry completion order is not.

Depends on / composes with the landed `src/Core/FerryThrottler.fs`.
