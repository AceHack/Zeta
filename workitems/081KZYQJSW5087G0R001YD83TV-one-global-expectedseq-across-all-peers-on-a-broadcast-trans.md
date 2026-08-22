---
id: 081KZYQJSW5087G0R001YD83TV
type: bug
state: backlog
priority: P2
slug: one-global-expectedseq-across-all-peers-on-a-broadcast-trans
title: "One global expectedSeq across all peers on a broadcast transport: a single spoofed seq latches it via Math.max, and wide gaps are unattributable, so per-peer sequence state is the fix"
created: 2026-08-13T23:33:39.845Z
depends_on: []
composes_with: []
---

# One global expectedSeq across all peers on a broadcast transport: a single spoofed seq latches it via Math.max, and wide gaps are unattributable, so per-peer sequence state is the fix

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYQJSW5087G0R001YD83TV-*.md` glob. -->

Filed 2026-08-13 by the shadow as the **named residual** of `081KZYP1S96087G0R002G8XQZP`. That item
listed two harms: the 3,333,337x NACK broadcast amplification (**fixed**) and the `expectedSeq`
latch (**not fixed** — this item). Recording it separately rather than leaving it inside a completed
item, so the completion is not a rounded-up claim.

## The defect

`LossyUdpChannel` keeps **one** `expectedSeq` for the whole channel:

```ts
this.expectedSeq = Math.max(this.expectedSeq, header.seq + 1);
```

The transport is a **broadcast** bus — every peer's packets arrive on the same handler — so this
single counter folds several independent sender streams into one sequence line. Two consequences:

1. **It latches.** `Math.max` never decreases, so one spoofed packet claiming `seq = 4294967295`
   pins it at the ceiling and no honest peer's traffic will ever open a gap again. NACK generation
   is silently dead for the life of the channel. (After the NACK-bound fix this is a **loss-signal
   availability** defect, no longer an amplification one: the spoofed packet now takes the desync
   branch and emits nothing.)
2. **A wide gap is not attributable.** With interleaved senders, `header.seq - expectedSeq` does not
   mean "this sender lost that many packets". The NACK-bound fix leans on exactly this: beyond
   `MAX_NACK_GAP` it reports a local `DesyncEvent` instead of a NACK, precisely because the number
   is not a measurement.

## The cost that fix left on the table (stated, not hidden)

A genuine burst losing **more than `MAX_NACK_GAP` (64) consecutive** packets now produces **no
congestion signal at all**. That is a real regression in the heavy-loss case, accepted deliberately
because the alternative — broadcasting a count the receiver cannot substantiate — is the
manufactured-measurement defect class. Per-peer state is what makes the signal recoverable *and*
true.

## Two mitigations considered and REJECTED for the security PR (PROPOSED, both flawed)

- **Bounded advance** — `expectedSeq = Math.min(header.seq + 1, expectedSeq + MAX_NACK_GAP + 1)`.
  Derived from the existing window, one line, and it does convert "one packet kills the loss signal
  forever" into "damage proportional to attacker bandwidth". **Rejected:** a node genuinely joining a
  long-lived stream closes the gap at only ~64 seq per received packet, so an 86M-packet-old stream
  takes ~1.3M packets (~22 min at 1000 pkt/s) to resynchronise, with no loss signal throughout.
- **Corroborate before adopting** an out-of-window seq (RFC 5961-flavoured). **Rejected:** two
  identical replayed packets corroborate each other, so it buys little against a real attacker — and
  it makes apply-twice differ from apply-once, which is backwards against §12 idempotency.

Neither is clearly better than the status quo, which is why this needs its own design and its own
tests rather than a line smuggled into a security patch.

## Proposed direction (PROPOSED — not validated)

`Map<zid, { expectedSeq, lastSeen }>` with per-peer gap computation, bounded in size the same way the
block buffer should be (see `081KZYQJPNG087G0R002B9E9S1`). Note the honest limit: `zid` is
self-asserted on this wire (`envelope.zid` is echo suppression, not identity), so per-peer state
**partitions** the counter, it does not authenticate it. Real attribution needs a signing membrane of
the kind already shipped for the discovery beacon (`beacon-auth.ts`) — see `docs/BUGS.md` P1.

## Site

`src/Core.TypeScript/discovery/udp-lossy-transport.ts` — `LossyUdpChannel.expectedSeq` and its single
`Math.max` update in `handleIncoming`.
