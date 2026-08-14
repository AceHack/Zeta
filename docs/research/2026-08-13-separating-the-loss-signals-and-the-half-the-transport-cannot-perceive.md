# Separating the loss signals — and the half the transport cannot perceive

**Work-item** `081KZYQ8KNB087G0R000G8QPRE` (P1), closed 2026-08-13. First of a strict three-item
ordering; the other two are explicitly marked _do not fix before this one_.

## The defect in one sentence

`lossRate : float` could not carry **what kind of loss it was**, so channel corruption and queue
overflow produced the same number and the same multiplicative decrease — measured, with congestion
held at zero _by construction_, at **7.1× throughput lost at 2% corruption and 90× at 10%**.

This is the second instance today of the same shape. The first was the orbital `1.2`, a `float`
that could not carry _why the value held_ (`BoundJustification`, #10461). Aaron named the pattern
in `2026-08-13-lessons-belong-in-the-harness-not-in-rules-the-externalization-ladder.md`:

> **A bare scalar is where distinctions go to die.**

Both fixes are the same rung-1 move — put the distinction in the type — and both were shipped as a
_removal_, not an addition. `lossRate(state): number` and `onNack(state, count)` are gone. A
replacement that leaves the scalar reachable leaves the easy path unchanged.

## What was built

```
LossSignal = { cause: "unknown";    seqs }
           | { cause: "reorder";    seqs }
           | { cause: "corruption"; seqs; evidence: CorruptionEvidence }
           | { cause: "congestion"; seqs; evidence: CongestionEvidence }
```

`AimdState` counts **by cause**. `congestionSuspectRate` is the only quantity that steers the gap.
`retractLoss` withdraws a report the receiver later found to be a reordered packet and
**recomputes** the decision it caused, reversing it only if it no longer holds.

## The finding, which is not the fix

**Corruption and congestion are separable in the model and not at the receiver.** The simulator
knows which drop was which. The receiver sees an absent sequence number either way — and RFC 4653
says exactly this about the reordering case: a delayed segment and a dropped segment _"play out in
precisely the same manner."_

Measured (`udp-bdp-link.ts` experiment 7, `UBL-15`, demo table `UBL-I`):

| scenario               | reported missing | attributed | unknown | attributable |
| ---------------------- | ---------------- | ---------- | ------- | ------------ |
| corruption 10%         | 946              | 0          | 945     | **0.0%**     |
| congestion, 2× offered | 9901             | 0          | 9881    | **0.0%**     |
| jitter 5ms → reorder   | 4018             | 4008       | 0       | **99.8%**    |

So the taxonomy has four cases and this transport can currently construct **two** of them. Rather
than document that, the type enforces it: `CongestionEvidence` and `CorruptionEvidence` are branded
with **unexported** `unique symbol`s, so no module — including this one, absent a deliberate cast —
can mint one. The cases are _unconstructible_, and `ULT-31` fails the moment somebody adds a
minting function, which is the intended trigger, not an accident.

That is the anti-pretend guard. A four-case taxonomy whose empty cases can be filled in by
assertion is worse than a two-case one, because it _looks_ like the distinction was made.

## Consequences, split by door

**The reorder door closed substantially.** Paced throughput under 5ms of delivery jitter on a
channel that drops nothing:

|                        | before     | after           |
| ---------------------- | ---------- | --------------- |
| throughput             | 20.9 pkt/s | **466.2 pkt/s** |
| relative to clean link | 0.021      | **0.467**       |
| collapse factor        | 47.7×      | **2.14×**       |

**The corruption door did not move at all.** `UBL-10` still reports 0.139 at 2% and 0.010 at 10%.
Every one of those erasures is `unknown`, and unattributed loss keeps the classical backoff.

### Why unattributed loss still backs off — the choice, argued

It is tempting to read "do not back off on loss that is not congestion" as "do not back off on
loss you cannot attribute". That is not neutrality; it is **assuming corruption**, which is the
same error as the one being fixed with the sign flipped. The asymmetry decides it: being wrong in
the corruption direction costs throughput; being wrong in the congestion direction costs
_congestion collapse_ (Jacobson, SIGCOMM 88). None of the anchors argue otherwise —
Balakrishnan et al. 1997 propose **explicit loss notification**, BBR builds a **rate model**, RFC
4653 adapts **dupthresh**. Every one of them _adds a signal_; none simply stops responding to loss.

So the conflation that remains is confined to one named function, `congestionSuspectRate`, whose
doc says what it is summing and why. That is the whole difference between a conflation and a
scalar: one is an argued decision at a named place, the other is a fact nobody can find.

## What this promotes

`081KZYP1X3B087G0R001EZ37PQ` (**no integrity check** — erase one packet, flip one parity bit, and
`recoverAdinkraBlock` returns non-null _wrong_ bytes silently) moves from _filed_ to **on the
critical path**. The 7.1× / 90× is not recoverable by any control-law change; it is gated on making
corruption perceivable. That is a dependency the original work-item did not know it had.

And the residual 2.14× reorder collapse is the ordering argument as a number: a retraction takes
one propagation delay to arrive, and the estimator evaluates against a partial window
(`081KZYN37T4087G0R00181THA4`, next), so a decrease can fire before its own retraction lands.

## Costs, named rather than absorbed

- **NACK volume doubles under reordering**, 4.7% → 9.4% (`UCH-16`). The retraction is a second
  broadcast. This module bounds NACK amplification deliberately (the 3,333,337× incident,
  ULT-17..21); the bound is now 2 messages per in-window gap, not 1. It adds no new
  peer-controlled lever — a retraction is only ever emitted for a sequence number this receiver
  itself reported.
- **A peer can claim `reorder` to suppress a sender's backoff.** The data path is unauthenticated;
  it could already fabricate NACKs to _cause_ backoff. Same hole, opposite sign, not closed here.

## Method note — the mutant that took two attempts

Nine mutations of the new logic; all nine killed, but one only after a second attempt. Widening the
condition that decides what enters `suspectSeqs` from _congestion-suspect causes_ to _every cause_
left the entire suite green. The first falsifier written for it did not kill it either — it used a
30-send window, and `updateAimd` clears `suspectSeqs` on the way out, hiding the difference. The
reachable case is a report arriving against an **empty** window, which the estimator returns from
early without resetting — and that is not exotic here, because the window is emptied by every
previous evaluation. Re-running the runner is what established this, not the green suite.

Same lesson as `ULT-16`'s note in the same file: _a test written against a mutant is not a
falsifier until the runner says so._

## Anchors (Beacon)

- **RFC 4653**, Bhandarkar, Sadry, Reddy, Vaidya (2006), _Improving the Robustness of TCP to
  Non-Congestion Events_ — CITED, not page-checked. Names the class and states the
  delayed-vs-dropped identity.
- **Balakrishnan, Padmanabhan, Seshan, Katz**, _A Comparison of Mechanisms for Improving TCP
  Performance over Wireless Links_ (SIGCOMM 96 / IEEE-ACM ToN 5(6) 1997) — CITED, not page-checked.
  Explicit loss notification: the network tells the sender the loss was not congestion.
- **Cardwell, Cheng, Gunn, Yeganeh, Jacobson**, BBR (ACM Queue 14(5), 2016) — CITED, not
  page-checked. Loss is not a congestion signal; build a rate model instead.
- **Jacobson**, _Congestion Avoidance and Control_ (SIGCOMM 88) — CITED, not page-checked. The
  origin of loss-as-congestion-signal, and the reason the conservative direction is conservative.
- **Biaz & Vaidya** (1999) — loss-predictor schemes discriminate poorly. The reason the fix here is
  attribution-by-observation, not a cleverer threshold.

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.ts` — `LossSignal`, `onLoss`, `retractLoss`,
  `congestionSuspectRate`, `lossRates` / `evaluatedLossRates`
- `src/Core.TypeScript/discovery/udp-bdp-link.ts` — experiment 7 (`attributionPoint`)
- `UBL-10` (corruption, unchanged) · `UBL-11` (reorder, flipped) · `UBL-15` (attribution, new) ·
  `UCH-16` (the doubled NACK volume) · `ULT-27..31`
- [`docs/research/2026-08-13-lessons-belong-in-the-harness-not-in-rules-the-externalization-ladder.md`](2026-08-13-lessons-belong-in-the-harness-not-in-rules-the-externalization-ladder.md)
  — addendum 2, where the scalar pattern is named
- `workitems/done/2026/08/081KZYQ8KNB087G0R000G8QPRE-*.md`
