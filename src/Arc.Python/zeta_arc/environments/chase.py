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

#: ARC action ids we consume, mapped to a cell delta.
_MOVES: dict[int, tuple[int, int]] = {
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

    def __init__(self, seed: int = 0) -> None:
        super().__init__(
            game_id="zeta-chase",
            levels=[_build_level(i) for i in range(len(_WALLS))],
            win_score=len(_WALLS),
            available_actions=[
                GameAction.ACTION1,
                GameAction.ACTION2,
                GameAction.ACTION3,
                GameAction.ACTION4,
            ],
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
