---
id: B-0219
zetaid: 081KQX9B50008QG0R0026EHVW2
priority: P1
status: open
title: "ALIGNMENT.md rewrite - DST empirical-rigor and falsification floor"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0003
depends_on: [B-0205, B-0215]
classification: buildable-after-survey
type: friction-reducer
---

# B-0219 - DST empirical-rigor and falsification floor

Add the Otto-285 / Otto-281 empirical-rigor floor to
`docs/ALIGNMENT.md`: alignment claims must produce
observable signals, falsification hooks, and revisiting
conditions.

## Work scope

This row turns the rewrite from declaration into
measurement discipline. Any new alignment claim should say
what evidence would count for it, what evidence would count
against it, and which mechanism keeps the project from
confusing agreement with truth.

## Acceptance criteria

- New or revised alignment claims include falsification or
  revisit conditions.
- The text references the existing measurability section
  instead of duplicating it.
- The section makes clear that agreement is signal, not
  proof.
- The work composes with B-0205 rather than inventing a
  second measurement framework.
