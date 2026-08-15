---
id: 081KZZZH24H087G0R002TXQA15
type: bug
state: done
priority: P2
slug: blockseq-and-blockpos-are-redundant-with-seq-but-independent
title: "blockSeq and blockPos are redundant with seq but independently peer-controlled: nothing checks seq = blockSeq*8+blockPos, so one packet can address any block at any position"
created: 2026-08-14T11:11:45.809Z
completed: 2026-08-15T13:42:24.806Z
depends_on: []
composes_with: []
---

# blockSeq and blockPos are redundant with seq but independently peer-controlled: nothing checks seq = blockSeq\*8+blockPos, so one packet can address any block at any position

Found 2026-08-14 by the shadow while fixing `081KZYQJPNG087G0R002B9E9S1`. Filed rather than fixed
there: one defect, one PR, and this one changes what packets the receiver ACCEPTS, which is a
behaviour change of a different class from bounding a buffer.

## The finding — CHECKED against the encoder

`flushBlock` constructs every header as:

```ts
const seq = block.blockSeq * BLOCK_TOTAL + pos;
const header = { seq, blockSeq: block.blockSeq, blockPos: pos, ... };
```

So for **any honest sender**, identically:

    header.blockSeq === Math.floor(header.seq / BLOCK_TOTAL)
    header.blockPos === header.seq % BLOCK_TOTAL

Both fields are therefore fully DERIVABLE from `seq`. They are carried on the wire anyway, in a
16-byte unauthenticated header, and **nothing checks the identity**. `decodePacket` reads all three
independently and `handleIncoming` trusts each for a different purpose: `seq` drives the NACK/desync
path and `expectedSeq`, `blockSeq` keys `recvBlocks`, `blockPos` selects the slot within a block.

## What the independence buys an attacker

- **It is what made the retention defect drivable without tripping anything.** Hold `seq` monotone
  (gap 0 ⇒ no NACK, no desync, no local report at all) while spending a fresh `blockSeq` per packet.
  The receiver sees a perfectly well-behaved sequence stream and allocates a block per packet.
- **One packet can address any block at any position.** A peer may write a chosen payload into slot
  `p` of a block another peer is assembling — the decoder then solves a block containing a foreign
  symbol and delivers wrong bytes. Note that a CRC-32C trailer (081KZYP1X3B / #10541) does NOT close
  this: the packet is not corrupt, it is _correctly formed and lying about where it belongs_.
- The blocks are keyed on `blockSeq` alone with no peer identity, so on a broadcast transport two
  honest peers already collide in this space — the same shape the module already names for the
  shared `expectedSeq`.

## Fix direction (PROPOSED — not validated)

Prefer DERIVING over checking: use `Math.floor(header.seq / BLOCK_TOTAL)` and
`header.seq % BLOCK_TOTAL` at the two use sites and stop reading the wire fields, which removes the
independent dimension rather than validating it. That also makes `blockPos` in-range by
construction, which is what `ULT-24` currently covers by other means. Keeping the fields on the wire
for one release and rejecting disagreement is the compatible alternative, and it is strictly weaker.

**Open question that must be answered first, not assumed:** the chaos and BDP harnesses construct
headers directly, and `ULT-17`/`ULT-24` deliberately generate independent `seq`/`blockSeq`/
`blockPos`. Deriving would change what those tests are exercising, so the sequencing needs care.

## Resolution (2026-08-15)

`handleIncoming` now keys `recvBlocks` and `addToBlock` on
`blockAddressOf(seq)` — `floor(seq/8)` and `seq%8`. Wire fields stay
on the packet (honest senders still write them) but are not an
independent address. ULT-36 is the falsifier: seq 0..7 with lying
`blockSeq`/`blockPos` still deliver block 0. ULT-17 still generates
independent fields and still only exercises the NACK path.

Ordering context: signals (#10516, done) -> integrity (#10541) -> retention
(081KZYQJPNG087G0R002B9E9S1, done) -> estimator (081KZYN37T4087G0R00181THA4) -> pacing. This sits
alongside integrity rather than in that chain.
