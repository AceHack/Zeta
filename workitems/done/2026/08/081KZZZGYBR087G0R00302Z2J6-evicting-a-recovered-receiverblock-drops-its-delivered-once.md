---
id: 081KZZZGYBR087G0R00302Z2J6
type: bug
state: done
priority: P2
slug: evicting-a-recovered-receiverblock-drops-its-delivered-once
title: "Evicting a recovered ReceiverBlock drops its delivered-once guard: a straggler re-creates the block and the same payloads are delivered twice (21 of 400 blocks at reorder depth 64)"
created: 2026-08-14T11:11:41.944Z
completed: 2026-08-14T11:50:24.696Z
depends_on: []
composes_with: []
---

# Evicting a recovered ReceiverBlock drops its delivered-once guard: a straggler re-creates the block and the same payloads are delivered twice (21 of 400 blocks at reorder depth 64)

Found 2026-08-14 by the shadow while fixing `081KZYQJPNG087G0R002B9E9S1` (the unbounded `recvBlocks`
retention). **Pre-existing, not introduced by that fix** — but that fix makes it reachable at roughly
half the reorder depth, so it is filed with the measurement rather than left implicit.

## The defect — CHECKED, MEASURED

`ReceiverBlock.recovered` is the §12 duplicate guard: `addToBlock` returns `null` for any arrival
into an already-delivered block, so a late packet is "not a second credit". That flag lives **on the
block object**, and eviction deletes the object. A straggler for an evicted-but-already-recovered
block therefore creates a _fresh_ block with `recovered = false`, and if enough of its symbols are
still in flight the [8,4,4] decoder solves it a second time and `onData` fires again for the same
four payloads.

The guard is real and correct while the block is retained. It simply does not survive eviction, and
nothing outside the block remembers that the blockSeq was delivered.

## Measured (seeded reorder model, 400 blocks / 1600 payloads, `reorder-sweep`)

Duplicate-delivering blocks, by receiver-side reorder depth in packet positions:

| reorder depth                       | 32  | 64     | 128 | 256 |
| ----------------------------------- | --- | ------ | --- | --- |
| unbounded map (pre-fix)             | 0   | **0**  | 2   | 1   |
| LRU at RECV_BLOCK_WINDOW (post-fix) | 0   | **21** | 2   | 0   |

At depth 64 with 0% channel loss the post-fix receiver delivered 1632 payloads where 1600 were sent
— 32 of them duplicates. Zero at depth ≤ 32, which is why this is not a defect of the ordinary path.

## Why it matters beyond a duplicate

`onData` is the transport's delivery surface, and a consumer that folds deliveries (a counter, an
append, anything non-idempotent) double-counts. §12 is a manifesto spec, and the module already
claims to satisfy it at this exact seam ("§12: already delivered; a late arrival is not a second
credit") — so the claim is currently true only inside the retention window, and says so nowhere.

## Fix direction (PROPOSED — not validated)

Remember _delivered_ separately from _retained_, so the guard outlives the payload. A recovered
block's expensive part is its eight payload references; the guard is one bit. Candidates: null the
`packets` array on recovery and keep the marker (cheap, but still occupies a window slot), or keep a
small bounded set of recently-delivered `blockSeq` derived from the same `RECV_BLOCK_WINDOW` so no
fresh constant enters. The second must stay bounded — an unbounded delivered-set keyed on a
peer-chosen u32 is exactly the defect this came out of.

## Do NOT fix by widening the window

Retaining longer only moves the depth at which it starts; the guard still dies with the object.

---

## RESOLVED 2026-08-14 — the guard is a separate bounded structure

`LossyUdpChannel` now keeps `DELIVERED_BLOCK_CAP` recently-DELIVERED block identifiers alongside the
`RECV_BLOCK_WINDOW` retained blocks. A straggler whose block is in that set is refused before the
block is re-created, so the §12 guard survives eviction. The second candidate in "Fix direction"
was the one taken; the first (null the payloads, keep the marker) was not, because it still spends a
recovery-window slot on a block no decode can consume.

### The reproduction, before and after

Committed as `src/Core.TypeScript/discovery/udp-lossy-transport.reorder-sweep.ts` — the harness the
original measurement used lived only in a pull request, which is why the numbers in this file could
not be re-derived by anyone reading it. `distinct` is reported apart from `delivered` because the
defect hid inside a goodput total that read as a good number. 400 blocks / 1600 payloads, 0% channel
loss, seed `0x5eed`:

| depth | before (delivered / distinct / dup) | after           |
| ----- | ----------------------------------- | --------------- |
| 32    | 1600 / 1600 / 0                     | 1600 / 1600 / 0 |
| 64    | 1672 / 1560 / **112** (28 blocks)   | 1600 / 1600 / 0 |
| 128   | 508 / 496 / **12** (3 blocks)       | 696 / 696 / 0   |
| 256   | 44 / 44 / 0                         | 48 / 48 / 0     |

These absolute numbers differ from the table above, which came from the uncommitted harness; the
phenomenon and its depth profile are the same, and this one is re-derivable. Across 144 seeded
configurations (8 seeds x 6 depths x loss {0, 5%, 15%}): **0** duplicates.

### Where the retention bound comes from

`DELIVERED_BLOCK_CAP = 2 * RECV_BLOCK_WINDOW` — no fresh constant. The factor of 2 is the precedent
already in the file: `SUSPECT_SEQ_CAP = 2 * MAX_NACK_GAP` keeps a wider window of the cheaper item.
A retained block is 8 payload references; a delivered-block identifier is one integer. And 2 is
**measured, not chosen**: over those 144 configurations, `1 *` leaves 156 duplicate payloads and
`3 *` buys nothing over `2 *`.

### Did an existing structure already answer it — checked, and no

- `reportedMissing` holds what is MISSING, and is emptied by the arrival that precedes a delivery.
- `expectedSeq` can only say a packet is OLDER than the retention window. That zero-new-state
  alternative was implemented and measured: it left the depth-64 column **completely unchanged**
  (112 duplicates), because the stragglers producing those duplicates are still inside
  `MAX_NACK_GAP`. Age is not delivery.

### The key is derived from `seq`, not `blockSeq`

`ULT-42` pins it. A guard keyed on `blockSeq` would inherit the independence weakness of
`081KZZZH24H087G0R002TXQA15` (still open); keyed on `seq >> 3` it lives in the key space
`expectedSeq` / `reportedMissing` / `MAX_NACK_GAP` are already built on.

### What is still true

The guard is a WINDOW, not a promise: a duplicate separated from its original by more than
`DELIVERED_BLOCK_CAP` further deliveries is delivered twice, and `ULT-41` asserts that second
delivery rather than hiding it. No bounded receiver can do better; §12 holds here over the
receiver's declared memory, which is the only span it ever held over.

### Falsifiers

`ULT-38` (the filed reproduction, with the anti-vacuity control that a never-delivered block still
delivers) · `ULT-39` (bounded, property, seeded) · `ULT-40` (LRU, not key order — the parking
negative control, independently of `ULT-34`) · `ULT-41` (move-to-tail on a guard hit is observable)
· `ULT-42` (the key choice) · `ULT-43` (the sweep, in-suite). All seven mutants of the fix — guard
removed, delivery never recorded, no refresh, lowest-key eviction, unbounded, `blockSeq` key,
`1 * RECV_BLOCK_WINDOW` cap — are killed by their intended test. `ULT-36` is unchanged and still
pinned exactly: it delivers nothing, so it never populates the guard.
