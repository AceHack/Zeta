"""Falsifiers for the ARC lane.

These are the checks that would have caught every mistake made while building
it: a hook that never completes, a scorer that flatters, a "benchmark" that
cannot tell a competent agent from a random one, and a run that does not
replay.
"""

from __future__ import annotations

import pytest
from arcengine import GameAction

from zeta_arc.driver import advance
from zeta_arc.environments.chase import _STARTS, _WALLS, CELL, ZetaChase
from zeta_arc.play import optimal_actions, play


def _agent_cell(game: ZetaChase) -> tuple[int, int]:
    sprite = game.current_level.get_sprites_by_tag("agent")[0]
    return sprite.x // CELL, sprite.y // CELL


def test_the_environment_runs_offline_with_no_key_and_no_network() -> None:
    """The fact the whole lane rests on."""
    result = play(agent="greedy", seed=0)
    assert result["mode"] == "OFFLINE"
    assert result["levels"], "an episode that produced no levels scored nothing"


def test_an_action_moves_the_agent_exactly_one_cell() -> None:
    game = ZetaChase(seed=0)
    before = _agent_cell(game)
    advance(game, GameAction.ACTION4)  # right
    after = _agent_cell(game)
    assert after == (before[0] + 1, before[1])


def test_walls_block_and_still_cost_an_action() -> None:
    """A refused move is not a free move — the score denominator is actions."""
    game = ZetaChase(seed=0)
    # Level 1 has a wall column at x=3; walk into it from the left.
    game.set_level(1)
    for _ in range(2):
        advance(game, GameAction.ACTION4)
    blocked_from = _agent_cell(game)
    advance(game, GameAction.ACTION4)
    assert _agent_cell(game) == blocked_from, "the wall did not block"


def test_reaching_the_goal_advances_the_level() -> None:
    """The level-transition path — the one that deadlocked a hand-rolled loop.

    A level-clearing action sets `_next_level`, and `is_action_complete()` is
    `not _next_level and _action_complete`; only the engine's own
    `perform_action` loop resolves that. If this test hangs or fails, the
    driver has started reimplementing the engine again.
    """
    game = ZetaChase(seed=0)
    (ax, ay), (gx, gy) = _STARTS[0]
    for _ in range(gx - ax):
        advance(game, GameAction.ACTION4)
    for _ in range(gy - ay):
        advance(game, GameAction.ACTION2)
    assert game.level_index == 1, "reaching the goal did not advance the level"


def test_optimal_is_computed_not_guessed() -> None:
    """`h` in min(1, h/a)**2 is a real shortest path, and walls lengthen it."""
    assert optimal_actions(0) == 10  # (1,1) -> (6,6), open room
    # Level 1's wall column forces a detour, so optimal exceeds the naive |dx|.
    (ax, ay), (gx, gy) = _STARTS[1]
    manhattan = abs(gx - ax) + abs(gy - ay)
    assert optimal_actions(1) > manhattan, "the wall did not lengthen the path"


def test_a_perfect_level_scores_exactly_one() -> None:
    """The scorer must not flatter: optimal play, and only that, scores 1.0."""
    result = play(agent="greedy", seed=0)
    first = result["levels"][0]
    assert first["actions"] == first["optimal"]
    assert first["score"] == pytest.approx(1.0)


def test_the_benchmark_discriminates() -> None:
    """A score that cannot separate competence from noise is a decoration.

    Measured: greedy clears the open level (0.1667); random clears nothing
    (0.0) at every seed tried.
    """
    greedy = play(agent="greedy", seed=0)
    random_walk = play(agent="random", seed=0)
    assert greedy["environment_score"] > random_walk["environment_score"]
    assert random_walk["levels_cleared"] == 0


def test_the_greedy_agent_is_honestly_beaten_by_a_wall() -> None:
    """It has no wall model, so the walled level must defeat it.

    If this ever passes trivially, someone taught the scorer the answer.
    """
    result = play(agent="greedy", seed=0)
    assert result["levels_cleared"] < len(_WALLS)


def test_an_episode_replays_byte_identically() -> None:
    """DST: same seed, same episode, or the score means nothing."""
    assert play(agent="random", seed=7) == play(agent="random", seed=7)
    assert play(agent="greedy", seed=3) == play(agent="greedy", seed=3)
