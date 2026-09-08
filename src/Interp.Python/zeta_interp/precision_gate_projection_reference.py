"""Independent interval root and certificate receipts for scalar projection.

Exact dyadic targets are rendered by integer arithmetic. Decimal intervals do
not emulate native operation order. Supplied receipts never prove execution,
source custody or runtime admission. Public encoding failures retain the full
actual in-memory receipt separately from any claim of durable publication.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from decimal import Decimal
from fractions import Fraction
from typing import Any, NoReturn

from . import hidden_switch_compiled_ieee as ieee
from . import precision_gate_projection_intervals as iv

Failure = iv.Failure
Success = iv.Success
# Trees contain only admitted JSON values. Explicit shape validation precedes use.
type Tree = dict[str, Any]


@dataclass(frozen=True, slots=True)
class ReceiptFailure:
    Failure: Failure
    Receipt: Tree


type ReceiptResult = Success[Tree] | Failure | ReceiptFailure

PROTOCOL_SHA256 = "537054779BF9E0BFA9271B5CC56116FBC80B16C4A2BE9F1B5E3C022FE95A0F8E"
INPUT_LIMIT = 65536
RESULT_LIMIT = 2 * 1024 * 1024
WIDTH = Fraction(1, 10**50)
TOLERANCE = Fraction(1, 10**12)
_FIELDS = ("T", "U", "K", "C")
_DECIMAL = re.compile(r"-?(0|[1-9][0-9]*)(\.[0-9]+)?(e[+-]?[0-9]+)?", re.ASCII)
_HASH = re.compile(r"[0-9A-F]{64}", re.ASCII)
_CASE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}", re.ASCII)
_ROOT_COUNTERS = (
    "Starts",
    "ParameterPreparations",
    "EndpointEvaluations",
    "MidpointAttempts",
    "MidpointEvaluations",
    "PrecisionEscalations",
    "BracketAdmissions",
    "MomentEvaluations",
    "TranscendentalEntries",
)
_CODES = frozenset(
    (
        "Wire",
        "Domain",
        "NumericalRange",
        "NumericalUnderflow",
        "NoRoundedBracket",
        "IterationLimit",
        "ResolutionLimit",
        "SignIndeterminate",
        "EmptyIntersection",
        "ObjectiveRefusal",
        "TargetMismatch",
        "SourceMismatch",
        "CandidateShape",
        "NoRootEnclosure",
        "NotCloseToMinimum",
        "InconsistentCoordinate",
        "ObjectiveMismatch",
        "ResultTooLarge",
        "Unexpected",
    )
)
_STAGES = frozenset(
    (
        "input",
        "parameters",
        "left-endpoint",
        "right-endpoint",
        "midpoint",
        "reconstruction",
        "objective",
        "certificate",
        "encoding",
    )
)


class _Halt(Exception):
    def __init__(self, failure: Failure):
        super().__init__(failure.Message)
        self.failure = failure


class _Retry(_Halt):
    pass


def _fail(code: str, stage: str, field: str | None, message: str) -> NoReturn:
    raise _Halt(Failure(code, stage, field, message[:1024]))


def _take[T](result: iv.Result[T], stage: str) -> T:
    if isinstance(result, Failure):
        raise _Halt(Failure(result.Code, stage, result.Field, result.Message))
    return result.Value


def _ratio(value: Fraction) -> Tree:
    return {"Num": str(value.numerator), "Den": str(value.denominator)}


def _interval(value: iv.Interval | None) -> Tree | None:
    return (
        None
        if value is None
        else {"Lower": str(value.Lower), "Upper": str(value.Upper)}
    )


def _keys(
    value: object, expected: tuple[str, ...] | set[str], field: str, code: str = "Wire"
) -> Tree:
    if type(value) is not dict or set(value) != set(expected):
        _fail(code, "input", field, "exact object keys required")
    return value


def _pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            _fail("Wire", "input", key, "duplicate JSON member")
        result[key] = value
    return result


def _constant(value: str) -> None:
    _fail("Wire", "input", "JSON", "nonfinite JSON constant")


def _decode(raw: bytes, limit: int, field: str) -> object:
    if len(raw) > limit:
        _fail("Wire", "input", field, "byte limit exceeded")
    try:
        return json.loads(
            raw.decode("utf-8", "strict"),
            object_pairs_hook=_pairs,
            parse_constant=_constant,
        )
    except (UnicodeError, ValueError, RecursionError) as error:
        _fail("Wire", "input", field, type(error).__name__)
    return None


def _caller(raw: object, bindings: object, input_sha: object, case_id: object) -> Tree:
    if type(raw) is not bytes:
        _fail("Wire", "input", "raw_input", "exact bytes required")
    if type(input_sha) is not str or _HASH.fullmatch(input_sha) is None:
        _fail(
            "SourceMismatch",
            "input",
            "expected_input_sha256",
            "uppercase SHA256 required",
        )
    if hashlib.sha256(raw).hexdigest().upper() != input_sha:
        _fail(
            "TargetMismatch", "input", "InputSha256", "independent input hash differs"
        )
    if type(case_id) is not str or _CASE.fullmatch(case_id) is None:
        _fail("Wire", "input", "expected_case_id", "bounded ASCII identifier required")
    if type(bindings) is not dict or not 1 <= len(bindings) <= 256:
        _fail(
            "SourceMismatch",
            "input",
            "Bindings",
            "finite independent binding map required",
        )
    for key, value in bindings.items():
        if (
            type(key) is not str
            or not key.isascii()
            or not 1 <= len(key) <= 512
            or type(value) is not str
            or _HASH.fullmatch(value) is None
        ):
            _fail(
                "SourceMismatch",
                "input",
                "Bindings",
                "bounded path and uppercase SHA256 required",
            )
        if key != "ProtocolSha256" and (
            key.startswith("/")
            or "\\" in key
            or any(part in ("", ".", "..") for part in key.split("/"))
            or any(ord(char) < 33 or ord(char) > 126 for char in key)
        ):
            _fail(
                "SourceMismatch",
                "input",
                "Bindings",
                "canonical relative source path required",
            )
    if bindings.get("ProtocolSha256") != PROTOCOL_SHA256:
        _fail(
            "SourceMismatch",
            "input",
            "Bindings.ProtocolSha256",
            "registered protocol required",
        )
    return dict(bindings)


def _decimal(value: object, field: str) -> Fraction:
    if (
        type(value) is not str
        or not value.isascii()
        or not 1 <= len(value) <= 128
        or _DECIMAL.fullmatch(value) is None
    ):
        _fail("Wire", "input", field, "registered ASCII decimal string required")
    mantissa, marker, exponent_text = value.partition("e")
    exponent = 0
    if marker:
        digits = exponent_text.lstrip("+-").lstrip("0") or "0"
        if len(digits) > 3 or int(digits) > 400:
            _fail("Wire", "input", field, "exponent magnitude exceeds 400")
        exponent = int(exponent_text)
    negative = mantissa.startswith("-")
    whole, dot, fraction = mantissa.lstrip("-").partition(".")
    numerator = int(whole + fraction)
    if negative:
        numerator = -numerator
    power = exponent - (len(fraction) if dot else 0)
    return (
        Fraction(numerator * 10**power)
        if power >= 0
        else Fraction(numerator, 10 ** (-power))
    )


@dataclass(frozen=True, slots=True)
class _Input:
    Snapshot: Tree
    Values: dict[str, Fraction]
    Profile: str


def _input(raw: bytes, case_id: str) -> _Input:
    value = _keys(
        _decode(raw, INPUT_LIMIT, "Input"),
        ("Schema", "Id", "Parameters", "Profile"),
        "Input",
    )
    if (
        value["Schema"] != "zeta.precision-projection.input.v1"
        or type(value["Schema"]) is not str
    ):
        _fail("Wire", "input", "Schema", "input schema required")
    if type(value["Id"]) is not str or value["Id"] != case_id:
        _fail("TargetMismatch", "input", "Id", "independently expected case required")
    if type(value["Profile"]) is not str or value["Profile"] not in (
        "default",
        "native-one",
        "reference-one",
    ):
        _fail("Wire", "input", "Profile", "fixed profile required")
    parameters = _keys(value["Parameters"], _FIELDS, "Parameters")
    # Parse all literal domains before numerical rendering or service entry.
    requested = {
        name: _decimal(parameters[name], "Parameters." + name) for name in _FIELDS
    }
    bits: dict[str, str] = {}
    exact: dict[str, Fraction] = {}
    for name in _FIELDS:
        rounded = ieee.round_fraction(
            requested[name],
            negative_zero=requested[name] == 0 and parameters[name].startswith("-"),
        )
        if isinstance(rounded, ieee.Failure):
            _fail("NumericalRange", "input", "Parameters." + name, rounded.Message)
        encoded = ieee.format_bits(rounded.value)
        decoded = ieee.exact_fraction(rounded.value)
        if isinstance(encoded, ieee.Failure) or isinstance(decoded, ieee.Failure):
            _fail(
                "Unexpected",
                "input",
                name,
                "finite integer renderer returned inconsistent result",
            )
        bits[name], exact[name] = encoded.value, decoded.value
    snapshot = {
        "RequestedParameters": dict(parameters),
        "TargetBits": bits,
        "DyadicTarget": {name: _ratio(exact[name]) for name in _FIELDS},
        "ConversionDelta": {
            name: _ratio(exact[name] - requested[name]) for name in _FIELDS
        },
    }
    return _Input(snapshot, exact, value["Profile"])


def _publish(receipt: Tree) -> ReceiptResult:
    """Check finite encoded size without discarding an already returned receipt."""
    try:
        total = 0
        encoder = json.JSONEncoder(
            ensure_ascii=True, allow_nan=False, separators=(",", ":")
        )
        for chunk in encoder.iterencode(receipt):
            total += len(chunk.encode("utf-8"))
            if total > RESULT_LIMIT:
                return ReceiptFailure(
                    Failure(
                        "ResultTooLarge",
                        "encoding",
                        "Receipt",
                        "complete encoded receipt exceeds limit",
                    ),
                    receipt,
                )
        return Success(receipt)
    except Exception as error:  # noqa: BLE001 - actual receipt must survive encoding faults.
        return ReceiptFailure(
            Failure("Unexpected", "encoding", "Receipt", type(error).__name__), receipt
        )


class _Root:
    def __init__(self, case_id: str, input_sha: str, bindings: Tree):
        self.receipt: Tree = {
            "Schema": "zeta.precision-projection.reference.v1",
            "CaseId": case_id,
            "InputSha256": input_sha,
            "Bindings": bindings,
            "Target": None,
            "Contexts": [],
            "Outcome": None,
            "Counters": dict.fromkeys(_ROOT_COUNTERS, 0),
            "Trace": [],
        }
        self.arithmetic: iv.Arithmetic | None = None
        self.stage = "input"
        self.attempt = 0
        self.row: Tree | None = None
        self.bracket: iv.Interval | None = None
        self.mean: iv.Interval | None = None
        self.variance: iv.Interval | None = None
        self.parameters: dict[str, iv.Interval] = {}
        self.target: dict[str, iv.Interval] = {}

    def count(self, key: str, limit: int) -> None:
        if self.receipt["Counters"][key] >= limit:
            _fail("IterationLimit", self.stage, key, "registered entry limit")
        self.receipt["Counters"][key] += 1

    def begin(
        self, stage: str, *, attempt: int = 0, point: Decimal | None = None
    ) -> None:
        self.stage = "reconstruction" if stage == "moments" else stage
        self.row = {
            "Sequence": len(self.receipt["Trace"]) + 1,
            "Stage": stage,
            "Precision": self.arithmetic.Spec.Precision if self.arithmetic else None,
            "Attempt": attempt,
            "Point": str(point) if point is not None else None,
            "Parameters": None,
            "Phi": None,
            "Before": None,
            "After": None,
            "M1": None,
            "M2": None,
            "Mean": None,
            "Variance": None,
            "Failure": None,
            "Recoverable": False,
        }

    def end(self, failure: Failure | None = None) -> None:
        if self.row is not None:
            if failure is not None:
                self.row["Failure"] = asdict(failure)
            self.receipt["Trace"].append(self.row)
            self.row = None

    def record(self, name: str, value: iv.Interval | None) -> None:
        assert self.row is not None
        self.row[name] = _interval(value)

    def take[T](self, result: iv.Result[T]) -> T:
        return _take(result, self.stage)

    @property
    def a(self) -> iv.Arithmetic:
        assert self.arithmetic is not None
        return self.arithmetic

    def point(self, number: Fraction | int | Decimal) -> iv.Interval:
        return self.take(self.a.point(Fraction(number)))

    def add(self, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(self.a.add(x, y))

    def sub(self, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(self.a.subtract(x, y))

    def mul(self, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(self.a.multiply(x, y))

    def div(self, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(self.a.divide(x, y))

    def exp(self, x: iv.Interval) -> iv.Interval:
        try:
            return self.take(self.a.exp(x))
        finally:
            self.receipt["Counters"]["TranscendentalEntries"] = (
                self.a.TranscendentalEntries
            )

    def ln(self, x: iv.Interval) -> iv.Interval:
        try:
            return self.take(self.a.ln(x))
        finally:
            self.receipt["Counters"]["TranscendentalEntries"] = (
                self.a.TranscendentalEntries
            )

    def phi(self, x: Decimal) -> iv.Interval:
        point = self.point(x)
        q = self.exp(point)
        return self.sub(
            self.sub(
                self.add(point, q),
                self.div(self.parameters["D"], self.add(self.point(1), q)),
            ),
            self.parameters["B"],
        )

    def prepare(self, original: _Input, precision: int) -> None:
        old_entries = self.receipt["Counters"]["TranscendentalEntries"]
        self.arithmetic = self.take(iv.make_arithmetic(precision))
        self.a.TranscendentalEntries = old_entries
        self.receipt["Contexts"].append(asdict(self.a.Spec))
        self.begin("parameters")
        self.count("ParameterPreparations", 3)
        self.target = {
            name: self.point(value) for name, value in original.Values.items()
        }
        t, u, k, c = (self.target[name] for name in _FIELDS)
        lt, lc = self.ln(t), self.ln(c)
        a = self.add(u, self.div(k, t))
        b = self.add(self.sub(lc, lt), a)
        d = self.div(self.point(1), self.mul(self.point(2), t))
        lower = min(Decimal(0), self.sub(b, self.point(1)).Lower)
        upper_base = max(Decimal(1), self.add(b, d).Upper)
        upper = self.ln(self.point(upper_base)).Upper
        initial = iv.Interval(lower, upper)
        self.parameters = {
            "A": a,
            "B": b,
            "D": d,
            "LogT": lt,
            "LogC": lc,
            "Initial": initial,
        }
        assert self.row is not None
        self.row["Parameters"] = {
            key: _interval(value) for key, value in self.parameters.items()
        }
        self.end()
        if lower >= upper:
            raise _Retry(
                Failure(
                    "SignIndeterminate",
                    "parameters",
                    "Initial",
                    "strict containing bracket not yet admitted",
                )
            )
        signs = []
        for stage, endpoint in (("left-endpoint", lower), ("right-endpoint", upper)):
            self.begin(stage, point=endpoint)
            self.count("EndpointEvaluations", 6)
            value = self.phi(endpoint)
            self.record("Phi", value)
            self.end()
            signs.append(value)
        if signs[0].Upper > 0 or signs[1].Lower < 0:
            raise _Retry(
                Failure(
                    "SignIndeterminate",
                    "parameters",
                    "Initial",
                    "initial endpoint interval signs unresolved",
                )
            )
        proved = (
            initial
            if self.bracket is None
            else self.take(iv.intersect(initial, self.bracket))
        )
        self.admit(proved)

    def admit(self, bracket: iv.Interval) -> None:
        previous = self.bracket
        self.count("BracketAdmissions", 259)
        self.bracket = bracket
        self.begin("moments")
        self.record("Before", previous)
        self.record("After", bracket)
        self.count("MomentEvaluations", 259)
        lo, hi = self.point(bracket.Lower), self.point(bracket.Upper)
        qlo, qhi = self.exp(lo), self.exp(hi)
        t = self.target["T"]
        vlo = self.div(self.point(1), self.mul(t, self.add(self.point(1), qlo)))
        vhi = self.div(self.point(1), self.mul(t, self.add(self.point(1), qhi)))
        m1lo, m1hi = (
            self.sub(self.parameters["A"], qlo),
            self.sub(self.parameters["A"], qhi),
        )
        m1 = iv.Interval(m1hi.Lower, m1lo.Upper)
        self.record("M1", m1)
        m2lo = self.sub(
            self.sub(self.add(self.parameters["LogT"], lo), self.parameters["LogC"]),
            self.div(vlo, self.point(2)),
        )
        m2hi = self.sub(
            self.sub(self.add(self.parameters["LogT"], hi), self.parameters["LogC"]),
            self.div(vhi, self.point(2)),
        )
        m2 = iv.Interval(m2lo.Lower, m2hi.Upper)
        self.record("M2", m2)
        variance = iv.Interval(vhi.Lower, vlo.Upper)
        if variance.Lower <= 0:
            _fail(
                "NumericalUnderflow",
                "reconstruction",
                "Variance",
                "positive variance lower bound required",
            )
        self.variance = variance
        self.record("Variance", variance)
        mean = self.take(iv.intersect(m1, m2))
        self.mean = mean
        self.record("Mean", mean)
        self.end()

    def complete(self) -> bool:
        return (
            self.mean is not None
            and self.variance is not None
            and self.take(iv.exact_width(self.mean)) <= WIDTH
            and self.take(iv.exact_width(self.variance)) <= WIDTH
        )

    def solve(self, raw: bytes, case_id: str) -> None:
        self.begin("input")
        original = _input(raw, case_id)
        self.receipt["Target"] = original.Snapshot
        self.receipt["Counters"]["Starts"] = 1
        if original.Values["T"] <= 0 or original.Values["C"] <= 0:
            _fail("Domain", "input", "Target", "rendered t and c must be positive")
        self.end()
        limit = 1 if original.Profile == "reference-one" else 256
        precision_index = 0
        prepared = False
        retry_midpoint = False
        while True:
            try:
                if not prepared:
                    self.prepare(original, (80, 160, 320)[precision_index])
                    prepared = True
                if self.complete():
                    self.receipt["Outcome"] = {
                        "Kind": "enclosure",
                        "Value": {
                            "LogRatio": _interval(self.bracket),
                            "Mean": _interval(self.mean),
                            "Variance": _interval(self.variance),
                        },
                    }
                    self.begin("terminal")
                    self.end()
                    return
                if not retry_midpoint:
                    self.count("MidpointAttempts", limit)
                retry_midpoint = False
                self.attempt = self.receipt["Counters"]["MidpointAttempts"]
                assert self.bracket is not None
                self.begin("midpoint", attempt=self.attempt)
                self.record("Before", self.bracket)
                midpoint_result = self.a.midpoint(self.bracket)
                if (
                    type(midpoint_result) is Failure
                    and midpoint_result.Code == "ResolutionLimit"
                ):
                    raise _Retry(
                        Failure(
                            midpoint_result.Code,
                            "midpoint",
                            midpoint_result.Field,
                            midpoint_result.Message,
                        )
                    )
                point = self.take(midpoint_result)
                assert self.row is not None
                self.row["Point"] = str(point)
                self.count("MidpointEvaluations", 258)
                residual = self.phi(point)
                self.record("Phi", residual)
                lower = self.sub(
                    self.point(point), self.point(max(residual.Upper, Decimal(0)))
                ).Lower
                upper = self.sub(
                    self.point(point), self.point(min(residual.Lower, Decimal(0)))
                ).Upper
                narrowed = self.take(
                    iv.intersect(self.bracket, iv.Interval(lower, upper))
                )
                self.record("After", narrowed)
                if narrowed == self.bracket:
                    raise _Retry(
                        Failure(
                            "ResolutionLimit",
                            "midpoint",
                            "Bracket",
                            "no justified interval contraction",
                        )
                    )
                self.end()
                self.admit(narrowed)
            except _Retry as error:
                stage = self.stage
                self.end(error.failure)
                if precision_index == 2:
                    raise _Halt(error.failure) from error
                self.begin("precision-retry")
                assert self.row is not None
                self.row["Failure"] = asdict(error.failure)
                self.row["Recoverable"] = True
                self.end()
                self.count("PrecisionEscalations", 2)
                precision_index += 1
                prepared = False
                retry_midpoint = stage == "midpoint"

    def refuse(self, failure: Failure) -> None:
        self.end(failure)
        self.receipt["Outcome"] = {
            "Kind": "refused",
            "Failure": asdict(failure),
            "Partial": {
                "LogRatio": _interval(self.bracket),
                "Mean": _interval(self.mean),
                "Variance": _interval(self.variance),
            },
        }
        self.begin("terminal")
        self.end(failure)


def reference_root(
    raw_input: object,
    expected_bindings: object,
    *,
    expected_input_sha256: object,
    expected_case_id: object,
) -> ReceiptResult:
    """Return an admitted receipt or a separate caller/encoding refusal.

    Expected bindings are the caller's reviewed finite roster. No filesystem,
    source-map closure or physical execution is inferred from this argument.
    """
    try:
        bindings = _caller(
            raw_input, expected_bindings, expected_input_sha256, expected_case_id
        )
    except _Halt as error:
        return error.failure
    except Exception as error:  # noqa: BLE001 - unexpected caller admission is typed.
        return Failure("Unexpected", "input", None, type(error).__name__)
    assert (
        type(raw_input) is bytes
        and type(expected_case_id) is str
        and type(expected_input_sha256) is str
    )
    root = _Root(expected_case_id, expected_input_sha256, bindings)
    try:
        root.solve(raw_input, expected_case_id)
    except _Halt as error:
        root.refuse(error.failure)
    except Exception as error:  # noqa: BLE001 - preserve full actual numeric prefix.
        root.refuse(
            Failure(
                "Unexpected",
                root.stage if root.stage in _STAGES else "parameters",
                None,
                type(error).__name__,
            )
        )
    return _publish(root.receipt)
