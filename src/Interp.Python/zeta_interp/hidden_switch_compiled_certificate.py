"""Exact, independently reconstructed numeric certificate for the fixed model.

Bindings is a nonempty canonical string-to-uppercase-SHA256 map supplied by the
coordinator. It must contain ProtocolSha256; the coordinator additionally admits
its complete source/checker roster and loaded artifacts. This module has no
filesystem or runtime capability. It checks its entire numeric key/value tree,
ordered candidate roster, endpoint dominance and all explicit inequalities.
Success.value / Failure.Code / Failure.Message are the public result boundary.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from fractions import Fraction as F
from itertools import pairwise
from weakref import WeakSet

from . import hidden_switch_compiled_ieee as s

SCHEMA = "zeta.hidden-switch.compiled.numeric.v1"
PROTOCOL_SHA256 = "8BBDFE44A0844DD8CE4F6C5DD77B060A56E5B84EA94EA7A6FDBB482AEC9D738A"
type Json = None | bool | int | str | list[Json] | dict[str, Json]
_SEAL = object()

# An ordered recipe, not proof of a JIT. Runtime/source graph admission is separate.
EXPRESSION_GRAPH = (
    "predict.u = effect && action==1 ? RN(1-b) : b",
    "predict.prior = RN(1/8 + RN((3/4)*u))",
    "condition.l1,l0 = cue==1 ? (3/4,1/4) : (1/4,3/4)",
    "condition.mass = RN(RN(l1*prior) + RN(l0*RN(1-prior)))",
    "condition.posterior = RN(RN(l1*prior)/mass)",
    "tree.immediate = action==0 ? b : -1/4",
    "tree.depth1 = immediate; no prediction or conditioning",
    "tree.zero = RN(probability0*max(child0.H,child0.S))",
    "tree.one = RN(probability1*max(child1.H,child1.S))",
    "tree.value = RN(RN(immediate+zero)+one)",
    "tree.order = H then S; cue0 then cue1; complete unpruned recursion",
    "select = RN(QS-QH)>epsilon ? 1 : 0; max is numerical, not tolerance-selected",
)


@dataclass(frozen=True, slots=True)
class Alpha:
    Action: int
    ZeroChild: int | None
    OneChild: int | None
    Values: tuple[F, F]


@dataclass(frozen=True, slots=True)
class Guard:
    Depth: int
    SmaxBits: int
    HminBits: int


@dataclass(frozen=True, slots=True, eq=False, weakref_slot=True)
class VerifiedCertificate:
    """Only verify_certificate creates an admitted instance (not a security sandbox)."""

    NumericSha256: str
    Bindings: tuple[tuple[str, str], ...]
    EpsilonBits: int
    Guards: tuple[Guard, Guard]
    _seal: object


_ISSUED: WeakSet[VerifiedCertificate] = WeakSet()


def _r(value: F | int) -> dict[str, Json]:
    fraction = F(value)
    return {"Num": str(fraction.numerator), "Den": str(fraction.denominator)}


def _bindings(value: object) -> dict[str, str]:
    if type(value) is not dict or not value:
        raise s._Refusal("Bindings", "expected a nonempty canonical binding map")
    result: dict[str, str] = {}
    for key, digest in value.items():
        if (
            type(key) is not str
            or not key
            or type(digest) is not str
            or len(digest) != 64
            or any(c not in "0123456789ABCDEF" for c in digest)
        ):
            raise s._Refusal("Bindings", "binding names and uppercase SHA256 required")
        result[key] = digest
    if result.get("ProtocolSha256") != PROTOCOL_SHA256:
        raise s._Refusal("Bindings", "frozen protocol identity differs")
    return dict(sorted(result.items()))


def _parameters(effect: object, depth: object) -> tuple[bool, int]:
    if type(effect) is not bool or type(depth) is not int or not 1 <= depth <= 3:
        raise s._Refusal("ModelInput", "boolean effect and integer depth1..3 required")
    return effect, depth


def _alphas(effect: bool, depth: int) -> tuple[Alpha, ...]:
    children = _alphas(effect, depth - 1) if depth > 1 else ()
    result = []
    for action in (0, 1):
        for zero in range(len(children)) if children else (None,):
            for one in range(len(children)) if children else (None,):
                hidden_values = []
                for state in (0, 1):
                    value = F(state) if action == 0 else F(-1, 4)
                    if zero is not None and one is not None:
                        intended = state ^ int(effect and action == 1)
                        for next_state in (0, 1):
                            transition = F(7 if next_state == intended else 1, 8)
                            for cue, child_index in ((0, zero), (1, one)):
                                emission = F(3 if cue == next_state else 1, 4)
                                value += (
                                    transition
                                    * emission
                                    * children[child_index].Values[next_state]
                                )
                    hidden_values.append(value)
                result.append(
                    Alpha(action, zero, one, (hidden_values[0], hidden_values[1]))
                )
    return tuple(result)


def alpha_vectors(effect: object, depth: object) -> s.Result[tuple[Alpha, ...]]:
    return s._capture(lambda: _alphas(*_parameters(effect, depth)))


def oracle_q(prior: object, effect: object, depth: object) -> s.Result[tuple[F, F]]:
    def operation() -> tuple[F, F]:
        e, d = _parameters(effect, depth)
        if type(prior) is not F or not 0 <= prior <= 1:
            raise s._Refusal("OracleInput", "exact Fraction prior in [0,1] required")
        vectors = _alphas(e, d)
        values = [
            max(
                (1 - prior) * a.Values[0] + prior * a.Values[1]
                for a in vectors
                if a.Action == action
            )
            for action in (0, 1)
        ]
        return values[0], values[1]

    return s._capture(operation)


def _pieces(effect: bool, depth: int, action: int) -> tuple[tuple[F, F, F, F], ...]:
    # Independently checked claims from the finite-model paper; the checker proves
    # each entire closed interval against EVERY rebuilt candidate below.
    if depth == 1:
        return (
            (
                F(0),
                F(1),
                F(0) if action == 0 else F(-1, 4),
                F(1) if action == 0 else F(0),
            ),
        )
    if depth == 2:
        c, m = (
            (F(1, 8), F(7, 4))
            if action == 0
            else ((F(5, 8), F(-3, 4)) if effect else (F(-1, 8), F(3, 4)))
        )
        return ((F(0), F(1), c, m),)
    if not effect:
        c, m = (F(11, 32), F(37, 16)) if action == 0 else (F(3, 32), F(21, 16))
        return ((F(0), F(1), c, m),)
    if action == 0:
        return (
            (F(0), F(17, 42), F(39, 64), F(53, 32)),
            (F(17, 42), F(1), F(11, 32), F(37, 16)),
        )
    return (
        (F(0), F(25, 42), F(45, 32), F(-21, 16)),
        (F(25, 42), F(1), F(65, 64), F(-21, 32)),
    )


def _model(effect: bool, depth: int) -> dict[str, Json]:
    vectors = _alphas(effect, depth)
    expected_count = {1: 2, 2: 8, 3: 128}[depth]
    if len(vectors) != expected_count:
        raise s._Refusal("Derivation", "incomplete contingent roster")
    candidates: list[Json] = []
    for i, a in enumerate(vectors):
        if not all(F(-depth, 4) <= x <= depth for x in a.Values) or abs(
            a.Values[1] - a.Values[0]
        ) > F(5 * depth, 4):
            raise s._Refusal("Derivation", "contingent range or Lipschitz bound failed")
        candidates.append(
            {
                "Index": i,
                "Action": a.Action,
                "ZeroChild": a.ZeroChild,
                "OneChild": a.OneChild,
                "Values": [_r(x) for x in a.Values],
            }
        )
    envelopes: list[Json] = []
    for action in (0, 1):
        rows = _pieces(effect, depth, action)
        if (
            rows[0][0] != 0
            or rows[-1][1] != 1
            or any(a[1] != b[0] for a, b in pairwise(rows))
        ):
            raise s._Refusal("Derivation", "envelope does not cover [0,1]")
        for lo, hi, intercept, slope in rows:
            selected = [
                i
                for i, a in enumerate(vectors)
                if a.Action == action and a.Values == (intercept, intercept + slope)
            ]
            if not selected or not lo < hi:
                raise s._Refusal("Derivation", "envelope line absent from full roster")
            margins = [
                intercept + slope * b - ((1 - b) * a.Values[0] + b * a.Values[1])
                for b in (lo, hi)
                for a in vectors
                if a.Action == action
            ]
            if min(margins) < 0:
                raise s._Refusal("Derivation", "endpoint dominance failed")
            envelopes.append(
                {
                    "Action": action,
                    "Left": _r(lo),
                    "Right": _r(hi),
                    "Intercept": _r(intercept),
                    "Slope": _r(slope),
                    "CandidateIndex": selected[0],
                    "EndpointMargins": [_r(x) for x in margins],
                }
            )
    cuts = sorted(
        {
            x
            for action in (0, 1)
            for row in _pieces(effect, depth, action)
            for x in row[:2]
        }
    )
    gaps: list[Json] = []
    for lo, hi in pairwise(cuts):
        middle = (lo + hi) / 2
        lines = [
            next(
                (c, m)
                for left, right, c, m in _pieces(effect, depth, action)
                if left <= middle <= right
            )
            for action in (0, 1)
        ]
        intercept, slope = lines[1][0] - lines[0][0], lines[1][1] - lines[0][1]
        if not effect or depth == 1:
            expected = F(-1, 4), F(-1)
        elif depth == 2:
            expected = F(1, 2), F(-5, 2)
        elif middle < F(17, 42):
            expected = F(51, 64), F(-95, 32)
        elif middle < F(25, 42):
            expected = F(17, 16), F(-29, 8)
        else:
            expected = F(43, 64), F(-95, 32)
        if (intercept, slope) != expected or slope >= 0:
            raise s._Refusal(
                "Derivation", "registered full-domain monotone gap differs"
            )
        gaps.append(
            {
                "Left": _r(lo),
                "Right": _r(hi),
                "Intercept": _r(intercept),
                "Slope": _r(slope),
            }
        )
    return {
        "Effect": effect,
        "Depth": depth,
        "Candidates": candidates,
        "Envelopes": envelopes,
        "GapPieces": gaps,
    }


def _bounds(epsilon: F) -> tuple[dict[str, Json], tuple[F, F, F]]:
    eta = F(1, 1 << 48)
    obligations: list[Json] = []

    def check(name: str, left: F | int, relation: str, right: F | int) -> None:
        a, b = F(left), F(right)
        valid = a == b if relation == "=" else a < b if relation == "<" else a <= b
        if not valid:
            raise s._Refusal("Derivation", f"bound obligation failed: {name}")
        obligations.append(
            {"Name": name, "Left": _r(a), "Relation": relation, "Right": _r(b)}
        )

    prediction = 3 * eta
    mass = 4 * eta
    posterior_same = (eta + mass) / F(1, 8) + eta
    posterior = posterior_same + 3 * prediction
    probability = mass + F(1, 2) * prediction
    check("prediction-three-roundings", (F(3, 4) + 2) * eta, "<=", prediction)
    check("mass-four-roundings", (F(1, 4) + 3) * eta, "<=", mass)
    check("posterior-Lipschitz", F(3, 16) / F(1, 4) ** 2, "=", 3)
    check("mass-Lipschitz", F(3, 4) - F(1, 4), "=", F(1, 2))
    check(
        "exact-recursive-posterior-lower",
        F(1, 4) * F(1, 8) / (F(3, 4) - F(1, 2) * F(1, 8)),
        "=",
        F(1, 22),
    )
    check(
        "exact-recursive-posterior-upper",
        F(3, 4) * F(7, 8) / (F(1, 4) + F(1, 2) * F(7, 8)),
        "=",
        F(21, 22),
    )
    check("computed-mass-positive", F(1, 8), "<", F(1, 4) - mass)
    check("computed-mass-less-than-one", F(3, 4) + mass, "<", 1)
    check("posterior-same-prior", posterior_same, "=", 41 * eta)
    check("posterior-including-prior", posterior, "=", 50 * eta)
    check("probability-including-prior", probability, "<=", 6 * eta)
    check("predicted-prior-lower", 0, "<", F(1, 8) - prediction)
    check("predicted-prior-upper", F(7, 8) + prediction, "<", 1)
    check("recursive-posterior-lower", 0, "<", F(1, 22) - posterior)
    check("recursive-posterior-upper", F(21, 22) + posterior, "<", 1)
    check("elementary-absolute-rounding-at-eight", F(1, 1 << 50), "<=", eta)
    errors = [F(0)]
    depths: list[Json] = []
    for depth in (1, 2, 3):
        n = depth - 1
        lipschitz = F(5 * n, 4)
        if n:
            continuation = 2 * errors[-1] + (100 * lipschitz + 6 * n + 1) * eta
            error = 2 * continuation + 2 * eta
            check(
                f"depth{depth}-recurrence",
                error,
                "=",
                4 * errors[-1] + (262 * n + 4) * eta,
            )
            errors.append(error)
            # Every exact weighted continuation is bounded by n. This wider
            # intermediate range includes propagated posterior/tree/round errors.
            child_bound = F(n) + errors[n - 1] + lipschitz * posterior
            check(f"depth{depth}-probability-range", F(3, 4) + mass, "<", 2)
            # Tighter actual probability upper bound certifies the registered8.
            check(
                f"depth{depth}-weighted-sum-range-eight",
                1 + 2 * (F(3, 4) + mass) * child_bound + 4 * eta,
                "<",
                8,
            )
        error = errors[depth - 1]
        rho = 2 * error + eta
        check(f"depth{depth}-trivial-harvest", F(-1, 4) + rho, "<=", epsilon)
        depths.append(
            {
                "Depth": depth,
                "ChildLipschitz": _r(lipschitz),
                "Error": _r(error),
                "Rho": _r(rho),
            }
        )
    check("depth2-error-fixed", errors[1], "=", 266 * eta)
    check("depth3-error-fixed", errors[2], "=", 1592 * eta)
    return {
        "Eta": _r(eta),
        "PredictionError": _r(prediction),
        "MassError": _r(mass),
        "PosteriorSamePriorError": _r(posterior_same),
        "PosteriorError": _r(posterior),
        "ProbabilityError": _r(6 * eta),
        "Depths": depths,
        "Obligations": obligations,
        "StructuralPremises": [
            "RN is monotone; likelihood products are nonnegative",
            "rounded mass >= each rounded numerator; RN(numerator/mass) remains in [0,1]",
            "exact contingent hidden values lie in [-d/4,d]; slopes <=5d/4",
            "exact V lies in [0,d]; maximum is nonexpansive",
            "source expression order and actual runtime IEEE premises are separately admitted",
        ],
    }, (2 * errors[0] + eta, 2 * errors[1] + eta, 2 * errors[2] + eta)


def _guards(epsilon: F, rhos: tuple[F, F, F]) -> tuple[list[Json], tuple[Guard, Guard]]:
    raw: list[Json] = []
    verified = []
    for depth, center, factor in ((2, F(1, 5), F(2, 5)), (3, F(51, 190), F(32, 95))):
        minus = center - factor * (epsilon + rhos[depth - 1])
        plus = center - factor * (epsilon - rhos[depth - 1])
        intercept, slope = (
            (F(1, 2), F(-5, 2)) if depth == 2 else (F(51, 64), F(-95, 32))
        )
        if (
            intercept + slope * minus != epsilon + rhos[depth - 1]
            or intercept + slope * plus != epsilon - rhos[depth - 1]
        ):
            raise s._Refusal(
                "Derivation", "rational guard cuts do not solve the certified gap"
            )
        switch = s._round(minus)
        if s._value(switch) >= minus:
            switch = s._neighbor(switch, False)
        harvest = s._round(plus)
        if s._value(harvest) < plus:
            harvest = s._neighbor(harvest, True)
        snext, hprev = s._neighbor(switch, True), s._neighbor(harvest, False)
        if not (
            0 < s._value(switch) < minus <= s._value(snext)
            and s._value(hprev) < plus <= s._value(harvest) < 1
            and switch < harvest
            and (depth != 3 or plus < F(17, 42))
        ):
            raise s._Refusal("Derivation", "inward guard-neighbor inequalities failed")
        verified.append(Guard(depth, switch, harvest))
        raw.append(
            {
                "Depth": depth,
                "Rminus": _r(minus),
                "Rplus": _r(plus),
                "SmaxBits": f"{switch:016X}",
                "SnextBits": f"{snext:016X}",
                "HprevBits": f"{hprev:016X}",
                "HminBits": f"{harvest:016X}",
                "Relations": [
                    "Smax<Rminus<=Snext",
                    "Hprev<Rplus<=Hmin",
                    "Smax<Hmin",
                    "effective-depth3:Rplus<17/42",
                ],
            }
        )
    return raw, (verified[0], verified[1])


def _derive(
    bindings: dict[str, str],
) -> tuple[dict[str, Json], tuple[Guard, Guard], int]:
    epsilon_bits = s._round(F(1, 10**12))
    epsilon = s._value(epsilon_bits)
    bounds, rhos = _bounds(epsilon)
    guards, admitted = _guards(epsilon, rhos)
    numeric: dict[str, Json] = {
        "Schema": SCHEMA,
        "Bindings": dict(bindings),
        "Model": {
            "Drift": _r(F(1, 8)),
            "CueAccuracy": _r(F(3, 4)),
            "SwitchReward": _r(F(-1, 4)),
            "Horizon": 16,
            "EpsilonBits": f"{epsilon_bits:016X}",
        },
        "ExpressionGraph": list(EXPRESSION_GRAPH),
        "Bounds": bounds,
        "Models": [
            _model(effect, depth) for effect in (True, False) for depth in (1, 2, 3)
        ],
        "Guards": guards,
    }
    return numeric, admitted, epsilon_bits


def build_certificate(bindings: object) -> s.Result[dict[str, Json]]:
    """Construct proof data only; this does not certify a native runtime or artifact."""
    return s._capture(lambda: _derive(_bindings(bindings))[0])


def _same(expected: Json, actual: object) -> bool:
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return (
            isinstance(actual, dict)
            and expected.keys() == actual.keys()
            and all(_same(value, actual[key]) for key, value in expected.items())
        )
    if isinstance(expected, list):
        return (
            isinstance(actual, list)
            and len(expected) == len(actual)
            and all(_same(a, b) for a, b in zip(expected, actual))
        )
    return expected == actual


def verify_certificate(
    raw: object, expected_bindings: object
) -> s.Result[VerifiedCertificate]:
    def operation() -> VerifiedCertificate:
        bindings = _bindings(expected_bindings)
        expected, guards, epsilon = _derive(bindings)
        if not _same(expected, raw):
            raise s._Refusal(
                "CertificateMismatch",
                "numeric certificate differs from full independent reconstruction",
            )
        encoded = json.dumps(
            expected, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        ).encode("ascii")
        certificate = VerifiedCertificate(
            hashlib.sha256(encoded).hexdigest().upper(),
            tuple(bindings.items()),
            epsilon,
            guards,
            _SEAL,
        )
        _ISSUED.add(certificate)
        return certificate

    return s._capture(operation)


def _admitted(value: object) -> VerifiedCertificate:
    if (
        type(value) is not VerifiedCertificate
        or value._seal is not _SEAL
        or value not in _ISSUED
    ):
        raise s._Refusal(
            "CertificateNotVerified", "independently verified certificate required"
        )
    return value
