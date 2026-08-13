---
id: 081KZYN3D53087G0R0036XZSYM
type: bug
state: backlog
priority: P2
slug: lossyudpchannel-nacks-every-reordered-packet-so-reordering-a
title: "LossyUdpChannel NACKs every reordered packet, so reordering alone collapses the sender to the 500ms gap floor with zero packet loss"
created: 2026-08-13T22:50:18.147Z
depends_on: []
composes_with: []
---

# LossyUdpChannel NACKs every reordered packet, so reordering alone collapses the sender to the 500ms gap floor with zero packet loss

Found 2026-08-13 by the seeded chaos harness
(`src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts`), injecting reordering with
**zero packet loss**.

## The defect — CHECKED

`LossyUdpChannel.handleIncoming` treats any `header.seq > this.expectedSeq` as loss and
broadcasts a NACK for every sequence number in the gap. UDP reorders; a reordered packet opens
exactly such a gap, which closes moments later when the delayed packet arrives. The channel has
no reorder tolerance window — no hold-down, no "wait one RTT before declaring a gap".

Measured on a **lossless** channel, 4000 packets, reorder depth 8 (`UCH-16`):

| reorder rate | packets actually lost | NACK broadcasts | data delivered |
|---|---|---|---|
| 0% | 0 | 0 | 2000/2000 |
| 2% | 0 | 80 | 2000/2000 |
| 5% | 0 | 183 | 2000/2000 |
| 20% | 0 | 622 | 2000/2000 |

## Why it matters — CHECKED

Delivery itself is unharmed: block assembly is indexed by `blockPos` and `recvBlocks` is keyed
by `blockSeq`, so reordering cannot mis-assemble a block (pinned separately as `UCH-10`,
lossless to reorder depth 32). **The damage is entirely in the control channel.**

Composed with `081KZYN37T4087G0R00181THA4` (the AIMD estimator, which backs off on any NACK
arriving within 19 sends), a 5% reorder rate produces a ~4.6% spurious NACK rate, which drives
the sender's inter-packet gap to `MAX_GAP_MS` = 500ms — about **2 packets per second**, down
from the 1ms floor. So **reordering alone collapses throughput by roughly 500× on a channel
that is dropping nothing.**

Neither defect is visible from the other's side; it took injecting reordering *and* driving the
controller with the resulting NACK stream to see it. That is the argument for the harness.

## Proposed fix — PROPOSED, not implemented here

Standard reorder tolerance on the gap detector: hold a suspected gap for a short window (or a
small fixed number of subsequent arrivals) and cancel the NACK if the missing sequence arrives.
Note the ECC already covers a single true loss per block without retransmission, so the NACK
path exists only to feed the loss estimate — which makes a *false* NACK purely a cost with no
offsetting benefit.

Ordering note (`local-time-never-enters-the-shared-fold`): the hold-down is a **local** timer
steering a **local** action (whether to emit a NACK), which is exactly what that rule permits.
It must not become a filter on evidence entering any shared fold.

`UCH-16` pins CURRENT behaviour and is expected to FAIL when this is fixed.

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.test.ts` — `UCH-10` (delivery is
  fine), `UCH-16` (the control channel is not)
- `docs/research/2026-08-13-udp-lossy-transport-burst-loss-cliff-gilbert-elliott-chaos-harness-and-why-foundationdb-dst-does-not-reach-this-fault-class.md`
- Sibling defects: `081KZYN37T4087G0R00181THA4` (AIMD estimator — the amplifier),
  `081KZYN3B79087G0R0014ZKE3C` (erasure capability)
