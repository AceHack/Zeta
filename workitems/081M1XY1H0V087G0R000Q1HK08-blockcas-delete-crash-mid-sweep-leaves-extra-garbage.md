---
id: 081M1XY1H0V087G0R000Q1HK08
type: task
state: backlog
priority: P2
slug: blockcas-delete-crash-mid-sweep-leaves-extra-garbage
title: "BlockCas Delete crash-mid-sweep leaves extra garbage"
created: 2026-09-07T12:38:42.971Z
depends_on: []
composes_with: []
---

# BlockCas Delete crash-mid-sweep leaves extra garbage

PR12 peel: `BlockCas.ArmCrashOnDelete` unpublishes the matching key then
throws. `reclaimTick` on a BlockStore volume leaves remaining garbage,
not a missing live freeze. Resume deletes the rest. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1XY1H0V087G0R000Q1HK08-*.md` glob. -->
