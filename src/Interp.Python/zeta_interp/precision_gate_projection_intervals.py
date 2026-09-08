"""Independent finite Decimal intervals for the registered scalar projection.

Basic operations round outward. Decimal exp/ln are half-even operations whose
results are widened to adjacent representable values in the same explicit
context. This is a mathematical enclosure implementation, not a System.Math
or JIT emulator. Ordinary records are revalidated at every public operation.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from decimal import (
    ROUND_CEILING,
    ROUND_FLOOR,
    ROUND_HALF_EVEN,
    Context,
    Decimal,
    DecimalException,
    DivisionByZero,
    InvalidOperation,
    Overflow,
    Underflow,
)
from fractions import Fraction


@dataclass(frozen=True, slots=True)
class Failure:
    Code: str
    Stage: str
    Field: str | None
    Message: str
    OriginalKernelFailure: dict[str, str | None] | None = None


@dataclass(frozen=True, slots=True)
class Success[T]:
    Value: T


type Result[T] = Success[T] | Failure


@dataclass(frozen=True, slots=True)
class Interval:
    Lower: Decimal
    Upper: Decimal


@dataclass(frozen=True, slots=True)
class ContextSpec:
    Precision: int
    Emin: int = -999999
    Emax: int = 999999
    Clamp: int = 0
    TranscendentalRounding: str = "ROUND_HALF_EVEN-plus-adjacent-widening"


class _Refusal(Exception):
    def __init__(self, code: str, field: str, message: str):
        super().__init__(message)
        self.Code = code
        self.Field = field
        self.Message = message


def _capture[T](operation: Callable[[], T]) -> Result[T]:
    try:
        return Success(operation())
    except _Refusal as error:
        return Failure(error.Code, "parameters", error.Field, error.Message)
    except Underflow:
        return Failure(
            "NumericalUnderflow", "parameters", "arithmetic", "Decimal underflow"
        )
    except DecimalException as error:
        return Failure(
            "NumericalRange", "parameters", "arithmetic", type(error).__name__
        )
    except Exception as error:  # noqa: BLE001 - public boundary returns unexpected faults as data.
        return Failure("Unexpected", "parameters", "arithmetic", type(error).__name__)


def _spec(value: object) -> ContextSpec:
    if (
        type(value) is not ContextSpec
        or type(value.Precision) is not int
        or value.Precision not in (80, 160, 320)
        or type(value.Emin) is not int
        or value.Emin != -999999
        or type(value.Emax) is not int
        or value.Emax != 999999
        or type(value.Clamp) is not int
        or value.Clamp != 0
        or type(value.TranscendentalRounding) is not str
        or value.TranscendentalRounding != "ROUND_HALF_EVEN-plus-adjacent-widening"
    ):
        raise _Refusal("Domain", "Context", "registered context required")
    return value


def _interval(value: object) -> Interval:
    if (
        type(value) is not Interval
        or type(value.Lower) is not Decimal
        or type(value.Upper) is not Decimal
        or not value.Lower.is_finite()
        or not value.Upper.is_finite()
        or value.Lower > value.Upper
    ):
        raise _Refusal(
            "Domain", "Interval", "ordered finite Decimal endpoints required"
        )
    return value


def _rational(value: object) -> Fraction:
    if type(value) is Fraction:
        return value
    if type(value) is int:
        return Fraction(value)
    raise _Refusal("Domain", "Rational", "exact int or Fraction required")


def _finite(value: Decimal) -> Decimal:
    if not value.is_finite():
        raise _Refusal("NumericalRange", "arithmetic", "finite result required")
    return value


@dataclass(slots=True)
class Arithmetic:
    """Sequential arithmetic context; counters report actual exp/ln entries.

    Construct with make_arithmetic. Mutable counters are observable bookkeeping,
    not a security capability. Methods refuse invalid ordinary reconstructed state.
    """

    Spec: ContextSpec
    TranscendentalLimit: int = 4096
    TranscendentalEntries: int = 0

    def _context(self, rounding: str) -> Context:
        spec = _spec(self.Spec)
        if (
            type(self.TranscendentalLimit) is not int
            or not 0 <= self.TranscendentalLimit <= 4096
            or type(self.TranscendentalEntries) is not int
            or not 0 <= self.TranscendentalEntries <= self.TranscendentalLimit
        ):
            raise _Refusal(
                "Domain", "TranscendentalEntries", "valid bounded counter required"
            )
        return Context(
            prec=spec.Precision,
            rounding=rounding,
            Emin=spec.Emin,
            Emax=spec.Emax,
            clamp=spec.Clamp,
            traps=[InvalidOperation, DivisionByZero, Overflow, Underflow],
        )

    def _point(self, value: object) -> Interval:
        number = _rational(value)
        numerator, denominator = Decimal(number.numerator), Decimal(number.denominator)
        lower = self._context(ROUND_FLOOR).divide(numerator, denominator)
        upper = self._context(ROUND_CEILING).divide(numerator, denominator)
        return Interval(_finite(lower), _finite(upper))

    def point(self, value: object) -> Result[Interval]:
        return _capture(lambda: self._point(value))

    def _binary(self, left: object, right: object, operation: str) -> Interval:
        a, b = _interval(left), _interval(right)
        lo, hi = self._context(ROUND_FLOOR), self._context(ROUND_CEILING)
        if operation == "add":
            return Interval(
                _finite(lo.add(a.Lower, b.Lower)), _finite(hi.add(a.Upper, b.Upper))
            )
        if operation == "subtract":
            return Interval(
                _finite(lo.subtract(a.Lower, b.Upper)),
                _finite(hi.subtract(a.Upper, b.Lower)),
            )
        if operation == "divide" and b.Lower <= 0 <= b.Upper:
            raise _Refusal("Domain", "Denominator", "interval must exclude zero")
        lower_op = lo.multiply if operation == "multiply" else lo.divide
        upper_op = hi.multiply if operation == "multiply" else hi.divide
        pairs = ((x, y) for x in (a.Lower, a.Upper) for y in (b.Lower, b.Upper))
        bounds = [(_finite(lower_op(x, y)), _finite(upper_op(x, y))) for x, y in pairs]
        return Interval(min(x for x, _ in bounds), max(y for _, y in bounds))

    def add(self, left: object, right: object) -> Result[Interval]:
        return _capture(lambda: self._binary(left, right, "add"))

    def subtract(self, left: object, right: object) -> Result[Interval]:
        return _capture(lambda: self._binary(left, right, "subtract"))

    def multiply(self, left: object, right: object) -> Result[Interval]:
        return _capture(lambda: self._binary(left, right, "multiply"))

    def divide(self, left: object, right: object) -> Result[Interval]:
        return _capture(lambda: self._binary(left, right, "divide"))

    def _square(self, value: object) -> Interval:
        a = _interval(value)
        lo, hi = self._context(ROUND_FLOOR), self._context(ROUND_CEILING)
        nearest = min(a.Lower.copy_abs(), a.Upper.copy_abs())
        farthest = max(a.Lower.copy_abs(), a.Upper.copy_abs())
        lower = Decimal(0) if a.Lower <= 0 <= a.Upper else lo.multiply(nearest, nearest)
        return Interval(_finite(lower), _finite(hi.multiply(farthest, farthest)))

    def square(self, value: object) -> Result[Interval]:
        return _capture(lambda: self._square(value))

    def _transcendental(self, value: object, operation: str) -> Interval:
        a = _interval(value)
        if operation == "ln" and a.Lower <= 0:
            raise _Refusal("Domain", "Logarithm", "positive interval required")
        bounds: list[tuple[Decimal, Decimal]] = []
        for point in (a.Lower, a.Upper):
            context = self._context(ROUND_HALF_EVEN)
            if operation == "exp" and point == 0:
                bounds.append((Decimal(1), Decimal(1)))
                continue
            if operation == "ln" and point == 1:
                bounds.append((Decimal(0), Decimal(0)))
                continue
            if self.TranscendentalEntries >= self.TranscendentalLimit:
                raise _Refusal(
                    "IterationLimit", "TranscendentalEntries", "entry budget exhausted"
                )
            self.TranscendentalEntries += 1
            answer = context.exp(point) if operation == "exp" else context.ln(point)
            lower, upper = (
                _finite(context.next_minus(answer)),
                _finite(context.next_plus(answer)),
            )
            if operation == "exp" and lower <= 0:
                raise _Refusal(
                    "NumericalUnderflow", "Exponential", "lost positive lower bound"
                )
            bounds.append((lower, upper))
        return Interval(bounds[0][0], bounds[1][1])

    def exp(self, value: object) -> Result[Interval]:
        return _capture(lambda: self._transcendental(value, "exp"))

    def ln(self, value: object) -> Result[Interval]:
        return _capture(lambda: self._transcendental(value, "ln"))

    def _midpoint(self, value: object) -> Decimal:
        a = _interval(value)
        exact = (Fraction(a.Lower) + Fraction(a.Upper)) / 2
        point = self._context(ROUND_HALF_EVEN).divide(
            Decimal(exact.numerator), Decimal(exact.denominator)
        )
        if not a.Lower < point < a.Upper:
            raise _Refusal(
                "ResolutionLimit", "Midpoint", "no represented strict interior point"
            )
        return _finite(point)

    def midpoint(self, value: object) -> Result[Decimal]:
        return _capture(lambda: self._midpoint(value))


def make_arithmetic(
    precision: object, *, transcendental_limit: object = 4096
) -> Result[Arithmetic]:
    def create() -> Arithmetic:
        if type(precision) is not int or type(transcendental_limit) is not int:
            raise _Refusal("Domain", "Context", "integer precision and limit required")
        result = Arithmetic(ContextSpec(precision), transcendental_limit)
        result._context(ROUND_HALF_EVEN)
        return result

    return _capture(create)


def intersect(left: object, right: object) -> Result[Interval]:
    def operation() -> Interval:
        a, b = _interval(left), _interval(right)
        lower, upper = max(a.Lower, b.Lower), min(a.Upper, b.Upper)
        if lower > upper:
            raise _Refusal(
                "EmptyIntersection", "Interval", "proved intervals are disjoint"
            )
        return Interval(lower, upper)

    return _capture(operation)


def exact_width(value: object) -> Result[Fraction]:
    def operation() -> Fraction:
        a = _interval(value)
        return Fraction(a.Upper) - Fraction(a.Lower)

    return _capture(operation)
