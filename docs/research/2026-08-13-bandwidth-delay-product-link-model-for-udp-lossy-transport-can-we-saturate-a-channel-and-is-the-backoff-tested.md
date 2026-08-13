# Bandwidth-delay-product link model for `udp-lossy-transport`: can we saturate a channel, and is the backoff tested?

**Date:** 2026-08-13
**Author:** Naledi (performance-engineer)
**Status:** measurement report. Every fix in it is **PROPOSED**; no production file is modified.

## The two questions, and why they are different

Aaron, 2026-08-13: _"udp prtocols are very hard to get correct with backoff, speaking of that is
our backoff tested, can we saturate a network channel?"_

Those are two questions and neither was answered by what existed.

`udp-lossy-transport.chaos.ts` (#10417) measures **delivery ratio** and **goodput** against an
injected Gilbert-Elliott loss process. That is a channel-quality measurement and it is the right
instrument for the erasure-code question it was built for. It models **no capacity, no queue and
no propagation delay** - a packet is dropped or it is not, and every survivor arrives instantly.
A model with no queue cannot produce congestion, so it cannot observe a congestion controller at
all. **Verified before building:** searching the chaos harness for capacity, queue, buffer, delay
and RTT returns nothing; the only time-like quantity in it is a reorder DEPTH in packets.

This report adds the missing physics and reports what the controller does inside it.

## The link model

`src/Core.TypeScript/discovery/udp-bdp-link.ts`. A single bottleneck link:

- **C** - capacity in packets/second. Deterministic service, `1000/C` ms per packet (a D/D/1/B
  queue; Kleinrock 1975, CITED not page-checked).
- **B** - drop-tail buffer in packets.
- **D** - one-way propagation delay in ms. Minimum RTT is 2D; the feedback path is one D long.
- **Corruption** - the Gilbert-Elliott process, imported from the chaos harness rather than
  re-declared, applied AFTER queue admission so a corrupt frame still consumes capacity.
- **Jitter** - per-packet extra delivery delay, which is how reordering arises physically.

Loss therefore has **two structurally distinct causes**, counted separately everywhere:
**congestion** (the buffer was full - backing off relieves it) and **corruption** (the frame
died on the wire - backing off relieves nothing). Keeping them separable is the point.

### The model is falsified before it is used

`UBL-1..UBL-5c` check the simulator, not the transport:

- **UBL-3** - offered 200 pkt/s into a 1000 pkt/s link with a deep buffer: mean one-way delay
  equals `D + 1000/C` to **9 decimal places**. That is the closed form, not a fit.
- **UBL-5** - a drop-tail buffer of B packets bounds p95 queueing delay by exactly `B` service
  times, at B = 1, 5 and 50.
- **UBL-12** - the measured additive-increase recovery time matches an independent closed form
  to better than 0.1%.
- **UBL-1** - byte-identical replay from a seed; **UBL-4** - byte-identical at DoP 1, 4 and 8.

## Finding 0, which reframes everything else: the controller is not wired up

**CHECKED.** `LossyUdpChannel.flushBlock` broadcasts all 8 packets of a block in a tight loop and
calls `onSend` after each. **It never reads `gapMs`.** Repo-wide, `gapMs` is written in
`updateAimd` and read by `updateAimd` and two unit-test assertions - by no send path anywhere.

So the AIMD controller is an **open-loop estimator whose output is discarded**, and the shipped
transport has no rate control at all. Everything below is therefore reported in **two arms over
one code path**, differing in a single knob:

- **`open-loop`** - the shipped behaviour. The estimator still runs, and we record the gap it
  computes and throws away.
- **`aimd`** - the same live `AimdState` functions, with `gapMs` actually pacing the sender.

Filed: `081KZYQ8Q9V087G0R0013XR3ZX`. Pinned by `UBL-14`.

## Finding 1 - the utilisation table

Greedy source, clean channel, 10s. `util` is delivered packets / (C x duration).

| arm                 | C=200         | C=1000        | C=5000        |
| ------------------- | ------------- | ------------- | ------------- |
| shipped (open-loop) | **0.99-1.00** | **0.99-1.00** | **0.99-1.00** |
| AIMD paced          | 0.16-0.48     | 0.84          | **0.168**     |

**So: yes, we can saturate a channel - today, and only because the controller is disconnected.**
The shipped path fills every link tested. It does so by overflowing the buffer (the
congestion-drop column runs to half of everything sent) and by filling whatever buffer it is
given, which is Finding 3.

The paced arm has a **hard ceiling of 1000 packets/second on any link**, because `MIN_GAP_MS = 1`
is one packet per millisecond. On the 5000 pkt/s link that is a 16.8% utilisation ceiling that no
channel condition can lift. On links _slower_ than the ceiling it undershoots instead: 16% at
C=200, D=20, B=BDP.

Full 54-row table: `bun src/Core.TypeScript/discovery/udp-bdp-link.demo.ts`.

## Finding 2 - convergence: it does not converge, it saturates

`UBL-7`, C=1000, D=20, B=BDP, 20s, clean channel, the sender saturating the link:

|                                                | verdict        | final gap | distinct values | fraction at MAX_GAP |
| ---------------------------------------------- | -------------- | --------- | --------------- | ------------------- |
| the gap the shipped code computes and discards | **pinned-max** | 500ms     | 2               | **0.995**           |

A two-valued step function, not a control trajectory - and it is pinned at the 500ms floor
(2 packets/second) while the link it is measuring is 99.9% full. This is
`081KZYN37T4087G0R00181THA4` observed through a queue instead of through a synthetic trace, and
the queue makes it worse: with a real propagation delay, NACKs arrive **clustered**, and because
`updateAimd` resets `sentCount` on every NACK, a cluster of k NACKs one send apart computes a
loss rate of k.

### Why Chiu and Jain 1989 does not apply as-is

AIMD provably converges to efficiency and fairness **under its assumptions**. Two of them fail
here:

1. **The control variable must be the shared resource, and increase must be additive in it.**
   Here the variable is a **gap**, and rate = 1/gap. A constant -2ms step in gap adds 0.4% of
   rate at gap 500ms and 25% at gap 10ms. The increase is additive **in the wrong space**.
2. **The feedback must be a congestion signal.** Here it is a NACK, which this transport also
   emits for corruption loss and for reordering - Finding 5.

**The cost of (1), measured (`UBL-12`):** recovering from **one** spurious multiplicative
decrease, on a perfectly clean link, takes **4016 seconds - 66.9 minutes** - and the simulator
agrees with the closed form (sum over k of 64 x (500 - 2k)) to 0.0%. The walk is quadratic in the
gap, so halving the starting gap quarters the recovery: 1057s from 256ms, 68s from 64ms.

## Finding 3 - standing queue (Gettys and Nichols 2011, CITED not page-checked)

`UBL-9`, shipped arm, C=1000, D=20:

| B / BDP | B (pkt) | util  | mean OWD     | p95 OWD  | inflation |
| ------- | ------- | ----- | ------------ | -------- | --------- |
| 0.25    | 10      | 0.998 | 30.0ms       | 30.0ms   | 1.43x     |
| 1       | 40      | 0.998 | 59.8ms       | 60.0ms   | 2.85x     |
| 4       | 160     | 0.998 | 177.5ms      | 180.0ms  | 8.45x     |
| 16      | 640     | 0.998 | 619.1ms      | 660.0ms  | 29.5x     |
| 64      | 2560    | 0.998 | **1923.7ms** | 2580.0ms | **91.6x** |

The textbook signature: a flat throughput column beside a delay column rising two orders of
magnitude. A sender with no rate control fills whatever buffer it is given.

## Finding 4 - fairness, and a correction to my own first reading

`UBL-8`. Two greedy flows, one bottleneck, second flow joins at 5s.

My first run reported **total starvation** - Jain index 0.803, one flow at zero. That number is
an **artifact and I nearly shipped it as a finding.** Deterministic pacing into a drop-tail queue
is exactly the configuration Floyd and Jacobson, "On Traffic Phase Effects in Packet-Switched
Gateways" (Internetworking 1(1), 1992 - CITED, not page-checked) identify as producing
phase-lock, where a flow is shut out by arrival phase rather than by any control law. Adding 2ms
of send-phase jitter dissolves it:

|                                             | Jain index       | utilisation |
| ------------------------------------------- | ---------------- | ----------- |
| shipped, no phase noise                     | 0.803 (artifact) | 0.999       |
| shipped, 2ms phase noise                    | **0.972**        | 0.914       |
| AIMD, 2ms phase noise + 5ms delivery jitter | **0.973**        | **0.150**   |

The harness now carries the phase-noise knob and `UBL-8` runs both, because a fairness number
measured only at zero phase noise is an artifact report.

**And this is the control that makes Finding 5 mean something.** Under loss that IS congestion -
drop-tail overflow, no corruption, no reordering - the controller reaches Jain 0.973 at **79%**
utilisation. **As a congestion controller it does roughly what Chiu and Jain promise.** It
reaches fairness and misses efficiency; it is not simply broken.

## Finding 5 - the decisive experiment

**Hold congestion at exactly zero, raise corruption, plot throughput.** A controller that
responds only to congestion is flat here by definition, because nothing it does changes the
corruption rate.

Zero congestion is structural, not hoped for: capacity is 4x the fastest rate either arm can
produce, the buffer is 4x BDP, and `UBL-10` **asserts that congestion drops are 0 on every row**
before reading a single throughput number.

| corruption | congestion drops | shipped (open-loop) | AIMD paced | ideal |
| ---------- | ---------------- | ------------------- | ---------- | ----- |
| 0%         | 0                | 1.000               | 1.000      | 1.000 |
| 0.5%       | 0                | 0.995               | **0.830**  | 0.995 |
| 1%         | 0                | 0.991               | **0.607**  | 0.990 |
| 2%         | 0                | 0.981               | **0.139**  | 0.980 |
| 5%         | 0                | 0.951               | **0.023**  | 0.950 |
| 10%        | 0                | 0.905               | **0.010**  | 0.900 |

(throughput relative to the same arm on a clean channel.)

The shipped arm is the **negative control** - it is flat, tracking `1 - lossRate` within 1
percentage point, because it cannot respond to the NACK stream at all. The paced arm collapses:
**7.1x less throughput than a corruption-blind sender at 2%, and 90x less at 10%, with no
congestion anywhere in the experiment.** Correlated loss (mean burst 4) moves the knee out but
not the shape: 0.696 at 2%, 0.036 at 10%.

**The framing is confirmed.** Balakrishnan et al. 1997 and BBR 2016 (both CITED, not
page-checked) are describing this transport.

### The reorder bug is the same defect through a different door - CONFIRMED, was PROPOSED

`UBL-11`: zero loss, zero congestion, 5ms of per-packet delivery jitter.

| arm     | jitter | NACKs | spurious seqs | throughput     |
| ------- | ------ | ----- | ------------- | -------------- |
| shipped | 0ms    | 0     | 0             | 998.0 pkt/s    |
| shipped | 5ms    | 2729  | 4018          | 997.7 pkt/s    |
| AIMD    | 0ms    | 0     | 0             | 838.9 pkt/s    |
| AIMD    | 5ms    | 7     | 7             | **70.6 pkt/s** |

Delivery is untouched (over 99% of the clean run) - **the damage is entirely in the control
channel** - and once that channel reaches the sender, throughput falls 11.9x on a link that
dropped nothing. Reordering and corruption are two doors into one defect: **a non-congestion
signal driving a congestion response.** So the fix is "separate the signals", not "tune the
thresholds" and not "add a reorder hold-down" - and that is a larger change than
`081KZYN3D53087G0R0036XZSYM` and `081KZYN37T4087G0R00181THA4` imply on their own.

## Filed - PROPOSED, none implemented

- **`081KZYQ8KNB087G0R000G8QPRE` (P1)** - AIMD backs off on corruption loss it cannot relieve.
  The design-level fix; do this one **first**.
- **`081KZYQ8Q9V087G0R0013XR3ZX` (P2)** - `gapMs` computed and never read; plus the 1000 pkt/s
  `MIN_GAP_MS` ceiling that only bites once pacing is wired.

**Ordering is the substance of the finding.** `081KZYN37T4087G0R00181THA4` is currently
**latent** - the saturated gap is discarded. Fixing the estimator or wiring the pacing without
separating the signals **activates** a defect that costs 86% of throughput at 2% channel
corruption. Separate the signals, then wire the pacing, then retune the estimator.

## Reviewer note - seven tests are expected to FAIL when the defects are fixed

`UBL-6`, `UBL-7`, `UBL-9`, `UBL-10`, `UBL-11`, `UBL-12` and `UBL-14` pin **current measured
behaviour**, not desired behaviour, and each says so in its own comment. Precedent:
`UCH-13..16` in #10417. Real cost: whoever fixes these updates the pins in the same PR.
`UBL-1..UBL-5c` are model falsifiers and must always pass.

## Honest limits

- **One bottleneck, one direction.** No multi-hop, no cross traffic, no ACK-path congestion. The
  NACK channel is assumed reliable and uncongested, which is what the transport module itself
  states; if NACKs are lossy the estimator gets quieter, not more accurate.
- **The receiver rule is reproduced, not driven.** `runLink` drives the **live** AIMD functions,
  but the receiver gap-detection rule is transcribed from `handleIncoming` (lines 576-606) rather
  than executed, because instantiating `LossyUdpChannel` needs a transport, a zid and real
  timers. `UBL-14` pins the source so the transcription cannot silently drift.
- **Drop-tail only.** No RED, no AQM, no ECN. A fair-queue bottleneck would change Finding 4.
- **Fixed packet sizes.** Byte-level fairness and MTU effects are out of scope.
- **The paced arm is a hypothetical.** It measures a controller that is not currently connected.
  That is the point - it is the measurement of what wiring it up would do - but no shipped code
  path behaves like the `aimd` rows today.

## Anchors (Beacon)

All CITED, not page-checked.

- D.-M. Chiu and R. Jain, Computer Networks and ISDN Systems 17(1), 1989 - AIMD convergence.
- V. Jacobson, SIGCOMM 88 - congestion avoidance, self-clocking.
- R. Jain, D.-M. Chiu and W. Hawe, DEC-TR-301, 1984 - the fairness index.
- S. Floyd and V. Jacobson, Internetworking 1(1), 1992 - traffic phase effects.
- H. Balakrishnan, V. Padmanabhan, S. Seshan and R. Katz, SIGCOMM 96 / ToN 5(6) 1997 - TCP over
  wireless; loss is not congestion.
- N. Cardwell, Y. Cheng, C. S. Gunn, S. H. Yeganeh and V. Jacobson, ACM Queue 14(5), 2016 - BBR.
- J. Gettys and K. Nichols, ACM Queue 9(11), 2011 - bufferbloat.
- L. Kleinrock, Queueing Systems Vol. 1, 1975 - the D/D/1/B queue.
- E. N. Gilbert, BSTJ 39(5), 1960; E. O. Elliott, BSTJ 42(5), 1963 - the corruption process,
  reused from #10417.
- Zhou et al., SIGMOD 2021; W. Wilson, Strange Loop 2014 - the DST method this follows.
