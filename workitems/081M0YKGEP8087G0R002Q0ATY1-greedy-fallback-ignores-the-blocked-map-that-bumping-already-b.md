
## The defect

`_note_blocked_cell` learns walls by bumping and writes them to `self.blocked`.
Only `_route_plan` ever read that map. The greedy fallback — which runs whenever
the router returns no plan — chose by heading alone:

```python
action = max(moves, key=lambda a: ACTION_VECTORS[a][0] * dx + ACTION_VECTORS[a][1] * dy)
```

So a move into a cell the agent had *already mapped as solid* was fully
eligible, and once chosen it repeated forever: the body does not move, so
`(dx, dy)` is unchanged, so `max` returns the same action next tick.

## Measured on `ZetaPocket` level 1

```
cell (7,1)   blocked = [(6,1), (7,2)]   plan = 0
  -> ACTION3 x382 of 400 actions   (95.5% of the episode)
```

Both walls in `blocked` are real and correctly learned. The agent walked into
one of them for the rest of the episode. The way out — up, to (7,0) — scores
lower on the heading and was therefore unreachable by argmax.

## Found by building the environment, not by reading the code

`ZetaPocket` was built to reproduce a *different* bug (the bootstrap trap,
081M0YH0S80087G0R001KCAMJS) and **failed to** — `_route_plan` routes around the
pocket from the first frame. It surfaced this instead. The environment is kept
as the regression instrument for what it actually found, and its docstring says
plainly that it does not test what it was built for.

That is the case for local instruments generally: the 1-second loop found a
382-action deadlock that no unit test was looking for.

## Honest state after the fix

Level 1 is **still not solved**. The wall-hammer becomes a two-cycle:

| | top action | share |
|---|---|---|
| before | `ACTION3` x382 | 95.5% |
| after | `ACTION1` x198 / `ACTION2` x193 | 49.5% |

`distinct_grids` 15 -> 16. Strictly better — the agent no longer walks into a
mapped wall — and strictly not solved. The oscillation is the failure the
`_plan` commitment comment already names: replanning against an optimistic map
produces a two-cycle, and the real repair is making `_route_plan` succeed here
rather than widening the fallback again.

## Falsifiers

- `test_the_agent_stops_walking_into_a_wall_it_has_already_mapped` — episode
  share of the top action under 60% (pre-fix: 95.5%).
- `test_greedy_never_chooses_a_move_into_a_cell_it_believes_is_solid` — the
  decision itself, because a share assertion can pass for the wrong reason: an
  agent oscillating between two useless moves also spreads its budget.

Both go red when greedy stops consulting `blocked`.

## Follow-up: the oscillation, and its actual cause

The greedy-vs-blocked fix left a two-cycle on `ZetaPocket` level 1. The cause was
not the router's search — it was its input:

```
me cell: (7,0)   target cells: [(6,1), (7,2), (1,6)]
blocked: [(0,5), (1,6), (6,1), (7,2)]
goals after removing blocked: []          ->  _route_plan returns EMPTY
```

**`(1,6)` is a WALL on level 0 and the GOAL on level 1.** The occupancy map is
supposed to be cleared on a level change by `_world_changed_under_me`, which
fires when the body moves more than one cell in a tick. Level 0's goal `(6,1)`
and level 1's start `(7,1)` are **adjacent**, so the transition is
indistinguishable from one legal move and the detector stays silent. The agent
entered level 1 believing its own goal was a wall, the router returned nothing
every tick, and greedy oscillated for the rest of the episode.

**The repair is to the consequence, not the detector:** a map on which every
candidate target is solid cannot be true of a world the agent is standing in and
being scored on, so the belief gives way rather than the world. `blocked` is
dropped and rebuilt by bumping — the price this agent already pays for not being
handed the map.

The detector remains genuinely unreliable, and that is named in the code rather
than worked around: one cell of displacement cannot distinguish "I moved" from
"I was placed". A frame-level signal (`levels_completed`) exists but is not
passed to `PixelAgent`, which sees only a grid.

## Result

| | before | after |
|---|---|---|
| `ZetaPocket` levels completed | 1 of 2 | **2 of 2** |
| `ZetaPocket` distinct_grids | 16 | 29 |
| `ZetaChase` level 2 | 24 actions, 0.1736 | 22 actions, 0.2066 |
| `ZetaChase` environment score | 0.3375 | **0.354** |

Levels 0 and 1 of `ZetaChase` are byte-identical; all three still solve.

The pinned score in `test_play_mode.py` moved because the agent got better, not
because the guard got weaker — updated with the reason rather than loosened to
an inequality that would stop noticing regressions.

## A test that measured the wrong thing

Both `ZetaPocket` assertions failed on the run that went from 1 solved level to
2. The harness looped a fixed 400 ticks, so once the environment was won the
agent idled ~376 of them on one action and the share statistic measured
*boredom*, not the deadlock. The harness now stops at completion.
