"""ZetaPocket: the local instrument for the greedy-vs-blocked deadlock."""

from __future__ import annotations

from collections import Counter

from zeta_arc.agent import ACTION_VECTORS, PixelAgent
from zeta_arc.driver import advance, reset
from zeta_arc.environments.pocket import _LEVELS, ZetaPocket
from zeta_arc.frames import grid_of
from zeta_arc.perception import components


def _play(cap: int = 400) -> tuple[list, PixelAgent]:
    """Play until the environment is won, or the cap is hit.

    STOPPING AT COMPLETION IS LOAD-BEARING. A fixed 400-tick loop keeps issuing
    actions long after the last level is cleared, and that idle tail dominates
    any per-action statistic: once both levels were solved the agent spent ~376
    of 400 ticks on one action with nothing left to do, and the share assertion
    below failed on a run that had just gone from 1 solved level to 2. The tail
    measures boredom, not the deadlock.
    """
    env = ZetaPocket()
    frame = reset(env)
    agent = PixelAgent()
    issued = []
    for _ in range(cap):
        action = agent.act(grid_of(frame))
        issued.append(action)
        frame = advance(env, action)
        if int(getattr(frame, "levels_completed", 0) or 0) >= len(_LEVELS):
            break
    return issued, agent


def test_the_agent_stops_walking_into_a_wall_it_has_already_mapped():
    """MEASURED BEFORE THE FIX: ACTION3 x382 of 400, at cell (7,1), with
    `blocked` already holding both real walls — (6,1) and (7,2).

    The agent had learned the obstacles by bumping and then walked into one of
    them for the rest of the episode, because `blocked` was written by
    `_note_blocked_cell` and read only by `_route_plan`. Whenever the router
    returned no plan, the greedy fallback re-issued a move into a cell it knew
    was solid — and re-issued it forever, since the heading never changes while
    the agent does not move.

    The threshold is 60%, not "never": this environment has legitimate repeats,
    and the claim under test is that no single action consumes the episode. The
    pre-fix run was 95.5%.
    """
    issued, _ = _play()
    top, count = Counter(issued).most_common(1)[0]
    share = count / len(issued)
    assert share < 0.60, (
        f"{top.name} took {share:.0%} of the episode — the agent is hammering a "
        "single action again"
    )


def test_greedy_never_chooses_a_move_into_a_cell_it_believes_is_solid():
    """The property directly, rather than through an episode statistic.

    An episode-share assertion can pass for the wrong reason — an agent that
    oscillates between two USELESS moves also spreads its budget. This checks
    the decision itself: given a known-blocked neighbour and an open one, the
    blocked one must not be chosen.
    """
    _, agent = _play(cap=60)
    assert agent.blocked, "precondition: bumping should have mapped some walls"

    env = ZetaPocket()
    frame = reset(env)
    probe = PixelAgent()
    probe.blocked = set(agent.blocked)
    probe._step_px = agent._step_px

    for _ in range(40):
        grid = grid_of(frame)
        comps = components(grid)
        me = probe._elect_self(comps)
        action = probe.act(grid)
        if me is not None and probe._step_px:
            here = probe._cell_of(me)
            dx, dy = ACTION_VECTORS[action]
            destination = (here[0] + dx, here[1] + dy)
            open_exists = any(
                (here[0] + ACTION_VECTORS[a][0], here[1] + ACTION_VECTORS[a][1])
                not in probe.blocked
                for a in ACTION_VECTORS
            )
            if open_exists:
                assert destination not in probe.blocked, (
                    f"chose {action.name} into {destination}, which is in "
                    "`blocked`, while an open neighbour existed"
                )
        frame = advance(env, action)
