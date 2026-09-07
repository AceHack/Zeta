"""Pure complete scalar/new-hand replay, without outer evidence admission.

The caller supplies decoded row arrays and an independently issued numerical
certificate. Every checked nested key, type, position and value must match the
independent reference. Raw JSON duplicate-key admission, source/runtime/CLI
bindings, 24 old-native controls and falsifier evidence are separate caller
obligations. No filesystem, runtime collector, source generator or numerical
result cache is used. Success means only the explicitly returned replay scope.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict, dataclass
from typing import cast

from . import hidden_switch_compiled_certificate as c
from . import hidden_switch_compiled_ieee as s
from . import hidden_switch_compiled_reference as r


@dataclass(frozen=True, slots=True)
class ReplayCounts:
    Scope: str
    NumericCertificateSha256: str
    ScalarRows: int
    ScalarChoiceRecords: int
    NewHandEpisodes: int
    HandChoiceRecords: int
    HandObservationRecords: int
    OldNativeControls: int = 0
    OldNativeControlAdmission: str = "pending-separate-admission"
    FalsifierAdmission: str = "pending-separate-admission"
    RuntimeAndOuterAdmission: str = "not-performed-by-pure-replay"


@dataclass(frozen=True, slots=True)
class ReplayFailure(s.Failure):
    Path: str
    Completed: ReplayCounts


class _Mismatch(s._Refusal):
    def __init__(self, code: str, message: str, path: str):
        super().__init__(code, message)
        self.path = path


def _same(expected: c.Json, actual: object, path: str) -> None:
    if type(actual) is not type(expected):
        raise _Mismatch("TypeMismatch", "exact JSON field type differs", path)
    if isinstance(expected, dict):
        actual_dict = cast(dict[object, object], actual)
        if expected.keys() != actual_dict.keys():
            raise _Mismatch("KeyMismatch", "missing or extra nested keys", path)
        for key, value in expected.items():
            _same(value, actual_dict[key], f"{path}.{key}")
    elif isinstance(expected, list):
        actual_list = cast(list[object], actual)
        if len(expected) != len(actual_list):
            raise _Mismatch("LengthMismatch", "ordered array length differs", path)
        for index, (left, right) in enumerate(zip(expected, actual_list)):
            _same(left, right, f"{path}[{index}]")
    elif expected != actual:
        raise _Mismatch("ValueMismatch", "value differs from independent replay", path)


def _array(value: object, length: int, path: str) -> list[object]:
    if type(value) is not list:
        raise _Mismatch("TypeMismatch", "decoded JSON row array required", path)
    if len(value) != length:
        raise _Mismatch(
            "LengthMismatch", f"complete ordered {length}-row roster required", path
        )
    return value


def _object(value: object, keys: set[str], path: str) -> dict[str, object]:
    if type(value) is not dict:
        raise _Mismatch("TypeMismatch", "decoded JSON row object required", path)
    if value.keys() != keys:
        raise _Mismatch("KeyMismatch", "missing or extra row keys", path)
    return value


def _need[T](result: s.Result[T], path: str) -> T:
    if isinstance(result, s.Failure):
        raise _Mismatch("ReferenceRefusal", f"{result.Code}: {result.Message}", path)
    return result.value


class _Replay:
    def __init__(self, scope: str):
        self.scope = scope
        self.digest = ""
        self.scalars = 0
        self.hands = 0

    def counts(self) -> ReplayCounts:
        return ReplayCounts(
            self.scope,
            self.digest,
            self.scalars,
            2 * self.scalars,
            self.hands,
            16 * self.hands,
            17 * self.hands,
        )

    def scalars_rows(self, rows: object, certificate: c.VerifiedCertificate) -> None:
        roster = _need(r.scalar_roster(certificate), "Scalars")
        if len(roster) != 222:
            raise _Mismatch(
                "ReferenceRoster", "reference must supply all 222 positions", "Scalars"
            )
        supplied = _array(rows, 222, "Scalars")
        for index, (expected_input, raw) in enumerate(zip(roster, supplied)):
            path = f"Scalars[{index}]"
            row = _object(raw, {"Input", "QBits", "Native", "Compiled"}, path)
            _same(expected_input, row["Input"], f"{path}.Input")
            belief = _need(
                s.parse_bits(expected_input["BeliefBits"]), f"{path}.Input.BeliefBits"
            )
            effect, depth = expected_input["Effect"], expected_input["Depth"]
            evaluation = _need(r.evaluate_bits(belief, effect, depth), f"{path}.QBits")
            native = _need(r.native_choice(belief, effect, depth), f"{path}.Native")
            compiled = _need(
                r.compiled_choice(certificate, belief, effect, depth),
                f"{path}.Compiled",
            )
            expected: dict[str, c.Json] = {
                "Input": expected_input,
                "QBits": [f"{bits:016X}" for bits in evaluation.QBits],
                "Native": asdict(native),
                "Compiled": asdict(compiled),
            }
            _same(expected, raw, path)
            self.scalars += 1

    def hand_rows(self, rows: object, certificate: c.VerifiedCertificate) -> None:
        supplied = _array(rows, 48, "Episodes")
        row_index = case_index = 0
        tapes = r.hand_tapes()
        if len(tapes) != 4 or tuple(name for name, _ in tapes) != (
            "zero",
            "one",
            "alternating",
            "sparse",
        ):
            raise _Mismatch(
                "ReferenceRoster",
                "four ordered explicit hand tapes required",
                "Episodes",
            )
        for tape_name, tape in tapes:
            for effect in (True, False):
                for geometry, palette in (
                    ("dot", "fixed"),
                    ("bar", "fixed"),
                    ("dot", "odd-complement"),
                ):
                    for strategy in r.STRATEGIES:
                        path = f"Episodes[{row_index}]"
                        raw = supplied[row_index]
                        row = _object(
                            raw,
                            {
                                "Tape",
                                "Effect",
                                "Geometry",
                                "Palette",
                                "Strategy",
                                "Episode",
                            },
                            path,
                        )
                        header: dict[str, c.Json] = {
                            "Tape": tape_name,
                            "Effect": effect,
                            "Geometry": geometry,
                            "Palette": palette,
                            "Strategy": strategy,
                        }
                        # Check labels before executing the selected, fixed hand case.
                        for key, expected in header.items():
                            _same(expected, row[key], f"{path}.{key}")
                        episode = _need(
                            r.run_episode(
                                strategy,
                                effect,
                                geometry,
                                palette,
                                tape,
                                case_index,
                                certificate=certificate,
                            ),
                            f"{path}.Episode",
                        )
                        _same(episode, row["Episode"], f"{path}.Episode")
                        self.hands += 1
                        row_index += 1
                    case_index += 1


def _run(
    scope: str,
    certificate: object,
    operation: Callable[[_Replay, c.VerifiedCertificate], None],
) -> s.Result[ReplayCounts]:
    replay = _Replay(scope)
    try:
        admitted = c._admitted(certificate)
        replay.digest = admitted.NumericSha256
        operation(replay, admitted)
        required_scalars = 0 if scope == "new-hand-only" else 222
        required_hands = 0 if scope == "scalars-only" else 48
        if replay.scalars != required_scalars or replay.hands != required_hands:
            raise _Mismatch(
                "IncompleteReplay",
                "complete declared numerical slices were not checked",
                "Replay",
            )
        return s.Success(replay.counts())
    except _Mismatch as mismatch:
        return ReplayFailure(
            mismatch.code, mismatch.message, mismatch.path, replay.counts()
        )
    except s._Refusal as refusal:
        return ReplayFailure(
            refusal.code, refusal.message, "Certificate", replay.counts()
        )


def replay_scalars(rows: object, certificate: object) -> s.Result[ReplayCounts]:
    """Admit exactly 222 ScalarAudit rows; no hand/runtime/phase claim."""
    return _run(
        "scalars-only",
        certificate,
        lambda replay, admitted: replay.scalars_rows(rows, admitted),
    )


def replay_new_hand(rows: object, certificate: object) -> s.Result[ReplayCounts]:
    """Admit exactly 48 ordered new hand rows; old controls remain separate."""
    return _run(
        "new-hand-only",
        certificate,
        lambda replay, admitted: replay.hand_rows(rows, admitted),
    )


def replay_scalar_and_new_hand(
    scalars: object, episodes: object, certificate: object
) -> s.Result[ReplayCounts]:
    """Check both complete slices, preserving completed-prefix counts on refusal."""

    def operation(replay: _Replay, admitted: c.VerifiedCertificate) -> None:
        replay.scalars_rows(scalars, admitted)
        replay.hand_rows(episodes, admitted)

    return _run("scalars-and-new-hand-only", certificate, operation)
