---
id: 081KZYQ8KNB087G0R000G8QPRE
type: bug
state: backlog
priority: P1
slug: aimd-backs-off-on-corruption-loss-it-cannot-relieve-1-channe
title: "AIMD backs off on corruption loss it cannot relieve: 1% channel corruption costs 39% of throughput and 2% costs 86%, with congestion held at zero"
created: 2026-08-13T23:28:05.803Z
depends_on: []
composes_with: []
---

# AIMD backs off on corruption loss it cannot relieve: 1% channel corruption costs 39% of throughput and 2% costs 86%, with congestion held at zero

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYQ8KNB087G0R000G8QPRE-*.md` glob. -->

Found 2026-08-13 by the bandwidth-delay-product link harness
(`src/Core.TypeScript/discovery/udp-bdp-link.ts`). This is the defect the harness was built to
test for, and the experiment is designed so that it cannot be explained any other way.

## The claim

**AIMD conflates erasure loss with congestion loss, and on the target links of this repo that is
backwards.** Multiplicative decrease is the correct response when loss means a full queue.
On an 802.11 mesh or a LoRa link most loss is **channel corruption**, so backing off neither
relieves anything nor is warranted - it only surrenders throughput.

Anchors, CITED not page-checked: Balakrishnan, Padmanabhan, Seshan and Katz, "A Comparison of
Mechanisms for Improving TCP Performance over Wireless Links" (SIGCOMM 96 / IEEE-ACM ToN 5(6)
1997); Cardwell, Cheng, Gunn, Yeganeh and Jacobson, BBR (ACM Queue 14(5) 2016) - whose explicit
thesis is that loss is not a congestion signal.

## The experiment - CHECKED

Hold congestion at **exactly zero** and raise only the corruption rate. Zero congestion is
arranged structurally, not hoped for: capacity 4000 pkt/s is 4x the fastest rate either arm can
produce, the buffer is 4x the bandwidth-delay product, and `UBL-10` **asserts
`congestionDrops === 0` on every row** before reading any throughput number.

Two arms differ in one knob: whether `gapMs` paces the sender. The `open-loop` arm is the
shipped path (081KZYQ8KNB087G0R000G8QPRE - `flushBlock` discards `gapMs`) and serves as the
**negative control**: a sender that cannot respond to the NACK stream at all.

10s, one flow, uniform corruption, clean otherwise:

| corruption | congestion drops | shipped (open-loop) | AIMD paced | ideal (ignore the loss) |
| ---------- | ---------------- | ------------------- | ---------- | ----------------------- |
| 0%         | 0                | 1.000               | 1.000      | 1.000                   |
| 0.5%       | 0                | 0.995               | **0.830**  | 0.995                   |
| 1%         | 0                | 0.991               | **0.607**  | 0.990                   |
| 2%         | 0                | 0.981               | **0.139**  | 0.980                   |
| 5%         | 0                | 0.951               | **0.023**  | 0.950                   |
| 10%        | 0                | 0.905               | **0.010**  | 0.900                   |

(throughput relative to the same arm on a clean channel.)

The negative control tracks the ideal line to within 1 percentage point everywhere. The paced
arm collapses: **at 2% corruption it delivers 7.1x less than a sender that ignored the loss, and
at 10% it delivers 90x less.** Correlated loss (mean burst 4) shifts the knee out but not the
shape: 0.696 at 2%, 0.036 at 10%.

**No congestion occurred in any of these runs.** Every packet the controller withheld was
withheld in response to a signal that carried no capacity information.

## The same defect through the reordering door - CHECKED

`UBL-11`: zero loss, zero congestion, 5ms of per-packet delivery jitter - which is how
reordering arises on a mesh that retries per hop. The receiver NACKs every sequence gap and a
reordered packet **is** a gap. Delivery is unharmed (>99% of the clean run), but the paced arm
loses **more than 85% of its throughput** on a channel that dropped nothing.

That is the argument for reading 081KZYN3D53087G0R0036XZSYM as the same defect wearing a
different hat: a **non-congestion signal driving a congestion response**. Reorder tolerance and
threshold tuning both treat symptoms of one cause.

## And the control that says the controller is not simply broken - CHECKED

`UBL-8`: two flows, loss that IS congestion (drop-tail overflow only, no corruption, no
reordering), 2ms of send-phase jitter. Jain index **0.973** at **79%** utilisation. **As a
congestion controller it does roughly what Chiu and Jain 1989 promise.** It fails specifically
and only when the loss it reacts to is not congestion. That is what makes "separate the signals"
the fix rather than "tune the thresholds".

## Proposed fix - PROPOSED, not implemented here

Separate the signals at the source, and do it **before** wiring the pacing up:

1. **Distinguish the loss classes.** Queue overflow and channel corruption are not the same
   event. Candidates, in ascending cost: explicit congestion feedback from the receiver (a
   standing-queue estimate rather than a gap count); a delay signal (rising one-way delay is
   congestion, a bare erasure is not - this is what BBR and Vegas use); or an explicit loss-cause
   field, which this transport already has a slot for (`NackMessage.cause`) and currently infers
   from the loss rate it is trying to measure.
2. **Do not back off on corruption.** On a mesh link the correct response to a corruption
   erasure is more redundancy or a lower modulation rate, never a lower send rate.
3. Only then revisit 081KZYN37T4087G0R00181THA4 (the estimator window) and
   081KZYQ8KNB087G0R000G8QPRE (the pacing wiring).

Cost, named honestly: this is a larger change than the two work-items it supersedes in scope
imply. It is a design change to the feedback contract, not a threshold edit, and it needs its
own before/after run of `UBL-10`.

## Reviewer note

`UBL-10` and `UBL-11` pin **current measured behaviour** and are **expected to FAIL when this is
fixed** - the failure is the signal the fix landed.

## Pointers

- `src/Core.TypeScript/discovery/udp-bdp-link.test.ts` - `UBL-8`, `UBL-10`, `UBL-11`
- `src/Core.TypeScript/discovery/udp-bdp-link.demo.ts` - the full tables
- `docs/research/2026-08-13-bandwidth-delay-product-link-model-for-udp-lossy-transport-can-we-saturate-a-channel-and-is-the-backoff-tested.md`
- Siblings: 081KZYQ8Q9V087G0R0013XR3ZX (unwired pacing), 081KZYN37T4087G0R00181THA4 (estimator),
  081KZYN3D53087G0R0036XZSYM (spurious NACKs under reordering)
