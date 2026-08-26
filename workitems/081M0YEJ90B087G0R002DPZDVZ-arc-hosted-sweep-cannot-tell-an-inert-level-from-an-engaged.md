---
id: 081M0YEJ90B087G0R002DPZDVZ
type: task
state: backlog
priority: P2
slug: arc-hosted-sweep-cannot-tell-an-inert-level-from-an-engaged
title: "ARC hosted sweep cannot tell an inert level from an engaged one - infer intra-level progress from the grid"
created: 2026-08-26T07:11:47.211Z
depends_on: []
composes_with: []
---

# ARC hosted sweep cannot tell an inert level from an engaged one - infer intra-level progress from the grid

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0YEJ90B087G0R002DPZDVZ-*.md` glob. -->

## The defect

After the first hosted sweep (2026-08-25), **22 of 25 environments ended in
`GAME_OVER` on level 0**, and every one of those rows was byte-identical:
`solved=False, score=0.0`.

A policy that **never engaged the level** and one that **died a step from
winning** produce the same record — and they call for *opposite* fixes. One
needs a perception or legal-action fix; the other needs a bigger budget or a
better policy. The sweep could not tell an operator which.

## Why this is perception and not a field

The obvious instrument is the engine's own score. It is **not reachable**:
`arcengine.base_game` holds `_score`/`_win_score` and passes `score=`/
`win_score=` when it builds the frame, but neither `FrameData` nor
`FrameDataRaw` **declares** those fields, and pydantic drops unknown kwargs
silently. A `game_score` read here would be `None` in production and in every
test forever — a progress record that constrains nothing.

So the engine measures intra-level progress and never transmits it. Progress has
to be **inferred from the grids we are handed**.

## What shipped

`src/Arc.Python/zeta_arc/progress.py` — `LevelProbe`, two counts per level:

- `distinct_grids` — how many DIFFERENT world states the level showed. A policy
  hammering an illegal action sees one grid forever. Separates *engaged* from
  *inert*.
- `cells_changed` — cumulative Hamming distance between consecutive grids. A
  shape change counts as a full-grid difference rather than zipping to the
  overlap, which would under-report exactly when the world changed most.

Both land on `LevelResult` and roll up as `inert_levels` and
`cells_changed_total`, printed per environment by the sweep.

## Register: `unmetered`, deliberately

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`. It has a falsifier
that it **discriminates**, but no anchor tying either count to the engine's true
intra-level score — because that score is not transmitted, so no such anchor can
currently exist. It is **not** named `progress_score`: it does not claim to be
one, and a name implying a score is how an unanchored count gets cited as
evidence later.

**Honest limit:** neither count is monotone in "closeness to winning". A level
that must be *restored* to an earlier state scores high on `cells_changed` for
going backwards. It answers "did this policy engage this world at all" — the
question the byte-identical rows could not answer — not "how close was it".

## Falsifiers

- §"the probe separates an INERT level from an ENGAGED one" — a frozen world vs
  a changing one through the **same** probe; asserts the separation as a
  comparison, so equalising the two by any means fails. Also pins the ragged/
  resized case and that `reset()` does not carry engagement across levels.
- The real-environment row now asserts `distinct_grids == 17`,
  `cells_changed == 15360` on ZetaDiscovery — measured, not invented. That row
  records a policy that **engaged and still lost**, which is exactly the case
  that used to be indistinguishable from inertia.

Break-red: collapsing `cells_changed` to a constant fails **both** tests.

`ARC_MIN_TESTS` 87 → 88.
