"""Pure full old-control replay from independent software binary64 operations.

The contract is unchanged HiddenSwitchReceipt.Episode for belief-depth3, including
old Q arrays/counters. Expected numeric fields are bit strings; decoded native
numbers are compared by exact binary64 bits, never a tolerance. struct is used
only to inspect a Python float's representation. A decoder that already collapsed
lexical -0 to int(0) has lost information this boundary cannot recover.

No old Python runner, filesystem, runtime collector, source generator or numerical
cache is used; no certificate is built or admitted. Success names only this slice.
"""

from __future__ import annotations

import hashlib
import struct
from collections.abc import Callable
from dataclasses import asdict, dataclass
from fractions import Fraction
from typing import cast

from . import hidden_switch_compiled_certificate as c
from . import hidden_switch_compiled_ieee as s
from . import hidden_switch_compiled_reference as r
from . import hidden_switch_compiled_replay as strict

_KEYS = {
    "Index",
    "Complete",
    "Failure",
    "Cues",
    "Actions",
    "States",
    "Reward4",
    "Beliefs",
    "DecisionQ",
    "TreeRootQ",
    "PlanningCounters",
    "FilterCounters",
    "FrameSha256",
    "ProjectionSha256",
    "TotalReward4",
}
_NUMERIC = {"Beliefs", "DecisionQ", "TreeRootQ"}


@dataclass(frozen=True, slots=True)
class OldReplayCounts:
    Scope: str
    OldControlEpisodes: int
    PlanningRecords: int
    ObservationRecords: int
    NumericValues: int
    RuntimeAndOuterAdmission: str = "not-performed-by-pure-replay"
    FalsifierAdmission: str = "pending-separate-admission"


@dataclass(frozen=True, slots=True)
class OldReplayFailure(s.Failure):
    Path: str
    Completed: OldReplayCounts


def _number(value: object) -> int:
    if type(value) is float:
        # Representation access only: no host arithmetic or numeric tolerance.
        return s._finite(int.from_bytes(struct.pack(">d", value), "big"))
    if type(value) is int:
        bits = s._round(Fraction(value))
        if s._value(bits) != value:
            raise s._Refusal("NumberEncoding", "integer token is not exactly binary64")
        return bits
    raise s._Refusal("NumberEncoding", "finite decoded float or exact integer required")


def decode_old_number_bits(value: object) -> s.Result[int]:
    """Inspect finite float bits or an exactly representable integer token."""
    return s._capture(lambda: _number(value))


def _need[T](result: s.Result[T], path: str) -> T:
    return strict._need(result, path)


def _episode(
    tape: object, effect: object, geometry: object, palette: object, index: object
) -> dict[str, c.Json]:
    source = r._tape(tape)
    actual_effect = r._effect(effect)
    shape = r._member(geometry, ("dot", "bar"), "geometry")
    colors = r._member(palette, ("fixed", "odd-complement"), "palette")
    episode_index = r._integer(index, 0, 1023, "episode index0..1023")
    belief = s.HALF
    state = source.initial
    pending: int | None = None
    previous_reward: int | None = None
    predictions = updates = total = 0
    cues: list[str] = []
    states: list[str] = []
    actions: list[str] = []
    beliefs: list[c.Json] = []
    decisions: list[c.Json] = []
    roots: list[c.Json] = []
    rewards: list[c.Json] = []
    planning: list[c.Json] = []
    frames: list[c.Json] = []
    projections: list[c.Json] = []
    for observation in range(17):
        cue = state ^ source.errors[observation]
        frame = _need(
            r.render(cue, shape, colors, observation, previous_reward), "Render"
        )
        projection = _need(r.project(frame), "Projection")
        decoded = _need(r.decode(projection, shape), "Cue")
        if pending is not None:
            belief = _need(r.predict_bits(belief, pending, actual_effect), "Prediction")
            predictions += 1
        _, belief = _need(r.condition_bits(belief, decoded), "Conditioning")
        updates += 1
        cues.append(str(decoded))
        states.append(str(state))
        beliefs.append(f"{belief:016X}")
        frames.append(hashlib.sha256(frame.Cells).hexdigest().upper())
        projections.append(hashlib.sha256(projection.Cells).hexdigest().upper())
        if observation == 16:
            break
        evaluation = _need(
            r.evaluate_bits(belief, actual_effect, min(3, 16 - observation)), "Planning"
        )
        # Commit from admitted belief/Q before scorer truth or state advancement.
        action = _need(r.select_bits(evaluation.QBits), "Action")
        pending = action
        actions.append(str(action))
        q = [f"{bits:016X}" for bits in evaluation.QBits]
        decisions.append(list(q))
        roots.append(list(q))
        planning.append(asdict(evaluation.Counters))
        previous_reward = 4 * state if action == 0 else -1
        rewards.append(previous_reward)
        total += previous_reward
        state ^= int(actual_effect and action == 1) ^ source.drift[observation]
    return {
        "Index": episode_index,
        "Complete": True,
        "Failure": None,
        "Cues": "".join(cues),
        "Actions": "".join(actions),
        "States": "".join(states),
        "Reward4": rewards,
        "Beliefs": beliefs,
        "DecisionQ": decisions,
        "TreeRootQ": roots,
        "PlanningCounters": planning,
        "FilterCounters": {"Predictions": predictions, "Updates": updates},
        "FrameSha256": frames,
        "ProjectionSha256": projections,
        "TotalReward4": total,
    }


def expected_old_episode_bits(
    tape: object, effect: object, geometry: object, palette: object, index: object = 0
) -> s.Result[dict[str, c.Json]]:
    """Software expectation; old numeric fields are bits, not a native receipt."""
    return s._capture(lambda: _episode(tape, effect, geometry, palette, index))


def _numbers(
    expected: object, actual: object, shape: tuple[int, ...], path: str
) -> None:
    if shape:
        left = strict._array(expected, shape[0], path)
        right = strict._array(actual, shape[0], path)
        for index, (left_item, right_item) in enumerate(zip(left, right)):
            _numbers(left_item, right_item, shape[1:], f"{path}[{index}]")
    else:
        bits = _need(decode_old_number_bits(actual), path)
        strict._same(cast(c.Json, expected), f"{bits:016X}", path)


def _compare(expected: dict[str, c.Json], actual: object, path: str) -> None:
    if expected.keys() != _KEYS:
        raise strict._Mismatch(
            "ReferenceShape", "complete old DTO expectation required", path
        )
    row = strict._object(actual, _KEYS, path)
    for key, expected_value in expected.items():
        position = f"{path}.{key}"
        if key in _NUMERIC:
            _numbers(
                expected_value,
                row[key],
                (17,) if key == "Beliefs" else (16, 2),
                position,
            )
        else:
            strict._same(expected_value, row[key], position)


class _Progress:
    def __init__(self, scope: str):
        self.scope = scope
        self.episodes = 0

    def counts(self) -> OldReplayCounts:
        return OldReplayCounts(
            self.scope,
            self.episodes,
            16 * self.episodes,
            17 * self.episodes,
            81 * self.episodes,
        )

    def compare(
        self,
        actual: object,
        tape: object,
        effect: object,
        geometry: object,
        palette: object,
        index: object,
        path: str,
    ) -> None:
        expected = _need(
            expected_old_episode_bits(tape, effect, geometry, palette, index), path
        )
        _compare(expected, actual, path)
        self.episodes += 1


def _run(
    scope: str, count: int, operation: Callable[[_Progress], None]
) -> s.Result[OldReplayCounts]:
    progress = _Progress(scope)
    try:
        operation(progress)
        if progress.episodes != count:
            raise strict._Mismatch(
                "IncompleteReplay", "complete old slice required", "OldControls"
            )
        return s.Success(progress.counts())
    except strict._Mismatch as failure:
        return OldReplayFailure(
            failure.code, failure.message, failure.path, progress.counts()
        )
    except s._Refusal as failure:
        return OldReplayFailure(
            failure.code, failure.message, "OldControls", progress.counts()
        )


def compare_old_episode(
    actual: object,
    tape: object,
    effect: object,
    geometry: object,
    palette: object,
    index: object = 0,
) -> s.Result[OldReplayCounts]:
    """Compare one supplied-tape old recursive control, including every old field."""
    return _run(
        "one-supplied-tape-old-control-only",
        1,
        lambda progress: progress.compare(
            actual, tape, effect, geometry, palette, index, "Episode"
        ),
    )


def replay_old_hand(rows: object) -> s.Result[OldReplayCounts]:
    """Replay exactly 24 ordered old native-control-shaped hand rows."""

    def operation(progress: _Progress) -> None:
        supplied = strict._array(rows, 24, "OldControls")
        tapes = r.hand_tapes()
        if len(tapes) != 4 or tuple(name for name, _ in tapes) != (
            "zero",
            "one",
            "alternating",
            "sparse",
        ):
            raise strict._Mismatch(
                "ReferenceRoster", "four explicit ordered tapes required", "OldControls"
            )
        index = 0
        for tape_name, tape in tapes:
            for effect in (True, False):
                for geometry, palette in (
                    ("dot", "fixed"),
                    ("bar", "fixed"),
                    ("dot", "odd-complement"),
                ):
                    path = f"OldControls[{index}]"
                    row = strict._object(
                        supplied[index],
                        {"Tape", "Effect", "Geometry", "Palette", "Episode"},
                        path,
                    )
                    header: dict[str, c.Json] = {
                        "Tape": tape_name,
                        "Effect": effect,
                        "Geometry": geometry,
                        "Palette": palette,
                    }
                    for key, value in header.items():
                        strict._same(value, row[key], f"{path}.{key}")
                    progress.compare(
                        row["Episode"],
                        tape,
                        effect,
                        geometry,
                        palette,
                        index,
                        f"{path}.Episode",
                    )
                    index += 1

    return _run("old-hand-only", 24, operation)
