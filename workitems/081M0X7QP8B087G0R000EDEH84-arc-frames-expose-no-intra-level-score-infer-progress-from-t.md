---
id: 081M0X7QP8B087G0R000EDEH84
type: task
state: backlog
priority: P2
slug: arc-frames-expose-no-intra-level-score-infer-progress-from-t
title: "ARC frames expose no intra-level score - infer progress from the grid instead"
created: 2026-08-25T19:53:10.155Z
depends_on: []
composes_with: []
---

# ARC frames expose no intra-level score - infer progress from the grid instead

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X7QP8B087G0R000EDEH84-*.md` glob. -->

## The finding (checked, not inferred)

The first hosted sweep — `arc-lane` run 32890789367 on `main` @ `1805a39a`,
2026-08-25 — played all 25 hosted environments: `seen=25 played=25 failed=0`,
~2,789 actions, **1 level cleared out of 183 declared**, mean environment score
`0.0`. The `ended` breakdown is the informative part:

| reason | count |
|---|---|
| `game-over` | 22 |
| `level-budget` | 3 |
| `cleared` | 1 |

So the agent **loses**; it does not run out of budget. The 200-action CI ceiling
was not the binding constraint — level-0 references on this roster run 7–78, so
the ceiling sat at roughly 2.5x the largest of them.

## Why the obvious instrument does not exist

Every one of those 22 `game-over` rows is byte-identical (`solved=False,
score=0.0`). A policy that never engaged the level and one that died a step from
winning are indistinguishable, and they call for opposite fixes. The natural
instrument is the engine's own score. It is **not reachable**:

- `arcengine/base_game.py` holds `_score`/`_win_score` and passes
  `score=`/`win_score=` when constructing the frame;
- but neither `FrameData` nor `FrameDataRaw` (`arcengine/enums.py:131,149`)
  **declares** those fields, and pydantic drops unknown kwargs silently;
- the frame an agent receives carries `levels_completed` and `win_levels` and
  nothing finer.

The engine measures intra-level progress and never transmits it. A `game_score`
field on `LevelResult` was written, run, and **reverted**: it read `None` in
production and in every test, which is a progress record that constrains
nothing. The reasoning is recorded at the `GameState.GAME_OVER` branch in
`zeta_arc/hosted.py` so the next reader does not re-derive it.

Related, checked while confirming the above: `GAME_OVER` has exactly **one**
assignment site in the engine, `lose()` at `base_game.py:303`. There is no
engine-level action cap. The clustering of loss counts at 50/64/100/128/200
across environments is a coincidence of counts, not an identification — any
action-triggered loss is per-game logic calling `lose()`, and deciding which
happened needs the downloaded game files.

## The actual work

Intra-level progress must be **inferred from the grid** by our own perception
layer, not read from the API. That is a perception task, not a field.
