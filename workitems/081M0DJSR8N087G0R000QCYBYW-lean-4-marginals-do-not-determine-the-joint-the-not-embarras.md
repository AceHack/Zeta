---
id: 081M0DJSR8N087G0R000QCYBYW
type: task
state: backlog
priority: P2
slug: lean-4-marginals-do-not-determine-the-joint-the-not-embarras
title: "Lean 4: marginals do not determine the joint -- the not-embarrassingly-parallel impossibility for witnessed self-claims"
created: 2026-08-19T17:58:41.173Z
depends_on: []
composes_with: []
---

# Lean 4: marginals do not determine the joint -- the not-embarrassingly-parallel impossibility for witnessed self-claims

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DJSR8N087G0R000QCYBYW-*.md` glob. -->

**Routed by Soraya, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §5 (C3a).**

**Property class:** algebraic / information-theoretic identity. **Primary tool: Lean 4 + Mathlib** — the statement ships in papers, and the ladder is already in-repo.

**Obligation.** Exhibit two joint distributions over a finite alphabet with *identical marginals* and different mutual information, then show that any functional of the marginals alone is constant on the Frechet family. Consequence: no `(v, +)` pair — per-claim verification `v` plus commutative-monoid aggregation — can distinguish N independent witnesses from N witnesses that are one source replicated.

**Build on, do not re-derive:** `src/Core.Lean4/Lean4/FinMutualInfoNonneg.lean`, `FinConditionalEntropy.lean`, `FinDataProcessing.lean`, `DecorrelationDpi.lean`, `FinShannonEntropy.lean`.

**Checked anchors:** Shannon 1948; Hoeffding 1940 / Frechet 1951 (the bounds on joints with fixed marginals); Sklar 1959 (marginals + copula decomposition).

**Why not Z3:** the statement quantifies over distributions; a first-order encoding of "for all joints with these marginals" is where SMT returns `unknown`. **Why not TLC:** TLA+ has no reals — see the `QuorumPhaseCancellation.tla` header, which establishes this precedent in-repo.

**Gate:** `.github/workflows/lean-proof.yml` (sorryAx audit + anti-vacuity "Unknown constant" guard).
