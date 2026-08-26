"""Play a HOSTED ARC environment — the loop above the toolkit's wrapper.

WHY THIS IS SEPARATE FROM `driver.py`, which already says it is the one seam.
It still is, for the environments we author: we hold the game object and call
`perform_action` on it. A hosted environment is not an object we hold — it is
downloaded and driven through `EnvironmentWrapper`, and its frames come back as
`FrameDataRaw` rather than `FrameData`. Two doors, and `driver.py`'s docstring
already named the difference; this is the second door.

THE SHAPE OF THE HONESTY PROBLEM HERE, stated up front because it governs how
the file is written. `ARC_API_KEY` is not present in the container this was
written in, so NO HOSTED ENVIRONMENT COULD BE PLAYED WHILE WRITING THIS. An
unfalsified loop is exactly what this repo refuses, so the code is split by what
can be checked:

  - Everything that DECIDES anything — budget, level accounting, scoring,
    clear-detection, the agent — lives above the wrapper and is exercised by
    tests against in-process fakes and against our own environments.
  - The part that cannot be checked here is the wrapper itself, and it is kept
    to pure delegation: `reset()`, `step(action, data)`, `.info`. No logic.
  - That delegation is guarded by a SIGNATURE-CONFORMANCE test against the
    real installed `EnvironmentWrapper` class. It cannot prove hosted play
    works. It does catch the drift class that would silently break it — a
    renamed method, a reordered parameter — which is the failure that would
    otherwise be found by a red CI run with no local reproduction.

`h` IS NOT INVENTED HERE, and that is the payoff from having read the roster
first. ARC's level score is `min(1, h/a)**2` where `h` is a reference action
count. `play.py` substitutes BFS-optimal for our own environments and says so,
because offline there is nothing else. Hosted environments PUBLISH it:
`EnvironmentInfo.baseline_actions` is a per-level reference count (SB26 reports
`[18, 28, 18, 19, 31, 23, 58, 18]`). So hosted scores use the environment's own
reference and are comparable in a way the offline ones are not.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Protocol

from arcengine import GameAction, GameState

from zeta_arc.frames import grid_of
from zeta_arc.layered import LayeredAgent
from zeta_arc.progress import LevelProbe

#: Per-level ceiling. Deliberately generous against the published references —
#: the largest `baseline_actions` entry on the live roster is 578 (DC22), and a
#: ceiling below the REFERENCE PLAYER's own count would score an agent as
#: failed on a level nobody clears that fast. Read off the roster, not chosen.
MAX_ACTIONS_PER_LEVEL = 800

#: Whole-episode ceiling, because per-level alone does not bound the run: an
#: environment reporting a level cleared every action would loop forever inside
#: the per-level budget. 10 levels is the roster's maximum level count.
MAX_ACTIONS_PER_EPISODE = MAX_ACTIONS_PER_LEVEL * 12


class Wrapper(Protocol):
    """The slice of `EnvironmentWrapper` this loop uses.

    Structural, so the loop can be driven by anything that behaves like one —
    which is what makes the tests possible without a network. The conformance
    test asserts the REAL class satisfies it, so the fake cannot drift into
    being the only thing that does.
    """

    def reset(self) -> Any: ...

    def step(self, action: GameAction, data: dict[str, Any] | None = ...) -> Any: ...


@dataclass(frozen=True)
class LevelResult:
    level: int
    actions: int
    reference: int | None
    solved: bool
    score: float
    #: WHY THIS LEVEL ENDED — not the same question as why the episode ended,
    #: and conflating them is a credit-assignment error rather than a lost log
    #: line. `level-budget` says THIS LEVEL defeated the policy: evidence about
    #: this level and this policy on it. `episode-budget` says cumulative
    #: slowness ran the clock out while the agent happened to be standing here:
    #: evidence about pacing ACROSS levels, and none at all about this one.
    #:
    #: A learner that cannot tell them apart attributes a cumulative failure to
    #: whichever level it landed on — it teaches itself something false about a
    #: level it was never actually given a fair attempt at. Aaron 2026-08-25, on
    #: the asymmetry that produced this field: "this is divergence worth
    #: tracking in our base BNNs."
    ended: str
    #: GRID-DERIVED ENGAGEMENT, and the reason the two `game-over` rows below
    #: are no longer byte-identical. NOT the engine's score — that field is not
    #: transmitted at all (see the GAME_OVER comment in `play_environment`), so
    #: this is inferred by our own perception. `distinct_grids == 1` means the
    #: policy never moved the world; a large count means it did and still lost.
    #: Those call for opposite fixes and used to record identically.
    distinct_grids: int
    cells_changed: int


def score_level(actions: int, reference: int | None) -> float:
    """ARC's level score: `min(1, h/a)**2`, and `0.0` when `h` is unknown.

    An unknown reference scores ZERO rather than 1.0, and the choice matters:
    `min(1, h/a)` with a missing `h` treated as "as good as optimal" would hand
    a perfect score to every level of every environment that publishes no
    baselines. A missing reference is missing information, and information we
    do not have may not be spent as credit. The level still counts as CLEARED —
    `solved` and `score` are separate fields for exactly this reason.
    """
    if actions <= 0 or reference is None or reference <= 0:
        return 0.0
    return min(1.0, reference / actions) ** 2


def environment_score(levels: list[LevelResult], total_levels: int) -> float:
    """Level-weighted mean, `E = sum((l+1) * S_l) / (n(n+1)/2)`.

    The denominator uses the environment's DECLARED level count, not the number
    played. An agent that clears two of eight levels and stops must not be
    scored as if the environment had two levels — that would make quitting
    early the highest-scoring strategy available.
    """
    if total_levels <= 0:
        return 0.0
    weighted = sum((entry.level + 1) * entry.score for entry in levels)
    return weighted / (total_levels * (total_levels + 1) / 2)


def play_environment(
    wrapper: Wrapper,
    references: list[int] | None = None,
    total_levels: int | None = None,
    max_actions_per_level: int = MAX_ACTIONS_PER_LEVEL,
    max_actions_per_episode: int = MAX_ACTIONS_PER_EPISODE,
) -> dict[str, Any]:
    """One episode against one environment. Returns per-level and aggregate scores.

    LEVEL CLEARANCE IS READ FROM `levels_completed`, not inferred. The frame
    carries it (`arcengine/enums.py:135`), and it is the same counter the
    scoring is defined against — so unlike `play.py`'s offline loop there is no
    proxy to get wrong. `play.py` had to learn that the hard way twice: first
    by watching `level_index`, which never advances on the final level, then by
    comparing the agent cell to the goal cell, which is true for ZetaChase and
    false for any environment whose win is not "stand on the goal".

    `GameState.WIN` still terminates, because the last level's completion and
    the game ending are the same event and only one of them increments.
    """
    references = references or []
    agent = LayeredAgent()

    frame = wrapper.reset()
    if frame is None:
        return {
            "levels": [],
            "levels_cleared": 0,
            "environment_score": 0.0,
            "terminated": "reset-failed",
        }

    declared = total_levels if total_levels is not None else len(references)
    results: list[LevelResult] = []
    level = int(getattr(frame, "levels_completed", 0) or 0)
    actions_this_level = 0
    actions_total = 0
    # ENGAGEMENT, per level. Seeded with the reset frame so a policy that never
    # acts still records the one world it was shown — `distinct_grids == 1`
    # rather than 0, which would read as "never observed" instead of "never
    # moved it". Those are different failures.
    probe = LevelProbe()
    probe.observe(grid_of(frame))
    # NOT A FALLBACK, and the distinction is the whole point of this line.
    #
    # Every `break` below assigns `terminated` before it leaves, so this value is
    # UNOBSERVABLE — the code-quality bot flagged exactly that on 2026-08-25 and
    # it was right about the fact. It was wrong about the fix. Deleting the
    # assignment does not buy static safety: mypy cannot prove exhaustiveness
    # through `while True` + `break`, and `--enable-error-code possibly-undefined`
    # reports "may be undefined" WITH the initializer removed and WITH a `break`
    # that genuinely forgets to assign — the same message either way, so it
    # cannot discriminate the bug from the correct code. Removing the line would
    # trade a silent wrong answer for an `UnboundLocalError` that discards the
    # partial result, with nothing catching either.
    #
    # So the assignment stays and the VALUE changes, because the value was the
    # actual defect. It used to read `"budget"` — a plausible reason that never
    # happened, which is the worst possible thing for an unreachable default to
    # say. If this string is ever observed in output, it is a bug report.
    terminated = "unreachable-no-exit-assigned"

    while True:
        if actions_total >= max_actions_per_episode:
            terminated = "episode-budget"
            # RECORD THE LEVEL IN PROGRESS. The level-budget exit below always
            # did; this one used to drop it silently. Both score zero, so the
            # environment score never noticed — and that is precisely why it
            # went unnoticed: the number was right and the evidence was gone.
            #
            # Guarded on actions spent: the check runs at the top of the loop,
            # so hitting the episode budget immediately after clearing a level
            # would otherwise record a level that was never played. A row
            # claiming a 0-action failure is worse than no row.
            if actions_this_level > 0:
                results.append(
                    LevelResult(
                        level,
                        actions_this_level,
                        _reference(references, level),
                        False,
                        0.0,
                        "episode-budget",
                        probe.distinct_grids,
                        probe.cells_changed,
                    )
                )
            break
        if actions_this_level >= max_actions_per_level:
            results.append(
                LevelResult(
                    level,
                    actions_this_level,
                    _reference(references, level),
                    False,
                    0.0,
                    "level-budget",
                    probe.distinct_grids,
                    probe.cells_changed,
                )
            )
            terminated = "level-budget"
            break

        action, data = agent.act(frame)
        frame = wrapper.step(action, data)
        actions_this_level += 1
        actions_total += 1
        if frame is None:
            terminated = "step-failed"
            break

        probe.observe(grid_of(frame))
        completed = int(getattr(frame, "levels_completed", 0) or 0)
        state = getattr(frame, "state", None)
        if completed > level or state == GameState.WIN:
            reference = _reference(references, level)
            results.append(
                LevelResult(
                    level,
                    actions_this_level,
                    reference,
                    True,
                    score_level(actions_this_level, reference),
                    "cleared",
                    probe.distinct_grids,
                    probe.cells_changed,
                )
            )
            if state == GameState.WIN:
                terminated = "win"
                break
            level = completed
            actions_this_level = 0
            probe.reset()
            probe.observe(grid_of(frame))
            if declared and len(results) >= declared:
                terminated = "all-levels"
                break
        elif state == GameState.GAME_OVER:
            # WHAT THIS ROW CANNOT SAY, recorded because the obvious fix does
            # not exist and the next reader will reach for it.
            #
            # After the first hosted sweep (2026-08-25) 22 of 25 environments
            # ended here on level 0, and every one of those rows is
            # byte-identical: `solved=False, score=0.0`. A policy that never
            # engaged the level and one that died a step from winning produce
            # the same record, and they call for opposite fixes. The natural
            # instrument is the engine's own score, so: it is NOT reachable.
            #
            # `arcengine.base_game` does hold `_score`/`_win_score` and does
            # pass `score=`/`win_score=` when it builds the frame — but neither
            # `FrameData` nor `FrameDataRaw` (`arcengine/enums.py:131,149`)
            # DECLARES those fields, and pydantic drops unknown kwargs silently.
            # The frame an agent receives carries `levels_completed` and
            # `win_levels` and nothing finer. So the engine measures intra-level
            # progress and never transmits it, and a `game_score` field added
            # here would read `None` in production and in every test forever —
            # a progress record that constrains nothing.
            #
            # Intra-level progress therefore has to be INFERRED from the grid by
            # our own perception, not read from the API. That is a real piece of
            # work, not a field.
            results.append(
                LevelResult(
                    level,
                    actions_this_level,
                    _reference(references, level),
                    False,
                    0.0,
                    "game-over",
                    probe.distinct_grids,
                    probe.cells_changed,
                )
            )
            terminated = "game-over"
            break

    return {
        "levels": [entry.__dict__ for entry in results],
        # THE DIVERGENCE, COUNTED. Per-level reasons roll up here so the shape
        # is readable without walking every row — and across a 25-environment
        # sweep this is the number that says whether the BUDGET is wrong rather
        # than the agent. Many `level-budget` rows means levels are defeating
        # the policy; many `episode-budget` rows means the episode ceiling cut
        # runs off before the levels ever got a fair attempt, and raising the
        # per-level budget would do nothing at all.
        "ended_breakdown": _tally(entry.ended for entry in results),
        # ENGAGEMENT, ROLLED UP. `inert_levels` is the one number that would
        # have made the first sweep readable: levels where the world never
        # changed at all. A high count means the policy is not playing — an
        # illegal-action or perception failure — and no per-level budget rise
        # would help. A low count with zero cleared means it IS playing and
        # losing, which is a different problem entirely.
        "inert_levels": sum(1 for entry in results if entry.distinct_grids <= 1),
        "cells_changed_total": sum(entry.cells_changed for entry in results),
        "levels_cleared": sum(1 for entry in results if entry.solved),
        "levels_declared": declared,
        "actions_total": actions_total,
        "environment_score": round(
            environment_score(results, declared or len(results)), 4
        ),
        "terminated": terminated,
    }


def _tally(reasons: Iterable[str]) -> dict[str, int]:
    """Count reasons, in a deterministic key order.

    Sorted rather than insertion-ordered because this lands in JSON that gets
    diffed across runs, and a dict whose key order tracks which reason happened
    first makes two identical outcomes look like a change.
    """
    counts: dict[str, int] = {}
    for reason in reasons:
        counts[reason] = counts.get(reason, 0) + 1
    return {k: counts[k] for k in sorted(counts)}


def _reference(references: list[int], level: int) -> int | None:
    """The published reference for a level, or `None` when there is not one.

    `None` rather than a guessed default: `score_level` refuses to pay credit
    for information we do not have, and it can only do that if "absent" is
    representable.
    """
    return references[level] if 0 <= level < len(references) else None


def play_hosted(arcade: Any, game_id: str, seed: int = 4) -> dict[str, Any]:
    """Download one hosted environment and play it. Pure delegation, no logic.

    Everything decidable is in `play_environment`. This function exists to be
    the ONLY unfalsifiable line in the lane — `arcade.make` needs a key and a
    network — so that when the hosted path is finally exercised in CI, the part
    that was never run locally is one call and its arguments.
    """
    wrapper = arcade.make(game_id, seed=seed)
    if wrapper is None:
        return {
            "game_id": game_id,
            "error": "make-returned-none",
            "environment_score": 0.0,
        }
    info = wrapper.info
    result = play_environment(
        wrapper,
        references=list(info.baseline_actions or []),
        total_levels=len(info.baseline_actions or []) or None,
    )
    return {"game_id": game_id, "title": info.title, **result}


def play_roster(
    arcade: Any,
    max_environments: int | None = None,
    max_actions_per_level: int = MAX_ACTIONS_PER_LEVEL,
    seed: int = 4,
) -> dict[str, Any]:
    """Play every hosted environment this key can see, and report the sweep.

    ONE ENVIRONMENT'S FAILURE MUST NOT END THE SWEEP. A roster run that dies on
    environment 3 of 25 reports nothing about the other 22, and the most likely
    cause — a download error, an unfamiliar action set, a game whose reset
    returns `None` — is exactly the thing a first sweep exists to discover. So
    each environment is played inside a `try` and a failure becomes a row.

    THE BUDGET IS REPORTED BECAUSE IT CHANGES WHAT THE NUMBER MEANS. Under a
    truncated `max_actions_per_level` these are not leaderboard scores and must
    not be quoted as if they were: an agent cut off at 120 actions on a level
    whose published reference is 578 has not been measured against that level,
    it has been prevented from reaching it. The field is in the output so the
    caveat travels with the number rather than living in a commit message.
    """
    environments = sorted(arcade.get_environments(), key=lambda e: e.game_id)
    if max_environments is not None:
        environments = environments[:max_environments]

    played: list[dict[str, Any]] = []
    for info in environments:
        try:
            wrapper = arcade.make(info.game_id, seed=seed)
            if wrapper is None:
                played.append(
                    {
                        "game_id": info.game_id,
                        "error": "make-returned-none",
                        "environment_score": 0.0,
                    }
                )
                continue
            references = list(info.baseline_actions or [])
            result = play_environment(
                wrapper,
                references=references,
                total_levels=len(references) or None,
                max_actions_per_level=max_actions_per_level,
            )
            played.append({"game_id": info.game_id, "title": info.title, **result})
        except Exception as error:  # noqa: BLE001 — a sweep reports failures, it does not inherit them
            played.append(
                {
                    "game_id": info.game_id,
                    "error": type(error).__name__,
                    "detail": str(error)[:200],
                    "environment_score": 0.0,
                }
            )

    scored = [row for row in played if "error" not in row]
    return {
        "environments_seen": len(environments),
        "environments_played": len(scored),
        "environments_failed": len(played) - len(scored),
        "levels_cleared_total": sum(
            int(row.get("levels_cleared", 0)) for row in scored
        ),
        # The same divergence at roster scale. Across 25 environments this is
        # the fastest read on whether the ceilings are shaped right.
        "ended_breakdown": _tally(
            reason
            for row in scored
            for reason, count in dict(row.get("ended_breakdown", {})).items()
            for _ in range(int(count))
        ),
        "mean_environment_score": (
            round(
                sum(float(row["environment_score"]) for row in scored) / len(scored), 4
            )
            if scored
            else 0.0
        ),
        "max_actions_per_level": max_actions_per_level,
        "comparability": (
            "NOT leaderboard-comparable while `max_actions_per_level` is below the "
            "largest published `baseline_actions` (578 on the live roster): a level "
            "the agent was cut off before reaching was not measured, only prevented."
        ),
        "results": played,
    }
