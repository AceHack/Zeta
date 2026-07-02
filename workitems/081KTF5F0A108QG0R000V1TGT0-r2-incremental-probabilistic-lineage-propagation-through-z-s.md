---
id: 081KTF5F0A108QG0R000V1TGT0
type: task
state: backlog
priority: P2
slug: r2-incremental-probabilistic-lineage-propagation-through-z-s
title: "R2: incremental probabilistic lineage propagation through Z-set deltas (incl retraction)"
created: 2026-06-06T19:09:55.393Z
depends_on: []
composes_with: []
---

# R2: incremental probabilistic lineage propagation through Z-set deltas (incl retraction)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF5F0A108QG0R000V1TGT0-*.md` glob. -->

## DEFERRED — after the persistence/speed/durability subsystem (maintainer 2026-06-06)

Research-grade open problem. See vision doc §6(2).

**Problem:** Probabilistic query evaluation is #P-complete in general (Dalvi–Suciu dichotomy),
tractable only for "safe" plans. Maintaining a probability/lineage annotation INCREMENTALLY
through DBSP operators — including retraction (+1 then −1 must also retract its lineage
contribution) — is unsolved. Restrict to safe plans expressed as incremental operators.

**Anchors:** Dalvi–Suciu #P dichotomy; Olteanu PDB tutorial (safe plans, lineage); MayBMS
U-relations; Trio lineage; Budiu et al. DBSP (VLDB 2023). Owner: TBD (DBSP + PDB).

## SAFE-FRAGMENT SLICE DONE (2026-07-02, Otto) — general problem still deferred

Aaron authorized the bounded slice 2026-07-02 ("build the safe-fragment slice").
The general #P problem stays DEFERRED behind the persistence subsystem (unchanged);
what landed is the safe-plan piece the atom made buildable:

- `src/Core/Provenance.fs`: how-provenance as the FREE COMMUTATIVE RING ℤ[X]
  (`ProvenancePoly` = monomials→int64 coeff), `ProvenanceRing : IRing`. The ℤ[X]
  choice (not GKT's absorptive ℕ[X] semiring) is what makes retraction work —
  `Negate` exists, so `p ⊕ (−p) = 0` cancels a derivation exactly.
- Lineage now rides `ZSetW<'K, ProvenancePoly>`; DBSP incrementality propagates it
  and RETRACTS it by construction (a −1 delta carries −provenance; a join's a⊗b
  retracts to ∅ when base a is retracted — both pinned as tests).
- 6 tests incl. the ring-law property and the two retraction payoffs. NOT a claim
  to solve probabilistic eval in general (Dalvi–Suciu #P); this is the safe
  fragment only, and unsafe-plan probability is out of scope by design.

Anchors: Green–Karvounarakis–Tannen 2007 (provenance semirings — extended to a
ring here for retraction); Budiu et al. DBSP; 081KWG9JQ9H (IRing = retraction tier).
