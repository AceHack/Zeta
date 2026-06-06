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
