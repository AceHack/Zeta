---
id: 081KZYQ8Q9V087G0R0013XR3ZX
type: bug
state: backlog
priority: P2
slug: lossyudpchannel-computes-an-aimd-gap-and-never-reads-it-flus
title: "LossyUdpChannel computes an AIMD gap and never reads it: flushBlock has no pacing, so there is no rate control at all"
created: 2026-08-13T23:28:09.531Z
depends_on: []
composes_with: []
---

# LossyUdpChannel computes an AIMD gap and never reads it: flushBlock has no pacing, so there is no rate control at all

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYQ8Q9V087G0R0013XR3ZX-*.md` glob. -->

Found 2026-08-13 by the bandwidth-delay-product link harness
(`src/Core.TypeScript/discovery/udp-bdp-link.ts`), building a link with capacity, a queue and a
propagation delay so that a control loop could be closed around the controller - at which point
it became visible that there is no loop.

## The defect - CHECKED

`LossyUdpChannel.flushBlock` (`src/Core.TypeScript/discovery/udp-lossy-transport.ts` lines
476-499) broadcasts all 8 packets of a block in a tight `for` loop and calls `onSend(this.aimd)`
after each one. **It never reads `gapMs`.** A repo-wide grep for `gapMs` finds 8 sites: 6 inside
`AimdState` / `makeAimdState` / `updateAimd` in the transport, and 2 assertions in
`udp-lossy-transport.test.ts`. **No send path in the repository consults it.**

So the AIMD controller is an **open-loop estimator whose output is discarded.** The transport
has no rate control, no pacing and no self-clocking. `UBL-14` pins the fact so it cannot change
silently.

## Why this is filed as its own defect rather than folded into the estimator bug

081KZYN37T4087G0R00181THA4 correctly reports that the estimator saturates at `MAX_GAP_MS` from
about 1% loss. That defect is currently **latent**: the saturated value is thrown away. Fixing
the estimator, or wiring the pacing up, without also separating corruption loss from congestion
loss (081KZYQ8KNB087G0R000G8QPRE) would **activate** it. The measured cost of activation, on a
link with zero congestion and 2% channel corruption, is **86% of throughput** (`UBL-10`).

Ordering matters and is the reason all three are separate rows: separate the signals first,
then wire the pacing, then retune the estimator.

## What the measurement says the shipped path actually does - CHECKED

Greedy source, 10s, clean channel, over a (C, D, B) grid (`UBL-6`, full table in the research
doc):

| arm                  | C=200     | C=1000    | C=5000    |
| -------------------- | --------- | --------- | --------- |
| shipped (no pacing)  | 0.99-1.00 | 0.99-1.00 | 0.99-1.00 |
| AIMD pacing wired up | 0.16-0.48 | 0.84      | **0.168** |

The shipped path saturates every link tested. It does so by **overflowing the buffer** - the
congestion-drop column runs to half of everything sent - and by filling whatever buffer it is
given: at a 64x-BDP buffer, mean one-way delay rises from 30ms to **1924ms, a 91x inflation, for
0.0% more throughput** (`UBL-9`; Gettys and Nichols 2011, CITED not page-checked). So "it
saturates the channel" is true and is not a defence.

## A second ceiling, which only bites once pacing is wired - CHECKED

`MIN_GAP_MS = 1` is one packet per millisecond, so a paced sender **cannot exceed 1000
packets/second on any link.** On the 5000 pkt/s link that is a hard 16.8% utilisation ceiling no
channel condition can lift. Whoever wires the pacing up has to address this at the same time or
the wiring is a throughput regression on every link above 1000 pkt/s.

## Proposed fix - PROPOSED, not implemented here

Three parts, and the third is not optional:

1. Pace `flushBlock` from `gapMs` through a knobbed timer rather than a tight loop, so the
   signature tells the truth about yielding (`async-all-the-way-truthful-signatures`).
2. Replace `MIN_GAP_MS` with a sub-millisecond or fractional gap, or pace per burst rather than
   per packet, so the ceiling is the link rather than the timer granularity.
3. Land 081KZYQ8KNB087G0R000G8QPRE **first**. Wiring a loss-driven controller to the send path
   on a mesh link before the corruption signal is separated converts a latent defect into a
   measured 86% throughput loss.

## Pointers

- `src/Core.TypeScript/discovery/udp-bdp-link.test.ts` - `UBL-6`, `UBL-9`, `UBL-14`
- `docs/research/2026-08-13-bandwidth-delay-product-link-model-for-udp-lossy-transport-can-we-saturate-a-channel-and-is-the-backoff-tested.md`
- Siblings: 081KZYQ8KNB087G0R000G8QPRE (signal conflation - do this one first),
  081KZYN37T4087G0R00181THA4 (the estimator), 081KZYN3D53087G0R0036XZSYM (spurious NACKs)
