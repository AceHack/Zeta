---
id: 081KTF5F09C08QG0R0008G5Z61
type: task
state: backlog
priority: P2
slug: r1-mrdt-three-way-merge-for-uncertain-softvalue-cells-crdt-l
title: "R1: MRDT three-way merge for uncertain/SoftValue cells (CRDT-lawful, idempotent)"
created: 2026-06-06T19:09:55.372Z
depends_on: []
composes_with: []
---

# R1: MRDT three-way merge for uncertain/SoftValue cells (CRDT-lawful, idempotent)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF5F09C08QG0R0008G5Z61-*.md` glob. -->

## DEFERRED — after the persistence/speed/durability subsystem (maintainer 2026-06-06)

Research-grade open problem (no canonical theory in the literature). See
`docs/research/2026-06-06-zeta-relativistic-agent-database-vision.md` §6(1).

**Problem:** MRDT three-way merge `merge(σ_lca, σ_a, σ_b)` is defined for deterministic state.
For a `SoftValue` / probability-distribution cell, the LCA-relative merge must combine
*distributions* while staying commutative / associative / idempotent.

**Head start we have:** `BeliefConvergence` proves independent-evidence Bayesian observe COMMUTES
(pointwise multiply). But Bayesian update is NOT idempotent (re-merge double-counts) — so the
merge needs either an idempotency/dedup key (discipline #6) OR an LCA-relative "subtract the
common prior" using `Zeta.Bayesian` natural-parameter `divide` (EP cavity). That divide is the
likely key: merge = a_nat + b_nat − lca_nat (natural-parameter three-way merge).

**Anchors:** MRDT (Kaki et al., OOPSLA 2019); Certified MRDTs (arXiv 2203.14518); `SoftValue.fs`,
`BeliefConvergence.fs`, `Zeta.Bayesian` message algebra (product/divide/uniform).
Owner: uncertainty/Bayesian lane (TBD).
