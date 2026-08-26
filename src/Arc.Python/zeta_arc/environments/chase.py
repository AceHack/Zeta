"""ZetaChase — a real, runnable ARC-AGI-3 environment.

WHY THIS ENVIRONMENT. The arena we already have (`chip8/games/mutual-sim.ts`)
is a chase: an agent, a thing to reach, and walls that block. Authoring the
same *shape* as an ARC environment is what lets the perception ladder we
already built (blobs -> tracks -> relations -> mode) be pointed at ARC without
inventing a second agent. The point is not that this puzzle is hard; it is
that the loop is real end to end, offline, and scored.

DETERMINISM. `ARCBaseGame` takes a `seed`, and every placement here is a pure
function of the level index -- no `random` module, no clock. Same seed, same
game, every run (§7 DST / §13 noninterference).

Register: this is a Zeta-authored environment for developing against the
toolkit. It is NOT an ARC Prize environment and scores on it say nothing about
the leaderboard.
"""

from __future__ import annotations

from arcengine import ARCBaseGame, GameAction, Level, Sprite

#: The ARC frame is 64x64 (`Camera` defaults). We use a coarse cell so the
#: grid reads at a glance and a whole level fits in a few dozen actions.
CELL = 8
GRID = 8  # 8x8 cells == 64x64 pixels

#: Palette indices. ARC renders 16 colours; these three are simply distinct.
COLOR_AGENT = 9
COLOR_GOAL = 4
COLOR_WALL = 2


def _block(color: int) -> list[list[int]]:
    """One CELL x CELL solid square of `color`."""
    return [[color] * CELL for _ in range(CELL)]


#: Wall layouts per level, in CELL coordinates. Level 0 is an open room; each
#: later level adds structure, which is the ARC convention of introducing a new
#: mechanic per level rather than raising a difficulty dial.
_WALLS: tuple[tuple[tuple[int, int], ...], ...] = (
    (),
    ((3, 1), (3, 2), (3, 3), (3, 4)),
    ((2, 4), (3, 4), (4, 4), (5, 4), (5, 3), (5, 2)),
)

#: (agent, goal) start cells per level. Fixed, not sampled: a benchmark whose
#: start moves between runs cannot be replayed.
_STARTS: tuple[tuple[tuple[int, int], tuple[int, int]], ...] = (
    ((1, 1), (6, 6)),
    ((1, 1), (6, 1)),
    ((1, 1), (6, 6)),
)

#: ARC action ids we consume, mapped to a cell delta. Keyed by `GameAction`
#: because `self.action.id` IS one — the previous `dict[int, ...]` annotation
#: described neither the keys nor the lookup.
_MOVES: dict[GameAction, tuple[int, int]] = {
    GameAction.ACTION1: (0, -1),  # up
    GameAction.ACTION2: (0, 1),  # down
    GameAction.ACTION3: (-1, 0),  # left
    GameAction.ACTION4: (1, 0),  # right
}


def _build_level(index: int) -> Level:
    """Level `index` as sprites on an 8x8 cell grid."""
    (ax, ay), (gx, gy) = _STARTS[index]
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
    for wx, wy in _WALLS[index]:
        sprites.append(
            Sprite(
                pixels=_block(COLOR_WALL),
                name=f"wall_{wx}_{wy}",
                x=wx * CELL,
                y=wy * CELL,
                tags=["wall"],
            )
        )
    return Level(
        sprites=sprites, grid_size=(GRID * CELL, GRID * CELL), name=f"chase-{index}"
    )


class ZetaChase(ARCBaseGame):
    """Reach the goal. Four moves, walls block, each level adds structure."""

    #: How this environment builds each level. A HOOK, not a call, because
    #: `ARCBaseGame.__init__` clones its levels into `_clean_levels` and
    #: `handle_reset` restores from those — so a sprite added after construction
    #: is silently discarded, and a subclass has to influence level construction
    #: from INSIDE `__init__` or not at all. A staticmethod slot does that
    #: without monkeypatching a module global, which the first attempt tried and
    #: which made the wrapper call itself and recurse 1000 deep.
    _level_builder = staticmethod(_build_level)

    def __init__(self, seed: int = 0) -> None:
        super().__init__(
            game_id="zeta-chase",
            levels=[type(self)._level_builder(i) for i in range(len(_WALLS))],
            win_score=len(_WALLS),
            # PLAIN INTS, not GameAction members, and the distinction is not
            # cosmetic. `GameAction` is a plain `Enum` (NOT an `IntEnum`), so
            # `GameAction.ACTION1 == 1` is False, and the engine dispatches this
            # list through `match action: case 1 | 2 | 3 | 4 | 5:` — literal
            # patterns, compared by `==`. Passing members made every case fall
            # through, so `_get_valid_actions()` returned [] and this environment
            # advertised NO legal actions at all. Measured before the fix: [].
            available_actions=[a.value for a in _MOVES],
            seed=seed,
        )

    def step(self) -> None:
        """Apply one action, then declare it resolved.

        `step` is the engine's documented hook ("The engine will keep calling
        step ... until the action is complete"). `complete_action()` is not
        optional bookkeeping: forget it and the engine spins forever, which
        is why `driver.advance` bounds the loop and raises instead.
        """
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
        nx = agent.x + dx * CELL
        ny = agent.y + dy * CELL

        # Bounds: the room is closed, so a move into the edge is simply refused
        # (it still costs an action -- the score denominator is action count).
        if not (0 <= nx <= (GRID - 1) * CELL and 0 <= ny <= (GRID - 1) * CELL):
            self.complete_action()
            return

        # The ENGINE moves the sprite and reports collisions. Sprite positions
        # are read-only by design, which is how it keeps its own collision
        # index honest — so walls block here without us re-implementing
        # geometry, and the goal is `collidable=False` precisely so REACHING
        # it is not a collision.
        self.try_move_sprite(agent, dx * CELL, dy * CELL)

        for goal in level.get_sprites_by_tag("goal"):
            if goal.x == agent.x and goal.y == agent.y:
                self.next_level()
                break

        self.complete_action()


# ─── ZetaChaseDecoy: the same levels, plus a competitor ──────────────────────
#
# WHY A SECOND ENVIRONMENT RATHER THAN A CHANGE TO THE FIRST. Measured
# 2026-08-26: across 40 ticks of `ZetaChase` seed 4 the pixel agent perceives 4
# distinct components and exactly ONE that ever moves. The body election
# therefore has no competitor, and twelve mutations to the agent's decision
# machinery — disabling the ageing, the commit gate in both directions, the
# conservative ranking, the Kalman gain, the inert-suppression release — leave
# the environment score at EXACTLY 0.354. Only one of the twelve moves it.
#
# That makes `ZetaChase` a fine regression guard and a useless discriminator, so
# it is kept unchanged and this is added ALONGSIDE it. Nothing about the 0.354
# pin moves; agent work simply gains an instrument that can see it.
#
# Full measurement, both tables, and the defect it exposed in the dynamics-factor
# ageing: `docs/research/2026-08-26-zetachase-cannot-see-the-agent-*.md`.

#: Free in this palette — goal 4, background 5, agent 9, wall 2.
COLOR_DECOY = 7

#: The decoy's route: fixed, seed-independent, and therefore DST-replayable. It
#: is deliberately NOT a function of the commanded action — a decoy that moved
#: WITH the command would be a second body and would make the task ambiguous
#: rather than harder.
_DECOY_CYCLE: tuple[tuple[int, int], ...] = ((1, 0), (1, 0), (-1, 0), (-1, 0))


def _build_level_with_decoy(index: int) -> Level:
    """Level `index`, plus one decoy in the first free cell.

    `collidable=False` is load-bearing, not incidental: a collidable decoy would
    wander into the agent's path and change which levels are solvable in how
    many actions, so the two environments would no longer share
    `optimal_actions` and their scores would stop being comparable. The decoy is
    a PERCEPTUAL competitor and nothing else.
    """
    level = _build_level(index)
    occupied = {(s.x // CELL, s.y // CELL) for s in level.get_sprites()}
    for cy in range(GRID - 1, -1, -1):
        for cx in range(GRID):
            if (cx, cy) not in occupied:
                level.add_sprite(
                    Sprite(
                        pixels=_block(COLOR_DECOY),
                        name="decoy",
                        x=cx * CELL,
                        y=cy * CELL,
                        tags=["decoy"],
                        collidable=False,
                    )
                )
                return level
    return level


class ZetaChaseDecoy(ZetaChase):
    """`ZetaChase` with one independently-moving distractor.

    Same walls, same starts, same win condition, same `optimal_actions` — so a
    score here is comparable to a score there, and the only difference is that
    the body election now has something to get wrong.
    """

    _level_builder = staticmethod(_build_level_with_decoy)

    def __init__(self, seed: int = 0) -> None:
        super().__init__(seed=seed)
        self._decoy_tick = 0

    def step(self) -> None:
        super().step()
        decoys = self.current_level.get_sprites_by_tag("decoy")
        if not decoys:
            return
        decoy = decoys[0]
        dx, dy = _DECOY_CYCLE[self._decoy_tick % len(_DECOY_CYCLE)]
        self._decoy_tick += 1
        nx, ny = decoy.x + dx * CELL, decoy.y + dy * CELL
        if 0 <= nx <= (GRID - 1) * CELL and 0 <= ny <= (GRID - 1) * CELL:
            self.try_move_sprite(decoy, dx * CELL, dy * CELL)
