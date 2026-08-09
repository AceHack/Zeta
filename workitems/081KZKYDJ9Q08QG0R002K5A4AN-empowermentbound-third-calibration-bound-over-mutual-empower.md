---
id: 081KZKYDJ9Q08QG0R002K5A4AN
type: task
state: backlog
priority: P2
slug: empowermentbound-third-calibration-bound-over-mutual-empower
title: "empowermentBound — third calibration bound over mutual empowerment, oracle-set parameterized"
created: 2026-08-09T19:01:29.527Z
depends_on: []
composes_with: []
---

# empowermentBound — third calibration bound over mutual empowerment, oracle-set parameterized

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZKYDJ9Q08QG0R002K5A4AN-*.md` glob. -->

## Ask (Aaron 2026-08-09)

> *"We need one based on mutual empowerment that mixes the two — mutual empowerment
> and multi-oracle, so each member can decide which oracles it trusts or start its own."*

**Full design:** `docs/research/2026-08-09-mutual-empowerment-bound-third-bound-mixing-explore-and-trust-multi-oracle-aaron.md`

## Why the obvious implementation is wrong

A linear blend of the two shipped bounds is **vacuous**:
`w(μ+k₁σ) + (1−w)(μ−k₂σ) = μ + k′σ` — it collapses to another single-agent bound
with a different k, adds no second party, and is just `exploreBound` turned down.
The mix must be **structural** and must range over **both** agents.

## Proposed shape

- `trustBound` becomes the **floor — for BOTH parties** (non-coercion: I cannot buy
  my upside with your downside).
- `exploreBound` becomes the **reach**, maximized over the **joint** option space.
- Parameterized by an **oracle set** the member chooses (§11 Multi-Oracle applied to
  a metric, not a verdict) — no ambient/global scorer, ever.

## Hard constraint (decide before coding)

**Empowerment must be computed from DECLARED capability, never inferred by observing
a peer's private state.** Estimating another's option space is otherwise
surveillance, colliding with §6 consent-first and the inviolability of earned frost.
Score what remains declared; do not estimate around the frost.

## Placement

Keep SEPARATE from `calibration-ledger.ts`: calibration scores a **claimant's
self-knowledge**; empowerment scores an **interaction between two peers**. Collapsing
them turns a calibration score into a social ranking — the exact failure the existing
docstring guards ("weighting a claim is not the same as valuing the claimant").

## Open, needs a decision (values calls, not implementation details)

1. `jointOptionGain` aggregation: **min** (maximin — protects the worse-off party,
   matches the existing floor discipline) vs sum (permits sacrificing one party for
   aggregate gain) vs Nash product. `min` looks right; it is a values call.
2. Cheap honest proxy for channel capacity (generally intractable to compute exactly).
3. Gaming: can a peer inflate gain by declaring capabilities it lacks? (Calibration
   may already police this — undelivered declarations degrade `trustBound`, which is
   a *constraint* here. Prove rather than assume.)
4. Whose `k` sets the mutual floor — each party's own, or negotiated? May a party set
   k=0 and volunteer to be exploited?

## Anchors

Klyubin/Polani/Nehaniv 2005 (empowerment = channel capacity actions→future
observations); **Salge & Polani 2017, "Empowerment as Replacement for the Three Laws
of Robotics"** (maximize the OTHER's empowerment as an alignment objective — the
non-coercive framing this rides on); Du et al. 2020 (AvE); Auer 2002 (UCB lineage of
`exploreBound`); Cantelli/Scarf (the `trustBound` shortfall guarantee).
