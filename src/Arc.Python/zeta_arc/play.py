"""Play a ZetaChase episode offline and report an ARC-shaped score.

Run:
    uv run --project src/Arc.Python python -m zeta_arc.play
    uv run --project src/Arc.Python python -m zeta_arc.play --agent random --seed 4

NO KEY, NO NETWORK. `OperationMode.OFFLINE` is MEASURED to initialise with
`arc_api_key=''` and never contact the API, so this lane runs on a laptop, in
CI, and in a container with egress blocked. `ARC_API_KEY` only matters for the
hosted leaderboard, and its absence must DEGRADE, never fail.

THE SCORE, and what it is not. ARC's level formula (design doc §6) is

    S(level) = min(1.0, h/a)**2

with `a` the agent's action count and `h` a reference count. ARC uses the
SECOND-BEST HUMAN for `h`. Offline we have no humans, so `h` here is the
OPTIMAL path length computed by breadth-first search over the level's own
geometry. That substitution is stated rather than hidden: it makes this an
efficiency-against-perfect-play number, strictly harsher than ARC's, and
**not comparable to a leaderboard figure**.
"""

from __future__ import annotations

import argparse
import json
from collections import deque

from arc_agi import Arcade, OperationMode
from arcengine import GameAction

from zeta_arc.agent import PixelAgent
from zeta_arc.driver import advance, reset
from zeta_arc.environments.chase import _MOVES, _STARTS, _WALLS, CELL, GRID, ZetaChase

#: Fixed action order, so a "random" agent is reproducible from its seed.
_ACTION_ORDER: tuple[GameAction, ...] = tuple(_MOVES.keys())


def optimal_actions(level_index: int) -> int:
    """Shortest number of moves from start to goal — breadth-first, exact.

    This is the `h` above. Computing it rather than guessing is the difference
    between a score and a decoration.
    """
    (ax, ay), (gx, gy) = _STARTS[level_index]
    walls = set(_WALLS[level_index])
    start, goal = (ax, ay), (gx, gy)
    seen = {start}
    queue: deque[tuple[tuple[int, int], int]] = deque([(start, 0)])
    while queue:
        (cx, cy), dist = queue.popleft()
        if (cx, cy) == goal:
            return dist
        for dx, dy in _MOVES.values():
            nxt = (cx + dx, cy + dy)
            if not (0 <= nxt[0] < GRID and 0 <= nxt[1] < GRID):
                continue
            if nxt in walls or nxt in seen:
                continue
            seen.add(nxt)
            queue.append((nxt, dist + 1))
    raise ValueError(f"level {level_index} has no path from {start} to {goal}")


def _cell_of(game: ZetaChase, tag: str) -> tuple[int, int]:
    sprite = game.current_level.get_sprites_by_tag(tag)[0]
    return sprite.x // CELL, sprite.y // CELL


def choose(
    agent: str,
    game: ZetaChase,
    rng_state: list[int],
    pixel: PixelAgent | None = None,
    grid: list[list[int]] | None = None,
) -> GameAction:
    """Pick one action.

    `random` steps a seeded LCG over the fixed action order — no `random`
    module, so an episode replays byte-identically. `greedy` closes the larger
    axis gap first and has NO wall model on purpose: the score should report
    something real, not a maze that was solved in the scorer.
    """
    if agent == "pixel":
        # The ONLY agent here that does not read sprite coordinates out of the
        # engine. It sees `grid` and nothing else.
        assert pixel is not None and grid is not None
        return pixel.act(grid)

    if agent == "random":
        rng_state[0] = (rng_state[0] * 1103515245 + 12345) & 0x7FFFFFFF
        return _ACTION_ORDER[rng_state[0] % len(_ACTION_ORDER)]

    (ax, ay) = _cell_of(game, "agent")
    (gx, gy) = _cell_of(game, "goal")
    dx, dy = gx - ax, gy - ay
    if abs(dx) >= abs(dy) and dx != 0:
        return GameAction.ACTION4 if dx > 0 else GameAction.ACTION3
    if dy != 0:
        return GameAction.ACTION2 if dy > 0 else GameAction.ACTION1
    return GameAction.ACTION4


def play(
    agent: str = "greedy", seed: int = 0, max_actions_per_level: int = 300
) -> dict:
    """One full episode. Returns per-level and aggregate scores."""
    # Constructed to prove the toolkit's own offline path initialises with no
    # key and no network — the fact this whole lane rests on.
    arcade = Arcade(operation_mode=OperationMode.OFFLINE)
    game = ZetaChase(seed=seed)

    pixel = PixelAgent()
    frame = reset(game)
    rng_state = [seed | 1]
    levels: list[dict] = []
    level_index = game.level_index
    actions = 0
    total_levels = len(_WALLS)

    while len(levels) < total_levels:
        if actions >= max_actions_per_level:
            levels.append(
                {
                    "level": level_index,
                    "actions": actions,
                    "optimal": optimal_actions(level_index),
                    "solved": False,
                    "score": 0.0,
                }
            )
            break

        grid = frame.frame[0] if frame.frame else []
        frame = advance(game, choose(agent, game, rng_state, pixel, grid))
        actions += 1

        solved_this_level = game.level_index != level_index or (
            _cell_of(game, "agent") == _cell_of(game, "goal")
        )
        if solved_this_level:
            best = optimal_actions(level_index)
            levels.append(
                {
                    "level": level_index,
                    "actions": actions,
                    "optimal": best,
                    "solved": True,
                    "score": min(1.0, best / actions) ** 2,
                }
            )
            if game.level_index == level_index:
                break  # last level cleared; the engine has nowhere to advance
            level_index = game.level_index
            actions = 0

    # ARC environment score: level-weighted mean, E = sum(l * S_l) / (n(n+1)/2)
    weighted = sum((entry["level"] + 1) * entry["score"] for entry in levels)
    environment_score = weighted / (total_levels * (total_levels + 1) / 2)

    return {
        "agent": agent,
        "seed": seed,
        "mode": "OFFLINE",
        "arcade_environments_discovered": len(arcade.get_environments()),
        "levels_cleared": sum(1 for entry in levels if entry["solved"]),
        "levels": levels,
        "environment_score": round(environment_score, 4),
        "reference": "h = BFS-optimal action count (NOT second-best-human; not leaderboard-comparable)",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Play ZetaChase offline and score it.")
    parser.add_argument(
        "--agent", choices=("pixel", "greedy", "random"), default="greedy"
    )
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    print(json.dumps(play(agent=args.agent, seed=args.seed), indent=2))


if __name__ == "__main__":
    main()
