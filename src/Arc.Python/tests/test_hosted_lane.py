"""Falsifiers for the hosted lane: frames, the click prior, the layer chooser,
and the play loop — plus the one test that guards the code no local run reaches.

THE STRUCTURE OF THIS FILE IS THE ARGUMENT. `ARC_API_KEY` is absent from the
container this was written in, so `arcade.make()` cannot be called and no hosted
environment can be played. Rather than shipping an unfalsified loop and calling
the gap a limitation, the code was split so that the unreachable part is a
single delegating call, and everything that decides anything sits above it and
is tested here — twice over, against in-process fakes AND against the real
ZetaChase/ZetaDiscovery environments driven through the same protocol.

`test_wrapper_protocol_conformance` is the guard on what is left. It cannot
prove hosted play works. It fails when the toolkit renames or re-signatures the
methods the delegation calls, which is the drift that would otherwise be
discovered as a red CI run with no local reproduction.
"""

from __future__ import annotations

import inspect
from typing import Any

import numpy as np
import pytest
from arc_agi.wrapper import EnvironmentWrapper  # type: ignore[import-untyped]
from arcengine import GameAction, GameState

from zeta_arc.agent import PixelAgent
from zeta_arc.click import MAX_COORD, SWEEP_STRIDES, ClickPolicy
from zeta_arc.driver import advance, reset
from zeta_arc.environments.chase import ZetaChase
from zeta_arc.environments.discovery import ZetaDiscovery
from zeta_arc.frames import grid_of, is_click, offered_actions
from zeta_arc.hosted import (
    Wrapper,
    environment_score,
    play_environment,
    score_level,
)
from zeta_arc.layered import CLICK, KEYBOARD, LayeredAgent
from zeta_arc.perception import Component


class FakeFrame:
    """Stands in for `FrameData` / `FrameDataRaw` — only the fields used."""

    def __init__(
        self,
        grid: list[list[int]] | None = None,
        available: list[int] | None = None,
        levels_completed: int = 0,
        state: GameState = GameState.NOT_FINISHED,
        raw: bool = False,
    ) -> None:
        cells = grid if grid is not None else [[0] * 8 for _ in range(8)]
        self.frame = [np.array(cells, dtype=np.int64)] if raw else [cells]
        self.available_actions = available if available is not None else [1, 2, 3, 4]
        self.levels_completed = levels_completed
        self.state = state


# ---------------------------------------------------------------- frames.py


def test_grid_of_normalises_both_frame_representations() -> None:
    """The hosted path returns ndarrays and ours returns lists; one grid out.

    THE POINT IS THE TYPE, not the values. `components()` would not crash on an
    ndarray — it would return `Component`s whose `colour` is an `np.int64`, and
    `_key()` multiplies that by 100003 and overflows silently at 2**63 instead
    of promoting. A wrong answer with no exception, on the hosted path only.
    """
    cells = [[1, 2], [3, 4]]
    for raw in (False, True):
        grid = grid_of(FakeFrame(cells, raw=raw))
        assert grid == cells
        assert all(type(v) is int for row in grid for v in row), (
            f"raw={raw} leaked a non-int cell type into the grid"
        )


def test_grid_of_survives_an_empty_frame() -> None:
    """A frame with no layers is a real state, not an error — `is_empty` exists."""

    class Empty:
        def __init__(self) -> None:
            self.frame: list[Any] = []
            self.available_actions: list[int] = []
            self.state = GameState.NOT_FINISHED

    assert grid_of(Empty()) == []
    assert offered_actions(Empty()) == []


def test_offered_actions_drops_ids_the_engine_does_not_know() -> None:
    """A pre-1.0 toolkit adding a server-side action must cost one action, not the run.

    `GameAction.from_id` RAISES on an unknown id (`arcengine/enums.py:93`) — it
    does not return `None`, which is what this file's first version assumed and
    what the loop above that line looks like it does. So the leniency has to be
    ours, and this is the test that says the raise is handled.
    """
    assert offered_actions(FakeFrame(available=[1, 99, 6])) == [
        GameAction.ACTION1,
        GameAction.ACTION6,
    ]


def test_offered_actions_is_ordered_regardless_of_the_environments_order() -> None:
    """Determinism: 'the first offered action' must mean the same thing on a replay."""
    assert offered_actions(FakeFrame(available=[6, 1, 4])) == offered_actions(
        FakeFrame(available=[4, 6, 1])
    )


def test_is_click_asks_the_engine_not_the_action_name() -> None:
    """If a second coordinate action ever appears, `== ACTION6` sends it with no x/y."""
    assert is_click(GameAction.ACTION6)
    assert not any(is_click(a) for a in (GameAction.ACTION1, GameAction.ACTION5))
    assert [a for a in GameAction if a.is_complex()] == [GameAction.ACTION6]


# ----------------------------------------------------------------- click.py


def _two_object_grid() -> list[list[int]]:
    grid = [[0] * 10 for _ in range(10)]
    grid[2][3] = 7
    grid[7][8] = 7
    return grid


def test_click_tries_objects_before_anything_else() -> None:
    """The whole prior: things that are objects are things that are clickable.

    Without it the space is 4096 points and a few hundred actions of budget, so
    'uniform over coordinates' is not a weak policy but no policy at all.
    """
    policy = ClickPolicy()
    grid = _two_object_grid()
    assert {policy.choose(grid), policy.choose(grid)} == {(3, 2), (8, 7)}


def test_click_never_repeats_a_coordinate_on_an_unchanged_world() -> None:
    """Re-clicking what did nothing, on a world that did not move, is spent budget."""
    policy = ClickPolicy()
    grid = _two_object_grid()
    seen = [policy.choose(grid) for _ in range(40)]
    assert len(seen) == len(set(seen))


def test_click_forgets_what_did_nothing_once_the_world_moves() -> None:
    """A click that did nothing HERE may do something THERE.

    This is the level-transition failure restated for the click layer: an agent
    that keeps its do-not-press list across a world change is an agent that
    refuses to press the button that just worked.
    """
    policy = ClickPolicy()
    grid = _two_object_grid()
    first = policy.choose(grid)
    for _ in range(20):
        policy.choose(grid)
    moved = [row[:] for row in grid]
    moved[5][5] = 9
    assert policy.choose(moved) == first


def test_click_falls_back_to_a_coarse_to_fine_lattice_not_a_raster() -> None:
    """Coverage, not order. The budget runs out before a raster leaves row 0.

    Asserted as a PROPERTY of the first pass rather than as a fixed sequence:
    after the objects, the next points must all sit on the coarsest stride and
    must span the board rather than clustering.
    """
    policy = ClickPolicy()
    grid = _two_object_grid()
    objects = {policy.choose(grid) for _ in range(2)}
    lattice = [policy.choose(grid) for _ in range(4)]
    assert not set(lattice) & objects
    stride = SWEEP_STRIDES[0]
    assert all(x % stride == 0 and y % stride == 0 for x, y in lattice)
    assert len({y for _, y in lattice}) > 1, "a raster scan would stay on one row"


def test_click_is_deterministic_for_dst_replay() -> None:
    """Same world, same sequence — no clock, no random source anywhere in it."""
    grid = _two_object_grid()
    a = [ClickPolicy().choose(grid) for _ in range(1)]
    runs = [[p.choose(grid) for _ in range(12)] for p in (ClickPolicy(), ClickPolicy())]
    assert runs[0] == runs[1] and a


def test_click_coordinates_stay_inside_the_engines_validated_range() -> None:
    """`ComplexAction` validates `0 <= x,y <= 63`; a violation is a mid-episode crash."""
    policy = ClickPolicy()
    big = [[0] * 200 for _ in range(200)]
    big[150][170] = 3
    for _ in range(60):
        x, y = policy.choose(big)
        assert 0 <= x <= MAX_COORD and 0 <= y <= MAX_COORD


# --------------------------------------------------------------- layered.py


def test_layer_chooser_uses_only_what_the_frame_offers() -> None:
    """The environment decides which layers are even wired up."""
    grid = _two_object_grid()
    click_only = LayeredAgent()
    action, data = click_only.act(FakeFrame(grid, available=[6]))
    assert action == GameAction.ACTION6 and set(data) == {"x", "y"}

    keys_only = LayeredAgent()
    action, data = keys_only.act(FakeFrame(grid, available=[1, 2, 3, 4]))
    assert action in (
        GameAction.ACTION1,
        GameAction.ACTION2,
        GameAction.ACTION3,
        GameAction.ACTION4,
    )
    assert data == {}


def test_keyboard_layer_needs_a_DIRECTION_not_merely_a_simple_action() -> None:
    """`ACTION5` alone gives the pixel agent nothing to steer with.

    Routing to it there would spend the entire budget issuing an action it has
    no model of, while the click layer sat unused.
    """
    agent = LayeredAgent()
    action, _ = agent.act(FakeFrame(_two_object_grid(), available=[5, 6]))
    assert action == GameAction.ACTION6


def test_both_layers_are_tried_before_either_is_trusted() -> None:
    """Unexplored-first is load-bearing, not tidiness.

    Without it the tie at zero evidence resolves by list order every frame, so
    the click layer is never tried on an environment that also offers a
    direction — and the agent reports a modality it never compared to anything.
    """
    agent = LayeredAgent()
    grid = _two_object_grid()
    for _ in range(3):
        agent.act(FakeFrame(grid, available=[1, 2, 3, 4, 6]))
    assert {KEYBOARD, CLICK} <= set(agent.evidence)


@pytest.mark.parametrize("responsive", [CLICK, KEYBOARD])
def test_the_layer_that_moves_the_world_wins(responsive: str) -> None:
    """The chooser's whole rule: the connected layer is the one the world answers.

    PAIRED ON PURPOSE, and the pairing is the falsifier rather than decoration.
    The first version of this test ran only the click-responsive world and
    asserted `evidence[CLICK] > evidence[KEYBOARD]` — which passed even with the
    credit function hardwired to `changed = True`, because whichever layer holds
    the wheel simply acts more often and accumulates more credit. A test that
    survives deleting the mechanism it is named after is measuring nothing.
    (Measured: that mutation left all 68 tests green.)

    Running BOTH worlds fixes it. If credit ignored whether the world moved, the
    agent would converge on the same layer in both — so one of the two rows must
    fail. It is the DIFFERENCE between the rows that carries the claim, which no
    single-world assertion can express.
    """
    agent = LayeredAgent()
    grid = [row[:] for row in _two_object_grid()]
    chosen: list[GameAction] = []
    for tick in range(16):
        action, _ = agent.act(FakeFrame(grid, available=[1, 2, 3, 4, 6]))
        chosen.append(action)
        acted = CLICK if action == GameAction.ACTION6 else KEYBOARD
        if acted == responsive:
            grid[tick % 10][(tick * 3) % 10] ^= 5  # only this layer moves this world

    expected = GameAction.ACTION6 if responsive == CLICK else None
    tail = chosen[-4:]
    if expected is not None:
        assert tail == [expected] * 4, chosen
    else:
        assert all(a != GameAction.ACTION6 for a in tail), chosen
    assert (
        agent.evidence[responsive]
        > agent.evidence[KEYBOARD if responsive == CLICK else CLICK]
    ), agent.evidence


@pytest.mark.parametrize(
    "offered", [[1], [2], [3], [4], [1, 2], [3, 4], [1, 4], [1, 2, 3, 4]]
)
def test_the_agent_never_emits_an_action_the_frame_did_not_offer(
    offered: list[int],
) -> None:
    """The defect this package exists to avoid, found IN this package.

    `available_actions` is per-frame and an environment may offer a SUBSET of
    the four directions. `PixelAgent` had all four wired in as constants — its
    router, its greedy fallback and its probe all assumed them — so pointed at a
    frame offering only `ACTION1`/`ACTION2` it emitted `ACTION4` on EVERY TICK
    of the episode. No crash, no warning: the entire budget spent on a move the
    environment never offered, scoring zero with nothing in the output to say
    why.

    Measured, not hypothesised — reproduced on the code as first written, hours
    after writing the module whose whole thesis is that an action space must be
    read rather than assumed.

    Parametrised over subsets rather than asserted on one, because a fix that
    happens to work for `{1,2}` and not `{3}` is the kind that passes a single
    example. The single-action rows are the sharp ones: there is no room for a
    near-miss to hide in them.
    """
    agent = LayeredAgent()
    grid = _two_object_grid()
    emitted = [agent.act(FakeFrame(grid, available=offered))[0] for _ in range(8)]
    illegal = [a.name for a in emitted if a.value not in offered]
    assert not illegal, f"offered {offered}, emitted illegal {illegal}"


def test_the_router_plans_only_through_moves_it_is_allowed_to_make() -> None:
    """A route is worthless if its steps are not on offer.

    Distinct from the emitted-action test, which watches what comes OUT: this
    pins that the BFS itself is restricted, so the agent never commits to a plan
    it will then be unable to follow.

    Both halves matter, and the second was found by getting this test wrong
    first. With only the vertical axis legal, a target off the agent's column is
    genuinely UNREACHABLE — and the router must say so by returning nothing,
    not by routing through a move it may not make. The first version of this
    test asked for exactly that impossible route and read the correct empty
    answer as a failure.
    """
    agent = PixelAgent()
    agent._step_px = 1.0
    me = Component(colour=9, area=1, cx=0.5, cy=0.5)
    vertical = (GameAction.ACTION1, GameAction.ACTION2)

    same_column = Component(colour=4, area=1, cx=0.5, cy=5.5)
    route = agent._route_plan(me, [same_column], 10, 10, vertical)
    assert route, (
        "reachable target produced no route — the assertion below would be vacuous"
    )
    assert all(step in vertical for step in route), route

    off_column = Component(colour=4, area=1, cx=5.5, cy=5.5)
    assert agent._route_plan(me, [off_column], 10, 10, vertical) == [], (
        "routed to a target unreachable within the legal action space"
    )


@pytest.mark.parametrize("offered", [[1], [2], [3], [1, 3]])
def test_the_PROBE_is_legal_too_on_a_frame_with_nothing_to_steer_by(
    offered: list[int],
) -> None:
    """The branch the other action-space tests do not reach, and it was unfalsified.

    `PixelAgent.act` returns early when the frame holds fewer than two
    components — the opening frame of a level, measured to contain the agent
    before the goal and walls are drawn. That path had its own hardcoded
    `ACTION4`, and the parametrised emitted-action test above never reaches it
    because its fixture always has two objects.

    Found by BREAK-RED rather than by reading: reverting the probe to
    `GameAction.ACTION4` left all 79 tests green, which means that half of the
    fix was decoration. A fix no test can refute is not a fix; this is the
    refutation.
    """
    agent = LayeredAgent()
    lonely = [[0] * 10 for _ in range(10)]
    lonely[4][4] = 7  # exactly one component: nothing to steer by
    emitted = [agent.act(FakeFrame(lonely, available=offered))[0] for _ in range(4)]
    illegal = [a.name for a in emitted if a.value not in offered]
    assert not illegal, f"probe emitted {illegal} when only {offered} was offered"


def test_the_projection_tie_breaks_deterministically() -> None:
    """A target exactly diagonal ties two legal moves; DST needs one answer.

    An episode that cannot be replayed cannot be debugged, so the tie is broken
    by action id rather than by dict order — and pinned here so a later
    refactor that reorders `ACTION_VECTORS` cannot silently change replays.
    """
    grid = [[0] * 10 for _ in range(10)]
    grid[0][0] = 9
    grid[5][5] = 4
    runs = [
        [
            LayeredAgent().act(FakeFrame(grid, available=[1, 2, 3, 4]))[0]
            for _ in range(5)
        ]
        for _ in range(3)
    ]
    assert runs[0] == runs[1] == runs[2], runs


def test_an_unmodelled_action_set_still_advances_the_episode() -> None:
    """Neither layer applies. Acting beats refusing: the next frame is the only
    way to learn anything, and RESET is excluded because it is not progress."""
    agent = LayeredAgent()
    action, data = agent.act(FakeFrame(_two_object_grid(), available=[0, 5, 7]))
    assert action == GameAction.ACTION5 and data == {}


# ---------------------------------------------------------------- hosted.py


def test_score_level_refuses_to_pay_credit_for_a_missing_reference() -> None:
    """`min(1, h/a)` with an absent `h` read as optimal would hand every level
    of every environment that publishes no baselines a perfect score."""
    assert score_level(18, 18) == 1.0
    assert score_level(36, 18) == 0.25
    assert score_level(9, 18) == 1.0  # faster than reference caps at 1
    assert score_level(18, None) == 0.0
    assert score_level(0, 18) == 0.0


def test_environment_score_denominator_is_declared_levels_not_played_levels() -> None:
    """Otherwise quitting after level 1 is the highest-scoring strategy available."""
    from zeta_arc.hosted import LevelResult

    cleared_one = [LevelResult(0, 10, 10, True, 1.0, "cleared", 7, 40)]
    assert environment_score(cleared_one, total_levels=1) == 1.0
    assert environment_score(cleared_one, total_levels=8) < 0.05


class ScriptedWrapper:
    """A wrapper whose world advances a level every `every` actions."""

    def __init__(
        self, every: int, levels: int, available: list[int] | None = None
    ) -> None:
        self.every = every
        self.levels = levels
        self.available = available if available is not None else [1, 2, 3, 4]
        self.completed = 0
        self.actions = 0
        self.seen: list[tuple[GameAction, dict[str, Any]]] = []

    def _frame(self) -> FakeFrame:
        grid = [[0] * 8 for _ in range(8)]
        grid[self.actions % 8][(self.actions * 3) % 8] = 7
        state = (
            GameState.WIN if self.completed >= self.levels else GameState.NOT_FINISHED
        )
        return FakeFrame(grid, self.available, self.completed, state, raw=True)

    def reset(self) -> FakeFrame:
        self.completed = self.actions = 0
        return self._frame()

    def step(self, action: GameAction, data: dict[str, Any] | None = None) -> FakeFrame:
        self.seen.append((action, data or {}))
        self.actions += 1
        if self.actions % self.every == 0:
            self.completed += 1
        return self._frame()


def test_the_loop_counts_levels_from_the_frames_own_counter() -> None:
    """`levels_completed` is what the scoring is defined against, so it is what
    is read — no proxy to get wrong, which `play.py` had to learn twice."""
    result = play_environment(ScriptedWrapper(every=5, levels=3), references=[5, 5, 5])
    assert result["levels_cleared"] == 3
    assert [entry["actions"] for entry in result["levels"]] == [5, 5, 5]
    assert result["environment_score"] == 1.0
    assert result["terminated"] == "win"


def test_the_loop_stops_on_the_per_level_budget_and_scores_the_level_zero() -> None:
    """A level nobody clears is a zero, recorded — not a run that hangs."""
    result = play_environment(
        ScriptedWrapper(every=10_000, levels=1),
        references=[10],
        max_actions_per_level=25,
    )
    assert result["terminated"] == "level-budget"
    assert result["levels_cleared"] == 0
    assert result["levels"][0]["score"] == 0.0


def test_the_episode_budget_bounds_a_world_that_clears_every_action() -> None:
    """Per-level budget alone does not bound the run — this is the guard that does."""
    result = play_environment(
        ScriptedWrapper(every=1, levels=10_000),
        references=[1] * 50,
        total_levels=10_000,
        max_actions_per_episode=40,
    )
    assert result["terminated"] == "episode-budget"
    assert result["actions_total"] == 40


def test_the_two_budget_exits_are_DISTINGUISHABLE_not_merely_both_zero() -> None:
    """The divergence, and why it is not a logging nit.

    Both budget exits score zero, so `environment_score` never noticed the
    difference — which is exactly why the asymmetry survived: the number was
    right and the evidence was gone. Aaron 2026-08-25: "this is divergence worth
    tracking in our base BNNs."

    They are different evidence about the agent. `level-budget` says THIS LEVEL
    defeated the policy. `episode-budget` says cumulative slowness ran the clock
    out while the agent happened to be standing here — evidence about pacing
    across levels, and none at all about this one. A learner that cannot tell
    them apart attributes a cumulative failure to whichever level it landed on,
    and teaches itself something false about a level it never got a fair attempt
    at.

    PAIRED, because the claim is about the DIFFERENCE. Two runs of the same
    unsolvable world, identical in score and in `solved`, separated only by
    which ceiling was reached first — a single-run assertion cannot express
    that, and would pass against a hardcoded constant.
    """
    by_level = play_environment(
        ScriptedWrapper(every=10_000, levels=1),
        references=[10],
        max_actions_per_level=25,
        max_actions_per_episode=10_000,
    )
    by_episode = play_environment(
        ScriptedWrapper(every=10_000, levels=1),
        references=[10],
        max_actions_per_level=10_000,
        max_actions_per_episode=25,
    )

    # Indistinguishable on everything the score can see...
    for result in (by_level, by_episode):
        assert result["levels_cleared"] == 0
        assert result["environment_score"] == 0.0
        assert len(result["levels"]) == 1
        assert result["levels"][0]["actions"] == 25
        assert result["levels"][0]["solved"] is False

    # ...and separated exactly where the cause lives.
    assert by_level["levels"][0]["ended"] == "level-budget"
    assert by_episode["levels"][0]["ended"] == "episode-budget"
    assert by_level["ended_breakdown"] == {"level-budget": 1}
    assert by_episode["ended_breakdown"] == {"episode-budget": 1}


def test_the_episode_budget_no_longer_drops_the_level_it_was_playing() -> None:
    """The fix itself: the level-budget exit always recorded the unfinished
    level; this one used to break without recording anything."""
    result = play_environment(
        ScriptedWrapper(every=10_000, levels=1),
        references=[10],
        max_actions_per_level=10_000,
        max_actions_per_episode=13,
    )
    assert result["terminated"] == "episode-budget"
    assert result["levels"], "the level in progress was dropped"
    assert result["levels"][0]["actions"] == 13, result["levels"]


def test_a_level_never_played_gets_no_row_at_all() -> None:
    """The guard on the fix, and it needs one.

    The episode-budget check runs at the TOP of the loop, so a budget reached
    exactly as a level is cleared would record the NEXT level with zero actions
    — a row claiming a 0-action failure on a level nobody ever attempted, which
    is worse than the silent drop this change is fixing.

    Built to hit that boundary precisely: the wrapper clears a level on action
    10 and the episode ceiling is 10, so the loop returns to the top with the
    level advanced and `actions_this_level` back to zero.
    """
    result = play_environment(
        ScriptedWrapper(every=10, levels=5),
        references=[10] * 5,
        total_levels=5,
        max_actions_per_level=10_000,
        max_actions_per_episode=10,
    )
    assert result["terminated"] == "episode-budget"
    assert [entry["ended"] for entry in result["levels"]] == ["cleared"], result[
        "levels"
    ]
    assert all(entry["actions"] > 0 for entry in result["levels"])


def test_the_breakdown_key_order_is_deterministic() -> None:
    """This lands in JSON that gets diffed across runs.

    Insertion order would track which reason happened first, so two identical
    outcomes would render as a change.
    """
    from zeta_arc.hosted import _tally

    assert list(_tally(["win", "cleared", "level-budget", "cleared"])) == [
        "cleared",
        "level-budget",
        "win",
    ]
    assert _tally([]) == {}


def test_the_loop_sends_coordinates_with_a_coordinate_action() -> None:
    """A click with no `{x, y}` validates into `x=0, y=0` and clicks the corner
    forever — a silent wrong answer, which is why the agent returns data."""
    wrapper = ScriptedWrapper(every=10_000, levels=1, available=[6])
    play_environment(wrapper, references=[10], max_actions_per_level=12)
    assert wrapper.seen and all(
        action == GameAction.ACTION6 for action, _ in wrapper.seen
    )
    assert all(set(data) == {"x", "y"} for _, data in wrapper.seen)
    assert len({(d["x"], d["y"]) for _, d in wrapper.seen}) > 1, "clicked one point"


def test_a_failed_reset_returns_a_result_rather_than_raising() -> None:
    """`reset()` returns `None` on failure (it logs and swallows); the lane
    degrades rather than failing, which is the design doc's §3.2 rule."""

    class DeadWrapper:
        def reset(self) -> None:
            return None

        def step(self, action: GameAction, data: dict[str, Any] | None = None) -> None:
            raise AssertionError("must not step after a failed reset")

    assert play_environment(DeadWrapper())["terminated"] == "reset-failed"


# ------------------------------------------- the guard on the unreachable part


def test_wrapper_protocol_conformance() -> None:
    """The real `EnvironmentWrapper` still has the methods the delegation calls.

    THIS IS THE ONE TEST THAT GUARDS CODE NO LOCAL RUN REACHES. `arcade.make()`
    needs a key and a network, neither of which exists here, so `play_hosted`
    is never executed by this suite. It cannot be: what it can be is one call
    whose contract is checked.

    Explicitly NOT a proof that hosted play works. It is a proof that the names
    and shapes have not moved under us — the drift class that would otherwise
    surface as a red CI run with nothing to reproduce locally, on a toolkit
    that is pre-1.0 and says so.
    """
    # Bound as `Any` BEFORE the isinstance: narrowing `EnvironmentWrapper` to
    # `type` would make mypy reject every attribute access below, since `type`
    # has no `reset`. The check still runs — it just does not eat the name.
    wrapper_cls: Any = EnvironmentWrapper
    assert isinstance(EnvironmentWrapper, type)

    reset_sig = inspect.signature(wrapper_cls.reset)
    assert list(reset_sig.parameters) == ["self"], reset_sig

    step_sig = inspect.signature(wrapper_cls.step)
    names = list(step_sig.parameters)
    assert names[:3] == ["self", "action", "data"], step_sig
    assert step_sig.parameters["data"].default is None, (
        "step's `data` stopped being optional; the keyboard layer sends none"
    )
    assert isinstance(wrapper_cls.action_space, property)
    assert isinstance(wrapper_cls.info, property)


def test_the_scripted_wrapper_is_not_the_only_thing_satisfying_the_protocol() -> None:
    """A fake that drifts into being the sole conformer proves nothing.

    `Wrapper` is a plain `Protocol` (not runtime-checkable — it has methods with
    signatures, and `isinstance` against those only checks the names exist), so
    conformance is asserted by structure here and by signature above.
    """
    wrapper_cls: Any = EnvironmentWrapper
    for method in ("reset", "step"):
        assert hasattr(wrapper_cls, method)
        assert hasattr(ScriptedWrapper, method)
    assert set(Wrapper.__protocol_attrs__) <= set(dir(wrapper_cls))  # type: ignore[attr-defined]


# ------------------------------------ the loop against our REAL environments


class OwnGameWrapper:
    """Drives a Zeta-authored game through the hosted loop's protocol.

    NOT a test double — the game underneath is the real `ZetaChase` /
    `ZetaDiscovery`, driven through `driver.py`'s real `advance`/`reset`. Only
    the two-method surface is adapted, because our games are objects we hold
    and hosted ones are downloaded, which is the whole reason `hosted.py` and
    `driver.py` are separate files.

    What this buys: the loop's level accounting, budget, scoring and agent are
    exercised against an environment nobody wrote for them.
    """

    def __init__(self, game: Any) -> None:
        self.game = game

    def reset(self) -> Any:
        return reset(self.game)

    def step(self, action: GameAction, data: dict[str, Any] | None = None) -> Any:
        return advance(self.game, action, **(data or {}))


def test_the_hosted_loop_clears_a_real_environment_end_to_end() -> None:
    """End to end on a real game: the loop clears levels it was not written for.

    ZetaChase is a keyboard environment, so this exercises the layer chooser's
    keyboard branch, the pixel agent, `levels_completed` accounting, scoring and
    the budget against a real engine — everything except the download.
    """
    result = play_environment(
        OwnGameWrapper(ZetaChase(seed=4)), references=[8, 8, 8], total_levels=3
    )
    assert result["levels_cleared"] >= 1, result
    assert result["actions_total"] > 0
    assert result["terminated"] in {
        "win",
        "all-levels",
        "level-budget",
        "episode-budget",
    }
    assert result["environment_score"] > 0.0


def test_the_hosted_loop_records_a_zero_rather_than_inventing_progress() -> None:
    """The other half, and the one that would be tempting to skip.

    ZetaDiscovery is the curriculum the pixel agent DOES NOT SOLVE — recorded,
    not incidental: `test_discovery.py` asserts it outright and says to invert
    that assertion if it ever changes. So this environment is the available
    test of what the loop does when the agent simply fails, which is the case a
    scoring loop is most likely to get quietly wrong.

    Written this way after the first version asserted `levels_cleared >= 1` here
    too and failed. The assertion was wrong, not the loop — and weakening it to
    `>= 0` would have been the vacuous move, since that holds for every possible
    result. What is asserted instead is the property that actually matters: an
    unsolved level is a recorded ZERO, with the actions spent visible, and the
    environment score does not quietly credit the levels never reached.
    """
    result = play_environment(
        OwnGameWrapper(ZetaDiscovery(seed=4)),
        references=[8, 8, 8],
        total_levels=3,
        max_actions_per_level=120,
    )
    assert result["levels_cleared"] == 0, (
        "the pixel agent cleared a discovery level through the hosted loop — the "
        "frontier moved; invert this and `test_discovery.py`'s twin, and say what changed"
    )
    assert result["terminated"] == "level-budget"
    assert result["actions_total"] == 120, "it stopped early or overran the budget"
    assert result["levels"] == [
        {
            "level": 0,
            "actions": 120,
            "reference": 8,
            "solved": False,
            "score": 0.0,
            "ended": "level-budget",
            # ENGAGED, AND STILL LOST — the distinction the old row could not
            # draw. 17 distinct worlds and 15,360 changed cells is not a policy
            # sitting inert on an illegal action; it is one playing and failing.
            # Before these two fields this row was byte-identical to a run that
            # never moved anything, and the two call for opposite fixes.
            "distinct_grids": 17,
            "cells_changed": 15360,
        }
    ]
    assert result["ended_breakdown"] == {"level-budget": 1}
    assert result["environment_score"] == 0.0


# THE DISCRIMINATION PROOF. Two counts that never differ are two counts nobody
# needs, and "22 rows are byte-identical" was the ORIGINAL defect — so a proxy
# that also collapses would have reproduced the bug in a new field.
#
# The pair is what makes this falsifiable: one policy is handed a frozen world,
# the other a changing one, and the SAME probe must separate them. Hardwire
# either count to a constant and one half fails.
def test_the_probe_separates_an_INERT_level_from_an_ENGAGED_one() -> None:
    from zeta_arc.progress import LevelProbe, hamming

    frozen = [[0, 0], [0, 0]]

    inert = LevelProbe()
    for _ in range(20):
        inert.observe(frozen)

    engaged = LevelProbe()
    for i in range(20):
        engaged.observe([[i % 3, 0], [0, (i + 1) % 2]])

    # The inert world was OBSERVED (1, never 0) but never MOVED.
    assert inert.distinct_grids == 1, "a still world is one world, not zero"
    assert inert.cells_changed == 0

    assert engaged.distinct_grids > 1, "a changing world must not read as inert"
    assert engaged.cells_changed > 0

    # And the separation is the point, stated as the comparison itself so that
    # equalising the two — by any means — fails here.
    assert engaged.distinct_grids > inert.distinct_grids
    assert engaged.cells_changed > inert.cells_changed

    # A RESIZED grid is a full-grid difference, never a silent overlap compare.
    # Zipping ragged rows would under-report exactly when the world changed most.
    assert hamming([[1, 1]], [[1, 1], [1, 1]]) == 4

    # reset() must not carry one level's engagement into the next.
    engaged.reset()
    assert engaged.distinct_grids == 0 and engaged.cells_changed == 0
