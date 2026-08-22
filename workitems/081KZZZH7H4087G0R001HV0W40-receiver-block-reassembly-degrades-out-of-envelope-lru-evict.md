---
id: 081KZZZH7H4087G0R001HV0W40
type: task
state: backlog
priority: P2
slug: receiver-block-reassembly-degrades-out-of-envelope-lru-evict
title: "Receiver block reassembly degrades out of envelope: LRU eviction at RECV_BLOCK_WINDOW delivers 540 of 1600 at reorder depth 128 (unbounded map delivered 1408) and zero on a uniform 9-block cycle"
created: 2026-08-14T11:11:51.332Z
depends_on: []
composes_with: []
---

# Receiver block reassembly degrades out of envelope: LRU eviction at RECV_BLOCK_WINDOW delivers 540 of 1600 at reorder depth 128 (unbounded map delivered 1408) and zero on a uniform 9-block cycle

Filed 2026-08-14 by the shadow as the **named cost** of the fix for `081KZYQJPNG087G0R002B9E9S1`,
which replaced an unbounded `recvBlocks` map with an LRU capped at `RECV_BLOCK_WINDOW` (8 blocks).

This is not a regression report against that fix — the unbounded map it replaced was a remote memory
exhaustion (200,000 packets retained 279,805,952 bytes) and had to go. It is the price, measured, so
that it is a decision on file rather than something rediscovered later.

## Measured (seeded reorder model, 400 blocks / 1600 payloads, 0% channel loss)

Delivered payloads by receiver-side reorder depth, in packet positions:

| depth                      | 0    | 8    | 16   | 32   | 64     | 128      | 256     |
| -------------------------- | ---- | ---- | ---- | ---- | ------ | -------- | ------- |
| unbounded map (the defect) | 1600 | 1600 | 1600 | 1600 | 1600   | **1408** | **724** |
| lowest-key eviction        | 1600 | 1600 | 1600 | 1600 | 1600   | 1284     | 488     |
| **LRU (shipped)**          | 1600 | 1600 | 1600 | 1600 | 1632\* | **540**  | **96**  |
| FIFO on creation age       | 1600 | 1600 | 1600 | 1600 | 1712\* | 284      | 48      |
| fewest-symbols             | 1600 | 1272 | 444  | 104  | 48     | 32       | 32      |

`*` totals above 1600 are duplicate deliveries — `081KZZZGYBR087G0R00302Z2J6`, a separate defect.

### UPDATE 2026-08-14 — the LRU row moved when that separate defect was closed

`081KZZZGYBR087G0R00302Z2J6` is fixed (delivered-block identifiers are now retained past the block
itself), and it moved this table's shipped row as a **side effect**: a straggler for an
already-delivered block is now refused outright instead of re-creating a dead block inside the
recovery window, so the window holds more live blocks. Re-measured on the committed harness
(`udp-lossy-transport.reorder-sweep.ts`, 400 blocks, seed `0x5eed`), reporting distinct payloads:

| depth          | 32   | 64               | 128           | 256    |
| -------------- | ---- | ---------------- | ------------- | ------ |
| LRU, before    | 1600 | 1560 (+112 dup)  | 496 (+12 dup) | 44     |
| **LRU, after** | 1600 | **1600** (0 dup) | **696** (0)   | **48** |

The absolute numbers differ from the table above because that one came from a harness that lived
only in a pull request and this one is re-derived from the committed harness — which is the reason
the harness is committed now. **The cliff is not removed**: past the declared envelope delivery
still degrades sharply, `ULT-36` still pins zero delivery on a uniform 9-block cycle, and per-peer
state is still the real repair. This row is better, not fixed.

And on a **uniform round-robin across `RECV_BLOCK_WINDOW + 1` blocks**, LRU delivers **zero**, with
no channel loss at all: the classical LRU cyclic-access pathology (Belady 1966), pinned as `ULT-36`.

## Why lowest-key was not taken, since the table appears to favour it

It is parkable. Eight packets claiming the top of the u32 `blockSeq` range occupy all eight slots
permanently, because every honest block sorts below them and is evicted the instant it is created —
measured at 20/20 honest payloads -> 0/20, and it never recovers. That is an unauthenticated
permanent shutdown, which is a worse defect than the memory drain being fixed. `ULT-34` refuses it.

## What would actually fix this

The cliff is a consequence of a hard cap on a buffer keyed by a field the receiver cannot attribute
to a sender. The real repair is **per-peer sequence and block state**, which this module already
names as needed for the shared `expectedSeq` ("Losing more than MAX_NACK_GAP consecutive packets
produces NO congestion signal ... per-peer sequence state is the fix"). With per-peer state the
window is per-peer, so one peer's reordering cannot evict another's blocks and an attacker's flood
is confined to its own window.

Widening `RECV_BLOCK_WINDOW` moves the cliff and does not remove it, and it re-opens the memory
bound proportionally — `MAX_NACK_GAP` is derived from the same constant, so it is not a free knob.

## Honest limit on the numbers above

The reorder model is a uniform jitter over packet positions, which is not a validated model of any
real link. It is adequate for RANKING policies under one fixed model — which is what it was used for
— and is not a claim about absolute goodput on a real network. The in-repo chaos harness has a
separate known understatement of burst loss (`081KZYY6SVJ087G0R0035SW945`, meanBurstLength = 1
forbids consecutive losses), and none of the numbers here come from it.
