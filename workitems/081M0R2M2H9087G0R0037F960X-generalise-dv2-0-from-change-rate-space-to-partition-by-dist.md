---
id: 081M0R2M2H9087G0R0037F960X
type: task
state: backlog
priority: P2
slug: generalise-dv2-0-from-change-rate-space-to-partition-by-dist
title: "DV2.0 change-rate partition at cluster granularity — clusters formed by embedding distance"
created: 2026-08-23T19:47:36.617Z
depends_on: []
composes_with: []
---

# Generalise DV2.0 from change-rate space to partition-by-distance — etymological space as the second instance

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R2M2H9087G0R0037F960X-*.md` glob. -->

## Scope

Proposes that DV2.0's change-rate partition applies at **cluster granularity**, where clusters are formed by distance in an embedding space. NOT a new metric competing with change-rate — semantic distance defines the **unit**, change-rate still defines the **partition**. A cluster of synonyms has one change rate; its members are never measured individually. A RULE change — `.claude/rules/` is startup-loaded and razored, so this is a proposal, not an edit. Worked second instance: design §2a.

**Do not build ahead of the design.** Filed deliberately rather than half-built.

## Disagreement is the measurement (Aaron 2026-08-23)

Within-cluster change-rate disagreement is NOT a coherence precondition to check
and refuse on — it is an **etymological lifecycle signal**, and the obstruction
itself is the readout. Same move `.claude/rules/anti-babel-preserve-reconcilability.md` already
makes for monodromy: _"that difference is information, not error"_. See design
§2a for the proposed three-state table, its `proposed` register, and the confound
(file churn / author count) that must be excluded before it is believed.

## The statistic (Aaron 2026-08-23)

Not "disagreeing churn" — **anti-correlated first derivatives** of per-name
frequency time series over revs. One name falling as another rises is a
_substitution signature_; mere variance is not. It also discriminates against the
confound: file churn and author count move both names **together**, not in
opposition.

"By region" is real here — subtree, author/agent, and `docs/` vs `src/` (a term
appearing in prose first is being _proposed_; the reverse is code drifting ahead
of its docs). Anchor: Michel et al., _Culturomics_ (Science, 2011) / Google Books
Ngram Viewer — written corpora over time, and the **normalisation** problem
(corpus size grows, so raw counts mislead) is already solved there and must be
checked against our per-rev document count rather than assumed to transfer.

**Register: `proposed`, with a named falsifier** — find a strongly
anti-correlated cluster that is NOT a rename and the signal is weaker than
claimed. See design §2a.

## Disclosure is binding; the frost question is open

Per-agent naming attribution **must be disclosed**, riding the existing glass
halo + check-in surface (Aaron 2026-08-23). Undisclosed it is a dossier;
disclosed it is a game anyone can play — `dual-use-detection-is-neutral-oracle-decides`.
Three layers: **what** (observed, checkable) · **why** (self-declared agenda,
voluntary, first-person) · **inferred why** (never produced). Inherit
`docs/AGENDA.md` §Coercion disclosure (PR #2177) — a self-claim only carries
authority if freely declared, and **absence of an agenda is never evidence**.

**Open, deliberately not settled here:** is naming attribution
_required-for-role_ or _personal-and-frostable_
(`.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`)? Frosting it would mean
forgoing credit, since the naming eigenvector is how recognition accrues. A
governance call on an always-loaded rule — `.claude/rules/no-directives.md` says an agent brief
is not authorization to decide one.
