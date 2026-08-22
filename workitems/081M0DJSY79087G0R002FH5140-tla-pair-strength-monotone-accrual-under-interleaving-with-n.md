---
id: 081M0DJSY79087G0R002FH5140
type: task
state: backlog
priority: P2
slug: tla-pair-strength-monotone-accrual-under-interleaving-with-n
title: "TLA+: pair-strength monotone accrual under interleaving, with no local clock in the shared fold (claim 4)"
created: 2026-08-19T17:58:47.273Z
depends_on: []
composes_with: []
---

# TLA+: pair-strength monotone accrual under interleaving, with no local clock in the shared fold (claim 4)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DJSY79087G0R002FH5140-*.md` glob. -->

**Routed by Soraya, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §5 (C4).**

**Property class:** concurrency / temporal. **Primary tool: TLA+ / TLC** — this one genuinely is TLC's row: the interesting failure is an interleaving where two nodes at different observed phases disagree about a pair's strength.

**Check:** pair strength is monotone non-decreasing across mutual-observation steps under arbitrary interleaving, **and** does not strengthen from one party's steps alone (the mutuality requirement is the content; a one-sided accrual is forgeable by a fresh identity).

**Guard — `local-time-never-enters-the-shared-fold`.** Strength must be a pure function of `(observation set, agreed phase)`. Reuse `KeyCustody.PhaseWindow` / `TravelerFrame.Frame` rather than inventing a clock. Litmus: if two nodes with different receive-times could fold different sets, local time has leaked.

**Do NOT model the strength arithmetic in TLC** — split it to `081M0DJSY48087G0R001GVG3AT`, or TLC enumerates real arithmetic it cannot represent.

**Cross-check:** the noninterference half is a lexical property and routes to Semgrep (`081M0DJSY88087G0R002JTPWKQ`).
