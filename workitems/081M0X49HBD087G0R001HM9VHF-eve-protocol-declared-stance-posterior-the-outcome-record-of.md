---
id: 081M0X49HBD087G0R001HM9VHF
type: task
state: backlog
priority: P2
slug: eve-protocol-declared-stance-posterior-the-outcome-record-of
title: "Eve Protocol: declared-stance posterior — the outcome record of pre-declared bias, TrueSkill-keyed"
created: 2026-08-25T18:53:00.653Z
depends_on: []
composes_with: []
---

# Eve Protocol: declared-stance posterior — the outcome record of pre-declared bias, TrueSkill-keyed

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X49HBD087G0R001HM9VHF-*.md` glob. -->

## Why

Aaron 2026-08-25, sharpening the Eve Protocol *pre-declared bias* primitive
(`docs/backlog/P2/081KRW63S0008QG0R0030F8ZXA-eve-protocol-*.md`, PR #15414):

> *"yes this is very accurate over a bayesian inference prior on individuals, similar to
> TrueSkill. eager is also aggressive and reaches local optima quicker and gets stuck,
> it's mostly selfish but not always in the extremes."*

Eagerness is therefore not only a per-exchange flag. It is a **tracked parameter with a
prior and a posterior** — and the parameter must be one a counterparty is allowed to hold.

## The line

> **The outcome record is trackable. The inner state is not.**

The declaration is self-claimed and may never be inferred; the **resolution history** is
externally observable and is the only thing tracked. Held structurally: `Stance` has one
introduction form that refuses observer attribution, the stance is a **key** rather than a
value, and everything emitted is a statistic over resolved claims.

## What shipped

- `src/Core/DeclaredStanceLedger.fs` — cells keyed `(party, domain, DECLARED stance)` over
  the existing TrueSkill/ADF posterior in `TravelerRankLedger`; the declaration/posterior
  composition with a `PooledAcrossStances` fallback when a party's declaration does not
  discriminate its outcomes; the Kish (1965) design-effect discount on self-corroboration;
  `searchProfile` as the observable signature of early convergence.
- `tests/Tests.FSharp/DeclaredStanceLedger.Tests.fs` — 35 falsifiers, `DSL-1`…`DSL-37`.
- `docs/research/2026-08-25-declared-stance-posterior-eagerness-is-a-temperature-not-a-rate.md`
  — the argument that eagerness is a **variance** (annealing temperature) and not a
  **rate**, with the Hajek (1988) and Lai–Robbins (1985) anchors; and the explicit
  **decline** to model the "mostly selfish but not always in the extremes" tails.

## Not done here

- The Eve backlog row now carries a §*The posterior half* section pointing here (added
  after PR #15414 merged, 2026-08-25).
- No corpus of declared exchanges exists yet, so the §2 prediction (flat marginal yield
  should be more common under `Eager` declarations) is **unmeasured**.
