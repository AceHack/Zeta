---
id: 081KTHX4TBR08QG0R001ZQK48A
type: task
state: backlog
priority: P2
slug: erasure-coding-evaluate-adinkra-doubly-even-ecc-vs-microsoft
title: "Erasure coding: evaluate Adinkra doubly-even ECC vs Microsoft Azure LRC (Local Reconstruction Codes, Huang et al. 2012); copy LRC's local-repair idea into the distributed-ECC-across-network (081KTH...). Benchmark before claiming better."
created: 2026-06-07T20:42:16.312Z
depends_on: []
composes_with: []
---

# Erasure coding: evaluate Adinkra doubly-even ECC vs Microsoft Azure LRC (Local Reconstruction Codes, Huang et al. 2012); copy LRC's local-repair idea into the distributed-ECC-across-network (081KTH...). Benchmark before claiming better

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTHX4TBR08QG0R001ZQK48A-*.md` glob. -->

## Purpose

Aaron 2026-06-07: *"I imagine our [erasure] coding is better than Microsoft's erasure coding? we should copy
that idea from the paper anyways."* Evaluate our **Adinkra** ECC (doubly-even binary linear codes,
`AdinkraCode.fs`, 081KRW63S0008QG0R000QJR08H; the distributed-ECC-across-network thread #6890) against **Microsoft Azure's LRC**
(*Erasure Coding in Windows Azure Storage*, Huang et al., USENIX ATC 2012) and **copy LRC's idea regardless**.

## What LRC brings (the idea to copy)

- **Local Reconstruction Codes** add **local parity groups** so a single lost fragment is reconstructed by
  reading only a *small local set* (not all data fragments) — cheap, common-case repair — while global parities
  still cover multi-failure. Optimizes the dominant cost (single-node repair) over classic Reed-Solomon.
- Maps onto the geospatial **network map** (#6889): place local-parity groups by network locality so repair
  reads stay local (nearest fragments), with global parity spanning regions.

## Honest scope (peel)

- **Do NOT claim "better than Microsoft" unmeasured.** Adinkra codes are doubly-even (algebraically elegant,
  tie to the hypercomplex/SUSY structure); LRC is repair-cost-optimized and battle-tested at exabyte scale.
  Different optimization targets. **Benchmark** (storage overhead, repair read-cost, fault tolerance) before any
  comparative claim.
- Action: (1) read the LRC paper; (2) characterize Adinkra ECC's repair cost; (3) adopt LRC-style local-parity
  grouping into the distributed-ECC placement (#6890) over the geospatial network map; (4) bench Adinkra vs
  RS vs LRC on (overhead, repair-reads, tolerance).

composes_with: Adinkra (AdinkraCode.fs, 081KRW63S0008QG0R000QJR08H), distributed-ECC-across-network (#6890), geospatial network
map (#6889 / 081KTG5C91H0...), the reversible covenant. Anchors: Huang et al. 2012 (Azure LRC); Reed-Solomon;
doubly-even codes.
