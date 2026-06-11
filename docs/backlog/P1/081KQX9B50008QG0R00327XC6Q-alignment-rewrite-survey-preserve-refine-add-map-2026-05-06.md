---
id: B-0215
zetaid: 081KQX9B50008QG0R00327XC6Q
priority: P1
status: closed
closed: 2026-05-07
closed_by: "survey at docs/research/2026-05-07-alignment-md-rewrite-survey-b0215.md (PR #1943)"
title: "ALIGNMENT.md rewrite survey - preserve/refine/add map"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0003
depends_on: []
classification: buildable-now
---

# B-0215 - ALIGNMENT.md rewrite survey

Survey the current `docs/ALIGNMENT.md` structure before
editing it. The output is a compact preserve/refine/add map
that lets later rewrite rows make precise changes without
weakening the existing alignment floor.

## Why this comes first

B-0003 currently mixes several conceptual asks with an
existing 1000+ line contract. The first safe action is not
to rewrite the contract. It is to map what already exists,
especially the HC / SD / DIR clauses and the existing
bidirectional-alignment section, so later edits know which
clauses to preserve, refine, or add.

## Acceptance criteria

- A short research or design note records the existing
  `docs/ALIGNMENT.md` headings and assigns each to
  preserve / refine / add / remove.
- The note identifies every section needed by B-0216
  through B-0223.
- The note explicitly calls out existing bidirectional
  alignment text so B-0217 starts from current substrate,
  not from the stale assumption that the clause is absent.
- No policy text is changed in `docs/ALIGNMENT.md` in this
  row.
