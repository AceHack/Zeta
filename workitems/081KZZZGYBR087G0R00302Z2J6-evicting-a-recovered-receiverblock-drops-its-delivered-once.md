---
id: 081KZZZGYBR087G0R00302Z2J6
type: bug
state: backlog
priority: P2
slug: evicting-a-recovered-receiverblock-drops-its-delivered-once
title: "Evicting a recovered ReceiverBlock drops its delivered-once guard: a straggler re-creates the block and the same payloads are delivered twice (21 of 400 blocks at reorder depth 64)"
created: 2026-08-14T11:11:41.944Z
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
