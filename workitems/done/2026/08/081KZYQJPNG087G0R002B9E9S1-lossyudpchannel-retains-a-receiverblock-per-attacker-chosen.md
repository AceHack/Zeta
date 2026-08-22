---
id: 081KZYQJPNG087G0R002B9E9S1
type: bug
state: done
priority: P1
slug: lossyudpchannel-retains-a-receiverblock-per-attacker-chosen
title: "LossyUdpChannel retains a ReceiverBlock per attacker-chosen blockSeq forever: 200k packets (82 MB) retained 279 MB, and eviction only runs on a recovered block"
created: 2026-08-13T23:33:36.560Z
completed: 2026-08-14T11:19:32.087Z
depends_on: []
composes_with: []
---

# LossyUdpChannel retains a ReceiverBlock per attacker-chosen blockSeq forever: 200k packets (82 MB) retained 279 MB, and eviction only runs on a recovered block

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYQJPNG087G0R002B9E9S1-*.md` glob. -->

Found 2026-08-13 by the shadow while fixing `081KZYP1S96087G0R002G8XQZP` (the NACK amplification
P0). **Not the same defect and deliberately not fixed in that PR** — one defect, one PR. This one
is on the *state* side of the same receive path, not the *reply* side.

## The defect — CHECKED, MEASURED

`handleIncoming` creates a `ReceiverBlock` for every `header.blockSeq` it has not seen:

```ts
let block = this.recvBlocks.get(header.blockSeq);
if (!block) {
  block = makeReceiverBlock(header.blockSeq);
  this.recvBlocks.set(header.blockSeq, block);
}
```

`blockSeq` is `readUInt32BE` of an unauthenticated packet — 4,294,967,296 distinct keys. Eviction
exists, but it is **inside `if (recovered)`**:

```ts
const recovered = addToBlock(block, header.blockPos, new Uint8Array(payload));
if (recovered) {
  ...
  for (const k of keys.slice(0, Math.max(0, keys.length - RECV_BLOCK_WINDOW))) this.recvBlocks.delete(k);
}
```

So a stream of packets that **never completes a block** — e.g. every packet carrying `blockPos: 0`
and a fresh `blockSeq` — never reaches the eviction path, and the Map grows without bound. This is
the ordinary case under heavy loss too, not only under attack: unrecoverable blocks are exactly the
blocks that never trigger their own cleanup.

## Measured (Bun 1.3.14, 256-byte payloads, `Bun.gc(true)` before and after)

| | |
|---|---|
| packets delivered | **200,000** |
| inbound bytes | **82,000,000** |
| `recvBlocks.size` after | **200,000** (zero evicted) |
| RSS growth | **279,134,208 bytes** |
| memory retained per inbound byte | **3.40x** |
| memory retained per packet | **1,396 bytes** |

## Why P1 and not P0

The cost to the attacker is **linear in their own bandwidth** — 3.4x, not the 3,333,337x
single-packet amplification of `081KZYP1S96087G0R002G8XQZP`. There is no broadcast, so it does not
reach the mesh. It is still an unauthenticated remote memory exhaustion with no ceiling, and the
retention is **permanent** for the life of the channel.

## Proposed fix (PROPOSED — not yet validated)

Evict unconditionally on every packet, not only on a recovered block, and cap `recvBlocks.size` at
`RECV_BLOCK_WINDOW` (the constant already introduced by the NACK fix). Retaining more than the
recovery window is already pointless: the [8,4,4] code cannot act on an older block.

Sequencing note: the cap and the NACK bound then both flow from `RECV_BLOCK_WINDOW`, which is the
right shape — one statement of how much the receiver remembers.

## Adjacent, verified, NOT a live defect (recorded so it is not re-derived)

`blockPos` is a `u8` never range-checked. **CHECKED** by measurement: `addToBlock(block, 200, ...)`
returns `null`, `block.packets.length` stays `8`, `receivedCount` stays `0`. The packet is silently
classified as a *duplicate* — correct outcome, wrong reason, no out-of-bounds write. Confirms the
reading already recorded in §5.2 of the calibration-audit research doc. A range check belongs with
this fix; it is not urgent on its own.
