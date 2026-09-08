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
    if len(raw) > INPUT_LIMIT:
        _fail("Wire", "input", "raw_input", "input byte limit precedes hashing")
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
        self.begin("parameters")
        assert self.row is not None
        # No requested context has been admitted until its factory returns.
        self.row["Precision"] = None
        self.count("ParameterPreparations", 3)
        old_entries = self.receipt["Counters"]["TranscendentalEntries"]
        self.arithmetic = self.take(iv.make_arithmetic(precision))
        self.a.TranscendentalEntries = old_entries
        self.row["Precision"] = self.a.Spec.Precision
        self.receipt["Contexts"].append(asdict(self.a.Spec))
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
                # An exhausted budget refuses the next midpoint operation;
                # it does not create a phantom entry or reconstruction failure.
                self.stage = "midpoint"
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
                retry_midpoint = retry_midpoint or stage == "midpoint"

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


_NATIVE_FIELDS = (
    "TargetBits",
    "LogRatioBits",
    "RatioBits",
    "RBits",
    "MeanBits",
    "VarianceBits",
    "Bracket",
    "Stop",
    "OriginalObjective",
)
_OBJECTIVE_BITS = ("ValueBits", "DerivativeMeanBits", "DerivativeVarianceBits")
_CERT_COUNTERS = (
    "Starts",
    "ReferenceRootCalls",
    "CertificatePreparations",
    "CoordinateIntervalCalls",
    "ObjectiveIntervalCalls",
    "CertificateTranscendentalEntries",
    "LeafChecks",
)


def _bits(value: object, field: str) -> Fraction:
    parsed = ieee.parse_bits(value)
    if isinstance(parsed, ieee.Failure):
        _fail("CandidateShape", "certificate", field, parsed.Message)
    exact = ieee.exact_fraction(parsed.value)
    if isinstance(exact, ieee.Failure):
        _fail("CandidateShape", "certificate", field, exact.Message)
    return exact.value


def _string(value: object, field: str, limit: int = 1024) -> str:
    if type(value) is not str or len(value) > limit:
        _fail("CandidateShape", "certificate", field, "bounded string required")
    try:
        value.encode("utf-8", "strict")
    except UnicodeError:
        _fail("CandidateShape", "certificate", field, "Unicode scalar string required")
    return value


def _integer(value: object, field: str, limit: int) -> int:
    if type(value) is not int or not 0 <= value <= limit:
        _fail(
            "CandidateShape",
            "certificate",
            field,
            "bounded nonnegative integer required",
        )
    return value


def _kernel_failure(value: object, field: str) -> Tree:
    record = _keys(value, ("Kind", "Field", "Detail"), field, "CandidateShape")
    if type(record["Kind"]) is not str or record["Kind"] not in (
        "InvalidInput",
        "NumericalFailure",
        "ImproperBelief",
    ):
        _fail(
            "CandidateShape",
            "certificate",
            field + ".Kind",
            "existing kernel error kind required",
        )
    _string(record["Field"], field + ".Field")
    if record["Kind"] == "ImproperBelief":
        if record["Detail"] is not None:
            _fail(
                "CandidateShape",
                "certificate",
                field + ".Detail",
                "improper-belief detail must be null",
            )
    else:
        _string(record["Detail"], field + ".Detail")
    return record


def _native_failure(value: object, field: str) -> Tree:
    record = _keys(
        value,
        ("Code", "Stage", "Field", "Message", "OriginalKernelFailure"),
        field,
        "CandidateShape",
    )
    if type(record["Code"]) is not str or record["Code"] not in _CODES:
        _fail(
            "CandidateShape",
            "certificate",
            field + ".Code",
            "registered failure code required",
        )
    if type(record["Stage"]) is not str or record["Stage"] not in _STAGES:
        _fail(
            "CandidateShape",
            "certificate",
            field + ".Stage",
            "registered failure stage required",
        )
    if record["Field"] is not None:
        _string(record["Field"], field + ".Field")
    _string(record["Message"], field + ".Message")
    if record["OriginalKernelFailure"] is not None:
        _kernel_failure(
            record["OriginalKernelFailure"], field + ".OriginalKernelFailure"
        )
    return record


def _bit_map(
    value: object, fields: tuple[str, ...], path: str, *, nullable: bool = False
) -> Tree:
    record = _keys(value, fields, path, "CandidateShape")
    for name in fields:
        if record[name] is not None or not nullable:
            _bits(record[name], path + "." + name)
    return record


def _candidate(value: object, original: _Input, *, nullable: bool = False) -> Tree:
    record = _keys(value, _NATIVE_FIELDS, "Candidate", "CandidateShape")
    for name in _NATIVE_FIELDS:
        item = record[name]
        if item is None and nullable:
            continue
        if name == "TargetBits":
            target = _bit_map(item, _FIELDS, "Candidate.TargetBits")
            if target != original.Snapshot["TargetBits"]:
                _fail(
                    "TargetMismatch",
                    "certificate",
                    "Candidate.TargetBits",
                    "exact independently rendered bits differ",
                )
        elif name == "Bracket":
            _bit_map(item, ("LowerBits", "UpperBits"), "Candidate.Bracket")
        elif name == "Stop":
            if type(item) is not str or item not in ("rounded-zero", "rounded-width"):
                _fail(
                    "CandidateShape",
                    "certificate",
                    "Candidate.Stop",
                    "registered stop required",
                )
        elif name == "OriginalObjective":
            _bit_map(item, _OBJECTIVE_BITS, "Candidate.OriginalObjective")
        else:
            _bits(item, "Candidate." + name)
    return record


def _native(
    raw: bytes, original: _Input, case_id: str, input_sha: str, bindings: Tree
) -> Tree:
    value = _keys(
        _decode(raw, RESULT_LIMIT, "NativeRaw"),
        ("Schema", "CaseId", "InputSha256", "Bindings", "Outcome", "Counters", "Trace"),
        "Native",
        "CandidateShape",
    )
    if (
        type(value["Schema"]) is not str
        or value["Schema"] != "zeta.precision-projection.native.v1"
    ):
        _fail(
            "CandidateShape", "certificate", "Native.Schema", "native schema required"
        )
    if type(value["CaseId"]) is not str or value["CaseId"] != case_id:
        _fail(
            "TargetMismatch", "certificate", "Native.CaseId", "independent case differs"
        )
    if type(value["InputSha256"]) is not str or value["InputSha256"] != input_sha:
        _fail(
            "TargetMismatch",
            "certificate",
            "Native.InputSha256",
            "independent original input hash differs",
        )
    actual_bindings = _keys(
        value["Bindings"], set(bindings), "Native.Bindings", "SourceMismatch"
    )
    if any(
        type(actual_bindings[key]) is not str or actual_bindings[key] != expected
        for key, expected in bindings.items()
    ):
        _fail(
            "SourceMismatch",
            "certificate",
            "Native.Bindings",
            "complete independent binding map differs",
        )
    midpoint_limit = 1 if original.Profile == "native-one" else 256
    limits = {
        "Starts": 1,
        "PhiEntries": midpoint_limit + 2,
        "MidpointAttempts": midpoint_limit,
        "BracketUpdates": midpoint_limit,
        "LogEntries": 3,
        "ExpEntries": midpoint_limit + 2,
        "ObjectiveEntries": 1,
    }
    counters = _keys(
        value["Counters"], set(limits), "Native.Counters", "CandidateShape"
    )
    for name, limit in limits.items():
        _integer(counters[name], "Native.Counters." + name, limit)
    if type(value["Trace"]) is not list or len(value["Trace"]) > 262:
        _fail(
            "CandidateShape",
            "certificate",
            "Native.Trace",
            "bounded trace array required",
        )
    for index, raw_row in enumerate(value["Trace"], 1):
        path = f"Native.Trace[{index - 1}]"
        row = _keys(
            raw_row,
            (
                "Sequence",
                "Stage",
                "Attempt",
                "PointBits",
                "PhiBits",
                "LowerBits",
                "UpperBits",
                "Failure",
            ),
            path,
            "CandidateShape",
        )
        if _integer(row["Sequence"], path + ".Sequence", 262) != index:
            _fail(
                "CandidateShape", "certificate", path, "consecutive sequence required"
            )
        if type(row["Stage"]) is not str or row["Stage"] not in (
            "input",
            "parameters",
            "left-endpoint",
            "right-endpoint",
            "midpoint",
            "reconstruction",
            "objective",
        ):
            _fail(
                "CandidateShape",
                "certificate",
                path + ".Stage",
                "native stage required",
            )
        attempt = _integer(row["Attempt"], path + ".Attempt", midpoint_limit)
        if (row["Stage"] == "midpoint" and attempt == 0) or (
            row["Stage"] != "midpoint" and attempt != 0
        ):
            _fail(
                "CandidateShape",
                "certificate",
                path + ".Attempt",
                "attempt only belongs to midpoint stage",
            )
        for name in ("PointBits", "PhiBits", "LowerBits", "UpperBits"):
            if row[name] is not None:
                _bits(row[name], path + "." + name)
        if row["Failure"] is not None:
            _native_failure(row["Failure"], path + ".Failure")
    outcome = value["Outcome"]
    if type(outcome) is not dict or type(outcome.get("Kind")) is not str:
        _fail(
            "CandidateShape",
            "certificate",
            "Native.Outcome",
            "exact outcome union required",
        )
    if outcome["Kind"] == "candidate":
        _keys(outcome, ("Kind", "Value"), "Native.Outcome", "CandidateShape")
        _candidate(outcome["Value"], original)
        if counters["Starts"] != 1 or counters["ObjectiveEntries"] != 1:
            _fail(
                "CandidateShape",
                "certificate",
                "Native.Counters",
                "candidate needs numeric and objective entry",
            )
        if any(row["Failure"] is not None for row in value["Trace"]):
            _fail(
                "CandidateShape",
                "certificate",
                "Native.Trace",
                "native candidate cannot follow a failed stage",
            )
    elif outcome["Kind"] == "refused":
        _keys(
            outcome, ("Kind", "Failure", "Partial"), "Native.Outcome", "CandidateShape"
        )
        _native_failure(outcome["Failure"], "Native.Outcome.Failure")
        partial = _keys(
            outcome["Partial"],
            ("Target", "Parameters", "Bracket", "Candidate", "OriginalObjective"),
            "Native.Partial",
            "CandidateShape",
        )
        if partial["Target"] is not None and partial["Target"] != original.Snapshot:
            _fail(
                "TargetMismatch",
                "certificate",
                "Native.Partial.Target",
                "independent target snapshot differs",
            )
        if partial["Parameters"] is not None:
            _bit_map(
                partial["Parameters"],
                ("LogTBits", "LogCBits", "ABits", "BBits", "DBits"),
                "Native.Partial.Parameters",
                nullable=True,
            )
        if partial["Bracket"] is not None:
            _bit_map(
                partial["Bracket"], ("LowerBits", "UpperBits"), "Native.Partial.Bracket"
            )
        if partial["Candidate"] is not None:
            _candidate(partial["Candidate"], original, nullable=True)
        observed = partial["OriginalObjective"]
        if observed is not None:
            if type(observed) is not dict:
                _fail(
                    "CandidateShape",
                    "certificate",
                    "Native.Partial.OriginalObjective",
                    "exact observation union required",
                )
            if observed.get("Kind") == "returned":
                _keys(
                    observed,
                    ("Kind", "Value"),
                    "Native.Partial.OriginalObjective",
                    "CandidateShape",
                )
                _bit_map(
                    observed["Value"],
                    _OBJECTIVE_BITS,
                    "Native.Partial.OriginalObjective.Value",
                )
            elif observed.get("Kind") == "refused":
                _keys(
                    observed,
                    ("Kind", "Failure"),
                    "Native.Partial.OriginalObjective",
                    "CandidateShape",
                )
                _kernel_failure(
                    observed["Failure"], "Native.Partial.OriginalObjective.Failure"
                )
            else:
                _fail(
                    "CandidateShape",
                    "certificate",
                    "Native.Partial.OriginalObjective.Kind",
                    "returned or refused observation required",
                )
    else:
        _fail(
            "CandidateShape",
            "certificate",
            "Native.Outcome.Kind",
            "candidate or refused required",
        )
    _trace_admission(value, midpoint_limit)
    return value


def _trace_admission(native: Tree, midpoint_limit: int) -> None:
    """Check the source-fixed structural ledger, not floating computations."""
    trace = native["Trace"]
    counters = native["Counters"]
    outcome = native["Outcome"]
    candidate = outcome["Kind"] == "candidate"
    failure = None if candidate else outcome["Failure"]
    abnormal = failure is not None and failure["Code"] == "Unexpected"

    def require(condition: bool, field: str, message: str) -> None:
        if not condition:
            _fail("CandidateShape", "certificate", field, message)

    require(
        bool(trace), "Native.Trace", "a receipt must retain its actual stage prefix"
    )
    mids = [row for row in trace if row["Stage"] == "midpoint"]
    count = len(mids)
    complete = (
        ["input", "parameters", "left-endpoint", "right-endpoint"]
        + ["midpoint"] * max(count, 1)
        + ["reconstruction", "objective"]
    )
    stages = [row["Stage"] for row in trace]
    require(
        stages == (complete if candidate else complete[: len(trace)]),
        "Native.Trace",
        "source-fixed complete stage order or ending prefix required",
    )
    for attempt, row in enumerate(mids, 1):
        require(
            row["Attempt"] == attempt,
            "Native.Trace.Attempt",
            "midpoint attempts must be consecutive",
        )
    if not candidate:
        assert failure is not None  # The admitted refusal union owns this value.
        require(
            trace[-1]["Failure"] == failure,
            "Native.Trace.Failure",
            "last stage must retain the exact returned failure",
        )
        require(
            all(row["Failure"] is None for row in trace[:-1]),
            "Native.Trace.Failure",
            "no normal work follows a failed stage",
        )
        if not abnormal:
            require(
                failure["Stage"] == trace[-1]["Stage"],
                "Native.Trace.Failure.Stage",
                "normal failure belongs to its ending stage",
            )
            fixed_stage = {
                "NoRoundedBracket": "right-endpoint",
                "IterationLimit": "midpoint",
                "ResolutionLimit": "midpoint",
            }.get(failure["Code"])
            if fixed_stage is not None:
                require(
                    trace[-1]["Stage"] == fixed_stage,
                    "Native.Trace.Failure.Stage",
                    "source-specific refusal belongs to its fixed stage",
                )

    for index, row in enumerate(trace):
        stage = row["Stage"]
        failed = row["Failure"] is not None
        pair = row["LowerBits"] is not None
        require(
            pair == (row["UpperBits"] is not None),
            "Native.Trace.Bracket",
            "bracket fields occur together",
        )
        if abnormal and index == len(trace) - 1:
            # The abnormal available prefix does not invent completed work.
            continue
        require(
            pair == (stage != "input" and not (stage == "parameters" and failed)),
            "Native.Trace.Bracket",
            "bracket presence must match the admitted stage",
        )
        if stage in ("input", "parameters", "reconstruction", "objective"):
            require(
                row["PointBits"] is None and row["PhiBits"] is None,
                "Native.Trace.PointBits",
                "point and phi are unused in this stage",
            )
        elif not failed:
            require(
                row["PointBits"] is not None and row["PhiBits"] is not None,
                "Native.Trace.PhiBits",
                "completed endpoint or midpoint retains point and phi",
            )
        elif stage in ("left-endpoint", "right-endpoint"):
            assert failure is not None  # Candidate stages cannot be failed.
            require(
                row["PointBits"] is not None,
                "Native.Trace.PointBits",
                "endpoint point precedes phi entry",
            )
            require(
                (row["PhiBits"] is not None) == (failure["Code"] == "NoRoundedBracket"),
                "Native.Trace.PhiBits",
                "endpoint failure retains exactly the reached phi",
            )

    if abnormal:
        # This remains NoCandidate with the original Unexpected failure, never
        # a normal expected-refusal pass or completed primitive-call inference.
        return
    require(
        counters["MidpointAttempts"] == count,
        "Native.Counters.MidpointAttempts",
        "one stage row per actual midpoint attempt required",
    )
    require(
        counters["PhiEntries"] == counters["ExpEntries"],
        "Native.Counters.ExpEntries",
        "the fixed native phi enters its one exponential",
    )
    last = trace[-1]["Stage"]
    phi = counters["PhiEntries"]
    updates = counters["BracketUpdates"]
    if last == "input":
        require(
            all(number == 0 for number in counters.values()),
            "Native.Counters",
            "input refusal has no numeric entries",
        )
        return
    require(
        counters["Starts"] == 1,
        "Native.Counters.Starts",
        "numeric prefix requires its actual entry",
    )
    if last == "parameters":
        assert failure is not None  # A candidate has the complete stage roster.
        require(
            phi == updates == counters["ObjectiveEntries"] == 0,
            "Native.Counters",
            "parameter refusal precedes endpoint and objective work",
        )
        if failure["Code"] == "Domain":
            require(
                counters["LogEntries"] == 0,
                "Native.Counters.LogEntries",
                "target-domain refusal precedes logarithms",
            )
        return
    require(
        counters["LogEntries"] == 3,
        "Native.Counters.LogEntries",
        "completed parameters require all three logarithms",
    )
    if last in ("left-endpoint", "right-endpoint"):
        require(
            phi == (1 if last == "left-endpoint" else 2)
            and updates == counters["ObjectiveEntries"] == 0,
            "Native.Counters",
            "endpoint prefix counters differ",
        )
        return
    require(
        count >= 1,
        "Native.Counters.MidpointAttempts",
        "later stages require a midpoint attempt",
    )
    if last == "midpoint":
        assert failure is not None  # A candidate ends at objective.
        require(
            counters["ObjectiveEntries"] == 0,
            "Native.Counters.ObjectiveEntries",
            "midpoint failure precedes objective work",
        )
        row = trace[-1]
        code = failure["Code"]
        if code == "IterationLimit":
            require(
                count == midpoint_limit and phi == 2 + count and updates == count,
                "Native.Counters",
                "budget refusal follows the final phi and update",
            )
            require(
                row["PointBits"] is not None and row["PhiBits"] is not None,
                "Native.Trace.PhiBits",
                "budget refusal retains its completed phi",
            )
        elif code == "ResolutionLimit":
            require(
                phi == 1 + count and updates == count - 1,
                "Native.Counters",
                "resolution refusal precedes phi",
            )
            require(
                row["PointBits"] is not None and row["PhiBits"] is None,
                "Native.Trace.PointBits",
                "resolution refusal retains its computed point only",
            )
        else:
            require(
                (phi, updates)
                in ((1 + count, count - 1), (2 + count, count - 1), (2 + count, count)),
                "Native.Counters",
                "midpoint prefix entry/update counters differ",
            )
            if phi == 1 + count:
                require(
                    row["PointBits"] is None and row["PhiBits"] is None,
                    "Native.Trace.PointBits",
                    "midpoint arithmetic refused before publishing its point",
                )
            else:
                require(
                    row["PointBits"] is not None,
                    "Native.Trace.PointBits",
                    "entered phi has an admitted point",
                )
                require(
                    (row["PhiBits"] is not None) == (updates == count),
                    "Native.Trace.PhiBits",
                    "completed phi precedes its update or stop check",
                )
        return
    require(
        phi == 2 + count and updates in (count - 1, count),
        "Native.Counters",
        "reconstruction/objective requires the complete midpoint prefix",
    )
    require(
        counters["ObjectiveEntries"] == (1 if last == "objective" else 0),
        "Native.Counters.ObjectiveEntries",
        "objective entry must match its stage row",
    )
    if candidate:
        expected_updates = (
            count - 1 if outcome["Value"]["Stop"] == "rounded-zero" else count
        )
        require(
            updates == expected_updates,
            "Native.Counters.BracketUpdates",
            "candidate stop and update count differ",
        )


class _Post:
    """One fixed post-root context, shared six-entry budget and actual partials."""

    def __init__(self, arithmetic: iv.Arithmetic):
        self.a = arithmetic
        self.stage = "certificate"
        self.partial: dict[str, iv.Interval | None] = {}

    def take[T](self, result: iv.Result[T]) -> T:
        return _take(result, self.stage)

    def point(self, number: Fraction | int) -> iv.Interval:
        return self.take(self.a.point(number))

    def add(self, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(self.a.add(x, y))

    def sub(self, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(self.a.subtract(x, y))

    def mul(self, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(self.a.multiply(x, y))

    def div(self, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(self.a.divide(x, y))

    def coordinates(self, t: iv.Interval, x: iv.Interval) -> dict[str, iv.Interval]:
        q = self.take(self.a.exp(x))
        self.partial["Ratio"] = q
        r = self.mul(t, q)
        self.partial["R"] = r
        return {"Ratio": q, "R": r}

    def objective(
        self, target: dict[str, iv.Interval], m: iv.Interval, v: iv.Interval
    ) -> dict[str, iv.Interval]:
        t, u, k, c = (target[name] for name in _FIELDS)
        delta = self.sub(m, u)
        two = self.point(2)
        e = self.mul(c, self.take(self.a.exp(self.add(m, self.div(v, two)))))
        f = self.sub(
            self.add(
                self.sub(
                    self.div(
                        self.mul(t, self.add(self.take(self.a.square(delta)), v)), two
                    ),
                    self.mul(k, m),
                ),
                e,
            ),
            self.div(self.take(self.a.ln(v)), two),
        )
        self.partial["Value"] = f
        dm = self.add(self.sub(self.mul(t, delta), k), e)
        self.partial["DerivativeMean"] = dm
        dv = self.sub(
            self.add(self.div(t, two), self.div(e, two)),
            self.div(self.point(1), self.mul(two, v)),
        )
        self.partial["DerivativeVariance"] = dv
        return {"Value": f, "DerivativeMean": dm, "DerivativeVariance": dv}


def _read_interval(value: object, field: str) -> iv.Interval:
    record = _keys(value, ("Lower", "Upper"), field, "Unexpected")
    for name in ("Lower", "Upper"):
        _string(record[name], field + "." + name, 4096)
    try:
        result = iv.Interval(Decimal(record["Lower"]), Decimal(record["Upper"]))
    except ArithmeticError:
        _fail(
            "Unexpected",
            "certificate",
            field,
            "actual reference returned malformed interval",
        )
    _take(iv.exact_width(result), "certificate")
    return result


class _Certificate:
    def __init__(self, raw_native: bytes, case_id: str, input_sha: str, bindings: Tree):
        self.receipt: Tree = {
            "Schema": "zeta.precision-projection.certificate.v1",
            "CaseId": case_id,
            "InputSha256": input_sha,
            "Bindings": bindings,
            "Target": None,
            "NativeRaw": {
                "BytesHex": raw_native.hex(),
                "Bytes": len(raw_native),
                "Sha256": hashlib.sha256(raw_native).hexdigest().upper(),
            },
            "Reference": None,
            "CertificateContext": None,
            "Coordinates": None,
            "Objective": None,
            "Outcome": None,
            "LeafChecks": [],
            "Counters": dict.fromkeys(_CERT_COUNTERS, 0),
        }
        self.post: _Post | None = None

    def leaf(
        self,
        field: str,
        encoded: str,
        interval: iv.Interval,
        code: str,
        *,
        objective: bool = False,
    ) -> None:
        native = _bits(encoded, field)
        lo, hi = Fraction(interval.Lower), Fraction(interval.Upper)
        tolerance = TOLERANCE * (
            1 + (max(abs(lo), abs(hi)) if objective else abs(native))
        )
        passed = max(abs(native - lo), abs(native - hi)) <= tolerance
        row = {
            "Field": field,
            "NativeBits": encoded,
            "ReferenceInterval": _interval(interval),
            "Tolerance": _ratio(tolerance),
            "Passed": passed,
        }
        self.receipt["Counters"]["LeafChecks"] += 1
        self.receipt["LeafChecks"].append(row)
        if not passed:
            _fail(
                code,
                "certificate",
                field,
                "maximum exact endpoint distance exceeds fixed tolerance",
            )

    def observe(
        self,
        name: str,
        target: dict[str, iv.Interval],
        candidate: dict[str, iv.Interval],
    ) -> dict[str, iv.Interval]:
        assert self.post is not None
        post = self.post
        fields = (
            ("Ratio", "R")
            if name == "Coordinates"
            else ("Value", "DerivativeMean", "DerivativeVariance")
        )
        post.partial = dict.fromkeys(fields)
        post.stage = "certificate" if name == "Coordinates" else "objective"
        counter = (
            "CoordinateIntervalCalls"
            if name == "Coordinates"
            else "ObjectiveIntervalCalls"
        )
        self.receipt["Counters"][counter] += 1
        context = self.receipt["CertificateContext"]
        try:
            result = (
                post.coordinates(target["T"], candidate["LogRatioBits"])
                if name == "Coordinates"
                else post.objective(
                    target, candidate["MeanBits"], candidate["VarianceBits"]
                )
            )
            # Full actual returned observation is assigned before any leaf check.
            self.receipt[name] = {
                "Kind": "returned",
                "Context": context,
                "Value": {key: _interval(value) for key, value in result.items()},
            }
            return result
        except _Halt as error:
            self.receipt[name] = {
                "Kind": "refused",
                "Context": context,
                "Failure": asdict(error.failure),
                "Partial": {
                    key: _interval(value) for key, value in post.partial.items()
                },
            }
            raise
        except (
            Exception
        ) as error:  # Retain raised entry before rethrowing as typed control flow.
            failure = Failure("Unexpected", post.stage, name, type(error).__name__)
            self.receipt[name] = {
                "Kind": "raised",
                "Context": context,
                "Failure": asdict(failure),
                "Partial": {
                    key: _interval(value) for key, value in post.partial.items()
                },
            }
            raise _Halt(failure) from error
        finally:
            self.receipt["Counters"]["CertificateTranscendentalEntries"] = (
                post.a.TranscendentalEntries
            )

    def solve(
        self, raw_input: bytes, raw_native: bytes, original: _Input
    ) -> ReceiptFailure | None:
        r = self.receipt
        r["Target"] = original.Snapshot
        native = _native(
            raw_native, original, r["CaseId"], r["InputSha256"], r["Bindings"]
        )
        r["Counters"]["Starts"] = 1
        if native["Outcome"]["Kind"] == "refused":
            r["Outcome"] = {
                "Kind": "no-candidate",
                "NativeFailure": native["Outcome"]["Failure"],
            }
            return None
        value = native["Outcome"]["Value"]
        numeric = {
            name: _bits(value[name], name)
            for name in (
                "LogRatioBits",
                "RatioBits",
                "RBits",
                "MeanBits",
                "VarianceBits",
            )
        }
        if original.Values["T"] <= 0 or original.Values["C"] <= 0:
            _fail("Domain", "certificate", "Target", "positive dyadic t and c required")
        for name in ("RatioBits", "RBits", "VarianceBits"):
            if numeric[name] <= 0:
                _fail(
                    "CandidateShape",
                    "certificate",
                    name,
                    "strictly positive candidate value required",
                )
        lo = _bits(value["Bracket"]["LowerBits"], "Bracket.LowerBits")
        hi = _bits(value["Bracket"]["UpperBits"], "Bracket.UpperBits")
        if not lo < hi or not lo <= numeric["LogRatioBits"] <= hi:
            _fail(
                "CandidateShape",
                "certificate",
                "Bracket",
                "ordered bracket must contain candidate x, including endpoints",
            )
        r["Counters"]["ReferenceRootCalls"] += 1
        reference = reference_root(
            raw_input,
            r["Bindings"],
            expected_input_sha256=r["InputSha256"],
            expected_case_id=r["CaseId"],
        )
        if isinstance(reference, ReceiptFailure):
            r["Reference"] = reference.Receipt
            r["Outcome"] = {"Kind": "refused", "Failure": asdict(reference.Failure)}
            return ReceiptFailure(reference.Failure, r)
        if isinstance(reference, Failure):
            # An API refusal is an actual returned failure, not a root receipt.
            # Preserve it unchanged in the existing outcome before packaging.
            r["Outcome"] = {"Kind": "refused", "Failure": asdict(reference)}
            return None
        r["Reference"] = reference.Value
        if reference.Value["Outcome"]["Kind"] != "enclosure":
            _fail(
                "NoRootEnclosure",
                "certificate",
                "Reference",
                "actual reference root did not return an enclosure",
            )
        enclosure = reference.Value["Outcome"]["Value"]
        context = reference.Value["Contexts"][-1]
        r["CertificateContext"] = context
        self.leaf(
            "MeanBits",
            value["MeanBits"],
            _read_interval(enclosure["Mean"], "Reference.Mean"),
            "NotCloseToMinimum",
        )
        self.leaf(
            "VarianceBits",
            value["VarianceBits"],
            _read_interval(enclosure["Variance"], "Reference.Variance"),
            "NotCloseToMinimum",
        )
        r["Counters"]["CertificatePreparations"] += 1
        arithmetic = _take(
            iv.make_arithmetic(context["Precision"], transcendental_limit=6),
            "certificate",
        )
        if asdict(arithmetic.Spec) != context:
            _fail(
                "Unexpected",
                "certificate",
                "CertificateContext",
                "actual root context differs from registered context",
            )
        self.post = _Post(arithmetic)
        target = {
            name: self.post.point(number) for name, number in original.Values.items()
        }
        points = {name: self.post.point(number) for name, number in numeric.items()}
        coordinates = self.observe("Coordinates", target, points)
        self.leaf(
            "RatioBits",
            value["RatioBits"],
            coordinates["Ratio"],
            "InconsistentCoordinate",
        )
        self.leaf("RBits", value["RBits"], coordinates["R"], "InconsistentCoordinate")
        objective = self.observe("Objective", target, points)
        for name, bits_name in zip(
            ("Value", "DerivativeMean", "DerivativeVariance"),
            _OBJECTIVE_BITS,
            strict=True,
        ):
            self.leaf(
                "OriginalObjective." + bits_name,
                value["OriginalObjective"][bits_name],
                objective[name],
                "ObjectiveMismatch",
                objective=True,
            )
        r["Outcome"] = {
            "Kind": "certified",
            "TargetScope": "exact-native-dyadic",
            "NativeTrajectoryCertified": False,
            "GraphApplicationPerformed": False,
        }
        return None


def certify_native(
    raw_input: object,
    raw_native: object,
    expected_bindings: object,
    *,
    expected_input_sha256: object,
    expected_case_id: object,
) -> ReceiptResult:
    """Certify a supplied candidate; physical source/process custody is external.

    A refused native receipt can yield no-candidate only after complete schema
    and independent input/binding checks. Encoding failure is a distinct outer
    outcome preserving the complete actual in-memory receipt.
    """
    try:
        bindings = _caller(
            raw_input, expected_bindings, expected_input_sha256, expected_case_id
        )
        if type(raw_native) is not bytes:
            _fail("Wire", "input", "raw_native", "exact original native bytes required")
        if len(raw_native) > RESULT_LIMIT:
            _fail(
                "ResultTooLarge",
                "input",
                "raw_native",
                "native byte limit exceeded before hex expansion",
            )
    except _Halt as error:
        return error.failure
    except Exception as error:  # noqa: BLE001 - public caller boundary is typed.
        return Failure("Unexpected", "input", None, type(error).__name__)
    assert type(raw_input) is bytes and type(raw_native) is bytes
    assert type(expected_case_id) is str and type(expected_input_sha256) is str
    certificate = _Certificate(
        raw_native, expected_case_id, expected_input_sha256, bindings
    )
    try:
        original = _input(raw_input, expected_case_id)
        retained = certificate.solve(raw_input, raw_native, original)
        if retained is not None:
            return retained
    except _Halt as error:
        certificate.receipt["Outcome"] = {
            "Kind": "refused",
            "Failure": asdict(error.failure),
        }
    except Exception as error:  # noqa: BLE001 - retain all earlier actual observations.
        certificate.receipt["Outcome"] = {
            "Kind": "refused",
            "Failure": asdict(
                Failure("Unexpected", "certificate", None, type(error).__name__)
            ),
        }
    return _publish(certificate.receipt)
