---
id: 081M0Q8TY2E087G0R002ES9VW5
type: bug
state: backlog
priority: P2
slug: zetadb-row-conflict-verdict-depends-on-batch-order-at-tick-b
title: "ZetaDB row-conflict verdict depends on batch order at tick boundaries and is never retried"
created: 2026-08-23T12:16:58.446Z
depends_on: []
composes_with: []
---

# ZetaDB row-conflict verdict depends on batch order at tick boundaries and is never retried

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q8TY2E087G0R002ES9VW5-*.md` glob. -->

## The finding (found by the port-conformance suite, 2026-08-23 — not previously on file)

#13929 made the row-conflict verdict order-independent **within** a tick (`rowPairKey`
defers "a row key names one payload" to a post-condition on the admitted set). Across
tick boundaries it is still order-dependent, because every **persisted** image must be
well-formed — so a prefix of the batch set can be ill-formed even when the union is fine.

Witnessed on `518499177`, `maxEntries: 3`, `maxCheckpointBytes: 328`:

```
batch1 = [e1 row/b "A" +1, e2 row/b "B" -1]
batch2 = [e3 row/b "B" +1]

b1 then b2: REFUSED(database-row-conflict) -> ok(accepted=1)
   final rows = [{"rowKey":"row/b","payload":"B","weight":1}]      revision 1

b2 then b1: ok(accepted=1) -> ok(accepted=2)
   final rows = [{"rowKey":"row/b","payload":"A","weight":1}]      revision 2
```

Same batch set, opposite arrival order, two different durable rows.

## Why it does not self-heal

It **is** recoverable — re-submitting the refused batch after the other one lands
converges (verified: `b1, b2, b1-again` reaches the same state as `b2, b1`). But nothing
performs that re-submission:

`database-row-conflict` carries `severity: "heat"`, and `runConvergentZetaDbNodeTick`
retries **only** `database-revision-conflict`. A "heat" refusal reads as *your input is
bad*, not *try again* — so the two cells simply stay diverged.

Distinct from 081M0Q8TY1B087G0R0008CYZJ3 (binding budgets): this one occurs with budgets
**slack**, and the cause is the well-formedness invariant being enforced per tick rather
than per union.

## Options

1. Reclassify the tick-boundary row conflict as `backpressure` so the existing bounded
   retry covers it. Smallest change; needs care that a genuinely malformed batch is not
   retried forever (the attempt budget is finite, so probably fine).
2. Let a tick admit a prefix that is ill-formed only transiently, deferring the
   well-formedness check to the point of persistence across the whole submitted batch —
   i.e. treat the batch, not the tick, as the unit.
3. Document it as intended and require callers to submit self-consistent batches.

## Where it is pinned

`src/Core.TypeScript/zetadb/zeta-db-node.property.test.ts` — **PREFIX** carries the
deterministic witness and asserts the `heat` severity that blocks the retry. PERM-B
excludes this class by an explicit **input-side** precondition (`singlePayloadPerRow`)
and asserts a hard minimum count of the exclusions, so the excluded class is named and
proved reachable rather than quietly swallowed.
