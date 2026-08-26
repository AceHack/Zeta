"""Play a ZetaChase episode offline and report an ARC-shaped score.

Run:
    uv run --project src/Arc.Python python -m zeta_arc.play
    uv run --project src/Arc.Python python -m zeta_arc.play --agent random --seed 4

NO KEY, NO NETWORK — and that is now a DECISION rather than a hardcode. With
no `ARC_API_KEY` the lane runs `OperationMode.OFFLINE`, which is MEASURED to
initialise with `arc_api_key=''` and never contact the API, so it still runs on
a laptop, in CI without secrets, and in a container with egress blocked. With a
key it runs `NORMAL` and can see the hosted environments.

The mode is CHOSEN by `operation_mode_for` and REPORTED as whatever was
actually obtained — see `open_arcade`. The reported mode used to be the string
literal `"OFFLINE"` regardless of anything, which is a claim no test could
falsify. A key that is present but unreachable degrades to a scored offline
episode and says so; absence must DEGRADE, never fail.

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
import os
from collections import deque

# `arc_agi` ships no py.typed marker, so mypy cannot see into it. Ignoring the
# import is honest here — the alternative is inventing stubs for a dependency
# whose types we do not control.
from arc_agi import Arcade, OperationMode  # type: ignore[import-untyped]
from arcengine import ARCBaseGame, GameAction, GameState

from zeta_arc.agent import PixelAgent
from zeta_arc.driver import advance, reset
from zeta_arc.environments.chase import (
    _MOVES,
    _STARTS,
    _WALLS,
    CELL,
    GRID,
    ZetaChase,
    ZetaChaseDecoy,
)
from zeta_arc.hosted import (
    MAX_ACTIONS_PER_LEVEL as HOSTED_MAX_ACTIONS_PER_LEVEL,
)
from zeta_arc.hosted import play_roster

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


def operation_mode_for(api_key: str | None) -> OperationMode:
    """Which mode a given key buys. Pure policy, so it is testable without a network.

    THE LINE IS NETWORK ACCESS, not features. MEASURED in `arc_agi/base.py`:
    every mode EXCEPT `OFFLINE` reaches the network during construction — it
    calls `_fetch_from_api()`, and with an empty key it first calls
    `_get_anonymous_api_key()`. `OFFLINE` is the only mode that provably makes
    no request. So a blank key must map to `OFFLINE` rather than to "NORMAL and
    hope": that is what keeps this lane runnable on a laptop, in a container
    with egress blocked, and in CI without secrets.

    Whitespace counts as blank. A secret that expanded to `""` is the shape an
    unset GitHub secret takes, and treating it as a key would turn a missing
    secret into a network call.
    """
    return OperationMode.NORMAL if (api_key or "").strip() else OperationMode.OFFLINE


def open_arcade() -> tuple[Arcade, str]:
    """The Arcade this episode runs against, and the mode it ACTUALLY got.

    Returns the real mode rather than the requested one, because the result
    dict reports it and a hardcoded label would be a claim nothing checks. It
    used to say `"mode": "OFFLINE"` unconditionally.

    DEGRADE, NEVER FAIL (design doc §3.2). A key that is present but cannot
    reach the API must still produce a scored episode. MEASURED: with a key and
    an unreachable base URL, `Arcade` constructs in 0.09s, logs the
    `ConnectionError`, and returns zero API environments — `_fetch_from_api`
    swallows `RequestException` and `Exception` alike. The `try` below is the
    belt for the case the constructor itself raises before reaching that
    handler; it is not the primary mechanism.
    """
    key = os.environ.get("ARC_API_KEY", "")
    mode = operation_mode_for(key)
    if mode is OperationMode.OFFLINE:
        return Arcade(operation_mode=OperationMode.OFFLINE), "OFFLINE"
    try:
        return Arcade(operation_mode=mode), mode.name
    except Exception:  # noqa: BLE001 — degrading is the requirement, not the exception's identity
        return Arcade(
            operation_mode=OperationMode.OFFLINE
        ), "OFFLINE (degraded from NORMAL)"


#: Per-level action ceiling. 300 was chosen against ZetaChase, whose levels are
#: BFS-optimal at 7-10 actions. It is TOO SMALL for the hosted environments:
#: their own `baseline_actions` run to 578 (DC22), 500 (M0R0) and 442 (WA30), so
#: a 300 ceiling would cut off levels a REFERENCE PLAYER needs more than 300
#: actions for — scoring an agent as failed on a level nobody clears that fast.
#: Read off the live roster (run 32812742904), not assumed.
MAX_ACTIONS_PER_LEVEL = 800


def level_cleared(game: ARCBaseGame, previous_index: int) -> bool:
    """Did the level just end? Works on the LAST level, and on any environment.

    Two traps, both measured rather than reasoned about:

    1. `level_index` does not advance on the final level. `next_level()` in
       `arcengine/base_game.py:412` increments the score and then, if this is
       the last level, calls `win()` instead of advancing. So a loop that waits
       for `level_index` to reach the level count waits forever.

    2. The previous check for that case was `agent cell == goal cell`, which is
       true for ZetaChase and FALSE IN GENERAL. ZetaDiscovery's win is not
       standing on the `goal` — its level 1 goal is a decoy that ends nothing —
       so that proxy would silently mis-score it, and would mis-score any hosted
       environment whose win condition is not "occupy the goal sprite".

    `GameState.WIN` is what the engine actually sets, so it is what this reads.

    Typed `ARCBaseGame`, not `ZetaChase`, and mypy is why: the first version
    said `ZetaChase` and so contradicted the entire point of the change. A
    clear-check that only accepts the one environment it was written against is
    the defect being fixed, restated in the signature.
    """
    return game.level_index != previous_index or game._state == GameState.WIN


#: The environments this scorer can drive, by name. `ZetaChaseDecoy` shares
#: walls, starts and win condition with `ZetaChase`, so `optimal_actions` is
#: valid for both and the two scores are directly comparable — the only
#: difference is that the decoy gives the body election a competitor.
ENVIRONMENTS: dict[str, type[ZetaChase]] = {
    "chase": ZetaChase,
    "chase-decoy": ZetaChaseDecoy,
}


def play(
    agent: str = "greedy",
    seed: int = 0,
    max_actions_per_level: int = MAX_ACTIONS_PER_LEVEL,
    environment: str = "chase",
) -> dict:
    """One full episode. Returns per-level and aggregate scores.

    `environment` DEFAULTS TO "chase" so every existing caller and every pinned
    score is untouched. The decoy variant is additive: `ZetaChase` stays exactly
    as it was and keeps working as a regression guard, while "chase-decoy"
    supplies the discrimination it structurally cannot.
    """
    if environment not in ENVIRONMENTS:
        raise ValueError(
            f"play: unknown environment {environment!r}; known: {sorted(ENVIRONMENTS)}"
        )
    arcade, mode = open_arcade()
    game = ENVIRONMENTS[environment](seed=seed)

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

        solved_this_level = level_cleared(game, level_index)
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
        "mode": mode,
        "arcade_environments_discovered": len(arcade.get_environments()),
        "levels_cleared": sum(1 for entry in levels if entry["solved"]),
        "levels": levels,
        "environment_score": round(environment_score, 4),
        "reference": "h = BFS-optimal action count (NOT second-best-human; not leaderboard-comparable)",
    }


def list_environments() -> dict:
    """The hosted environments this key can see. Reconnaissance, not play.

    WHY THIS EXISTS SEPARATELY FROM `play`. The lane now DISCOVERS real ARC
    environments but still plays ZetaChase, our own stand-in. Before writing a
    play loop against 25 environments it is worth knowing what they are — how
    many actions they take, what their level structure looks like — rather than
    guessing and discovering the mismatch inside a scoring loop.

    `private_tags` IS DELIBERATELY NOT REPORTED. `EnvironmentInfo` carries both
    `tags` and `private_tags`; the second is named by its author as not for
    publication, and this output goes into CI logs that anyone with read access
    can see. Publishing a field called private because it happened to be in the
    struct is exactly the kind of thing that is obvious in hindsight. `tags`,
    `game_id` and `title` are the public identity of a public benchmark.

    Degrades like everything else here: no key means OFFLINE, which means an
    empty roster and exit 0, not a failure.
    """
    arcade, mode = open_arcade()
    found = arcade.get_environments()
    return {
        "mode": mode,
        "count": len(found),
        "environments": [
            {
                "game_id": env.game_id,
                "title": env.title,
                "tags": env.tags or [],
                # CORRECTION, from reading the live roster rather than the
                # field name. This is NOT the set of actions the environment
                # accepts, which is what I first wrote here. It is a REFERENCE
                # ACTION COUNT PER LEVEL: SB26 reports [18, 28, 18, 19, 31, 23,
                # 58, 18] — eight levels, eighteen actions for the first.
                #
                # That matters more than the correction does. ARC's level score
                # is `min(1, h/a)**2`, and `h` is the reference we do not have
                # offline — `play.py` substitutes BFS-optimal and says so. For
                # hosted environments `h` appears to be RIGHT HERE, so it does
                # not need inventing.
                "baseline_actions": env.baseline_actions or [],
                # `level_tags` is empty on every hosted environment (all report
                # 0), so it is useless as a level count. The length of
                # `baseline_actions` is the real one: 6 to 10 levels each.
                "level_tags_count": len(env.level_tags or []),
                "levels_from_baselines": len(env.baseline_actions or []),
            }
            for env in sorted(found, key=lambda e: e.game_id)
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Play ZetaChase offline and score it.")
    parser.add_argument(
        "--agent", choices=("pixel", "greedy", "random"), default="greedy"
    )
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument(
        "--list-environments",
        action="store_true",
        help="report the hosted environments this key can see, and play nothing",
    )
    parser.add_argument(
        "--play-hosted",
        action="store_true",
        help="play every hosted environment this key can see and report the sweep",
    )
    parser.add_argument(
        "--max-environments",
        type=int,
        default=None,
        help="cap how many hosted environments the sweep plays (default: all)",
    )
    parser.add_argument(
        "--max-actions-per-level",
        type=int,
        default=HOSTED_MAX_ACTIONS_PER_LEVEL,
        help=(
            "per-level action ceiling for the hosted sweep. Below the largest "
            "published baseline (578) the scores stop being comparable, and the "
            "output says so rather than leaving it to the reader."
        ),
    )
    args = parser.parse_args()
    if args.list_environments:
        print(json.dumps(list_environments(), indent=2))
        return
    if args.play_hosted:
        # `open_arcade` is the same degrade-never-fail door the rest of the lane
        # uses: no key means OFFLINE, which means an empty roster and a sweep
        # that reports zero environments and exits 0.
        arcade, mode = open_arcade()
        sweep = play_roster(
            arcade,
            max_environments=args.max_environments,
            max_actions_per_level=args.max_actions_per_level,
            seed=args.seed,
        )
        print(json.dumps({"mode": mode, **sweep}, indent=2))
        return
    print(json.dumps(play(agent=args.agent, seed=args.seed), indent=2))


if __name__ == "__main__":
    main()
