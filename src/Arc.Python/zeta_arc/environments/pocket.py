"""ZetaPocket — a local world where the agent must move AWAY from the goal.

WHAT THIS WAS BUILT FOR, AND WHAT IT ACTUALLY FOUND
---------------------------------------------------
It was built to reproduce the bootstrap trap (081M0YH0S80087G0R001KCAMJS)
locally, because neither existing environment can: `ZetaChase` and
`ZetaDiscovery` both answer on the first action, so `PixelAgent._step_px`
calibrates immediately and the trap is unreachable. Measured 2026-08-26:
`_step_px` 1.0 and 8.0 respectively, and an A/B of the fix was byte-identical
on both.

**It does not reproduce that trap either, and this docstring said it did until
the trace was read.** `_route_plan` routes around the pocket from the very
first frame — perception already sees the walls as components — so the agent
escapes before calibration is ever needed. Recorded rather than quietly
rewritten, because "the environment I built to test my fix does not test my
fix" is the kind of thing that otherwise gets discovered twice.

WHAT IT DID FIND, which is why it is kept: a DIFFERENT deadlock, on level 1,
present long before the trap fix and unaffected by it. At cell (7,1) with both
real walls already learned by bumping:

    blocked = [(6,1), (7,2)]   plan = 0   ->   ACTION3 x382 of 400 actions

The agent knew both obstacles and walked into one of them for the rest of the
episode, because `blocked` was written by `_note_blocked_cell` and read only by
`_route_plan` — the greedy fallback never consulted it. Fixed in `agent.py`;
this environment is the regression instrument for that fix.

HONEST STATE. With greedy consulting `blocked`, level 1 is still not solved:
the wall-hammer becomes a two-cycle (ACTION1 x198 / ACTION2 x193) between two
open cells, which is the oscillation the `_plan` commitment comment already
warns about. Better — the agent no longer walks into a mapped wall, and
`distinct_grids` rises 15 -> 16 — but not solved, and this file does not claim
otherwise.

Register: Zeta-authored, for developing against the toolkit. NOT an ARC Prize
environment; scores here say nothing about the leaderboard.
"""

from __future__ import annotations

from arcengine import ARCBaseGame, GameAction, Level, Sprite

from zeta_arc.environments.chase import (
    CELL,
    COLOR_AGENT,
    COLOR_GOAL,
    COLOR_WALL,
    GRID,
    _block,
)

#: Deltas, duplicated from `chase` deliberately: this environment's mechanics
#: are its own contract, and a shared mutable mapping would let a change there
#: silently redefine what "blocked" means here.
_MOVES: dict[GameAction, tuple[int, int]] = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}

#: Each entry is (agent, goal, walls). The walls are chosen against the greedy
#: rule in `PixelAgent.act` — `max(moves, key=dx*vx + dy*vy)`, ties resolved by
#: lowest action id — so that the FIRST choice and the runner-up are both solid
#: and the only opening points away from the goal.
_LEVELS: tuple[
    tuple[tuple[int, int], tuple[int, int], tuple[tuple[int, int], ...]], ...
] = (
    # Greedy from (0,6) to (6,1) is RIGHT (dx=+6 beats dy=-5); up is the
    # runner-up. Both walled; the way out is DOWN, directly away from the goal.
    ((0, 6), (6, 1), ((1, 6), (0, 5))),
    # Mirrored, so a fix cannot pass by favouring one direction: greedy from
    # (7,1) to (1,6) is LEFT, runner-up DOWN. Both walled; the way out is UP.
    ((7, 1), (1, 6), ((6, 1), (7, 2))),
)


def _build_level(index: int) -> Level:
    (ax, ay), (gx, gy), walls = _LEVELS[index]
    sprites: list[Sprite] = [
        Sprite(
            pixels=_block(COLOR_GOAL),
            name="goal",
            x=gx * CELL,
            y=gy * CELL,
            tags=["goal"],
            collidable=False,
        ),
        Sprite(
            pixels=_block(COLOR_AGENT),
            name="agent",
            x=ax * CELL,
            y=ay * CELL,
            tags=["agent"],
        ),
    ]
    sprites.extend(
        Sprite(
            pixels=_block(COLOR_WALL),
            name=f"wall_{wx}_{wy}",
            x=wx * CELL,
            y=wy * CELL,
            tags=["wall"],
        )
        for wx, wy in walls
    )
    return Level(
        sprites=sprites, grid_size=(GRID * CELL, GRID * CELL), name=f"pocket-{index}"
    )


class ZetaPocket(ARCBaseGame):
    """Reach the goal from a pocket whose exit points away from it."""

    def __init__(self, seed: int = 0) -> None:
        super().__init__(
            game_id="zeta-pocket",
            levels=[_build_level(i) for i in range(len(_LEVELS))],
            win_score=len(_LEVELS),
            # PLAIN INTS. `GameAction` is a plain `Enum`, not an `IntEnum`, and
            # the engine dispatches on literal patterns — passing members makes
            # every case fall through and the environment advertises NO legal
            # actions. Measured on `ZetaChase` before its fix: [].
            available_actions=[a.value for a in _MOVES],
            seed=seed,
        )

    def step(self) -> None:
        action_id = self.action.id
        if action_id == GameAction.RESET:
            self.handle_reset()
            self.complete_action()
            return

        delta = _MOVES.get(action_id)
        if delta is None:
            self.complete_action()
            return

        level = self.current_level
        agents = level.get_sprites_by_tag("agent")
        if not agents:
            self.complete_action()
            return
        agent = agents[0]

        dx, dy = delta
        nx, ny = agent.x + dx * CELL, agent.y + dy * CELL
        # A move into the edge is refused and still costs an action — the score
        # denominator is action count, so a wall and an edge cost the same.
        if not (0 <= nx <= (GRID - 1) * CELL and 0 <= ny <= (GRID - 1) * CELL):
            self.complete_action()
            return

        self.try_move_sprite(agent, dx * CELL, dy * CELL)
        for goal in level.get_sprites_by_tag("goal"):
            if goal.x == agent.x and goal.y == agent.y:
                self.next_level()
                break
        self.complete_action()
