---
id: 081M0AH5TQQ087G0R003CNFRAF
type: task
state: in-progress
priority: P2
slug: gyo-alpha-acyclicity-decision-procedure-over-attribute-cover
title: "GYO alpha-acyclicity decision procedure over attribute covers (Vorob'ev/BFMY criterion), with certificates"
created: 2026-08-18T13:32:36.471Z
depends_on: []
composes_with: []
---

# GYO alpha-acyclicity decision procedure over attribute covers (Vorob'ev/BFMY criterion), with certificates

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0AH5TQQ087G0R003CNFRAF-*.md` glob. -->

Ships a checkable implementation of the **alpha-acyclicity** criterion over an attribute cover, from
the literature find in
`docs/research/2026-08-17-path-independence-in-four-costumes-crdt-bell-holonomy-calm-literature-scout-verdict.md`.

**Criterion (BFMY, JACM 30(3):479, 1983):** a cover is alpha-acyclic iff every pairwise-consistent
instance over it has a universal relation. Whether local agreement forces global agreement is a
property of the SHAPE OF THE COVER, not of the merge operator.

**Delivered** — `src/Core.TypeScript/cover-acyclicity/`:

- `gyo.ts` — GYO reduction (Graham 1979; Yu & Ozsoyoglu 1979) with a join-tree certificate on the
  acyclic branch and a cyclic-core certificate on the other; both validated by checkers that never
  call GYO.
- `witness.ts` — the semantic half: pairwise consistency, natural join, global consistency, and a
  bounded exhaustive search for a locally-consistent / globally-inconsistent instance. It REFUSES
  rather than truncating when the space is too large.
- `repo-covers.ts` + `measure-repo-covers.ts` — extractors and the CLI that measures the real covers
  in this repo.
- 44 tests. The load-bearing one runs both sides of the biconditional independently over 382 small
  covers: 0 disagreements, with two sabotage controls that fail the same check.

**Register:** the BFMY statement is CHECKED by entailment; the Vorob'ev-condition equivalence is
CITED ONLY and nothing in the code depends on it; no claim is made about CRDTs, Bell inequalities,
or our merge algebra. Full disposition:
`docs/research/2026-08-18-the-shape-of-the-cover-decides-alpha-acyclicity-shipped-as-a-checkable-criterion.md`.

**Mutation-checked:** 11 of 14 mutants killed; 2 genuine test gaps found and healed; the 3 survivors
demonstrated equivalent over 200,000 random covers (0 differing verdicts).
