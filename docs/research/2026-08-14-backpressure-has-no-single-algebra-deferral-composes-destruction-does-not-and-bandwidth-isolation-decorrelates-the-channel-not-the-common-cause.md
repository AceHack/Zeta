# Backpressure has no single algebra — deferral composes, destruction does not; and bandwidth isolation decorrelates the channel, not the common cause

**Date:** 2026-08-14
**Author:** Otto (shadow\*)
**Status:** design study + one measurement. Code: `src/Core.TypeScript/discovery/bandwidth-isolation-decorrelation.ts` (+ `.proof.test.ts`, BID-1..BID-12).
**Register:** register-2 facts (deterministic simulation runs) and a labelled register-3 reading.

---

## 0. The ask, and the answer in four lines

Aaron, 2026-08-14:

> "there are many bulk head, jitter, exponential backoff, circuit breaker, many many techniques for
> 'backpressure' — our back pressure should be more **algebraic and not so ad hoc**. we have some
> work on this already over tiny bandwidth channels so **bandwidth isolation leads to true
> decorrelation over time**."

1. **The four techniques do not share an algebra.** They are statements about four different
   objects — a resource, a rate, a joint distribution, and a belief — and only three of them
   compose at all.
2. **One composition law does hold, and it is already half-built in this repo:** operators that
   only ever _defer_ form a monoid whose deferred sets join as a semilattice; operators that
   _destroy_ form nothing. This is Kahn's determinacy result (1974) and Brock–Ackerman's
   non-compositionality result (1981), not a new coinage.
3. **Bandwidth isolation does decorrelate, and here is the number.** On a shared bottleneck at 74%
   utilisation, two flows that are independent by construction correlate at **r = −0.240**, sign-
   consistent across **24/24 seeds**; bulkheaded at conserved total capacity the same flows read
   **r = +0.021** with the sign a coin flip (11/24). The effect decays monotonically to the null as
   contention is removed, which is the falsifier passing.
4. **And the claim has a hard limit, also measured.** Two flows on _separate_ links, running the
   same control law into the same boundary, correlate at **r = +0.71** — **higher** than the shared
   arm's +0.26. Isolation removes the _channel_. It does not remove the _shared design_, and a
   shared design at a shared boundary is a Reichenbach common cause. **Correlation between two
   agents does not imply a channel between them.**

---

## 1. Why "ad hoc" is the right diagnosis — the taxonomy (the honest non-unification)

The four techniques are not four members of one family. They are four different kinds of
statement, and calling them all "backpressure" is what makes them feel ad hoc:

| technique           | what object it constrains  | its actual structure                                                                                                | does it compose?                                                                   |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Bulkhead**        | the **resource**           | a partition: `C = C₁ ⊕ … ⊕ Cₙ`, `Σ Cᵢ ≤ C`. Commutative monoid of shares; a partition of a partition is a partition | **yes**, associatively, and nesting is a tree                                      |
| **Backoff / AIMD**  | the **rate variable**      | a monoid of monotone clamped maps on a totally ordered set (`g ↦ 2g`, `g ↦ g−δ`, `clamp∘clamp = clamp`)             | **yes, weakly** — the composite is monotone; nothing follows about its fixed point |
| **Jitter**          | the **joint distribution** | a symmetry-breaking perturbation that makes two senders' phases product-form (Floyd–Jacobson 1992)                  | **not a control law at all** — it composes trivially because it decides nothing    |
| **Circuit breaker** | a **belief**               | a 3-state automaton (closed/open/half-open) over an error estimator, with a timer                                   | **no** — see below                                                                 |

**The circuit breaker is the one with no composition law, and its failure is an instrument
failure.** Two breakers in series have a 9-state joint space with no stated dynamics, and worse:
when the outer breaker opens, the inner breaker stops seeing traffic, so **its error rate falls to
zero and it reads healthy**. The outer breaker's protective action blinds the inner breaker's only
sensor. That is precisely the blind-instrument class this repo has now found eleven of — a
service-status adapter reading `installed-stopped` for a job with 1,508 successful runs, a Landauer
meter charging `batchSize` for an operation that erases nothing. Filed:
`081M00TNWN8087G0R002CQX6VJ`.

**The one genuine unification inside the taxonomy** is not the one that was asked for, and it is
worth naming: **jitter and bulkheading are the same operation applied to different coordinates.**
Jitter destroys a shared _phase_; a bulkhead destroys a shared _capacity_. Both are decorrelation
operators, neither is a feedback law, and both work by making a joint distribution product-form.
That is why §4's measurement finds them doing the same job.

---

## 2. The composition law that DOES hold

Model a backpressure operator as a function on an offered multiset:

```
m : Q → Q × Q          m(offered) = (admitted, deferred)
```

Call `m` **conservative** when `admitted ⊎ deferred = offered` — nothing is destroyed, the
unboarded tail is handed back to the caller.

- **Conservative operators compose.** `m₂ ∘ m₁` is conservative; composition is associative;
  the identity (admit everything) is a unit. **A monoid.** The deferred sets join by union, which
  is idempotent and order-independent — **a join-semilattice**, the same structure as a G-set
  merge (§12 idempotency, §7 DST: replay-safe under redelivery and reorder).
- **Lossy operators compose into nothing.** A destroyed item is invisible to every downstream
  operator, so the composite's output depends on the order in which the operators were applied,
  and there is no input–output relation that is compositional.

This is not a coinage. It is a rediscovery of a 1970s result, and the anchor is exact:

> **Kahn (1974)**: a network of monotone functions over streams, connected by unbounded FIFOs with
> blocking reads, has a unique least fixed point **independent of scheduling**. Blocking-write on a
> _bounded_ FIFO — which is exactly conservative backpressure — preserves this (Kahn–MacQueen 1977).
>
> **Brock–Ackerman (1981)**: for _nondeterminate_ dataflow the input–output relation is **not** a
> compositional semantics. Their anomaly is two networks with identical input–output relations that
> behave differently in the same context.

So: **conservative backpressure is a Kahn process network and is therefore determinate and
composable; lossy backpressure is not, and its non-compositionality is a theorem, not a gap in our
engineering.** This is also why DST works at all on the throttle path — determinacy under
scheduling is the same property replayability needs.

### 2a. This repo already has the law, from a different direction

`HeatSignal.isPressure` splits `{Backpressure, Denied}` from `{Forgotten, StorageError, Invalid,
Expired, Stale}`. PR **#10640** (merged today, `SchedulerShedHeat.fs`) states the test outright:

> "a shed is classified by what survives it, not by how it feels: derived / handed back ⇒ PRESSURE
> (free); annihilated, nothing retains a seed ⇒ LOSS (it pays)."

That was derived from reversibility and the Landauer toll — _negate_ costs 0 bits, _consolidate_
costs 3.459. It arrives at the same partition as the Kahn argument arrives at from determinacy. Two
independent derivations of one boundary is the strongest evidence available that the boundary is
real, and it is why the answer to "is `isPressure` the right base type?" is **yes, the distinction
is right** — with two defects in how it is _carried_ (§2b).

`SoftThrottle` satisfies the law: `boat` returns `(boat, remaining, state)`, `step` returns a sip
and leaves the rest, `wrapHandler` soft-skips without touching inner state. Every shed path hands
the tail back. **CHECKED** by reading `src/Core/SoftThrottle.fs` end to end.

### 2b. Two defects in how the bit is carried — one CHECKED, one structural

**(i) Two live classifiers of the same bit disagree.** `HeatSignature.isPressureKind` (live at
`DarkHallRoomLoop.fs:165`, `DarkHallScheduler.fs:246,291`) tests only for pressure tokens.
`HeatSignal.ofKind` (live at `SchedulerShedHeat.fs:72,74`) tests **forgetting first**, so a kind
containing both tokens classifies as loss there and as pressure in the other. Transcribed and
executed:

```
soft-emu.prune-backpressure     isPressureKind=true   HeatSignal.isPressure=false   DISAGREE
cache.forget-denied             isPressureKind=true   HeatSignal.isPressure=false   DISAGREE
meta-cart.policy-backpressure   isPressureKind=true   HeatSignal.isPressure=true    agree
soft-emu.prune                  isPressureKind=false  HeatSignal.isPressure=false   agree
```

**CHECKED:** the two predicates disagree on mixed strings. **NOT CHECKED:** whether any kind string
emitted today contains both tokens — so this is a **latent** divergence, not a live outage, and it
is filed as one: `081M00TNWK7087G0R000WX9XZE`.

**(ii) The bit the composition law depends on is inferred from a substring of a free-form string.**
Whether an operator defers or destroys is the single fact that decides whether it composes. Today
it is recovered by `kind.Contains("backpressure")` at runtime. It should be a field on the
signature, set by the emitter that knows. `081M00TNWM8087G0R0027ACGKY`.

---

## 3. Which control inputs are DERIVED and which are merely CORRELATED

The razor, stated once: **an input is derived when a conservation law connects it to the quantity
you are steering on. Otherwise it is correlated, and it will vary plausibly while measuring
something else.**

**DERIVED** — each has its identity written next to it:

| input                               | the conservation law that makes it derived                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| queue occupancy                     | `arrivals = departures + occupancy + drops`                                                                                                                       |
| deferred-set size (conservative op) | `offered = admitted ⊎ deferred`                                                                                                                                   |
| `SoftThrottle` tank charge          | `heatSpent = Capacity − Charge`                                                                                                                                   |
| bulkhead share                      | `Σ shares ≤ C`, a configured partition                                                                                                                            |
| standing-queue estimate from delay  | **Little's law**, `L = λW`: a standing queue of `(RTT − RTT_min)·rate` packets. This is why a _delay_ signal (Vegas, BBR) is derived where a _loss_ signal is not |

**CORRELATED** — each with the confound that kills it:

| input                   | what else produces the same number                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| **loss / NACK rate**    | corruption, reorder, receiver silence. 5% corruption and 5% congestion give an _identical_ quotient             |
| latency percentile      | route change, scheduler preemption, GC pause, propagation change                                                |
| error rate at a breaker | client bug, bad input, auth expiry — **and an upstream breaker already open**, which drives it to zero          |
| throughput              | "we are saturated" vs "there is no demand"; under saturation it is pinned by capacity and measures the capacity |
| threadpool queue length | work vs blocking                                                                                                |

The transport already acted on this and the record is worth reading: `udp-lossy-transport.ts`
**removed** `nackCount` and `lossRate` rather than annotating them, because "a magnitude that cannot
say why it is believed does not get to exist" — after measuring **7.1x** and **90x** throughput
losses at 2% and 10% corruption with congestion held at zero by construction.

**The sharpest fact in this section is a negative one, and it is CHECKED:** `CongestionEvidence` in
`udp-lossy-transport.ts` is **not constructible** — its brand symbol is unexported and nothing can
mint one. So **the transport has no derived congestion input at all today.** Every congestion
decision it can make is made on `unknown`, a correlated residue. That is stated in the source as a
finding rather than hidden, and it is the correct place to spend next.

**And my own headline number is a correlated input, not a derived one.** The correlation between
two flows' throughput has no conservation law behind it — which is exactly why §5 finds it reading
±1 in two regimes where it measures an accounting identity. Filed as the general practice:
`081M00TNR8S087G0R00245QH02` — _name the conservation law or mark the input correlated._

### 3a. Generous tit-for-tat, and what it is really buying

The established anchor — generous TFT (Nowak & Sigmund 1992) ≡ AIMD with a corruption channel —
lands exactly here. Strict TFT and strict AIMD both punish on an input they cannot attribute, so
both punish the environment. Generous TFT's forgiveness probability `q` is a **hedge against an
unattributable input**: it buys error recovery at the price of exploitability, and `q` is tuned.

`retractLoss` in this repo is generous TFT **with the generosity replaced by evidence**. It does not
forgive with a probability; it _recomputes the decrease without the retracted sequence numbers and
reverses it only if it would not have fired_ — a Z-set correction (+1 then −1), with `gapMs ===
rec.gapAfter` guarding against writing a stale value. So:

> **Generosity is the price of a correlated input. Attribution is what lets you stop paying it.**

That is the seam, and it is the same razor as §3 seen from game theory: TFT's tuned `q` and AIMD's
tuned threshold are both the cost of not having a conservation law.

---

## 4. The measurement: does bandwidth isolation decorrelate?

**Harness.** `udp-bdp-link.ts` — a D/D/1/B bottleneck (capacity `C`, drop-tail buffer `B`,
one-way delay `D`), driven by the shipped open-loop sender. New module:
`bandwidth-isolation-decorrelation.ts`.

**Three arms, differing in exactly one structural fact:**

- `shared` — one link of capacity C, both flows on it.
- `isolated-split` — **two** links of capacity C/2, one flow each. **Capacity conserved** — this is
  the bulkhead at its real price, pinned by BID-10 (total throughput matches the shared arm to
  within 1 pkt/s).
- `isolated-full` — two links of capacity C. The control that separates _isolation_ from _more
  headroom_.

**Why the comparison is controlled.** `udp-bdp-link` indexes its per-flow entropy by
`flow * 1000003 + seq`, so flow 1 draws **the same numbers** whether it shares a link or is alone on
one. An isolated arm is not a different experiment; it is the same experiment with the coupling
removed. Isolated arms are produced by pushing one flow's start past the horizon, which changes no
other flow's draw indices.

**The null.** Not the textbook one. `1/√(n−1)` assumes i.i.d. samples, and a queue occupancy series
is autocorrelated — the exact defect the `DecorrelationExcess` arc had to fix with a block
permutation null (Künsch 1989) after a plain permutation null convicted 42 of 160 strata. **The
`isolated-split` arm IS the null**: same seeds, same entropy, same autocorrelation structure,
coupling removed.

### The result — a dose-response, not a single number

Offered load held **fixed** at 300 pkt/s per flow; capacity **raised**. 24 seeds, 20 s runs,
Pearson r on the per-100 ms delivered-throughput trajectories, first 10 buckets dropped.

| capacity | utilisation | **shared** mean r |    sd |        sign | **isolated-split** mean r |    sd |  sign |
| -------: | ----------: | ----------------: | ----: | ----------: | ------------------------: | ----: | ----: |
|      700 |        0.74 |        **−0.240** | 0.074 | **24/24 −** |                    +0.021 | 0.073 | 11/24 |
|      800 |        0.65 |            −0.196 | 0.071 | **24/24 −** |                    +0.005 | 0.086 | 12/24 |
|     1000 |        0.52 |            −0.142 | 0.088 |     23/24 − |                    +0.002 | 0.058 |  9/24 |
|     1400 |        0.37 |            −0.064 | 0.075 |     19/24 − |                    −0.027 | 0.084 | 17/24 |
|     2000 |        0.26 |            −0.031 | 0.057 |     17/24 − |                    −0.003 | 0.071 | 13/24 |
|     3000 |        0.17 |            −0.008 | 0.062 |     14/24 − |                    +0.002 | 0.066 | 13/24 |
|     5000 |        0.10 |            −0.007 | 0.061 |     12/24 − |                    +0.013 | 0.057 | 11/24 |
|    20000 |        0.03 |            +0.004 | 0.063 |     11/24 − |                    −0.001 | 0.068 | 12/24 |

**Read it as follows.**

- At 74% utilisation with **zero congestion drops**, two flows that share nothing but a queue
  correlate at −0.24, **negatively and in the same direction on all 24 seeds**. The mechanism is
  plain: one flow's packet in service is the other flow's wait, so a bucket in which flow 0 gets
  more service is a bucket in which flow 1 gets less. The significance claim is a **sign test** —
  Binomial(24, ½), p = 2⁻²⁴ ≈ 6×10⁻⁸ — chosen because it assumes nothing about the series being
  i.i.d., which a t-statistic here would.
- Bulkheading at **conserved** capacity returns the sign to a coin flip and the magnitude to the
  null, and the isolated column is **flat across the entire sweep** — it never had a queue to share.
- **The falsifier passes (BID-11).** The shared-arm coupling decays _monotonically_ to the null as
  capacity rises at fixed load, with no threshold moved. Had it not decayed, the shared number would
  have been an artifact of running both flows in one simulation and this whole study would be void.

**So: yes, measured. Bandwidth isolation decorrelates — and so does over-provisioning.** What
decorrelates is the _absence of contention_; isolation is the way to get it that does not depend on
your neighbour's restraint. That is the honest refinement of the claim: **a bulkhead bounds your
correlation with a neighbour by your own load, independently of theirs.** It is a decorrelation
mechanism, and it is more than a resilience pattern — but it buys independence _from behaviour_, not
independence _as such_, which §6 is about.

---

## 5. Three ways this instrument lies — all three observed, two guarded

Per the discipline: if you propose a metric, say how it fails. All three were observed on this
link, and each produces a large, stable, _plausible_ r while measuring nothing about coupling — the
"correlated coincidence" shape.

**F1 — the CONSERVATION IDENTITY (shared, saturated).** At 900 pkt/s/flow on a 1000 pkt/s link,
every 100 ms bucket summed to **exactly 100** — `d₁ = TOTAL − d₀` as arithmetic — and r read
**−0.9996**. That is a restatement of "the link has a capacity", and it points in the direction that
would _flatter_ the claim under test. Guarded by `saturation`, reported on every point. Pinned:
BID-5.

**F2 — ONE-SAMPLE LEVERAGE (isolated, saturated).** Two saturated isolated sub-links deliver an
identical constant trajectory, which should make r _undefined_. It did not, because the final bucket
is partial. Direct inspection of the 190-bucket series: **exactly two distinct values, 50 (×189) and
51 (×1)** — and **r = +1.000**. Maximal correlation reported for two systems that are independent by
construction, off **one bucket in 190**. Guarded by `covarianceLeverage` (the share of |covariance|
from its single largest term), which reads 0.995 here and refuses the reading. Pinned: BID-6, BID-7
(all 8 seeds refused, `meanR = null` — _refusing to answer is the answer_).

Note the shape of F1 and F2 together: **at saturation the instrument reads −1 for sharing and +1 for
isolation, and would have reported that isolation makes flows maximally correlated** — a complete
inversion of the truth, from two accounting identities.

**F3 — the SHARED ATTRACTOR.** See §6. It has no guard and cannot have one, because it is not an
artifact.

Also stated in the module: Pearson sees only _linear_ coupling (a buffer is a threshold, and
threshold coupling can sit at r ≈ 0 — mutual information is the finer lens, the same upgrade
`DecorrelationExcess` needed after Jaccard); the lag search inflates |r| and is therefore only read
against the same search on the null arm; and this is one queue discipline (drop-tail FIFO), not a
statement about fair queueing or AQM.

---

## 6. The limit on the claim, measured: isolation removes the channel, not the common cause

The most important number in this study is the one that **contradicts the unqualified claim.**

Same harness, `aimd` pacing — the controller as designed-but-unwired, which collapses toward
`MAX_GAP_MS` because it backs off on `unknown` loss (the known defect, `UBL-12`; recovery from
`MAX_GAP` measured at 67 minutes). 16 seeds, correlation of the two flows' **controller-gap**
trajectories:

| arm              | gap-trajectory mean r | delivered mean r | readings usable |
| ---------------- | --------------------: | ---------------: | --------------: |
| `shared`         |            **+0.258** |           +0.007 |           16/16 |
| `isolated-split` |            **+0.710** |           +0.359 |           16/16 |

**Two flows, each alone on its own private link, with no channel between them whatsoever, are
nearly three times more correlated than two flows sharing a bottleneck.** Every reading passes both
guards — no guard is doing the work here, this is not F1 or F2.

The mechanism is not mysterious and it is not a defect of the measurement: both controllers run the
**same law**, are driven to the **same boundary**, and therefore trace the **same trajectory**.
Reichenbach (1956): a correlation has a common cause _or_ a channel. Bandwidth isolation removes the
channel. It leaves the shared design, and **a shared design at a shared boundary is a common
cause.**

**This is the standing limit on the fleet-level reading of the claim.** For named agents:
isolating an agent's bandwidth removes _medium_ coupling — one agent's burst no longer delays
another's. It does **not** remove _design_ coupling: agents running the same policy, hitting the
same rate limit, reading the same clock, or collapsing on the same failure will correlate exactly
as much as before, and possibly more, because the medium's jitter was the only thing breaking their
symmetry. This is the same structure the decorrelation capstone found in real repo history —
`docs/github`, `docs/claims`, `workitems/done`: benign shared _buses_ as the surviving common cause
— and it is why `N correlated ≠ 1 decorrelated` holds however the bandwidth is partitioned.

It also predicts a concrete inversion worth remembering: **the more perfectly you isolate identical
agents, the more perfectly correlated their failures become**, because contention was doing the
decorrelating for you. Jitter, in §1's reading, is the mechanism that addresses _this_ coupling and
bulkheading is not — which is why they are siblings and not substitutes.

---

## 7. What I deliberately did not unify

- **I did not give the four techniques one algebra.** They constrain four different objects. The
  taxonomy in §1 is the answer; manufacturing a unification is a failure mode named twice today.
- **I did not unify bulkhead with backoff.** A partition of a resource and a monotone map on a rate
  do not have a common composition law that says anything useful. They interact (a bulkhead changes
  what the backoff observes), and that interaction is not an algebra.
- **I did not give the circuit breaker one.** It does not have one, and its series composition is an
  instrument failure rather than a missing theorem.
- **I did not claim `CongestionEvidence` should be minted.** It is unconstructible _on purpose_;
  the honest fix is a real queue/delay signal with Little's law behind it, not a helpful-looking
  constructor.
- **I did not touch `SoftThrottle.fs`.** It was edited today by #10640; per the coordination note I
  read it and measured against it. Its conservative property is the reason §2's law applies, and it
  already holds.
- **I did not build the mutual-information lens.** Pearson is the coarse instrument and I said so
  rather than upgrading it in the same PR.
- **I did not fix `UBL-12`.** The AIMD collapse is a known, filed defect; here it is _used_ as the
  shared attractor that produces the §6 finding.

---

## 8. CHECKED vs inferred

**CHECKED (read the source, or ran it):**

- `SoftThrottle.fs` only ever defers — every shed path returns the tail. Read end to end.
- `FerryThrottler` bounded-queue backpressure is `BoundedChannelFullMode.Wait` — cooperative, no
  dropped work; DoP=1 is a genuine single deterministic loop.
- `HeatSignature.isPressureKind` and `HeatSignal.ofKind` disagree on mixed kind strings —
  transcribed and executed, table in §2b.
- `CongestionEvidence` is unconstructible: brand symbol `CONGESTION_EVIDENCE` is `declare const`,
  unexported, with no minting function.
- Every number in §4, §5, §6 — deterministic runs, replay-pinned by BID-4.
- The F2 trajectory: printed directly, two distinct values in 190 buckets.

**INFERRED / NOT CHECKED:**

- Whether any kind string emitted today actually contains both a forgetting and a pressure token.
  The divergence is latent until someone shows an emitted string that hits it.
- All Beacon citations are **CITED, not page-checked** (Kahn 1974; Kahn–MacQueen 1977;
  Brock–Ackerman 1981; Reichenbach 1956; Little 1961; Kleinrock 1975; Chiu–Jain 1989; Jacobson 1988;
  Floyd–Jacobson 1992; Jain–Chiu–Hawe 1984; Nowak–Sigmund 1992; Künsch 1989; Pearson 1895;
  Dixon–Mood 1946).
- The §6 fleet-level reading (design coupling survives isolation _for named agents_) is a
  **register-3 reading** of a register-2 packet-level fact. It is consistent with the decorrelation
  capstone's independent finding on repo history; it is not the same measurement.
- The link model is one queue discipline. Nothing here is a claim about fair queueing or AQM.

---

## 9. Work-items minted

| id                           | title                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `081M00TNR8S087G0R00245QH02` | Backpressure control inputs: name the conservation law or mark the input correlated               |
| `081M00TNWK7087G0R000WX9XZE` | `Heat.fs`: two live classifiers of the deferral-vs-destruction bit disagree on mixed kind strings |
| `081M00TNWM8087G0R0027ACGKY` | Make deferral-vs-destruction a typed field, not a substring match on a free-form kind             |
| `081M00TNWN8087G0R002CQX6VJ` | Circuit breaker in series: an outer open breaker drives the inner error rate to zero              |

---

## 10. Anchors (Beacon)

- **G. Kahn**, "The semantics of a simple language for parallel programming", IFIP 1974 — the
  determinacy result conservative backpressure inherits.
- **G. Kahn and D. MacQueen**, "Coroutines and networks of parallel processes", IFIP 1977 — bounded
  FIFOs with blocking writes; backpressure that stays determinate.
- **J. D. Brock and W. B. Ackerman**, "Scenarios: A model of non-determinate computation", 1981 —
  the input–output relation is not compositional once you drop; why lossy shedding has no algebra.
- **H. Reichenbach**, _The Direction of Time_, 1956 — the common-cause principle; §6's limit.
- **J. D. C. Little**, "A proof for the queuing formula L = λW", Operations Research 9(3), 1961; and
  **L. Kleinrock**, _Queueing Systems Vol. 1_, 1975 — the conservation law that makes a delay signal
  derived rather than correlated.
- **V. Jacobson**, "Congestion Avoidance and Control", SIGCOMM 1988; **D.-M. Chiu and R. Jain**,
  Computer Networks and ISDN Systems 17(1), 1989 — AIMD and its assumptions.
- **S. Floyd and V. Jacobson**, "On Traffic Phase Effects in Packet-Switched Gateways",
  Internetworking 1(1), 1992 — phase-lock; jitter as the symmetry-breaker.
- **R. Jain, D.-M. Chiu, W. Hawe**, DEC-TR-301, 1984 — the fairness index; fairness is not
  decorrelation.
- **M. A. Nowak and K. Sigmund**, "Tit for tat in heterogeneous populations", Nature 355, 1992 —
  generous TFT; §3a.
- **H. Künsch**, Annals of Statistics 17(3), 1989 — why the i.i.d. null is wrong on an
  autocorrelated series.
- **K. Pearson**, Proc. R. Soc. London 58, 1895; **W. J. Dixon and A. M. Mood**, JASA 41, 1946 —
  the correlation coefficient and the sign test.
- **Human anchor, in-repo:** the maintainer's Itron `Platform.DotNet`
  `Threading.Tasks.Throttling` — `IThrottler`, `MaxDegreeOfParallelism`, the stateful
  `BatchSizeLimiter` fold. The ferry-throttle prior art `FerryThrottler` and `SoftThrottle.boat`
  are ports of.

**In-repo:** `src/Core/SoftThrottle.fs`, `src/Core/Heat.fs`, `src/Core/SchedulerShedHeat.fs`
(#10640), `src/Core/FerryThrottler.fs`, `src/Core.TypeScript/discovery/udp-lossy-transport.ts`,
`udp-bdp-link.ts`, `bandwidth-isolation-decorrelation.ts`;
`docs/research/2026-08-04-decorrelation-instrument-arc-capstone-what-survives-is-benign-shared-buses.md`,
`2026-08-13-lossy-transport-calibration-audit-*`,
`2026-07-11-correlated-attention-vs-decorrelated-love-*`,
`2026-07-02-dirty-reticulum-metered-entropy-is-the-coordination-readout-linked-clones-as-metered-channels-with-exit.md`.

**Rules this study is bound by:** `async-all-the-way-truthful-signatures.md` (DoP=1 and N on one
path), `local-time-never-enters-the-shared-fold.md` (jitter and backoff are _local_ decisions and
stay local — nothing here filters evidence entering a shared fold),
`dv2-data-split-discipline-activated.md` §7 DST / §12 idempotency / §13 noninterference,
`anchor-to-human-prior-art.md`, `dual-use-detection-is-neutral-oracle-decides.md` (a correlation
reading is a neutral fact; "benign" is the oracle's).
