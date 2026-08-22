---
id: 081KZYP20G2087G0R000W48ZN9
type: bug
state: backlog
priority: P1
slug: aimd-treats-every-loss-as-congestion-but-on-the-mesh-and-lor
title: "AIMD treats every loss as congestion, but on the mesh and LoRa links this transport targets most loss is channel corruption: separate the loss signals rather than tune the thresholds"
created: 2026-08-13T23:07:00.994Z
depends_on: []
composes_with: []
---

# AIMD treats every loss as congestion, but on the mesh and LoRa links this transport targets most loss is channel corruption: separate the loss signals rather than tune the thresholds

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYP20G2087G0R000W48ZN9-*.md` glob. -->

Filed 2026-08-13 by Mateo (security-researcher) from the research sweep over PR #10417.
**Supersedes the framing of `081KZYN3D53087G0R0036XZSYM`** (reorder hold-down) — see below.

## The defect class — a NON-CONGESTION EVENT drives a CONGESTION RESPONSE

`updateAimd` multiplicatively doubles the inter-packet gap whenever the estimated loss rate
exceeds 5%. Multiplicative decrease is the correct response to **one** cause of loss: a full
queue at a bottleneck. It relieves the queue, and it is the mechanism by which AIMD converges to
fairness and efficiency (Chiu & Jain 1989).

On the links this module names in its own header — **802.11 mesh, LoRa, BLE** — the dominant loss
cause is **channel corruption**: fading, interference, collisions, scintillation. Backing off
against that loss relieves nothing, because there is no queue to drain; it just surrenders
throughput on a link that was already delivering what it could. The module's own docstring makes
the wrong claim explicit: *"back off when the channel is saturated"* — saturation is assumed, not
measured.

This is a named, 30-year-old problem, not a novel observation:

- Balakrishnan, Padmanabhan, Seshan & Katz, *A Comparison of Mechanisms for Improving TCP
  Performance over Wireless Links*, IEEE/ACM ToN 5(6), 1997: TCP "is tuned to perform well in
  traditional networks where packet losses occur mostly because of congestion", and responds to
  **all** losses with congestion control, "resulting in degraded end-to-end performance in
  wireless and lossy systems."
- Cardwell, Cheng, Gunn, Hassas Yeganeh & Jacobson, *BBR: Congestion-Based Congestion Control*,
  ACM Queue 2016 / CACM 2017: loss-based control "misinterprets loss as a signal of congestion";
  packet loss is not a good proxy for congestion.
- RFC 4653 (Bhandarkar, Reddy, Allman, Blanton, 2006) names the class outright:
  **Non-Congestion Events**.

## The reordering collapse is the SAME defect, through a different door

`UCH-16` measured 183 spurious NACK broadcasts per 4000 packets at 5% reordering **on a lossless
channel**, and feeding that ~4.6% rate to the controller pins the gap at the 500 ms floor —
a ~500x throughput collapse with **zero packet loss**.

That is not a separate bug from the AIMD design. Reordering is a non-congestion event; the NACK
path converts it into a loss signal; AIMD converts the loss signal into a congestion response.
RFC 4653 §1 makes the identity explicit — a delayed segment and a dropped segment "play out in
precisely the same manner" because the receiver cannot tell them apart. Corruption-loss and
reordering are two instances of one class: **evidence that is not congestion evidence entering
the congestion controller**.

**Consequence for the fix:** a reorder hold-down (`081KZYN3D53087G0R0036XZSYM`) is correct and
worth doing — RFC 4653's own mechanism is exactly a delay-before-declaring-loss — but it is a
patch on one door. It leaves corruption-loss, the *larger* source on these links, still driving
multiplicative decrease. Tuning `HIGH_LOSS_THRESHOLD` cannot fix this either: no threshold
separates 5% corruption loss from 5% congestion loss, because the estimator does not carry the
distinction.

## Proposed direction (research, not a prescribed patch)

Separate the signals rather than tune the threshold:

1. **Do not derive congestion from erasure at all.** The FEC layer already absorbs erasure; that
   is what the parity overhead buys. Loss inside the code's correction capability should not
   reach the controller.
2. **Use a delay/rate signal for congestion.** Queue growth shows up as increasing one-way delay
   or a delivery rate below send rate — BBR's thesis. A rising gap with *flat* delay is
   corruption; a rising gap with *rising* delay is a queue.
3. **Route the residual loss to the FEC rate, not to the send rate.** Corruption loss is the
   correct input to "add more parity"; congestion loss is the correct input to "send slower".
   The transport currently sends both to the second knob and neither to the first.
4. `LossCause` already exists in the type (`"congestion" | "corruption" | "timeout"`) — and is
   currently inferred *from the loss rate itself*, which is circular. The type is right; the
   estimator behind it is not.

**Cost, named honestly:** a delay-based signal needs a timestamp on the wire and is sensitive to
clock behaviour — and `local-time-never-enters-the-shared-fold` applies: a one-way-delay estimate
is a *local* control input and must never filter evidence entering the shared belief fold.
BBR is also materially harder to get right than AIMD and has documented fairness issues against
loss-based flows. AIMD's real virtue is that it is four lines and provably converges; whatever
replaces it should be judged against that, not against an ideal.
