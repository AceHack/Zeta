"""Independent exact finite rooms: moments, utility, transport and conditioning.

The fixed contract is in the dated distributional-learning-rooms-reference note.
All mathematical values are Fraction; wire rationals have canonical integer
strings. This module neither learns distributions nor models continuous flow.
Public records are ordinary values and are revalidated, not opaque capabilities.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import struct
from collections.abc import Callable
from dataclasses import dataclass
from fractions import Fraction
from typing import Any, NoReturn, cast

type Json = None | bool | int | float | str | list[Json] | dict[str, Json]


@dataclass(frozen=True, slots=True)
class Failure:
    Code: str
    Message: str


@dataclass(frozen=True, slots=True)
class Success[T]:
    Value: T


type Result[T] = Success[T] | Failure


@dataclass(frozen=True, slots=True)
class Distribution:
    Support: tuple[Fraction, ...]
    Mass: tuple[Fraction, ...]


@dataclass(frozen=True, slots=True)
class Moments:
    Mean: Fraction
    SecondMoment: Fraction
    Variance: Fraction
    TailProbability: Fraction


@dataclass(frozen=True, slots=True)
class Decision:
    ExpectedUtilities: tuple[Fraction, ...]
    ActionIndex: int
    Action: str


@dataclass(frozen=True, slots=True)
class Conditioned:
    Evidence: Fraction
    Posterior: Distribution


class _Refusal(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.Code = code
        self.Message = message


def _capture[T](operation: Callable[[], T]) -> Result[T]:
    try:
        return Success(operation())
    except _Refusal as failure:
        return Failure(failure.Code, failure.Message)


def _rational(value: object) -> Fraction:
    if type(value) is int:
        return Fraction(value)
    if type(value) is Fraction:
        return value
    raise _Refusal(
        "InvalidRational", "exact int or Fraction required; bool and float refused"
    )


def _numbers(values: object) -> tuple[Fraction, ...]:
    if type(values) is not tuple:
        raise _Refusal("InvalidVector", "a finite tuple is required")
    return tuple(_rational(value) for value in values)


def _create(support: object, mass: object) -> Distribution:
    xs, ps = _numbers(support), _numbers(mass)
    if not xs or len(xs) != len(ps):
        raise _Refusal(
            "InvalidDistribution", "nonempty support and equal mass length required"
        )
    if any(xs[i] >= xs[i + 1] for i in range(len(xs) - 1)):
        raise _Refusal("InvalidDistribution", "support must be strictly increasing")
    if any(p < 0 for p in ps) or sum(ps, Fraction()) != 1:
        raise _Refusal(
            "InvalidDistribution", "masses must be nonnegative and sum exactly to one"
        )
    return Distribution(xs, ps)


def _subject(value: object) -> Distribution:
    if type(value) is not Distribution:
        raise _Refusal("InvalidDistribution", "Distribution record required")
    return _create(value.Support, value.Mass)


def distribution(support: object, mass: object) -> Result[Distribution]:
    """Validate a complete ordered support, retaining zero-mass positions."""
    return _capture(lambda: _create(support, mass))


def _moments(subject: Distribution, threshold: Fraction) -> Moments:
    if threshold < 0:
        raise _Refusal(
            "InvalidThreshold", "absolute-tail threshold must be nonnegative"
        )
    mean = sum(
        (x * p for x, p in zip(subject.Support, subject.Mass, strict=True)), Fraction()
    )
    second = sum(
        (x * x * p for x, p in zip(subject.Support, subject.Mass, strict=True)),
        Fraction(),
    )
    tail = sum(
        (
            p
            for x, p in zip(subject.Support, subject.Mass, strict=True)
            if abs(x) > threshold
        ),
        Fraction(),
    )
    return Moments(mean, second, second - mean * mean, tail)


def moments(subject: object, tail_threshold: object) -> Result[Moments]:
    """Population variance and a strict absolute-tail event, without sampling."""
    return _capture(lambda: _moments(_subject(subject), _rational(tail_threshold)))


def _decide(subject: Distribution, actions: object, utilities: object) -> Decision:
    if (
        type(actions) is not tuple
        or not actions
        or any(type(a) is not str or not a for a in actions)
    ):
        raise _Refusal(
            "InvalidActions", "nonempty tuple of nonempty action strings required"
        )
    if len(set(actions)) != len(actions):
        raise _Refusal("InvalidActions", "action names must be distinct")
    if type(utilities) is not tuple or len(utilities) != len(actions):
        raise _Refusal("InvalidUtilities", "one utility row per action required")
    rows = tuple(_numbers(row) for row in utilities)
    if any(len(row) != len(subject.Mass) for row in rows):
        raise _Refusal("InvalidUtilities", "one utility per support position required")
    expected = tuple(
        sum((p * u for p, u in zip(subject.Mass, row, strict=True)), Fraction())
        for row in rows
    )
    chosen = max(range(len(expected)), key=expected.__getitem__)
    return Decision(expected, chosen, actions[chosen])


def decide(subject: object, actions: object, utilities: object) -> Result[Decision]:
    """Maximize supplied exact expected utility; the first maximum wins ties."""
    return _capture(lambda: _decide(_subject(subject), actions, utilities))


def _permutation(value: object, count: int) -> tuple[int, ...]:
    if (
        type(value) is not tuple
        or len(value) != count
        or any(type(i) is not int for i in value)
    ):
        raise _Refusal(
            "InvalidTransport", "a full tuple of integer indices is required"
        )
    if sorted(value) != list(range(count)):
        raise _Refusal("InvalidTransport", "indices must form a bijection")
    return value


def _transport(
    subject: Distribution, permutation: object, inverse: object
) -> Distribution:
    size = len(subject.Mass)
    forward, backward = _permutation(permutation, size), _permutation(inverse, size)
    if any(backward[forward[i]] != i or forward[backward[i]] != i for i in range(size)):
        raise _Refusal("InvalidTransport", "both inverse compositions must be identity")
    moved = [Fraction()] * size
    for source, destination in enumerate(forward):
        moved[destination] = subject.Mass[source]
    return _create(subject.Support, tuple(moved))


def transport(
    subject: object, permutation: object, inverse: object
) -> Result[Distribution]:
    """Push mass at i to permutation[i], requiring an explicitly checked inverse."""
    return _capture(lambda: _transport(_subject(subject), permutation, inverse))


def _condition(subject: Distribution, likelihood: object) -> Conditioned:
    values = _numbers(likelihood)
    if len(values) != len(subject.Mass) or any(
        value < 0 or value > 1 for value in values
    ):
        raise _Refusal(
            "InvalidLikelihood", "one event likelihood in [0,1] per atom required"
        )
    products = tuple(p * value for p, value in zip(subject.Mass, values, strict=True))
    evidence = sum(products, Fraction())
    if not evidence:
        raise _Refusal("ZeroEvidence", "conditioning evidence is zero")
    return Conditioned(
        evidence,
        _create(subject.Support, tuple(value / evidence for value in products)),
    )


def condition(subject: object, likelihood: object) -> Result[Conditioned]:
    """Bayes conditioning with explicit evidence; impossible events refuse."""
    return _capture(lambda: _condition(_subject(subject), likelihood))


def _wire(value: Fraction) -> dict[str, Json]:
    try:
        return {"Num": str(value.numerator), "Den": str(value.denominator)}
    except ValueError:
        raise _Refusal(
            "InvalidRational", "integer value exceeds interpreter text admission"
        ) from None


def encode_rational(value: object) -> Result[dict[str, Json]]:
    return _capture(lambda: _wire(_rational(value)))


def _decode(value: object) -> Fraction:
    if type(value) is not dict or set(value) != {"Num", "Den"}:
        raise _Refusal("InvalidRational", "exact Num/Den keys required")
    numerator, denominator = value["Num"], value["Den"]
    if type(numerator) is not str or type(denominator) is not str:
        raise _Refusal(
            "InvalidRational", "Num and Den must be canonical integer strings"
        )
    if (
        re.fullmatch(r"(?:0|-[1-9][0-9]*|[1-9][0-9]*)", numerator) is None
        or re.fullmatch(r"[1-9][0-9]*", denominator) is None
    ):
        raise _Refusal("InvalidRational", "noncanonical integer spelling")
    try:
        result = Fraction(int(numerator), int(denominator))
    except ValueError:
        raise _Refusal(
            "InvalidRational", "integer text exceeds interpreter admission"
        ) from None
    if _wire(result) != value:
        raise _Refusal(
            "InvalidRational", "rational must be reduced with zero represented as 0/1"
        )
    return result


def decode_rational(value: object) -> Result[Fraction]:
    return _capture(lambda: _decode(value))


def _vector(values: tuple[Fraction, ...]) -> list[Json]:
    return [_wire(value) for value in values]


def _receipt() -> dict[str, Json]:
    support = (-2, -1, 0, 1, 2)
    sources = (
        ("P", _create(support, (0, Fraction(1, 2), 0, Fraction(1, 2), 0))),
        ("Q", _create(support, (Fraction(1, 8), 0, Fraction(3, 4), 0, Fraction(1, 8)))),
    )
    actions = ("steady", "tail-exposed")
    utilities = ((0, 0, 0, 0, 0), (-7, 1, 1, 1, -7))
    threshold = Fraction(3, 2)
    permutation, inverse = (1, 2, 3, 4, 0), (4, 0, 1, 2, 3)
    likelihoods = (
        ("unit", (1, 1, 1, 1, 1)),
        ("soft", (Fraction(1, 4), Fraction(1, 2), Fraction(3, 4), 1, Fraction(1, 2))),
        ("tail", (1, 0, 0, 0, 1)),
    )
    distributions: list[Json] = []
    movements: list[Json] = []
    conditioned: list[Json] = []
    for name, prior in sources:
        summary, decision = (
            _moments(prior, threshold),
            _decide(prior, actions, utilities),
        )
        distributions.append(
            {
                "Id": name,
                "Mass": _vector(prior.Mass),
                "Mean": _wire(summary.Mean),
                "SecondMoment": _wire(summary.SecondMoment),
                "Variance": _wire(summary.Variance),
                "TailProbability": _wire(summary.TailProbability),
                "ExpectedUtilities": _vector(decision.ExpectedUtilities),
                "ActionIndex": decision.ActionIndex,
                "Action": decision.Action,
            }
        )
        moved = _transport(prior, permutation, inverse)
        recovered = _transport(moved, inverse, permutation)
        after = _moments(moved, threshold)
        movements.append(
            {
                "Id": name + "/cycle",
                "Distribution": name,
                "ForwardMass": _vector(moved.Mass),
                "RecoveredMass": _vector(recovered.Mass),
                "ForwardMean": _wire(after.Mean),
                "ForwardVariance": _wire(after.Variance),
            }
        )
        for likelihood_id, likelihood in likelihoods:
            outcome: dict[str, Json]
            actual = condition(prior, likelihood)
            if isinstance(actual, Failure):
                if actual.Code != "ZeroEvidence":
                    raise _Refusal(actual.Code, actual.Message)
                outcome = {
                    "Kind": "refused",
                    "Code": actual.Code,
                    "Message": actual.Message,
                }
            else:
                outcome = {
                    "Kind": "conditioned",
                    "Evidence": _wire(actual.Value.Evidence),
                    "Posterior": _vector(actual.Value.Posterior.Mass),
                }
            conditioned.append(
                {
                    "Id": name + "/" + likelihood_id,
                    "Distribution": name,
                    "LikelihoodId": likelihood_id,
                    "Likelihood": _vector(_numbers(likelihood)),
                    "Outcome": outcome,
                }
            )
    return {
        "Schema": "zeta.distributional-rooms.reference.v1",
        "Support": _vector(_numbers(support)),
        "Actions": list(actions),
        "Utilities": [_vector(_numbers(row)) for row in utilities],
        "TailEvent": {"Kind": "absolute-greater-than", "Threshold": _wire(threshold)},
        "Distributions": distributions,
        "Transport": {
            "Convention": "source-index-to-destination-index",
            "Permutation": list(permutation),
            "Inverse": list(inverse),
            "Rows": movements,
        },
        "Conditioning": conditioned,
    }


def reference_receipt() -> Result[dict[str, Json]]:
    """Evaluate only the fixed two-distribution, two-transport, six-Bayes roster."""
    return _capture(_receipt)


@dataclass(frozen=True, slots=True)
class RoomRunValidated:
    """Whole supplied fixed-control content, never process/exit/source custody."""

    Mode: str
    Raw: bytes
    Sha256: str
    Records: tuple[dict[str, Json], ...]
    CheckedCheckpoints: int
    FiniteRows: int
    ZetaRows: int
    Ordinary: RoomRunValidated | None
    Custody: str = "external-caller-obligation-not-established"


@dataclass(frozen=True, slots=True)
class RoomRunRefused:
    Code: str
    Message: str
    Path: str
    CaseId: str | None
    Raw: object
    Records: tuple[dict[str, Json], ...]
    CheckedCheckpoints: int
    Ordinary: RoomRunValidated | RoomRunRefused | None
    Custody: str = "external-caller-obligation-not-established"


@dataclass(frozen=True, slots=True)
class _Number:
    Value: Fraction
    Soft: bool = False


class _RoomError(Exception):
    def __init__(self, code: str, message: str, path: str, case: str | None = None):
        super().__init__(message)
        self.Code, self.Message, self.Path, self.CaseId = code, message, path, case


_ROOM_BYTES = 1048576
_ROOM_LINE_BYTES = 65536
_SOFT_ATOL = Fraction(1, 10**12)


def _room_error(path: str, message: str, case: str | None = None) -> NoReturn:
    raise _RoomError("ContentMismatch", message, path, case)


def _observed_number(value: object, path: str, case: str | None) -> float:
    if type(value) not in (int, float):
        raise _RoomError(
            "NumericType", "finite numeric token excluding bool required", path, case
        )
    try:
        number = float(cast(int | float, value))
    except OverflowError:
        raise _RoomError(
            "NonFinite", "numeric token exceeds binary64 range", path, case
        ) from None
    if not math.isfinite(number):
        raise _RoomError("NonFinite", "finite numeric token required", path, case)
    return number


def _match_room(actual: object, expected: object, path: str, case: str | None) -> None:
    if isinstance(expected, _Number):
        number = _observed_number(actual, path, case)
        if expected.Soft:
            if (
                not 0 <= number <= 1
                or abs(Fraction(number) - expected.Value) > _SOFT_ATOL
            ):
                _room_error(
                    path, "probability outside [0,1] or absolute tolerance", case
                )
        elif struct.pack(">d", number) != struct.pack(">d", float(expected.Value)):
            _room_error(path, "binary64 value differs", case)
    elif type(expected) is dict:
        if type(actual) is not dict:
            _room_error(path, "exact object required", case)
        for key in expected:
            if key not in actual:
                _room_error(path + "." + key, "missing field", case)
        for key in actual:
            if key not in expected:
                _room_error(path + "." + key, "unexpected field", case)
        for key, child in expected.items():
            _match_room(actual[key], child, path + "." + key, case)
    elif type(expected) is list:
        if type(actual) is not list or len(actual) != len(expected):
            _room_error(path, "exact ordered array length required", case)
        for index, child in enumerate(expected):
            _match_room(actual[index], child, f"{path}[{index}]", case)
    elif type(actual) is not type(expected) or actual != expected:
        _room_error(path, "exact scalar value/type required", case)


def _same_room(actual: object, expected: object, path: str, case: str | None) -> None:
    """Same decoded observation, including int/float and signed-zero distinctions."""
    if type(expected) is float:
        if type(actual) is not float or struct.pack(">d", actual) != struct.pack(
            ">d", expected
        ):
            _room_error(path, "checkpoint/receipt floating observation differs", case)
    elif type(expected) is dict:
        if type(actual) is not dict:
            _room_error(path, "checkpoint/receipt object differs", case)
        for key in expected:
            if key not in actual:
                _room_error(path + "." + key, "missing field", case)
        for key in actual:
            if key not in expected:
                _room_error(path + "." + key, "unexpected field", case)
        for key, value in expected.items():
            _same_room(actual[key], value, path + "." + key, case)
    elif type(expected) is list:
        if type(actual) is not list or len(actual) != len(expected):
            _room_error(path, "checkpoint/receipt array differs", case)
        for index, value in enumerate(expected):
            _same_room(actual[index], value, f"{path}[{index}]", case)
    elif type(actual) is not type(expected) or actual != expected:
        _room_error(path, "checkpoint/receipt scalar observation differs", case)


def _soft_observation(actual: object, path: str, case: str | None) -> None:
    """Expectations were matched first; now bind confidence and normalized mass."""
    if type(actual) is not dict or actual.get("Kind") != "conditioned":
        return
    posterior = cast(list[Json], actual["Posterior"])
    values = [_observed_number(value, path + ".Posterior", case) for value in posterior]
    total = sum((Fraction(value) for value in values), Fraction())
    if abs(total - 1) > _SOFT_ATOL:
        _room_error(
            path + ".Posterior", "posterior sum outside absolute tolerance", case
        )
    maximum = _observed_number(actual["MaximumMass"], path + ".MaximumMass", case)
    if abs(Fraction(maximum) - Fraction(max(values))) > _SOFT_ATOL:
        _room_error(
            path + ".MaximumMass", "reported maximum differs from actual support", case
        )


def _room_expectations() -> tuple[
    list[dict[str, Any]], dict[str, Any], dict[str, Json]
]:
    # Only the already fixed reference is evaluated; producer data defines no expectation.
    finite_result = reference_receipt()
    if isinstance(finite_result, Failure):
        raise _RoomError("ReferenceRefused", finite_result.Message, "Reference")
    finite = finite_result.Value
    checkpoints: list[dict[str, Any]] = []
    gaussian: list[dict[str, Any]] = []
    consensus: list[dict[str, Any]] = []
    soft: list[dict[str, Any]] = []
    budget: list[dict[str, Any]] = []

    def add(category: str, identity: str, value: object) -> None:
        checkpoints.append(
            {
                "Kind": "checkpoint",
                "Sequence": len(checkpoints) + 1,
                "Category": category,
                "Id": identity,
                "Value": value,
            }
        )

    def number(value: int | Fraction) -> _Number:
        return _Number(Fraction(value))

    def snapshot(mass: list[dict[str, Json]]) -> dict[str, Any]:
        values = [_decode(value) for value in mass]
        return {
            "Kind": "conditioned",
            "Posterior": [_Number(v, True) for v in values],
            "MaximumMass": _Number(max(values), True),
        }

    for name in ("P", "Q"):
        row: dict[str, Any] = {
            "Id": name,
            "PrecisionMean": number(0),
            "Precision": number(1),
            "Mean": number(0),
            "Variance": number(1),
        }
        gaussian.append(row)
        add("GaussianProjection", name, row)
    for copies in (1, 2):
        row = {
            "SuppliedCopies": copies,
            "SourceId": "same-evidence",
            "ProvenanceEnforcedByApi": False,
            "Threshold": number(Fraction(5, 2)),
            "Outcome": "Undecided" if copies == 1 else "ResolvedYes",
            "Precision": number(copies + 1),
            "Mean": number(Fraction(copies, copies + 1)),
        }
        consensus.append(row)
        add("RepeatedEvidenceConsensus", str(copies), row)
    for index, name in enumerate(("P", "Q")):
        distribution_row = cast(list[dict[str, Any]], finite["Distributions"])[index]
        add("SoftValueConstructor", name, snapshot(distribution_row["Mass"]))
        for conditioning in cast(list[dict[str, Any]], finite["Conditioning"])[
            index * 3 : index * 3 + 3
        ]:
            outcome = conditioning["Outcome"]
            row = {
                "Id": conditioning["Id"],
                "Outcome": {"Kind": "refused"}
                if outcome["Kind"] == "refused"
                else snapshot(outcome["Posterior"]),
            }
            soft.append(row)
            add("SoftValueConditioning", conditioning["Id"], row)
    shares = [_wire(Fraction(3, 4)), _wire(Fraction(1, 4))]
    add("Inference", "two-candidates", {"Kind": "inferred", "PosteriorShares": shares})
    for capacity in (0, 6, 12):
        for priority in ("neutral", "attention-ten"):
            requested = (
                ["likely", "attended"]
                if priority == "neutral"
                else ["attended", "likely"]
            )
            count = capacity // 6

            def prediction(
                order: list[str], count: int = count, capacity: int = capacity
            ) -> dict[str, Any]:
                return {
                    "PosteriorShares": shares,
                    "Best": "likely",
                    "Requested": order,
                    "Boarded": order[:count],
                    "Deferred": order[count:],
                    "RequestedBytes": 12,
                    "BoardedBytes": capacity,
                    "DeferredBytes": 12 - capacity,
                    "TankBeforeCharge": number(capacity),
                    "TankAfterCharge": number(0),
                    "Outcome": {
                        0: "RejectedWithBackpressure",
                        6: "PartiallyAdmitted",
                        12: "Admitted",
                    }[capacity],
                    "Starved": capacity != 12,
                    "VisionConfidence": number(Fraction(capacity, 12)),
                }

            identity = str(capacity) + "/" + priority
            predicted = prediction(requested)
            add("PriorityPrediction", identity, predicted)
            add("DirectPrediction", identity, prediction(["likely", "attended"]))
            mass = sum(
                (
                    Fraction(3, 4) if label == "likely" else Fraction(1, 4)
                    for label in requested[:count]
                ),
                Fraction(),
            )
            budget.append(
                {
                    "CapacityBytes": capacity,
                    "Priority": priority,
                    "PosteriorShares": shares,
                    "Best": "likely",
                    "Boarded": requested[:count],
                    "Deferred": requested[count:],
                    "RequestedBytes": 12,
                    "BoardedBytes": capacity,
                    "DeferredBytes": 12 - capacity,
                    "VisionConfidence": number(Fraction(capacity, 12)),
                    "BoardedPosteriorMass": _wire(mass),
                    "SameBudgetReportAsDirect": priority == "neutral",
                }
            )
    return (
        checkpoints,
        {
            "GaussianProjection": gaussian,
            "RepeatedEvidenceConsensus": consensus,
            "SoftValueConditioning": soft,
            "BudgetAndPriority": budget,
        },
        finite,
    )


def _parse_room_line(raw: bytes, path: str) -> dict[str, Json]:
    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in values:
            if key in result:
                raise _RoomError("DuplicateKey", "duplicate JSON key: " + key, path)
            result[key] = value
        return result

    def constant(value: str) -> None:
        raise _RoomError("NonFiniteJson", "nonfinite JSON constant: " + value, path)

    def integer(value: str) -> int | float:
        return -0.0 if value == "-0" else int(value)

    def floating(value: str) -> float:
        number = float(value)
        if not math.isfinite(number):
            raise _RoomError("NonFiniteJson", "nonfinite JSON number", path)
        return number

    try:
        value = json.loads(
            raw.decode("utf-8", errors="strict"),
            object_pairs_hook=pairs,
            parse_constant=constant,
            parse_int=integer,
            parse_float=floating,
        )
    except (UnicodeDecodeError, ValueError, RecursionError) as error:
        raise _RoomError("InvalidJson", str(error), path) from None
    if type(value) is not dict:
        raise _RoomError("InvalidShape", "NDJSON record must be an object", path)
    pending: list[object] = [value]
    while pending:
        item = pending.pop()
        if type(item) is str and any(0xD800 <= ord(char) <= 0xDFFF for char in item):
            raise _RoomError(
                "InvalidUnicode", "surrogate codepoint in JSON string", path
            )
        if type(item) is dict:
            pending.extend(item.keys())
            pending.extend(item.values())
        elif type(item) is list:
            pending.extend(item)
    return cast(dict[str, Json], value)


def _runtime_shape(actual: object, path: str) -> None:
    if type(actual) is not dict or set(actual) != {
        "DotNetVersion",
        "LoadedAssemblies",
        "CompleteRuntimeClosureAdmitted",
    }:
        _room_error(path, "exact runtime metadata fields required")
    if type(actual["DotNetVersion"]) is not str or not actual["DotNetVersion"]:
        _room_error(path + ".DotNetVersion", "nonempty observed version required")
    if actual["CompleteRuntimeClosureAdmitted"] is not False:
        _room_error(
            path + ".CompleteRuntimeClosureAdmitted",
            "metadata does not admit runtime closure",
        )
    assemblies = actual["LoadedAssemblies"]
    names = ("Zeta.Core", "Zeta.Bayesian", "Zeta.Core")
    if type(assemblies) is not list or len(assemblies) != len(names):
        _room_error(
            path + ".LoadedAssemblies", "three ordered assembly metadata rows required"
        )
    for index, name in enumerate(names):
        row = assemblies[index]
        target = f"{path}.LoadedAssemblies[{index}]"
        if type(row) is not dict or set(row) != {"Name", "Bytes", "Sha256"}:
            _room_error(target, "exact assembly metadata fields required")
        if type(row["Name"]) is not str or row["Name"] != name:
            _room_error(target + ".Name", "declared assembly order differs")
        if type(row["Bytes"]) is not int or row["Bytes"] <= 0:
            _room_error(target + ".Bytes", "positive integer observed length required")
        if (
            type(row["Sha256"]) is not str
            or re.fullmatch(r"[0-9A-F]{64}", row["Sha256"]) is None
        ):
            _room_error(target + ".Sha256", "uppercase SHA256 observation required")
    # The first and third type selections name the same actual F# assembly.
    _same_room(assemblies[2], assemblies[0], path + ".LoadedAssemblies[2]", None)


def _receipt_links(
    receipt: dict[str, Any], records: list[dict[str, Json]], path: str
) -> None:
    observations = receipt["ZetaObservations"]
    for group, positions in (
        ("GaussianProjection", (0, 1)),
        ("RepeatedEvidenceConsensus", (2, 3)),
        ("SoftValueConditioning", (5, 6, 7, 9, 10, 11)),
    ):
        for index, position in enumerate(positions):
            _same_room(
                observations[group][index],
                records[position]["Value"],
                f"{path}.ZetaObservations.{group}[{index}]",
                group,
            )
    for index, row in enumerate(observations["BudgetAndPriority"]):
        predicted = cast(dict[str, Json], records[13 + 2 * index]["Value"])
        direct = cast(dict[str, Json], records[14 + 2 * index]["Value"])
        for key in (
            "PosteriorShares",
            "Best",
            "Boarded",
            "Deferred",
            "RequestedBytes",
            "BoardedBytes",
            "DeferredBytes",
            "VisionConfidence",
        ):
            _same_room(
                row[key],
                predicted[key],
                f"{path}.ZetaObservations.BudgetAndPriority[{index}].{key}",
                "BudgetAndPriority",
            )
        same = json.dumps(
            predicted, sort_keys=True, separators=(",", ":")
        ) == json.dumps(direct, sort_keys=True, separators=(",", ":"))
        if row["SameBudgetReportAsDirect"] is not same:
            _room_error(
                f"{path}.ZetaObservations.BudgetAndPriority[{index}].SameBudgetReportAsDirect",
                "full observed direct report equality differs",
                "BudgetAndPriority",
            )


def validate_room_ndjson(
    raw: object, *, mode: str = "ordinary", ordinary_raw: object = None
) -> RoomRunValidated | RoomRunRefused:
    """Validate one whole fixed-control transcript; no launch, file or custody IO.

    Supplied input bytes are retained on refusal. Limits bound parsed input, not
    caller allocation, Python overhead or hostile in-process object behavior.
    Fault modes independently validate ordinary_raw and bind exact raw prefixes.
    """
    records: list[dict[str, Json]] = []
    checked = 0
    ordinary: RoomRunValidated | RoomRunRefused | None = None
    try:
        modes = {
            "ordinary": 25,
            "fault-2": 2,
            "fault-12": 12,
            "fault-25": 25,
            "invalid-control": 0,
        }
        if type(mode) is not str or mode not in modes:
            raise _RoomError("InvalidMode", "fixed control mode required", "Mode")
        fault = mode.startswith("fault-")
        if fault:
            ordinary = validate_room_ndjson(ordinary_raw)
            if isinstance(ordinary, RoomRunRefused):
                raise _RoomError(
                    "InvalidOrdinary",
                    "ordinary prerequisite refused: " + ordinary.Message,
                    "Ordinary." + ordinary.Path,
                    ordinary.CaseId,
                )
        elif ordinary_raw is not None:
            raise _RoomError(
                "UnexpectedOrdinary",
                "ordinary input belongs only to a fault mode",
                "Ordinary",
            )
        if type(raw) is not bytes:
            raise _RoomError("InvalidBytes", "bytes input required", "Raw")
        if not raw or len(raw) > _ROOM_BYTES:
            raise _RoomError(
                "ByteBound", "nonempty input at most 1 MiB required", "Raw"
            )
        terminated = raw.endswith(b"\n")
        parts = raw.split(b"\n")
        if terminated:
            parts.pop()  # The empty segment after the final line delimiter.
        expected, observations, finite = _room_expectations()
        target = modes[mode]
        terminal_seen = False
        ordinary_lines = (
            ordinary.Raw.split(b"\n") if isinstance(ordinary, RoomRunValidated) else []
        )
        for index, line in enumerate(parts):
            path = f"Lines[{index}]"
            if index >= 65:
                raise _RoomError(
                    "CheckpointBound", "at most 64 checkpoints and one terminal", path
                )
            if not terminated and index == len(parts) - 1:
                raise _RoomError(
                    "UnterminatedLine", "every NDJSON line must end with LF", path
                )
            if len(line) + 1 > _ROOM_LINE_BYTES:
                raise _RoomError(
                    "LineBound", "line exceeds 64 KiB including delimiter", path
                )
            decoded = _parse_room_line(line, path)
            records.append(
                decoded
            )  # Retain actual decoded input before any semantic judgment.
            if terminal_seen:
                raise _RoomError("AfterTerminal", "no record may follow terminal", path)
            if decoded.get("Kind") == "checkpoint":
                if checked >= target:
                    raise _RoomError(
                        "ExtraCheckpoint",
                        "checkpoint exceeds selected fixed mode",
                        path,
                    )
                case = expected[checked]["Category"] + "/" + expected[checked]["Id"]
                _match_room(decoded, expected[checked], path, case)
                if decoded["Category"] == "SoftValueConstructor":
                    _soft_observation(decoded["Value"], path + ".Value", case)
                elif decoded["Category"] == "SoftValueConditioning":
                    _soft_observation(
                        cast(dict[str, Json], decoded["Value"])["Outcome"],
                        path + ".Value.Outcome",
                        case,
                    )
                if fault and line != ordinary_lines[checked]:
                    raise _RoomError(
                        "OrdinaryPrefixMismatch",
                        "checkpoint bytes differ from validated ordinary run",
                        path,
                        case,
                    )
                checked += 1
            else:
                if checked != target:
                    raise _RoomError(
                        "MissingCheckpoint",
                        "terminal before complete fixed checkpoint roster",
                        path,
                    )
                expected_terminal: dict[str, Any] = {
                    "Kind": "terminal",
                    "Schema": "zeta.distributional-rooms.run.v1",
                    "Complete": mode == "ordinary",
                    "Failure": None
                    if mode == "ordinary"
                    else "InjectedCheckpointFailure"
                    if fault
                    else "InvalidControlArguments",
                    "Receipt": None,
                    "ObservedCheckpointCount": target,
                    "WrittenCheckpointCount": target,
                    "PendingCheckpoint": None,
                    "PendingCheckpointOmission": None,
                }
                if mode == "ordinary":
                    if type(decoded.get("Receipt")) is not dict:
                        _room_error(path + ".Receipt", "complete receipt required")
                    receipt = cast(dict[str, Any], decoded["Receipt"])
                    if set(receipt) != {
                        "Schema",
                        "FiniteReference",
                        "ZetaObservations",
                        "Runtime",
                    }:
                        _room_error(path + ".Receipt", "exact receipt keys required")
                    _match_room(
                        receipt["Schema"],
                        "zeta.distributional-rooms.actual-zeta.v1",
                        path + ".Receipt.Schema",
                        None,
                    )
                    _match_room(
                        receipt["FiniteReference"],
                        finite,
                        path + ".Receipt.FiniteReference",
                        "FiniteReference",
                    )
                    _match_room(
                        receipt["ZetaObservations"],
                        observations,
                        path + ".Receipt.ZetaObservations",
                        "ZetaObservations",
                    )
                    _runtime_shape(receipt["Runtime"], path + ".Receipt.Runtime")
                    _receipt_links(receipt, records, path + ".Receipt")
                    expected_terminal["Receipt"] = decoded["Receipt"]
                _same_room(decoded, expected_terminal, path, None)
                terminal_seen = True
        if not terminal_seen:
            raise _RoomError(
                "MissingTerminal",
                "complete terminal required; prefix is not success",
                "Terminal",
            )
        return RoomRunValidated(
            mode,
            raw,
            hashlib.sha256(raw).hexdigest().upper(),
            tuple(records),
            checked,
            10 if mode == "ordinary" else 0,
            16 if mode == "ordinary" else 0,
            ordinary if isinstance(ordinary, RoomRunValidated) else None,
        )
    except _RoomError as error:
        return RoomRunRefused(
            error.Code,
            error.Message,
            error.Path,
            error.CaseId,
            raw,
            tuple(records),
            checked,
            ordinary,
        )
