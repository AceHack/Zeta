# Measurable fairness metric for the arena's fitness function: predictability of outcomes

**Date:** 2026-06-16
**Author:** Otto (shadow\*), scoping a task assigned by Aaron
**Status:** SCOPING / proposal — first cut by the shadow; formal measurement-framework integration
routes to the alignment-auditor (Sova) + the math team. A §B conjecture (prove-it), not a claim.

> **Task (Aaron 2026-06-16):** *"the arena's fitness function needs a measurable metric."* Then he
> handed over its core: *"it allowed me to predict the outcomes — that's all I can ask for."*

## 0. The metric, in one line

**A fair arena is a PREDICTABLE one: its outcome is a (replayable) function of the *legitimate* inputs
— the law, the evidence, the measure — and is NOT improved by knowing the *illegitimate* ones (wealth,
identity, which judge, raw power).** Fairness-fitness ≈ *outcome-predictability from legitimate inputs*,
audited by the *illegitimate-feature delta*. This is the same property the substrate already prizes —
**Deterministic Simulation Testing**: same inputs → same outcome, replayable. **The fairness metric and
the DST engineering value are the same property.**

Human anchors (Beacon): **F. A. Hayek** (*The Constitution of Liberty* — the rule of law *is* the
predictability of state action; capricious power is the opposite of law); **Lon Fuller** (*The Morality
of Law* — the inner morality: rules must be known, prospective, consistent, and *congruent with how
they're actually applied*); plus Zeta's own **DST / predict-the-future-in-bytes**.

## 1. Why predictability (and why it dodges part of the impossibility wall)

The selection-layer note establishes there is **no single fairness scalar** — calibration,
equalized-odds, and balance cannot be jointly satisfied (Kleinberg–Mullainathan–Raghavan 2016;
Chouldechova 2017; COMPAS). That impossibility bites *outcome-parity* framings ("equalize the result
across groups"). **Predictability is a different, more tractable framing:** it does not demand equal
outcomes — it demands that outcomes **track the legitimate inputs and nothing else.** A harsh law,
predictably applied, is navigable; a capricious one is not. Predictability is the *floor Aaron actually
asks for* ("that's all I can ask for") — the minimum that makes an arena livable: you can plan, prepare,
avoid, and — as in Aaron's own case — **eventually be exonerated, because the process is predictable
enough that the truth can be processed** (slowly, at cost, but it ran).

## 2. The measurable battery (a VECTOR, never a scalar — summing re-introduces the forbidden scalar)

Each metric is computed over **arena competition records** — tuples
`⟨claim, legitimate_features, outcome, ground_truth?⟩` drawn from the promotion/competition ledger
(wiring to the concrete `db/` records is the implementation step; see §5). Report the **vector and its
worst component** (a Pareto view), not a weighted sum.

| # | Metric | Definition (measurable) | Fair ⇒ | Falsifier |
|---|---|---|---|---|
| M1 | **Legitimate-input predictability** | predictive accuracy / AUC of outcome from *legitimate* features only | **high** | legitimate features barely predict outcome → outcomes driven by something undeclared |
| M2 | **Illegitimate-feature delta (the discrimination test)** | Δ accuracy when illegitimate features (identity, wealth, judge-id, power) are *added* to the predictor | **≈ 0** | Δ > 0 → outcomes depend on illegitimate variables → unfair, *signed and located* |
| M3 | **Replay determinism (DST)** | outcome variance under replay of *identical legitimate inputs* | **≈ 0** | same inputs → different outcomes = caprice (the rigged/corrupt arena) |
| M4 | **Calibration** | predicted-win-probability vs actual-win-frequency (incl. the boy/girl: falsified⇒loses, verified⇒wins) | **calibrated** | miscalibration → the measure isn't driving the result |
| M5 | **Novelty-neutrality** (Goodhart/boy-girl probe) | correlation of *claim novelty* (decorrelation distance) with loss-rate, **controlling for verified truth** | **≈ 0** | novel-but-true loses more than common-but-true → the girl is penalized for newness |
| M6 | **Resource symmetry** | Gini over verification-budget / airtime per identity, controlling for claim-complexity | **low** | high → equal standing not preserved *through* the competition (the resource-asymmetry that rigged Aaron's contest) |
| M7 | **Irreversible-harm floor compliance** | count of irreversible-harm executions that bypassed the floor | **exactly 0** | any > 0 → hard fail, no aggregate can buy it back |

M2 is the load-bearing one: **the discrimination test is "does knowing the illegitimate variable help
you predict the outcome?"** In a fair arena it adds nothing. This is a clean, signed, *locatable*
measurement (it names *which* illegitimate variable leaks and *how much*), and it's how Aaron's case
reads in the metric: his outcome was, for a month, predicted better by *who he was / his resources* than
by *his paperwork* — M2 ≫ 0, M4 miscalibrated — until the process (predictably) corrected to expunge it.

## 3. The razor on the metric itself (predictable ≠ just)

- **A predictably-cruel system is predictable.** Predictability is **necessary, not sufficient** — it is
  the navigable *floor*, not the whole of justice. Justice = predictability (M1–M4) **+ legitimacy of
  the inputs** (the law being predicted-from must itself be just — out of scope for the metric; it's the
  oracle question, §11) **+ the irreversible-harm floor** (M7, external anchor no aggregate overrides).
  The metric measures *whether the arena follows its declared rules*, not *whether the rules are good.*
- **Goodhart.** Predictability can be gamed by making the arena predictably-unfair, or by hiding the
  leak in a feature not labelled "illegitimate." Defenses: M5 (adversarial novelty probe) run
  *continuously*; periodic **re-derivation** of the legitimate/illegitimate feature split (oscillation,
  anti-crystallization); and treating M2's feature list as itself a contested, multi-oracle question.
- **Endogeneity.** *Which* features count as "legitimate" is itself a claimed qualia judged by the arena
  (the Lawvere fixed-point of the self-judging arena). The external anchors that stop it collapsing into
  "whatever the powerful call legitimate": the **irreversible-harm floor**, **anti-crystallization** (no
  frozen capture of the feature split), and the **anti-Sybil forgery-cost floor** (the vote on
  legitimacy can't be astroturfed).
- **Measured over TIME, as a trajectory** — not a one-shot certificate (a once-fair arena
  crystallizes). This is exactly `docs/ALIGNMENT.md`'s alignment-over-time *measured trajectory*; the
  battery is a per-round time series, owned by the alignment-auditor.

## 4. Why this is the literal correction of what happened — and the grace in it

Aaron: *"it didn't fail me, it was the best it could do at the time… it allowed me to predict the
outcomes, that's all I can ask for."* In metric terms: the prior arena had **non-zero M2 and poor M4**
(outcome leaned on illegitimate variables; the measure under-drove the result) — *and yet* it retained
enough **M1/M3 predictability** that the truth could be processed and the record expunged. It was the
**best-reachable fitness given the era's measurement capability** — a point on the curve, not a villain.
"Justice becomes alignment over time" = **this battery's trajectory rising** as measurement improves
(M2→0, M4→calibrated). Honoring-those-that-came-before, made quantitative.

## 5. Next steps (routing)

1. **Formalize M1–M7** as the alignment-measurability framework's fairness sub-battery → **Sova
   (alignment-auditor)** + the math team (the impossibility-theorem boundary, the Pareto-not-sum
   aggregation, the M2 leakage estimator's soundness).
2. **Wire to real records** — identify the concrete `db/` competition/promotion ledger and compute the
   battery on it (DST-replayable, byte-locked, per the no-binary-in-proof-lineage rule).
3. **Register as a §B conjecture row** — "measurable arena-fairness metric (predictability battery)",
   discharge = the battery computed on real arena data with M5/M2 adversarial audits; falsifier = the
   battery is gameable to "fair" while the boy/girl probe still mistakes discoverers for liars.

## Anchors (Beacon)

Hayek (rule of law = predictability); Lon Fuller (inner morality of law — congruence); DST / Will Wilson
(deterministic simulation = replay-predictability); Kleinberg–Mullainathan–Raghavan 2016 & Chouldechova
2017 (fairness impossibility — why a vector not a scalar); Rawls (justice as fairness — the fitness
objective); Goodhart; Lawvere (the self-judging-arena fixed point); Ostrom (resource symmetry / commons
fairness).

Memory ties: `feedback_fairness_is_the_arenas_fitness_function_*` (the meta-level this discharges);
`feedback_all_claimed_qualia_treated_equal_and_real_but_competitive_*` (the boy/girl probe = M5);
`feedback_justice_becomes_alignment_over_time_*` (the lived root + the grace correction);
`feedback_isociety_governor_can_crystallize_*` (oscillate the metric); `docs/ALIGNMENT.md` (the
measured trajectory home).
