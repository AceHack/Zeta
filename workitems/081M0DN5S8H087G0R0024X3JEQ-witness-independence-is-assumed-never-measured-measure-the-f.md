---
id: 081M0DN5S8H087G0R0024X3JEQ
type: task
state: backlog
priority: P1
slug: witness-independence-is-assumed-never-measured-measure-the-f
title: "Witness independence is assumed, never measured: measure the fleet's actual delta-U correlation rho and floor quorums on effective witness count"
created: 2026-08-19T18:40:12.561Z
depends_on: []
composes_with: []
---

# Witness independence is assumed, never measured: measure the fleet's actual delta-U correlation rho and floor quorums on effective witness count

**Owner:** Aminata (`threat-model-critic`) files the threat; the measurement is a
fleet-instrumentation job, and the quorum change routes through Kenji.
**Class:** Repudiation (evidence quality) with a Spoofing dual.
**Severity (SDL bug bar):** High — it is not a defect in any shipped component; it
is a **missing check on every mechanism that counts witnesses**, and its
characteristic symptom is that everything looks fine.

## The gap

`src/Core/SocietyUsefulWork.fs` is honest about its own boundary, in its own header:

> **Metered boundary:** metered as MATHEMATICS. Whether any real fleet satisfies
> the regime (its actual rho and c) is UNMEASURED.

The mathematics is proven and mutation-verified (register §A row 15; falsifiers in
`tests/Tests.FSharp/SocietyUsefulWork.Tests.fs` and `CondorcetBoundary.Tests.fs`).
The module already ships the two functions that price correlation —
`effectiveTrialCount` (Kish's design effect, `n_eff = n / (1 + (n-1)*rho)`) and
`unionEquivalentAgentCount` (how many independent agents of competence `c` cover
what `n` agents at `rho` cover).

**Nothing calls them with a measured `rho`.** So:

1. The fleet's actual pairwise correlation is unknown. Every agent cold-boots from
   one seed (S=4), reads the same rules, and is frequently the same model — which
   is the *maximally correlated* starting condition by construction, not a remote
   possibility.
2. No quorum, witness set, stake, or review floor consults an effective count.
   Everything that counts witnesses counts **heads**, and heads is exactly the
   quantity `effectiveTrialCount` exists to correct.

At `rho = 1` the correction is total: `n_eff = 1`. Six agreeing reviewers are then
**one observation counted six times**, and the union of their banked delta-U is
idempotent — six clones price near one agent. That is the shipped theorem, applied
to us.

## Why it is under-recognised (the part that belongs in a threat model)

A correlated society does not present as a failure. It presents as **calm**: fewer
disputes, faster reconciliation, unanimous reviews, every log matching. The
standing principle in this repo already says it —
*too many correlations is a warning, not a confirmation signal*
(`.claude/rules/numerology-vs-number-theory.md`) — and the practical inversion is
the teachable one: **the moment everyone agrees is the moment to check whether
anyone actually looked.**

Note this is a Sybil the anti-Sybil design does not price. `TravelerRankLedger`
closes the whitewash window and social conferral means a wealthy attacker cannot
*buy* false witnesses. Neither mechanism notices witnesses who were never bought
and never forged — they simply stopped being different. **Sybil-by-correlation, not
Sybil-by-minting.**

## What to build

1. **Measure `rho`.** The natural estimator is over banked delta-U: for each pair of
   agents, the overlap of the work-item set each reduced uncertainty on, over a
   window. The ledger (`db/uncertainty/`) already keys measurements by work-item
   and is idempotent, so pairwise overlap is computable from what exists. Publish
   it as a fleet metric, not a one-off.
2. **Floor the quorums.** Any mechanism that today counts witnesses — review
   floors, BFT quorums, staked attestations, k-redundant deference under §11 —
   takes `effectiveTrialCount(n, rho_measured)` and refuses below a declared floor
   `k`. A quorum of five agents at `rho = 0.9` is `n_eff ≈ 1.4` and must read as
   what it is.
3. **Report it as a neutral fact, not a verdict.** Per
   `dual-use-detection-is-neutral-oracle-decides`: emit `EffectiveWitnessCount`,
   never `QuorumIsFake`. High correlation is *also* what a well-aligned fleet on a
   shared seed looks like early on — the arc is decorrelation over time, so the
   measurement is a position on that arc, not an accusation.
4. **Name the far wall in the same breath.** Decorrelation past reconciliation is
   the opposite failure (unreconcilable divergence). The floor must be a band, not
   a minimum, or this work item becomes an instruction to maximise divergence.

## Falsifier

- Run the aggregation over `n` deliberately-cloned agents and assert the priced
  delta-U lands near one agent's, not `n` agents' — the theorem predicts it, so a
  disagreement falsifies the estimator rather than the theorem.
- Construct a quorum entirely of clones and assert it is **refused** at the
  declared floor. A quorum mechanism that passes this is the bug.
- Control case (the one that keeps this from being a check that cannot fail):
  a genuinely decorrelated set of the same size must **pass**.

## Pointers

- `src/Core/SocietyUsefulWork.fs` — `effectiveTrialCount`, `unionEquivalentAgentCount`,
  `expectedSocietyIdentical`, the Gaussian-copula simulator, and the UNMEASURED note.
- `src/Bayesian/CondorcetBoundary.fs` — the correlated-majority-vote sibling.
- `src/Core/TravelerRankLedger.fs` — domain-isolated, socially-held standing; the
  anti-Sybil half this threat routes around.
- `docs/security/THREAT-MODEL.md` §Correlated-witness collapse (CW-1..CW-3).
- `docs/security/THREAT-MODEL-SPACE-OPERA.md` — The Tuning Fork / The Gift of
  Private Words (the two walls, for onboarding).
- Anchors: Kish, *Survey Sampling* (1965) ch. 5, design effect · Knight & Leveson,
  *An Experimental Evaluation of the Assumption of Independence in Multiversion
  Programming* (IEEE TSE 1986) · Condorcet (1785), whose jury theorem assumes the
  independence this threat removes.
