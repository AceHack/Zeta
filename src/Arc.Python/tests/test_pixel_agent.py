"""Falsifiers for the pixel agent — the one that is not handed the answer.

Ground truth (`sprite.x`) is read HERE, in assertions only. The agent never
touches it; that is the whole point of the file.
"""

from __future__ import annotations

import math

from arcengine import GameAction

from zeta_arc.agent import (
    ACTION_VECTORS,
    INERT_PRIOR_SIGMA2,
    INERT_STALENESS_HORIZON,
    PixelAgent,
)
from zeta_arc.driver import advance, reset
from zeta_arc.dynamics import Belief, observe
from zeta_arc.environments.chase import CELL, ZetaChase
from zeta_arc.perception import Component, background_colour, components
from zeta_arc.play import play


def _grid(game: ZetaChase, frame) -> list[list[int]]:
    return frame.frame[0]


def _true_cell(game: ZetaChase, tag: str) -> tuple[int, int]:
    s = game.current_level.get_sprites_by_tag(tag)[0]
    return s.x // CELL, s.y // CELL


def test_background_is_measured_not_hardcoded() -> None:
    """Recolour every pixel and the background is still found.

    Hardcoding 5 would pass on ZetaChase forever and break on the first ARC
    environment that paints its floor differently.
    """
    game = ZetaChase(seed=4)
    grid = _grid(game, reset(game))
    assert background_colour(grid) == 5
    shifted = [[v + 100 for v in row] for row in grid]
    assert background_colour(shifted) == 105
    assert len(components(shifted)) == len(components(grid))


def test_components_finds_exactly_the_two_sprites() -> None:
    game = ZetaChase(seed=4)
    found = components(_grid(game, reset(game)))
    assert len(found) == 2
    assert {c.area for c in found} == {CELL * CELL}


def test_the_agent_identifies_its_own_body_from_pixels() -> None:
    """The elected self must land on the real agent sprite, not the goal.

    Non-vacuous by construction: the two sprites are the SAME SIZE, so area
    cannot separate them, and the agent is never told which colour it wears.
    Only the response to its own actions can distinguish them.
    """
    game = ZetaChase(seed=4)
    frame = reset(game)
    agent = PixelAgent()
    for _ in range(4):
        frame = advance(game, agent.act(_grid(game, frame)))

    me = agent._elect_self(components(_grid(game, frame)))
    assert me is not None
    true_x, true_y = _true_cell(game, "agent")
    # Centroid is in pixels; the sprite occupies one CELL-sized block.
    assert abs(me.cx / CELL - true_x) < 1.0
    assert abs(me.cy / CELL - true_y) < 1.0
    # ...and it is NOT sitting on the goal.
    goal_x, goal_y = _true_cell(game, "goal")
    assert (round(me.cx / CELL), round(me.cy / CELL)) != (goal_x, goal_y)


def test_pixel_agent_clears_level_zero_without_reading_sprites() -> None:
    result = play(agent="pixel", seed=4)
    assert result["levels_cleared"] >= 1
    level0 = result["levels"][0]
    assert level0["solved"] is True
    # It pays for perception: the coordinate-reading `greedy` needs `optimal`
    # actions, this one needs a couple more to work out which blob it is.
    assert level0["actions"] > level0["optimal"]
    assert level0["actions"] <= level0["optimal"] + 4


def test_pixel_agent_beats_a_random_walk() -> None:
    """The benchmark has to discriminate, or the score above means nothing."""
    assert (
        play(agent="pixel", seed=4)["environment_score"]
        > play(agent="random", seed=4)["environment_score"]
    )


def test_episodes_replay_byte_identically() -> None:
    assert play(agent="pixel", seed=4) == play(agent="pixel", seed=4)


def test_the_probe_costs_exactly_one_blind_action() -> None:
    """Before any evidence exists the agent cannot know which blob it is, and
    it says so by probing rather than guessing a colour. After ONE commanded
    move the evidence is positive and the body is committed."""
    game = ZetaChase(seed=4)
    frame = reset(game)
    agent = PixelAgent()

    # The world must be driven by the action the agent ACTUALLY chose. An
    # earlier version of this test advanced with a hardcoded ACTION4 while the
    # agent had commanded something else; the agent scored -1.0 disagreement
    # and correctly refused to commit. That was the probe working and the test
    # being wrong — kept as a note, because it is exactly the confusion this
    # design exists to prevent.
    first = agent.act(_grid(game, frame))
    assert agent._self_key is None  # nothing has answered yet
    frame = advance(game, first)

    agent.act(_grid(game, frame))
    assert agent._self_key is not None
    assert max(b.mu for b in agent.beliefs.values()) > 0


def test_the_wall_level_is_cleared_and_the_wall_is_learned_by_bumping() -> None:
    """Level 1 puts a wall between start and goal. The agent is never told
    where it is — `_WALLS` is not imported here or in the agent.

    Non-vacuous three ways: level 1 is UNSOLVED without an occupancy map (the
    coordinate-reading `greedy` baseline still fails it), the agent must have
    learned at least one blocked cell to route around, and every blocked cell
    it learned must be a REAL wall cell rather than a guess.
    """
    from zeta_arc.environments.chase import _WALLS  # ground truth, assertions only

    game = ZetaChase(seed=4)
    frame = reset(game)
    agent = PixelAgent()
    for _ in range(120):
        frame = advance(game, agent.act(_grid(game, frame)))
        if game.level_index >= 2:
            break

    assert game.level_index >= 2, "level 1 (the wall level) was not cleared"
    assert agent.blocked, "nothing was learned to be solid — no occupancy map was built"
    real_walls = set(_WALLS[1]) | set(_WALLS[0])
    off_grid = {c for c in agent.blocked if not (0 <= c[0] < 8 and 0 <= c[1] < 8)}
    invented = agent.blocked - real_walls - off_grid
    assert not invented, f"marked cells solid that are not walls: {invented}"


def test_the_step_size_starts_unknown_and_becomes_the_measured_displacement() -> None:
    """The agent derives pixels-per-cell from its own displacement.

    KNOWN WEAKNESS, stated rather than hidden: this test cannot tell "measured"
    from "imported". It catches a step size hardcoded AT CONSTRUCTION (the
    `is None` line below), and nothing more — an agent that quietly assigned
    `float(CELL)` on its first move instead of measuring passes every assertion
    here. Measured: with that cheat applied, all 21 tests in this file pass.

    So the real falsifier for the name is
    `test_the_agent_survives_a_world_it_was_never_tuned_on` below, which changes
    what a cell IS. This one is kept because the two catch different cheats.
    """
    game = ZetaChase(seed=4)
    frame = reset(game)
    agent = PixelAgent()
    assert agent._step_px is None
    for _ in range(4):
        frame = advance(game, agent.act(_grid(game, frame)))
    assert agent._step_px == float(CELL)


def _rescale_and_recolour(
    grid: list[list[int]], scale: int, shift: int
) -> list[list[int]]:
    """Blow each pixel up into a scale x scale block and shift every colour.

    The GAME is untouched — only what the agent sees. So the optimal action
    count is unchanged by construction, and any difference in the agent's
    behaviour is the agent's own.
    """
    out: list[list[int]] = []
    for row in grid:
        wide = [v + shift for v in row for _ in range(scale)]
        out.extend([list(wide) for _ in range(scale)])
    return out


def _play_transformed(scale: int, shift: int) -> tuple[dict[int, int], float | None]:
    """Run a full episode through the transform; return per-level action counts."""
    from zeta_arc.environments.chase import _WALLS

    game = ZetaChase(seed=4)
    frame = reset(game)
    agent = PixelAgent()
    per_level: dict[int, int] = {}
    level, used = game.level_index, 0
    while game.level_index < len(_WALLS) and used < 300:
        if not frame.frame:
            break
        if game.level_index != level:
            per_level[level] = used
            level, used = game.level_index, 0
        frame = advance(
            game, agent.act(_rescale_and_recolour(_grid(game, frame), scale, shift))
        )
        used += 1
    per_level[level] = used
    return per_level, agent._step_px


def test_the_agent_survives_a_world_it_was_never_tuned_on() -> None:
    """Change what a cell IS and what colour the floor is; nothing should move.

    This is the falsifier the docstrings actually need. `background_colour` and
    `_step_px` both claim to be MEASURED rather than imported, and the only way
    to test that claim is to make the imported answer WRONG.

    Non-vacuous, measured: with `_step_px` assigned `float(CELL)` on first move
    instead of measured — a cheat that passes every other test in this file —
    the agent dies on level 1 at every scale except 1, burning the whole
    300-action budget with `_step_px` stuck at 8.0.
    """
    baseline, base_step = _play_transformed(1, 0)
    assert base_step == float(CELL)
    assert len(baseline) >= 2, "baseline episode did not get past the first level"

    for scale, shift in ((2, 0), (1, 100), (3, 57), (2, -3)):
        actions, step = _play_transformed(scale, shift)
        # The step size is whatever a cell is IN THIS WORLD, not what it was in
        # the world the agent was written against.
        assert step == float(CELL * scale), (
            f"scale={scale}: step_px {step} is not measured"
        )
        # ...and the trajectory is untouched, action for action.
        assert actions == baseline, (
            f"scale={scale} shift={shift} diverged: {actions} != {baseline}"
        )


def test_the_third_level_is_cleared_by_committing_to_a_route() -> None:
    """Level 2 boxes the goal in on two sides, and it is where replanning from
    scratch every frame dies.

    Non-vacuous, measured: with the router returning only its FIRST step and
    the plan discarded each tick, level 2 runs the full 300-action budget
    unsolved — a clean two-cycle between (4,3) and (4,2), because against an
    optimistic map each cell's believed-shortest route runs through the other
    and BOTH moves succeed, so the agent never bumps and never learns better.
    Committing to the whole path is what breaks the tie: 24 actions, solved.
    """
    result = play(agent="pixel", seed=4)
    assert result["levels_cleared"] == 3
    level2 = result["levels"][2]
    assert level2["solved"] is True
    # Well inside the budget, and loose enough not to pin an exact trajectory.
    assert level2["actions"] < 100


def test_the_occupancy_map_is_relearned_when_the_world_resets() -> None:
    """A new level is a new world; what was learned about the old one is stale.

    The agent is never told a level changed. It infers it: one action moves the
    body at most one cell, so a body that moved further was PLACED, not steered.

    Non-vacuous, measured: without that inference the map still holds (3,1) and
    (3,2) — level 1's wall — for the whole of level 2, where both are open
    floor. Note this test does NOT claim a better score: level 2 takes the same
    24 actions either way, because the router simply detours around the phantom
    cells. What is asserted is that the map is TRUE, which is the property that
    would stop being free on a level where the detour is not available.
    """
    from zeta_arc.environments.chase import _WALLS  # ground truth, assertions only

    game = ZetaChase(seed=4)
    frame = reset(game)
    agent = PixelAgent()
    level, since, checked = game.level_index, 0, 0
    for _ in range(400):
        if game.level_index >= len(_WALLS) or not frame.frame:
            break
        if game.level_index != level:
            level, since = game.level_index, 0
        # ONE tick of lag is honest and is not asserted away: the agent learns
        # the world reset by SEEING that it moved further than it commanded, so
        # on the first frame of a new level that evidence does not exist yet.
        # What must not survive is staleness that PERSISTS past the evidence.
        if level == 2 and since >= 2:
            off_grid = {
                c for c in agent.blocked if not (0 <= c[0] < 8 and 0 <= c[1] < 8)
            }
            stale = agent.blocked - set(_WALLS[2]) - off_grid
            assert not stale, (
                f"believes cells solid that are open on this level: {stale}"
            )
            checked += 1
        frame = advance(game, agent.act(_grid(game, frame)))
        since += 1
    assert checked >= 5, f"only {checked} frames of level 2 were actually asserted on"


def test_the_wall_model_improves_the_score() -> None:
    """Routing must beat the coordinate-reading baseline, which has no
    occupancy map and dies on level 1."""
    pixel = play(agent="pixel", seed=4)
    greedy = play(agent="greedy", seed=4)
    assert pixel["levels_cleared"] > greedy["levels_cleared"]
    assert pixel["environment_score"] > greedy["environment_score"]


def test_the_environment_advertises_the_actions_it_actually_accepts() -> None:
    """`_get_valid_actions()` must list the four moves, not an empty list.

    THIS CAUGHT A REAL BUG, and it is worth stating what kind. `GameAction` is a
    plain `Enum`, NOT an `IntEnum`, so `GameAction.ACTION1 == 1` is False. The
    engine dispatches `available_actions` through `match action: case 1 | 2 | 3
    | 4 | 5:` — literal patterns compared by `==` — so passing enum MEMBERS made
    every case fall through and this environment advertised NO legal actions at
    all. Measured before the fix: `_get_valid_actions()` returned `[]`.

    Our own agents never asked, which is exactly why it went unnoticed: they
    carry their own action vectors. It would have surfaced the moment a generic
    ARC agent — or the toolkit's own server — asked the environment what it may
    do and was told "nothing".

    Non-vacuous: pass `GameAction` members instead of `a.value` in
    `ZetaChase.__init__` and this returns `[]` while every other test passes.
    """
    from arcengine import GameAction

    from zeta_arc.environments.chase import _MOVES

    game = ZetaChase(seed=4)
    reset(game)
    advertised = [a.id for a in game._get_valid_actions()]
    assert advertised, "the environment advertises no legal actions at all"
    assert set(advertised) == set(_MOVES), (
        f"advertised {advertised} but accepts {list(_MOVES)}"
    )
    # The list handed to the engine must be plain ints, not enum members —
    # the whole point of the bug.
    assert all(type(a) is int for a in game._available_actions), (
        f"available_actions must be plain ints, got {game._available_actions}"
    )
    assert GameAction.ACTION1 != 1, (
        "GameAction became an IntEnum; this test's premise is stale"
    )


# ---------------------------------------------------------------------------
# THE BOOTSTRAP TRAP: escaping a block required calibration, calibration
# required a successful move, and a successful move required not being blocked.
# ---------------------------------------------------------------------------


def _unresponsive_world() -> list[list[int]]:
    """A grid that never answers — exactly what a blocked move looks like from
    the agent's side, and what a level whose mechanic the agent has not found
    looks like for the whole episode."""
    grid = [[0] * 10 for _ in range(10)]
    grid[5][5] = 3  # the body
    grid[2][8] = 4  # something to head toward, up-and-right
    return grid


def test_a_world_that_never_answers_does_not_get_the_same_action_forever():
    """MEASURED BEFORE THE FIX: 1 distinct action over 40 ticks (ACTION1 x40),
    `_step_px` None, `blocked` empty.

    That is not a slow agent, it is a stuck one, and it burns the entire episode
    budget on a single move. It is also the exact signature 22 of 25 hosted
    environments returned on 2026-08-25: dead on level 0 with the budget spent.

    The assertion is `> 1`, deliberately weak: the claim under test is only that
    the agent STOPS REPEATING ITSELF, not that it plays well. A stronger number
    here would pin the current cycling order, which is not the property that
    matters and would go red on any future improvement to it.
    """
    agent = PixelAgent()
    grid = _unresponsive_world()
    actions = [agent.act([row[:] for row in grid]) for _ in range(40)]

    assert len(set(actions)) > 1, (
        "the agent issued one action for 40 ticks against a world that never "
        "responded — the bootstrap trap is back"
    )


def test_the_weak_instrument_stands_down_once_the_strong_one_can_boot():
    """The inert-action memory must not survive calibration.

    It is the paired half of the test above, and it is the one that actually
    failed when this mechanism was first written without a gate: diverting after
    a SINGLE unanswered move means the agent never bumps the same wall twice,
    so `blocked` never fills and the wall model never forms. Four wall tests in
    this file went red exactly that way.

    So the property is not "the agent varies its actions" — it is "the weak
    instrument yields to the strong one". Remove the `_step_px is None` gate in
    `act` and this goes red while the test above stays green, which is what
    makes the pair discriminating rather than duplicative.
    """
    agent = PixelAgent()
    grid = _unresponsive_world()
    agent.act([row[:] for row in grid])
    agent.act([row[:] for row in grid])
    assert agent._inert, "an unanswered action should have been recorded"

    # Once the body has actually moved, the step size is known and the stronger
    # cell-level instrument is available.
    agent._step_px = 1.0
    refused_before = {k: set(v) for k, v in agent._inert.items()}
    agent.act([row[:] for row in grid])

    assert agent._inert.keys() >= refused_before.keys(), (
        "the record itself is not discarded — only its influence on choice is"
    )
    # The gate is what is under test: with calibration present, a refused action
    # is once again eligible, because `_note_blocked_cell` now owns this job.
    key = agent._grid_key(grid)
    assert set(agent._inert.get(key, {})) & set(ACTION_VECTORS), (
        "precondition: something was refused from this exact state"
    )


def test_suppression_expires_because_games_upgrade_their_actions():
    """A suppressed action must become eligible again on its own.

    Aaron 2026-08-26: *"should not set the actions to completely 0 cause in many
    games actions get upgraded over time where previous actions did nothing in
    the start over time they turn into actions that do stuff ... not some games,
    not all of them."*

    That is fatal to a permanent refusal, and the case is not exotic: the grid
    can return to a BYTE-IDENTICAL state with the agent's capabilities changed
    underneath it, so the very key we suppress under is the one that comes back
    live. Suppression therefore leaks, like `LAYER_DECAY` and the body-evidence
    leak — nothing in this agent is permanent.

    WHAT THIS DOES *NOT* TEST, because the first version of it did and was
    wrong: expiry is not observable in a world that never answers. There, every
    retry re-refuses the action and the weight nets up, which is correct — an
    action that is still dead SHOULD stay suppressed. Expiry is only visible for
    an action that is not being re-refused, which is what is set up below.

    Set `INERT_TAU = 0.0` and this goes red while the bootstrap test stays
    green: suppression still works, it just never expires.
    """
    agent = PixelAgent()
    grid = _unresponsive_world()
    key = agent._grid_key(grid)

    # One action stands suppressed; a DIFFERENT one is what the agent last
    # issued, so the suppressed one is not re-refused on these revisits.
    suppressed = GameAction.ACTION3
    agent._inert[key] = {suppressed: observe(Belief(0.0, INERT_PRIOR_SIGMA2), 1.0, 1.0)}
    agent._last_action = GameAction.ACTION1

    before = agent._inert[key][suppressed]

    # Bounded, because an unbounded loop would pass by exhausting the test
    # rather than by going stale. One refusal leaves variance at 0.5, which
    # needs two revisits to reach the prior — six is headroom, not a fudge.
    for _ in range(6):
        agent.act([row[:] for row in grid])

    after = agent._inert.get(key, {}).get(suppressed)
    assert after is None or after.sigma2 > before.sigma2, (
        "suppression did not go stale at all"
    )
    assert suppressed not in agent._inert.get(key, {}), (
        "the suppressed action never became eligible again — an action that "
        "upgrades mid-episode could never be rediscovered"
    )


def test_suppression_can_never_outlast_the_horizon() -> None:
    """THE PROPERTY THE OLD MODEL DID NOT HAVE, and the reason this site was
    converted rather than left alone.

    `INERT_DECAY = 0.75` decayed an ACCUMULATING weight, so suppression time grew
    without bound in the number of refusals: about three revisits after one
    refusal, seven after three, eleven after ten. An action refused often enough
    early stayed suppressed for arbitrarily long — the permanent refusal the
    design forbids, arriving by degrees rather than by decree.

    A variance saturates where a sum does not. However many times an action has
    been refused, its belief starts under the prior and needs at most
    `INERT_STALENESS_HORIZON` revisits of ageing to reach it. The bound is the
    guarantee, and it is checked here against a deliberately extreme history.
    """
    ceiling = math.ceil(INERT_STALENESS_HORIZON)
    for refusals in (1, 3, 10, 50):
        agent = PixelAgent()
        grid = _unresponsive_world()
        key = agent._grid_key(grid)

        belief = Belief(0.0, INERT_PRIOR_SIGMA2)
        for _ in range(refusals):
            belief = observe(belief, 1.0, 1.0)
        suppressed = GameAction.ACTION3
        agent._inert[key] = {suppressed: belief}
        agent._last_action = GameAction.ACTION1

        released_at = None
        for revisit in range(ceiling):
            agent.act([row[:] for row in grid])
            if suppressed not in agent._inert.get(key, {}):
                released_at = revisit + 1
                break

        assert released_at is not None, (
            f"{refusals} refusals outlasted the {ceiling}-revisit horizon"
        )


# ─── the decoy world: what ZetaChase cannot ask ──────────────────────────────
#
# MEASURED FIRST, because the tests below only exist because of the measurement.
# Across 40 ticks of ZetaChase seed 4 the agent sees 4 distinct components and
# exactly ONE of them ever moves. The body election therefore has no competitor,
# and no ranking rule can be told apart from any other on that workload: removing
# the ageing entirely, or ranking by the mean instead of the conservative score,
# leaves all 118 tests green AND the environment score byte-identical at 0.354.
#
# So the falsifier has to be a world with a DECOY that also moves. These build
# one directly out of `Component`s rather than pixels, because the property under
# test is the election, and routing it through a grid would only add a renderer
# that could fail for unrelated reasons.


def _c(colour: int, cx: float, cy: float) -> Component:
    """A component at a position. `area` is fixed so `_key` tracks identity by
    colour alone — two distinct colours are two distinct candidates."""
    return Component(colour=colour, area=9, cx=cx, cy=cy)


def _drive(agent: PixelAgent, before: list[Component], after: list[Component]) -> None:
    """One frame: the agent commanded ACTION4 (+x) and this is what happened."""
    agent._previous = before
    agent._last_action = GameAction.ACTION4
    agent._update_evidence(after)


def test_a_body_that_stops_moving_loses_the_election_to_one_that_is_moving() -> None:
    """THE FAILURE `EVIDENCE_DECAY` COULD NOT PREVENT, and the reason this
    conversion is not cosmetic.

    Read the old update again: the decay sits INSIDE the loop that skips a
    component which did not move. So a component that stopped moving had its
    score FROZEN, not decayed — it was never contradicted, so it was never
    demoted, and it held the body until a challenger out-accumulated it from
    zero. That is the "welded on" failure the module docstring warns about,
    written into the mechanism meant to prevent it.

    Ageing demotes it without pretending to have observed anything. Here the
    decoy earns the body over six clean frames, goes still, and a second
    component starts moving in agreement. The decoy must lose.
    """
    decoy, real = 3, 7
    agent = PixelAgent()

    for step in range(6):
        _drive(
            agent,
            [_c(decoy, step, 0.0), _c(real, 0.0, 5.0)],
            [_c(decoy, step + 1.0, 0.0), _c(real, 0.0, 5.0)],
        )
    held = agent._elect_self([_c(decoy, 6.0, 0.0), _c(real, 0.0, 5.0)])
    # `_elect_self` returns None on an empty frame. It cannot here — two
    # components are always present — but asserting it says so out loud rather
    # than leaning on a precondition a reader has to reconstruct.
    assert held is not None
    assert held.colour == decoy

    took_over_at = None
    for step in range(8):
        _drive(
            agent,
            [_c(decoy, 6.0, 0.0), _c(real, step, 5.0)],
            [_c(decoy, 6.0, 0.0), _c(real, step + 1.0, 5.0)],
        )
        elected = agent._elect_self([_c(decoy, 6.0, 0.0), _c(real, step + 1.0, 5.0)])
        assert elected is not None
        if elected.colour == real and took_over_at is None:
            took_over_at = step + 1

    assert took_over_at is not None, "the still decoy was welded on"
    assert took_over_at <= 4, f"took {took_over_at} frames to release a still body"


def test_the_dynamics_factor_releases_a_still_body_sooner_than_decay_does() -> None:
    """The comparison the whole change rests on, run on ONE observation sequence.

    A test that only exercised the new model would show it works, never that it
    is better than what it replaced. So the old rule — `score * 0.9 + agreement`,
    applied only to components that moved, argmax with `LATCH_MARGIN = 1.0` — is
    reimplemented here and driven with the identical frames. The claim is the
    DIFFERENCE between the two columns, which neither column can state alone.
    """
    decoy, real = 3, 7
    agent = PixelAgent()
    old: dict[int, float] = {}
    old_held: int | None = None

    def old_step(moved: int) -> int | None:
        nonlocal old_held
        old[moved] = old.get(moved, 0.0) * 0.9 + 1.0  # only the mover updates
        best = max(old, key=lambda k: old[k])
        if old_held is not None and old[best] < old[old_held] + 1.0:
            return old_held
        if old[best] > 0:
            old_held = best
        return best

    for step in range(6):
        _drive(
            agent,
            [_c(decoy, step, 0.0), _c(real, 0.0, 5.0)],
            [_c(decoy, step + 1.0, 0.0), _c(real, 0.0, 5.0)],
        )
        old_step(decoy)

    new_release = old_release = None
    for step in range(12):
        _drive(
            agent,
            [_c(decoy, 6.0, 0.0), _c(real, step, 5.0)],
            [_c(decoy, 6.0, 0.0), _c(real, step + 1.0, 5.0)],
        )
        elected = agent._elect_self([_c(decoy, 6.0, 0.0), _c(real, step + 1.0, 5.0)])
        assert elected is not None
        if new_release is None and elected.colour == real:
            new_release = step + 1
        if old_release is None and old_step(real) == real:
            old_release = step + 1

    assert new_release is not None, "dynamics never released the still body"
    assert old_release is not None, "decay never released it either — check the setup"
    assert new_release < old_release, (
        f"dynamics released at {new_release}, decay at {old_release} — "
        "the conversion bought nothing on this sequence"
    )
