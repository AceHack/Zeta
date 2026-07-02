# Predictive entropy — Szilard, Sagawa-Ueda, finite-time thermodynamics, and the offline-vs-online scheduling advantage

Date: 2026-07-02
Author: Soraya (formal-verification-expert), invoked by Otto for the Phase 5 role.
Follows up: `docs/research/2026-07-02-observe-without-commit-the-thermodynamic-architecture.md` (Aaron, the
"Provable Advantage" section, lines 56-72) and
`docs/research/2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md` (the two-ledger model).
Status: research note. Routes one Z3 floor-lemma (P1) and one TLA+ lookahead invariant (P2). No spec written yet.

> Peer note (agents-not-bots): the Observe-Without-Commit doc *asserts* a provable advantage
> ("predictive systems commit MORE bits/sec at fixed TDP because tau is large -> excess is small").
> It is right, and it is not hand-waving. This note is the full derivation: which physics grounds
> it, where the `L^2/tau` comes from, why offline scheduling beats online by a QUANTIFIABLE margin,
> and exactly which claim is arithmetic (Z3) versus temporal (TLA+). One honesty guard at the end:
> the metering-test says name the part of this that is a *policy shape*, not a joules claim on
> current silicon.

---

## TL;DR

1. **Szilard 1929** grounds the exchange rate: one bit of information is worth `kT ln2` of work. This
   is why the soft lane's accumulated bits are not free-floating trivia — they are thermodynamic fuel.
2. **Landauer 1961 / Bennett 1973** give the floor and the reversible-is-free result (already in the
   doc, and in the two-ledger note as Ledger B).
3. **Sagawa-Ueda 2008-2012** give the mechanism: the generalized second law WITH feedback. A predictor
   is a feedback controller; the mutual information it holds about future commits *lowers the effective
   entropy cost*, bounded by that mutual information. **Prediction is Sagawa-Ueda feedback.** This is
   the physics the doc's advantage rests on, named.
4. **Finite-time thermodynamics** (Sekimoto; Aurell et al. 2012; Sivak-Crooks 2012; Proesmans et al.
   2020) give the excess: erasing `B` bits in time `tau` costs `B kT ln2 + L^2/tau`, where `L` is the
   *thermodynamic length* (a Fisher-Rao-type metric distance along the control protocol) and `tau` the
   protocol duration. The floor is irreducible and additive in `B` (Correction 1 of the ferry
   addendum); the **excess `L^2/tau` is what prediction reduces** by stretching `tau`.
5. **Offline-vs-online scheduling** is the CS half. An online scheduler discovers each commit at the
   last moment -> small `tau` -> large excess. An offline (predictive/clairvoyant) scheduler knows
   `(B, t)` in advance -> starts early -> stretches `tau` to the full window -> excess -> minimized.
   The gap is a **competitive ratio on dissipation**, and it is the same convex speed-power tradeoff
   that speed-scaling scheduling (Yao-Demers-Shenker 1995) already proves optimal for offline.
6. **The two disciplines the system already runs are exactly the two offline predicates.** DST /
   DoP=1 gives the *arrival times* `t` (the schedule is deterministic, replayable, known ahead).
   Noninterference (Sec.13) gives the *magnitudes* `B` (metered at the membrane, not guessed from an
   ambient channel). Offline scheduling needs the input sequence known in advance; DST supplies `t`,
   noninterference supplies `B`. Miss either and you are online, paying excess.

Anchors: Szilard 1929; Landauer 1961; Bennett 1973; Sagawa & Ueda 2008 (PRL) / 2010 / 2012;
Sekimoto (stochastic energetics); Aurell, Mejia-Monasterio & Muratore-Ginanneschi 2012 (optimal
finite-time erasure); Sivak & Crooks 2012 (thermodynamic length as a Fisher-Rao metric);
Proesmans, Ehrich & Bechhoefer 2020 (finite-time Landauer, `L^2/tau` scaling verified);
Berut et al. 2012 (Nature, experimental floor); Yao, Demers & Shenker 1995 (speed scaling, offline
optimal + online competitive ratio); Albers (energy-efficient scheduling surveys).

---

## 1. Szilard: the exchange rate (why accumulated bits are fuel)

Szilard's 1929 one-molecule engine is the origin of "information = work." The demon observes which
half of a box a single molecule occupies (1 bit), inserts a piston on the empty side, and extracts
`kT ln2` of work as the gas expands isothermally. The engine looks like a second-law violation until
you account for the demon's *memory*: the measurement result must eventually be erased, and Landauer's
floor charges exactly `kT ln2` for that erasure (Bennett's resolution). The bit and the work are the
same quantity in two currencies.

**Consequence for the soft lane.** Observe-Without-Commit says the soft lane accumulates information at
zero heat (Bennett reversible reads). Szilard sharpens *what that information is worth*: each accumulated
bit is `kT ln2` of latent work. The soft lane is not just a free scratchpad — it is a **charged
capacitor**. The question the ferry answers is whether those bits are spent (erased at commit, paying
Landauer) or *used as feedback* (Sec.3) to run the commit nearer the floor. Both are Szilard's engine,
run forward or used as a controller.

## 2-3. Landauer floor and the Sagawa-Ueda feedback correction

Landauer/Bennett are already the two-ledger note's Ledger B (`is Adj` op -> 0 heat; erase of `k` bits
-> `>= k kT ln2`). What that note did not yet carry is *feedback*.

**Sagawa-Ueda generalized second law.** With a feedback controller that has acquired mutual information
`I` between a measured system and its memory, the second law is not `Delta S >= 0` but

```
   Delta S >= -I            (entropy can DECREASE by up to I, paid for by the measurement)
   W_extractable <= kT (Delta F + I)     (feedback raises the extractable-work ceiling by kT*I)
```

Read the other way (the erasure direction we care about): a controller holding mutual information `I`
about *what it is about to erase* can perform that erasure at an effective cost lowered by `kT*I`
relative to a blind eraser. **A predictor is precisely this controller.** It holds mutual information
between "the future commit stream" and "the schedule it has already committed to" — and that mutual
information is the resource that lets the ferry run its erasures on a stretched, near-reversible
protocol instead of a rushed one.

So the doc's advantage is not a metaphor: it is the Sagawa-Ueda bound with the predictive scheduler
cast as the feedback controller. **Soft-lane observation -> mutual information `I` -> feedback ->
reduced finite-time excess at the ferry.** That single chain unifies "observe without commit" with
"pay minimum at commit"; they are the read side and the control side of one Szilard-Sagawa-Ueda loop.

## 4. Finite-time thermodynamics: where `L^2/tau` comes from

Landauer's `kT ln2` is the *quasi-static* floor — approached only as protocol time `tau -> infinity`.
Any real erasure in finite `tau` pays an excess. For the *optimal* (minimum-dissipation) protocol,
finite-time thermodynamics gives

```
   W(B, tau) = B kT ln2  +  L^2 / tau  +  o(1/tau)
                 floor        excess
```

- `L` is the **thermodynamic length**: the geodesic distance between the initial and final control
  configurations under the friction/Fisher-Rao metric `g_ij` (Sivak-Crooks 2012). It is a property of
  *the erasure you must perform* (how far the control parameters must travel), not of `tau`.
- The `L^2/tau` form is the Sekimoto/Aurell minimum-dissipation result and was verified experimentally
  for Landauer erasure by Proesmans-Ehrich-Bechhoefer 2020. It is the thermodynamic analogue of the
  convex "energy = (distance)^2 / time" cost of moving a control parameter at finite speed.

**Two facts this pins down, both load-bearing for the routing:**

- (a) The floor `B kT ln2` is **additive in `B` and independent of `tau`** — it is the batch-invariant
  Ledger B of Correction 1 (ferry addendum). Prediction CANNOT touch it. Anyone claiming prediction
  reduces the floor has committed a Definition-class verification drift.
- (b) The excess `L^2/tau` is **strictly decreasing in `tau`** and is *the entire lever prediction has*.
  Doubling the erasure window halves the excess. This is why "start early" is the whole game.

## 5. Offline vs online: the quantifiable advantage

Now the scheduling half. The ferry commits a stream of erasures `{(B_i, t_i)}`: `B_i` bits that must be
retired by deadline `t_i`. Each erasure `i` gets a window `tau_i = t_i - start_i` under the constraint
`start_i >= known_i` (you cannot begin erasing before you know the erasure exists).

- **Online (reactive) scheduler:** `known_i = t_i - epsilon` — the commit is discovered at the last
  moment. `tau_i -> epsilon` (small) -> excess `L_i^2/epsilon` (large). Total dissipation is
  `sum_i (B_i kT ln2 + L_i^2/epsilon)`.
- **Offline (predictive/clairvoyant) scheduler:** `known_i` is early (the schedule is visible ahead).
  `tau_i` stretches toward the full inter-arrival window -> excess `L_i^2/tau_i` (small, -> 0 as
  windows grow). Total dissipation approaches the floor `sum_i B_i kT ln2`.

The gap is a **competitive ratio on dissipation**. This is not a new result borrowed loosely — it is
the *same structure* as speed-scaling scheduling: power convex in speed (`P ~ s^alpha`), so running
slower (longer `tau`) saves energy superlinearly; Yao-Demers-Shenker 1995 proved the offline optimum
(YDS) and the online competitive ratio (`alpha^alpha` for average-rate; constant-factor for
optimal-online). Here `alpha = 2` (the `L^2/tau` excess is quadratic in inverse-time), so the
speed-scaling machinery transfers directly: **offline predictive commit is the YDS-optimal schedule of
finite-time erasures; the online reactive ferry pays a bounded competitive overhead in excess heat.**

**Why our system is offline for free.** Offline scheduling requires the input sequence known in advance.
The system already produces both coordinates of that sequence through disciplines it runs for other
reasons:

| Offline predicate | Supplied by | Discipline |
|---|---|---|
| arrival/deadline times `t_i` | the DoP=1 deterministic loop / DST replay | Sec.7 DST, the ferry's ordered commit |
| erased-bit magnitudes `B_i` | the metered membrane (`support` delta at the seam) | Sec.13 noninterference (B through a declared door, not guessed) |

The doc's closing lines ("the same determinism that gives DST replay gives predictive
heat-scheduling; the same noninterference that prevents ambient leaks gives known B") are exactly this
table. DST -> the `t`-axis of clairvoyance; noninterference -> the `B`-axis. Neither alone suffices:
knowing *when* without knowing *how many bits* leaves the excess un-plannable; knowing *how many* without
*when* leaves no window to stretch. The system is offline precisely because it runs both.

## Routing — one Z3 floor-lemma (P1), one TLA+ lookahead invariant (P2)

Anti-TLA+-hammer check applied first: the *cost inequality* is pure arithmetic over reals (nonlinear
in `tau`) -> **Z3**. The *scheduler behavior over time* (never start before known; never miss a
deadline; maximize `tau`) is temporal safety over a state machine -> **TLA+**. Neither belongs in the
other tool.

### Z3 floor-lemma (P1) — "the floor is a floor; prediction only shrinks the excess"

The load-bearing arithmetic claim — that the advantage is *real* (predictive schedule dominates
pointwise) and *bounded below* (it can never dip under the Landauer floor). Three conjuncts, all
QF_NRA (`L^2/tau` is nonlinear; if `L` is fixed per erasure, `1/tau` as a free variable makes it
QF_LRA-liftable):

```
  Let W(B, tau) = B*c + L*L/tau,  c = kT ln2 > 0,  L >= 0,  tau > 0,  B >= 0 (integer bits).
  (F1) Floor:        W(B, tau) >= B*c                         (excess is non-negative; floor is a lower bound)
  (F2) Additivity:   W(B1+B2, tau) - (L*L/tau) = (B1+B2)*c    (floor additive in B, batch-invariant: Corr.1)
  (F3) Monotonicity: tau2 >= tau1 > 0  ->  W(B, tau2) <= W(B, tau1)   (more window, less cost)
  (F4) Dominance:    tau_off >= tau_on  ->  W(B, tau_off) <= W(B, tau_on)  pointwise for every erasure
```

`(F1)+(F3)+(F4)` together are the theorem "prediction reduces total dissipation and never below the
floor." Effort: S (a pointwise real-arithmetic lemma; sibling of the existing Z3 laws in
`tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`). **P1** — it is the formal content of the doc's "Provable
Advantage" heading; single-tool is acceptable because it is a closed-form arithmetic inequality, not a
P0 safety property (no unrecoverable state corruption rides on it), but it must exist or the doc's word
"provable" is unbacked. This is the **floor-lemma** the routing owes.

### TLA+ lookahead invariant (P2) — "the scheduler is clairvoyant-but-honest"

The scheduling *correctness*: the predictive ferry may look ahead, but (a) it may not start an erasure
before that erasure is *known through the metered door* (no ambient precognition — Sec.13), (b) it must
still finish by the deadline, and (c) the lookahead horizon is bounded by the deterministic loop's
visibility (you cannot predict past what DST has produced). Invariant sketch:

```
  Lookahead ==
    /\ \A c \in Commits :
         started(c) => known(c)                        (* honest: no start before metered arrival *)
    /\ \A c \in Commits :
         done(c) => eraseEnd(c) <= deadline(c)          (* safe: stretched tau still meets the deadline *)
    /\ \A c \in Commits :
         started(c) => horizon(c) <= visibleTicks       (* bounded: cannot see past the DST frontier *)
  Optimize ==   \* liveness, checked separately: tau(c) is maximal s.t. the above hold
         \A c : tau(c) = deadline(c) - MaxStart(c)
```

This is a temporal-safety invariant over a scheduler state machine — the sibling of the shipped
`TickMonotonicity` spec and of the backpressure `rate <= sink_capacity` spec I routed in the ferry
addendum. TLC at a small bound (a handful of commits, discrete tick domain) sits under the knee.
**P2** (design-stage; the scheduler does not exist as code yet). Do NOT stuff the cost inequality into
this spec — the arithmetic is Z3's job (F1-F4); TLA+ only guards the *ordering and deadline* discipline.

### Routing table

| Claim | Tool | Cross-check | Effort | P |
|---|---|---|---|---|
| Floor is a lower bound; additive in `B`; batch-invariant (F1-F2) | **Z3** (QF_NRA/LRA) | Ledger-B FsCheck (ferry addendum) already guards batch-invariance in code | S | P1 |
| Excess monotone-decreasing in `tau`; offline dominates online pointwise (F3-F4) | **Z3** | — | S | P1 |
| Predictive scheduler never starts before metered arrival; meets deadlines; bounded horizon | **TLA+** | — | M | P2 |
| `tau` is maximized subject to the safety invariant (optimality/liveness) | **TLA+** (PROPERTY, separate from INVARIANT) | — | S | P2 |
| Sagawa-Ueda effective-cost bound `W <= floor - kT*I` as a discharged theorem | **Lean** (deferred) | — | L | P3 |

BP-16: the P1 floor-lemma is closed-form arithmetic (single-tool acceptable), but it is *cross-checked
in code* by the batch-invariance FsCheck property already routed in the ferry addendum (Corr.1) — the
same fact (floor additive, batch-invariant) proven once symbolically (Z3) and once by execution
(FsCheck). That satisfies the two-independent-evidence spirit without over-provisioning.

## Honesty guard (the metering-test, my standing role)

The `L^2/tau` optimum assumes the erasure runs the *minimum-dissipation geodesic protocol*. Real
irreversible hardware dissipates `~1e9-1e11 x` above the Landauer floor (Berut et al. 2012), so the
absolute joules saved by stretching `tau` on today's silicon are negligible in wall terms. **What is
real and scale-free is the POLICY SHAPE**: "know `(B, t)` ahead, start the erasure early, stretch the
window, keep the floor batch-invariant." That policy is the YDS-optimal offline schedule regardless of
the constant multiplying the floor — it is the right control law at any dissipation scale, and it is
the one the system's existing determinism + noninterference make available for free. The claim I sign
is the *policy dominance* (offline `<=` online, F4), Beacon-anchored to finite-time thermodynamics AND
competitive scheduling. I do **not** sign a measurable-joules claim on current commit hardware; that
would be physics-as-metaphor smuggled into the ledger, which is exactly what the metering-test exists
to catch.

## Discipline / provenance

- Every physics claim above is anchored to a named human + paper (Szilard, Landauer, Bennett,
  Sagawa-Ueda, Sekimoto, Aurell, Sivak-Crooks, Proesmans, Berut) and every CS claim to Yao-Demers-Shenker
  speed scaling. Anchor-to-human-prior-art: math grounds validity, physics grounds the metering
  discipline; the metering-test is applied in the honesty guard.
- Two routed artifacts (Z3 floor-lemma P1; TLA+ lookahead invariant P2) are the follow-up the
  Observe-Without-Commit doc's "Provable Advantage" section owed. They are filed as routing, not yet
  written — the scheduler code they verify does not exist yet (P2), and the floor-lemma waits on the
  Z3.Laws suite slot (P1, next available).
- Sagawa-Ueda as a *discharged* Lean theorem is the P3 escalation, deferred until a consumer needs the
  effective-cost bound proven rather than cited (same discipline as the deferred Landauer-bound Lean in
  the two-ledger note).
