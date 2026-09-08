"""Independent exact finite rooms: moments, utility, transport and conditioning.

The fixed contract is in the dated distributional-learning-rooms-reference note.
All mathematical values are Fraction; wire rationals have canonical integer
strings. This module neither learns distributions nor models continuous flow.
Public records are ordinary values and are revalidated, not opaque capabilities.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from fractions import Fraction

type Json = None | bool | int | str | list[Json] | dict[str, Json]


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
