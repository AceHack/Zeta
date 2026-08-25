"""Falsifiers for the discovery levels — and an honest record of the frontier.

Three things get established here, in order of how much they matter:

1. THE LEVELS ARE RUNGS, NOT WALLS. A scripted solver that is TOLD the rule
   clears both well inside budget. Without this the whole file is worthless: a
   level nothing can clear is not a hard lesson, it is a broken environment,
   and it would look identical from the outside.

2. POSITION KNOWLEDGE IS NOT ENOUGH. `play.py`'s `greedy` baseline reads
   `sprite.x` straight out of the engine — perfect information about where
   everything is — and still fails, because knowing where things are tells you
   nothing about which one ends the level. That is the discriminator between
   navigation and discovery.

3. WHERE WE ACTUALLY ARE. The pixel agent does not clear these either, and the
   test says so rather than omitting the case. It is a CHARACTERISATION test,
   not a requirement that the agent stay bad — when the capability lands, this
   is the assertion that should flip, and its failure will be the good news.
"""

from __future__ import annotations

from arcengine import GameAction, GameState

from zeta_arc.agent import PixelAgent
from zeta_arc.driver import advance, reset
from zeta_arc.environments.chase import CELL
from zeta_arc.environments.discovery import _DISTRACTORS, _LAYOUT, _RULES, ZetaDiscovery

BUDGET = 300


def _won(game: ZetaDiscovery) -> bool:
    """Did the game reach WIN? The last level does NOT bump `level_index`.

    MEASURED in `arcengine/base_game.py:412`: `next_level()` increments the
    score and then, `if is_last_level()`, calls `win()` instead of advancing.
    So `level_index == len(_RULES)` never becomes true and a test that waits
    for it waits forever — which is exactly what an earlier version of this
    file did, and it read as "the level is unclearable" rather than "the
    indicator is wrong".

    Worth recording beyond this file: `play.py` detects the final clear with
    `agent cell == goal cell`, which is TRUE FOR ZetaChase and false in
    general — ZetaDiscovery's win is not standing on the `goal`. Anything that
    plays a third environment needs this signal, not that proxy.
    """
    return game._state == GameState.WIN


def _cell_of(sprite) -> tuple[int, int]:
    return sprite.x // CELL, sprite.y // CELL


def _walk_to(game: ZetaDiscovery, target: tuple[int, int], budget: int) -> int:
    """Step the agent toward `target`, one axis at a time. Returns actions used.

    This is the ORACLE's motor skill, not an agent: it is told the destination.
    The levels are about knowing WHICH destination, so handing that over is
    exactly what isolates the question.
    """
    used = 0
    started_on = game.level_index
    while used < budget:
        # STOP AT A LEVEL BOUNDARY. Without this the walk keeps stepping into
        # the next level toward a coordinate that means nothing there — which
        # is exactly how an earlier version of this helper made level 1 look
        # like it was won for free, and nearly had me file a bug against
        # ZetaChase for a defect that was in the probe.
        if game.level_index != started_on:
            return used
        agent = game.current_level.get_sprites_by_tag("agent")[0]
        ax, ay = _cell_of(agent)
        tx, ty = target
        if (ax, ay) == (tx, ty):
            return used
        if ax != tx:
            action = GameAction.ACTION4 if tx > ax else GameAction.ACTION3
        else:
            action = GameAction.ACTION2 if ty > ay else GameAction.ACTION1
        advance(game, action)
        used += 1
    return used


def test_the_levels_are_solvable_when_the_rule_is_known() -> None:
    """The non-vacuity check, and the reason to trust everything below.

    A solver that is handed the rule — touch the key, then the goal; ignore the
    decoy and take the odd-coloured one — clears both levels. So the difficulty
    these levels pose is DISCOVERING the rule, not executing it. A level that no
    agent and no oracle can clear would fail here, and it would be a broken
    environment rather than a hard lesson.
    """
    game = ZetaDiscovery(seed=4)
    reset(game)

    # Level 0: the gate first, then the goal. Order is the whole lesson.
    (_, goal_cell, key_cell) = _LAYOUT[0]
    used = _walk_to(game, key_cell, BUDGET)
    used += _walk_to(game, goal_cell, BUDGET - used)
    assert game.level_index == 1, f"level 0 not cleared in {used} actions"
    assert used < 40, (
        f"the oracle needed {used} actions — that is not a rung, it is a slog"
    )

    # Level 1: the odd-coloured prize, not the goal-coloured decoy.
    (_, prize_cell, _decoy_cell) = _LAYOUT[1]
    used = _walk_to(game, prize_cell, BUDGET)
    assert _won(game), f"level 1 not cleared in {used} actions"
    assert used < 40


def test_touching_the_goal_first_does_nothing_on_the_sequence_level() -> None:
    """The mechanic itself: the response is to what you DID, not what you meant.

    Non-vacuous — it walks onto the winning square and asserts the level did
    NOT advance. If the gate were ignored this passes trivially at level_index
    1 and the assertion catches it.
    """
    game = ZetaDiscovery(seed=4)
    reset(game)
    (_, goal_cell, _key) = _LAYOUT[0]
    _walk_to(game, goal_cell, BUDGET)
    assert game.level_index == 0, "the goal ended the level without the key — no gate"
    assert _RULES[0] == ("goal", "key")


def test_the_decoy_wears_the_tag_and_colour_that_worked_before() -> None:
    """The surface-feature lesson is only a lesson if the decoy is convincing.

    If the decoy were visibly different from every previous goal there would be
    nothing to unlearn. So this asserts the trap is actually baited: the inert
    object carries tag `goal`, and the winning one does not.
    """
    game = ZetaDiscovery(seed=4)
    reset(game)
    _walk_to(game, _LAYOUT[0][2], BUDGET)  # key
    _walk_to(game, _LAYOUT[0][1], BUDGET)  # goal -> level 1
    assert game.level_index == 1

    tagged_goal = game.current_level.get_sprites_by_tag("goal")
    assert tagged_goal, "level 1 has no `goal`-tagged sprite — the trap is not baited"
    assert _cell_of(tagged_goal[0]) == _LAYOUT[1][2], (
        "the `goal` tag is not on the decoy"
    )
    assert _RULES[1][0] == "prize"


def test_perfect_position_information_is_not_enough() -> None:
    """THE DISCRIMINATOR between navigation and discovery.

    An oracle with perfect position information that follows the rule the first
    three ZetaChase levels taught — walk to the `goal`-tagged sprite — fails
    here. Not because it cannot navigate: it arrives exactly where it aimed.
    Knowing where everything is simply does not tell you which thing ends the
    level.

    This is the property that makes these rungs worth having, and asserting it
    is what stops a navigation level being mistaken for a discovery one.
    """
    game = ZetaDiscovery(seed=4)
    reset(game)
    goal_sprites = game.current_level.get_sprites_by_tag("goal")
    used = _walk_to(game, _cell_of(goal_sprites[0]), BUDGET)

    agent = game.current_level.get_sprites_by_tag("agent")[0]
    assert _cell_of(agent) == _cell_of(goal_sprites[0]), "it did not even arrive"
    assert game.level_index == 0, (
        f"the goal-follower cleared the level in {used} actions — "
        "this level tests navigation, not discovery"
    )


def test_the_pixel_agent_does_not_yet_clear_these_and_that_is_the_frontier() -> None:
    """CHARACTERISATION, not a requirement. Read the docstring before 'fixing'.

    The pixel agent routes to the nearest non-self component and keeps routing.
    It has no mechanism for *I did the thing and nothing happened, so try
    something else* — which is precisely the capability these levels ask for
    and precisely what is not built.

    Recorded rather than omitted, because a curriculum rung with no measured
    baseline is a rung nobody can tell they have climbed. WHEN THE CAPABILITY
    LANDS THIS ASSERTION SHOULD FLIP, and its failure is the good news; invert
    it then rather than deleting it.
    """
    game = ZetaDiscovery(seed=4)
    frame = reset(game)
    agent = PixelAgent()
    for _ in range(BUDGET):
        if not frame.frame:
            break
        frame = advance(game, agent.act(frame.frame[0]))
        if _won(game):
            break

    assert not _won(game), (
        "the pixel agent cleared the discovery levels — the frontier moved. "
        "Invert this assertion and say what changed."
    )


def test_visiting_everything_is_not_a_general_solution() -> None:
    """THE FALSIFIER FOR THE DISTRACTOR COST, and it needed a solver of its own.

    "Touch every object, then the goal" defeats any gate puzzle regardless of
    object count — which is why the gate alone was not a rung. The cost exists
    to break exactly that strategy, so exactly that strategy is what has to be
    shown failing.

    Why not just watch the pixel agent: MEASURED, it fails this level with the
    cost AND without it (300 actions, level 0, both times). What stops it is
    having four objects to wander among, not the penalty. Using its failure as
    evidence for the cost would be reading a result off an instrument that does
    not respond to the variable — the same mistake as the arena harness that
    rewound its own rng.
    """
    game = ZetaDiscovery(seed=4)
    reset(game)
    (_, goal_cell, key_cell) = _LAYOUT[0]

    # Gate, then a wrong object, then the target — the exact strategy the cost
    # is for. The order is chosen with care: walking from the key to the (6, 1)
    # distractor travels along row 6 and passes OVER the goal while the gate is
    # held, which wins incidentally and says nothing about the cost. That is a
    # real and somewhat forgiving property of this layout, recorded here rather
    # than tuned away, and it is why this test routes via (3, 3) instead.
    _walk_to(game, key_cell, BUDGET)
    _walk_to(game, _DISTRACTORS[1], BUDGET)
    _walk_to(game, goal_cell, BUDGET)

    assert game.level_index == 0, (
        "visiting every object and then the goal cleared the level — the gate "
        "cost is not doing its job, and this level is solvable without "
        "identifying anything"
    )
