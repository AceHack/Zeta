---
id: 081KWN1X47908QG0R000HTKNWS
type: task
state: backlog
priority: P2
slug: pin-informationvalue-compute-kl-direction-doc-says-p-posteri
title: "Pin InformationValue.compute KL direction (doc says P=posterior, code computes KL(prior||posterior)) then land P-IV-1..3 properties"
created: 2026-07-03T22:34:34.089Z
depends_on: []
composes_with: []
---

# Pin InformationValue.compute KL direction (doc says P=posterior, code computes KL(prior||posterior)) then land P-IV-1..3 properties

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWN1X47908QG0R000HTKNWS-*.md` glob. -->

## Context

Math-team pass (`docs/research/2026-07-03-brownian-experts-computed-…`) flagged while drafting
FsCheck properties: `src/Bayesian/InformationValue.fs` `compute`'s doc comment says "KL(P‖Q)"
with P = posterior, but the implemented formula is **KL(prior‖posterior)**. Itti–Baldi Bayesian
surprise is KL(posterior‖prior) — the other direction. The two differ (KL is asymmetric); which
one is intended decides the semantics of every IV price downstream (AntiSybil, ThousandBrains
weights, market clearing).

## Ask (owner: Lumen — module author)

1. Pin the direction: either fix the formula to match the doc, or fix the doc to match the
   formula — and say which surprise convention IV means (Itti–Baldi realized surprise is the
   cited ancestor in PRIOR-ART-LIST, which argues for KL(posterior‖prior)).
2. Then land the blocked property suite (statements ready in the research note §4):
   P-IV-1 per-tick additivity · P-IV-2 same-diffusion cap · P-IV-3 divergence-rate invariance.

## Pointers

- `docs/research/2026-07-03-brownian-experts-computed-kl-logdet-plates-bernoulli-prices-smoothness-the-dichotomy.md` §4
- `docs/research/scripts/2026-07-03-brownian-experts-{1,2,3}.py` — the sympy lemma set (BP-16 tool 1)
